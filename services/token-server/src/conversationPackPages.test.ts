import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { conversationPackPage, conversationPackById, packCursor } from './conversationPackPages.ts';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const rows=Array.from({length:20},(_,n)=>{
  const createdAt=`2026-10-04T00:00:00.${String(999999-n).padStart(6,'0')}Z`;
  return {id:id(30-n),createdAt,payload:buildConversationPack({id:id(30-n),sessionId:id(30-n),learnerId:owner,createdAt,title:{fr:'Au café',en:'At the cafe'},summary:'A coffee.',keyPhrases:[{fr:'Un café, merci.',frWritten:null,en:'A coffee, thanks.'}]})};
});
const cursor=(row=rows.at(-1)!)=>({createdAt:row.createdAt,packId:row.id});
const first=rows[0]!;
const response=(body:unknown):typeof fetch=>async()=>Response.json(body);
test('one scalar service RPC preserves microsecond keyset and requests no REST counts',async()=>{
  let calls=0;
  const after=JSON.stringify({createdAt:'2026-10-04T00:00:01.000001Z',packId:id(100)});
  const result=await conversationPackPage('https://project.example/','fixture',owner,after,async(url,init)=>{
    calls++;if(String(url).includes('/rest/v1/conversation_packs?'))return Response.json([]);
    assert.equal(String(url),'https://project.example/rest/v1/rpc/conversation_pack_page_v1');
    assert.deepEqual(JSON.parse(String(init?.body)),{p_user_id:owner,p_after_created_at:'2026-10-04T00:00:01.000001Z',p_after_id:id(100),p_pack_id:null});
    return Response.json({version:1,kind:'page',rows,nextCursor:cursor()});
  });
  assert.equal(calls,2);assert.deepEqual(result.packs,rows.map(row=>row.payload));assert.equal(result.nextCursor,JSON.stringify(cursor()));
});
test('invalid or nonprogressing response refuses the page instead of inventing EOF',async()=>{
  const body={version:1,kind:'page',rows,nextCursor:cursor()};
  const bad=[{...body,nextCursor:undefined},{...body,nextCursor:cursor(rows[0])},{...body,rows:[...rows,rows[0]]},
    {...body,rows:[rows[1],rows[0]]},{...body,rows:[rows[0],rows[0]]},
    {...body,rows:[{...first,payload:{...first.payload,learnerId:'foreign'}}]},
    {...body,rows:[{...rows[0],id:id(999)}]}];
  for(const item of bad)await assert.rejects(conversationPackPage('https://project.example','fixture',owner,null,response(item)));
  await assert.rejects(conversationPackPage('https://project.example','fixture',owner,JSON.stringify(cursor()),response(body)));
  await assert.rejects(conversationPackPage('https://project.example','fixture',owner,'bad',response(body)),{status:400});
  await assert.rejects(conversationPackPage('https://project.example','fixture',owner,null,response({version:1,kind:'inactive'})),{status:403});
  assert.equal(packCursor('x'.repeat(257)),null);
});
test('by-ID independently restores old ready and unfinished packs and truthful absence',async()=>{
  for(const state of ['ready','generating','failed'] as const){
    const row={...first,payload:{...first.payload,state}};
    const pack=await conversationPackById('https://project.example','fixture',owner,row.id,async(_url,init)=>{
      assert.equal(JSON.parse(String(init?.body)).p_pack_id,row.id);
      return Response.json({version:1,kind:'pack',rows:[row],nextCursor:null});
    });assert.equal(pack?.state,state);
  }
  assert.equal(await conversationPackById('https://project.example','fixture',owner,id(1),response({version:1,kind:'pack',rows:[],nextCursor:null})),null);
  await assert.rejects(conversationPackById('https://project.example','fixture',owner,id(1),response({version:1,kind:'pack',rows:[rows[0]],nextCursor:null})));
  await assert.rejects(conversationPackById('https://project.example','fixture',owner,'bad',response(null)),{status:400});
});
test('oversized and error upstream results refuse without releasing partial rows',async()=>{
  await assert.rejects(conversationPackPage('https://project.example','fixture',owner,null,async()=>new Response('x'.repeat(2*1024*1024+1))));
  await assert.rejects(conversationPackPage('https://project.example','fixture',owner,null,async()=>new Response(null,{status:503})));
});
test('weighted nonempty pages and historical placeholders preserve progress with no fabricated pack',async()=>{
  const full={...first,payload:{...first.payload,summary:'Une conversation. '.repeat(3000)}};
  const unavailable={id:id(29),createdAt:'2026-10-04T00:00:00.999998Z',payload:null,unavailable:'oversize',payloadBytes:600000};
  const next={createdAt:unavailable.createdAt,packId:unavailable.id};
  const page=await conversationPackPage('https://project.example','fixture',owner,null,response({version:1,kind:'page',rows:[full,unavailable],nextCursor:next}));
  assert.deepEqual(page.packs,[full.payload]);assert.deepEqual(page.unavailable,[{id:unavailable.id,createdAt:unavailable.createdAt,payloadBytes:600000,reason:'oversize'}]);assert.equal(page.nextCursor,JSON.stringify(next));
  for(const changed of [{...unavailable,payloadBytes:400000},{...unavailable,unavailable:'unknown'},{...unavailable,private:'bad'}])await assert.rejects(conversationPackPage('https://project.example','fixture',owner,null,response({version:1,kind:'page',rows:[changed],nextCursor:null})));
  await assert.rejects(conversationPackById('https://project.example','fixture',owner,unavailable.id,response({version:1,kind:'pack',rows:[{...unavailable,payloadBytes:1100000}],nextCursor:null})),{status:413});
  assert.deepEqual(await conversationPackById('https://project.example','fixture',owner,full.id,response({version:1,kind:'pack',rows:[full],nextCursor:null})),full.payload);
});

