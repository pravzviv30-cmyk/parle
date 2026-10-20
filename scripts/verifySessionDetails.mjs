/** Synthetic financial reader/replay proof after nullable detail expiry. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const root=new URL('../',import.meta.url),db=new PGlite();
const id=n=>`a1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sid=n=>id(1000+n),aid=n=>id(2000+n),nonce=n=>id(3000+n);
const call=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`,args)).rows[0].value;
const entitlement=async n=>(await db.query('select * from public.entitlements where user_id=$1',[id(n)])).rows[0];
const usage=async n=>(await db.query('select * from public.session_usage where session_id=$1',[sid(n)])).rows[0];
const grant=async n=>(await db.query('select * from public.session_grants where session_id=$1',[sid(n)])).rows[0];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const pack=(owner,session)=>({version:1,id:sid(session),sessionId:sid(session),learnerId:id(owner),createdAt:'2026-10-04T00:00:00.000Z',lastPractisedAt:null,state:'ready',title:{fr:'Au café',en:'At the café'},summary:'A synthetic greeting',learnerGoal:null,tutorGoal:null,cefr:'A1',durationSec:45,topics:[],keyPhrases:[{fr:'Bonjour',frWritten:null,en:'Hello'}],wins:['A greeting'],corrections:[],pronunciationFocus:null,exercises:[],continuationSeed:{titleFr:'Au café',titleEn:'At the café',correctionFocus:null}});
const old=async session=>db.query("update public.session_usage set reported_at=clock_timestamp()-interval '25 months' where session_id=$1",[sid(session)]);
let groups=0;const pass=m=>{groups++;console.log(`PASS ${m}`)};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role auth_deleter;
  create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;grant select,delete on auth.users to auth_deleter;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
 const files=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)await db.exec(await readFile(new URL(`supabase/migrations/${file}`,root),'utf8'));
 const migration=files.find(file=>file.endsWith('_bounded_session_detail_retention.sql'));
 const down=await readFile(new URL(`supabase/rollback/${migration.split('_')[0]}_down.sql`,root),'utf8');
 await assert.rejects(db.exec(down));await db.exec('rollback');await db.exec("set luvani.rollback_session_details='on'");await db.exec(down);
 await db.exec(await readFile(new URL(`supabase/migrations/${migration}`,root),'utf8'));
 assert.equal((await call('expire_session_details_v2',[1])).kind,'disabled');
 pass(`all ${files.length} migrations replay; detail expiry OFF; atomic interlocked never-expired rollback/reapply restores original practice bodies`);
 for(let n=1;n<=8;n++){
  await db.query('insert into auth.users(id)values($1)',[id(n)]);await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[aid(n),id(n)]);
  await db.query("insert into public.entitlements(user_id,plan,seconds_used)values($1,'trial',0)",[id(n)]);
 }
 // Unknown older proof precedes all known work; it must not consume LIMIT1.
 await db.query('insert into public.session_grants(session_id,user_id,usage_epoch)values($1,$2,$3)',[sid(1),id(1),id(500)]);
 await db.query("insert into public.session_usage(session_id,user_id,seconds,reported_at)values($1,$2,41,clock_timestamp()-interval '26 months')",[sid(1),id(1)]);
 await db.query('update public.entitlements set seconds_used=290 where user_id=$1',[id(2)]);
 let e=await entitlement(2);
 assert.equal(await call('record_session_grant',[id(2),sid(2),e.plan,e.seconds_used,e.period_end]),true);
 await call('consume_entitlement',[id(2),100,sid(2)]);await old(2);
 assert.equal((await usage(2)).charged_seconds,10);const beforeUsage2=await usage(2),beforeGrant2=await grant(2);
 e=await entitlement(3);await call('record_session_grant',[id(3),sid(3),e.plan,e.seconds_used,e.period_end]);await call('consume_entitlement',[id(3),30,sid(3)]);await old(3);
 const historicalEpoch=(await usage(3)).usage_epoch;await db.query("update public.entitlements set plan='starter',period_end=clock_timestamp()+interval '30 days',seconds_used=7 where user_id=$1",[id(3)]);
 assert.notEqual((await entitlement(3)).usage_epoch,historicalEpoch);
 await db.exec('update public.tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000');
 await db.exec('update public.tutor_session_admission_config set max_account_daily_sessions=100,max_account_daily_seconds=90000');
 const reserve=await call('reserve_tutor_session_v1',[id(4),sid(4),'luvani-detail-proof','convo',hash({start:4}),aid(4)]);assert.equal(reserve.kind,'reserved');
 await call('claim_tutor_session_v1',[id(4),sid(4),'luvani-detail-proof','convo',nonce(4)]);
 await db.query("update public.session_grants set claimed_at=clock_timestamp()-interval '60 seconds' where session_id=$1",[sid(4)]);
 const baseline=pack(4,4),report={revision:1,seconds:45,learnerTurns:2,serviceFailure:null,baseline};
 const args=[id(4),sid(4),nonce(4),1,hash(report),45,2,null,baseline];
 const completion=await call('complete_tutor_session_v1',args);assert.equal(completion.receipt.chargedSeconds,45);await old(4);
 const beforeUsage4=await usage(4),beforeGrant4=await grant(4),e4=await entitlement(4);
 await call('configure_session_detail_retention_v2',[true]);
 const first=await call('expire_session_details_v2',[1]);assert.equal(first.detailsExpired,1);assert.equal(first.unknownLegacyDue,1);assert.equal(first.unknownLegacyDueCapped,false);
 assert.equal((await usage(1)).seconds,41);assert.equal((await usage(1)).details_expired_at,null);assert.equal((await usage(2)).seconds,null);
 const expired=await call('expire_session_details_v2',[100]);assert.equal(expired.detailsExpired,2);
 assert.equal((await call('expire_session_details_v2',[100])).detailsExpired,0);
 for(const [session,previous]of[[2,beforeUsage2],[4,beforeUsage4]]){
  const after=await usage(session);assert.equal(after.seconds,null);assert.ok(after.details_expired_at);
  for(const key of Object.keys(previous).filter(k=>!['seconds','details_expired_at'].includes(k)))assert.deepEqual(after[key],previous[key],`usage financial field changed:${key}`);
 }
 const afterGrant4=await grant(4);assert.equal(afterGrant4.checkpoint_seconds,null);assert.equal(afterGrant4.checkpoint_learner_turns,null);assert.equal(afterGrant4.checkpoint_baseline,null);assert.ok(afterGrant4.details_expired_at);
 for(const key of Object.keys(beforeGrant4).filter(k=>!['checkpoint_seconds','checkpoint_learner_turns','checkpoint_baseline','details_expired_at'].includes(k)))assert.deepEqual(afterGrant4[key],beforeGrant4[key],`grant proof changed:${key}`);
 assert.deepEqual(await grant(2),beforeGrant2);
 pass('LIMIT1 skips older unknown legacy; only known >24month elapsed details becomeNULL with explicit marker; all exact charge/epoch/refund/timestamp/receipt/digest/identity fields preserved');
 await call('consume_entitlement',[id(2),899,sid(2)]);assert.equal((await entitlement(2)).seconds_used,300);
 const refund=await call('refund_failed_session',[id(2),sid(2),'tts_error']);assert.equal(refund.refundedSeconds,10);assert.equal(refund.kind,'restored-current-period');assert.equal((await entitlement(2)).seconds_used,290);
 assert.deepEqual(await call('refund_failed_session',[id(2),sid(2),'tts_error']),refund);
 const historical=await call('refund_failed_session',[id(3),sid(3),'llm_error']);assert.equal(historical.refundedSeconds,30);assert.equal(historical.kind,'historical-reversal');assert.equal((await entitlement(3)).seconds_used,7);
 assert.deepEqual(await call('complete_tutor_session_v1',args),completion);assert.deepEqual(await entitlement(4),e4);
 await assert.rejects(call('complete_tutor_session_v1',[...args.slice(0,4),'f'.repeat(64),...args.slice(5)]),/conflicts/);
 await assert.rejects(call('complete_tutor_session_v1',[id(4),sid(4),nonce(4),1,hash(report),44,2,null,baseline]),/conflicts/);
 assert.equal((await call('checkpoint_tutor_session_v1',[id(4),sid(4),nonce(4),1,hash(report),45,2,null,baseline])).kind,'refused');
 await assert.rejects(call('refund_failed_session',[id(1),sid(1),'tts_error']),/legacy charge requires reconciliation/);
 pass('nullable elapsed details never reopen duplicate debit; capped refund remainsexact10; historical refund nevercreditsnew epoch; terminal v1 same receipt replays, changed digest/content refuses, terminal heartbeat cannot resurrect; unknown legacy stillreconciles');

 const text={sessionId:sid(4),title:'Synthetic saved text',lines:[{id:'1',who:'learner',fr:'Bonjour',frWritten:null,en:'Hello'}]};
 assert.equal(await call('save_conversation_text',[id(4),sid(4),text]),'saved');
 await db.query("update public.conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[sid(4)]);
 const work=(await db.query('select * from public.claim_conversation_practice()')).rows[0];assert.equal(work.pack_id,sid(4));assert.equal(await call('practice_job_active_v1',[sid(4),work.lease_token]),true);
 assert.equal(await call('finish_conversation_practice',[sid(4),work.lease_token,[]]),true);
 const v1=await call('export_account_data',[id(4)]);assert.equal(v1.session_usage[0].seconds,null);assert.ok(v1.session_usage[0].details_expired_at);
 await call('configure_account_export_v2',[true,134217728,100,536870912]);const exp=await call('prepare_account_export_v2',[id(4),aid(4),id(504)]);
 let archive='';for(let part=0;part<exp.totalParts;part++)archive+=Buffer.from((await call('account_export_part_v2',[id(4),aid(4),id(504),part])).dataBase64,'base64').toString('utf8');
 const records=archive.trim().split('\n').map(JSON.parse),exportUsage=records.find(r=>r.dataset==='session_usage').row,exportGrant=records.find(r=>r.dataset==='session_grants').row;
 assert.equal(exportUsage.seconds,null);assert.ok(exportUsage.details_expired_at);assert.ok(exportGrant.details_expired_at);assert.deepEqual(exportGrant.completion_receipt,completion.receipt);
 assert.ok(!('checkpoint_seconds'in exportGrant));assert.ok(!('completion_digest'in exportGrant));
 await db.exec('update public.phrase_audio_policy set enabled=true');
 const fingerprint='a'.repeat(64);await db.query("insert into public.phrase_audio_rates(voice,fingerprint,micro_usd_per_utf8_byte,fixed_call_micro_usd,verified_at,expires_at)values('alexandre',$1,1,1,clock_timestamp(),clock_timestamp()+interval '1 day')",[fingerprint]);
 const audio=await call('reserve_phrase_audio',[id(4),sid(4),'phrase',0,'alexandre',fingerprint]);assert.equal(audio.fr,'Bonjour');
 const audioBody=(await db.query("select pg_get_functiondef('public.reserve_phrase_audio(uuid,uuid,text,integer,text,text)'::regprocedure) body")).rows[0].body;
 assert.match(audioBody,/session_usage/);assert.doesNotMatch(audioBody,/(?:usage|u)\.seconds\b/);
 assert.equal((await db.query('select count(*)::integer n from public.session_usage where user_id=$1 and session_id=$2',[id(4),sid(4)])).rows[0].n,1);
 pass('savedtext, practiceclaim/active/finish and explicit v1/v2 export NULL+expiry semantics still work; owned completion proof for audio remains intact');

 for(let n=10;n<130;n++){
  const p=pack(5,n);await call('receive_conversation_practice',[p,false]);
  await db.query("update public.conversation_practice_jobs set attempts=5,status='running',lease_until=clock_timestamp()-interval '1 hour',available_at=clock_timestamp()-interval '1 day' where pack_id=$1",[sid(n)]);
 }
 for(let n=200;n<440;n++){
  await call('receive_conversation_practice',[pack(5,n),false]);
  await db.query("update public.conversation_practice_jobs set available_at=clock_timestamp()-interval '1 day' where pack_id=$1",[sid(n)]);
  if(n<320)await db.query("update public.conversation_packs set state='archived' where id=$1",[sid(n)]);
  else await db.query('insert into public.conversation_practice_tombstones(pack_id)values($1)',[sid(n)]);
 }
 const pending=pack(6,130);await call('receive_conversation_practice',[pending,false]);await db.query("update public.conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[sid(130)]);
 const eligible=(await db.query('select * from public.claim_conversation_practice()')).rows[0];assert.equal(eligible.pack_id,sid(130));
 assert.equal((await db.query("select count(*)::integer n from public.conversation_practice_jobs where status='running' and attempts=5 and pack_id<>$1",[sid(130)])).rows[0].n,120,'claim must not perform unbounded exhausted update');
 assert.equal((await call('reconcile_practice_jobs_v1',[100])).exhaustedJobsEnded,100);assert.equal((await call('reconcile_practice_jobs_v1',[100])).exhaustedJobsEnded,20);
 assert.equal(await call('practice_job_active_v1',[sid(130),nonce(130)]),false);assert.equal(await call('practice_job_active_v1',[sid(130),eligible.lease_token]),true);
 await db.query("update public.conversation_packs set state='archived' where id=$1",[sid(130)]);
 assert.equal(await call('practice_job_active_v1',[sid(130),eligible.lease_token]),false);assert.equal(await call('finish_conversation_practice',[sid(130),eligible.lease_token,[]]),false);
 await db.query("update public.conversation_packs set state='ready' where id=$1",[sid(130)]);
 await db.query('insert into public.conversation_practice_tombstones(pack_id)values($1)',[sid(130)]);
 assert.equal(await call('practice_job_active_v1',[sid(130),eligible.lease_token]),false);assert.equal(await call('finish_conversation_practice',[sid(130),eligible.lease_token,[]]),false);
 // Remove only this synthetic marker to isolate the independent account-fence case.
 await db.query('delete from public.conversation_practice_tombstones where pack_id=$1',[sid(130)]);
 await call('begin_account_erasure_v1',[id(6),false]);assert.equal(await call('practice_job_active_v1',[sid(130),eligible.lease_token]),false);
 assert.equal(await call('finish_conversation_practice',[sid(130),eligible.lease_token,[]]),false);await assert.rejects(call('receive_conversation_practice',[pending,true]),/inactive practice owner/);
 const doomed=pack(7,131);await call('receive_conversation_practice',[doomed,false]);await db.query("update public.conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[sid(131)]);
 const deletedWork=(await db.query('select * from public.claim_conversation_practice()')).rows[0];assert.equal(deletedWork.pack_id,sid(131));
 await db.exec('set role auth_deleter');await db.query('delete from auth.users where id=$1',[id(7)]);await db.exec('reset role');
 assert.equal(await call('practice_job_active_v1',[sid(131),deletedWork.lease_token]),false);assert.equal(await call('finish_conversation_practice',[sid(131),deletedWork.lease_token,[]]),false);await assert.rejects(call('receive_conversation_practice',[doomed,true]),/inactive practice owner/);
 pass('claim skips120exhausted+120archived+120tombstoned older jobs before boundedLIMIT without bulkUPDATE; maintenance finalizes100then20; wronglease/archived/tombstoned/fenced/deleted owner blocks dispatch/finish/receive and cascade cannot resurrect pack');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const[name,args]of[['configure_session_detail_retention_v2',[true]],['expire_session_details_v2',[1]],['practice_job_active_v1',[sid(130),eligible.lease_token]],['reconcile_practice_jobs_v1',[1]],['claim_conversation_practice',[]],['receive_conversation_practice',[pending,false]],['finish_conversation_practice',[sid(130),eligible.lease_token,[]]]])await assert.rejects(call(name,args));
  await assert.rejects(db.query('select * from luvani_private.session_detail_retention_config'));await db.exec('reset role');
 }
 await call('configure_session_detail_retention_v2',[false]);await assert.rejects(db.exec(down),/expiry evidence exists/);await db.exec('rollback');
 assert.equal((await usage(2)).seconds,null);
 pass('all new/restated routines denyapp roles; issued expiry rollback refuses even afterOFF and leaves permanentproof/NULLdetail intact');
 console.log(JSON.stringify({status:'pass',migrationCount:files.length,proofGroups:groups,financialReplayVerified:true,hostedConcurrencyVerified:false}));
}catch(error){console.error('FAIL disposable detail/practice proof:',error instanceof Error?error.message:'sanitized failure');process.exitCode=1;}finally{await db.close();}
