# Misutgaru recommendation service

This is a small, fail-open candidate-generation and reranking service for Misskey timelines. It does not own Note data and it does not change the Misskey PostgreSQL schema.

The background indexer reads Note IDs and ranking features from PostgreSQL and stores only derived metadata in a local SQLite database. It also derives recent activity from replies, renotes, and reactions. `POST /v1/candidates` proposes rediscovery, active-conversation, and exploration IDs from that index. Misskey re-queries every proposed ID through the original timeline SQL scope before it can be shown, so visibility, blocks, mutes, following/channel rules, and federation rules remain owned by Misskey. `POST /v1/rerank` then chooses the final ordering from the validated set.

Candidate generation targets roughly 60% rediscovery, 30% recently active conversations, and 10% exploration before Misskey policy filtering. The default rank score mixes chronological position, freshness, a rediscovery curve that peaks on slightly older Notes, engagement, active conversations, and a small deterministic time-bucketed jitter. Final ordering then adds bounded contextual sequencing: reply/renote edges are strongest, with mentions, shared tags, channels, temporal proximity, and original-page neighborhood providing softer affinity. At most two contextual follow-ups are favored by default before the algorithm re-anchors on standalone quality, while greedy author deboosting still applies throughout. Discovery currently runs only on the initial page. Misskey preserves the newest and oldest chronological Notes so ID-based pagination retains its boundary cursor, while the frontend's ID dedupe prevents a rediscovered Note from appearing twice when scrolling into its original chronological position.

## Environment

- `RECOMMENDATION_LISTEN_ADDR` defaults to `0.0.0.0:3080`.
- `RECOMMENDATION_INDEX_DB` defaults to `/data/recommendation.sqlite3`.
- `RECOMMENDATION_INDEX_MAX_ROWS` defaults to `100000`.
- `RECOMMENDATION_INDEX_REFRESH_LIMIT` defaults to `2000`.
- `RECOMMENDATION_ACTIVITY_REFRESH_LIMIT` defaults to `1000`.
- `RECOMMENDATION_INDEX_POLL_SECONDS` defaults to `5`.
- `RECOMMENDATION_ID_GENERATION_METHOD` defaults to `aidx` and must match Misskey's `id` setting when another ID format is used.
- Database connection uses `RECOMMENDATION_DB_*` first, then the existing `POSTGRES_*` / `DATABASE_*` variables used by the Docker setup.
- Ranking constants can be tuned with the `RECOMMENDATION_*_WEIGHT`, half-life, rediscovery, author-decay, and jitter-bucket variables defined in `src/ranker.rs`. Context sequencing specifically uses `RECOMMENDATION_CONTEXT_WEIGHT` (default `0.30`) and `RECOMMENDATION_CONTEXT_FOLLOWUP_LIMIT` (default `2`).

For a production deployment, a dedicated PostgreSQL role with read-only access to `note` is preferable even though the service never issues writes to PostgreSQL.

