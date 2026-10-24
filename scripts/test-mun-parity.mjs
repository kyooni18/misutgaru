/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Renders the Vue-template baseline (from git, default HEAD) and the current
// Mün-backed shell of the sidebar and post form with identical stubs, then
// requires identical normalized DOM.
// Run: node scripts/test-mun-parity.mjs [--base=<git rev>]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const frontend = path.join(root, 'packages/frontend/');
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { createServer } = await import(requireFrontend.resolve('vite'));
const { default: vue } = await import(requireFrontend.resolve('@vitejs/plugin-vue'));
const { chromium } = requireFrontend('playwright');
const base = process.argv.find(arg => arg.startsWith('--base='))?.split('=')[1] ?? 'HEAD';

const targets = {
	navbar: 'src/ui/_common_/navbar.vue',
};
const baseline = Object.fromEntries(Object.entries(targets).map(([name, file]) => [
	path.join(frontend, file.replace(/\.vue$/, '.__base.vue')),
	execFileSync('git', ['show', `${base}:packages/frontend/${file}`], { cwd: root, encoding: 'utf8' }),
]));

const stubs = {
	'@/os.js': 'export const post=()=>{}; export const popupMenu=()=>Promise.resolve(); export const popupAsyncWithDialog=()=>Promise.resolve({dispose(){}}); export const claimZIndex=()=>100;',
	'@/navbar.js': `import {ref} from 'vue'; export const navbarItemDef={
		notifications:{title:'Notifications',icon:'ti ti-bell',to:'/my/notifications',indicated:true,indicateValue:'3'},
		drive:{title:'Drive',icon:'ti ti-cloud',to:'/my/drive'},
		search:{title:'Search',icon:'ti ti-search',action:()=>{},indicated:true},
		hidden:{title:'Hidden',icon:'ti ti-x',to:'/x',show:ref(false)},
		unused:{title:'Unused',icon:'ti ti-x',to:'/u',indicated:true}};`,
	'@/store.js': `import {ref} from 'vue'; const r={realtimeMode:ref(false),menuDisplay:ref('sideFull')};
		export const store={r,s:{get realtimeMode(){return r.realtimeMode.value}},set(k,v){r[k].value=v}};`,
	'@/i18n.js': 'export const i18n={ts:new Proxy({},{get:(_,k)=>String(k)}),tsx:new Proxy({},{get:(_,k)=>()=>String(k)})};',
	'@/instance.js': 'export const instance={name:"Inst",iconUrl:null};',
	'@/router.js': 'export const useRouter=()=>({useListener(){},push(){}});',
	'@/preferences.js': `import {ref,reactive} from 'vue'; const r={menu:ref(['notifications','-','drive','search','hidden']),showNavbarSubButtons:ref(true),animation:ref(true)};
		export const prefer={r,s:reactive({animation:true}),model:()=>ref(null),commit(){}};`,
	'@/accounts.js': 'export const getAccountMenu=async()=>[];',
	'@/i.js': 'export const $i={id:"me",username:"me",isAdmin:true};',
	'./common.js': 'export const openInstanceMenu=()=>{};',
	'@/directives/tooltip.js': 'export const tooltipDirective={mounted(el,b){el.setAttribute("data-tip",b.value+JSON.stringify(b.modifiers))}};',
};
const leaves = ['MkA', 'MkAvatar', 'MkAcct'];

const entry = `
import {createApp,h,nextTick} from 'vue';
import {tooltipDirective} from '@/directives/tooltip.js';
${Object.keys(targets).map(name => `import ${name}Base from '/${targets[name].replace(/\.vue$/, '.__base.vue')}';
import ${name}Next from '/${targets[name]}';`).join('\n')}
import MkA from '\0parity-leaf:MkA'; import MkAvatar from '\0parity-leaf:MkAvatar'; import MkAcct from '\0parity-leaf:MkAcct';
const leaves={MkA,MkAvatar,MkAcct};
function mount(component,props){
	const el=document.createElement('div'); document.body.append(el);
	const app=createApp({render:()=>h(component,props)});
	app.directive('tooltip',tooltipDirective);
	for(const [n,c] of Object.entries(leaves)) app.component(n,c);
	app.mount(el); return el;
}
const normalize=el=>el.innerHTML
	.replace(/ data-v-[\\w-]+(="")?/g,'')
	.replace(/<!--[\\s\\S]*?-->/g,'')
	.replace(/_([A-Za-z]+)_[\\w-]{5}_\\d+/g,'$1')
	.replace(/>\\s+</g,'><');
window.parity={};
${Object.keys(targets).map(name => `for (const props of window.cases_${name}) {
	const a=mount(${name}Base,props), b=mount(${name}Next,props);
	await nextTick(); await new Promise(requestAnimationFrame); await nextTick();
	(window.parity.${name} ??= []).push([normalize(a),normalize(b)]);
}`).join('\n')}
window.parityDone=true;
`;
const cases = {
	navbar: [{}, { showWidgetButton: true }, { asDrawer: true }],
};
const html = `<div></div><script>${Object.entries(cases).map(([n, c]) => `window.cases_${n}=${JSON.stringify(c)};`).join('')}</script><script type="module" src="/__parity_entry.js"></script>`;

