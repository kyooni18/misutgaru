# Current project state

Checkpoint date: 2026-09-10.

Misutgaru is a Misskey `2026.9.0` fork with a Vue 3 frontend, backend runtime optimizations, and fork-specific thread, translation, recommendation, and push behavior.

## Repository health

The source checkpoint is structurally clean. PostgreSQL compatibility is a hard same-version invariant: 426 vanilla-owned migration/schema sources plus the TypeORM entity registry and DataSource entity/migration configuration match vanilla `2026.9.0` at aggregate SHA-256 `e260f1f80d47e37e809dc0e57ac2b0e79387a2a0cee252609bc1ae3a81e9c4a7`. Misutgaru does not add its own PostgreSQL schema objects or migrations.


The frontend has been reverted to Vue-only operation. Active `.vune` sources and Vune host adapters were removed, Vune packages were removed from the frontend/root dependency graph, the Vite compiler integration and Vune-specific typecheck/build steps were removed, and `packages/modules/Vune` is no longer a repository submodule.

- no unresolved merge markers remain in the active tree;
- all three shipped example YAML configs parse;
- the frontend is checked by standard `vue-tsc`;
- the production frontend bundle is produced by the normal Vue/Vite path;
- repository integrity no longer requires or validates Vune artifacts.

The dependency-backed root `pnpm verify:full` remains the broad release gate. Because Misutgaru commonly carries in-progress fork work alongside an upstream sync, interpret that gate together with proportional per-change checks rather than as a vanilla byte-parity claim.

## Current source delta

The active vanilla compatibility baseline is the pinned Misskey `2026.9.0` release in `UPSTREAM_BASE.json`.

The regenerated source/config inventory contains 2881 rows in the local tree: 2427 byte-identical to the pinned upstream source, 284 modified, and 170 added. Removed upstream paths are not represented in the present-file inventory. See `docs/source-map/INVENTORY.md`; `docs/UPSTREAM_DELTA.md` remains the broader historical whole-tree report.

## Frontend checkpoint

The active UI is Vue 3 only. Components that had been replaced by Vune hosts were restored from the pinned Misskey `2026.9.0` Vue implementation where possible, while unrelated Misutgaru backend and product work was left intact. Vue support files removed during the migration were restored as required by current imports and routes.

The application no longer contains active Vune renderer/compiler integration, Vune-specific virtual-list primitives, Vune motion adapters, or Vune-only regression tests. Historical migration material remains under `docs/archive` and in older Vune documentation for reference only.

NIRAX routing remains attached to the Vue application lifecycle, and frontend type safety is again provided by the standard `vue-tsc --noEmit` path.

## Runtime improvements retained in this checkpoint

Backend entity lookups use a common request-scoped `BatchLoader`: note, note-draft, user, and drive-file single-ID pack paths coalesce duplicate in-flight work and combine distinct IDs into repository `IN (...)` batches. Settled values are memoized only inside the current API request, while process-long fallback loaders remain freshness-oriented. Redis-backed caches use mutation serialization, generation guards, and a process-wide invalidation bus on an isolated subscriber connection so local memory tiers cannot silently outlive writes made by another backend process. Initial invalidation subscription failures are boundedly retried with diagnostics rather than leaving cross-process invalidation permanently disabled.

Fork-specific translation contracts and thread-window defaults have started moving into `@misutgaru/core`, reducing direct fork logic embedded in upstream-shaped files.

## Verification performed in this workspace

- `pnpm --filter frontend typecheck`: passed with the Vue-only frontend;
- `pnpm --filter frontend build`: passed and produced the production frontend bundle;
- `pnpm --filter frontend test`: passed;
- `pnpm verify:integrity`: passed, scanning 6076 text files.

See `docs/VERIFICATION-2026-08-28.md` for the exact validation boundary.
