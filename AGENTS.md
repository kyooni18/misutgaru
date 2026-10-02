# Misutgaru agent and contributor guide

Misutgaru is a Misskey fork with a Vue 3 frontend and substantial backend/runtime optimization work. Do not treat it as a lightly themed upstream checkout.

Before editing code, read:

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SOURCE_MAP.md`
4. the topic document for the area being changed

The phase journals under `docs/archive` are history only. Their Vune counts, dependency versions, and validation claims are stale by design.

## Current validation boundary

The active frontend is Vue-only. Vune sources, packages, compiler integration, host adapters, and the `packages/modules/Vune` submodule are not part of the current build. Frontend changes should pass `pnpm --filter frontend typecheck` and `pnpm --filter frontend build`; repository-wide structural changes should also pass `pnpm verify:integrity`.

## Fork-specific rules

- Keep the active frontend on Vue 3. Do not introduce `.vune` sources, `vune-ui`, `@vune-ui/*`, Vune host adapters, or Vune-specific build steps.
- Prefer upstream-shaped Vue components and Vue composables when restoring or extending UI behavior, and isolate fork-only contracts/helpers in `packages/misutgaru-core` when practical.
- Keep NIRAX routing and component lifecycle integration compatible with the Vue application root.
- Treat documents under `docs/archive` and Vune-specific migration notes as historical references, not current implementation requirements.
- Preserve batching in backend entity packing, `BatchLoader`, cache misses, Redis connections, and block I/O. A simpler-looking change that restores per-item DB queries, per-queue Redis clients, or per-fragment file writes is a performance regression.
- Redis cache mutations must keep generation guards and cross-process invalidation. Do not populate process-local memory from a read/write that lost an invalidation race.
- Put provider-neutral fork contracts/helpers in `packages/misutgaru-core` instead of increasing upstream-file diff when practical.
- Keep `singleProcessMode` compatible with explicit split-role and clustered deployments.
- If source files are added, moved, or deleted, regenerate `docs/source-map/INVENTORY.md` with `node scripts/generate-source-inventory.mjs`. When an upstream checkout is available, use `--upstream`.

## Upstream Misskey safety rules

- New AGPL-governed `.ts`, `.js`, `.cjs`, `.mjs`, `.vue`, `.scss`, and `.html` files need the appropriate SPDX header. Run `node scripts/check-spdx.mjs`.
- Do not manually edit locale YAML files other than `locales/ja-JP.yml`; translated locale files are managed through the upstream localization workflow.
- Do not edit a migration that has already been merged and applied. Add a new timestamped migration with both `up()` and `down()` when the schema must change.
- Do not commit secrets, production config values, API tokens, VAPID private keys, or OpenAI API keys.
- Do not force-push shared primary branches or bypass repository hooks to make a change appear clean.

## Checks before handing off a change

Use the narrowest checks that cover the change, then broaden when dependencies are available.

```sh
pnpm vune:report
node scripts/check-vune-native.mjs packages/frontend/src
node scripts/check-spdx.mjs
```

For a normal fully populated checkout, prefer the repository gate:

```sh
pnpm verify:full
```

Backend API response/type changes also require `pnpm build-misskey-js-with-types`. Schema changes require the backend migration checks.

Do not update current-state numbers by hand from an archived phase note. Re-run the executable report and update `docs/CURRENT_STATE.md` from the result.
