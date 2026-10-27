// SPDX-FileCopyrightText: Misutgaru contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { munPlugin } from '@mun/vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const renderer = fileURLToPath(new URL('../../packages/frontend-shared/js/mfm-renderer.ts', import.meta.url));
const plugin = {
  name: 'mfm-parity-fixture', enforce: 'pre',
  configureServer(server) { server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/fixture') return next();
    res.setHeader('content-type', 'text/html');
    res.end('<div id="app"></div><script type="module" src="/fixture.js"></script>');
  }); },
  resolveId(id, importer) {
    if (id === 'mfm-js') return fileURLToPath(import.meta.resolve('mfm-js'));
    if (id === '/fixture.js' || id === 'misskey-js' || id === './config.js' && importer?.includes('mfm-renderer')) return '\0fixture:' + id;
  },
  load(id) {
    if (id === '\0fixture:misskey-js') return 'export const nyaize = x => x';
    if (id.startsWith('\0fixture:') && id.endsWith('/config.js')) return 'export const host = "example.test"';
    if (id === '\0fixture:/fixture.js') return `
      import { createApp } from 'vue';
      import { mount } from '@mun/web';
      import { renderMfm } from '/src/components/mfm.mjs';
      import fixture from '/test/fixtures/MfmFixture.mun';
      import { createMfmRenderer } from '/@fs/${renderer}';
      const q = new URLSearchParams(location.search);
      const text = q.get('text'); const plain = q.has('plain');
      if (q.has('vue')) {
        const components = Object.fromEntries(['Url','Link','Mention','A','Time','Emoji','CustomEmoji'].map(x => [x, { template:'<span><slot/></span>' }]));
        createApp(createMfmRenderer({ components: () => components, getOptions: () => ({ advancedMfm: true, animatedMfm: !q.has('noanim') }) }), { text, plain }).mount('#app');
      } else mount(q.has('mun') ? fixture : renderMfm(text, { plain, animatedMfm: !q.has('noanim') }), document.querySelector('#app'));
    `;
  },
};

test('native MFM structural subset matches Vue and treats text as untrusted', async () => {
  const server = await createServer({ root, configFile: false, plugins: [plugin, munPlugin()], server: { host: '127.0.0.1', port: 0, fs: { allow: [root, fileURLToPath(new URL('../..', import.meta.url)), realpathSync(fileURLToPath(import.meta.resolve('@mun/web')))] } } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e); }); page.setDefaultTimeout(5000);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/fixture`;
    for (const [text, plain] of [['Hello **bold** and ~~gone~~\n`code` <img src=x onerror=alert(1)>', false], ['Hello\n**bold**', true], ['> quote\n> two', false], ['$[x2 big] $[fg.color=bad000 red] $[flip.v flip] $[rotate.deg=30 turn] $[scale.x=8,y=2 wide] $[border.width=2,style=dashed,color=abc box]', false], ['$[font.serif serif] $[blur hidden] $[spin.x,left,speed=2s turn] $[jump leap] $[bounce.delay=1s hop]', false], ['$[tada wow] $[jelly jelly] $[twitch twitch] $[shake shake] $[rainbow color]', false]]) {
      const q = new URLSearchParams({ text }); if (plain) q.set('plain', '1');
      await page.goto(`${url}?${q}&vue=1`);
      await page.waitForSelector('#app span');
      const html = () => page.locator('#app').evaluate(el => { const clone = el.cloneNode(true); for (const node of clone.querySelectorAll('[style]')) node.setAttribute('style', node.style.cssText); return clone.innerHTML; });
      const reference = await html();
      await page.goto(`${url}?${q}`);
      await page.waitForSelector('#app span');
      assert.equal(await html(), reference);
      assert.equal(await page.locator('img').count(), 0);
    }
    const noanim = new URLSearchParams({ text: '$[spin turn] $[jump leap] $[rainbow color]', noanim: '1' });
    await page.goto(`${url}?${noanim}&vue=1`);
    await page.waitForSelector('#app span span');
    const refStyles = await page.locator('#app span span').evaluateAll(nodes => nodes.map(node => node.style.cssText));
    await page.goto(`${url}?${noanim}`);
    await page.waitForSelector('#app span span');
    assert.deepEqual(await page.locator('#app span span').evaluateAll(nodes => nodes.map(node => node.style.cssText)), refStyles);
    await page.goto(`${url}?mun=1`);
    await page.waitForSelector('#app b');
    assert.equal(await page.locator('#app b').innerText(), 'bold');
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForSelector('#app b:text-is("strong")');
    const links = new URLSearchParams({ text: `[external](https://example.org/path) [local](${url}/local) [bad](javascript:alert(1)) #tag` });
    await page.goto(`${url}?${links}`);
    await page.waitForSelector('#app a');
    assert.equal(await page.getByRole('link', { name: 'external' }).getAttribute('target'), '_blank');
    assert.equal(await page.getByRole('link', { name: 'external' }).getAttribute('rel'), 'nofollow noopener');
    assert.equal(await page.getByRole('link', { name: 'local' }).getAttribute('href'), '/fixture/local');
    assert.equal(await page.getByRole('link', { name: '#tag' }).getAttribute('href'), '/tags/tag');
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
