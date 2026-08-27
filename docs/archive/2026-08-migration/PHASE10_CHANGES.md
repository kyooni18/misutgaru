# Phase 10 Vune migration

Phase 10 continues from the 209-source phase-9 checkpoint and changes the migration target from mostly low-state placement shells to Vue template state/event wiring itself. State, lifecycle, API calls, and imperative browser handles remain in Vue where exact Vune 0.1.18 state semantics cannot be production-tested in this workspace, while Vune now owns more of the model bindings, conditional render trees, and animation presentation.

## What moved

This pass adds 17 Vune renderers and moves 17 additional Vue placement paths onto them.

State/model-heavy settings and management UI moved in this pass:

- instance mute and word mute settings;
- plugin installation and theme management;
- notification delivery-scope configuration;
- webhook create and webhook edit forms;
- chat room search and chat room information/settings;
- API console;
- admin file search, abuse-report filtering, and email-server settings.

These shells keep their existing Vue refs, data loading, validation, and API calls. Their templates no longer rely on Vue `v-model`; Vune receives the current value and routes updates explicitly through `modelValue` / `onUpdate:modelValue` or the corresponding component event.

## Native and motion migration

Three additional components are native Vune Views in this pass:

- `MkMediaRange` now uses Vune `Binding`, `Slider`, `ProgressView`, and `ZStack`, forwarding value and drag-end events through the compatibility host;
- `MkToast` uses a native Vune layout and the shared `vuneMotion` adapter for enter/leave presentation;
- `MkFolderPage` uses a native Vune layout while its Vue shell retains the imperative close lifecycle and drives shared Vune motion.

`MkUrlPreviewPopup` also moves its visible render body to Vune and replaces its Vue `<Transition>` presentation with `vuneMotion` while keeping positional measurement in Vue.

This makes the phase-10 native count 33. The rough Vue-template inventory changes from phase 9 as follows:

- files containing `v-model`: 165 -> 151;
- files containing `<Transition>`: 52 -> 49;
- files containing `v-if`: 302 -> 293;
- files containing `v-for`: 143 -> 141.

The `ref=` file count changes from 179 to 182 because the motion conversions intentionally retain a few thin Vue DOM handles for measured/imperative animation boundaries rather than moving lifecycle state prematurely.

## Checkpoint

The phase-10 checkpoint contains:

- 226 Vune source components;
- 33 native Vune Views with no Vue/raw-Element dependency;
- 225 legacy Vue placement shells whose render trees are Vune-owned;
- 135 SwiftUI-syntax Vune files;
- 60 Vune sources using `ForEach`.

Compared with phase 9, this is +17 Vune sources, +17 Vune-owned placement paths, and +3 native Views.

## Validation

- all 17 phase-10 additions pass Vune diagnostics and compiler transformation;
- transformed TypeScript for all 17 additions parses successfully;
- all 17 changed Vue SFCs pass `compileScript` with filesystem type resolution and template compilation with `@vue/compiler-sfc`;
- all 591 frontend Vue SFCs parse successfully;
- all 226 Vune sources pass diagnostics/transformation when checked in bounded batches;
- all 33 native Vune sources pass the native boundary check;
- all four new phase-10 SCSS files compile successfully with Dart Sass.

The source still pins Vune 0.1.18. The dependency tree available for compatibility checks is the previously supplied Vune 0.1.12 tree, so it is used only as a conservative syntax/compiler check and is not included in the deliverable. In particular, local mutable state is not migrated to Vune `@State` solely on the basis of the older compiler: exact 0.1.18 production semantics should be validated with lockfile-matched dependencies before that boundary is moved further. A full production Vite bundle likewise still requires the matching native dependencies for the target build host.
