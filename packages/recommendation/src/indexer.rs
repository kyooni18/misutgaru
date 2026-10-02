// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

use std::sync::Arc;

use serde_json::Value;
use tokio_postgres::{Client, NoTls, Row};
use tracing::{info, warn};

use crate::config::{AppConfig, DatabaseConfig};
use crate::id_time::parse_misskey_id_time_ms;
use crate::index::{IndexStore, NoteFeatures};

const NOTE_FEATURES_SELECT: &str = r#"
    SELECT
        id,
        "userId" AS author_id,
        ("userHost" IS NULL) AS is_local,
        "renoteCount"::bigint AS renote_count,
        "repliesCount"::bigint AS reply_count,
        reactions,
        (cardinality("fileIds") > 0) AS has_media,
        ("replyId" IS NOT NULL) AS is_reply,
        ("renoteId" IS NOT NULL) AS is_renote,
        "replyId" AS reply_to_id,
        "renoteId" AS renote_of_id
    FROM note
"#;

pub async fn run(config: AppConfig, store: Arc<IndexStore>) {
    loop {
        match connect(&config.database).await {
            Ok(client) => {
                if let Err(error) = sync_loop(&config, &store, &client).await {
                    warn!(%error, "recommendation indexer lost PostgreSQL connection");
                }
            }
            Err(error) => {
                warn!(%error, "recommendation indexer could not connect to PostgreSQL");
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }
}

async fn connect(config: &DatabaseConfig) -> Result<Client, tokio_postgres::Error> {
    let mut pg = tokio_postgres::Config::new();
    pg.host(&config.host)
        .port(config.port)
        .dbname(&config.database)
        .user(&config.user);
    if let Some(password) = config.password.as_deref() {
        pg.password(password);
    }

    let (client, connection) = pg.connect(NoTls).await?;
    tokio::spawn(async move {
        if let Err(error) = connection.await {
            warn!(%error, "recommendation PostgreSQL connection task ended");
        }
    });
    Ok(client)
}

async fn sync_loop(
    config: &AppConfig,
    store: &IndexStore,
    client: &Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let initial_limit = config.index_max_rows.min(i64::MAX as usize) as i64;
    let recent = fetch_recent(client, initial_limit, &config.id_generation_method).await?;
    let mut last_seen_id = recent
        .iter()
        .map(|note| note.note_id.as_str())
        .max()
        .map(str::to_owned);
    store.upsert_batch(&recent)?;
    store.prune()?;
    info!(
        indexed = recent.len(),
        "recommendation index initial sync complete"
    );

    let mut interval = tokio::time::interval(config.index_poll_interval);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;

        if last_seen_id.is_some() {
            for _ in 0..8 {
                let cursor = last_seen_id.as_deref().expect("checked above");
                let newer = fetch_newer(
                    client,
                    cursor,
                    config.index_refresh_limit,
                    &config.id_generation_method,
                )
                .await?;
                if newer.is_empty() {
                    break;
                }
                if let Some(new_last) = newer.iter().map(|note| note.note_id.as_str()).max() {
                    last_seen_id = Some(new_last.to_owned());
                }
                let full_batch = newer.len() as i64 >= config.index_refresh_limit;
                store.upsert_batch(&newer)?;
                if !full_batch {
                    break;
                }
            }
        } else {
            let recent = fetch_recent(
                client,
                config.index_refresh_limit,
                &config.id_generation_method,
            )
            .await?;
            last_seen_id = recent
                .iter()
                .map(|note| note.note_id.as_str())
                .max()
                .map(str::to_owned);
            store.upsert_batch(&recent)?;
        }

        // Engagement counters change after publication, so refresh the hot tail even
        // when no new note IDs arrived.
        let refreshed = fetch_recent(
            client,
            config.index_refresh_limit,
            &config.id_generation_method,
        )
        .await?;
        store.upsert_batch(&refreshed)?;
        store.touch_activity_batch(&related_activity(&refreshed))?;

        let reaction_activity = fetch_recent_reaction_activity(
            client,
            config.activity_refresh_limit,
            &config.id_generation_method,
        )
        .await?;
        store.touch_activity_batch(&reaction_activity)?;
        store.prune()?;
    }
}

async fn fetch_recent(
    client: &Client,
    limit: i64,
    id_generation_method: &str,
) -> Result<Vec<NoteFeatures>, tokio_postgres::Error> {
    if limit <= 0 {
        return Ok(Vec::new());
    }
    let query = format!("{NOTE_FEATURES_SELECT} ORDER BY id DESC LIMIT $1");
    let rows = client.query(&query, &[&limit]).await?;
    Ok(rows
        .iter()
        .map(|row| row_to_features(row, id_generation_method))
        .collect())
}
async fn fetch_newer(
    client: &Client,
    last_seen_id: &str,
    limit: i64,
    id_generation_method: &str,
) -> Result<Vec<NoteFeatures>, tokio_postgres::Error> {
    if limit <= 0 {
        return Ok(Vec::new());
    }
    let query = format!("{NOTE_FEATURES_SELECT} WHERE id > $1 ORDER BY id ASC LIMIT $2");
    let rows = client.query(&query, &[&last_seen_id, &limit]).await?;
    Ok(rows
        .iter()
        .map(|row| row_to_features(row, id_generation_method))
        .collect())
}

fn row_to_features(row: &Row, id_generation_method: &str) -> NoteFeatures {
    let reactions: Value = row.get("reactions");
    let note_id: String = row.get("id");
    let created_at_ms = parse_misskey_id_time_ms(&note_id, id_generation_method).unwrap_or(0);
    NoteFeatures {
        note_id,
        author_id: row.get("author_id"),
        created_at_ms,
        last_activity_at_ms: created_at_ms,
        reaction_count: reaction_count(&reactions),
        reply_count: row.get("reply_count"),
        renote_count: row.get("renote_count"),
        has_media: row.get("has_media"),
        is_reply: row.get("is_reply"),
        is_renote: row.get("is_renote"),
        is_local: row.get("is_local"),
        reply_to_id: row.get("reply_to_id"),
        renote_of_id: row.get("renote_of_id"),
    }
}

fn related_activity(notes: &[NoteFeatures]) -> Vec<(String, i64)> {
    let mut activities = Vec::new();
    for note in notes {
        if note.created_at_ms <= 0 {
            continue;
        }
        if let Some(reply_to_id) = note.reply_to_id.as_ref() {
            activities.push((reply_to_id.clone(), note.created_at_ms));
        }
        if let Some(renote_of_id) = note.renote_of_id.as_ref() {
            activities.push((renote_of_id.clone(), note.created_at_ms));
        }
    }
    activities
}

async fn fetch_recent_reaction_activity(
    client: &Client,
    limit: i64,
    id_generation_method: &str,
) -> Result<Vec<(String, i64)>, tokio_postgres::Error> {
    if limit <= 0 {
        return Ok(Vec::new());
    }
    let rows = client
        .query(
            r#"
            SELECT id, "noteId" AS note_id
            FROM note_reaction
            ORDER BY id DESC
            LIMIT $1
            "#,
            &[&limit],
        )
        .await?;
    Ok(rows
        .iter()
        .filter_map(|row| {
            let reaction_id: String = row.get("id");
            let note_id: String = row.get("note_id");
            parse_misskey_id_time_ms(&reaction_id, id_generation_method)
                .map(|activity_at_ms| (note_id, activity_at_ms))
        })
        .collect())
}

fn reaction_count(value: &Value) -> i64 {
    value
        .as_object()
        .map(|map| {
            map.values()
                .filter_map(Value::as_i64)
                .filter(|count| *count > 0)
                .sum()
        })
        .unwrap_or(0)
}
