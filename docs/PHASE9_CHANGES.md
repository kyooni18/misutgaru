# Phase 9 Vune migration

Phase 9 continues from the phase-8 source-only checkpoint and moves another set of high-frequency shared leaves and low-state pages onto Vune while retaining Vue only for lifecycle, directives, async state, and imperative browser behavior.

## What moved

This pass adds 30 Vune renderers and moves 30 additional Vue placement paths onto them.

Shared and frequently reused UI moved in this pass:

- `components/global/MkTime.vue`;
- `widgets/WidgetDigitalClock.vue`;
- `ui/minimum.vue`, using Misskey's custom global `RouterView` rather than vue-router's stock view;
- `settings/avatar-decoration.decoration.vue`;
- `MkDrive.navFolder.vue`;
- `MkMiniChart.vue`;
- `MkThemePreview.vue`;
- `MkPagingButtons.vue`;
- `MkSignin.passkey.vue` and `MkSignin.totp.vue`;
- `MkCode.vue`;
- `MkReactionEffect.vue` and `MkPlusOneEffect.vue`;
- the render body of `MkDriveFileThumbnail.vue` while its `v-panel` root remains in Vue.

Low-state page and management surfaces moved in this pass:

- antenna edit and antenna list pages;
- admin relay management;
- QR read/show shell;
- auth permission form;
- account management;
- user-list management;
- notifications tabs;
- registry scope listing;
- ActivityPub lookup result shell;
- note/user search shell;
- clip management tabs;
- explore tabs;
- federation queue controls;
- theme installer;
- custom-emoji browser/search surface.

The migration deliberately keeps state and behavior where it already works well. Time calculations, widget configuration, WebAuthn, TOTP state, drag/drop mutation, theme compilation, API calls, Vue directives such as `v-panel`, and CSS-module animation state remain in thin Vue shells. Vune now owns the corresponding DOM/SVG, conditions, repetition, buttons, and child placement.

The mini-chart and theme-preview SVGs use Vune's `withProps(...)` path for SVG-only attributes, matching the already validated server-metric migration approach. The reaction and +1 effects pass the randomized rotation directly into the Vune-rendered inline transform so their animation does not depend on Vue CSS-variable propagation across the renderer boundary.

## Checkpoint

The phase-9 checkpoint contains:

- 209 Vune source components;
- 30 native Vune Views with no Vue/raw-Element dependency;
- 208 legacy Vue placement shells whose render trees are Vune-owned;
- 121 SwiftUI-syntax Vune files;
- 57 Vune sources using `ForEach`.

Compared with phase 8, this is +30 Vune sources and +30 real Vue placement paths. Native count remains 30 because this pass prioritizes high-frequency render ownership while retaining existing Vue lifecycle/state behavior.

## Validation

- all 30 phase-9 Vune additions pass Vune diagnostics and compiler transformation;
- transformed TypeScript for all 30 additions parses successfully;
- all 30 changed Vue SFCs pass `compileScript` with filesystem type resolution and template compilation with `@vue/compiler-sfc`;
- all 591 frontend Vue SFCs parse successfully;
- all 30 native Vune sources pass the native boundary check;
- the phase-8 179-source checkpoint remains unchanged outside the explicitly migrated placement files; phase-9 additions are validated independently against the available compatibility compiler;
- source-delta review caught and fixed the `minimum.vue` RouterView distinction so Vune continues to use Misskey's custom global RouterView implementation.

The source still pins Vune 0.1.18. The workspace dependency tree available for compatibility checks is the previously supplied Vune 0.1.12/macOS-ARM-oriented tree, so it is used only for conservative syntax/compiler validation and is not included in the deliverable. A production Vite bundle against exact Vune 0.1.18 still requires lockfile-matched native dependencies for the target build host.
