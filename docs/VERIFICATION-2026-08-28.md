# Verification record

Date: 2026-08-28

## Passed in this artifact workspace

- PostgreSQL compatibility invariant: 426 vanilla-owned schema/migration sources plus the entity registry and DataSource entity/migration configuration matched the supplied same-version vanilla snapshot exactly. Aggregate fingerprint: `e260f1f80d47e37e809dc0e57ac2b0e79387a2a0cee252609bc1ae3a81e9c4a7`;
- repository integrity: passed after local Vune dependency, lockfile, Docker ordering, merge-marker and DB-invariant checks;
- `@vune-ui/animation` focused motion suite: 75 passed, 0 failed; the complete 116-test module suite is opt-in via `pnpm --dir packages/modules/Vune --filter @vune-ui/animation run test:full`;
- focused Vune compiler/web/runtime smoke suite: 31 passed, 0 failed; the complete non-browser package suite is opt-in via `pnpm --dir packages/modules/Vune run test:full`;
- native Vune boundary: 65 files passed;
- Vune compiler transform sweep: 233 frontend `.vune` files passed, 0 failed with the current local compiler;
- `@misutgaru/core` translation contract test: 1 passed, 0 failed;
- BatchLoader runtime harness: duplicate keys remain coalesced while a repository batch is in flight, request-scoped settled results are reused inside one API call, and the process-long fallback loader does not retain settled data;
- cache race harness: generation/mutation cases passed across KV and single-value caches;
- CacheInvalidationService harness: remote routing, dedicated subscriber isolation, bounded subscription retry and shutdown cancellation paths were exercised without attaching cache-control listeners to the shared Misskey stream subscriber;
- deterministic motion regression: 2048 elements x 60 frames = 122880 committed element states, with independent CSS property ownership preserved;
- changed TypeScript/Vue sources used in the latest batching, virtualization, diagnostics and paginator pass produced no syntax diagnostics from the locally available TypeScript parser;
- YAML parse check: 104 YAML files parsed successfully with PyYAML;
- Markdown link check: 323 local links checked after fenced-code exclusion, 0 missing targets;
- repository integrity after source cleanup: 3664 text files scanned successfully;
- source inventory and upstream delta are regenerated only after validation-only `node_modules`, `dist`, `built`, coverage and tool-session directories are removed.

## Dependency-backed tests wired but not locally executable

The root regression command includes the backend cache/loader/request-context/diagnostics/invalidation Vitest files and frontend cache/prepared-note/normalized-entity/variable-list/paginator Vitest files. The Playwright performance spec also includes a long, paginated timeline DOM-budget scenario.

This execution environment cannot reach the npm registry and the source inputs do not contain the complete root pnpm virtual store. A fresh root installation, full frontend/backend typecheck, complete Vitest tree, Playwright application suite and full production build therefore cannot be honestly claimed here.

In a normal networked checkout, run:

```sh
pnpm verify:full
```

Then run the production Docker build from a clean recursive-submodule checkout before release.
