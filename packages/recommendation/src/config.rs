// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

use std::env;
use std::path::PathBuf;
use std::time::Duration;

use crate::ranker::RankerConfig;

#[derive(Clone, Debug)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub listen_addr: String,
    pub index_db_path: PathBuf,
    pub index_max_rows: usize,
    pub index_refresh_limit: i64,
    pub activity_refresh_limit: i64,
    pub index_poll_interval: Duration,
    pub id_generation_method: String,
    pub database: DatabaseConfig,
    pub ranker: RankerConfig,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            listen_addr: env_string("RECOMMENDATION_LISTEN_ADDR", "0.0.0.0:3080"),
            index_db_path: PathBuf::from(env_string(
                "RECOMMENDATION_INDEX_DB",
                "/data/recommendation.sqlite3",
            )),
            index_max_rows: env_usize("RECOMMENDATION_INDEX_MAX_ROWS", 100_000),
            index_refresh_limit: env_i64("RECOMMENDATION_INDEX_REFRESH_LIMIT", 2_000),
            activity_refresh_limit: env_i64("RECOMMENDATION_ACTIVITY_REFRESH_LIMIT", 1_000),
            index_poll_interval: Duration::from_secs(env_u64(
                "RECOMMENDATION_INDEX_POLL_SECONDS",
                5,
            )),
            id_generation_method: env_string("RECOMMENDATION_ID_GENERATION_METHOD", "aidx"),
            database: DatabaseConfig {
                host: first_env(&["RECOMMENDATION_DB_HOST", "DATABASE_HOST"])
                    .unwrap_or_else(|| "db".to_owned()),
                port: first_env(&["RECOMMENDATION_DB_PORT", "DATABASE_PORT"])
                    .and_then(|value| value.parse().ok())
                    .unwrap_or(5432),
                database: first_env(&["RECOMMENDATION_DB_NAME", "POSTGRES_DB", "DATABASE_DB"])
                    .unwrap_or_else(|| "misskey".to_owned()),
                user: first_env(&["RECOMMENDATION_DB_USER", "POSTGRES_USER", "DATABASE_USER"])
                    .unwrap_or_else(|| "misskey".to_owned()),
                password: first_env(&[
                    "RECOMMENDATION_DB_PASSWORD",
                    "POSTGRES_PASSWORD",
                    "DATABASE_PASSWORD",
                ]),
            },
            ranker: RankerConfig::from_env(),
        }
    }
}

fn first_env(keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| env::var(key).ok().filter(|value| !value.is_empty()))
}

fn env_string(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_owned())
}

fn env_u64(key: &str, fallback: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

fn env_i64(key: &str, fallback: i64) -> i64 {
    env::var(key)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}

fn env_usize(key: &str, fallback: usize) -> usize {
    env::var(key)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(fallback)
}
