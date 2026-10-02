# Delta from vanilla Misskey

Baseline: pinned vanilla Misskey `2026.9.0` from `UPSTREAM_BASE.json`. The generated present-file comparison lives in `docs/source-map/INVENTORY.md`; `docs/UPSTREAM_DELTA.md` is retained as a broader historical whole-tree report.

## Current source inventory summary

| Classification | Count |
| --- | ---: |
| Byte-identical | 2427 |
| Modified | 284 |
| Added | 170 |

The current inventory contains 2881 source/config rows. The fork adds its own runtime, recommendation, translation, thread-window, push, testing, and maintenance code while keeping the active browser UI on Vue 3.

## Frontend/framework changes

| Area | Misutgaru difference |
| --- | --- |
| UI framework | Vue 3 only; the former Vune migration/runtime/compiler path has been removed from the active tree |
| Routing | NIRAX remains integrated with Vue route/component lifecycle |
| Thread window | resizable in-app detailed note thread flow |
| Translation UI | main translation plus bounded per-image translation/description results |
| Web Push | VAPID rotation, subscription-change recovery and multi-account synchronization |
| Browser regression | authenticated Playwright runaway-performance guard |

## Backend changes

| Area | Misutgaru difference |
| --- | --- |
| Runtime ownership | normal HTTP and queue roles can share one Nest graph while split/cluster modes remain supported |
| Redis/BullMQ | compatible connections are reused instead of multiplied per service/queue |
| Cache | miss coalescing, serialized mutations, generation guards and cross-process invalidation bus |
| Entity loading | common same-turn `BatchLoader`; note/draft IDs collapse into repository `IN (...)` batches |
| Entity packing | larger pack-many paths batch nested users/files/reactions/channels/roles |
| Block I/O | shared block sizing, buffered text output and vector writes |
| Statistics | expensive runtime sampling is reduced when nobody consumes it |
| Translation transport | OpenAI-compatible multimodal translation with bounded context/images and DeepL fallback |
| Push delivery | additional expiry/registration lifecycle handling and regression coverage |

## Fork-owned package boundary

`packages/misutgaru-core` begins moving provider-neutral/fork-only contracts out of upstream-shaped Misskey implementation files. It currently owns translation request/result helpers and thread-window defaults. This is deliberately incremental; the goal is smaller upstream conflicts, not a second application framework.

## Data model and protocol assumptions retained

- package/version lineage remains the compared Misskey release line;
- PostgreSQL migrations and schema-shaping TypeORM sources are required to remain byte-identical to the matching vanilla Misskey release;
- the TypeORM entity registry and DataSource schema options are separately fingerprinted, so a fork-only entity cannot silently enter the schema without changing an entity file;
- Misutgaru-only persistence must use existing vanilla data, Redis, process/client memory, config, or an external service rather than a new PostgreSQL table, column, enum, constraint, or index;
- ActivityPub and public API foundations remain Misskey-derived;
- Vue 3 is the active frontend framework;
- DeepL remains as a fallback path;
- split server/queue and clustered execution are still valid deployment modes.

Update this file together with `CURRENT_STATE.md` and `UPSTREAM_BASE.json` when the upstream base or one of these assumptions changes.
