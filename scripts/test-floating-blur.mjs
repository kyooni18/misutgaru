/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Exercise the actual picker dialog, picker template/styles and modal together.
// Stub account data and emoji painting only; geometry and carousel remain real.
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
	'@/preferences.js': `import {reactive,toRefs} from 'vue';const s=reactive({animation:false,menuStyle:'floating',emojiPickerStyle:'auto',useProgressiveBlurForModal:true,emojiPickerScale:3,emojiPickerWidth:3,emojiPickerHeight:3});export const prefer={s,r:toRefs(s)};`,
	'@/os.js': 'export const claimZIndex=()=>100;',
	'@/utility/touch.js': 'export const isTouchUsing=true;',
	'@/utility/device-kind.js': 'export const deviceKind="smartphone";',
	'@/utility/focus-trap.js': 'export const focusTrap=()=>({release(){}});',
	'@/utility/focus.js': 'export const focusParent=()=>{};',
	'@/i18n.js': 'export const i18n={ts:{search:"Search",settings:"Settings",pinned:"Pinned",emoji:"Emoji"}};',
	'@/store.js': `import {ref} from 'vue';export const store={r:{recentlyUsedEmojis:ref([])}};`,
	'@/custom-emojis.js': `import {ref} from 'vue';export const customEmojiCategories=ref([]),customEmojis=ref([]),customEmojisMap=new Map();`,
	'@/i.js': 'export const $i=null;',
	'@/router.js': 'export const useRouter=()=>({});',
	'@/utility/haptic.js': 'export const haptic=()=>{};',
	'@/utility/check-reaction-permissions.js': 'export const checkReactionPermissions=()=>true;',
	'@/utility/emoji-search-indexes.js': `import {ref} from 'vue';export const loadBundledEmojiIndexes=()=>{},unicodeEmojiSearchIndexes=ref({}),normalizeEmojiQuery=s=>s;`,
	'@/components/MkRippleEffect.vue': 'export default {};',
	'@@/js/emojilist.js': `export const emojilist=Array.from({length:240},(_,i)=>({char:String.fromCodePoint(0x1f600+i),name:'emoji'+i}));export const unicodeEmojiCategories=['face','people'];export const emojiCharByCategory=new Map(unicodeEmojiCategories.map(c=>[c,emojilist]));export const getEmojiName=s=>s,getUnicodeEmoji=s=>({char:s,name:s});`,
};
const entry = `
import {createApp,h,nextTick} from 'vue';
import Picker from '/src/components/MkEmojiPickerDialog.vue';
import {prefer} from '@/preferences.js';
const app=createApp({setup:()=>()=>h(Picker,{anchorElement:document.querySelector('#anchor'),pinnedEmojis:['👍','❤️','😆','🤔','😮','🎉','💢','😰','😇','🍮']})});
app.component('MkEmoji',{props:['emoji'],setup:props=>()=>h('span',{},props.emoji)});
app.component('MkCustomEmoji',{setup:()=>()=>h('span',{},'🙂')});
app.directive('hotkey',{}).directive('tooltip',{}).mount('#app');
window.fixture={async anchor(top){document.querySelector('#anchor').style.top=top;window.dispatchEvent(new Event('resize'));await nextTick();},async drawer(){prefer.s.emojiPickerStyle='drawer';await nextTick();}};`;
const html = `<style>
body{margin:0;font-family:sans-serif;--MI-margin:10px;--MI-radius:12px;--MI_THEME-panel:white;--MI_THEME-fg:#333;--MI_THEME-accent:#5b7b87;background:repeating-linear-gradient(90deg,#ccc 0 4px,#fff 4px 8px)}
#anchor{position:fixed;left:70%;top:65%;width:40px;height:40px}
._popup{background:white;border-radius:var(--MI-radius)}._button{border:0;background:none;color:inherit;cursor:pointer}
._modalBg{position:fixed;inset:0}
</style><button id="anchor">+</button><div id="app"></div><script type="module" src="/__picker_entry.js"></script>`;
const server = await createServer({
	configFile: false, root: frontend, logLevel: 'error',
	plugins: [{
		name: 'real-floating-picker-fixture', enforce: 'pre',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url !== '/__picker_test') return next();
				res.setHeader('Content-Type', 'text/html'); res.end(html);
			});
		},
		resolveId(id, importer) {
			if (id === '/__picker_entry.js') return '\0picker-entry';
			if (Object.hasOwn(stubs, id)) return `\0picker-stub:${id}`;
			if (id.startsWith('@/')) return this.resolve(path.join(frontend, 'src', id.slice(2)), importer);
		},
		load(id) {
			if (id === '\0picker-entry') return entry;
			if (id.startsWith('\0picker-stub:')) return stubs[id.slice('\0picker-stub:'.length)];
		},
	}, vue()],
	resolve: { alias: { vue: path.join(frontend, 'node_modules/vue/dist/vue.esm-bundler.js') } },
	server: { host: '127.0.0.1', port: 0, hmr: false },
});

async function checkPicker(page) {
	await page.waitForFunction(() => {
		const picker = document.querySelector('.omfetrab');
		if (!picker) return false;
		const rect = picker.getBoundingClientRect();
		const style = getComputedStyle(picker);
		const anchor = document.querySelector('#anchor').getBoundingClientRect();
		return (rect.bottom <= anchor.top || rect.top >= anchor.bottom) && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
			&& parseFloat(style.borderBottomLeftRadius) > 0 && parseFloat(style.borderBottomRightRadius) > 0;
	}, null, { timeout: 5000 });
	const bands = await page.locator('[data-progressive-blur]').evaluateAll(roots => {
		const viewport = roots.find(el => getComputedStyle(el).position === 'fixed');
		return Array.from(viewport.children).map(el => ({ mask: getComputedStyle(el).maskImage, filter: getComputedStyle(el).backdropFilter }));
	});
	assert.equal(bands[0].mask, 'none', 'Viewport blur covers the anchor too');
	assert(bands[0].filter.startsWith('blur('));
	assert(bands.every(band => !band.mask.includes('linear-gradient')), 'No anchor cutout');
	assert.equal(await page.locator('#anchor').evaluate(el => el.style.pointerEvents), '', 'Anchor styling remains untouched');
}

try {
	await server.listen();
	for (const [name, engine] of Object.entries({ chromium, webkit })) {
		const browser = await engine.launch();
		try {
			const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__picker_test`);
			await checkPicker(page);
			await page.evaluate(() => window.fixture.anchor('15%'));
			await checkPicker(page);
			await page.setViewportSize({ width: 320, height: 568 });
			await checkPicker(page);
			await page.locator('.categoryButton').nth(1).click();
			await page.waitForFunction(() => {
				const pane = document.querySelector('.categoryPaneActive');
				const rect = pane.getBoundingClientRect();
				const carousel = pane.parentElement.getBoundingClientRect();
				return pane.dataset.pickerCategoryIndex === '1' && pane.scrollHeight > pane.clientHeight
					&& getComputedStyle(pane).filter === 'none' && Math.abs(rect.left + rect.width / 2 - carousel.left - carousel.width / 2) < 1;
			}, null, {timeout:5000});
			assert(await page.locator('.categoryPaneActive').evaluate(async el => {
				el.scrollTop = el.scrollHeight;
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				return el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
			}), 'Actual emoji category can scroll to its last row');
			await page.screenshot({ path: `/tmp/misutgaru-picker-${name}.png` });
			assert.deepEqual(errors, []);
			console.log(`${name}: real picker bounds, four rounded corners, category scrolling and blur without anchor cutout PASS`);
		} finally { await browser.close(); }
	}
} finally { await server.close(); }
