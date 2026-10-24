/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Renders the Vue-template baseline (from git, default HEAD) and the current
// Mün-backed shell of the sidebar and post form with identical stubs, then
// requires pixel-identical screenshots (and identical typing behavior).
// Run: node scripts/test-mun-parity.mjs (PARITY_SHOTS=<dir> keeps screenshots)
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
const { munPlugin } = await import(path.join(frontend, 'node_modules/@mun/vite/dist/index.js'));
const { chromium } = requireFrontend('playwright');

// Baselines are the last revisions rendered by a plain Vue template.
const targets = {
	navbar: 'src/ui/_common_/navbar.vue',
	postForm: 'src/components/MkPostForm.vue',
};
const baseRevisions = {
	navbar: '3102f2fbc~1',
	postForm: '11c668a13~1',
};
const baseline = Object.fromEntries(Object.entries(targets).map(([name, file]) => [
	path.join(frontend, file.replace(/\.vue$/, '.__base.vue')),
	execFileSync('git', ['show', `${baseRevisions[name]}:packages/frontend/${file}`], { cwd: root, encoding: 'utf8' }),
]));

// Absorbs any property access or call for services whose behavior does not affect markup.
const any = 'const any=new Proxy(function(){},{get:(_,k)=>k===Symbol.toPrimitive?()=>"":k==="then"?undefined:any,apply:()=>any,construct:()=>any});';
const anyExports = names => `${any} export const ${names.map(n => `${n}=any`).join(',')};`;
const stubs = {
	'@/os.js': 'export const api=()=>Promise.resolve(); export const post=()=>{}; export const popupMenu=()=>Promise.resolve(); export const popupAsyncWithDialog=()=>Promise.resolve({dispose(){}}); export const claimZIndex=()=>100;',
	'@/navbar.js': `import {ref} from 'vue'; export const navbarItemDef={
		notifications:{title:'Notifications',icon:'ti ti-bell',to:'/my/notifications',indicated:true,indicateValue:'3'},
		drive:{title:'Drive',icon:'ti ti-cloud',to:'/my/drive'},
		search:{title:'Search',icon:'ti ti-search',action:()=>{},indicated:true},
		hidden:{title:'Hidden',icon:'ti ti-x',to:'/x',show:ref(false)},
		unused:{title:'Unused',icon:'ti ti-x',to:'/u',indicated:true}};`,
	'@/store.js': `import {ref} from 'vue'; const r={realtimeMode:ref(false),menuDisplay:ref('sideFull'),tips:ref({postForm:false}),postFormWithHashtags:ref(true),postFormHashtags:ref('tag')};
		export const store={r,s:{get realtimeMode(){return r.realtimeMode.value},showPreview:true,visibility:'public',localOnly:false,reactionAcceptance:null},set(k,v){r[k].value=v},model:k=>r[k]};`,
	'@/i18n.js': `const ts=new Proxy({},{get:(_,k)=>String(k).startsWith('_')?new Proxy({},{get:(_,k2)=>String(k2)}):String(k)});
		export const i18n={ts,tsx:new Proxy({},{get:(_,k)=>()=>String(k)})};`,
	'@/instance.js': 'export const instance={name:"Inst",iconUrl:null};',
	'@/router.js': 'export const useRouter=()=>({useListener(){},push(){}});',
	'@/preferences.js': `import {ref,reactive} from 'vue'; const r={menu:ref(['notifications','-','drive','search','hidden']),showNavbarSubButtons:ref(true),animation:ref(true)};
		export const prefer={r,s:reactive({animation:true,defaultNoteLocalOnly:false,defaultNoteVisibility:'public',enableQuickAddMfmFunction:true,keepCw:false,rememberNoteVisibility:false}),model:()=>ref(null),commit(){}};`,
	'@/accounts.js': 'export const getAccountMenu=async()=>[]; export const getAccounts=async()=>[];',
	'@/i.js': 'export const $i={id:"me",username:"me",isAdmin:true,avatarUrl:"/a.png"}; export const ensureSignin=()=>$i; export const notesCount=0; export const incNotesCount=()=>{};',
	// A large intrinsic size catches images that are not constrained to their slot.
	'@/instance.js': `export const instance={name:"Inst",maxNoteTextLength:120,iconUrl:${JSON.stringify('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#2a6"/><circle cx="256" cy="256" r="200" fill="#fd3"/></svg>'))}};`,
	'@@/js/config.js': 'export const host="example.com",url="https://example.com";',
	'@/local-storage.js': 'export const miLocalStorage={getItem:k=>k==="hashtags"?JSON.stringify(["a","b"]):null,setItem(){},removeItem(){},getItemAsJson:()=>null,setItemAsJson(){}};',
	'@/plugin.js': 'export const getPluginHandlers=()=>[{}];',
	'@/events.js': 'export const globalEvents={on(){},off(){},emit(){}};',
	'@/composables/use-uploader.js': `import {ref} from 'vue'; ${any} export const useUploader=()=>new Proxy({items:ref([])},{get:(t,k)=>k in t?t[k]:any});`,
	'@/directives/click-anime.js': 'export const clickAnimeDirective={mounted(el){el.setAttribute("data-click-anime","")}};',
	'@/utility/autocomplete.js': anyExports(['Autocomplete']),
	'@/utility/misskey-api.js': anyExports(['misskeyApi']),
	'@/utility/drive.js': anyExports(['chooseDriveFile']),
	'@/utility/achievements.js': anyExports(['claimAchievement']),
	'@/utility/emoji-picker.js': anyExports(['emojiPicker']),
	'@/utility/mfm-function-picker.js': anyExports(['mfmFunctionPicker']),
	'@/drag-and-drop.js': anyExports(['checkDragDataType', 'getDragData']),
	'@/utility/tour.js': anyExports(['startTour']),
	'@/tips.js': anyExports(['closeTip']),
	'./common.js': 'export const openInstanceMenu=()=>{};',
	'@/directives/tooltip.js': 'export const tooltipDirective={mounted(el,b){el.setAttribute("data-tip",b.value+JSON.stringify(b.modifiers))}};',
};
const leaves = ['MkA', 'MkAvatar', 'MkAcct', 'MkUploaderItems', 'MkNotePreview', 'MkPostFormAttaches', 'MkPostForm.TextCounter',
	'MkPollEditor', 'MkNoteSimple', 'MkInfo', 'MkRippleEffect', 'MkEllipsis', 'MkTime', 'I18n', 'MkTip'];

