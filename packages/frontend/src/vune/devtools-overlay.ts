/* SPDX-License-Identifier: AGPL-3.0-only */

import {
	getVuneDevtoolsSnapshot,
	getVuneBoundaryElement,
	resetVuneDevtools,
	setVuneDevtoolsEnabled,
	subscribeVuneDevtools,
} from '@vune-ui/web';

const storageKey = 'misutgaru:vune-devtools';
let installed = false;

export function installVuneDevtools(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	const params = new URLSearchParams(window.location.search);
	let visible = params.get('vune-devtools') === '1' || window.localStorage.getItem(storageKey) === '1';
	setVuneDevtoolsEnabled(visible);

	const host = window.document.createElement('div');
	host.dataset.vuneDevtools = 'root';
	host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#eee;pointer-events:none;';
	const shadow = host.attachShadow({ mode: 'open' });
	const panel = window.document.createElement('div');
	panel.style.cssText = 'width:min(520px,calc(100vw - 24px));max-height:min(60vh,620px);overflow:auto;background:rgba(18,18,22,.92);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.35);padding:10px;pointer-events:auto;';
	shadow.append(panel);
	window.document.documentElement.append(host);

	const escape = (value: string): string => value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!);
	const render = (): void => {
		host.style.display = visible ? 'block' : 'none';
		if (!visible) return;
		const snapshot = getVuneDevtoolsSnapshot();
		const byKey = new Map(snapshot.boundaries.map(boundary => [boundary.key, boundary] as const));
		const depthOf = (key: string): number => {
			let depth = 0;
			let parent = byKey.get(key)?.parentKey;
			const seen = new Set<string>();
			while (parent && !seen.has(parent) && depth < 12) { seen.add(parent); depth += 1; parent = byKey.get(parent)?.parentKey; }
			return depth;
		};
		const rows = snapshot.boundaries.slice(0, 40).map(boundary => {
			const average = boundary.renderCount === 0 ? 0 : boundary.totalDurationMs / boundary.renderCount;
			const indent = '&nbsp;'.repeat(depthOf(boundary.key) * 2);
			return `<tr><td>${indent}${escape(boundary.name)}</td><td>${boundary.renderCount}</td><td>${average.toFixed(2)}</td><td>${boundary.maxDurationMs.toFixed(2)}</td><td>${boundary.dependencyCount}</td><td>${boundary.nodeCount}</td><td>${boundary.mode}</td><td><button data-inspect="${escape(boundary.key)}">inspect</button></td></tr>`;
		}).join('');
		panel.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><strong style="font-size:13px">Vune DevTools</strong><span style="opacity:.65">rev ${snapshot.revision} · ${snapshot.boundaries.length} boundaries</span><span style="flex:1"></span><button data-action="reset">reset</button><button data-action="close">close</button></div><table style="width:100%;border-collapse:collapse"><thead><tr><th>View</th><th>renders</th><th>avg ms</th><th>max ms</th><th>deps</th><th>nodes</th><th>mode</th><th></th></tr></thead><tbody>${rows}</tbody></table><div style="opacity:.55;margin-top:7px">Ctrl/⌘ + Shift + V toggles this panel</div>`;
		for (const cell of panel.querySelectorAll('td,th')) (cell as HTMLElement).style.cssText = 'text-align:left;padding:3px 5px;border-bottom:1px solid rgba(255,255,255,.07);white-space:nowrap;';
		for (const button of panel.querySelectorAll('button')) (button as HTMLElement).style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.08);border:0;border-radius:6px;padding:3px 7px;cursor:pointer;';
	};

	const setVisible = (next: boolean): void => {
		visible = next;
		setVuneDevtoolsEnabled(next);
		if (next) window.localStorage.setItem(storageKey, '1'); else window.localStorage.removeItem(storageKey);
		render();
	};

	let highlighted: HTMLElement | null = null;
	let highlightTimer: number | null = null;
	panel.addEventListener('click', event => {
		const target = event.target as HTMLElement | null;
		const action = target?.dataset.action;
		if (action === 'close') setVisible(false);
		if (action === 'reset') resetVuneDevtools();
		const inspectKey = target?.dataset.inspect;
		if (inspectKey) {
			const element = getVuneBoundaryElement(inspectKey) as HTMLElement | null;
			if (!element) return;
			if (highlighted) highlighted.style.removeProperty('outline');
			if (highlightTimer !== null) window.clearTimeout(highlightTimer);
			highlighted = element;
			element.style.setProperty('outline', '2px solid #ff4fd8', 'important');
			element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			highlightTimer = window.setTimeout(() => {
				element.style.removeProperty('outline');
				if (highlighted === element) highlighted = null;
				highlightTimer = null;
			}, 1400);
		}
	});
	window.addEventListener('keydown', event => {
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
			event.preventDefault();
			setVisible(!visible);
		}
	});
	const unsubscribe = subscribeVuneDevtools(render);
	window.addEventListener('pagehide', unsubscribe, { once: true });
	render();
}
