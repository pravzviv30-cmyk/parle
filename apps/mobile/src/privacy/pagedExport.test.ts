import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test,beforeEach} from 'node:test';
import {downloadPagedAccountData} from './pagedExport.ts';
import type {AuthAdapter,AuthUser} from '../auth/types.ts';
import {setActiveUser,USER_KEY_SUFFIXES} from '../storage/scope.ts';
const id='11111111-1111-4111-8111-111111111111';
const user:AuthUser={id:'learner-A',email:null,provider:'password'};
const sha256=async(bytes:Uint8Array)=>new Uint8Array(createHash('sha256').update(bytes).digest());
beforeEach(()=>setActiveUser(user.id));
function fixture(parts=1) {
  const data=Buffer.alloc(65536,65);const digest=createHash('sha256').update(data).digest();let chain=createHash('sha256').update(Buffer.alloc(0)).digest();
  for(let i=0;i<parts;i++)chain=createHash('sha256').update(Buffer.concat([chain,digest])).digest();
  const manifest={kind:'ready',version:2,exportId:id,format:'luvani-account-export-ndjson-v2',hashAlgorithm:'sha256-chain-v1',totalBytes:65536*parts,totalParts:parts,rootSha256:chain.toString('hex'),expiresAt:new Date(Date.now()+15*60_000).toISOString()};
  let savedBytes=0;let shared=0;let discarded=0;let purged=0;let tokens=0;let reads=0;
  const adapter={kind:'supabase',getSession:async()=>user,getAccessToken:async()=>`token-${++tokens}`} as AuthAdapter;
  const request:typeof fetch=async(url,init)=>{
    assert.equal((init?.headers as Record<string,string>).authorization,`Bearer token-${tokens}`);
    if(init?.method==='DELETE'){purged++;return Response.json({kind:'purged'});}
    if(init?.method==='POST')return Response.json(manifest);
    reads++;const part=Number(new URL(String(url)).searchParams.get('part'));
    return Response.json({kind:'part',version:2,exportId:id,part,totalParts:parts,bytes:data.length,sha256:digest.toString('hex'),dataBase64:data.toString('base64'),nextPart:part+1<parts?part+1:null});
  };
  const deps={exportId:()=>id,sha256,request,readDevice:async(keys:readonly string[])=>keys.map(key=>[key,null] as const),
    createFile:async bytes=>{assert.equal(bytes,manifest.totalBytes);return {append:async part=>{assert.ok(part.length<=65536);savedBytes+=part.length;},share:async()=>{shared++;},discard:async()=>{discarded++;}};},
  } satisfies import('./pagedExport.ts').PagedExportDependencies;
  return {adapter,deps,manifest,state:()=>({savedBytes,shared,discarded,purged,tokens,reads})};
}
test('large exports stream beyond the page quota with finite Retry-After pauses and refreshed bearer tokens',async()=>{
  const f=fixture(549);let paused=0;let quota=true;
  const original=f.deps.request;
  f.deps.request=async(url,init)=>{
    if(init?.method==='GET' && new URL(String(url)).searchParams.get('part')==='240' && quota){quota=false;return Response.json({}, {status:429,headers:{'retry-after':'1'}});}
    return original(url,init);
  };
  assert.deepEqual(await downloadPagedAccountData(user,f.adapter,{...f.deps,pause:async(ms,signal)=>{assert.equal(ms,1250);assert.equal(signal.aborted,false);paused++;}}),{ok:true});
  const state=f.state();assert.equal(paused,1);assert.equal(state.reads,549);assert.equal(state.shared,1);assert.equal(state.discarded,1);assert.equal(state.purged,1);
  assert.ok(state.savedBytes>35_000_000);assert.ok(state.tokens>549);
});
test('part and final chain corruption fail before any sharing and remove partial files',async()=>{
  for(const defect of ['part','root','owner','index']){
    setActiveUser(user.id);const f=fixture(2);const original=f.deps.request;
    if(defect==='root')f.manifest.rootSha256='f'.repeat(64);
    f.deps.request=async(url,init)=>{
      const response=await original(url,init);
      if(init?.method==='GET'){
        const value=await response.json();
        return Response.json({...value,...(defect==='part'?{sha256:'0'.repeat(64)}:defect==='owner'?{exportId:'22222222-2222-4222-8222-222222222222'}:defect==='index'?{part:1}:{})});
      }
      return response;
    };
    const result=await downloadPagedAccountData(user,f.adapter,f.deps);assert.equal(result.ok,false);assert.equal(f.state().shared,0);assert.equal(f.state().discarded,1);assert.equal(f.state().purged,1);
  }
});
test('account switch during a page or device read never writes or shares it under the next account',async()=>{
  for(const phase of ['page','device']){
    setActiveUser(user.id);const f=fixture();const original=f.deps.request;
    f.deps.request=async(url,init)=>{const response=await original(url,init);if(phase==='page' && init?.method==='GET')setActiveUser('learner-B');return response;};
    const readDevice=async(keys:readonly string[])=>{if(phase==='device')setActiveUser('learner-B');return keys.map(key=>[key,null] as const);};
    const result=await downloadPagedAccountData(user,f.adapter,{...f.deps,readDevice});assert.equal(result.ok,false);assert.equal(f.state().shared,0);assert.equal(f.state().discarded,1);
    assert.equal(f.state().savedBytes,phase==='page'?0:65536);
  }
});
test('an expired manifest, oversized response or persistent page quota never produces an archive',async()=>{
  for(const defect of ['expired','oversize','quota']){
    setActiveUser(user.id);const f=fixture();const original=f.deps.request;let pauses=0;
    if(defect==='expired')f.manifest.expiresAt=new Date(Date.now()-1).toISOString();
    f.deps.request=async(url,init)=>init?.method==='GET'?(defect==='oversize'?Response.json({x:'x'.repeat(110*1024)}):defect==='quota'?Response.json({}, {status:429}):original(url,init)):original(url,init);
    assert.equal((await downloadPagedAccountData(user,f.adapter,{...f.deps,pause:async()=>{pauses++;}})).ok,false);assert.equal(f.state().shared,0);assert.ok(pauses<=3);
  }
});
test('failed file cleanup is reported honestly even after a successful share',async()=>{
  const f=fixture();const createFile=async()=>({append:async()=>{},share:async()=>{},discard:async()=>{throw new Error('unlink refused');}});
  const result=await downloadPagedAccountData(user,f.adapter,{...f.deps,createFile});assert.equal(result.ok,false);if(!result.ok)assert.match(result.message,/temporary export/);
});
