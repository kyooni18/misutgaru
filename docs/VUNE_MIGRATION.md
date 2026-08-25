# Vune migration

The frontend uses the first-party Vune toolchain directly:

- `@vune-ui/vite` runs before the Vue plugin and only scans `*.vune.*` files.
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

The phase-5 checkpoint contains:

- 108 Vune source components;
- 27 native Vune components with no Vue/raw-Element dependency;
- 105 legacy Vue placement shells whose render trees are now Vune-owned;
- 88 SwiftUI-syntax Vune files;
- 31 Vune sources using `ForEach`.

The converted surface now includes shared presentation primitives, form/search helpers, status/notification surfaces, page blocks, deck columns, widgets, user files/activity/achievements/lists/reactions, chat home views, preview cards, admin shells, welcome routing, and other low-state page shells.

Migration rules:

1. New or replaced UI lives in a nearby `vune/` directory as `*.vune.ts`.
2. Prefer Vune primitives and modifiers for renderable structure.
3. Keep state, lifecycle, imperative focus, and existing data loaders in the Vue shell when moving them would change behavior.
4. Use `VueComponent(...)` only for a child that is still Vue-only or relies on Vue-specific behavior.
5. Use `VueSlot(...)` only where the legacy caller still owns the slot.
6. Keep the old `.vue` path as a small compatibility shell until callers have migrated.
7. Transition/Teleport/directive/focus-heavy views move last unless Vune has an equivalent with matching semantics.
8. Do not count a file as migrated merely because Vune wraps the whole Vue template; Vune should own the surrounding layout/repetition/conditional tree.

## Motion and Material

`packages/frontend/src/vune/motion.ts` is the application adapter for Vune's shared `o0o0o` animation engine. Numeric and spring values use the same scheduler/interpolator as the updated `@vune-ui/web` renderer, while fixed keyframes use the browser Web Animations API compositor path. The adapter preserves cubic-bezier curves, repeat, autoreverse, cancellation, reduced-motion behavior, and callback isolation for existing Vue consumers. `MkNumber` now uses this shared clock instead of maintaining a component-local animation frame loop.

`packages/frontend/src/vune/material.ts` and `MaterialSurface.vune.ts` provide reusable translucent surfaces. Material tiers are `ultraThin`, `thin`, `regular`, `thick`, `ultraThick`, and `bar`. The stylesheet includes backdrop blur/saturation, an opaque fallback when backdrop filtering is unavailable, reduced-transparency handling, and increased-contrast handling. Notifications and the hashtag compose/footer surface are real Material consumers rather than one-off blur CSS.

## Validation

At this checkpoint all 108 Vune sources pass compiler diagnostics and transformation when checked in batches, all 27 native Vune sources pass the native boundary check, and all modified Vue SFCs parse with `@vue/compiler-sfc`.

The supplied dependency tree contains macOS ARM native esbuild/Rollup artifacts, while validation runs in Linux x64. For that reason a full Vite production bundle is not a valid check in this workspace without reinstalling native dependencies. The source tree is intentionally left untouched rather than replacing the supplied dependency set just for the build host.
