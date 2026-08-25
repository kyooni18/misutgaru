# Misutgaru native Vune architecture

Misutgaru treats Vune as an independent UI system, not as alternate syntax for Vue.

## Ownership rule

A native Vune component is marked with:

```ts
/* @misutgaru-vune-native */
```

Marked source is renderer-independent and may use Vune Views, builders, state, collections, controls, shapes, and modifiers. It must not import `@vune-ui/vue` or the legacy `@/vune/vue.js` bridge, call `VueComponent(...)` / `VueSlot(...)`, or instantiate raw `Element(...)` nodes in feature code. `scripts/check-vune-native.mjs` enforces this boundary.

If a low-level web semantic has no first-class Vune primitive yet, it belongs in the small platform primitive module at `src/vune/native.ts`, not scattered through components. The current phase-1 native set needs no raw `Element(...)` escape hatch at all.

## Renderers

Native Vune views are rendered by `@vune-ui/web`. This renderer owns DOM creation, reconciliation, Vune `State` subscriptions, view identity, events, and cleanup.

Vue does not render a native Vune graph.

The existing application is still predominantly a Vue tree, so `src/vune/compat-vue.ts` temporarily provides placement only. It creates a `display: contents` host element and mounts the native Vune graph into it with `@vune-ui/web`. Vue owns only the outer lifecycle hook. Prop changes are forwarded through Vune `State` without remounting the Vune graph. Legacy Vue `class`/`style` fallthrough is normalized into a `NativeWebDecoration` and merged into the Vune-owned root so existing call-site styling is preserved without giving Vue ownership of the subtree.

When a parent is converted to native Vune, it imports the child's named Vune View directly and the compatibility host disappears from that subtree.

## Legacy bridge

`src/vune/vue.ts` and `@vune-ui/vue` remain only for components that have not yet been migrated. They are compatibility debt, not the target architecture.

Do not build new components on the legacy bridge.

## Migration order

1. Stateless leaf components: Text, Divider, shapes, links, simple controls.
2. Small interactive leaves: Button, Binding/State, selection controls.
3. Composition components whose children are already native Vune.
4. Lists and grids using `ForEach` / lazy Vune containers.
5. Complex feature surfaces.
6. Remove Vue placement hosts as native parents reach them.
7. Remove `@vune-ui/vue` after the final legacy island disappears.

Slot-heavy Vue components should not be declared native while their content is still a Vue VNode tree. Migrate their parents/children first or add a real Vune ViewBuilder API; do not hide Vue slots behind a Vune-looking wrapper.

## Phase 1 native set

The first architecture batch contains ten native Vune leaves:

- `MkAcct`
- `MkCodeInline`
- `MkDivider`
- `MkEllipsis`
- `MkFeaturedPhotos`
- `MkNumberCell`
- `MkPolkadots`
- `MkPostFormTextCounter`
- `MkRemoteCaution`
- `MkTab`

`MkPolkadots` and `MkPostFormTextCounter` were converted directly from Vue rather than from the earlier Vune/Vue wrapper layer.

## Validation

Use:

```sh
pnpm vune:check
pnpm vune:report
```

`vune:check` performs Vune compiler validation plus the native-boundary rule. Native files are also expected to produce valid TypeScript after Vune lowering.

The migration report deliberately separates "Vune source" from "native Vune". A file does not count as native merely because its extension is `.vune.ts`. Native Vue-component calls, native Vue-slot calls, and native raw-Element calls must all remain zero.
