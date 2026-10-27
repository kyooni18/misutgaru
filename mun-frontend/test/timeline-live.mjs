/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimelineLive } from '../src/services/timeline-live.mjs';

function events() {
  const callbacks = new Map();
  return { visibilityState:'visible', addEventListener:(name, fn) => callbacks.set(name,fn), removeEventListener:(name, fn) => { if (callbacks.get(name) === fn) callbacks.delete(name); }, fire:name => callbacks.get(name)?.(), count:() => callbacks.size };
}
function fixture(options = {}) {
  const document = events(), scrollContainer = events(), counts = [], channels = [];
  let items = [{id:'02'}], top = true, onNote, disposed = 0, callback, interval, cleared = 0;
  const stream = { useChannel(name, params) { channels.push([name,params]); return { on(event, fn) { assert.equal(event,'note'); onNote = fn; }, dispose() { disposed++; } }; } };
  const controller = createTimelineLive({ api:options.api, stream, params:{withRenotes:true,withReplies:false}, realtime:options.realtime ?? true, pollingInterval:options.pollingInterval, initialLoading:options.initialLoading, getItems:()=>items, setItems:next=>{items=next;}, setQueuedCount:n=>counts.push(n), isTop:()=>top, document, scrollContainer, setTimer:(fn,ms)=>{callback=fn;interval=ms;return 1;}, clearTimer:()=>{cleared++;} });
  controller.start();
  return { controller, document, scrollContainer, channels, counts, note:n=>onNote(n), items:()=>items, replace:v=>{items=v;}, top:v=>{top=v;}, tick:()=>callback(), interval:()=>interval, disposed:()=>disposed, cleared:()=>cleared };
}

test('live local notes queue while away and release without duplicates', () => {
  const f=fixture();
  assert.deepEqual(f.channels,[['localTimeline',{withRenotes:true,withReplies:false}]]);
  f.note({id:'03'}); assert.deepEqual(f.items().map(x=>x.id),['03','02']);
  f.top(false); f.note({id:'04'}); f.note({id:'05'}); assert.equal(f.counts.at(-1),2);
  f.top(true); f.scrollContainer.fire('scroll'); assert.deepEqual(f.items().map(x=>x.id),['05','04','03','02']);
  f.document.visibilityState='hidden'; f.note({id:'06'}); assert.equal(f.counts.at(-1),1);
  f.document.visibilityState='visible'; f.document.fire('visibilitychange'); assert.deepEqual(f.items().map(x=>x.id),['06','05','04','03','02']);
  f.note({id:'06'}); assert.equal(f.items().length,5);
  f.controller.dispose(); f.note({id:'07'}); assert.equal(f.items().length,5); assert.equal(f.disposed(),1); assert.equal(f.document.count(),0); assert.equal(f.scrollContainer.count(),0);
});

test('polling advances from the queue and ignores results after disposal', async () => {
  const requests=[]; let resolve;
  const api={ post:async(endpoint,data)=>{requests.push([endpoint,data]);return new Promise(r=>{resolve=r;});} };
  const f=fixture({api,realtime:false,pollingInterval:1}); assert.equal(f.interval(),22500);
  f.top(false); const first=f.tick(); await f.tick(); assert.equal(requests.length,1);
  assert.deepEqual(requests[0],['notes/local-timeline',{withRenotes:true,withReplies:false,limit:30,sinceId:'02'}]);
  resolve([{id:'03'},{id:'04'}]); await first; assert.equal(f.counts.at(-1),2);
  const second=f.tick(); assert.equal(requests[1][1].sinceId,'04');
  f.controller.dispose(); resolve([{id:'05'}]); await second;
  assert.deepEqual(f.items().map(x=>x.id),['02']); assert.equal(f.cleared(),1); assert.equal(f.counts.at(-1),0);
});


test('initial page cannot overwrite streamed notes received during its fetch', () => {
  const f=fixture({initialLoading:true});
  f.note({id:'03'}); f.note({id:'04'});
  f.scrollContainer.fire('scroll'); assert.equal(f.counts.at(-1),2);
  f.replace([{id:'05'},{id:'03'},{id:'02'}]);
  f.controller.finishInitial();
  assert.deepEqual(f.items().map(x=>x.id),['05','04','03','02']);
  assert.equal(f.counts.at(-1),0);
  f.controller.dispose();
});

test('initial notes stay queued while hidden and polling waits for initialization', async () => {
  const hidden=fixture({initialLoading:true});
  hidden.document.visibilityState='hidden'; hidden.note({id:'03'});
  hidden.replace([{id:'04'},{id:'02'}]); hidden.controller.finishInitial();
  assert.equal(hidden.counts.at(-1),1);
  hidden.document.visibilityState='visible'; hidden.document.fire('visibilitychange');
  assert.deepEqual(hidden.items().map(x=>x.id),['04','03','02']); hidden.controller.dispose();
  let calls=0;
  const polling=fixture({initialLoading:true,realtime:false,api:{post:async()=>{calls++;return [];}}});
  await polling.tick(); assert.equal(calls,0);
  polling.controller.finishInitial(); await polling.tick(); assert.equal(calls,1); polling.controller.dispose();
});
