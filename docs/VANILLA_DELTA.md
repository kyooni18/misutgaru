# Delta from vanilla Misskey

Baseline: the supplied `misskey-develop` source at package version `2026.8.0-alpha.0`. Exact current path lists live in `docs/UPSTREAM_DELTA.md`; this document explains the architectural differences.

## Current whole-tree summary

| Classification | Count |
| --- | ---: |
| Byte-identical | 2643 |
| Modified | 492 |
| Added | 741 |
| Removed | 2 |

The added count is intentionally larger than the original fork snapshot because the handoff tree includes the checked-out Vune and o0o0o framework sources plus fork-owned tests/tooling instead of empty submodule directories.

## Frontend/framework changes

| Area | Misutgaru difference |
| --- | --- |
| Vune migration | hybrid Vue/Vune frontend with explicit native and compatibility boundaries |
| Compiler bridge | compiler-emitted legacy-host metadata and typed Vue-host generation |
| Web renderer | boundary-local State invalidation, parent-first dirty-boundary batching, compiled direct-patch paths |
| Native semantics | additional graph-first browser primitives and restricted raw-host escape paths |
| DevTools | opt-in Vune boundary render/dependency/node profiling in development builds |
| Motion/layout | o0o0o per-property ownership plus intrinsic layout FLIP on independent translate/scale channels |
| Material | reusable translucent tiers/accessibility fallbacks |
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
- Vue remains during staged migration;
- DeepL remains as a fallback path;
- split server/queue and clustered execution are still valid deployment modes.

Update this file together with `CURRENT_STATE.md` and `UPSTREAM_BASE.json` when the upstream base or one of these assumptions changes.
