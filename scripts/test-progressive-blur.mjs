/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Exercises the real popup, blur package and motion runtime without a backend.
// Run: node scripts/test-progressive-blur.mjs --browser=all
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = fileURLToPath(new URL('../packages/frontend/', import.meta.url));
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { createServer } = await import(requireFrontend.resolve('vite'));
const { default: vue } = await import(requireFrontend.resolve('@vitejs/plugin-vue'));
const browsers = requireFrontend('playwright');
const selected = process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1] ?? 'chromium';
assert(['all', 'chromium', 'webkit'].includes(selected), 'Use --browser=chromium, webkit or all');

// Only network/account services and leaf widgets are stubbed. The animation
// implementation, Vue lifecycle, Mun host and motion preferences remain real.
const stubs = {
	'@/preferences.js': `import {reactive,toRef} from 'vue';
		const s=reactive({animation:true}); export const prefer={s,r:{animation:toRef(s,'animation')}};`,
	'@/os.js': 'export const claimZIndex=()=>100; export const popupMenu=()=>Promise.resolve();',
	'@/utility/misskey-api.js': 'export const misskeyApi=()=>Promise.resolve({});',
	'@/utility/get-user-menu.js': 'export const getUserMenu=()=>({menu:[],cleanup(){}});',
	'@/filters/number.js': 'export default value=>value;',
	'@/filters/user.js': 'export const userPage=()=>"/user";',
	'@/i18n.js': 'export const i18n={ts:{}};',
	'@/i.js': 'export const $i=null;',
	'@/utility/isFfVisibleForMe.js': 'export const isFollowingVisibleForMe=()=>true; export const isFollowersVisibleForMe=()=>true;',
	'@/utility/media-proxy.js': 'export const getStaticImageUrl=value=>value;',
	'misskey-js': 'export const acct={parse:()=>({})};',
};
const entry = `
import {createApp,h,ref,nextTick} from 'vue';
import Popup from '/src/components/MkUserPopup.vue';
import {initializeMotionRuntime} from '/src/motion/runtime.ts';
import {prefer} from '@/preferences.js';
initializeMotionRuntime();
const showing=ref(true);
window.blurTest={
	closeCount:0,
	async toggle(value){showing.value=value;await nextTick();},
	async preference(value){prefer.s.animation=value;await nextTick();},
	state(){
		const pbe=document.querySelector('.pbe');
		const shell=pbe.parentElement;
		const band=pbe.querySelector('.pbe-blur');
		const style=getComputedStyle(band);
		return {
			blur:parseFloat(style.backdropFilter.match(/[\\d.]+/)?.[0]??'0'),
			duration:parseFloat(style.transitionDuration),
			opacity:getComputedStyle(shell).opacity,
			contentOpacity:getComputedStyle(pbe.querySelector('.pbe-content')).opacity,
			display:getComputedStyle(shell).display,
			animations:document.getAnimations().length,
			closeCount:this.closeCount,
		};
	},
	async sample(ms=650){
		const samples=[{t:0,...this.state()}],start=performance.now();
		while(performance.now()-start<ms){
			await new Promise(requestAnimationFrame);
			samples.push({t:performance.now()-start,...this.state()});
		}
		return samples;
	},
};
createApp({setup:()=>()=>h(Popup,{
	showing:showing.value,
	q:{id:'test',description:'Blur regression',notesCount:1,followingCount:2,followersCount:3},
	source:{getBoundingClientRect:()=>({left:200,top:150}),offsetWidth:300,offsetHeight:30},
	onClosed:()=>window.blurTest.closeCount++,
})}).mount('#app');
// Start sampling in the mount task, before the first animation frame.
window.blurTest.initial=window.blurTest.sample();
`;
const html = `<style>
body { margin:0; background:repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px);
	--MI-durFast:var(--MI-motion-duration-feedback); --MI-dur:var(--MI-motion-duration-control);
	--MI-easeOut:var(--MI-motion-ease-standard); }
.mkup-card { background:#eee; min-height:180px; }
</style><div id="app"></div><script type="module" src="/__blur_entry.js"></script>`;
const server = await createServer({
	configFile: false,
	root: frontend,
	logLevel: 'error',
	plugins: [{
		name: 'progressive-blur-regression-fixture',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url !== '/__blur_test') return next();
				res.setHeader('Content-Type', 'text/html');
				res.end(html);
			});
		},
		resolveId(id, importer) {
			if (id === '/__blur_entry.js') return '\0blur-entry.js';
			if (Object.hasOwn(stubs, id)) return `\0blur-stub:${id}`;
			if (importer?.endsWith('MkUserPopup.vue')) {
				if (id.endsWith('.mun')) return '\0blur-card.js';
				if (id.startsWith('@/components/')) return '\0blur-leaf.js';
			}
		},
		async load(id) {
			if (id === '\0blur-entry.js') return entry;
			if (id.startsWith('\0blur-stub:')) return stubs[id.slice('\0blur-stub:'.length)];
			if (id === '\0blur-card.js') return readFile(path.join(frontend, 'src/components/MkUserPopupCard.mun'), 'utf8');
			if (id === '\0blur-leaf.js') return `import {h} from 'vue'; export default {
				inheritAttrs:false,setup:(_,ctx)=>()=>h('span',{},ctx.slots.default?.())};`;
		},
	}, vue()],
	resolve: {
		alias: {
			vue: path.join(frontend, 'node_modules/vue/dist/vue.esm-bundler.js'),
			'@mun/vue': path.join(frontend, 'node_modules/@mun/vue/dist/index.js'),
			'@mun/core/compat': path.join(frontend, 'node_modules/@mun/core/dist/compat.js'),
			'@misutgaru/progressive-blur-element': path.resolve(frontend, '../progressive-blur-element/src/index.ts'),
		},
	},
	server: { host: '127.0.0.1', port: 0, hmr: false },
});

