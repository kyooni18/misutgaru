/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Temporary placement adapter for native Vune Views inside the legacy Vue tree.
 * The component API and renderer are Vune-owned. Vue only owns the placeholder
 * lifecycle until the surrounding parent has also moved to Vune.
 */
import {
	defineComponent,
	h,
	inject,
	ref,
	onBeforeUpdate,
	onBeforeUnmount,
	onMounted,
	shallowRef,
	unref,
	watch,
} from 'vue';
import type { DefineComponent, Slots } from 'vue';
import {
	State,
	actionClosure,
	defineView,
	initializer,
	initializersOf,
	namedArguments,
} from 'vune-ui';
import type {
	InitializerParameter,
	ModifiableViewNode,
	StateRef,
	ViewConstructor,
	ViewGraphValue,
} from 'vune-ui';
import { Component as VueComponentNode, VuneView } from '@vune-ui/vue';
import { mount } from '@vune-ui/web';
import { prefer } from '@/preferences.js';
import { DI } from '@/di.js';
import type { PageMetadata } from '@/page.js';

export type LegacyVuneHostOptions = {
	/** Map a Vune initializer field name to the legacy Vue attribute/event name. */
	aliases?: Readonly<Record<string, string>>;
	/** Rare per-field coercions that cannot be inferred from Vune type metadata. */
	coerce?: Readonly<Record<string, (value: unknown) => unknown>>;
	/** Select a non-primary initializer when a View intentionally exposes several. */
	initializerIndex?: number;
	/** Re-render when Vue refs/reactive state nested under these prop names changes. */
	deepProps?: readonly string[];
};

type LegacyAttrs = Readonly<Record<string, unknown>>;
// Legacy Vue placement must accept the full Vune initializer/attr surface and
// arbitrary legacy emits. Runtime metadata remains Vune-owned; this type keeps
// Vue utilities such as Storybook and os.popup from collapsing that temporary
// boundary to `{}` props / `never` emits.
type LegacyVuneVueComponent = DefineComponent<
	Record<string, any>,
	Record<string, never>,
	Record<string, never>,
	any,
	any,
	any,
	any,
	Record<string, any[]>
>;
type LegacyHostCoercion = 'identity' | 'boolean' | 'number';

type WebStyle = Record<string, string | number>;

const LegacyVueSlotBridge = defineComponent({
	name: 'MisutgaruLegacyVuneSlotBridge',
	props: {
		renderSlot: {
			type: Function,
			required: true,
		},
	},
	setup(props) {
		return () => (props.renderSlot as () => unknown)();
	},
});

function legacyVueSlotNode(slot: NonNullable<Slots[string]>, slotProps: Record<string, unknown> = {}): ModifiableViewNode {
	return VueComponentNode(LegacyVueSlotBridge, {
		renderSlot: () => slot(slotProps),
	});
}

function snapshotAttrs(attrs: Record<string, unknown>): LegacyAttrs {
	return Object.freeze({ ...attrs });
}

function shallowEqual(left: LegacyAttrs, right: LegacyAttrs): boolean {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.is(left[key], right[key])) return false;
	}
	return true;
}

function styleFromText(value: string): WebStyle {
	const result: WebStyle = {};
	for (const declaration of value.split(';')) {
		const separator = declaration.indexOf(':');
		if (separator < 0) continue;
		const key = declaration.slice(0, separator).trim();
		const item = declaration.slice(separator + 1).trim();
		if (key && item) result[key] = item;
	}
	return result;
}

function webStyle(value: unknown): WebStyle {
	if (typeof value === 'string') return styleFromText(value);
	if (Array.isArray(value)) return Object.assign({}, ...value.map(webStyle));
	if (!value || typeof value !== 'object') return {};
	const result: WebStyle = {};
	for (const [key, item] of Object.entries(value)) {
		if (typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) result[key] = item;
	}
	return result;
}

function legacyBoolean(value: unknown, defaultValue = false): boolean {
	if (value === undefined || value === null) return defaultValue;
	if (value === false || value === 'false') return false;
	return true;
}

type CompiledLegacyParameter = {
	parameter: InitializerParameter;
	legacyName: string | null;
	coerce: (value: unknown) => unknown;
};

