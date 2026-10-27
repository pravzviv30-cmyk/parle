/**
 * scripts/paidQuotes.mjs end to end: generated SQL applied to every migration in
 * disposable PostgreSQL/WASM, then the runtime's own admission code
 * (paidBindings -> paidAdmission.reserve/resume -> reservationGate -> claim) admits
 * every captured request shape through the real SQL RPCs. No vendor, network or key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {ROOT,buildSchemaManifest,MANAGED_DEFAULT_PRIVILEGES_SQL} from './releaseSchemaManifest.mjs';
import {generate} from './paidQuotes.mjs';
import {paidAdmission,PaidAdmissionError} from '../services/shared/paidAdmission.ts';
import {paidBindings} from '../services/shared/paidBindings.ts';
import {reservationGate} from '../services/shared/paidExecution.ts';

const EVIDENCE='https://github.com/example/luvani/blob/main/deployment/PAID_ADMISSION.md';
const scratch=()=>mkdtemp(join(tmpdir(),'luvani-paid-quotes-test-'));
/** Which captured request shapes each activity's runtime sends (see the generator's quote table). */
const SENDS={
 lesson:['live-chat','stt-lesson-keyterm','tts-alexandre'],'lesson-text':['live-chat'],
 convo:['turn-stream','frame','curate','extract','drills','stt-convo-multi','stt-convo-fr','tts-alexandre'],
 'convo-text':['turn','frame','curate','extract','drills'],
 practice:['drills'],'api-judge':['judge'],'api-fix-judge':['fix-judge'],'api-transcribe':['take'],'phrase-audio':['phrase-alexandre'],
};