function verifyTrajectory(samples, target, direction) {
	const values = samples.map(sample => sample.blur);
	assert(new Set(values.filter(value => value > 0.02 && value < target - 0.02)).size >= 2,
		`${direction}: expected multiple intermediate blur values`);
	assert(samples.every(sample => sample.opacity === '1'), `${direction}: ancestor must stay opaque`);
	const final = samples.at(-1);
	assert.equal(final.blur, direction === 'leave' ? 0 : target);
	assert.equal(final.animations, 0, 'No idle animation after settling');
	assert.equal(final.display === 'none', direction === 'leave');
	return samples.filter((_, index) => index % Math.max(1, Math.floor(samples.length / 6)) === 0)
		.map(({ t, blur, display }) => ({ ms: Math.round(t), blur, display }));
}

async function edgeContrast(page) {
	const box = await page.locator('.pbe').boundingBox();
	const png = await page.screenshot({ clip: { x: box.x - 10, y: box.y + 40, width: 8, height: 8 } });
	return page.evaluate(async data => {
		const image = new Image();
		image.src = `data:image/png;base64,${data}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d');
		context.drawImage(image, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		const values = Array.from({ length: pixels.length / 4 }, (_, index) => pixels[index * 4]);
		const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
		return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
	}, png.toString('base64'));
}

try {
	await server.listen();
	const url = `http://127.0.0.1:${server.httpServer.address().port}/__blur_test`;
	for (const name of selected === 'all' ? ['chromium', 'webkit'] : [selected]) {
		const browser = await browsers[name].launch();
		try {
			const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(url);
			await page.waitForFunction(() => window.blurTest?.initial);
			const initial = await page.evaluate(() => window.blurTest.initial);
			assert.equal(initial[0].blur, 0, 'Initial paint starts sharp');
			const target = initial.at(-1).blur;
			assert(target > 0, 'Final blur must be nonzero');
			console.log(name, 'enter', verifyTrajectory(initial, target, 'enter'));
			if (name === 'chromium') {
				const blurred = await edgeContrast(page);
				await page.locator('.pbe').evaluate(pbe => { pbe.parentElement.style.opacity = '0.999'; });
				const isolated = await edgeContrast(page);
				await page.locator('.pbe').evaluate(pbe => { pbe.parentElement.style.removeProperty('opacity'); });
				assert(blurred < isolated / 2, 'Rendered blur must sample the page outside the card');
				console.log(name, 'pixel contrast', { blurred, isolated });
			}

			const leave = await page.evaluate(async () => {
				await window.blurTest.toggle(false);
				return window.blurTest.sample();
			});
			console.log(name, 'leave', verifyTrajectory(leave, target, 'leave'));
			assert(leave.some(s => s.t > 150 && s.blur > 0 && s.display !== 'none'), 'Exit must not truncate the blur spring');
			assert.equal(leave.at(-1).closeCount, 1);

			const reopen = await page.evaluate(async () => {
				await window.blurTest.toggle(true);
				return window.blurTest.sample();
			});
			verifyTrajectory(reopen, target, 'reopen');
			const rapid = await page.evaluate(async () => {
				const jumps = [];
				for (const value of [false, true, false, true]) {
					const before = window.blurTest.state().blur;
					await window.blurTest.toggle(value);
					jumps.push(Math.abs(window.blurTest.state().blur - before));
					await new Promise(resolve => setTimeout(resolve, 35));
				}
				return { jumps, samples: await window.blurTest.sample() };
			});
			// A style flush can advance WebKit's animation clock slightly. Reject
			// endpoint jumps while allowing that small amount of elapsed motion.
			assert(rapid.jumps.every(jump => jump < target * 0.1), `Retargeting must preserve the current blur: ${JSON.stringify(rapid.jumps)}`);
			assert.equal(rapid.samples.at(-1).blur, target);
			assert.equal(rapid.samples.at(-1).display, 'block');
			assert.equal(rapid.samples.at(-1).closeCount, 1, 'Cancelled leave must not emit closed');
			assert.equal(rapid.samples.at(-1).animations, 0);

			await page.emulateMedia({ reducedMotion: 'reduce' });
			// matchMedia's change event is asynchronous in WebKit.
			await page.waitForFunction(() => window.blurTest.state().duration === 0);
			await page.evaluate(async () => {
				await window.blurTest.toggle(false);
				await new Promise(resolve => setTimeout(resolve, 40));
			});
			assert.equal((await page.evaluate(() => window.blurTest.state())).duration, 0);
			const reduced = await page.evaluate(async () => {
				await window.blurTest.toggle(true);
				return window.blurTest.sample(150);
			});
			assert(reduced.every(s => Math.abs(s.blur) < 0.00001 || Math.abs(s.blur - target) < 0.00001),
				`Reduced motion must snap without intermediate blur: ${JSON.stringify(reduced)}`);
			assert.equal(reduced.at(-1).blur, target);
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.waitForFunction(() => window.blurTest.state().duration > 0);
			await page.evaluate(() => window.blurTest.preference(false));
			assert.equal((await page.evaluate(() => window.blurTest.state())).duration, 0);
			assert.equal((await page.evaluate(() => window.blurTest.state())).blur, 0);
			assert.deepEqual(errors, []);
			console.log(`${name}: initial, enter, leave, reopen, rapid reversal, reduced motion and preference PASS`);
		} finally {
			await browser.close();
		}
	}
} finally {
	await server.close();
}
