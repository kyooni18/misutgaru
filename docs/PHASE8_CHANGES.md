# Phase 8 Vune migration

Phase 8 continues from the phase-7 source-only checkpoint and concentrates on reducing Vue renderer round-trips inside surfaces that were already partially Vune-owned.

## What moved

This pass adds 25 Vune source renderers and moves 26 real Vue placement paths onto them. The extra placement comes from the shared follow-state renderer used by both follower and following views.

The converted surfaces are:

- `MkNumber.vue`;
- `MkMediaBanner.vue`;
- `ui/_common_/stream-indicator.vue`;
- `components/form/split.vue`;
- `components/form/link.vue`;
- `MkPreviewWithControls.vue`;
- `MkKeyValue.vue`;
- `MkFukidashi.vue`;
- `components/global/MkTip.vue`;
- `MkUserCardMini.vue`;
- `WidgetActivity.calendar.vue`;
- `pages/chat/home.joiningRooms.vue`;
- `pages/explore.featured.vue`;
- `pages/user/index.timeline.vue`;
- `pages/user/notes.vue`;
- `pages/admin/overview.users.vue`;
- `pages/admin/overview.moderators.vue`;
- `pages/admin/overview.heatmap.vue`;
- `pages/admin/custom-emojis-manager.logs.vue`;
- `MkNotePreview.vue`;
- `MkNoteSimple.vue`;
- `MkUserSetupDialog.User.vue`;
- `pages/chat/home.vue`;
- `pages/user/followers.vue` and `pages/user/following.vue` through the shared `follow-state.vune` renderer;
- the presentation body of `MkRolePreview.vue`.

`MkNumber.vune` is a native SwiftUI-syntax Vune View. Vue retains the animated numeric state and motion lifecycle, while the actual number presentation is now rendered without Vue/raw-Element dependencies. This raises the native count from 29 to 30.

The other migrations deliberately keep lifecycle, API requests, paginator state, template refs, CW state, adaptive-background directives, or existing imperative behavior in their thin Vue shells. Vune owns the repeat/conditional/layout tree and existing Vue-only leaf components are embedded only where necessary.

`WidgetActivity.calendar` moves its SVG calendar rendering and data-driven cell generation into Vune. Its former Vue-scoped presentation rules are now in `widgets/vune/WidgetActivity.calendar.scss`, and the day cells use date-derived stable keys.

## Checkpoint

The phase-8 checkpoint contains:

- 179 Vune source components;
- 30 native Vune Views with no Vue/raw-Element dependency;
- 178 legacy Vue placement shells whose render trees are Vune-owned;
- 108 SwiftUI-syntax Vune files;
- 48 Vune sources using `ForEach`.

Compared with phase 7, this is +25 Vune sources, +1 native View, and +26 real Vue placement paths moved onto Vune renderers.

## Validation

- all 25 phase-8 Vune additions pass Vune diagnostics and compiler transformation;
- transformed TypeScript for all 25 additions parses successfully;
- all 179 Vune sources pass diagnostics/transformation when checked in bounded batches and, for the slow Material/server-metric tail, individually;
- all 591 frontend Vue SFCs parse successfully;
- all 26 changed Vue SFCs also pass script/template compilation with `@vue/compiler-sfc`;
- all 30 native Vune sources pass the native boundary check;
- 18 changed Vue SCSS blocks and the new calendar SCSS compile successfully with Dart Sass;
- the source delta is checked for accidental files, trailing whitespace, and packaging-only dependencies before delivery.

The source still pins Vune 0.1.18. The dependency tree available in this workspace is the previously supplied Vune 0.1.12/macOS-ARM-oriented tree and is used only as a conservative syntax-compatibility compiler. It is removed before packaging. A production bundle against exact Vune 0.1.18 still requires lockfile-matched native dependencies for the target build host.
