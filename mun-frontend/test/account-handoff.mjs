/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountHandoff } from '../src/services/account-handoff.mjs';

test('account handoff fetches the account, preserves existing entries, and reloads', async () => {
  const events=[];const existing=[['example.com',{id:'old',username:'old'}]];
  const login=createAccountHandoff({host:'example.com',fetch:async(url,options)=>{events.push(['fetch',url,options]);return {status:200,json:async()=>({id:'new',username:'alice',name:'Alice'})}},storage:{setItem:(...x)=>events.push(['storage',...x])},registry:{add:async(...x)=>events.push(['registry',...x])},preferences:{getAccounts:()=>existing,setAccounts:value=>events.push(['preferences',value])},syncServiceWorkerAccounts:()=>events.push(['sync']),reload:redirect=>events.push(['reload',redirect])});
  await login('token'); await Promise.resolve();
  assert.deepEqual(events[0],['fetch','/api/i',{method:'POST',body:'{"i":"token"}',headers:{'Content-Type':'application/json'}}]);
  assert.deepEqual(JSON.parse(events[1][2]),{id:'new',username:'alice',name:'Alice',token:'token'});assert.equal(events[1][1],'account');
  assert.deepEqual(events[2],['registry','example.com/new',{id:'new',username:'alice',name:'Alice'},'token']);
  assert.deepEqual(events[3],['preferences',[...existing,['example.com',{id:'new',username:'alice'}]]]);assert.ok(events.some(e=>e[0]==='sync'));assert.ok(events.some(e=>e[0]==='reload'));
});

test('account handoff avoids duplicate registry entries and does not write on fetch failure', async () => {
  const events=[];let response={status:200,json:async()=>({id:'x',username:'alice'})};
  const login=createAccountHandoff({host:'example.com',fetch:async()=>response,storage:{setItem:()=>events.push('storage')},registry:{add:()=>events.push('registry')},preferences:{getAccounts:()=>[['example.com',{id:'x',username:'alice'}]],setAccounts:()=>events.push('preferences')},syncServiceWorkerAccounts:()=>events.push('sync'),reload:path=>events.push(['reload',path]),onAccountError:error=>events.push(['error',error])});
  await login('token','/home');assert.deepEqual(events,['storage',['reload','/home']]);events.length=0;
  response={status:403,json:async()=>({error:{id:'revoked'}})};await assert.rejects(login('token'), error => error.cause?.id === 'revoked');assert.deepEqual(events,[['error',{id:'revoked'}]]);events.length=0;
  response={status:503,json:async()=>{throw new Error('should not parse')}};await assert.rejects(login('token'));assert.deepEqual(events,[]);
});
