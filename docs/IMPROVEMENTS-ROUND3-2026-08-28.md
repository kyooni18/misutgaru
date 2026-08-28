# Misutgaru round 3 improvement pass

Date: 2026-08-28

This pass keeps PostgreSQL byte/schema compatibility with the matching vanilla Misskey version as a hard invariant while moving more runtime work out of hot rendering and query paths.

## PostgreSQL invariant

The DB gate fingerprints the full vanilla migration tree, top-level entity models, schema-shaping model utilities, every backend TypeScript source containing TypeORM schema decorators, the exported entity registry, and DataSource entity/migration configuration. The current pinned manifest contains 426 files and is also compared against the supplied same-version vanilla source.

The scheduled upstream workflow now separates two concerns: the pinned same-version DB invariant always runs, while a direct live-upstream DB equality check runs only when live `develop` has the same package version. This avoids false failures when vanilla legitimately advances its schema in a later version.

## Timeline and note rendering

Timeline virtualization now uses stable Note IDs plus a variable-height prefix index. ResizeObserver measurements are preserved across prepend/reorder, delayed observer delivery resolves through the stable key rather than an obsolete numeric index, gaps are included in spacer math, and height changes above the viewport adjust the anchor without jumping. At the absolute feed start, prepend anchoring is intentionally disabled so a new Note remains visible.

Streaming timelines retain a larger bounded identity window while mounting only viewport-adjacent rows once the virtualization threshold is crossed. Prepared Note text caches MFM AST and extracted URLs, supports Worker prefetch, and is explicitly evicted on note deletion. The normalized entity cache reuses Note/User/DriveFile identities and preserves a DriveFile array when its canonical contents have not changed.

## Request-scoped backend batching

`BatchLoader` now keeps duplicate requests coalesced while a repository batch is already in flight. An AsyncLocalStorage request context may retain settled loader Promises for one API call, while fallback singleton loaders discard settled values. Note, draft, user and drive-file single-ID pack paths consume these loaders; existing pack-many methods still handle larger explicit graphs.

## Cache resilience and diagnostics

Redis cache invalidation remains isolated from the shared Misskey stream subscriber. Initial subscription failures are recorded and retried with bounded exponential backoff on the same dedicated subscriber, with retry timers cancelled during shutdown.

Runtime diagnostics remain process-local. Event-loop delay histograms are enabled lazily when diagnostics are viewed, API/cache/batch metrics stay bounded, and the admin page retains the last valid snapshot while surfacing refresh failures instead of allowing interval-triggered unhandled rejections.

## Vune runtime

The current Vune pass keeps generated typed Vue hosts, boundary-local dependency invalidation, compiler static specializations, transition/presentation coordination, DevTools inspection and local module resolution from previous work. Variable list measurement and presentation lifecycle behavior are exercised as deterministic framework regression paths. Compiler hot-update invalidation remains module-scoped; this pass does not claim state-preserving component HMR.

## Validation boundary

The source workspace can run DB fingerprints, repository integrity, o0o0o Node tests, local Vune compiler/web checks, Vune source transforms and parser-level checks without registry access. A fresh dependency-backed `pnpm verify:full`, full Vitest tree and production application build still require a normal networked checkout.
