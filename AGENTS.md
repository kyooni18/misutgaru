# Misutgaru agent and contributor guide

Misutgaru is a Misskey fork with a large in-progress Vue-to-Vune frontend migration and backend runtime optimization work. Do not treat it as a lightly themed upstream checkout.

Before editing code, read:

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SOURCE_MAP.md`
4. the topic document for the area being changed

The phase journals under `docs/archive` are history only. Their Vune counts, dependency versions, and validation claims are stale by design.

## Current validation boundary

At the 2026-08-28 source checkpoint, active merge markers are resolved, the native Vune boundary passes for 65 files, and the delivered source archive contains the Vune/o0o0o module sources. The remaining handoff gate is dependency-backed: run `pnpm verify:full` in a normal networked checkout before describing a release as fully typechecked, test-complete, and production-build validated.

## Fork-specific rules

- A file marked `@misutgaru-vune-native` must satisfy `scripts/check-vune-native.mjs`. Do not hide Vue, raw `Element`, `.vue`, or legacy factory dependencies behind a native marker.
- `packages/frontend/src/vune/compat-vue.ts` is a placement boundary, not a new component model. Native Vune parents should import native children directly when possible.
- `packages/frontend/src/vune/vue.ts` is legacy migration debt. Avoid introducing new dependencies on it unless required to preserve behavior during a staged migration.
- Prefer Vune core/browser primitives for web semantics. Keep `packages/frontend/src/vune/native.ts` as a restricted last-mile bridge, not a generic tag factory.
- Compiler-emitted legacy-host metadata and `generateVueHostModule` share the Vune semantic model. Prefer `.vune?vue-host` for trivial zero-customization Vue placement shells; keep the explicit adapter for aliases or unusual initializer wiring. Do not add a second runtime-only prop/type mapping system in the Vue bridge.
- Keep Vune State invalidation boundary-local. Changes to the web renderer must preserve parent-first dirty-boundary batching and compiled direct-patch fast paths.
- Vune DevTools must remain opt-in and cheap while disabled.
- Use `packages/frontend/src/vune/motion.ts` for migrated animation and the shared Material layer for translucent surfaces instead of inventing per-component engines.
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
