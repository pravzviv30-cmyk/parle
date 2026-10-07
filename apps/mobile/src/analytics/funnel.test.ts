import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor as new (...args:string[]) => (...args:unknown[])=>Promise<unknown>;

test('restore and the return from the wall each carry one event the parser and the trigger accept',async()=>{
 const production=read('../purchases/restore.ts').slice(read('../purchases/restore.ts').indexOf('export async function restorePurchases'));
 const js=stripTypeScriptTypes(production.replace('export ',''));
 const events: unknown[]=[];
 const bindings={userId:'owner',scopeGeneration:()=>5,trackProductEvent:async(event:unknown,expected:unknown)=>{events.push({event,expected});},purchases:{restore:async(id:string)=>{assert.equal(id,'owner');return {ok:true};}},settleStoreAction:async(_id:string,operation:()=>Promise<unknown>)=>{await operation();return {kind:'nothing-granted'};}};
 const outcome=await new AsyncFunction(...Object.keys(bindings),js+"\nreturn restorePurchases(userId,'wall');")(...Object.values(bindings));
 assert.deepEqual(outcome,{kind:'nothing-granted'});
 assert.deepEqual(events,[{event:{name:'restore_started',properties:{entry:'wall'}},expected:{userId:'owner',generation:5}},{event:{name:'restore_settled',properties:{entry:'wall',outcome:'nothing-granted'}},expected:{userId:'owner',generation:5}}]);
 const wall=read('../wall/WallScreen.tsx');
 const leave=wall.slice(wall.indexOf('  const leave = '),wall.indexOf('  const back = '));
 const exits:string[]=[];const wallEvents:unknown[]=[];
 const world={left:{current:false},user:{id:'owner'},entry:'refused',granted:true,confirmedGrant:{canStart:true},scopeGeneration:()=>5,trackProductEvent:(event:unknown)=>wallEvents.push(event),onStartSpeaking:()=>exits.push('speak'),onLeave:()=>exits.push('back')};
 const fn=new Function(...Object.keys(world),stripTypeScriptTypes(leave)+"\nleave('speak');leave('back');");fn(...Object.values(world));
 assert.deepEqual(exits,['speak']); assert.deepEqual(wallEvents,[{name:'wall_left',properties:{entry:'refused',outcome:'granted',destination:'speak'}}]);
 assert.match(wall,/onPress=\{\(\) => leave\('speak'\)\}/);assert.match(wall,/onPress=\{unavailable \? \(\) => leave\('back', onOpenPractice\) : \(\) => leave\(\)\}/);assert.match(wall,/onLeave=\{\(\) => leave\(\)\}/);
 const parser=read('../../../../services/token-server/src/productEvents.ts');
 const migration=read('../../../../supabase/migrations/20261002192210_consented_product_funnel.sql');
 for (const name of ['restore_started','restore_settled','wall_left']) { assert.ok(parser.includes(`'${name}'`));assert.ok(migration.includes(`'${name}'`)); }
});

test('late restore evidence and a switched account never reach analytics',async()=>{
 const source=read('track.ts'); const js=stripTypeScriptTypes(source.slice(source.indexOf('export async function trackProductEvent')).replace('export ',''));
 let generation=1;let uid='owner';let release!:()=>void;
 const held=new Promise<unknown>(resolve=>{release=()=>resolve({allowed:true});});
 const sent:unknown[]=[];
 const bindings={scopeGeneration:()=>generation,activeUserId:()=>uid,auth:{getSession:async()=>({id:'owner'})},authHeaders:async()=>({authorization:'Bearer owner'}),loadConsent:()=>held,analyticsAllowed:(value:unknown)=>typeof value==='object'&&value!==null&&'allowed' in value&&value.allowed===true,TOKEN_SERVER:'https://api.invalid',fetch:async(_url:unknown,options:unknown)=>{sent.push(options);return new Response();},event:{name:'restore_settled',properties:{entry:'wall',outcome:'done'}},expected:{userId:'owner',generation:1}};
 const run=new AsyncFunction(...Object.keys(bindings),js+'\nreturn trackProductEvent(event,expected);');
 const pending=run(...Object.values(bindings));generation=2;uid='next';release();await pending;assert.deepEqual(sent,[]);
 // Account is already switched before an old operation dispatches its event.
 const next={...bindings,auth:{getSession:async()=>({id:'next'})},authHeaders:async()=>({authorization:'Bearer next'}),loadConsent:async()=>({allowed:true})};
 await run(...Object.values(next));assert.deepEqual(sent,[]);
 const current={...next,expected:{userId:'next',generation:2}};
 await run(...Object.values(current));assert.equal(sent.length,1,'current owned evidence should still work');
});

test('the store never waits for analytics, while settlement evidence follows its start',async()=>{
 const source=read('../purchases/restore.ts');const js=stripTypeScriptTypes(source.slice(source.indexOf('export async function restorePurchases')).replace('export ',''));
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});const events:string[]=[];
 const world={userId:'owner',scopeGeneration:()=>1,trackProductEvent:async(event:{name:string})=>{events.push(event.name);if(event.name==='restore_started')await held;},purchases:{restore:async()=>({ok:true})},settleStoreAction:async(_user:string,operation:()=>Promise<unknown>)=>{await operation();return {kind:'nothing-granted'};}};
 const outcome=await new AsyncFunction(...Object.keys(world),js+"\nreturn restorePurchases(userId,'settings');")(...Object.values(world));
 assert.deepEqual(outcome,{kind:'nothing-granted'});assert.deepEqual(events,['restore_started']);
 release();await Promise.resolve();await Promise.resolve();assert.deepEqual(events,['restore_started','restore_settled']);
});
