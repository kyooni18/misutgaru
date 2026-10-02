// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, params};

#[derive(Clone, Debug, Default)]
pub struct NoteFeatures {
    pub note_id: String,
    pub author_id: String,
    pub created_at_ms: i64,
    pub last_activity_at_ms: i64,
    pub reaction_count: i64,
    pub reply_count: i64,
    pub renote_count: i64,
    pub has_media: bool,
    pub is_reply: bool,
    pub is_renote: bool,
    pub is_local: bool,
    pub reply_to_id: Option<String>,
    pub renote_of_id: Option<String>,
}

pub struct IndexStore {
    conn: Mutex<Connection>,
    max_rows: usize,
}

impl IndexStore {
    pub fn open(path: &Path, max_rows: usize) -> Result<Self, rusqlite::Error> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS note_features (
                note_id TEXT PRIMARY KEY,
                author_id TEXT NOT NULL,
                created_at_ms INTEGER NOT NULL DEFAULT 0,
                last_activity_at_ms INTEGER NOT NULL DEFAULT 0,
                reaction_count INTEGER NOT NULL,
                reply_count INTEGER NOT NULL,
                renote_count INTEGER NOT NULL,
                has_media INTEGER NOT NULL,
                is_reply INTEGER NOT NULL,
                is_renote INTEGER NOT NULL,
                is_local INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS note_features_author_id
                ON note_features(author_id);
            "#,
        )?;
        ensure_column(&conn, "created_at_ms", "INTEGER NOT NULL DEFAULT 0")?;
        ensure_column(&conn, "last_activity_at_ms", "INTEGER NOT NULL DEFAULT 0")?;
        conn.execute_batch(
            r#"
            CREATE INDEX IF NOT EXISTS note_features_created_at
                ON note_features(created_at_ms DESC);
            CREATE INDEX IF NOT EXISTS note_features_last_activity
                ON note_features(last_activity_at_ms DESC);
            "#,
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
            max_rows,
        })
    }

    pub fn upsert_batch(&self, notes: &[NoteFeatures]) -> Result<(), rusqlite::Error> {
        if notes.is_empty() {
            return Ok(());
        }

        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        {
            let mut statement = tx.prepare_cached(
                r#"
                INSERT INTO note_features (
                    note_id, author_id, created_at_ms, last_activity_at_ms,
                    reaction_count, reply_count, renote_count,
                    has_media, is_reply, is_renote, is_local, updated_at
                ) VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, unixepoch())
                ON CONFLICT(note_id) DO UPDATE SET
                    author_id = excluded.author_id,
                    created_at_ms = CASE
                        WHEN note_features.created_at_ms = 0 THEN excluded.created_at_ms
                        ELSE note_features.created_at_ms
                    END,
                    last_activity_at_ms = CASE
                        WHEN note_features.last_activity_at_ms = 0
                        THEN excluded.created_at_ms
                        WHEN excluded.reaction_count > note_features.reaction_count
                          OR excluded.reply_count > note_features.reply_count
                          OR excluded.renote_count > note_features.renote_count
                        THEN unixepoch() * 1000
                        ELSE note_features.last_activity_at_ms
                    END,
                    reaction_count = excluded.reaction_count,
                    reply_count = excluded.reply_count,
                    renote_count = excluded.renote_count,
                    has_media = excluded.has_media,
                    is_reply = excluded.is_reply,
                    is_renote = excluded.is_renote,
                    is_local = excluded.is_local,
                    updated_at = excluded.updated_at
                "#,
            )?;

            for note in notes {
                statement.execute(params![
                    note.note_id,
                    note.author_id,
                    note.created_at_ms,
                    note.reaction_count,
                    note.reply_count,
                    note.renote_count,
                    note.has_media,
                    note.is_reply,
                    note.is_renote,
                    note.is_local,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn features_for(
        &self,
        note_ids: &[String],
    ) -> Result<HashMap<String, NoteFeatures>, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut statement = conn.prepare_cached(
            r#"
            SELECT note_id, author_id, created_at_ms, last_activity_at_ms,
                   reaction_count, reply_count, renote_count,
                   has_media, is_reply, is_renote, is_local
            FROM note_features
            WHERE note_id = ?1
            "#,
        )?;

        let mut result = HashMap::with_capacity(note_ids.len());
        for note_id in note_ids {
            let feature = statement
                .query_row([note_id], |row| {
                    Ok(NoteFeatures {
                        note_id: row.get(0)?,
                        author_id: row.get(1)?,
                        created_at_ms: row.get(2)?,
                        last_activity_at_ms: row.get(3)?,
                        reaction_count: row.get(4)?,
                        reply_count: row.get(5)?,
                        renote_count: row.get(6)?,
                        has_media: row.get(7)?,
                        is_reply: row.get(8)?,
                        is_renote: row.get(9)?,
                        is_local: row.get(10)?,
                        reply_to_id: None,
                        renote_of_id: None,
                    })
                })
                .optional()?;
            if let Some(feature) = feature {
                result.insert(note_id.clone(), feature);
            }
        }
        Ok(result)
    }

    pub fn candidate_pool(
        &self,
        min_created_at_ms: i64,
        max_created_at_ms: i64,
        limit: usize,
    ) -> Result<Vec<NoteFeatures>, rusqlite::Error> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut statement = conn.prepare_cached(
            r#"
            SELECT note_id, author_id, created_at_ms, last_activity_at_ms,
                   reaction_count, reply_count, renote_count,
                   has_media, is_reply, is_renote, is_local
            FROM note_features
            WHERE created_at_ms >= ?1 AND created_at_ms <= ?2
            ORDER BY created_at_ms DESC
            LIMIT ?3
            "#,
        )?;
        let rows = statement.query_map(
            params![
                min_created_at_ms,
                max_created_at_ms,
                limit.min(i64::MAX as usize) as i64
            ],
            |row| {
                Ok(NoteFeatures {
                    note_id: row.get(0)?,
                    author_id: row.get(1)?,
                    created_at_ms: row.get(2)?,
                    last_activity_at_ms: row.get(3)?,
                    reaction_count: row.get(4)?,
                    reply_count: row.get(5)?,
                    renote_count: row.get(6)?,
                    has_media: row.get(7)?,
                    is_reply: row.get(8)?,
                    is_renote: row.get(9)?,
                    is_local: row.get(10)?,
                    reply_to_id: None,
                    renote_of_id: None,
                })
            },
        )?;
        rows.collect()
    }

    pub fn touch_activity_batch(
        &self,
        activities: &[(String, i64)],
    ) -> Result<(), rusqlite::Error> {
        if activities.is_empty() {
            return Ok(());
        }
        let mut conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let tx = conn.transaction()?;
        {
            let mut statement = tx.prepare_cached(
                r#"
                UPDATE note_features
                SET last_activity_at_ms = MAX(last_activity_at_ms, ?2)
                WHERE note_id = ?1
                "#,
            )?;
            for (note_id, activity_at_ms) in activities {
                statement.execute(params![note_id, activity_at_ms])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn count(&self) -> Result<usize, rusqlite::Error> {
        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        conn.query_row("SELECT COUNT(*) FROM note_features", [], |row| {
            row.get::<_, i64>(0).map(|value| value.max(0) as usize)
        })
    }

    pub fn prune(&self) -> Result<(), rusqlite::Error> {
        if self.max_rows == 0 {
            return Ok(());
        }

        let conn = self
            .conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let count = conn.query_row("SELECT COUNT(*) FROM note_features", [], |row| {
            row.get::<_, i64>(0)
        })?;
        if count <= self.max_rows as i64 {
            return Ok(());
        }

        let cutoff: Option<String> = conn
            .query_row(
                "SELECT note_id FROM note_features ORDER BY note_id DESC LIMIT 1 OFFSET ?1",
                [self.max_rows.saturating_sub(1) as i64],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(cutoff) = cutoff {
            conn.execute("DELETE FROM note_features WHERE note_id < ?1", [cutoff])?;
        }
        Ok(())
    }
}

fn ensure_column(conn: &Connection, name: &str, declaration: &str) -> Result<(), rusqlite::Error> {
    let mut statement = conn.prepare("PRAGMA table_info(note_features)")?;
    let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
    for column in columns {
        if column? == name {
            return Ok(());
        }
    }
    conn.execute(
        &format!("ALTER TABLE note_features ADD COLUMN {name} {declaration}"),
        [],
    )?;
    Ok(())
}
