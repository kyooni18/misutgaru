/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, webkit, expect } from '@playwright/test';

test('timeline controller uses the real SDK channel and disconnects on disposal', async () => {
  const entry = `import Stream from 'misskey-js/streaming.js';import {createTimelineLive} from '/src/services/timeline-live.mjs';
    const stream=new Stream(location.origin,null);let items=[{id:'02'}],top=true,count=0;const requests=[];
    const scroll=document.querySelector('#scroll');
    const live=createTimelineLive({stream,api:{post:async(endpoint,data)=>{requests.push([endpoint,data]);return [];}},params:{withRenotes:true,withReplies:false},initialLoading:true,getItems:()=>items,setItems:v=>{items=v},setQueuedCount:v=>{count=v},isTop:()=>top,document,scrollContainer:scroll});
    live.start();window.fixture={items:()=>items,requests:()=>requests,count:()=>count,top:v=>{top=v},initial:v=>{items=v;live.finishInitial()},scroll:()=>scroll.dispatchEvent(new Event('scroll')),dispose:()=>live.dispose(),close:()=>stream.close()};`;
  const plugin={name:'timeline-live-browser',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<div id="scroll"></div><script type="module" src="/entry.js"></script>');});},resolveId(id){if(id==='/entry.js')return '\0entry';},load(id){if(id==='\0entry')return entry;}};
  const root=fileURLToPath(new URL('..',import.meta.url)), cacheDir=mkdtempSync(join(tmpdir(),'mun-live-browser-'));
  const server=await createServer({root,cacheDir,configFile:false,plugins:[plugin],server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const browser=await (process.env.TIMELINE_BROWSER==='webkit'?webkit:chromium).launch();
  try {
    const page=await browser.newPage();const messages=[];let socket,channelId;
    await page.routeWebSocket('**/streaming?*',ws=>{socket=ws;ws.onMessage(raw=>{const msg=JSON.parse(raw);messages.push(msg);if(msg.type==='connect')channelId=msg.body.id;});});
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    await page.waitForFunction(()=>window.fixture);
    await expect.poll(()=>channelId).toBeTruthy();
    assert.deepEqual(messages[0].body,{channel:'localTimeline',id:channelId,params:{withRenotes:true,withReplies:false}});
    const send=id=>socket.send(JSON.stringify({type:'channel',body:{id:channelId,type:'note',body:{id}}}));
    send('03');await expect.poll(()=>page.evaluate(()=>window.fixture.count())).toBe(1);
    await page.evaluate(()=>window.fixture.initial([{id:'04'},{id:'02'}]));
    await expect.poll(()=>page.evaluate(()=>window.fixture.items().map(x=>x.id))).toEqual(['04','03','02']);
    await expect.poll(()=>page.evaluate(()=>window.fixture.requests().length)).toBe(1);
    assert.equal((await page.evaluate(()=>window.fixture.requests()))[0][1].sinceId,'04');
    await page.evaluate(()=>window.fixture.top(false));send('05');
    await expect.poll(()=>page.evaluate(()=>window.fixture.count())).toBe(1);
    await page.evaluate(()=>{window.fixture.top(true);window.fixture.scroll();});
    await expect.poll(()=>page.evaluate(()=>window.fixture.items().map(x=>x.id))).toEqual(['05','04','03','02']);
    await socket.close({code:1012,reason:'test reconnect'});
    await expect.poll(()=>messages.filter(x=>x.type==='connect').length,{timeout:15000}).toBe(2);
    await expect.poll(()=>page.evaluate(()=>window.fixture.requests().length)).toBe(2);
    assert.equal((await page.evaluate(()=>window.fixture.requests()))[1][1].sinceId,'05');
    send('06');await expect.poll(()=>page.evaluate(()=>window.fixture.items().map(x=>x.id))).toEqual(['06','05','04','03','02']);
    await page.evaluate(()=>window.fixture.dispose());
    await expect.poll(()=>messages.some(x=>x.type==='disconnect'&&x.body.id===channelId)).toBe(true);
    send('07');await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>window.fixture.items().map(x=>x.id)),['06','05','04','03','02']);
    await page.evaluate(()=>window.fixture.close());await page.close();
  } finally {await browser.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
});