function coercionFromType(parameter: InitializerParameter): LegacyHostCoercion {
	const type = parameter.type?.replace(/\s+/g, '') ?? '';
	if (/(?:^|\|)boolean(?:\||$)/.test(type)) return 'boolean';
	if (/(?:^|\|)number(?:\||$)/.test(type)) return 'number';
	return 'identity';
}

function compileParameterCoercion(
	coercion: LegacyHostCoercion,
	custom?: (value: unknown) => unknown,
): (value: unknown) => unknown {
	if (custom) return custom;
	if (coercion === 'boolean') return value => value === undefined ? undefined : legacyBoolean(value);
	if (coercion === 'number') {
		return value => {
			if (value === undefined) return undefined;
			const number = Number(value);
			return Number.isFinite(number) ? number : value;
		};
	}
	return value => value;
}

/**
 * Compile Vune initializer metadata once when the Vue placement host is
 * created. The legacy host still accepts sparse Vue attrs, but hot re-renders
 * no longer repeat initializer lookup, alias resolution, or type-string
 * parsing for every body evaluation.
 */
function legacyHostPropNames(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions,
): readonly string[] {
	const initializers = initializersOf(ViewType);
	const selected = initializers[options.initializerIndex ?? 0];
	if (!selected) return [];
	const parameters = selected.parameters ?? [];
	const firstName = parameters[0]?.name ?? parameters[0]?.label;
	// A single `props` parameter is an intentional legacy attrs bag rather than
	// a Vue prop literally named `props`. Leave the attrs undeclared so the host
	// can snapshot the complete legacy attribute set into that bag.
	if (parameters.length === 1 && firstName === 'props') return [];
	const generated = ViewType.viewType.legacyHost?.initializers.find(plan => plan.index === (options.initializerIndex ?? 0));
	const names = new Set<string>();
	for (const [index, parameter] of parameters.entries()) {
		const planned = generated?.parameters[index];
		const name = planned?.name ?? parameter.name ?? parameter.label;
		if (name) names.add(options.aliases?.[name] ?? name);
	}
	return [...names];
}

function compileLegacyViewAdapter(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions,
): (attrs: LegacyAttrs) => ModifiableViewNode {
	const initializers = initializersOf(ViewType);
	const selected = initializers[options.initializerIndex ?? 0];
	if (!selected) return () => ViewType();

	const parameters = selected.parameters ?? [];
	const firstName = parameters[0]?.name ?? parameters[0]?.label;
	// Transitional/native Views may intentionally accept the entire old Vue
	// attrs object as one `props` value. Generated `?vue-host` modules still use
	// createVuneWebHost, so support the same bag convention here that the Vue
	// renderer compatibility adapter already supports.
	if (parameters.length === 1 && firstName === 'props') {
		return attrs => ViewType(attrs);
	}
	const generated = ViewType.viewType.legacyHost?.initializers.find(plan => plan.index === (options.initializerIndex ?? 0));
	const bindings: CompiledLegacyParameter[] = parameters.map((parameter, index) => {
		const planned = generated?.parameters[index];
		const name = planned?.name ?? parameter.name ?? parameter.label;
		return {
			parameter,
			legacyName: name ? (options.aliases?.[name] ?? name) : null,
			coerce: compileParameterCoercion(planned?.coercion ?? coercionFromType(parameter), name ? options.coerce?.[name] : undefined),
		};
	});

	return attrs => {
		const values = bindings.map(binding => {
			if (!binding.legacyName) return undefined;
			// Vue refs are unwrapped only at this compatibility boundary. Vune
			// State/Binding values are different objects and pass through unref.
			const raw = unref(attrs[binding.legacyName] as any);
			const value = binding.coerce(raw);
			return binding.parameter.kind === 'action' && typeof value === 'function'
				? actionClosure(value as (...args: any[]) => any)
				: value;
		});

		// Vue attrs are sparse. Keep the required positional prefix, then carry
		// labeled values through Vune's named-argument adapter so omitted optionals
		// stay omitted instead of becoming ambiguous positional undefined values.
		const positional: unknown[] = [];
		const labeled: Record<string, unknown> = {};
		let sawLabel = false;
		for (const [index, value] of values.entries()) {
			if (value === undefined) continue;
			const parameter = bindings[index]?.parameter;
			if (parameter?.label) {
				sawLabel = true;
				labeled[parameter.label] = value;
			} else if (!sawLabel) {
				positional.push(value);
			} else {
				// A later unlabeled parameter cannot be represented after a named
				// carrier. Preserve the old positional shape for this uncommon case.
				return ViewType(...values);
			}
		}
		if (Object.keys(labeled).length > 0) positional.push(namedArguments(labeled));
		return ViewType(...positional);
	};
}

