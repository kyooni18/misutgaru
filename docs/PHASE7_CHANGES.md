# Phase 7 Vune migration

Phase 7 continues from the phase-6 source-only checkpoint without replacing the incoming Vune 0.1.18 toolchain or its motion/material work.

## What moved

This pass adds 26 Vune source renderers and leaves Vue only where state, lifecycle, template refs, streaming subscriptions, or existing imperative APIs still need it:

- `pages/emojis.emoji.vue`;
- `MkTutorialDialog.Note.vue`;
- `MkSortOrderEditor.vue`;
- `MkNoteMediaGrid.vue`;
- `pages/invite.vue`;
- `pages/welcome.entrance.classic.vue`;
- `widgets/server-metric/index.vue`;
- `WidgetOnlineUsers.vue`;
- `MkExtensionInstaller.vue`;
- `MkImageEffectorDialog.Layer.vue`;
- `MkChannelFollowButton.vue`;
- `MkGoogle.vue`;
- `MkReactionsViewer.details.vue`;
- `admin/custom-emojis-manager.local.list.vue`;
- `admin/server-rules.vue`;
- `WidgetTrends.vue`;
- `WidgetFederation.vue`;
- `MkInviteCode.vue`;
- `WidgetActivity.vue`;
- `WidgetUserList.vue`;
- `server-metric/pie.vue`;
- `server-metric/cpu.vue`;
- `server-metric/mem.vue`;
- `server-metric/disk.vue`;
- `server-metric/cpu-mem.vue`;
- `server-metric/net.vue`.

`MkChannelFollowButton.vune` is a native SwiftUI-syntax Vune View. Its network mutation state remains in the Vue shell, while the button, progress state, icon and label are Vune-owned. This raises the native count by one.

`MkSwitch.button.vue` now also places the already-existing native `MkSwitchButton.vune` on the real UI path instead of keeping the legacy Vue renderer. Its compatibility host preserves Vue-style boolean coercion, including the string value `"false"`.

The server-metric migration is intentionally end-to-end: the Vune-owned metric container no longer falls back to Vue templates for CPU, memory, disk, network, combined CPU/memory graphs, or the pie indicator. Streaming subscriptions and rolling sample calculations remain in their thin Vue lifecycle shells. SVG attributes are passed through Vune's `.withProps(...)` path so the renderers remain compatible with the conservative compiler used for validation.

## Checkpoint

The phase-7 checkpoint contains:

- 154 Vune source components;
- 29 native Vune Views with no Vue/raw-Element dependency;
- 152 legacy Vue placement shells whose render trees are Vune-owned;
- 103 SwiftUI-syntax Vune files;
- 44 Vune sources using `ForEach`.

Compared with phase 6, this is +26 Vune sources, +1 native View, and +27 real Vue placement paths switched to Vune (the 26 new renderers plus the existing native switch implementation).

## Validation

- all 26 phase-7 Vune additions pass Vune diagnostics and compiler transformation;
- transformed TypeScript for all 26 additions parses successfully;
- all 154 Vune sources pass diagnostics/transformation when checked in bounded batches;
- all 591 frontend Vue SFCs parse successfully with `@vue/compiler-sfc`;
- all 29 native Vune sources pass the native boundary check;
- changed SCSS is compiled separately with Dart Sass;
- the source delta is checked for whitespace errors and accidental files before packaging.

The source pins Vune 0.1.18. The dependency tree available in this workspace is the previously supplied Vune 0.1.12 / macOS-ARM-oriented tree, so it is used only as a conservative syntax-compatibility compiler. It is not copied into the deliverable. A production bundle against exact Vune 0.1.18 still requires lockfile-matched dependencies for the target build platform.
