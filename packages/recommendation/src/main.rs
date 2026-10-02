// SPDX-FileCopyrightText: 2026 Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only

mod candidates;
mod config;
mod id_time;
mod index;
mod indexer;
mod ranker;

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use serde::Serialize;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::index::IndexStore;
use crate::ranker::{RankerConfig, RerankRequest, RerankResponse};

#[derive(Clone)]
struct AppState {
    store: Arc<IndexStore>,
    ranker: RankerConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    indexed_notes: usize,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = AppConfig::from_env();
    let store = Arc::new(IndexStore::open(
        &config.index_db_path,
        config.index_max_rows,
    )?);
    let state = AppState {
        store: Arc::clone(&store),
        ranker: config.ranker.clone(),
    };

    let indexer_config = config.clone();
    tokio::spawn(indexer::run(indexer_config, store));

    let app = Router::new()
        .route("/healthz", get(health))
        .route("/v1/candidates", post(discover_candidates))
        .route("/v1/rerank", post(rerank))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    info!(address = %config.listen_addr, "Misutgaru recommendation service listening");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn discover_candidates(
    State(state): State<AppState>,
    Json(request): Json<candidates::DiscoverRequest>,
) -> Result<Json<candidates::DiscoverResponse>, StatusCode> {
    if request.limit > 200 || request.exclude_ids.len() > 500 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0);
    let min_created_at_ms = now_ms.saturating_sub(12 * 60 * 60 * 1_000);
    let max_created_at_ms = request.older_than_ms.unwrap_or(now_ms).min(now_ms);
    let pool = state
        .store
        .candidate_pool(min_created_at_ms, max_created_at_ms, 5_000)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(candidates::discover(pool, request, now_ms)))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        indexed_notes: state.store.count().unwrap_or(0),
    })
}

async fn rerank(
    State(state): State<AppState>,
    Json(request): Json<RerankRequest>,
) -> Result<Json<RerankResponse>, StatusCode> {
    if request.candidates.len() > 500 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let ids: Vec<String> = request
        .candidates
        .iter()
        .map(|candidate| candidate.id.clone())
        .collect();
    let indexed = state.store.features_for(&ids).unwrap_or_default();
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0);
    Ok(Json(ranker::rerank(
        request,
        &indexed,
        &state.ranker,
        now_ms,
    )))
}
