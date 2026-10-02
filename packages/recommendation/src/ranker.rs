// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

use std::collections::{HashMap, HashSet};
use std::env;

use serde::{Deserialize, Serialize};

use crate::index::NoteFeatures;

#[derive(Clone, Debug)]
pub struct RankerConfig {
    pub source_order_weight: f64,
    pub freshness_weight: f64,
    pub rediscovery_weight: f64,
    pub engagement_weight: f64,
    pub conversation_weight: f64,
    pub media_weight: f64,
    pub jitter_weight: f64,
    pub context_weight: f64,
    pub freshness_half_life_hours: f64,
    pub rediscovery_peak_hours: f64,
    pub rediscovery_width_hours: f64,
    pub author_repeat_decay: f64,
    pub author_repeat_floor: f64,
    pub jitter_bucket_seconds: u64,
    pub context_followup_limit: usize,
}

impl RankerConfig {
    pub fn from_env() -> Self {
        Self {
            source_order_weight: env_f64("RECOMMENDATION_SOURCE_ORDER_WEIGHT", 0.25),
            freshness_weight: env_f64("RECOMMENDATION_FRESHNESS_WEIGHT", 0.28),
            rediscovery_weight: env_f64("RECOMMENDATION_REDISCOVERY_WEIGHT", 0.18),
            engagement_weight: env_f64("RECOMMENDATION_ENGAGEMENT_WEIGHT", 0.14),
            conversation_weight: env_f64("RECOMMENDATION_CONVERSATION_WEIGHT", 0.08),
            media_weight: env_f64("RECOMMENDATION_MEDIA_WEIGHT", 0.02),
            jitter_weight: env_f64("RECOMMENDATION_JITTER_WEIGHT", 0.07),
            context_weight: env_f64("RECOMMENDATION_CONTEXT_WEIGHT", 0.30),
            freshness_half_life_hours: env_f64("RECOMMENDATION_FRESHNESS_HALF_LIFE_HOURS", 2.0),
            rediscovery_peak_hours: env_f64("RECOMMENDATION_REDISCOVERY_PEAK_HOURS", 1.5),
            rediscovery_width_hours: env_f64("RECOMMENDATION_REDISCOVERY_WIDTH_HOURS", 1.25),
            author_repeat_decay: env_f64("RECOMMENDATION_AUTHOR_REPEAT_DECAY", 0.62),
            author_repeat_floor: env_f64("RECOMMENDATION_AUTHOR_REPEAT_FLOOR", 0.28),
            jitter_bucket_seconds: env_u64("RECOMMENDATION_JITTER_BUCKET_SECONDS", 300),
            context_followup_limit: env_u64("RECOMMENDATION_CONTEXT_FOLLOWUP_LIMIT", 2).min(8)
                as usize,
        }
    }
}