// A fake Supabase: the page RPC plus the owner-scoped embed of practice jobs.
// Rows belong to an owner; the embed honours user_id and id=in.(...) like PostgREST.
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function practiceDb(jobs:Map<string,string>,owners:Map<string,string>){
  const statusReads:string[]=[];
  const request:typeof fetch=async(url,init)=>{
    const u=new URL(String(url));
    if(u.pathname.endsWith('/rpc/conversation_pack_page_v1')){
      const user=JSON.parse(String(init?.body)).p_user_id;
      return Response.json({version:1,kind:'page',rows:rows.slice(0,3).filter(row=>owners.get(row.id)===user).map(row=>({...row,payload:{...row.payload,learnerId:user}})),nextCursor:null});
    }
    statusReads.push(String(url));
    const user=u.searchParams.get('user_id')!.replace('eq.','');
    const ids=u.searchParams.get('id')!.replace(/^in\.\(|\)$/g,'').split(',');
    return Response.json(ids.filter(id=>owners.get(id)===user).map(id=>({id,conversation_practice_jobs:jobs.has(id)?{status:jobs.get(id)}:null})));
  };
  return {request,statusReads};
}
const statusOf=async(request:typeof fetch,user=owner)=>Object.fromEntries((await conversationPackPage('https://project.example',  'fixture',user,null,request)).packs.map(pack=>[pack.id,pack.practiceStatus]));
const mine=new Map(rows.slice(0,3).map(row=>[row.id,owner]));
test('the practice pack status reads preparing until generated drills arrive',async()=>{
  const jobs=new Map([[rows[0]!.id,'pending'],[rows[1]!.id,'running']]);
  const db=practiceDb(jobs,mine);
  let status=await statusOf(db.request);
  assert.equal(status[rows[0]!.id],'preparing');assert.equal(status[rows[1]!.id],'preparing');
  jobs.set(rows[0]!.id,'complete');jobs.set(rows[1]!.id,'complete');
  status=await statusOf(db.request);
  assert.equal(status[rows[0]!.id],'ready');assert.equal(status[rows[1]!.id],'ready');
  assert.equal(db.statusReads.length,2);
});
test('a failed practice job reads failed and exposes no job internals',async()=>{
  const db=practiceDb(new Map([[rows[0]!.id,'failed']]),mine);
  const page=await conversationPackPage('https://project.example','fixture',owner,null,db.request);
  assert.equal(page.packs[0]!.practiceStatus,'failed');
  for(const key of ['attempts','lease_token','lease_until','available_at','status','error'])assert.equal(key in page.packs[0]!,false);
});
test('a pack with no practice job reads ready',async()=>{
  const status=await statusOf(practiceDb(new Map(),mine).request);
  assert.deepEqual(Object.values(status),['ready','ready','ready']);
});
test('another learner never receives a pack or job status that is not theirs',async()=>{
  const owners=new Map([[rows[0]!.id,owner],[rows[1]!.id,other],[rows[2]!.id,other]]);
  const db=practiceDb(new Map([[rows[1]!.id,'failed']]),owners);
  assert.deepEqual(Object.keys(await statusOf(db.request,owner)),[rows[0]!.id]);
  assert.deepEqual(await statusOf(db.request,other),{[rows[1]!.id]:'failed',[rows[2]!.id]:'ready'});
  for(const url of db.statusReads)assert.match(url,/user_id=eq\./);
  assert.ok(db.statusReads[0]!.includes(`user_id=eq.${owner}`)&&!db.statusReads[0]!.includes(rows[1]!.id));
});
test('a failed status read leaves the library readable without the optional field',async()=>{
  const request:typeof fetch=async(url)=>String(url).includes('/rpc/')?Response.json({version:1,kind:'page',rows:rows.slice(0,1),nextCursor:null}):new Response(null,{status:503});
  const page=await conversationPackPage('https://project.example','fixture',owner,null,request);
  assert.deepEqual(page.packs,[rows[0]!.payload]);
});
test('pack detail carries the same practice status as the list',async()=>{
  const request:typeof fetch=async(url)=>String(url).includes('/rpc/')?Response.json({version:1,kind:'pack',rows:[first],nextCursor:null}):Response.json([{id:first.id,conversation_practice_jobs:{status:'running'}}]);
  assert.equal((await conversationPackById('https://project.example','fixture',owner,first.id,request))?.practiceStatus,'preparing');
});
