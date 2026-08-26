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
	onBeforeUnmount,
	onMounted,
	onUpdated,
	shallowRef,
	unref,
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

function coerceByParameter(parameter: InitializerParameter, value: unknown): unknown {
	if (value === undefined) return undefined;
	const type = parameter.type?.replace(/\s+/g, '') ?? '';
	if (/(?:^|\|)boolean(?:\||$)/.test(type)) return legacyBoolean(value);
	if (/(?:^|\|)number(?:\||$)/.test(type)) {
		const number = Number(value);
		return Number.isFinite(number) ? number : value;
	}
	return value;
}

function instantiateView(
	ViewType: ViewConstructor,
	attrs: LegacyAttrs,
	options: LegacyVuneHostOptions,
): ModifiableViewNode {
	const initializers = initializersOf(ViewType);
	const initializer = initializers[options.initializerIndex ?? 0];
	if (!initializer) return ViewType();
	const parameters = initializer.parameters ?? [];
	const values = parameters.map(parameter => {
		const name = parameter.name ?? parameter.label;
		if (!name) return undefined;
		const legacyName = options.aliases?.[name] ?? name;
		// `popup()` deliberately accepts Vue refs so the legacy component can
		// update without being recreated.  Vue does not unwrap refs stored in a
		// props object passed through a render function, though, so the host
		// would otherwise hand RefImpl objects to the Vune initializer resolver
		// (for example `MkWaitingDialog(object, object)`).  Unwrap only Vue refs
		// at this boundary; Vune State/Binding refs are different objects and are
		// left untouched by `unref`.
		const raw = unref(attrs[legacyName] as any);
		const custom = options.coerce?.[name];
		const value = custom ? custom(raw) : coerceByParameter(parameter, raw);
		return parameter.kind === 'action' && typeof value === 'function'
			? actionClosure(value as (...args: any[]) => any)
			: value;
	});
	// Vue attrs are sparse. Passing positional `undefined` placeholders makes
	// optional Vune initializers ambiguous (for example `MkLoading(undefined,
	// true)`), because the runtime resolver deliberately treats omitted values
	// differently from explicit positional gaps. Preserve the required
	// positional prefix and carry labeled values through Vune's named-argument
	// adapter instead.
	const positional: unknown[] = [];
	const labeled: Record<string, unknown> = {};
	let sawLabel = false;
	for (const [index, value] of values.entries()) {
		if (value === undefined) continue;
		const parameter = parameters[index];
		if (parameter?.label) {
			sawLabel = true;
			labeled[parameter.label] = value;
		} else if (!sawLabel) {
			positional.push(value);
		} else {
			// A later unlabeled parameter cannot be represented after a named
			// carrier. Keep the old positional shape for this uncommon legacy
			// initializer rather than silently shifting its arguments.
			return ViewType(...values);
		}
	}
	if (Object.keys(labeled).length > 0) positional.push(namedArguments(labeled));
	return ViewType(...positional);
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
	return defineComponent({
		name: 'MisutgaruNativeVuneHost',
		inheritAttrs: false,
		setup(_props, { attrs }) {
			const host = shallowRef<HTMLElement | null>(null);
			let current = snapshotAttrs(attrs);
			const state = State<LegacyAttrs>(current);
			let dispose: (() => void) | undefined;

			const Root = defineView('MisutgaruNativeVuneCompatRoot', {
				initializers: [initializer(
					'MisutgaruNativeVuneCompatRoot()',
					args => args.length === 0,
					() => ({}),
				)],
			body: (): ViewGraphValue => decorateLegacyRoot(instantiateView(ViewType, state.value, options), state.value),
			});

			onMounted(() => {
				if (host.value) dispose = mount(Root(), host.value);
			});

			onUpdated(() => {
				const next = snapshotAttrs(attrs);
				if (shallowEqual(current, next)) return;
				current = next;
				state.value = next;
			});

			onBeforeUnmount(() => {
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
