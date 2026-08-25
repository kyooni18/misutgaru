# Misutgaru native Vune UI

Misutgaru treats Vune as an independent UI system. Vue is a temporary placement host for legacy parents, not the renderer or component model of native Vune Views.

## Native source contract

A file marked `@misutgaru-vune-native` must use the SwiftUI-derived Vune declaration model:

```ts
export struct ExampleView: View {
	let title: string

	init(_ title: string) {
		self.title = title
	}

	var body: some View {
		VStack(alignment: 'leading', spacing: 8) {
			Text(title)
		}
	}
}
```

Native View source must not contain:

- Vue renderer/component/slot bridges
- `.vue` imports, including type-only dependencies
- raw `Element(...)` host construction
- `createVuneComponent`, `NativeVuneFactory`, or `createVuneWebHost`
- `const`-declared component/render factories

Use Vune Views (`Text`, `Image`, `Button`, `Link`, `HStack`, `VStack`, `ZStack`, `Grid`, `Circle`, `Capsule`, and other Vune primitives) and Vune modifiers instead.

## Compatibility boundary

Legacy `.vue` call sites may temporarily use `createVuneWebHost(ViewType)`. That adapter only supplies old Vue attrs/events and a lifecycle placeholder. `@vune-ui/web` owns and renders the native Vune subtree.

Compatibility code belongs outside `.vune.ts`. When a parent migrates to Vune, it should call the child View initializer directly and the Vue placement shell can be deleted.

## Migration order

1. leaf display Views with primitive props
2. leaf controls with `@Action`
3. small composition Views made entirely of already-native children
4. containers with Vune `@ViewBuilder` content
5. stateful Views once their state/binding semantics can stay Vune-native
6. large pages last

Do not count a component as native while it contains Vue components, Vue slots, or raw host elements.

Run:

```sh
pnpm vune:check
pnpm vune:report
```

`check-vune-native.mjs` enforces the source contract so a native View cannot silently regress into a Vue wrapper.
