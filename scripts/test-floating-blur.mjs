/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Render the actual floating backdrop over a stripe chart. Pixel contrast catches
// misplaced/ineffective masks that checking backdrop-filter strings cannot.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = fileURLToPath(new URL('../packages/frontend/', import.meta.url));
const requireFrontend = createRequire(path.join(frontend, 'package.json'));
const { createServer } = await import(requireFrontend.resolve('vite'));
const { default: vue } = await import(requireFrontend.resolve('@vitejs/plugin-vue'));
const browsers = requireFrontend('playwright');
const entry = `
import {createApp,h,reactive,nextTick} from 'vue';
import Backdrop from '/src/components/MkFloatingBackdrop.vue';
const state=reactive({hole:{left:80,top:300,width:230,height:44,radius:8},blur:true});
window.fixture={async update(value){Object.assign(state,value);await nextTick();}};
createApp({setup:()=>()=>h(Backdrop,state)}).mount('#app');`;
const server = await createServer({
	configFile: false,
	root: frontend,
	logLevel: 'error',
	plugins: [{
		name: 'floating-blur-fixture',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				if (req.url !== '/__floating_test') return next();
				res.setHeader('Content-Type', 'text/html');
				res.end(`<style>body{margin:0;--MI_THEME-modalBg:#0008}.chart{position:fixed;inset:0;background:repeating-linear-gradient(90deg,#111 0 4px,#fff 4px 8px)}</style><div class="chart"></div><div id="app"></div><script type="module" src="/__floating_entry.js"></script>`);
			});
		},
		resolveId(id) { if (id === '/__floating_entry.js') return '\0floating-entry'; },
		load(id) { if (id === '\0floating-entry') return entry; },
	}, vue()],
	resolve: { alias: { vue: path.join(frontend, 'node_modules/vue/dist/vue.esm-bundler.js') } },
	server: { host: '127.0.0.1', port: 0, hmr: false },
});

async function contrast(page, y) {
	const png = await page.screenshot({ clip: { x: 176, y, width: 32, height: 8 } });
	return page.evaluate(async data => {
		const image = new Image();
		image.src = `data:image/png;base64,${data}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d');
		context.drawImage(image, 0, 0);
		const pixels = context.getImageData(0, 0, image.width, image.height).data;
		const values = Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4]);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
	}, png.toString('base64'));
}

try {
	await server.listen();
	for (const name of ['chromium', 'webkit']) {
		const browser = await browsers[name].launch();
		try {
			const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__floating_test`);
			await page.locator('[data-progressive-blur] > div').last().waitFor();
			const center = await contrast(page, 316);
			const near = await contrast(page, 252);
			const middle = await contrast(page, 204);
			const far = await contrast(page, 100);
			assert(center > 115, `${name}: pressed control must remain sharp (${center})`);
			// This macOS headless WebKit also omits an unmasked backdrop-filter
			// from screenshots. Verify its CSS contract; enforce rendered pixels in Chromium.
			if (name === 'chromium') {
				assert(near > middle + 10 && middle > far + 10,
					`${name}: blur must increase with distance: ${JSON.stringify({ near, middle, far })}`);
			}
			const radii = await page.locator('[data-progressive-blur] > div').evaluateAll(els =>
				els.slice(1).map(el => parseFloat(getComputedStyle(el).backdropFilter.match(/[\d.]+/)[0])));
			assert.deepEqual(radii, [0.5, 1, 2, 3]);
			await page.evaluate(() => window.fixture.update({ hole: { left: 80, top: 100, width: 230, height: 44, radius: 8 } }));
			assert(await contrast(page, 116) > 115, `${name}: clear region must follow the anchor`);
			await page.setViewportSize({ width: 430, height: 932 });
			await page.evaluate(() => window.fixture.update({ hole: { left: 80, top: 600, width: 230, height: 44, radius: 8 } }));
			assert(await contrast(page, 616) > 115, `${name}: resized viewport must retain alignment`);
			await page.locator('[data-progressive-blur]').evaluate(el => el.style.setProperty('--MI-fade', '0'));
			assert(await contrast(page, 100) > 115, `${name}: zero fade must remove dim and blur`);
			await page.locator('[data-progressive-blur]').evaluate(el => el.style.removeProperty('--MI-fade'));
			await page.evaluate(() => window.fixture.update({ blur: false }));
			assert(await contrast(page, 100) > 90, `${name}: disabling blur must restore distant detail`);
			assert.deepEqual(errors, []);
			console.log(`${name}: sharp anchor, blur bands, relocation, resize and disabled blur PASS${name === 'chromium' ? ' (pixel falloff verified)' : ' (falloff pixels unavailable in headless WebKit)'}`, { center, near, middle, far });
		} finally {
			await browser.close();
		}
	}
} finally {
	await server.close();
}