function decorateLegacyRoot(view: ModifiableViewNode, attrs: LegacyAttrs): ModifiableViewNode {
	let result = view;
	const className = attrs.class ?? attrs.className;
	if (className !== undefined && className !== null) result = result.className(className as never);
	const style = webStyle(attrs.style);
	if (Object.keys(style).length > 0) result = result.style(style);
	return result;
}

function compileLegacyVueStructAdapter(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions = {},
): (attrs: LegacyAttrs, slots: Readonly<Slots>) => ModifiableViewNode {
	const selected = initializersOf(ViewType)[options.initializerIndex ?? 0];
	const parameters = selected?.parameters ?? [];
	const firstName = parameters[0]?.name ?? parameters[0]?.label;

	// Transitional struct Views converted from the old createVuneComponent
	// authoring model intentionally keep the legacy attrs object as one stored
	// property. This preserves the exact Vue prop/attr semantics while moving
	// the authored source onto the canonical `struct ...: View` compiler path.
	if (parameters.length === 1 && firstName === 'props') {
		return attrs => ViewType(attrs);
	}
	if (parameters.length === 1 && firstName === 'legacyVueInput') {
		return (attrs, slots) => ViewType({ props: attrs, slots });
	}
	if (parameters.length === 0) {
		return () => ViewType();
	}

	const generated = ViewType.viewType.legacyHost?.initializers.find(plan => plan.index === (options.initializerIndex ?? 0));
	const instantiate = compileLegacyViewAdapter(ViewType, options);
	return (attrs, slots) => {
		const slotAttrs: Record<string, unknown> = { ...attrs };
		for (const [index, parameter] of parameters.entries()) {
			const planned = generated?.parameters[index];
			const name = planned?.name ?? parameter.name ?? parameter.label;
			if (!name) continue;
			const legacyName = options.aliases?.[name] ?? name;
			if (slotAttrs[legacyName] !== undefined) continue;
			if (parameter.kind === 'viewBuilder') {
				const slot = slots[name === 'content' ? 'default' : name] ?? (name === 'content' ? slots.default : undefined);
				if (slot) slotAttrs[legacyName] = () => legacyVueSlotNode(slot);
				continue;
			}
			if (/\bView(?:Graph)?Value\b/.test(parameter.type ?? '')) {
				const slot = slots[name];
				if (slot) slotAttrs[legacyName] = legacyVueSlotNode(slot);
			}
		}
		return decorateLegacyRoot(instantiate(slotAttrs), attrs);
	};
}

/**
 * Render a struct-authored Vune View through the Vue renderer while its body
 * still embeds Vue-only components or slots. This is the staged-migration
 * counterpart to createVuneWebHost: authored UI is canonical Vune, but Vue
 * remains the materializer until the remaining foreign leaves are migrated.
 */
export function createVuneVueHost(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions = {},
): LegacyVuneVueComponent {
	const instantiate = compileLegacyVueStructAdapter(ViewType, options);
	return defineComponent({
		name: 'MisutgaruVuneVueHost',
		inheritAttrs: false,
		setup(_props, { attrs, slots }) {
			return () => h(VuneView, {
				render: () => instantiate(attrs, slots),
				disablesAnimations: !prefer.s.animation,
			});
		},
	}) as LegacyVuneVueComponent;
}

/**
 * Place a native Vune struct in the old Vue tree without making Vue its renderer.
 * The first declared Vune initializer is populated from attrs by source field name.
 */
