# Current state

Checkpoint: 2026-08-27 source snapshot compared with the supplied vanilla `misskey-develop` tree.

## What Misutgaru currently is

Misutgaru still uses the Misskey federation and data-model foundation, but it is no longer a small theme fork. The current work concentrates in four areas:

- gradual Vue-to-Vune frontend migration;
- shared motion and Material rendering;
- backend runtime, Redis, cache, entity-packing, and block-I/O optimization;
- fork-specific thread-window, translation, image-translation, and Web Push behavior.

The compared package version remains `2026.8.0-alpha.0`.

## Frontend checkpoint

The examined tree contains roughly 592 Vue SFCs and 233 `.vune` files. The executable Vune report identified 67 native-marked Vune sources at this checkpoint.

The app is hybrid. Vue still owns much state, routing, lifecycle, and compatibility placement, while migrated UI is rendered through Vune hosts. Do not equate a `.vune` file with a fully Vue-independent subtree.

The package dependency in the supplied tree points to Vune 0.1.20 and o0o0o 0.2.2.

## Known failures and incomplete cleanup

Four files still contain merge conflict markers:

- `.config/example.yml`
- `.config/docker_example.yml`
- `.config/playwright-devcontainer.yml`
- `.dockerignore`

The three YAML examples fail normal YAML parsing until those markers are resolved.

`scripts/check-vune-native.mjs` currently reports 20 boundary violations across:

- `MkEmojiPicker.vune`
- `MkMenu.vune`
- `MkPostFormSurface.vune`

The supplied archive also has empty `packages/modules/Vune` and `packages/modules/o0o0o` directories because they are Git submodules. Initialize submodules in a normal checkout before treating frontend build failures as code regressions.

## Data model and federation

No new database migration was found in the compared fork snapshot. ActivityPub and Misskey model foundations remain upstream-derived. The fork mainly changes implementation behavior around rendering, runtime efficiency, and selected user-facing features.

## Validation rule

Never copy current counts from archived phase notes. Re-run the Vune report, native boundary check, SPDX check, and relevant test/build commands for the checkout being handed off.