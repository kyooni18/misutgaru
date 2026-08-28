# Runtime optimization

Misutgaru optimizes runtime ownership and hot data paths without changing the Misskey persistence model.

## Process graph

`RuntimeModule` can host normal server and queue responsibilities in one Nest graph when `singleProcessMode` is enabled. Explicit split-role/cluster deployments remain supported.

## Redis-backed cache correctness

`RedisKVCache` and `RedisSingleCache` combine four protections:

1. concurrent misses for one key share an in-flight fetch;
2. explicit writes are serialized so later writes remain authoritative;
3. a generation counter invalidates already-started Redis reads and fills;
4. `CacheInvalidationService` propagates key invalidation across backend processes through a dedicated Redis pub/sub channel on an isolated duplicate subscriber connection.

An explicit mutation drops the previous process-local memory snapshot before waiting on Redis. A remote invalidation that lands while a local write is awaiting advances the generation, preventing that write from resurrecting an already-invalidated memory value after it resumes.

The pub/sub event carries only cache identity and key, not the cached value. After invalidation, the receiving process reloads from the authoritative Redis tier.

## BatchLoader and entity packing

`packages/backend/src/misc/loader.ts` now includes `BatchLoader<K,V>`. Distinct keys requested before a flush share one batch, duplicate keys share the same Promise even while the repository query is already in flight, and request-scoped instances can memoize settled results for the lifetime of one API call. Process-long fallback loaders deliberately drop settled values so they do not become a stale application cache.

`ApiCallService` establishes an `AsyncLocalStorage` request batch context. `NoteEntityService`, `NoteDraftEntityService`, `UserEntityService`, and `DriveFileEntityService` use request-scoped loaders to collapse concurrent ID lookups into TypeORM `find`/`findBy` calls with `In(...)`. Existing pack-many paths remain responsible for larger users/files/reactions/channels/roles graphs. Batch size and duration are exposed through process-local runtime diagnostics.

## Redis/BullMQ and HTTP ownership

Producer/worker connections are shared where library semantics allow it; subscription roles remain isolated where required. HTTP pool/concurrency defaults remain CPU-aware while explicit config values win.

## Block I/O

The shared block-I/O policy and buffered/vector writers remain the preferred path for sequential exports and hashing/image workloads. Avoid replacing them with repeated tiny writes in hot paths.

## Regression philosophy

CI should gate deterministic behavior such as query/fetch counts, cache ownership, property ownership, and committed work rather than noisy wall-clock timings. `scripts/benchmark-regressions.mjs` follows that rule for the motion/DOM path and reports time only for observation.


## Runtime diagnostics

The admin runtime diagnostics endpoint is process-local and does not create persistence. It records bounded counters/distributions/traces for API latency, BatchLoader behavior, Redis cache tiers, stale retries and cache invalidation subscription health. Event-loop delay sampling starts lazily when diagnostics are first requested, then reports p50/p95/p99/max without imposing the histogram cost on processes that never use the page.

The diagnostics frontend keeps the last good snapshot when a refresh fails and surfaces the refresh error instead of leaking an unhandled timer rejection.