// One page per (target, case, variant) so fixed-position parts never overlap.
const entry = `
import {createApp,h,nextTick} from 'vue';
import '/src/style.scss';
import {tooltipDirective} from '@/directives/tooltip.js';
import {clickAnimeDirective} from '@/directives/click-anime.js';
${leaves.map(n => `import ${n.replace('.', '_')} from '\\0parity-leaf:${n}';`).join('\n')}
const leaves={${leaves.map(n => n.replace('.', '_')).join(',')}};
const components={${Object.keys(targets).map(name => `${name}:{base:()=>import('/${targets[name].replace(/\.vue$/, '.__base.vue')}'),next:()=>import('/${targets[name]}')}`).join(',')}};
const q=new URLSearchParams(location.search);
const component=(await components[q.get('target')][q.get('variant')]()).default;
const props=window.cases[q.get('target')][Number(q.get('case'))];
const el=document.getElementById('app');
const app=createApp({render:()=>h(component,props)});
app.directive('tooltip',tooltipDirective); app.directive('click-anime',clickAnimeDirective);
for(const [n,c] of Object.entries(leaves)) app.component(n,c);
app.mount(el);
await nextTick(); await new Promise(requestAnimationFrame); await nextTick();
window.parityReady=true;
window.typeInto=async()=>{const t=el.querySelector('textarea'); if(!t) return null; t.value='x'.repeat(40); t.dispatchEvent(new Event('input')); await nextTick(); await nextTick(); await new Promise(requestAnimationFrame); return t.value;};
`;
const cases = {
	navbar: [{}, { showWidgetButton: true }, { asDrawer: true }],
	postForm: [{}, { fixed: true }, { initialText: 'hello', initialCw: 'cw' }, { initialVisibility: 'specified', initialLocalOnly: true },
		{ channel: { id: 'c', name: 'Channel', color: '#f00' } }],
};
// Visible stand-ins for theme colors so layout differences show up as pixels.
const theme = `--MI_THEME-navBg:#e8ecf4;--MI_THEME-navFg:#333;--MI_THEME-navActive:#2550c0;--MI_THEME-navIndicator:#e33;--MI_THEME-accent:#3b6fe0;
	--MI_THEME-fg:#222;--MI_THEME-fgHighlighted:#000;--MI_THEME-fgOnAccent:#fff;--MI_THEME-indicator:#e33;--MI_THEME-divider:#bbb;--MI-hairline:#ccc;
	--MI_THEME-panel:#fff;--MI_THEME-bg:#fafafa;--MI_THEME-focus:#36f;--MI_THEME-buttonBg:#ddd;--MI_THEME-warn:#c80;--MI_THEME-error:#d22;
	--MI_THEME-accentedBg:#dfe8ff;--MI_THEME-inputBorder:#bbb;--MI-margin:16px;--MI-dur:0s;--MI-durFast:0s;--MI-easeOut:linear;`;
const html = `<link rel="stylesheet" href="/node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css">
<style>:root{${theme}} body{margin:0;background:#fff;font:14px/1.5 sans-serif;} #app{position:relative;height:760px;display:flex;}
*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important;}</style>
<div id="app"></div><script>window.cases=${JSON.stringify(cases)};</script><script type="module" src="/__parity_entry.js"></script>`;

