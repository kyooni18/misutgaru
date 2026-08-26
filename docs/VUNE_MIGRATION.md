# Vune migration

The frontend uses the first-party Vune toolchain directly:

- `@vune-ui/vite` runs before the Vue plugin and scans `*.vune` files.
- `@vune-ui/compiler` diagnoses and transforms SwiftUI-style Vune sources.
- `@vune-ui/vue` owns rendering at the temporary Vue/Vune boundary.
- `packages/frontend/src/vune/vue.ts` is the narrow compatibility layer for Vune roots, legacy Vue leaf components, and Vue-owned slots.
- `scripts/check-vune.mjs` validates both diagnostics and compiler transformation.
- `scripts/check-vune-native.mjs` prevents native Vune Views from silently gaining Vue, raw-Element, or `.vue` dependencies.

Author new Vune UI with compiler syntax where practical, and keep explicit Vue fallbacks only at migration boundaries.

## Current checkpoint

Run:

```sh
pnpm vune:check
pnpm vune:report
```

The phase-10 checkpoint contains:

- 226 Vune source components;
- 41 native Vune components with no Vue/raw-Element dependency;
- 225 legacy Vue placement shells whose render trees are now Vune-owned;
- 135 SwiftUI-syntax Vune files;
- 60 Vune sources using `ForEach`.

The converted surface now includes shared presentation primitives, form/search helpers, status/notification surfaces, page blocks, deck columns, widgets, user files/activity/achievements/lists/reactions, chat home views, preview cards, admin shells, welcome routing, and other low-state page shells. Phase 6 moved loading/source-code/donation prompts, several widgets and cards, title/Zen/deck shells, file-picker rows, and tutorial surfaces. Phase 7 extended ownership through emoji/invite/welcome, note media, administration, extension/image-effect UI, federation widgets, and the server-metric presentation stack. Phase 8 pushed Vune further into shared leaf UI, note/user/admin lists, chat/timeline shells, and follower/following state. Phase 9 added another 30 placement paths, including `MkTime`, digital clock rendering, the minimum UI shell, antenna/relay/account/list/notification/registry/search/clip/explore surfaces, auth/QR/theme-install flows, drag-folder and paging UI, mini-chart/theme SVGs, passkey/TOTP presentation, code blocks, reaction effects, and the drive-thumbnail render body. Phase 10 begins removing Vue template state wiring itself: settings/admin/chat forms now route model updates through Vune renderers, while `MkMediaRange`, `MkToast`, and `MkFolderPage` are native Vune Views. `MkToast`, `MkFolderPage`, and `MkUrlPreviewPopup` also replace Vue `<Transition>` presentation with the shared Vune motion adapter. The latest leaf pass converts chart legend, Drive folder, Google search, media banner, mini-chart, plus-one effect, role preview body, and theme preview to native Vune Views; SVG and anchor semantics use the centralized `src/vune/native.ts` helper.

Migration rules:

1. New or replaced UI lives in a nearby `vune/` directory as `*.vune`.
2. Prefer Vune primitives and modifiers for renderable structure.
3. Keep state, lifecycle, imperative focus, and existing data loaders in the Vue shell when moving them would change behavior.
4. Use `VueComponent(...)` only for a child that is still Vue-only or relies on Vue-specific behavior.
5. Use `VueSlot(...)` only where the legacy caller still owns the slot.
6. Keep the old `.vue` path as a small compatibility shell until callers have migrated.
7. Transition/Teleport/directive/focus-heavy views move last unless Vune has an equivalent with matching semantics.
8. Do not count a file as migrated merely because Vune wraps the whole Vue template; Vune should own the surrounding layout/repetition/conditional tree.

## Motion and Material

`packages/frontend/src/vune/motion.ts` is the application adapter for Vune's shared `o0o0o` animation engine. Numeric, spring, color, and transform values use the same scheduler/interpolator as the updated `@vune-ui/web` renderer; unsupported keyframe shapes retain a browser Web Animations API fallback. The adapter preserves cubic-bezier curves, repeat, autoreverse, cancellation, reduced-motion behavior, and callback isolation for existing Vue consumers. `MkNumber` now uses this shared clock instead of maintaining a component-local animation frame loop.

`packages/frontend/src/vune/material.ts` and `MaterialSurface.vune` provide reusable translucent surfaces. Material tiers are `ultraThin`, `thin`, `regular`, `thick`, `ultraThick`, and `bar`. The stylesheet includes backdrop blur/saturation, an opaque fallback when backdrop filtering is unavailable, reduced-transparency handling, and increased-contrast handling. Notifications and the hashtag compose/footer surface are real Material consumers rather than one-off blur CSS.

## Validation

All 17 phase-10 Vune additions pass diagnostics and compiler transformation with the available compatibility compiler, and their transformed TypeScript parses successfully. All 17 changed Vue SFCs pass script and template compilation with `@vue/compiler-sfc`; all 591 frontend Vue SFCs parse successfully; all 226 Vune sources pass diagnostics/transformation when checked in bounded batches; and all 41 native Vune sources pass the native boundary check. The four new phase-10 SCSS files also compile successfully with Dart Sass. Compared with phase 9, the rough Vue-template inventory drops from 165 to 151 files containing `v-model` and from 52 to 49 files containing `<Transition>`.

The source pins Vune 0.1.19 and its `o0o0o` 0.2.1 animation runtime. A full production bundle against the exact 0.1.19 lockfile still requires the matching native dependencies for the build host.
