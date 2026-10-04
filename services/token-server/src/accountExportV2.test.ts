import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {accountExports} from './accountExportV2.ts';
const owner='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const data=Buffer.from('account data');const hash=createHash('sha256').update(data).digest('hex');
const part={kind:'part',version:2,exportId:id,part:0,totalParts:1,bytes:data.length,sha256:hash,dataBase64:data.toString('base64'),nextPart:null};
const manifest={kind:'ready',version:2,exportId:id,format:'luvani-account-export-ndjson-v2',hashAlgorithm:'sha256-chain-v1',rootSha256:hash,totalBytes:data.length,totalParts:1,snapshotAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+14*60_000).toISOString()};
test('export API adapter uses fixed service RPCs with actual owner/session/export/part binding',async()=>{
  const calls:string[]=[];
  const api=accountExports('https://db.test/','private',async(url,init)=>{
    calls.push(String(url));assert.equal((init?.headers as Record<string,string>).authorization,'Bearer private');assert.equal(init?.redirect,'error');
    if(String(url).includes('/auth/'))return Response.json({last_sign_in_at:new Date(Date.now()-1000).toISOString()});
    const args=JSON.parse(String(init?.body));assert.equal(args.p_user_id,owner);assert.equal(args.p_export_id,id);
    if(String(url).includes('purge'))return Response.json({kind:'purged'});
    assert.equal(args.p_auth_session_id,session);
    if(String(url).includes('part')){assert.equal(args.p_part,0);return Response.json(part);}
    return Response.json(manifest);
  });
  assert.deepEqual(await api.prepare(owner,session,id,Date.now()),manifest);assert.deepEqual(await api.part(owner,session,id,0),part);await api.purge(owner,id);assert.equal(calls.length,4);
});
test('corrupt, noncanonical, substituted or unbounded export parts cannot be returned',async()=>{
  for(const bad of [{sha256:'0'.repeat(64)},{exportId:owner},{part:1},{bytes:65537},{dataBase64:data.toString('base64')+'='},{nextPart:1},{totalParts:2049},{dataBase64:Buffer.from('different').toString('base64')}]){
    await assert.rejects(accountExports('https://db.test','private',async()=>Response.json({...part,...bad})).part(owner,session,id,0));
  }
  let calls=0;await assert.rejects(accountExports('https://db.test','private',async()=>{calls++;return Response.json(part);}).part(owner,session,id,2048));assert.equal(calls,0);
});
test('fresh reauthentication and complete bounded manifest are required before preparation succeeds',async()=>{
  let calls=0;const stale=accountExports('https://db.test','private',async()=>{calls++;return Response.json({});});
  assert.equal(await stale.prepare(owner,session,id,Date.now()-301000),null);assert.equal(calls,0);
  for(const bad of [{version:1},{totalBytes:128*1024*1024+1},{totalParts:2},{exportId:owner},{rootSha256:'bad'},{expiresAt:manifest.snapshotAt}]){
    await assert.rejects(accountExports('https://db.test','private',async(url)=>Response.json(String(url).includes('/auth/')?{last_sign_in_at:new Date(Date.now()-1000).toISOString()}:{...manifest,...bad})).prepare(owner,session,id,Date.now()));
  }
});
