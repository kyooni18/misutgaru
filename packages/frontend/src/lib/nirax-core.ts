/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// NIRAX --- A lightweight router

import { EventEmitter } from 'eventemitter3';

function safeURIDecode(str: string): string {
	try {
		return decodeURIComponent(str);
	} catch {
		return str;
	}
}

interface RouteDefBase<ComponentType = unknown> {
	path: string;
	query?: Record<string, string>;
	loginRequired?: boolean;
	name?: string;
	hash?: string;
	children?: RouteDef<ComponentType>[];
}

interface RouteDefWithComponent<ComponentType = unknown> extends RouteDefBase<ComponentType> {
	component: ComponentType,
}

interface RouteDefWithRedirect<ComponentType = unknown> extends RouteDefBase<ComponentType> {
	redirect: string | ((props: Map<string, string | boolean>) => string);
}

export type RouteDef<ComponentType = unknown> = RouteDefWithComponent<ComponentType> | RouteDefWithRedirect<ComponentType>;

export type RouterFlag = 'forcePage';

type ParsedPath = (string | {
	name: string;
	startsWith?: string;
	wildcard?: boolean;
	optional?: boolean;
})[];

export type RouterEvents<ComponentType = unknown> = {
	/** ページ内遷移を検知した場合（analytics用） */
	change: (ctx: {
		beforeFullPath: string;
		fullPath: string;
		resolved: PathResolvedResult<ComponentType>;
	}) => void;
	/** history stateのreplaceを行う場合 */
	replace: (ctx: {
		fullPath: string;
	}) => void;
	/** location.replace相当の処理が必要な場合 */
	forceReplace: (ctx: {
		onInit: boolean;
		fullPath: string;
	}) => void;
	/** history stateのpushを行う場合 */
	push: (ctx: {
		beforeFullPath: string;
		fullPath: string;
		route: RouteDef<ComponentType> | null;
		props: Map<string, string | boolean> | null;
	}) => void;
	/** location.hrefへの代入相当の処理が必要な場合 */
	forcePush: (ctx: {
		onInit: boolean;
		fullPath: string;
	}) => void;
	/** 遷移先が現在のページと同じだった場合 */
	same: () => void;
};

export type PathResolvedResult<ComponentType = unknown> = {
	route: RouteDef<ComponentType>;
	props: Map<string, string | boolean>;
	child?: PathResolvedResult<ComponentType>;
	redirected?: boolean;

	/** @internal */
	_parsedRoute: {
		fullPath: string;
		queryString: string | null;
		hash: string | null;
	};
};

//#region Path Types
type Prettify<T> = {
	[K in keyof T]: T[K]
} & {};

type RemoveNever<T> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K];
} & {};

type IsPathParameter<Part extends string> = Part extends `${string}:${infer Parameter}` ? Parameter : never;

type GetPathParamKeys<Path extends string> =
	Path extends `${infer A}/${infer B}`
		? IsPathParameter<A> | GetPathParamKeys<B>
		: IsPathParameter<Path>;

type GetPathParams<Path extends string> = Prettify<{
	[Param in GetPathParamKeys<Path> as Param extends `${string}?` ? never : Param]: string;
} & {
	[Param in GetPathParamKeys<Path> as Param extends `${infer OptionalParam}?` ? OptionalParam : never]?: string;
}>;

type UnwrapReadOnly<T> = T extends ReadonlyArray<infer U>
	? U
	: T extends Readonly<infer U>
		? U
		: T;

type GetPaths<Def extends RouteDef<any>> = Def extends { path: infer Path }
	? Path extends string
		? Def extends { children: infer Children }
			? Children extends RouteDef<any>[]
				? Path | `${Path}${FlattenAllPaths<Children>}`
				: Path
			: Path
		: never
	: never;

type FlattenAllPaths<Defs extends RouteDef<any>[]> = GetPaths<Defs[number]>;

type GetSinglePathQuery<Def extends RouteDef<any>, Path extends FlattenAllPaths<RouteDef<any>[]>> = RemoveNever<
	Def extends { path: infer BasePath, children: infer Children }
		? BasePath extends string
			? Path extends `${BasePath}${infer ChildPath}`
				? Children extends RouteDef<any>[]
					? ChildPath extends FlattenAllPaths<Children>
						? GetPathQuery<Children, ChildPath>
						: Record<string, never>
					: never
				: never
			: never
		: Def['path'] extends Path
			? Def extends { query: infer Query }
				? Query extends Record<string, string>
					? UnwrapReadOnly<{ [Key in keyof Query]?: string; }>
					: Record<string, never>
				: Record<string, never>
			: Record<string, never>
>;

type GetPathQuery<Defs extends RouteDef<any>[], Path extends FlattenAllPaths<Defs>> = GetSinglePathQuery<Defs[number], Path>;

type RequiredIfNotEmpty<K extends string, T extends Record<string, unknown>> = T extends Record<string, never>
	? { [Key in K]?: T }
	: { [Key in K]: T };

type NotRequiredIfEmpty<T extends Record<string, unknown>> = T extends Record<string, never> ? T | undefined : T;

