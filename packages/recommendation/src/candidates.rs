// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::index::NoteFeatures;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverRequest {
    pub viewer_id: Option<String>,
    #[serde(default)]
    pub exclude_ids: Vec<String>,
    pub limit: usize,
    pub older_than_ms: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverResponse {
    pub candidate_ids: Vec<String>,
    pub rediscovery_count: usize,
    pub active_conversation_count: usize,
    pub exploration_count: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Source {
    Rediscovery,
    ActiveConversation,
    Exploration,
}

#[derive(Clone, Debug)]
struct Scored {
    note: NoteFeatures,
    source: Source,
    score: f64,
}

pub fn discover(
    pool: Vec<NoteFeatures>,
    request: DiscoverRequest,
    now_ms: i64,
) -> DiscoverResponse {
    let limit = request.limit.min(200);
    if limit == 0 {
        return DiscoverResponse {
            candidate_ids: Vec::new(),
            rediscovery_count: 0,
            active_conversation_count: 0,
            exploration_count: 0,
        };
    }

    let excluded: HashSet<_> = request.exclude_ids.into_iter().collect();
    let viewer_seed = request.viewer_id.as_deref().unwrap_or("anonymous");
    let older_than_ms = request.older_than_ms.unwrap_or(now_ms);

    let mut rediscovery = Vec::new();
    let mut active = Vec::new();
    let mut exploration = Vec::new();

    for note in pool {
        if note.created_at_ms <= 0
            || note.created_at_ms >= older_than_ms
            || excluded.contains(&note.note_id)
        {
            continue;
        }

        let age_hours = ((now_ms - note.created_at_ms).max(0) as f64) / 3_600_000.0;
        if !(0.15..=12.0).contains(&age_hours) {
            continue;
        }

        let engagement_raw = note.reaction_count.max(0) as f64
            + note.reply_count.max(0) as f64 * 1.8
            + note.renote_count.max(0) as f64 * 1.2;
        let engagement = (engagement_raw.ln_1p() / 40.0_f64.ln_1p()).clamp(0.0, 1.0);
        let jitter = deterministic_jitter(viewer_seed, &note.note_id, now_ms, 300);

        let rediscovery_distance = (age_hours - 2.0) / 1.75;
        let rediscovery_score = (-0.5 * rediscovery_distance * rediscovery_distance).exp() * 0.55
            + engagement * 0.35
            + jitter * 0.10;
        rediscovery.push(Scored {
            note: note.clone(),
            source: Source::Rediscovery,
            score: rediscovery_score,
        });

        let activity_age_hours = ((now_ms - note.last_activity_at_ms).max(0) as f64) / 3_600_000.0;
        if note.last_activity_at_ms > note.created_at_ms && activity_age_hours <= 1.5 {
            let activity = (-std::f64::consts::LN_2 * activity_age_hours / 0.35).exp();
            let conversation =
                ((note.reply_count.max(0) as f64).ln_1p() / 8.0_f64.ln_1p()).clamp(0.0, 1.0);
            active.push(Scored {
                note: note.clone(),
                source: Source::ActiveConversation,
                score: activity * 0.55 + conversation * 0.25 + engagement * 0.15 + jitter * 0.05,
            });
        }

        exploration.push(Scored {
            note,
            source: Source::Exploration,
            score: jitter * 0.75 + (1.0 - engagement) * 0.25,
        });
    }

    sort_scored(&mut rediscovery);
    sort_scored(&mut active);
    sort_scored(&mut exploration);

    let active_target = ((limit as f64) * 0.30).round() as usize;
    let exploration_target = ((limit as f64) * 0.10).round() as usize;
    let rediscovery_target = limit.saturating_sub(active_target + exploration_target);

    let mut selected = Vec::with_capacity(limit);
    let mut used_ids = HashSet::new();
    let mut author_counts: HashMap<String, usize> = HashMap::new();
    take_diverse(
        &active,
        active_target,
        limit,
        &mut selected,
        &mut used_ids,
        &mut author_counts,
    );
    take_diverse(
        &rediscovery,
        rediscovery_target,
        limit,
        &mut selected,
        &mut used_ids,
        &mut author_counts,
    );
    take_diverse(
        &exploration,
        exploration_target,
        limit,
        &mut selected,
        &mut used_ids,
        &mut author_counts,
    );

    if selected.len() < limit {
        let mut fallback = Vec::new();
        fallback.extend(active);
        fallback.extend(rediscovery);
        fallback.extend(exploration);
        sort_scored(&mut fallback);
        take_diverse(
            &fallback,
            limit - selected.len(),
            limit,
            &mut selected,
            &mut used_ids,
            &mut author_counts,
        );
    }

    let rediscovery_count = selected
        .iter()
        .filter(|candidate| candidate.source == Source::Rediscovery)
        .count();
    let active_conversation_count = selected
        .iter()
        .filter(|candidate| candidate.source == Source::ActiveConversation)
        .count();
    let exploration_count = selected
        .iter()
        .filter(|candidate| candidate.source == Source::Exploration)
        .count();

    DiscoverResponse {
        candidate_ids: selected
            .into_iter()
            .map(|candidate| candidate.note.note_id)
            .collect(),
        rediscovery_count,
        active_conversation_count,
        exploration_count,
    }
}

fn sort_scored(candidates: &mut [Scored]) {
    candidates.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.note.created_at_ms.cmp(&left.note.created_at_ms))
    });
}

