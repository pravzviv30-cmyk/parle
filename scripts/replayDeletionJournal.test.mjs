import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {replayRestore,validateReplayInputs} from './replayDeletionJournal.mjs';
import {deletionJournal} from '../services/token-server/src/deletionJournal.ts';
const env={SUPABASE_URL:'https://restore.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',LUVANI_DELETION_JOURNAL_PROJECT_URL:'https://source.test',LUVANI_RESTORE_ISOLATED:'1',LUVANI_DELETION_JOURNAL_URL:'https://journal.test',LUVANI_DELETION_JOURNAL_TOKEN:'t'.repeat(32),LUVANI_DELETION_JOURNAL_KEY:Buffer.alloc(32,7).toString('base64url')};
const evidence=()=>({version:1,sourceProjectUrl:env.LUVANI_DELETION_JOURNAL_PROJECT_URL,targetProjectUrl:env.SUPABASE_URL,sourceWritersFrozen:true,sourceAdmissionOff:true,reviewedBy:'fixture reviewer',evidenceUrl:'https://review.test/freeze',evidenceSha256:'f'.repeat(64),expiresAt:new Date(Date.now()+60000).toISOString()});
test('restore rejects same target, missing source freeze and expired/wrong evidence before any network operation',async()=>{
  for(const [settings,review] of [[{...env,SUPABASE_URL:env.LUVANI_DELETION_JOURNAL_PROJECT_URL},evidence()],[{...env,LUVANI_RESTORE_ISOLATED:'0'},evidence()],[env,{...evidence(),sourceWritersFrozen:false}],[env,{...evidence(),expiresAt:new Date(0).toISOString()}],[env,{...evidence(),targetProjectUrl:'https://foreign.test'}]]){
    assert.throws(()=>validateReplayInputs(settings,review));let calls=0;await assert.rejects(replayRestore(settings,review,{request:async()=>{calls++;throw new Error('unused');}}));assert.equal(calls,0);
  }
});
test('restore never enables admission and requires a fully reconciled target after sealed replay',async()=>{
  for(const pending of [0,1]){
    const calls=[];
    const request=async(url,init)=>{
      const path=new URL(String(url)).pathname;calls.push(path);assert.equal(init?.redirect,'error');
      if(path.endsWith('paid_admission_schema_v1'))return Response.json({version:1,enabled:false});
      if(path.endsWith('tutor_session_schema_v1'))return Response.json({version:1,enabled:false});
      if(path.endsWith('configure_privacy_processor_v1'))return Response.json({kind:'configured'});
      if(path==='/snapshots')return Response.json({version:1,snapshotId:'11111111-1111-4111-8111-111111111111',project:createHash('sha256').update(env.LUVANI_DELETION_JOURNAL_PROJECT_URL).digest('hex'),totalRecords:0,keysSha256:createHash('sha256').update(Buffer.alloc(0)).digest('hex'),expiresAt:new Date(Date.now()+60000).toISOString()},{status:201});
      if(path.includes('/snapshots/'))return Response.json({snapshotId:'11111111-1111-4111-8111-111111111111',keys:[],nextCursor:null});
      if(path.endsWith('claim_account_erasure_v1'))return Response.json({kind:'idle'});
      if(path.endsWith('backend_status_v1'))return Response.json({erasurePending:pending});
      assert.fail('unexpected restore operation');
    };
    const result=await replayRestore(env,evidence(),{request});assert.equal(result.status,pending?'pending':'replayed');assert.equal(result.replayed,0);assert.equal(result.admissionEnabled,false);
    assert.ok(!calls.some(path=>path.includes('configure_tutor')));assert.equal(result.verifiedSnapshot.totalRecords,0);
  }
});
test('already enabled target is refused before journal or erasure operations',async()=>{
  let calls=0;await assert.rejects(replayRestore(env,evidence(),{request:async()=>{calls++;return Response.json({enabled:true});}}),/OFF/);assert.equal(calls,2);
});
test('nonempty authenticated sealed journals replay completed/pending jobs and reject oversized sets before fencing anyone',async()=>{
 for(const mode of ['completed','pending','over-limit','paid-enabled']) {
  const objects=new Map();let begins=0,snapshots=0;const sid='11111111-1111-4111-8111-111111111111';
  const request=async(url,init)=>{
   const p=new URL(String(url)),name=p.pathname.split('/').at(-1);
   if(p.origin==='https://journal.test') {
    if(init?.method==='PUT'){if(objects.has(name))return new Response(null,{status:412});objects.set(name,String(init.body));return new Response(null,{status:201});}
    if(name==='snapshots'){snapshots++;const keys=[...objects.keys()].sort();return Response.json({version:1,snapshotId:sid,project:createHash('sha256').update(env.LUVANI_DELETION_JOURNAL_PROJECT_URL).digest('hex'),totalRecords:keys.length,keysSha256:createHash('sha256').update(Buffer.concat(keys.map(k=>Buffer.from(k,'hex')))).digest('hex'),expiresAt:new Date(Date.now()+60000).toISOString()},{status:201});}
    if(p.pathname.includes('/snapshots/'))return Response.json({snapshotId:sid,keys:[...objects.keys()].sort(),nextCursor:null});
    return new Response(objects.get(name),{status:objects.has(name)?200:404});
   }
   if(name==='tutor_session_schema_v1')return Response.json({version:1,enabled:false});
   if(name==='paid_admission_schema_v1')return Response.json({version:1,enabled:mode==='paid-enabled'});
   if(name==='configure_privacy_processor_v1')return Response.json({kind:'configured'});
   if(name==='begin_account_erasure_v1'){begins++;return Response.json({kind:mode==='completed'?'completed':'pending'});}
   if(name==='claim_account_erasure_v1')return Response.json({kind:'idle'});
   if(name==='backend_status_v1')return Response.json({erasurePending:mode==='pending'?1:0});
   assert.fail('unexpected restore operation');
  };
  const journal=deletionJournal({endpoint:env.LUVANI_DELETION_JOURNAL_URL,token:env.LUVANI_DELETION_JOURNAL_TOKEN,key:env.LUVANI_DELETION_JOURNAL_KEY,projectUrl:env.LUVANI_DELETION_JOURNAL_PROJECT_URL},request);
  await journal.record('22222222-2222-4222-8222-222222222222');if(mode==='over-limit')await journal.record('33333333-3333-4333-8333-333333333333');
  if(['over-limit','paid-enabled'].includes(mode)){await assert.rejects(replayRestore(env,evidence(),{request,maxRecords:1,maxJobs:1}));assert.equal(begins,0);assert.equal(snapshots,mode==='paid-enabled'?0:1);}
  else {const result=await replayRestore(env,evidence(),{request,maxRecords:1,maxJobs:1});assert.equal(result.replayed,1);assert.equal(begins,1);assert.equal(result.status,mode==='pending'?'pending':'replayed');assert.equal(result.admissionEnabled,false);assert.ok(!JSON.stringify(result).includes('22222222-2222'));}
 }
});
