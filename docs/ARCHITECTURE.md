# Misutgaru architecture

Misutgaru retains the Misskey protocol, database lineage, API surface, and package layout where practical. The fork concentrates its divergence in Vue UI behavior, runtime efficiency, and a small set of user-facing extensions.

## Frontend path

```text
Vue application and components
  -> NIRAX route/component binding
  -> Vue reactivity and composables
  -> Vue templates / CSS / browser DOM
```

The current frontend is Vue-only. Vune compiler plugins, renderer packages, host adapters, native Vune views, and Vune-specific motion/runtime layers are not part of the active application path.

NIRAX continues to provide route matching/navigation while the application root, route views, component lifecycle, and reactive state ownership remain in Vue.

## Timeline rendering path

Timeline surfaces use the standard Vue component tree and existing Misskey paginator/streaming abstractions. The Vune-backed variable-height virtualization path introduced during the migration has been removed from the active frontend so timeline behavior no longer depends on Vune measurement or renderer packages.

Detailed notes remain composed from reusable Vue note/content/action components. Thread and timeline behavior should be extended through existing Vue components and composables rather than a parallel renderer.

## Motion and layout

UI motion follows the Vue/CSS/browser behavior implemented by each active component. There is no shared Vune animation scheduler or Vune-owned property-ownership layer in the current frontend; new motion work should stay compatible with Vue component lifecycle and existing CSS/transition patterns.

## Fork package boundary

`packages/misutgaru-core` is the first dedicated fork package. It currently owns provider-neutral translation contracts/helpers and thread-window defaults. New fork behavior that does not need to live inside a Misskey implementation class should move here or into a future sibling package rather than increasing upstream-file diff size.

## Backend data path

```text
API / streaming / federation / queue
  -> shared Nest runtime graph
  -> services/entity packers
  -> request-scoped BatchLoader identity graph
  -> repository batches
  -> Redis + process-local cache
  -> CacheInvalidationService isolated pub/sub bus
```

Within an API request, `AsyncLocalStorage` gives the hot entity loaders one request-scoped `BatchLoader` instance. Note, draft, user, channel/poll and drive-file identity lookups can share this graph. The loader coalesces duplicate IDs even after a repository batch has started and memoizes settled values only until that request context is released. Process-long fallback loaders drop settled promises immediately, so request batching does not become a cross-request data cache.

PostgreSQL schema ownership stays entirely with vanilla Misskey. Misutgaru may change query scheduling, batching, Redis caching, and non-schema DataSource runtime options, but migrations, TypeORM entity schema sources, schema-shaping ID helpers, the entity registry, and DataSource schema options are fingerprinted against the matching vanilla source. See [DB_COMPATIBILITY.md](DB_COMPATIBILITY.md).

Redis cache writes are serialized per key. Each invalidation advances a generation, so an older Redis read cannot populate memory after a newer mutation. `CacheInvalidationService` publishes cache-name/key invalidations across backend processes after Redis becomes authoritative. It duplicates the existing subscriber connection instead of adding its channel to the shared Misskey stream subscriber, so unrelated stream listeners never see cache-control envelopes; remote cache listeners drop their memory tier and in-flight stale reads retry.

## Timeline recommendation boundary

Misutgaru can optionally expand and rerank the first page of Home, Hybrid, Local, and Global timelines through the standalone Rust service in `packages/recommendation`. The sidecar proposes rediscovery, active-conversation, and exploration Note IDs, but each endpoint re-runs those IDs through its existing Misskey SQL scope and visibility/mute/block rules before packing. Misskey therefore remains authoritative for authorization and timeline semantics even though candidate generation is no longer limited to the original page.

The recommendation service maintains a disposable SQLite feature index populated by read-only polling of Misskey PostgreSQL. The index contains Note IDs, author IDs, creation/activity timestamps, aggregate reaction/reply/renote counts, and coarse media/reply/renote/local flags; Note text and user profile data are not copied. Recent reply/renote Notes and reaction IDs advance `last_activity_at` for their target Note so older conversations can re-enter the candidate pool. Candidate generation uses rediscovery, activity and exploration quotas plus author diversity; the final heuristic ranker mixes chronology, freshness, rediscovery, engagement, conversation activity, deterministic jitter, and another diversity pass. The original newest and oldest page Notes remain boundary anchors so the existing ID cursor continues to advance chronologically.

Calls are fail-open with a short timeout. If the recommendation container is unavailable, malformed, or disabled, the backend returns the original chronological page unchanged. The SQLite index may therefore be deleted and rebuilt without affecting canonical Misskey data or availability.

## Runtime and I/O

The existing Misutgaru runtime work remains in place: optional combined HTTP/queue Nest ownership, shared Redis/BullMQ connections where semantics permit it, CPU-aware concurrency defaults, cache-miss coalescing, batched entity packing, buffered/vector file writes, common block sizes, and demand-driven runtime statistics.

## Browser performance guard

`packages/frontend/test/e2e/performance.spec.ts` records DOM size, Long Task observations when supported, and navigation duration for an authenticated home flow. The thresholds are deliberately broad runaway guards rather than hardware-sensitive performance scores. Normal e2e execution includes the test; `pnpm --filter frontend test:e2e:performance` runs it directly.