async function database() {
 const schema=await buildSchemaManifest(),db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(MANAGED_DEFAULT_PRIVILEGES_SQL);
 for(const migration of schema.migrations)await db.exec(await readFile(`${ROOT}/supabase/migrations/${migration.name}`,'utf8'));
 return db;
}
/** The service-role RPC the runtime would call over PostgREST, with named arguments. */
const rpcFor=db=>async(name,args)=>{
 const keys=Object.keys(args);await db.exec('set role service_role');
 try{return (await db.query(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as value`,keys.map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]))).rows[0].value;}
 finally{await db.exec('reset role');}
};
async function learner(db) {
 const userId=randomUUID(),authSessionId=randomUUID();
 await db.query('insert into auth.users(id) values($1)',[userId]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[authSessionId,userId]);
 await db.query("insert into entitlements(user_id,plan,period_end) values($1,'regular',clock_timestamp()+interval '30 days')",[userId]);
 return {userId,authSessionId};
}
/** Test-only: forget today's day counters so each activity is proven on its own; the budget arithmetic is proven separately. */
const resetDay=db=>db.exec('delete from luvani_private.paid_global_days;delete from luvani_private.paid_vendor_days;delete from luvani_private.paid_execution_global_days;delete from luvani_private.paid_execution_vendor_days;delete from public.tutor_session_budget_days;');

async function admitTutor(db,admission,generated,mode) {
 const {userId,authSessionId}=await learner(db),rpc=rpcFor(db),sessionId=randomUUID(),room=`quote-${mode}`,claimNonce=randomUUID();
 const grant=await rpc('reserve_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:room,p_mode:mode,p_request_digest:'a'.repeat(64),p_auth_session_id:authSessionId});
 assert.equal(grant.kind,'reserved',`${mode} grant ${JSON.stringify(grant)}`);assert.equal(grant.reservedSeconds,600);
 // Exactly what the token server does at session start (server.ts).
 const reserved=await admission.reserve({userId,operationId:sessionId,activity:mode,context:{kind:'tutor',sessionId},requestDigest:sessionId.replace(/-/g,'').repeat(2)});
 assert.equal(reserved.quoteId,generated.bindings[mode].quoteId);
 await rpc('claim_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:room,p_mode:mode,p_claim_nonce:claimNonce});
 // Exactly what the worker does (paidRuntime.ts), then one real claim per request shape.
 const resumed=await admission.resume({userId,sessionId,claimNonce});
 const gate=reservationGate(resumed,{kind:'tutor',sessionId,claimNonce},new AbortController().signal);
 for(const name of SENDS[mode])assert.ok(await gate(generated.shapes[name].descriptor),`${mode} ${name}`);
 // Close the room the way the worker does, so the next proof is not refused for capacity (max_active_sessions=3).
 await rpc('complete_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_fence:claimNonce,p_revision:0,p_digest:'f'.repeat(64),p_seconds:0,p_learner_turns:0,p_service_failure:null,p_baseline:null});
 assert.equal((await db.query('select state from public.session_grants where session_id=$1',[sessionId])).rows[0].state==='active',false,'room closed');
 return {userId,sessionId};
}
async function admitApi(db,admission,generated,activity,binding=generated) {
 const {userId,authSessionId}=await learner(db),operationId=randomUUID(),context={kind:'api',authSessionId,operationId};
 const reserved=await admission.reserve({userId,operationId,activity,context,requestDigest:'b'.repeat(64)});
 assert.equal(reserved.quoteId,binding.bindings[activity].quoteId);
 const gate=reservationGate(reserved,context,new AbortController().signal);
 for(const name of SENDS[activity])assert.ok(await gate(generated.shapes[name].descriptor),`${activity} ${name}`);
}
async function admitPractice(db,admission,generated) {
 const {userId}=await learner(db),packId=randomUUID();
 const pack={id:packId,sessionId:packId,learnerId:userId,state:'ready',createdAt:new Date().toISOString(),title:{fr:'Fixture',en:'Fixture'},keyPhrases:[],corrections:[],exercises:[]};
 await db.exec('set role service_role');try{await db.query('select public.receive_conversation_practice($1,false)',[JSON.stringify(pack)]);}finally{await db.exec('reset role');}
 await db.query("update conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[packId]);
 await db.exec('set role service_role');try{await db.query('select public.claim_conversation_practice()');}finally{await db.exec('reset role');}
 const leaseToken=(await db.query('select lease_token from conversation_practice_jobs where pack_id=$1',[packId])).rows[0].lease_token;
 const context={kind:'practice',packId,leaseToken};
 // Exactly what practiceWorker.ts does.
 const reserved=await admission.reserve({userId,operationId:leaseToken,activity:'practice',context,requestDigest:'c'.repeat(64)});
 const gate=reservationGate(reserved,context,new AbortController().signal);
 for(const name of SENDS.practice)assert.ok(await gate(generated.shapes[name].descriptor),`practice ${name}`);
}

test('generated staging quotes admit every bound activity through the real SQL and runtime gate; renewal keeps old quotes valid',async()=>{
 const first=await generate({reviewedBy:'paid-quotes-test',out:await scratch(),evidenceUrl:EVIDENCE});
 assert.equal(first.validation.enabled,true);assert.equal(first.validation.quoteCount,9);
 assert.deepEqual(paidBindings({LUVANI_PAID_QUOTE_BINDINGS:first.bindingsJson}),first.bindings);
 for(const file of Object.values(first.files))assert.ok(!file.startsWith(ROOT),'outputs stay outside the repository');
 const sql=await readFile(first.files.sql,'utf8');assert.doesNotMatch(sql,/capture-only|proxy-only|api_key|service_role_key/i);

 const db=await database();
 try {
  await db.exec(sql);
  const config=(await db.query('select * from luvani_private.paid_admission_config')).rows[0];
  assert.equal(config.enabled,true);assert.equal(Number(config.global_daily_micro_usd),first.budgets.globalDailyMicroUsd);assert.equal(first.budgets.globalDailyMicroUsd,21000000);
  assert.ok(first.budgets.accountDailyMicroUsd>=2*first.derivation.perActivityMicroUsd.convo && first.budgets.accountDailyMicroUsd<2*first.derivation.perActivityMicroUsd.convo+100000);
  assert.deepEqual(first.derivation.sessionsAdmittedPerDayAtGlobalBudget,Object.fromEntries(Object.entries(first.derivation.perActivityMicroUsd).map(([a,m])=>[a,Math.floor(21000000/m)])));
  assert.ok(first.derivation.sessionsAdmittedPerDayAtGlobalBudget.convo>=6,'six spoken conversations a day fit the global booking ceiling');
  console.log('[paid-quotes test] admitted per day (global, each alone):',JSON.stringify(first.derivation.sessionsAdmittedPerDayAtGlobalBudget));
  console.log('[paid-quotes test] admitted per account day (each alone):',JSON.stringify(first.derivation.admittedPerAccountDay));
  assert.deepEqual((await db.query('select provider from luvani_private.paid_admission_vendors where enabled order by provider')).rows.map(r=>r.provider),['deepgram','elevenlabs','openai']);
  const tutorConfig=(await db.query('select * from public.tutor_session_admission_config')).rows[0];
  assert.equal(tutorConfig.enabled,false,'tutor admission stays closed');
  assert.deepEqual([tutorConfig.max_active_sessions,tutorConfig.max_daily_issued_seconds,tutorConfig.max_account_daily_seconds,tutorConfig.max_account_daily_sessions,tutorConfig.max_session_seconds],[3,3600,1200,3,600]);
  assert.equal((await db.query("select count(*)::int as n from luvani_private.paid_quotes where enabled")).rows[0].n,9);

  await db.exec('update public.tutor_session_admission_config set enabled=true'); // test-only: opening admission is the founder's later step
  const rpc=rpcFor(db),admission=paidAdmission({rpc,bindings:paidBindings({LUVANI_PAID_QUOTE_BINDINGS:first.bindingsJson})});
  for(const mode of ['lesson','lesson-text','convo','convo-text']){await resetDay(db);await admitTutor(db,admission,first,mode);}
  await resetDay(db);await admitPractice(db,admission,first);
  for(const activity of ['api-judge','api-fix-judge','api-transcribe','phrase-audio'])await admitApi(db,admission,first,activity);

  // An unquoted request shape is refused before any claim: the stripped (plain) lesson stream and a TTS voice not quoted.
  await resetDay(db);
  {
   const {userId,authSessionId}=await learner(db),sessionId=randomUUID(),claimNonce=randomUUID();
   await rpc('reserve_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:'quote-plain',p_mode:'lesson',p_request_digest:'a'.repeat(64),p_auth_session_id:authSessionId});
   await admission.reserve({userId,operationId:sessionId,activity:'lesson',context:{kind:'tutor',sessionId},requestDigest:sessionId.replace(/-/g,'').repeat(2)});
   await rpc('claim_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:'quote-plain',p_mode:'lesson',p_claim_nonce:claimNonce});
   const gate=reservationGate(await admission.resume({userId,sessionId,claimNonce}),{kind:'tutor',sessionId,claimNonce},new AbortController().signal);
   await assert.rejects(gate(first.shapes['stt-lesson-keyterm-plain'].descriptor),e=>e instanceof PaidAdmissionError && e.reason==='quote-mismatch');
  }

  // api-score has no binding: refused by the runtime before the RPC, and by SQL for any unknown quote.
  const {userId,authSessionId}=await learner(db),operationId=randomUUID();
  await assert.rejects(admission.reserve({userId,operationId,activity:'api-score',context:{kind:'api',authSessionId,operationId},requestDigest:'d'.repeat(64)}),e=>e instanceof PaidAdmissionError && e.reason==='quote-mismatch');
  assert.equal((await rpc('reserve_paid_operation_v1',{p_user_id:userId,p_operation_id:operationId,p_quote_id:randomUUID(),p_configuration_sha256:'e'.repeat(64),p_context:{kind:'api',authSessionId,operationId},p_request_digest:'d'.repeat(64)})).reason,'quote-mismatch');

  // One account: two spoken conversations book within the account ceiling; anything more is refused as account-budget.
  await resetDay(db);
  {
   const {userId,authSessionId}=await learner(db);
   for(const n of [1,2]){
    const sessionId=randomUUID(),claimNonce=randomUUID();
    assert.equal((await rpc('reserve_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:`quote-acct-${n}`,p_mode:'convo',p_request_digest:'a'.repeat(64),p_auth_session_id:authSessionId})).kind,'reserved');
    assert.equal((await admission.reserve({userId,operationId:sessionId,activity:'convo',context:{kind:'tutor',sessionId},requestDigest:sessionId.replace(/-/g,'').repeat(2)})).activity,'convo');
    await rpc('claim_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_room_name:`quote-acct-${n}`,p_mode:'convo',p_claim_nonce:claimNonce});
    await rpc('complete_tutor_session_v1',{p_user_id:userId,p_session_id:sessionId,p_fence:claimNonce,p_revision:0,p_digest:'f'.repeat(64),p_seconds:0,p_learner_turns:0,p_service_failure:null,p_baseline:null});
   }
   // A third spoken session is already stopped by tutor admission (1,200 s/account/day)...
   assert.equal((await rpc('reserve_tutor_session_v1',{p_user_id:userId,p_session_id:randomUUID(),p_room_name:'quote-acct-3',p_mode:'convo',p_request_digest:'a'.repeat(64),p_auth_session_id:authSessionId})).reason,'account-daily-budget');
   // ...and the paid booking ceiling refuses the next booking that no longer fits, with global room to spare.
   const operationId=randomUUID();
   await assert.rejects(admission.reserve({userId,operationId,activity:'phrase-audio',context:{kind:'api',authSessionId,operationId},requestDigest:'b'.repeat(64)}),e=>e instanceof PaidAdmissionError && e.reason==='account-budget');
  }

  // Renewal: a second run inserts new revisions; the old ones stay enabled and admit until they expire.
  const second=await generate({reviewedBy:'paid-quotes-test',out:await scratch(),evidenceUrl:EVIDENCE});
  await db.exec(await readFile(second.files.sql,'utf8'));
  const oldIds=Object.values(first.bindings).map(b=>b.quoteId),newIds=Object.values(second.bindings).map(b=>b.quoteId);
  assert.equal(new Set([...oldIds,...newIds]).size,18,'renewal mints fresh quote ids');
  assert.equal((await db.query('select count(*)::int as n from luvani_private.paid_quotes where enabled')).rows[0].n,18);
  assert.equal(first.bindings['api-judge'].configurationSha256,second.bindings['api-judge'].configurationSha256,'same code, same identity');
  await resetDay(db);
  await admitApi(db,admission,first,'api-judge');
  await admitApi(db,paidAdmission({rpc,bindings:paidBindings({LUVANI_PAID_QUOTE_BINDINGS:second.bindingsJson})}),first,'api-judge',second);
  const oldExpiry=Date.parse(first.contract.quotes[0].definition.expiresAt);
  assert.ok(oldExpiry>Date.now()+5.9*86400000 && oldExpiry<=Date.now()+6*86400000,'quotes live six days, under the seven-day review rule');
 } finally {await db.close();}
});

test('the generator refuses a configuration whose session could never be admitted',async()=>{
 await assert.rejects(generate({reviewedBy:'paid-quotes-test',out:await scratch(),evidenceUrl:EVIDENCE,globalDailyMicroUsd:3000000}),/convo books \d+ microUSD.*could never be admitted/);
 await assert.rejects(generate({reviewedBy:'x',out:await scratch(),evidenceUrl:EVIDENCE}),/reviewed-by/);
 await assert.rejects(generate({reviewedBy:'paid-quotes-test',out:ROOT,evidenceUrl:EVIDENCE}),/outside the repository/);
});

test('the live-pipeline constructors the generator mirrors are still the ones agent.ts builds',async()=>{
 const agent=await readFile(join(ROOT,'services/tutor-agent/src/agent.ts'),'utf8');
 for(const line of [
  "new openai.LLM({ model: openAiLiveModel(), ...(proxy ? { baseURL: proxy.openaiBaseURL, apiKey: 'proxy-only', maxCompletionTokens: 3000 } : {}) })",
  "new deepgram.STT({ ...recognition.options, ...(keyterm.length ? { keyterm } : {}), ...(proxy ? { baseUrl: proxy.deepgramBaseURL, apiKey: 'proxy-only', sampleRate: 16000, numChannels: 1, mipOptOut: true } : {}) })",
  "conversationTier: true,",
  "...(proxy ? { baseURL: proxy.elevenlabsBaseURL, missTransport: 'http' as const } : {}),",
  "const keyterm = isConvo || recognition.experimental ? [] : lessonKeyterms(lesson);",
 ])assert.ok(agent.includes(line),`agent.ts changed: ${line}`);
});