type GetRouterOperationProps<Defs extends RouteDef<any>[], Path extends FlattenAllPaths<Defs>> = NotRequiredIfEmpty<RequiredIfNotEmpty<'params', GetPathParams<Path>> & {
	query?: GetPathQuery<Defs, Path>;
	hash?: string;
}>;
//#endregion

function buildFullPath(args: {
	path: string;
	params?: Record<string, string>;
	query?: Record<string, string>;
	hash?: string;
}) {
	let fullPath = args.path;

	if (args.params) {
		for (const key in args.params) {
			const value = args.params[key];
			const replaceRegex = new RegExp(`:${key}(\\?)?`, 'g');
			fullPath = fullPath.replace(replaceRegex, value ? encodeURIComponent(value) : '');
		}
		// remove any optional parameters that are not provided
		fullPath = fullPath.replace(/\/:\w+\?(?=\/|$)/g, '');
	}

	if (args.query) {
		const queryString = new URLSearchParams(args.query).toString();
		if (queryString) {
			fullPath += '?' + queryString;
		}
	}

	if (args.hash) {
		fullPath += '#' + encodeURIComponent(args.hash);
	}

	return fullPath;
}

function parsePath(path: string): ParsedPath {
	const res = [] as ParsedPath;

	path = path.substring(1);

	for (const part of path.split('/')) {
		if (part.includes(':')) {
			const prefix = part.substring(0, part.indexOf(':'));
			const placeholder = part.substring(part.indexOf(':') + 1);
			const wildcard = placeholder.includes('(*)');
			const optional = placeholder.endsWith('?');
			res.push({
				name: placeholder.replace('(*)', '').replace('?', ''),
				startsWith: prefix !== '' ? prefix : undefined,
				wildcard,
				optional,
			});
		} else if (part.length !== 0) {
			res.push(part);
		}
	}

	return res;
}

export class NiraxCore<ComponentType = unknown, DEF extends RouteDef<ComponentType>[] = RouteDef<ComponentType>[]> extends EventEmitter<RouterEvents<ComponentType>> {
	private routes: DEF;
	public current: PathResolvedResult<ComponentType>;
	private currentFullPath: string; // /foo/bar?baz=qux#hash
	private isLoggedIn: boolean;
	private notFoundPageComponent: ComponentType;

	public navHook: ((fullPath: string, flag?: RouterFlag) => boolean) | null = null;

	constructor(routes: DEF, currentFullPath: string, isLoggedIn: boolean, notFoundPageComponent: ComponentType) {
		super();

		this.routes = routes;
		this.current = this.resolve(currentFullPath)!;
		this.currentFullPath = currentFullPath;
		this.isLoggedIn = isLoggedIn;
		this.notFoundPageComponent = notFoundPageComponent;
	}

	protected onCurrentChanged(_resolved: PathResolvedResult<ComponentType>): void {}

	public init(triggerForceReplace = false) {
		const res = this.resolveForNavigation(this.currentFullPath);

		if (triggerForceReplace && res.route.path === '/:(*)') {
			this.emit('forceReplace', {
				onInit: true,
				fullPath: res._parsedRoute.fullPath,
			});
		}

		this.navigate(res, false);
		this.emit('replace', {
			fullPath: res._parsedRoute.fullPath,
		});
	}

	public resolve(fullPath: string): PathResolvedResult<ComponentType> | null {
		let path = fullPath;
		let queryString: string | null = null;
		let hash: string | null = null;
		if (path[0] === '/') path = path.substring(1);
		if (path.includes('#')) {
			hash = path.substring(path.indexOf('#') + 1);
			path = path.substring(0, path.indexOf('#'));
		}
		if (path.includes('?')) {
			queryString = path.substring(path.indexOf('?') + 1);
			path = path.substring(0, path.indexOf('?'));
		}

		const _parsedRoute = {
			fullPath,
			queryString,
			hash,
		};

		function check(routes: RouteDef<ComponentType>[], _parts: string[]): PathResolvedResult<ComponentType> | null {
			forEachRouteLoop:
			for (const route of routes) {
				let parts = [..._parts];
				const props = new Map<string, string>();

				pathMatchLoop:
				for (const p of parsePath(route.path)) {
					if (typeof p === 'string') {
						if (p === parts[0]) {
							parts.shift();
						} else {
							continue forEachRouteLoop;
						}
					} else {
						if (parts[0] == null && !p.optional) {
							continue forEachRouteLoop;
						}
						if (p.wildcard) {
							if (parts.length !== 0) {
								props.set(p.name, safeURIDecode(parts.join('/')));
								parts = [];
							}
							break pathMatchLoop;
						} else {
							if (p.startsWith) {
								if (parts[0] == null || !parts[0].startsWith(p.startsWith)) continue forEachRouteLoop;

								props.set(p.name, safeURIDecode(parts[0].substring(p.startsWith.length)));
								parts.shift();
							} else {
								if (parts[0]) {
									props.set(p.name, safeURIDecode(parts[0]));
								}
								parts.shift();
							}
						}
					}
				}

				if (parts.length === 0) {
					if (route.children) {
						const child = check(route.children, []);
						if (child) {
							return {
								route,
								props,
								child,
								_parsedRoute,
							};
						} else {
							continue forEachRouteLoop;
						}
					}

					if (route.hash != null && hash != null) {
						props.set(route.hash, safeURIDecode(hash));
					}

					if (route.query != null && queryString != null) {
						const queryObject = [...new URLSearchParams(queryString).entries()]
							.reduce((obj, entry) => ({ ...obj, [entry[0]]: entry[1] }), {}) as Record<string, string>;

						for (const q in route.query) {
							const as = route.query[q];
							if (queryObject[q] != null) {
								props.set(as, safeURIDecode(queryObject[q]));
							}
						}
					}

					return {
						route,
						props,
						_parsedRoute,
					};
				} else {
					if (route.children) {
						const child = check(route.children, parts);
						if (child) {
							return {
								route,
								props,
								child,
								_parsedRoute,
							};
						} else {
							continue forEachRouteLoop;
						}
					} else {
						continue forEachRouteLoop;
					}
				}
			}

			return null;
		}

		const _parts = path.split('/').filter(part => part.length !== 0);

		return check(this.routes, _parts);
	}

