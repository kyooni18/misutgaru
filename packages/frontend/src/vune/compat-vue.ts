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
	onBeforeUpdate,
	onBeforeUnmount,
	onMounted,
	shallowRef,
	unref,
	watch,
} from 'vue';
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
	LegacyHostCoercion,
	ModifiableViewNode,
	ViewConstructor,
	ViewGraphValue,
} from 'vune-ui';
import { mount } from '@vune-ui/web';

export type LegacyVuneHostOptions = {
	/** Map a Vune initializer field name to the legacy Vue attribute/event name. */
	aliases?: Readonly<Record<string, string>>;
	/** Rare per-field coercions that cannot be inferred from Vune type metadata. */
	coerce?: Readonly<Record<string, (value: unknown) => unknown>>;
	/** Select a non-primary initializer when a View intentionally exposes several. */
	initializerIndex?: number;
};

type LegacyAttrs = Readonly<Record<string, unknown>>;

type WebStyle = Record<string, string | number>;

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
	const generated = ViewType.viewType.legacyHost?.initializers.find(plan => plan.index === (options.initializerIndex ?? 0));
	const names = new Set<string>();
	for (const [index, parameter] of (selected.parameters ?? []).entries()) {
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

/**
 * Place a native Vune struct in the old Vue tree without making Vue its renderer.
 * The first declared Vune initializer is populated from attrs by source field name.
 */
export function createVuneWebHost(
	ViewType: ViewConstructor,
	options: LegacyVuneHostOptions = {},
) {
	const instantiate = compileLegacyViewAdapter(ViewType, options);
	const propNames = legacyHostPropNames(ViewType, options);
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
			let current = snapshotInput();
			const state = State<LegacyAttrs>(current);
			let dispose: (() => void) | undefined;
			const syncInput = () => {
				const next = snapshotInput();
				if (shallowEqual(current, next)) return;
				current = next;
				state.value = next;
			};
			const stopPropWatch = propNames.length > 0
				? watch(() => propNames.map(name => (props as Readonly<Record<string, unknown>>)[name]), syncInput, { flush: 'sync' })
				: undefined;

			const Root = defineView('MisutgaruNativeVuneCompatRoot', {
				initializers: [initializer(
					'MisutgaruNativeVuneCompatRoot()',
					args => args.length === 0,
					() => ({}),
				)],
				body: (): ViewGraphValue => decorateLegacyRoot(instantiate(state.value), state.value),
			});

			onMounted(() => {
				if (host.value) dispose = mount(Root(), host.value);
			});

			// attrs itself is intentionally not reactive in Vue. Class/style and any
			// legacy pass-through attrs therefore still get one pre-commit sync,
			// while declared initializer props take the synchronous watcher above.
			onBeforeUpdate(syncInput);

			onBeforeUnmount(() => {
				stopPropWatch?.();
				dispose?.();
				dispose = undefined;
			});

			return () => h('misutgaru-vune-host', {
				ref: host,
				style: { display: 'contents' },
			});
		},
	});
}
