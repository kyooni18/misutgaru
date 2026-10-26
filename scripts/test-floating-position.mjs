/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Real modal/submenu positioning with deliberately oversized, scrollable content.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = fileURLToPath(new URL('../packages/frontend/', import.meta.url));
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { createServer } = await import(requireFrontend.resolve('vite'));
const { default: vue } = await import(requireFrontend.resolve('@vitejs/plugin-vue'));
const { chromium, webkit } = requireFrontend('playwright');
const stubs = {
	'@/i18n.js': 'export const i18n={ts:{}};',
	'@/preferences.js': 'export const prefer={s:{animation:false,menuStyle:"floating",useProgressiveBlurForModal:false}};',
	'@/os.js': 'export const claimZIndex=()=>100;',
	'@/utility/touch.js': 'export const isTouchUsing=true;',
	'@/utility/device-kind.js': 'export const deviceKind="smartphone";',
	'@/utility/focus-trap.js': 'export const focusTrap=()=>({release(){}});',
	'@/utility/focus.js': 'export const focusParent=()=>{};',
};
const entry = `
import {createApp,h,nextTick} from 'vue';
import Modal from '/src/components/MkModal.vue';
import Child from '/src/components/MkMenu.child.vue';
const anchor=document.querySelector('#anchor');
const root=document.querySelector('#parent');
const slot=()=>h('div',{class:'surface',id:'picker'},Array.from({length:100},(_,i)=>h('p',{},'Item '+i)));
createApp({setup:()=>()=>h(Modal,{anchorElement:anchor,preferType:'floating'}, {default:slot})}).directive('hotkey',{}).mount('#modal');
createApp({setup:()=>()=>h(Child,{anchorElement:root,rootElement:root,items:[]})}).mount('#child');
window.fixture={
 async viewport(width,height,left=0,top=0){
  const viewport=new EventTarget();Object.assign(viewport,{width,height,offsetLeft:left,offsetTop:top});
  Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
  window.dispatchEvent(new Event('resize'));await nextTick();
 },
};`;
const html = `<style>
body{margin:0;--MI-margin:10px;--MI_THEME-modalBg:transparent}
#anchor{position:fixed;left:70%;top:30%;width:40px;height:40px}
#parent{position:fixed;right:10px;top:20%;width:200px;height:40px}
#child{position:fixed;right:10px;top:20%;width:200px}
.surface{box-sizing:border-box;width:700px;height:1000px;max-width:var(--MI-popup-max-width);max-height:var(--MI-popup-max-height);overflow:auto;background:white}
._modalBg{position:fixed;inset:0}
</style><button id="anchor">+</button><div id="parent"></div><div id="modal"></div><div id="child"></div><script type="module" src="/__position_entry.js"></script>`;
const server = await createServer({
	configFile: false, root: frontend, logLevel: 'error',
	plugins: [{
		name: 'floating-position-fixture', enforce: 'pre',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url !== '/__position_test') return next();
				res.setHeader('Content-Type', 'text/html'); res.end(html);
			});
		},
		resolveId(id, importer) {
			if (id === '/__position_entry.js') return '\0position-entry';
			if (Object.hasOwn(stubs, id)) return `\0stub:${id}`;
			if (id.includes('MkMenu.vue')) return '\0menu';
			if (id.startsWith('@/')) return this.resolve(path.join(frontend, 'src', id.slice(2)), importer);
		},
		load(id) {
			if (id === '\0position-entry') return entry;
			if (id.startsWith('\0stub:')) return stubs[id.slice('\0stub:'.length)];
			if (id === '\0menu') return `import{h}from'vue';export default{setup:()=>()=>h('div',{class:'surface',id:'submenu'},Array.from({length:100},(_,i)=>h('p',{},'Submenu '+i)))}`;
		},
	}, vue()],
	resolve: { alias: { vue: path.join(frontend, 'node_modules/vue/dist/vue.esm-bundler.js') } },
	server: { host: '127.0.0.1', port: 0, hmr: false },
});

async function check(page, width, height, left = 0, top = 0) {
	await page.waitForFunction(() => window.fixture);
	await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
	await page.waitForFunction(({ width, height, left, top }) => ['picker', 'submenu'].every(id => {
		const el = document.getElementById(id);
		if (!el) return false;
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0 && rect.left >= left && rect.top >= top && rect.right <= left + width && rect.bottom <= top + height;
	}), { width, height, left, top }, {timeout:5000});
	for (const id of ['picker', 'submenu']) {
		assert(await page.locator(`#${id}`).evaluate(async el => {
			el.scrollTop = el.scrollHeight;
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			return el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
		}), `${id}: final content must be reachable by scrolling`);
	}
}

try {
	await server.listen();
	for (const [name, engine] of Object.entries({ chromium, webkit })) {
		const browser = await engine.launch();
		try {
			const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__position_test`);
			await check(page, 390, 844);
			await page.setViewportSize({ width: 320, height: 568 });
			await check(page, 320, 568);
			// Model the keyboard/zoom visual viewport independently of layout viewport.
			await page.evaluate(() => window.fixture.viewport(280, 280, 20, 60));
			await check(page, 280, 280, 20, 60);
			assert.deepEqual(errors, []);
			console.log(`${name}: oversized modal/submenu, resize, offset visual viewport and final scroll content PASS`);
		} finally { await browser.close(); }
	}
} finally { await server.close(); }
