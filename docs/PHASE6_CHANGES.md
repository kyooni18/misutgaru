# Phase 6 source delta and Vune migration

## Incoming source delta

The incoming source was already ahead of the previous phase-4 checkpoint. Its phase-5 baseline contains 108 Vune sources and 27 native Vune views, and pins the Vune packages to 0.1.18.

Notable additions already present in the incoming source include:

- a shared `o0o0o` 0.2.0-backed motion adapter in `packages/frontend/src/vune/motion.ts`;
- SwiftUI-style material descriptors and `MaterialSurface.vune`, including reduced-transparency and increased-contrast fallbacks;
- wider Vune migration across deck, widgets, user, chat, settings, admin and preview surfaces;
- normal-runtime optimization with shared application resources, bounded caches, lazy statistics/system-information work and graceful shutdown;
- shared block-I/O policy (128 KiB sequential reads, 256 KiB sequential writes, 512 KiB hash/image inspection), buffered vector writes and removal of synchronous filesystem calls from hot Drive/storage/export paths.

## Phase 6 Vune migration

This pass adds 20 Vune renderers and moves their Vue files to thin state/lifecycle compatibility shells where state still belongs to Vue:

- `pages/_loading_.vue` -> native `pages/vune/_loading_.vune`;
- `MkSourceCodeAvailablePopup.vue`;
- `MkDonation.vue`;
- `WidgetInstanceInfo.vue`;
- `WidgetProfile.vue`;
- `WidgetNotifications.vue`;
- `WidgetAiscript.vue`;
- `MkUserSetupDialog.Follow.vue`;
- `MkTutorialDialog.PostNote.vue`;
- `MkClipPreview.vue`;
- `signup-complete.vue`;
- `ui/_common_/titlebar.vue`;
- `ui/zen.vue`;
- `MkUserInfo.vue`;
- `MkInstanceCardMini.vue`;
- `MkAvatars.vue`;
- `MkChartLegend.vue`;
- `ui/deck/widgets-column.vue`;
- `MkForm.file.vue`;
- `MkTutorialDialog.Sensitive.vue`.

The phase-6 checkpoint is 128 Vune sources, 28 native Vune views and 125 legacy Vue placement shells. State, data loading and imperative behavior were deliberately left in Vue for components such as charts, file selection, widget configuration and tutorial state; Vune owns their render tree, repetition, conditionals and presentation.

## Validation

- all 20 phase-6 Vune sources pass diagnostics and transformation using the available compatibility compiler;
- transformed TypeScript for all 20 additions parses successfully;
- all 591 frontend Vue SFCs parse successfully with `@vue/compiler-sfc`;
- all 28 native Vune sources pass the native boundary check;
- `phase6-migration.scss` compiles successfully with Dart Sass.

The incoming source pins Vune 0.1.18, but the previously supplied dependency tree available to this workspace contains Vune 0.1.12 and Darwin ARM native esbuild/Rollup binaries. That tree is used only for conservative syntax compatibility checks and is not included in the source deliverable. Exact 0.1.18 production-bundle validation requires installing the lockfile-matched dependencies for the target build platform.
