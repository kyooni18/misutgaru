# Misutgaru agent and contributor guide

Misutgaru is a Misskey fork with an in-progress Vue-to-Vune frontend migration and backend runtime optimization work. Do not treat it as a lightly themed upstream checkout.

Before editing code, read these in order:

1. `docs/CURRENT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SOURCE_MAP.md`
4. the topic document for the area being changed

The phase journals under `docs/archive` are history only. Their counts, dependency versions, and validation claims are stale by design.

## Current hazards

At the 2026-08-27 checkpoint:

- `.config/example.yml`, `.config/docker_example.yml`, `.config/playwright-devcontainer.yml`, and `.dockerignore` still contain merge conflict markers;
- the native Vune boundary check reports 20 violations across `MkEmojiPicker.vune`, `MkMenu.vune`, and `MkPostFormSurface.vune`;
- `packages/modules/Vune` and `packages/modules/o0o0o` are Git submodules and may be empty in extracted archives.

Do not claim the tree is fully clean or fully build-validated without resolving and rechecking these items.

## Fork-specific rules

- Files marked `@misutgaru-vune-native` must satisfy `scripts/check-vune-native.mjs`.
- `packages/frontend/src/vune/compat-vue.ts` is a migration boundary, not a new component model.
- Avoid adding new dependencies on `packages/frontend/src/vune/vue.ts` unless required for staged compatibility.
- Put low-level native Vune web semantics in `packages/frontend/src/vune/native.ts`.
- Use the shared motion and Material layers instead of adding per-component animation or blur engines.
- Preserve backend batching, cache-miss coalescing, Redis connection sharing, and buffered block I/O.
- Keep `singleProcessMode` compatible with split-role and clustered deployments.
- If source files move, regenerate the source inventory with `node scripts/generate-source-inventory.mjs`.

## Checks

```sh
pnpm vune:report
node scripts/check-vune-native.mjs packages/frontend/src
node scripts/check-spdx.mjs
```

For a fully populated checkout also run the relevant frontend/backend tests and `pnpm build`.