# Experimental Misutgaru recommendation service

This is a small, fail-open candidate-generation and reranking service for Misskey timelines. It does not own Note data and it does not change the Misskey PostgreSQL schema.

The background indexer reads Note IDs and ranking features from PostgreSQL and stores only derived metadata in a local SQLite database. It also derives recent activity from replies, renotes, and reactions. `POST /v1/candidates` proposes rediscovery, active-conversation, and exploration IDs from that index. Misskey re-queries every proposed ID through the original timeline SQL scope before it can be shown, so visibility, blocks, mutes, following/channel rules, and federation rules remain owned by Misskey. `POST /v1/rerank` then chooses the final ordering from the validated set.

Candidate generation targets roughly 60% rediscovery, 30% recently active conversations, and 10% exploration before Misskey policy filtering. The default rank score mixes chronological position, freshness, a rediscovery curve that peaks on slightly older Notes, engagement, active conversations, and a small deterministic time-bucketed jitter. Final ordering then adds bounded contextual sequencing: reply/renote edges are strongest, with mentions, shared tags, channels, temporal proximity, and original-page neighborhood providing softer affinity. At most two contextual follow-ups are favored by default before the algorithm re-anchors on standalone quality, while greedy author deboosting still applies throughout. Discovery currently runs only on the initial page. Misskey preserves the newest and oldest chronological Notes so ID-based pagination retains its boundary cursor, while the frontend's ID dedupe prevents a rediscovered Note from appearing twice when scrolling into its original chronological position.

## Explicit opt-in

This feature is experimental and disabled by default. Normal Docker Compose startup
neither starts the sidecar nor indexes PostgreSQL. Configuring a service URL alone
never enables recommendations. Enabling them changes Home, Hybrid, Local, and Global
timelines server-wide; there is currently no per-user opt-in control.

To explicitly opt in with Docker Compose (after configuring `.config/docker.env`):

```sh
MISUTGARU_RECOMMENDATION_ENABLED=true docker compose --profile experimental-recommendation up -d
```

Both steps are intentional: the profile starts the experimental indexer, while the
flag enables backend calls. Keep the flag set for subsequent Compose recreations.
For non-Docker deployments, start the sidecar separately and set
`MISUTGARU_RECOMMENDATION_ENABLED=true` and `MISUTGARU_RECOMMENDATION_URL`, or set
`recommendation.enabled: true` and `recommendation.url` in the server YAML config.
YAML settings take precedence over environment variables. Restart the backend after
changing them. Explicit `false` disables recommendations even when a URL is present.

To opt out, remove the enable flag (or set it to `false`), ensure YAML does not
explicitly enable it, recreate/restart the web service, and stop the indexer:

```sh
docker compose up -d web
docker compose --profile experimental-recommendation stop recommendation
```

Stopping only the backend integration does not stop an already-running indexer.
Its disposable `recommendation_data` volume can be removed separately if desired.
When disabled, timelines remain chronological and the backend makes no sidecar calls.

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