const server = await createServer({
	configFile: false,
	root: frontend,
	logLevel: 'error',
	plugins: [{
		name: 'mun-parity-fixture',
		enforce: 'pre',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url !== '/__parity') return next();
				res.setHeader('Content-Type', 'text/html');
				res.end(html);
			});
		},
		async resolveId(id, importer) {
			if (id === '/__parity_entry.js') return '\0parity-entry.js';
			if (Object.hasOwn(stubs, id)) return `\0parity-stub:${id}`;
			if (id.startsWith('\0parity-leaf:')) return id;
			const leaf = leaves.find(n => id.endsWith(`/${n}.vue`));
			if (leaf) return `\0parity-leaf:${leaf}`;
			if (id.endsWith('.__base.vue')) return path.join(frontend, id);
			if (id.endsWith('.mun')) return path.resolve(path.dirname(importer), id) + '.js';
			if (id.startsWith('@/')) return this.resolve(path.join(frontend, 'src', id.slice(2)).replace(/\.js$/, '.ts'), importer, { skipSelf: true });
		},
		async load(id) {
			if (id === '\0parity-entry.js') return entry;
			if (id.startsWith('\0parity-stub:')) return stubs[id.slice('\0parity-stub:'.length)];
			if (id.startsWith('\0parity-leaf:')) {
				const tag = { MkA: 'a', MkAvatar: 'img', MkAcct: 'span' }[id.slice('\0parity-leaf:'.length)];
				return `import {h} from 'vue'; export default {inheritAttrs:false,props:['to','activeClass','exact','user'],
					setup:(p,{slots,attrs})=>()=>h('${tag}',{...attrs,href:p.to,'data-user':p.user?.id,class:[attrs.class,p.to==='/'&&p.activeClass]},slots.default?.())};`;
			}
			if (Object.hasOwn(baseline, id)) return baseline[id];
			if (id.endsWith('.mun.js')) return readFile(id.slice(0, -3), 'utf8');
		},
	}, vue()],
	resolve: {
		alias: {
			vue: path.join(frontend, 'node_modules/vue/dist/vue.esm-bundler.js'),
			'@mun/vue': path.join(frontend, 'node_modules/@mun/vue/dist/index.js'),
			'@mun/core/compat': path.join(frontend, 'node_modules/@mun/core/dist/compat.js'),
		},
	},
	server: { host: '127.0.0.1', port: 0, hmr: false },
});

let failed = false;
try {
	await server.listen();
	const browser = await chromium.launch();
	for (const width of [1400, 1000]) {
		const page = await browser.newPage({ viewport: { width, height: 800 } });
		const errors = [];
		page.on('pageerror', error => errors.push(error.message));
		page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
		page.on('response', res => { if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`); });
		await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__parity`);
		await page.waitForFunction(() => window.parityDone, null, { timeout: 30000 }).catch(() => {});
		assert.deepEqual(errors, [], `page errors at ${width}px`);
		const results = await page.evaluate(() => window.parity);
		for (const [name, pairs] of Object.entries(results)) {
			pairs.forEach(([a, b], index) => {
				if (a === b) { console.log(`PASS ${name} case ${index} @${width}px`); return; }
				failed = true;
				let i = 0; while (a[i] === b[i]) i++;
				console.log(`FAIL ${name} case ${index} @${width}px at ${i}\n  base: ${a.slice(Math.max(0, i - 120), i + 200)}\n  next: ${b.slice(Math.max(0, i - 120), i + 200)}`);
			});
		}
		await page.close();
	}
	await browser.close();
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
