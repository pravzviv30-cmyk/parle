import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildConversationPack, phraseKeyOf } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadDeck } from '../review/store.ts';
import { refreshConversationPacks, loadConversationPacks, loadConversationPackForLearner, replaceConversationPacks, deleteConversationPackForLearner } from './store.ts';
const disk=new Map<string,string>();
let refuse='';
const storage=AsyncStorage as unknown as Record<string,unknown>;
storage.getItem=async(key:string)=>disk.get(key)??null;
storage.setItem=async(key:string,value:string)=>{if(refuse&&key.endsWith(`.${refuse}`))throw new Error('disk full');disk.set(key,value);};
storage.removeItem=async(key:string)=>{disk.delete(key);};
const adapter={kind:'supabase',getAccessToken:async()=>'fixture-token'} as unknown as AuthAdapter;
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const word=(n:number)=>`q${String(n).split('').map(digit=>String.fromCharCode(97+Number(digit))).join('')}q`;
const user=(uid:string):AuthUser=>({id:uid,email:null,provider:'password'});
const pack=(uid:string,n:number)=>buildConversationPack({id:id(n),sessionId:id(n),learnerId:uid,createdAt:new Date(2000000-n).toISOString(),title:{fr:'Au café',en:'At the cafe'},summary:'A coffee.',keyPhrases:[{fr:`Un café ${word(n)}.`,frWritten:null,en:`Coffee ${word(n)}.`}]});
const page=(uid:string,start:number)=>Array.from({length:20},(_,n)=>pack(uid,start+n));
const cursor=(n:number)=>JSON.stringify({createdAt:`2026-10-04T00:00:00.${String(n).padStart(6,'0')}Z`,packId:id(n)});
const reply=(body:unknown):typeof fetch=>async()=>Response.json(body);
test('refresh consumes exactly one page, retains a finite cache and does not replace earned drills',async()=>{
  const uid='paged-owner';setActiveUser(uid);let calls=0;
  for(let batch=0;batch<12;batch++){
    const after=batch?cursor(batch):null;
    const result=await refreshConversationPacks(user(uid),adapter,async(url)=>{
      calls++;assert.equal(new URL(String(url)).searchParams.get('after'),after);
      return Response.json({packs:page(uid,batch*20+1),nextCursor:cursor(batch+1)});
    },after);
    assert.equal(result.ok,true);if(result.ok){assert.equal(result.packs.length,20);assert.equal(result.nextCursor,cursor(batch+1));}
    assert.ok((await loadConversationPacks()).length<=200);
  }
  assert.equal(calls,12);assert.equal((await loadConversationPacks()).length,200);
  assert.ok((await loadDeck()).some(item=>item.id===phraseKeyOf(`Un café ${word(1)}.`)),'earned phrases survive source cache eviction');
});
test('malformed/foreign/oversized pages and missing cursor do not erase cached data or claim EOF',async()=>{
  const uid='bad-page';setActiveUser(uid);await replaceConversationPacks([pack(uid,1)]);
  for(const body of [{packs:[]},{packs:page(uid,10),nextCursor:'bad'},{packs:[...page(uid,10),pack(uid,99)],nextCursor:null},
    {packs:[pack('foreign',1)],nextCursor:null},{packs:[pack(uid,2),pack(uid,2)],nextCursor:null}]){
    assert.deepEqual(await refreshConversationPacks(user(uid),adapter,reply(body)),{ok:false});
    assert.deepEqual((await loadConversationPacks()).map(row=>row.id),[id(1)]);
  }
  assert.deepEqual(await refreshConversationPacks(user(uid),adapter,reply({packs:page(uid,10),nextCursor:cursor(10)}),cursor(10)),{ok:false});
});
test('failed page banking persists at most20 pinned sources and recovers before the next GET',async()=>{
  const uid='recovery-page';setActiveUser(uid);refuse='drills';
  assert.deepEqual(await refreshConversationPacks(user(uid),adapter,reply({packs:page(uid,500),nextCursor:cursor(1)})),{ok:false});
  const saved=JSON.parse(disk.get(userKey('conversationPacks'))!);assert.equal(saved.pendingBanking.length,20);
  await replaceConversationPacks(Array.from({length:200},(_,n)=>pack(uid,n+1000)));
  const held=JSON.parse(disk.get(userKey('conversationPacks'))!);assert.equal(held.packs.length,200);
  assert.equal(held.pendingBanking.length,20);for(const n of saved.pendingBanking)assert.ok(held.packs.some((row:{id:string})=>row.id===n),'pending source cannot be trimmed');
  setActiveUser(null);setActiveUser(uid);refuse='';
  const result=await refreshConversationPacks(user(uid),adapter,async()=>{
    assert.equal(JSON.parse(disk.get(userKey('conversationPacks'))!).pendingBanking.length,0,'recovery finishes before accepting next page');
    assert.ok((await loadDrillBank()).some(item=>item.phraseKey===phraseKeyOf(`Un café ${word(500)}.`)));
    return Response.json({packs:page(uid,2000),nextCursor:null});
  },cursor(1));assert.equal(result.ok,true);assert.equal((await loadConversationPacks()).length,200);
});
test('old bookmark lookup is independent of the200-row cache and banked without enlarging its window',async()=>{
  const uid='old-bookmark';setActiveUser(uid);await replaceConversationPacks(Array.from({length:220},(_,n)=>pack(uid,n+1)));
  assert.equal((await loadConversationPacks()).length,200);
  const old=pack(uid,3000);
  const result=await loadConversationPackForLearner(user(uid),adapter,old.id,async(url)=>{
    assert.ok(String(url).endsWith(`/conversation-packs/${old.id}`));return Response.json({pack:old});
  });assert.deepEqual(result,{ok:true,pack:old});assert.equal((await loadConversationPacks()).length,200);
  assert.ok((await loadDrillBank()).some(item=>item.phraseKey===phraseKeyOf(`Un café ${word(3000)}.`)));
  assert.deepEqual(await loadConversationPackForLearner(user(uid),adapter,old.id,async()=>new Response(null,{status:404})),{ok:true,pack:null});
  assert.deepEqual(await loadConversationPackForLearner(user(uid),adapter,old.id,async()=>new Response(null,{status:503})),{ok:false});
});
test('scope changes at token/body/write and an ABA reset cannot bank private rows into another account',async()=>{
  for(const phase of ['token','body','write','aba']){
    const uid=`scope-${phase}`,other=`other-${phase}`;setActiveUser(uid);const privatePack={...pack(uid,7000),summary:'PRIVATE_SCOPE_MARKER'};
    const scopedAdapter=phase==='token'?{kind:'supabase',getAccessToken:async()=>{setActiveUser(other);return 'fixture';}} as unknown as AuthAdapter:adapter;
    const originalSet=storage.setItem;
    if(phase==='write')storage.setItem=async(key:string,value:string)=>{setActiveUser(other);disk.set(key,value);};
    try{
      const result=await refreshConversationPacks(user(uid),scopedAdapter,async()=>{
        if(phase==='body'||phase==='aba')return {status:200,text:async()=>{setActiveUser(other);if(phase==='aba')setActiveUser(uid);return JSON.stringify({packs:[privatePack],nextCursor:null});}} as Response;
        return Response.json({packs:[privatePack],nextCursor:null});
      });assert.deepEqual(result,{ok:false});
      assert.ok([...disk.entries()].filter(([key])=>key.startsWith(`luvani.u.${other}.`)).every(([,value])=>!value.includes('PRIVATE_SCOPE_MARKER')));
    }finally{storage.setItem=originalSet;}
  }
});
test('legacy cache reads are bounded and explicit deletion remains scoped during an awaited response',async()=>{
  const uid='legacy-delete';setActiveUser(uid);disk.set(userKey('conversationPacks'),JSON.stringify({version:1,packs:Array.from({length:250},(_,n)=>pack(uid,n+1))}));
  assert.equal((await loadConversationPacks()).length,200);
  const result=await deleteConversationPackForLearner(user(uid),adapter,id(1),async()=>{setActiveUser('new-delete-owner');return new Response(null,{status:204});});
  assert.equal(result.ok,false);assert.equal(disk.has(userKey('conversationPacks')),false);
});
test('a malformed owned cache refuses refresh and mutation without network or overwriting bytes',async()=>{
  const uid='unreadable-page';setActiveUser(uid);const key=userKey('conversationPacks');disk.set(key,'{');let calls=0;
  const request:typeof fetch=async()=>{calls++;return Response.json({packs:[],nextCursor:null});};
  assert.deepEqual(await refreshConversationPacks(user(uid),adapter,request),{ok:false});
  await assert.rejects(deleteConversationPackForLearner(user(uid),adapter,id(1),request));
  assert.equal(calls,0);assert.equal(disk.get(key),'{');
});
test('weighted pages progress with partial row counts and exceptional entries remain explicit without invented learning',async()=>{
  const uid='weighted-available';setActiveUser(uid);const full={...pack(uid,8000),summary:'Une conversation. '.repeat(3000)};
  const unavailable={id:id(8001),createdAt:'2026-10-04T00:00:00.999998Z',payloadBytes:1100000,reason:'oversize'};
  const result=await refreshConversationPacks(user(uid),adapter,reply({packs:[full],unavailable:[unavailable],nextCursor:cursor(8001)}));
  assert.equal(result.ok,true);if(result.ok){assert.equal(result.packs.length,1);assert.deepEqual(result.unavailable,[unavailable]);assert.equal(result.nextCursor,cursor(8001));}
  assert.deepEqual((await loadConversationPacks()).map(row=>row.id),[full.id]);assert.ok(!JSON.stringify(await loadDrillBank()).includes(unavailable.id));
  assert.deepEqual(await loadConversationPackForLearner(user(uid),adapter,unavailable.id,async()=>new Response(null,{status:413})),{ok:false,reason:'oversize'});
  for(const value of [[{...unavailable,payloadBytes:1}],[{...unavailable,reason:'unknown'}],[{...unavailable,id:full.id}]])assert.deepEqual(await refreshConversationPacks(user(uid),adapter,reply({packs:[full],unavailable:value,nextCursor:cursor(8001)})),{ok:false});
  const next=await refreshConversationPacks(user(uid),adapter,reply({packs:[pack(uid,9000)],unavailable:[],nextCursor:null}),cursor(8001));assert.equal(next.ok,true);
});