fn take_diverse(
    candidates: &[Scored],
    count: usize,
    max_total: usize,
    selected: &mut Vec<Scored>,
    used_ids: &mut HashSet<String>,
    author_counts: &mut HashMap<String, usize>,
) {
    if count == 0 {
        return;
    }
    let mut remaining: Vec<_> = candidates
        .iter()
        .filter(|candidate| !used_ids.contains(&candidate.note.note_id))
        .cloned()
        .collect();
    let mut taken = 0;

    while selected.len() < max_total && taken < count && !remaining.is_empty() {
        let mut best_index = 0;
        let mut best_score = f64::NEG_INFINITY;
        for (index, candidate) in remaining.iter().enumerate() {
            let repeats = author_counts
                .get(&candidate.note.author_id)
                .copied()
                .unwrap_or(0);
            let multiplier = 0.62_f64
                .powi(repeats.min(i32::MAX as usize) as i32)
                .max(0.30);
            let score = candidate.score * multiplier;
            if score > best_score {
                best_score = score;
                best_index = index;
            }
        }

        let candidate = remaining.swap_remove(best_index);
        used_ids.insert(candidate.note.note_id.clone());
        *author_counts
            .entry(candidate.note.author_id.clone())
            .or_default() += 1;
        selected.push(candidate);
        taken += 1;
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn feature(id: &str, author: &str, age_minutes: i64, now_ms: i64) -> NoteFeatures {
        NoteFeatures {
            note_id: id.to_owned(),
            author_id: author.to_owned(),
            created_at_ms: now_ms - age_minutes * 60_000,
            last_activity_at_ms: now_ms - age_minutes * 60_000,
            ..NoteFeatures::default()
        }
    }

    #[test]
    fn excludes_current_page_and_prefers_rediscovery_window() {
        let now = 20_000_000;
        let response = discover(
            vec![
                feature("current", "a", 30, now),
                feature("two-hours", "b", 120, now),
                feature("ten-hours", "c", 600, now),
            ],
            DiscoverRequest {
                viewer_id: Some("viewer".to_owned()),
                exclude_ids: vec!["current".to_owned()],
                limit: 1,
                older_than_ms: Some(now),
            },
            now,
        );
        assert_eq!(response.candidate_ids, vec!["two-hours"]);
    }

    #[test]
    fn recent_activity_can_surface_an_older_conversation() {
        let now = 20_000_000;
        let mut active = feature("active", "a", 180, now);
        active.reply_count = 5;
        active.last_activity_at_ms = now - 5 * 60_000;
        let response = discover(
            vec![active, feature("quiet", "b", 120, now)],
            DiscoverRequest {
                viewer_id: Some("viewer".to_owned()),
                exclude_ids: Vec::new(),
                limit: 2,
                older_than_ms: Some(now),
            },
            now,
        );
        assert!(response.candidate_ids.contains(&"active".to_owned()));
        assert!(response.active_conversation_count >= 1);
    }
}