export function createVuneWebHost(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions = {},
): LegacyVuneVueComponent {
	const instantiate = compileLegacyViewAdapter(ViewType, options);
	const propNames = legacyHostPropNames(ViewType, options);
	type CompatRootProps = { readonly input: StateRef<LegacyAttrs> };
	// The compatibility root is identical for every instance of this host type.
	// Defining it once here avoids allocating and registering a fresh Vune View
	// constructor for every timestamp, ticker, loading indicator, etc. mounted in
	// the legacy Vue tree. Its only direct dependency is the per-instance input
	// State; nested View dependencies remain owned by their normal boundaries.
	const Root = defineView<CompatRootProps>('MisutgaruNativeVuneCompatRoot', {
		initializers: [initializer(
			'MisutgaruNativeVuneCompatRoot(input)',
			args => args.length === 1,
			args => ({ input: args[0] as StateRef<LegacyAttrs> }),
		)],
		dependencies: props => [props.input],
		dependenciesComplete: true,
		body: ({ input }): ViewGraphValue => decorateLegacyRoot(instantiate(input.value), input.value),
	});
	return defineComponent({
		name: 'MisutgaruNativeVuneHost',
		inheritAttrs: false,
		// Declaring initializer inputs as real Vue props makes the compatibility
		// boundary participate in Vue's normal prop invalidation. In particular,
		// action-shaped names such as onToggle no longer live only in the
		// non-reactive attrs bag, and a checked change cannot wait until a
		// post-render lifecycle callback before Vune sees it.
		props: [...propNames],
		setup(props, { attrs }) {
			const host = shallowRef<HTMLElement | null>(null);
			const snapshotInput = (): LegacyAttrs => snapshotAttrs({ ...attrs, ...props });
			let hadPassThroughAttrs = Object.keys(attrs).length > 0;
			let current = snapshotInput();
			const state = State<LegacyAttrs>(current);
			let dispose: (() => void) | undefined;
			const syncInput = (force = false) => {
				const next = snapshotInput();
				if (!force && shallowEqual(current, next)) return;
				current = next;
				state.value = next;
			};
			const stopPropWatch = propNames.length > 0
				? watch(() => propNames.map(name => (props as Readonly<Record<string, unknown>>)[name]), () => syncInput(), { flush: 'sync' })
				: undefined;
			const stopDeepWatches = (options.deepProps ?? []).map(name => watch(
				() => (props as Readonly<Record<string, unknown>>)[name],
				() => syncInput(true),
				{ flush: 'sync', deep: true },
			));

			onMounted(() => {
				if (host.value) dispose = mount(Root(state), host.value, {
					disablesAnimations: () => !prefer.s.animation,
				});
			});

			// attrs itself is intentionally not reactive in Vue. Class/style and any
			// legacy pass-through attrs therefore still get one pre-commit sync,
			// while declared initializer props take the synchronous watcher above.
			onBeforeUpdate(() => {
				const hasPassThroughAttrs = Object.keys(attrs).length > 0;
				if (!hasPassThroughAttrs && !hadPassThroughAttrs) return;
				hadPassThroughAttrs = hasPassThroughAttrs;
				syncInput();
			});

			onBeforeUnmount(() => {
				stopPropWatch?.();
				for (const stop of stopDeepWatches) stop();
				dispose?.();
				dispose = undefined;
			});

			return () => h('misutgaru-vune-host', {
				ref: host,
				style: { display: 'contents' },
			});
		},
	}) as LegacyVuneVueComponent;
}

/** Place a native page View inside the legacy Vue page scope while preserving
 * the scoped definePage metadata used by independent windows/deck columns. */
export function createPageVuneWebHost(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions = {},
): LegacyVuneVueComponent {
	const NativeHost = createVuneWebHost(ViewType, options);
	return defineComponent({
		name: 'MisutgaruNativeVunePageHost',
		inheritAttrs: false,
		setup(_props, { attrs }) {
			const metadata = inject(DI.pageMetadata, ref<PageMetadata | null>(null));
			return () => h(NativeHost, { ...attrs, pageMetadata: metadata.value });
		},
	}) as LegacyVuneVueComponent;
}