	/** 通常のresolve + リダイレクト解決 */
	private resolveForNavigation(fullPath: string, _redirectCount = 0): PathResolvedResult<ComponentType> {
		const res = this.resolve(fullPath);

		if (res == null) {
			throw new Error('no route found for: ' + fullPath);
		}

		for (let current: PathResolvedResult<ComponentType> | undefined = res; current != null; current = current.child) {
			if ('redirect' in current.route) {
				let redirectPath: string;
				if (typeof current.route.redirect === 'function') {
					redirectPath = current.route.redirect(current.props);
				} else {
					redirectPath = current.route.redirect + (current._parsedRoute.queryString ? '?' + current._parsedRoute.queryString : '') + (current._parsedRoute.hash ? '#' + current._parsedRoute.hash : '');
				}
				if (_DEV_) console.log('Redirecting from', current._parsedRoute.fullPath, 'to', redirectPath);
				if (_redirectCount > 10) {
					throw new Error('redirect loop detected');
				}
				return this.resolveForNavigation(redirectPath, _redirectCount + 1);
			}
		}

		return {
			...res,
			redirected: _redirectCount > 0,
		};
	}

	/** 解決された`res`に応じてrouterの状態を更新する。 */
	private navigate(res: PathResolvedResult<ComponentType>, emitChange = true) {
		const beforeFullPath = this.currentFullPath;
		this.currentFullPath = res._parsedRoute.fullPath;

		if (res.route.loginRequired && !this.isLoggedIn && 'component' in res.route) {
			res.route.component = this.notFoundPageComponent;
			res.props.set('showLoginPopup', true);
		}

		this.current = res;
		this.onCurrentChanged(res);

		if (emitChange && res.route.path !== '/:(*)') {
			this.emit('change', {
				beforeFullPath,
				fullPath: res._parsedRoute.fullPath,
				resolved: res,
			});
		}

		return res;
	}

	public getCurrentFullPath() {
		return this.currentFullPath;
	}

	public push<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>, flag?: RouterFlag | null) {
		const fullPath = buildFullPath({
			path,
			params: props?.params,
			query: props?.query,
			hash: props?.hash,
		});
		this.pushByPath(fullPath, flag);
	}

	public replace<P extends FlattenAllPaths<DEF>>(path: P, props?: GetRouterOperationProps<DEF, P>) {
		const fullPath = buildFullPath({
			path,
			params: props?.params,
			query: props?.query,
			hash: props?.hash,
		});
		this.replaceByPath(fullPath);
	}

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.push` を使用すること） */
	public pushByPath(fullPath: string, flag?: RouterFlag | null) {
		const beforeFullPath = this.currentFullPath;
		if (fullPath === beforeFullPath) {
			this.emit('same');
			return;
		}
		if (this.navHook) {
			const cancel = this.navHook(fullPath, flag ?? undefined);
			if (cancel) return;
		}
		const res = this.resolveForNavigation(fullPath);
		if (res.route.path === '/:(*)') {
			this.emit('forcePush', {
				fullPath: res._parsedRoute.fullPath,
				onInit: false,
			});
		} else {
			this.navigate(res);
			this.emit('push', {
				beforeFullPath,
				fullPath: res._parsedRoute.fullPath,
				route: res.route,
				props: res.props,
			});
		}
	}

	/** どうしても必要な場合に使用（パスが確定している場合は `Nirax.replace` を使用すること） */
	public replaceByPath(fullPath: string) {
		const res = this.resolveForNavigation(fullPath);
		if (res.route.path === '/:(*)') {
			this.emit('forceReplace', {
				fullPath: res._parsedRoute.fullPath,
				onInit: false,
			});
		} else {
			this.navigate(res);
			this.emit('replace', {
				fullPath: res._parsedRoute.fullPath,
			});
		}
	}
}
