# Vune migration

## Current model

Misutgaru is not fully Vune-native. Vue and Vune coexist.

A `.vune` file may be either a native Vune view or a compatibility renderer hosted by Vue. Use the native marker and boundary check, not file extension alone, when deciding whether Vue dependencies are allowed.

## Boundaries

- `packages/frontend/src/vune/native.ts` owns native web semantics.
- `packages/frontend/src/vune/compat-vue.ts` is the placement bridge while Vue owns surrounding state/lifecycle.
- `packages/frontend/src/vune/vue.ts` is legacy compatibility debt.
- `packages/frontend/src/vune/motion.ts` is the shared migrated motion path.

Native parents should import native child Views directly whenever possible. Do not hide a Vue component, raw DOM `Element`, `.vue` dependency, or old compatibility factory behind `@misutgaru-vune-native`.

## Migration order

Prefer low-state leaves first, then complete self-contained subtrees. Keep Vue ownership for behavior that Vune cannot yet match cleanly, especially teleport, directives, focus semantics, complex slots, transitions, and lifecycle-heavy components.

## Validation

```sh
pnpm vune:report
node scripts/check-vune-native.mjs packages/frontend/src
```

At the 2026-08-27 checkpoint the report found about 233 `.vune` files and 67 native-marked files. The native boundary check still had 20 violations across three files, so archived claims of a fully clean native boundary are no longer current.