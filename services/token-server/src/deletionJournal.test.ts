import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { test } from 'node:test';
import { deletionJournal } from './deletionJournal.ts';
const user = '12345678-1234-4234-8234-123456789abc';
const config = { endpoint: 'https://independent.test/erasure', token: 't'.repeat(32), key: Buffer.alloc(32, 7).toString('base64url'), projectUrl: 'https://project.supabase.co' };
function store() {
  const objects = new Map<string, string>();let sealedKeys:string[]=[];
  const snapshotId='11111111-1111-4111-8111-111111111111';
  const request: typeof fetch = async (url, init) => {
    const parsed = new URL(String(url)); const name = parsed.pathname.split('/').at(-1)!;
    assert.equal(init?.redirect,'error'); assert.ok(init?.signal); assert.equal((init?.headers as Record<string,string>).authorization, `Bearer ${config.token}`);
    if (init?.method === 'PUT') {
      assert.equal((init.headers as Record<string,string>)['if-none-match'],'*');
      if (objects.has(name)) return new Response(null,{status:412});
      objects.set(name,String(init.body)); return new Response(null,{status:201});
    }
    if(name==='snapshots') {
      sealedKeys=[...objects.keys()].sort();
      return Response.json({version:1,snapshotId,project:JSON.parse(String(init?.body)).project,totalRecords:sealedKeys.length,keysSha256:createHash('sha256').update(Buffer.concat(sealedKeys.map(key=>Buffer.from(key,'hex')))).digest('hex'),expiresAt:new Date(Date.now()+60_000).toISOString()},{status:201});
    }
    if (name === 'records') {
      const keys=sealedKeys.filter(key=>!parsed.searchParams.get('after') || key>parsed.searchParams.get('after')!);
      return Response.json({snapshotId,keys:keys.slice(0,1),nextCursor:keys.length>1?keys[0]:null});
    }
    return new Response(objects.get(name),{status:objects.has(name)?200:404});
  };
  return { objects,request,snapshotId };
}
test('journal uses opaque immutable names, authenticated encryption and exact readback across retries', async () => {
  const {objects,request} = store(); const journal = deletionJournal(config,request);
  await journal.record(user); const [name,record] = [...objects.entries()][0]!;
  assert.match(name,/^[a-f0-9]{64}$/); assert.ok(!record.includes(user));
  await journal.record(user); assert.equal(objects.size,1); assert.equal(objects.get(name),record);
  const applied: string[]=[]; assert.equal(await journal.replay(async id=>{applied.push(id);}),1); assert.deepEqual(applied,[user]);
  objects.set(name,record.replace(/"tag":"[^"]+"/,'"tag":"'+Buffer.alloc(16).toString('base64url')+'"'));
  await assert.rejects(journal.record(user)); await assert.rejects(journal.replay(async()=>assert.fail('must not apply altered object')));
});
test('different project/key cannot decrypt or accept an existing erasure proof', async () => {
  const {objects,request} = store(); await deletionJournal(config,request).record(user);
  const [name] = objects.keys(); const foreignRequest: typeof fetch = async()=>new Response(objects.get(name!));
  await assert.rejects(deletionJournal({...config,projectUrl:'https://other.supabase.co'},foreignRequest).record(user));
  await assert.rejects(deletionJournal({...config,key:Buffer.alloc(32,8).toString('base64url')},foreignRequest).record(user));
  await assert.rejects(deletionJournal({...config,projectUrl:'https://other.supabase.co'},request).replay(async()=>assert.fail('foreign project')));
  await assert.rejects(deletionJournal({...config,key:Buffer.alloc(32,8).toString('base64url')},request).replay(async()=>assert.fail('foreign key')));
});
test('journal rejects unsafe config, failed conditional acknowledgement and cyclic restore list', async () => {
  assert.throws(()=>deletionJournal({...config,endpoint:'http://journal.test'}));
  assert.throws(()=>deletionJournal({...config,key:'not-a-key'}));
  await assert.rejects(deletionJournal(config,async()=>new Response(null,{status:200})).record(user));
  const {objects,request,snapshotId}=store(); await deletionJournal(config,request).record(user);
  const name=[...objects.keys()][0]!; let pages=0;
  const repeated: typeof fetch=async(url,init)=>{
    if (new URL(String(url)).pathname.endsWith('/records')) { pages++; return Response.json({snapshotId,keys:[name],nextCursor:name}); }
    return request(url,init);
  };
  let applied=0;
  await assert.rejects(deletionJournal(config,repeated).replay(async()=>{applied++;}),/key-order/);
  assert.equal(pages,2); assert.equal(applied,1);
});


test('sealed replay rejects truncated sets, substituted digest and mismatched snapshot page',async()=>{
  for(const defect of ['omitted','digest','snapshot']){
    const {objects,request}=store();const journal=deletionJournal(config,request);
    await journal.record(user);await journal.record('22222222-2222-4222-8222-222222222222');assert.equal(objects.size,2);
    const corrupt:typeof fetch=async(url,init)=>{
      const response=await request(url,init);const parsed=new URL(String(url));
      if(parsed.pathname.endsWith('/snapshots') && defect==='digest'){const value=await response.json();return Response.json({...value,keysSha256:'0'.repeat(64)},{status:201});}
      if(parsed.pathname.includes('/snapshots/') && parsed.pathname.endsWith('/records')){
        const value=await response.json();return Response.json({...value,...(defect==='omitted'?{nextCursor:null}:defect==='snapshot'?{snapshotId:'33333333-3333-4333-8333-333333333333'}:{})});
      }
      return response;
    };
    let verified=false;await assert.rejects(deletionJournal(config,corrupt).replay(async()=>{},()=>{verified=true;}));assert.equal(verified,false);
  }
});

test('a sealed set is immutable when a writer adds a later erasure; source freeze is a separate gate',async()=>{
  const {request}=store();const journal=deletionJournal(config,request);await journal.record(user);let added=false;
  const raced:typeof fetch=async(url,init)=>{
    const response=await request(url,init);
    if(new URL(String(url)).pathname.endsWith('/snapshots') && !added){added=true;await journal.record('22222222-2222-4222-8222-222222222222');}
    return response;
  };
  let applied=0;let sealedCount=0;assert.equal(await deletionJournal(config,raced).replay(async()=>{applied++;},snapshot=>{sealedCount=snapshot.totalRecords;}),1);
  assert.equal(applied,1);assert.equal(sealedCount,1);assert.equal(await journal.replay(async()=>{}),2);
});

test('journal bounds both response bytes and headers/body deadlines even if transport ignores abort',async()=>{
  await assert.rejects(deletionJournal(config,async()=>new Response('x'.repeat(16_385))).record(user),/response-limit/);
  await assert.rejects(deletionJournal(config,async()=>new Promise(()=>{}),{timeoutMs:5}).record(user),/timeout/);
  await assert.rejects(deletionJournal(config,async()=>new Response(new ReadableStream({pull:()=>new Promise(()=>{})})),{timeoutMs:5}).record(user),/timeout/);
});
