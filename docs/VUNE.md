# Historical Vune migration record

> Inactive as of 2026-09-10. Misutgaru's active frontend has been reverted to Vue 3 only. The Vune packages, source components, compiler/Vite integration, host adapters, and repository submodule were removed from the current application path. The material below is retained solely to document the abandoned migration.

## Native and compatibility markers

`@misutgaru-vune-native` means the View must pass the native boundary checker. Native sources cannot depend on Vue components/slots, `.vue` files, raw `Element`, unrestricted host creation, or legacy bridge factories.

`@misutgaru-vune-compat` marks a Vune source that intentionally still crosses the Vue boundary. The current compatibility set is `MkEmojiPicker.vune` and `MkPostFormSurface.vune`.

Current working-tree report: 298 Vune sources, all 298 native Views, 0 explicit compatibility sources, and 226 Vue SFCs that still reference Vune. Of those Vue/Vune boundaries, 108 use generated `?vue-host` modules and 118 still use direct `.vune` placement paths. The remaining pure Vue surface is 359 SFCs.

## Typed Vue placement bridge

The compatibility host remains a migration mechanism, not a target architecture.

Authored Vune initializer metadata is lowered by the compiler into a small legacy-host plan containing parameter names, labels, kinds, required state, and primitive coercion. `compat-vue.ts` consumes that plan once when a Vue host is created. This removes repeated runtime type-string interpretation from normal authored Vune components.

`@vune-ui/compiler` also exposes `generateVueHostModule` to emit a typed transitional Vue host from the Vune semantic model. With `vueHost.factoryImport` configured in the Vite plugin, `.vune?vue-host` imports generate a pure-JS runtime host automatically. Physical `generateVueHostModule` output keeps `$props` typing, while the query form avoids TypeScript-only syntax under a custom Vite module ID. Both forms and runtime metadata use the same initializer source of truth; aliases and unusual initializer selection can still use the explicit generator/compatibility API.

## Renderer invalidation

State reads are collected per View boundary. A changed State schedules that boundary when it is locally safe, or escalates to the smallest safe root pass when geometry/lazy/empty-output constraints require it. Multiple dirty boundaries in the same turn share one microtask flush and parents are processed first.

This behavior is more important than merely increasing the number of `.vune` files: a native View should have narrow invalidation, stable identity, and direct child View composition.

## Native browser primitives

Prefer framework primitives over Misutgaru-specific host escapes. Current Vune web-facing coverage includes ordinary controls plus text editing, file input, content-editable text, canvas, media, SVG/path, focus scope, and popover primitives.

The remaining low-level Misutgaru native bridge uses closed HTML/SVG tag sets and dedicated interactive helpers. Do not reintroduce a generic string-tag escape hatch into native feature Views.

## Motion and automatic layout animation

Vune motion preserves independent CSS property ownership through `@vune-ui/animation`. Layout FLIP uses separate translate/scale channels so intrinsic size/position animation does not cancel a simultaneous transform animation.

Animations must preserve reduced-motion behavior, cancellation, retargeting, repeat/autoreverse semantics, and exact final values. Keep layout animation automatic at the renderer boundary rather than adding per-component FLIP code.

## DevTools

Development builds can enable the Vune overlay with `?vune-devtools=1` or Ctrl/Command + Shift + V. It shows the most expensive active boundaries with render count, average/max duration, dependency count, node count, and update mode.

The recorder short-circuits while disabled so production/default development behavior does not accumulate profiling state.

## Checks

```sh
pnpm vune:report
node scripts/check-vune-native.mjs packages/frontend/src
pnpm verify:modules
```

The report intentionally measures migration facts and remaining Vue features. It does not assign migration-priority scores; component selection remains an engineering decision.

The report distinguishes generated `?vue-host` placement from older direct `.vune` placement. Both count as Vue-owned migration surface; deleting a redundant `.vue` shell and importing the generated host at the real consumer lowers the Vue SFC count without pretending that the route or parent is already renderer-native.