const server = await createServer({
	configFile: false,
	root: frontend,
	logLevel: 'error',
	plugins: [{
		name: 'mun-parity-fixture',
		enforce: 'pre',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url.split('?')[0] !== '/__parity') return next();
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
			if (id.startsWith('@/')) return this.resolve(path.join(frontend, 'src', id.slice(2)).replace(/\.js$/, '.ts'), importer, { skipSelf: true });
		},
		async load(id) {
			if (id === '\0parity-entry.js') return entry;
			if (id.startsWith('\0parity-stub:')) return stubs[id.slice('\0parity-stub:'.length)];
			if (id.startsWith('\0parity-leaf:')) {
				const name = id.slice('\0parity-leaf:'.length);
				const tag = { MkA: 'a', MkAvatar: 'img', MkAcct: 'span' }[name] ?? `x-${name.replace('.', '-').toLowerCase()}`;
				// Props become data-* so differing values show up in the DOM comparison.
				return `import {h} from 'vue'; export default {inheritAttrs:false,props:['to','activeClass','exact','user'],
					setup:(p,{slots,attrs})=>()=>h('${tag}',{
						...Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k.startsWith('on')?k:k==='class'||k==='style'?k:'data-'+k.toLowerCase(),typeof v==='object'&&v!==null&&k!=='style'&&k!=='class'?JSON.stringify(v):v])),
						href:p.to,'data-user':p.user?.id,class:[attrs.class,p.to==='/'&&p.activeClass]},
						Object.entries(slots).map(([n,s])=>n==='default'?s():h('x-slot',{name:n},s())))};`;
			}
			if (Object.hasOwn(baseline, id)) return baseline[id];
		},
	}, munPlugin({ include: /\.mun(\?.*)?$/ }), vue()],
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
	const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
	const browser = await chromium.launch();
	const shots = process.env.PARITY_SHOTS;
	async function render(target, index, variant, width, typed) {
		const page = await browser.newPage({ viewport: { width, height: 800 } });
		const errors = [];
		page.on('pageerror', error => errors.push(error.message));
		page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
		page.on('response', res => { if (res.status() >= 400 && !/\.(woff2?|ico|png)(\?|$)/.test(res.url())) errors.push(`${res.status()} ${res.url()}`); });
		page.on('response', res => { if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`); });
		await page.goto(`${origin}/__parity?target=${target}&case=${index}&variant=${variant}`);
		await page.waitForFunction(() => window.parityReady, null, { timeout: 30000 }).catch(() => errors.push('timeout'));
		await page.evaluate(() => document.fonts.ready);
		const value = typed ? await page.evaluate(() => window.typeInto()) : null;
		if (process.env.PARITY_DUMP) console.log(`--- ${variant}\n` + await page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => { const s = getComputedStyle(e); return e.outerHTML.slice(0, 300) + " :: " + [s.borderTop, s.borderBottom, s.height, s.marginTop, s.marginBottom, s.borderLeft].join(" | "); }).join('\n'), process.env.PARITY_DUMP));
		const png = await page.screenshot();
		if (shots) await page.screenshot({ path: path.join(shots, `${target}-${index}-${width}${typed ? '-typed' : ''}-${variant}.png`) });
		await page.close();
		assert.deepEqual(errors, [], `${variant} ${target} case ${index}`);
		return { png, value };
	}
	const diffPage = await browser.newPage();
	// Count differing pixels between two same-size screenshots.
	const diff = (a, b) => diffPage.evaluate(async ([a, b]) => {
		const load = async data => { const i = new Image(); i.src = `data:image/png;base64,${data}`; await i.decode(); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
		const [p, q] = await Promise.all([load(a), load(b)]);
		let n = 0; for (let k = 0; k < p.length; k += 4) if (Math.abs(p[k] - q[k]) + Math.abs(p[k + 1] - q[k + 1]) + Math.abs(p[k + 2] - q[k + 2]) > 24) n++;
		return n;
	}, [a.toString('base64'), b.toString('base64')]);
	for (const width of [1400, 1000]) {
		for (const [target, list] of Object.entries(cases)) {
			for (let index = 0; index < list.length; index++) {
				if (process.env.PARITY_ONLY && process.env.PARITY_ONLY !== `${target}:${index}:${width}`) continue;
				for (const typed of target === 'postForm' ? [false, true] : [false]) {
					const base = await render(target, index, 'base', width, typed);
					const next = await render(target, index, 'next', width, typed);
					const pixels = await diff(base.png, next.png);
					const ok = pixels === 0 && base.value === next.value;
					if (!ok) failed = true;
					console.log(`${ok ? 'PASS' : 'FAIL'} ${target} case ${index}${typed ? ' typed' : ''} @${width}px${ok ? '' : ` (${pixels} px differ${base.value === next.value ? '' : ', textarea value differs'})`}`);
				}
			}
		}
	}
	await browser.close();
} finally {
	await server.close();
}
process.exit(failed ? 1 : 0);