impl Default for RankerConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateInput {
    pub id: String,
    pub author_id: String,
    pub created_at_ms: i64,
    pub source_rank: usize,
    #[serde(default)]
    pub reaction_count: i64,
    #[serde(default)]
    pub reply_count: i64,
    #[serde(default)]
    pub renote_count: i64,
    #[serde(default)]
    pub has_media: bool,
    #[serde(default)]
    pub is_reply: bool,
    #[serde(default)]
    pub is_renote: bool,
    #[serde(default)]
    pub reply_to_id: Option<String>,
    #[serde(default)]
    pub renote_of_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub mentions: Vec<String>,
    #[serde(default)]
    pub channel_id: Option<String>,
    #[serde(default)]
    pub author_host: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RerankRequest {
    pub viewer_id: Option<String>,
    #[serde(default = "default_true")]
    pub preserve_boundaries: bool,
    pub result_limit: Option<usize>,
    pub candidates: Vec<CandidateInput>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RerankResponse {
    pub ordered_ids: Vec<String>,
    pub index_hits: usize,
}

#[derive(Clone, Debug)]
struct ScoredCandidate {
    input: CandidateInput,
    base_score: f64,
}

pub fn rerank(
    request: RerankRequest,
    indexed: &HashMap<String, NoteFeatures>,
    config: &RankerConfig,
    now_ms: i64,
) -> RerankResponse {
    let index_hits = request
        .candidates
        .iter()
        .filter(|candidate| indexed.contains_key(&candidate.id))
        .count();
    let result_limit = request
        .result_limit
        .unwrap_or(request.candidates.len())
        .min(request.candidates.len());

    if result_limit == 0 {
        return RerankResponse {
            ordered_ids: Vec::new(),
            index_hits,
        };
    }

    if request.candidates.len() <= 1
        || (request.preserve_boundaries && request.candidates.len() <= 2)
    {
        return RerankResponse {
            ordered_ids: request
                .candidates
                .into_iter()
                .take(result_limit)
                .map(|candidate| candidate.id)
                .collect(),
            index_hits,
        };
    }

    let candidate_count = request.candidates.len();
    let viewer_seed = request.viewer_id.as_deref().unwrap_or("anonymous");
    let scored: Vec<_> = request
        .candidates
        .into_iter()
        .map(|mut candidate| {
            let feature = indexed.get(&candidate.id);
            let reaction_count =
                feature.map_or(candidate.reaction_count, |value| value.reaction_count);
            let reply_count = feature.map_or(candidate.reply_count, |value| value.reply_count);
            let renote_count = feature.map_or(candidate.renote_count, |value| value.renote_count);
            let is_renote = feature.map_or(candidate.is_renote, |value| value.is_renote);
            let has_media = feature.map_or(candidate.has_media, |value| value.has_media);
            let is_reply = feature.map_or(candidate.is_reply, |value| value.is_reply);
            if candidate.reply_to_id.is_none() {
                candidate.reply_to_id = feature.and_then(|value| value.reply_to_id.clone());
            }
            if candidate.renote_of_id.is_none() {
                candidate.renote_of_id = feature.and_then(|value| value.renote_of_id.clone());
            }
            let base_score = score_candidate(
                &candidate,
                reaction_count,
                reply_count,
                renote_count,
                has_media,
                is_reply,
                is_renote,
                candidate_count,
                viewer_seed,
                config,
                now_ms,
            );
            ScoredCandidate {
                input: candidate,
                base_score,
            }
        })
        .collect();

    if request.preserve_boundaries {
        let first = scored
            .first()
            .expect("candidate count checked")
            .input
            .id
            .clone();
        let last = scored
            .last()
            .expect("candidate count checked")
            .input
            .id
            .clone();
        if result_limit == 1 {
            return RerankResponse {
                ordered_ids: vec![first],
                index_hits,
            };
        }
        let interior =
            greedy_contextual_sequence(&scored[1..scored.len() - 1], config, Some(&scored[0]));
        let mut ordered_ids = Vec::with_capacity(result_limit);
        ordered_ids.push(first);
        ordered_ids.extend(interior.into_iter().take(result_limit.saturating_sub(2)));
        ordered_ids.push(last);
        RerankResponse {
            ordered_ids,
            index_hits,
        }
    } else {
        RerankResponse {
            ordered_ids: greedy_contextual_sequence(&scored, config, None)
                .into_iter()
                .take(result_limit)
                .collect(),
            index_hits,
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn score_candidate(
    candidate: &CandidateInput,
    reaction_count: i64,
    reply_count: i64,
    renote_count: i64,
    has_media: bool,
    is_reply: bool,
    is_renote: bool,
    candidate_count: usize,
    viewer_seed: &str,
    config: &RankerConfig,
    now_ms: i64,
) -> f64 {
    let age_hours = ((now_ms - candidate.created_at_ms).max(0) as f64) / 3_600_000.0;
    let half_life = config.freshness_half_life_hours.max(0.05);
    let freshness = (-std::f64::consts::LN_2 * age_hours / half_life).exp();

    let rediscovery_width = config.rediscovery_width_hours.max(0.05);
    let rediscovery_distance = (age_hours - config.rediscovery_peak_hours) / rediscovery_width;
    let rediscovery = (-0.5 * rediscovery_distance * rediscovery_distance).exp();

    let engagement_raw = reaction_count.max(0) as f64
        + reply_count.max(0) as f64 * 1.7
        + renote_count.max(0) as f64 * 1.2;
    let engagement = (engagement_raw.ln_1p() / 30.0_f64.ln_1p()).clamp(0.0, 1.0);
    let conversation = (((reply_count.max(0) as f64).ln_1p() / 8.0_f64.ln_1p())
        + if is_reply { 0.08 } else { 0.0 })
    .clamp(0.0, 1.0);
    let media = if has_media { 1.0 } else { 0.0 };

    let source_order = if candidate_count <= 1 {
        1.0
    } else {
        1.0 - candidate.source_rank.min(candidate_count - 1) as f64 / (candidate_count - 1) as f64
    };

    let jitter = deterministic_jitter(
        viewer_seed,
        &candidate.id,
        now_ms,
        config.jitter_bucket_seconds,
    );

    let mut score = config.source_order_weight * source_order
        + config.freshness_weight * freshness
        + config.rediscovery_weight * rediscovery
        + config.engagement_weight * engagement
        + config.conversation_weight * conversation
        + config.media_weight * media
        + config.jitter_weight * jitter;

    // A pure renote already inherits much of the original post's visibility. Keep it
    // eligible, but slightly prefer original notes when scores are otherwise close.
    if is_renote {
        score *= 0.94;
    }
    score
}

const CONTEXT_AFFINITY_THRESHOLD: f64 = 0.22;

fn greedy_contextual_sequence(
    candidates: &[ScoredCandidate],
    config: &RankerConfig,
    initial_previous: Option<&ScoredCandidate>,
) -> Vec<String> {
    let mut remaining: Vec<usize> = (0..candidates.len()).collect();
    let mut author_counts: HashMap<&str, usize> = HashMap::new();
    let mut output = Vec::with_capacity(candidates.len());
    let mut previous = initial_previous;
    let mut contextual_followups = 0usize;

    while !remaining.is_empty() {
        let use_context =
            previous.is_some() && contextual_followups < config.context_followup_limit;
        let mut best_position = 0;
        let mut best_score = f64::NEG_INFINITY;
        let mut best_affinity = 0.0;
        for (position, candidate_index) in remaining.iter().enumerate() {
            let candidate = &candidates[*candidate_index];
            let repeats = author_counts
                .get(candidate.input.author_id.as_str())
                .copied()
                .unwrap_or(0);
            let multiplier = config
                .author_repeat_decay
                .powi(repeats.min(i32::MAX as usize) as i32)
                .max(config.author_repeat_floor);
            let affinity = if use_context {
                previous.map_or(0.0, |value| context_affinity(value, candidate))
            } else {
                0.0
            };
            let quality_gate = 0.5 + 0.5 * candidate.base_score.clamp(0.0, 1.0);
            let score = (candidate.base_score
                + config.context_weight.max(0.0) * affinity * quality_gate)
                * multiplier;
            if score > best_score {
                best_score = score;
                best_position = position;
                best_affinity = affinity;
            }
        }

        let candidate_index = remaining.swap_remove(best_position);
        let candidate = &candidates[candidate_index];
        *author_counts
            .entry(candidate.input.author_id.as_str())
            .or_default() += 1;
        output.push(candidate.input.id.clone());
        contextual_followups = if use_context && best_affinity >= CONTEXT_AFFINITY_THRESHOLD {
            contextual_followups + 1
        } else {
            0
        };
        previous = Some(candidate);
    }

    output
}

fn context_affinity(left: &ScoredCandidate, right: &ScoredCandidate) -> f64 {
    if directly_related(left, right) {
        return 1.0;
    }

    let mut complement = 1.0;
    if left
        .input
        .mentions
        .iter()
        .any(|id| id == &right.input.author_id)
        || right
            .input
            .mentions
            .iter()
            .any(|id| id == &left.input.author_id)
    {
        add_context_signal(&mut complement, 0.58);
    }
    add_context_signal(
        &mut complement,
        0.48 * overlap_ratio(&left.input.tags, &right.input.tags),
    );
    add_context_signal(
        &mut complement,
        0.24 * overlap_ratio(&left.input.mentions, &right.input.mentions),
    );
    if left.input.channel_id.is_some() && left.input.channel_id == right.input.channel_id {
        add_context_signal(&mut complement, 0.30);
    }
    if left.input.author_host.is_some() && left.input.author_host == right.input.author_host {
        add_context_signal(&mut complement, 0.06);
    }

    let delta_minutes =
        left.input.created_at_ms.abs_diff(right.input.created_at_ms) as f64 / 60_000.0;
    let temporal = (-std::f64::consts::LN_2 * delta_minutes / 18.0).exp();
    add_context_signal(&mut complement, 0.12 * temporal);

    let rank_distance = left.input.source_rank.abs_diff(right.input.source_rank);
    if rank_distance <= 2 && delta_minutes <= 45.0 {
        let neighbor_strength = if rank_distance <= 1 { 1.0 } else { 0.55 };
        add_context_signal(&mut complement, 0.18 * neighbor_strength * temporal);
    }

    (1.0 - complement).clamp(0.0, 1.0)
}

fn directly_related(left: &ScoredCandidate, right: &ScoredCandidate) -> bool {
    left.input.reply_to_id.as_deref() == Some(right.input.id.as_str())
        || right.input.reply_to_id.as_deref() == Some(left.input.id.as_str())
        || left.input.renote_of_id.as_deref() == Some(right.input.id.as_str())
        || right.input.renote_of_id.as_deref() == Some(left.input.id.as_str())
}

fn overlap_ratio(left: &[String], right: &[String]) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let left: HashSet<&str> = left.iter().map(String::as_str).collect();
    let right: HashSet<&str> = right.iter().map(String::as_str).collect();
    let union = left.union(&right).count();
    if union == 0 {
        return 0.0;
    }
    left.intersection(&right).count() as f64 / union as f64
}

fn add_context_signal(complement: &mut f64, signal: f64) {
    *complement *= 1.0 - signal.clamp(0.0, 1.0);
}

fn deterministic_jitter(viewer: &str, note_id: &str, now_ms: i64, bucket_seconds: u64) -> f64 {
    let bucket_ms = bucket_seconds.max(1).saturating_mul(1_000);
    let bucket = (now_ms.max(0) as u64) / bucket_ms;
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in viewer
        .bytes()
        .chain([0xff])
        .chain(note_id.bytes())
        .chain([0xfe])
        .chain(bucket.to_le_bytes())
    {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    (hash as f64) / (u64::MAX as f64)
}

fn env_f64(key: &str, fallback: f64) -> f64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

fn env_u64(key: &str, fallback: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(id: &str, author: &str, rank: usize, age_minutes: i64) -> CandidateInput {
        CandidateInput {
            id: id.to_owned(),
            author_id: author.to_owned(),
            created_at_ms: 10_000_000 - age_minutes * 60_000,
            source_rank: rank,
            reaction_count: 0,
            reply_count: 0,
            renote_count: 0,
            has_media: false,
            is_reply: false,
            is_renote: false,
            reply_to_id: None,
            renote_of_id: None,
            tags: Vec::new(),
            mentions: Vec::new(),
            channel_id: None,
            author_host: None,
        }
    }

    #[test]
    fn pagination_boundaries_are_preserved() {
        let request = RerankRequest {
            viewer_id: Some("viewer".into()),
            preserve_boundaries: true,
            result_limit: None,
            candidates: vec![
                candidate("newest", "a", 0, 0),
                candidate("middle-a", "a", 1, 1),
                candidate("middle-b", "b", 2, 2),
                candidate("oldest", "c", 3, 3),
            ],
        };
        let response = rerank(
            request,
            &HashMap::new(),
            &RankerConfig::default(),
            10_000_000,
        );
        assert_eq!(response.ordered_ids.first().unwrap(), "newest");
        assert_eq!(response.ordered_ids.last().unwrap(), "oldest");
    }

    #[test]
    fn repeated_authors_are_deboosted() {
        let config = RankerConfig {
            source_order_weight: 0.0,
            freshness_weight: 0.0,
            rediscovery_weight: 0.0,
            engagement_weight: 1.0,
            conversation_weight: 0.0,
            media_weight: 0.0,
            jitter_weight: 0.0,
            context_weight: 0.0,
            author_repeat_decay: 0.1,
            author_repeat_floor: 0.1,
            ..RankerConfig::default()
        };

        let mut a1 = candidate("a1", "a", 0, 0);
        a1.reaction_count = 20;
        let mut a2 = candidate("a2", "a", 1, 0);
        a2.reaction_count = 19;
        let mut b1 = candidate("b1", "b", 2, 0);
        b1.reaction_count = 10;

        let response = rerank(
            RerankRequest {
                viewer_id: None,
                preserve_boundaries: false,
                result_limit: None,
                candidates: vec![a1, a2, b1],
            },
            &HashMap::new(),
            &config,
            10_000_000,
        );

        assert_eq!(response.ordered_ids[0], "a1");
        assert_eq!(response.ordered_ids[1], "b1");
        assert_eq!(response.ordered_ids[2], "a2");
    }

    #[test]
    fn explicit_reply_is_pulled_next_to_its_anchor() {
        let config = RankerConfig {
            source_order_weight: 1.0,
            freshness_weight: 0.0,
            rediscovery_weight: 0.0,
            engagement_weight: 0.0,
            conversation_weight: 0.0,
            media_weight: 0.0,
            jitter_weight: 0.0,
            context_weight: 1.2,
            author_repeat_decay: 1.0,
            author_repeat_floor: 1.0,
            context_followup_limit: 2,
            ..RankerConfig::default()
        };

        let anchor = candidate("anchor", "a", 0, 0);
        let unrelated = candidate("unrelated", "b", 1, 120);
        let mut reply = candidate("reply", "c", 2, 1);
        reply.is_reply = true;
        reply.reply_to_id = Some("anchor".to_owned());

        let response = rerank(
            RerankRequest {
                viewer_id: None,
                preserve_boundaries: false,
                result_limit: None,
                candidates: vec![anchor, unrelated, reply],
            },
            &HashMap::new(),
            &config,
            10_000_000,
        );

        assert_eq!(response.ordered_ids, vec!["anchor", "reply", "unrelated"]);
    }

    #[test]
    fn contextual_followup_limit_prevents_topic_takeover() {
        let config = RankerConfig {
            source_order_weight: 1.0,
            freshness_weight: 0.0,
            rediscovery_weight: 0.0,
            engagement_weight: 0.0,
            conversation_weight: 0.0,
            media_weight: 0.0,
            jitter_weight: 0.0,
            context_weight: 1.2,
            author_repeat_decay: 1.0,
            author_repeat_floor: 1.0,
            context_followup_limit: 1,
            ..RankerConfig::default()
        };

        let anchor = candidate("anchor", "a", 0, 0);
        let unrelated = candidate("unrelated", "b", 1, 120);
        let mut related = candidate("related", "c", 2, 1);
        related.reply_to_id = Some("anchor".to_owned());
        let mut related_second = candidate("related-second", "d", 3, 2);
        related_second.reply_to_id = Some("related".to_owned());

        let response = rerank(
            RerankRequest {
                viewer_id: None,
                preserve_boundaries: false,
                result_limit: None,
                candidates: vec![anchor, unrelated, related, related_second],
            },
            &HashMap::new(),
            &config,
            10_000_000,
        );

        assert_eq!(
            &response.ordered_ids[..3],
            &["anchor", "related", "unrelated"],
        );
    }

    #[test]
    fn index_values_override_stale_request_counts() {
        let mut indexed = HashMap::new();
        indexed.insert(
            "indexed".to_owned(),
            NoteFeatures {
                note_id: "indexed".to_owned(),
                author_id: "b".to_owned(),
                reaction_count: 50,
                ..NoteFeatures::default()
            },
        );

        let config = RankerConfig {
            source_order_weight: 0.0,
            freshness_weight: 0.0,
            rediscovery_weight: 0.0,
            engagement_weight: 1.0,
            conversation_weight: 0.0,
            media_weight: 0.0,
            jitter_weight: 0.0,
            ..RankerConfig::default()
        };

        let response = rerank(
            RerankRequest {
                viewer_id: None,
                preserve_boundaries: false,
                result_limit: None,
                candidates: vec![
                    candidate("plain", "a", 0, 0),
                    candidate("indexed", "b", 1, 0),
                ],
            },
            &indexed,
            &config,
            10_000_000,
        );
        assert_eq!(response.ordered_ids[0], "indexed");
        assert_eq!(response.index_hits, 1);
    }

    #[test]
    fn limits_output_without_losing_page_boundary() {
        let response = rerank(
            RerankRequest {
                viewer_id: Some("viewer".into()),
                preserve_boundaries: true,
                result_limit: Some(3),
                candidates: vec![
                    candidate("newest", "a", 0, 0),
                    candidate("middle-a", "a", 1, 30),
                    candidate("rediscovered", "b", 2, 120),
                    candidate("middle-b", "c", 3, 45),
                    candidate("oldest", "d", 4, 60),
                ],
            },
            &HashMap::new(),
            &RankerConfig::default(),
            10_000_000,
        );
        assert_eq!(response.ordered_ids.len(), 3);
        assert_eq!(response.ordered_ids.first().unwrap(), "newest");
        assert_eq!(response.ordered_ids.last().unwrap(), "oldest");
    }
}
