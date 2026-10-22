/** All prices/evidence here are SYNTHETIC integer test units, not vendor quotes.
 * Real sequential PostgreSQL/WASM proof; no hosted/provider calls or user data.
 * Independent PostgreSQL concurrency, invoice economics and SDK envelopes external.
 * Exception: the lesson scoring group seeds the reviewed LESSON_SCORING_COMPONENT
 * (cost-model price, not a vendor quote); every other price stays synthetic.
 */
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { CONVO_SCORING_COMPONENT, LESSON_SCORING_COMPONENT } from '../services/shared/lessonScoringQuote.ts';
import { describePaidHttp } from '../services/shared/paidExecution.ts';
import { toSpeechaceWav } from '../services/shared/liveScoringAudio.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),db=new PGlite(),groups=[];
const migration='20261004010327_whole_product_paid_admission.sql';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const auth=n=>id(1000+n),hash=s=>createHash('sha256').update(String(s)).digest('hex');
const qid=n=>id(2000+n),opid=n=>id(3000+n),sid=n=>id(4000+n);
async function role(name='',user=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);if(name)await db.exec(`set role ${name}`);}
async function rpc(name,args=[]){await role('service_role');try{return (await db.query(`select public.${name}(${args.map((_,n)=>`$${n+1}`).join(',')}) as value`,args.map(a=>a&&typeof a==='object'?JSON.stringify(a):a))).rows[0].value;}finally{await role();}}
const comp=(key='judge',kind='llm',more={})=>({key,kind,provider:'openai',model:'offline-fixture-model',voice:'',configurationSha256:hash('component-config'),maxEffects:2,maxProviderAttempts:2,maxInputBytes:1024,maxOutputTokens:600,maxAudioMillis:0,maxTextBytes:0,microUsd:100,...more});
const quote=(activity='api-judge',components=[comp()])=>({activity,components,configurationSha256:hash('config'),reviewedBy:'offline-fixture-reviewer',evidenceUrl:'https://fixture.test/synthetic-terms',evidenceSha256:hash('synthetic nonprice evidence'),expiresAt:new Date(Date.now()+3600000).toISOString()});
const apiContext=(n,op)=>({kind:'api',authSessionId:auth(n),operationId:opid(op)});
const reserve=(n,op,q=1,ctx=apiContext(n,op),digest=hash('request'))=>rpc('reserve_paid_operation_v1',[id(n),opid(op),qid(q),hash('config'),ctx,digest]);
const quantities={inputBytes:512,outputTokens:600,audioMillis:0,textBytes:0};
const effect=(n,op,e=op,ctx=apiContext(n,op),qty=quantities,component='judge',cfg=hash('component-config'),attempts=2)=>rpc('claim_paid_effect_v1',[id(n),opid(op),id(5000+e),component,cfg,qty,attempts,ctx]);
const seedQuote=(n,definition=quote())=>db.query('insert into luvani_private.paid_quotes(id,enabled,definition) values($1,true,$2::jsonb)',[qid(n),JSON.stringify(definition)]);
const snapshot=async()=> (await db.query(`select jsonb_build_object('global',(select jsonb_agg(to_jsonb(t)order by day)from luvani_private.paid_global_days t),'account',(select jsonb_agg(to_jsonb(t)order by user_id,day)from luvani_private.paid_account_days t),'vendor',(select jsonb_agg(to_jsonb(t)order by day,provider)from luvani_private.paid_vendor_days t)) as value`)).rows[0].value;
const enable=()=>db.query("update luvani_private.paid_admission_config set enabled=true,global_daily_micro_usd=10000,account_daily_micro_usd=10000,global_daily_operations=100,account_daily_operations=100,global_daily_calls=1000,account_daily_calls=1000,reviewed_by='offline-fixture-reviewer',evidence_url='https://fixture.test/synthetic-terms',evidence_sha256=$1,expires_at=clock_timestamp()+interval '1 hour'",[hash('review')]);
const down=await readFile(`${root}/supabase/rollback/20261004010327_down.sql`,'utf8');
const refusedDown=async pattern=>{await assert.rejects(db.exec(down),pattern);await db.exec('rollback');};
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role auth_deleter;
  create schema auth;create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id)on delete cascade,not_after timestamptz);
  create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;grant select,delete on auth.users to auth_deleter;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
 const migrations=(await readdir(`${root}/supabase/migrations`)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations)await db.exec(await readFile(`${root}/supabase/migrations/${file}`,'utf8'));
 assert.equal((await rpc('paid_admission_schema_v1')).enabled,false);
 for(let n=1;n<=6;n++){await db.query('insert into auth.users(id)values($1)',[id(n)]);await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[auth(n),id(n)]);await db.query("insert into entitlements(user_id,plan,period_end)values($1,'regular',clock_timestamp()+interval '30 days')",[id(n)]);}
 // A paid allowance, so a 900-second reservation is the admission ceiling under test and not the weekly free taste (D24, 300 seconds).
 for(const name of ['anon','authenticated','service_role']){
  await role(name,id(1));
  for(const table of ['paid_admission_config','paid_admission_vendors','paid_quotes','paid_global_days','paid_vendor_days','paid_account_days','paid_operations','paid_effects','tutor_account_budget_days','paid_execution_global_days','paid_execution_account_days','paid_execution_vendor_days','paid_component_days'])await assert.rejects(db.exec(`select * from luvani_private.${table}`),e=>e.code==='42501');
  await assert.rejects(db.exec('select luvani_private.paid_quote_valid_v1(null)'),e=>e.code==='42501');
  if(name!=='service_role')for(const sql of ['select public.paid_admission_schema_v1()',"select public.reserve_paid_operation_v1(null,null,null,null,null,null)","select public.claim_paid_effect_v1(null,null,null,null,null,null,null,null)","select public.resume_paid_tutor_v1(null,null,null)"])await assert.rejects(db.exec(sql),e=>e.code==='42501');
 }
 await role();groups.push(`all ${migrations.length} migrations; OFF defaults and closed table/helper/client RPC ACLs`);
 await refusedDown(/maintenance/);await db.exec("select set_config('luvani.paid_rollback_maintenance','approved',false)");
 await db.exec(down);await db.exec(await readFile(`${root}/supabase/migrations/${migration}`,'utf8'));
 assert.equal((await rpc('paid_admission_schema_v1')).enabled,false);groups.push('atomic default refusal and unissued-only maintenance rollback/reapply');

 for(const change of [p=>p.activity=null,p=>p.components[0].provider=null,p=>p.components[0].kind=null,p=>p.components[0].maxProviderAttempts=0,p=>p.components[0].microUsd=0,p=>p.components[0].maxOutputTokens=0,p=>p.components[0].maxTextBytes=1,p=>p.components[0].maxEffects=1024,p=>p.components[0].maxEffects='2',p=>p.evidenceUrl='http://fixture.test',p=>p.expiresAt=new Date(Date.now()+8*86400000).toISOString(),p=>p.components.push({...p.components[0]})]){
  const p=quote();change(p);await assert.rejects(seedQuote(99,p));
 }
 await seedQuote(1);await assert.rejects(db.query('update luvani_private.paid_quotes set definition=$1::jsonb where id=$2',[JSON.stringify(quote('practice')),qid(1)]),e=>e.code==='PT409');
 assert.equal((await reserve(1,1)).reason,'admission-disabled');assert.deepEqual(await snapshot(),{global:null,account:null,vendor:null});
 await assert.rejects(db.exec('update luvani_private.paid_admission_config set enabled=true'),e=>e.code==='PT400');
 await enable();await db.exec('update luvani_private.paid_admission_vendors set enabled=true,daily_micro_usd=10000,daily_operations=100,daily_calls=1000');
 groups.push('null-safe strict quote/review/applicable quantity/immutable revision validation; no fabricated prices or zero-cost activation');

 const booked=await reserve(1,1);assert.equal(booked.microUsd,100);assert.equal(booked.providerCalls,4);assert.equal(booked.replayed,false);
 const once=await snapshot();assert.equal((await reserve(1,1)).replayed,true);assert.deepEqual(await snapshot(),once);
 await assert.rejects(reserve(1,1,1,apiContext(1,1),hash('changed')),e=>e.code==='PT409');
 await assert.rejects(reserve(2,1,1,apiContext(2,1)),e=>e.code==='PT409');
 for(const [target,set] of [['global-budget','global_daily_micro_usd=100'],['account-budget','global_daily_micro_usd=10000,account_daily_micro_usd=100']]){
  await db.exec(`update luvani_private.paid_admission_config set ${set}`);assert.equal((await reserve(1,2)).reason,target);assert.deepEqual(await snapshot(),once);
 }
 await db.exec('update luvani_private.paid_admission_config set account_daily_micro_usd=10000');await db.exec("update luvani_private.paid_admission_vendors set daily_micro_usd=100 where provider='openai'");
 assert.equal((await reserve(1,2)).reason,'vendor-budget');assert.deepEqual(await snapshot(),once);
 await db.exec('update luvani_private.paid_admission_vendors set daily_micro_usd=10000');
 for(const [expected,assignment]of [['global-budget','global_daily_operations=1'],['global-budget','global_daily_calls=4'],['account-budget','account_daily_operations=1'],['account-budget','account_daily_calls=4']]){
  await enable();await db.exec(`update luvani_private.paid_admission_config set ${assignment}`);assert.equal((await reserve(1,2)).reason,expected);assert.deepEqual(await snapshot(),once);
 }
 await enable();
 for(const assignment of ['daily_operations=1','daily_calls=4']){
  await db.exec(`update luvani_private.paid_admission_vendors set ${assignment} where provider='openai'`);assert.equal((await reserve(1,2)).reason,'vendor-budget');assert.deepEqual(await snapshot(),once);
  await db.exec('update luvani_private.paid_admission_vendors set daily_operations=100,daily_calls=1000');
 }

 for(const ctx of [apiContext(2,2),{...apiContext(1,2),extra:'not accepted'}]){
  if(ctx.extra)await assert.rejects(reserve(1,2,1,ctx),e=>e.code==='PT400');else assert.equal((await reserve(1,2,1,ctx)).reason,'inactive-context');assert.deepEqual(await snapshot(),once);
 }
 groups.push('atomic global/account/vendor day admission; exact replay/conflicts/inactive identity; refusal leaves every counter untouched');

 assert.equal((await effect(1,1,1)).dispatch,true);assert.equal((await effect(1,1,1)).dispatch,false);
 await assert.rejects(effect(1,1,1,apiContext(1,1),{...quantities,inputBytes:511}),e=>e.code==='PT409');
 assert.equal((await effect(1,1,2)).dispatch,true);assert.equal((await effect(1,1,3)).reason,'effect-limit');
 assert.equal((await effect(1,1,4,apiContext(1,1),{...quantities,inputBytes:1025})).reason,'quantity-limit');
 assert.equal((await effect(1,1,4,apiContext(1,1),quantities,'judge',hash('wrong-config'))).reason,'quote-mismatch');
 assert.equal((await effect(1,1,4,apiContext(1,1),quantities,'judge',hash('component-config'),3)).reason,'quote-mismatch');
 await assert.rejects(effect(1,1,4,apiContext(1,1),{...quantities,audioMillis:null}),e=>e.code==='PT400');
 assert.deepEqual(await snapshot(),once);groups.push('first dispatch only, lost-ACK replay false, conflicting digest rejected, logical-effect/retry/input/output limits; no exposure recycling');

 await db.exec("update luvani_private.paid_admission_config set expires_at=clock_timestamp()+interval '0.2 seconds'");await new Promise(resolve=>setTimeout(resolve,350));
 assert.equal((await rpc('paid_admission_schema_v1')).enabled,false);assert.equal((await effect(1,1,99)).reason,'admission-disabled');await enable();
 await seedQuote(2,quote('lesson-text'));
 await db.exec('update tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000,max_account_daily_sessions=1,max_account_daily_seconds=900');
 const tutor=(n,s)=>rpc('reserve_tutor_session_v1',[id(n),sid(s),`proof-${s}`,'lesson-text',hash(`tutor-${s}`),auth(n)]);
 const admitted=await tutor(3,1);assert.equal(admitted.reservedSeconds,900);
 const tutorCtx={kind:'tutor',sessionId:sid(1)};assert.equal((await reserve(3,3,2,tutorCtx)).kind,'reserved');
 assert.equal((await reserve(3,4,2,tutorCtx)).reason,'context-already-reserved');
 assert.equal((await rpc('resume_paid_tutor_v1',[id(3),sid(1),id(6001)])).reason,'inactive-context');
 await rpc('claim_tutor_session_v1',[id(3),sid(1),'proof-1','lesson-text',id(6001)]);
 const resumed=await rpc('resume_paid_tutor_v1',[id(3),sid(1),id(6001)]);
 assert.equal(resumed.operationId,opid(3));assert.equal(resumed.requestDigest,hash('request'));
 assert.equal(resumed.expiresAt,(await reserve(3,3,2,tutorCtx)).expiresAt);
 assert.equal((await rpc('resume_paid_tutor_v1',[id(3),sid(1),id(6002)])).reason,'inactive-context');
 assert.equal((await rpc('resume_paid_tutor_v1',[id(2),sid(1),id(6001)])).reason,'not-reserved');
 assert.equal((await rpc('resume_paid_tutor_v1',[id(3),sid(99),id(6001)])).reason,'not-reserved');
 assert.equal((await reserve(3,3,2,tutorCtx)).replayed,true);
 assert.equal((await effect(3,3,3,{...tutorCtx,claimNonce:id(6002)})).reason,'inactive-context');
 assert.equal((await effect(3,3,3,{...tutorCtx,claimNonce:id(6001)})).dispatch,true);
 const retained=await snapshot();await rpc('abandon_tutor_session_v1',[id(3),sid(1)]);
 assert.equal((await effect(3,3,4,{...tutorCtx,claimNonce:id(6001)})).reason,'inactive-context');
 assert.equal((await rpc('resume_paid_tutor_v1',[id(3),sid(1),id(6001)])).reason,'inactive-context');
 await rpc('complete_tutor_session_v1',[id(3),sid(1),id(6001),0,hash('terminal'),0,0,null,null]);
 assert.equal((await tutor(3,2)).reason,'account-daily-budget');assert.deepEqual(await snapshot(),retained);
 await db.exec('update tutor_session_admission_config set max_account_daily_sessions=2,max_account_daily_seconds=900');
 assert.equal((await tutor(3,2)).reason,'account-daily-budget','owner issued seconds cap not enforced');
 await db.exec('update tutor_session_admission_config set max_account_daily_sessions=1,max_account_daily_seconds=1800');
 assert.equal((await tutor(3,2)).reason,'account-daily-budget','owner issued session count cap not enforced');

 assert.equal((await db.query('select seconds_used from entitlements where user_id=$1',[id(3)])).rows[0].seconds_used,0);
 groups.push('expiry kill switch; tutor current nonce/lease; exactly one envelope; active cancellation keeps cost and per-account count/seconds despite learner zero-charge settlement');

 // Full voice envelope must cover authoritative duration and every required
 // provider family. Phrase audio participates in the SAME aggregate counters.
 const stt=comp('stt','stt',{provider:'deepgram',model:'offline-stt',maxEffects:1,maxProviderAttempts:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:119999,microUsd:100});
 const tts=comp('tts','tts',{provider:'elevenlabs',model:'offline-tts',voice:'offline-voice',maxEffects:1,maxProviderAttempts:1,maxInputBytes:0,maxOutputTokens:0,maxTextBytes:512,microUsd:100});
 await seedQuote(4,quote('lesson',[comp('brain'),stt,tts]));
 assert.equal((await rpc('reserve_tutor_session_v1',[id(5),sid(5),'voice-proof','lesson',hash('voice-proof'),auth(5)])).reservedSeconds,900);
 const voiceCtx={kind:'tutor',sessionId:sid(5)};
 const beforeVoice=await snapshot();assert.equal((await reserve(5,50,4,voiceCtx)).reason,'inactive-context');assert.deepEqual(await snapshot(),beforeVoice);
 await seedQuote(5,quote('lesson',[comp('brain'),{...stt,maxAudioMillis:900000},tts]));
 assert.equal((await reserve(5,50,5,voiceCtx)).microUsd,300);
 await seedQuote(6,quote('phrase-audio',[tts]));const beforePhrase=await snapshot();assert.equal((await reserve(2,51,6)).microUsd,100);
 const afterPhrase=await snapshot();assert.equal(afterPhrase.global[0].micro_usd,beforePhrase.global[0].micro_usd+100);
 assert.equal(afterPhrase.vendor.find(v=>v.provider==='elevenlabs').micro_usd,beforePhrase.vendor.find(v=>v.provider==='elevenlabs').micro_usd+100);
 groups.push('voice quote requires full LLM/STT/TTS and funded duration; phrase audio contributes atomic shared global/owner/vendor exposure');

 // A real ready baseline and a real current lease, not an invented dispatch flag.
 const packId=sid(9),pack={id:packId,sessionId:packId,learnerId:id(4),state:'ready',createdAt:new Date().toISOString(),title:{fr:'Fixture',en:'Fixture'},keyPhrases:[],corrections:[],exercises:[]};
 await rpc('receive_conversation_practice',[pack,false]);await db.query("update conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[packId]);
 await rpc('claim_conversation_practice');
 // Read the exact SQL-owned lease produced by the real claim in this fixture.
 const current=(await db.query('select lease_token from conversation_practice_jobs where pack_id=$1',[packId])).rows[0].lease_token;
 assert.ok(current);await seedQuote(3,quote('practice'));
 const practiceCtx={kind:'practice',packId,leaseToken:current};assert.equal((await reserve(4,4,3,practiceCtx)).kind,'reserved');
 assert.equal((await effect(4,4,4,practiceCtx)).dispatch,true);await db.query("update conversation_practice_jobs set lease_token=$2 where pack_id=$1",[packId,id(6999)]);
 assert.equal((await effect(4,4,5,practiceCtx)).reason,'inactive-context');
 await db.query('insert into conversation_practice_tombstones(pack_id)values($1)on conflict do nothing',[packId]);
 assert.equal((await reserve(4,5,3,{...practiceCtx,leaseToken:id(6999)})).reason,'inactive-context');
 groups.push('durable practice exact current lease, stale retry and deleted-pack tombstone dispatch refusal');

 const executionBeforeErase=(await db.query('select to_jsonb(t) as value from luvani_private.paid_execution_global_days t order by day')).rows;
 const vendorExecutionBeforeErase=(await db.query('select to_jsonb(t) as value from luvani_private.paid_execution_vendor_days t order by day,provider')).rows;
 const beforeErase=await snapshot();await rpc('fence_tutor_account_v1',[id(1)]);assert.equal((await reserve(1,20)).reason,'inactive-context');assert.equal((await effect(1,1,20)).reason,'inactive-context');
 await role('auth_deleter');await db.query('delete from auth.users where id=$1',[id(1)]);await role();
 assert.equal((await db.query('select count(*)::int as n from luvani_private.paid_operations where user_id=$1',[id(1)])).rows[0].n,0);
 assert.deepEqual((await db.query('select to_jsonb(t) as value from luvani_private.paid_execution_global_days t order by day')).rows,executionBeforeErase);
 assert.deepEqual((await db.query('select to_jsonb(t) as value from luvani_private.paid_execution_vendor_days t order by day,provider')).rows,vendorExecutionBeforeErase);
 assert.equal((await db.query('select count(*)::int as n from luvani_private.paid_execution_account_days where user_id=$1',[id(1)])).rows[0].n,0);
 const afterErase=await snapshot();assert.deepEqual(afterErase.global,beforeErase.global);assert.deepEqual(afterErase.vendor,beforeErase.vendor);
 assert.equal((await reserve(1,21)).reason,'inactive-owner');
 await db.exec('update luvani_private.paid_admission_config set enabled=false,ever_issued=false');assert.equal((await db.query('select ever_issued from luvani_private.paid_admission_config')).rows[0].ever_issued,true);
 await db.exec('update tutor_session_admission_config set enabled=false');await refusedDown(/exposure issued/);
 groups.push('account fence/restricted auth deletion erase only owner proof; global/vendor aggregates and sticky rollback remain; no returned exposure');

 // UTC bucketing does not follow connection timezone. Yesterday's retained totals
 // are not reused/reset by new-day insertion; real midnight lock races external.
 await enable();await db.exec("set timezone='Pacific/Honolulu'");assert.equal((await reserve(2,22)).day,new Date().toISOString().slice(0,10));
 await assert.rejects(db.exec('update luvani_private.paid_global_days set calls=1000001'),e=>e.code==='23514');
 groups.push('server UTC day independent of connection timezone; finite persisted counters; actual cross-midnight independent concurrency remains external');
 // Controlled-clock executable proof uses the SAME SQL body with only its two
 // server-clock reads substituted in this disposable DB. No clock override is
 // shipped in the migration. Genuine concurrent/midnight PostgreSQL is external.
 const claimSignature='public.claim_paid_effect_v1(uuid,uuid,uuid,text,text,jsonb,integer,jsonb)';
 const claimSource=(await db.query('select pg_get_functiondef($1::regprocedure)as value',[claimSignature])).rows[0].value;
 assert.equal((claimSource.match(/stamp:=clock_timestamp\(\);/g)||[]).length,2);
 await db.exec("create function luvani_private.paid_fixture_clock()returns timestamptz language sql as $$select current_setting('luvani.paid_fixture_clock')::timestamptz$$");
 await db.exec(claimSource.replaceAll('stamp:=clock_timestamp();','stamp:=luvani_private.paid_fixture_clock();'));
 await enable();await db.exec("update luvani_private.paid_admission_config set expires_at=clock_timestamp()+interval '3 days'");
 await db.exec('update luvani_private.paid_admission_vendors set daily_micro_usd=10000,daily_calls=1000,daily_operations=100');
 const crossing=quote('api-judge',[comp('judge','llm',{maxEffects:4})]);crossing.expiresAt=new Date(Date.now()+3*86400000).toISOString();await seedQuote(90,crossing);
 await reserve(6,90,90);
 const reservationBeforeMidnight=await snapshot();
 const utcToday=new Date().toISOString().slice(0,10),midnight=new Date(`${utcToday}T00:00:00Z`).getTime()+86400000;
 const execSnapshot=async()=> (await db.query(`select jsonb_build_object('global',(select jsonb_agg(to_jsonb(t)order by day)from luvani_private.paid_execution_global_days t),'account',(select jsonb_agg(to_jsonb(t)order by user_id,day)from luvani_private.paid_execution_account_days t),'vendor',(select jsonb_agg(to_jsonb(t)order by day,provider)from luvani_private.paid_execution_vendor_days t),'component',(select jsonb_agg(to_jsonb(t)order by operation_id,component_key,day)from luvani_private.paid_component_days t),'effect',(select jsonb_agg(to_jsonb(t)order by operation_id,effect_id)from luvani_private.paid_effects t))as value`)).rows[0].value;
 const fixtureClock=stamp=>db.query("select set_config('luvani.paid_fixture_clock',$1,false)",[new Date(stamp).toISOString()]);
 await fixtureClock(midnight-100);const beforeDayOne=await execSnapshot();
 const dayOne=await effect(6,90,901,apiContext(6,90));assert.equal(dayOne.dispatch,true);assert.equal(dayOne.executionDay,utcToday);assert.equal(dayOne.executionMicroUsdCharged,100);assert.equal(Date.parse(dayOne.dispatchUntil),midnight);
 const afterDayOne=await execSnapshot();assert.equal(afterDayOne.global.find(r=>r.day===utcToday).micro_usd,beforeDayOne.global.find(r=>r.day===utcToday).micro_usd+100);
 await fixtureClock(midnight+100);const afterMidnight=await execSnapshot();
 const replayAcross=await effect(6,90,901,apiContext(6,90));assert.equal(replayAcross.dispatch,false);assert.equal(replayAcross.executionDay,utcToday);assert.deepEqual(await execSnapshot(),afterMidnight);
 // Cost refusal is independent for every scope and creates no partial day row,
 // component charge or consumed effect fence. Original reservation is unchanged.
 for(const [scope,assignment]of [['global-execution-budget','global_daily_micro_usd=99'],['account-execution-budget','global_daily_micro_usd=10000,account_daily_micro_usd=99']]){
  await db.exec(`update luvani_private.paid_admission_config set ${assignment}`);
  assert.equal((await effect(6,90,902,apiContext(6,90))).reason,scope);assert.deepEqual(await execSnapshot(),afterMidnight);assert.deepEqual(await snapshot(),reservationBeforeMidnight);
 }
 await db.exec('update luvani_private.paid_admission_config set account_daily_micro_usd=10000');await db.exec("update luvani_private.paid_admission_vendors set daily_micro_usd=99 where provider='openai'");
 assert.equal((await effect(6,90,902,apiContext(6,90))).reason,'vendor-execution-budget');assert.deepEqual(await execSnapshot(),afterMidnight);
 await db.exec("update luvani_private.paid_admission_vendors set daily_micro_usd=10000 where provider='openai'");
 const dayTwo=await effect(6,90,902,apiContext(6,90));assert.equal(dayTwo.executionMicroUsdCharged,100);assert.equal(dayTwo.executionProviderCalls,2);assert.equal(dayTwo.executionDay,new Date(midnight).toISOString().slice(0,10));
 const onceDayTwo=await execSnapshot();
 for(const [scope,assignment]of [['global-execution-budget','global_daily_calls=2'],['account-execution-budget','global_daily_calls=1000,account_daily_calls=2']]){
  await db.exec(`update luvani_private.paid_admission_config set ${assignment}`);assert.equal((await effect(6,90,903,apiContext(6,90))).reason,scope);assert.deepEqual(await execSnapshot(),onceDayTwo);
 }
 await db.exec('update luvani_private.paid_admission_config set account_daily_calls=1000');await db.exec("update luvani_private.paid_admission_vendors set daily_calls=2 where provider='openai'");
 assert.equal((await effect(6,90,903,apiContext(6,90))).reason,'vendor-execution-budget');assert.deepEqual(await execSnapshot(),onceDayTwo);
 await db.exec("update luvani_private.paid_admission_vendors set daily_calls=1000 where provider='openai'");
 const sameDay=await effect(6,90,903,apiContext(6,90));assert.equal(sameDay.executionMicroUsdCharged,0);assert.equal(sameDay.executionProviderCalls,2);
 await fixtureClock(midnight+86400000+100);const dayThree=await effect(6,90,904,apiContext(6,90));assert.equal(dayThree.executionMicroUsdCharged,100);
 assert.equal((await effect(6,90,905,apiContext(6,90))).reason,'effect-limit');assert.deepEqual(await snapshot(),reservationBeforeMidnight);
 const componentDayRows=(await db.query('select day,micro_usd from luvani_private.paid_component_days where operation_id=$1 order by day',[opid(90)])).rows;assert.equal(componentDayRows.length,3);assert.ok(componentDayRows.every(r=>r.micro_usd===100));
 await db.exec(claimSource);await db.exec('drop function luvani_private.paid_fixture_clock()');
 groups.push('controlled SQL UTC midnight: original exposure retained; full component charged once each execution day; independent cost/call refusals atomic; lost ACK never rebooks; deadline and finite total effects');

 // Disposable pre-A20 baseline and tutor-only erased-owner rollback regression.
 // This fixture has NO paid operation, so paid ever_issued cannot hide a defect.
 const baselineDb=new PGlite();
 try {
  await baselineDb.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role auth_deleter;create schema auth;
   create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id)on delete cascade,not_after timestamptz);
   create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;grant select,delete on auth.users to auth_deleter;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  for(const file of migrations.filter(f=>f<migration))await baselineDb.exec(await readFile(`${root}/supabase/migrations/${file}`,'utf8'));
  await baselineDb.query('insert into auth.users(id)values($1)',[id(90)]);await baselineDb.query('insert into auth.sessions(id,user_id)values($1,$2)',[auth(90),id(90)]);
  await baselineDb.query("insert into entitlements(user_id,plan)values($1,'trial')",[id(90)]);
  await baselineDb.exec('update tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000');
  await baselineDb.exec('set role service_role');
  assert.equal((await baselineDb.query("select public.reserve_tutor_session_v1($1,$2,'baseline-proof','lesson-text',$3,$4)as value",[id(90),sid(90),hash('baseline'),auth(90)])).rows[0].value.reservedSeconds,900);
  await baselineDb.query('select public.abandon_tutor_session_v1($1,$2)',[id(90),sid(90)]);await baselineDb.exec('reset role');
  const preserved=async()=>(await baselineDb.query(`select jsonb_build_object('grants',(select jsonb_agg(to_jsonb(t)order by session_id)from public.session_grants t),'usage',(select jsonb_agg(to_jsonb(t)order by session_id)from public.session_usage t),'global',(select jsonb_agg(to_jsonb(t)order by day)from public.tutor_session_budget_days t))as value`)).rows[0].value;
  const beforeBaseline=await preserved();await baselineDb.exec(await readFile(`${root}/supabase/migrations/${migration}`,'utf8'));assert.deepEqual(await preserved(),beforeBaseline);
  const ownerBaseline=(await baselineDb.query('select issued_sessions,issued_seconds from luvani_private.tutor_account_budget_days where user_id=$1',[id(90)])).rows[0];assert.deepEqual(ownerBaseline,{issued_sessions:1,issued_seconds:900});
  assert.equal((await baselineDb.query('select ever_issued from luvani_private.paid_admission_config')).rows[0].ever_issued,false);
  await baselineDb.exec('set role auth_deleter');await baselineDb.query('delete from auth.users where id=$1',[id(90)]);await baselineDb.exec('reset role');
  assert.equal((await baselineDb.query('select count(*)::int as n from luvani_private.tutor_account_budget_days')).rows[0].n,0);
  await baselineDb.exec("update tutor_session_admission_config set enabled=false;select set_config('luvani.paid_rollback_maintenance','approved',false)");
  await assert.rejects(baselineDb.exec(down),/exposure issued/);await baselineDb.exec('rollback');
  assert.equal((await baselineDb.query('select sum(issued_seconds)::int as n from public.tutor_session_budget_days')).rows[0].n,900);
 }finally{await baselineDb.close();}
 groups.push('legacy owner issued-count/seconds backfill lossless for every prior grant/usage/global field; tutor-only exposure rollback remains refused after owner erasure');

 // F863: a live lesson score claims the reviewed scoring component of the bound
 // lesson quote. Fresh users/sessions; budgets raised only for this last group.
 await enable();await db.exec('update luvani_private.paid_admission_config set global_daily_micro_usd=1000000,account_daily_micro_usd=1000000');
 await db.exec('update luvani_private.paid_admission_vendors set enabled=true,daily_micro_usd=1000000,daily_operations=100,daily_calls=1000');
 await db.exec('update tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000,max_account_daily_sessions=1,max_account_daily_seconds=900');
 const capture=(()=>{const bytes=48000*30*4,b=Buffer.alloc(44+bytes);b.write('RIFF',0,'ascii');b.writeUInt32LE(36+bytes,4);b.write('WAVE',8,'ascii');b.write('fmt ',12,'ascii');b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(192000,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36,'ascii');b.writeUInt32LE(bytes,40);return b;})();
 const scoringForm=new FormData();scoringForm.append('text','Bonjour');scoringForm.append('user_audio_file',new Blob([toSpeechaceWav(capture)]),'utterance.wav');scoringForm.append('dialect','fr-fr');
 const scored=await describePaidHttp(new URL('https://api.speechace.co/api/scoring/text/v9/json?key=synthetic&dialect=fr-fr'),{method:'POST',body:scoringForm});
 assert.equal(scored.quantities.audioMillis,30000);
 const scoringSession=async(n,q,components,mode='lesson')=>{
  await db.query('insert into auth.users(id)values($1)',[id(n)]);await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[auth(n),id(n)]);await db.query("insert into entitlements(user_id,plan,period_end)values($1,'regular',clock_timestamp()+interval '30 days')",[id(n)]);
  await seedQuote(q,quote(mode,components));
  assert.equal((await rpc('reserve_tutor_session_v1',[id(n),sid(q),`scoring-proof-${q}`,mode,hash(`scoring-proof-${q}`),auth(n)])).reservedSeconds,900);
  const ctx={kind:'tutor',sessionId:sid(q)};assert.equal((await reserve(n,q,q,ctx)).kind,'reserved');
  await rpc('claim_tutor_session_v1',[id(n),sid(q),`scoring-proof-${q}`,mode,id(6000+q)]);
  assert.equal((await rpc('resume_paid_tutor_v1',[id(n),sid(q),id(6000+q)])).operationId,opid(q));
  return effect(n,q,q,{...ctx,claimNonce:id(6000+q)},scored.quantities,'scoring',LESSON_SCORING_COMPONENT.configurationSha256,1);
 };
 const lessonStt={...stt,maxAudioMillis:900000};
 const firstScore=await scoringSession(7,70,[comp('brain'),lessonStt,tts,{...LESSON_SCORING_COMPONENT}]);
 assert.equal(firstScore.dispatch,true);assert.equal(firstScore.executionMicroUsdCharged,96000);
 // SQL bounds each effect against the component limits; the 900 s session sum is the gate's (reservationGate).
 const scoreCtx={kind:'tutor',sessionId:sid(70),claimNonce:id(6070)},small={inputBytes:4103,outputTokens:0,audioMillis:1000,textBytes:7};
 const scoreEffect=(e,qty)=>effect(7,70,e,scoreCtx,qty,'scoring',LESSON_SCORING_COMPONENT.configurationSha256,1);
 assert.equal((await scoreEffect(7100,{...small,textBytes:LESSON_SCORING_COMPONENT.maxTextBytes+1})).reason,'quantity-limit');
 for(let e=7101;e<7148;e++)assert.equal((await scoreEffect(e,small)).dispatch,true);
 assert.equal((await scoreEffect(7148,small)).reason,'effect-limit','a 49th lesson score is refused');
 assert.equal((await scoringSession(8,71,[comp('brain'),lessonStt,tts])).reason,'quote-mismatch','F863: a lesson quote without scoring refuses every live score');
 groups.push('F863 live lesson scoring: a 30 s Speechace score dispatches on the reviewed lesson scoring component and is charged its envelope once; per-effect quantity-limit; 49th score effect-limit; a lesson quote without it refuses as quote-mismatch');
// Convo twin: a mission scores a line said off the full-line help card through the
// reviewed convo scoring component (same Speechace identity, 24-score envelope).
const convoScore=await scoringSession(77,72,[comp('brain'),lessonStt,tts,{...CONVO_SCORING_COMPONENT}],'convo');
assert.equal(convoScore.dispatch,true);assert.equal(convoScore.executionMicroUsdCharged,48000);
const convoCtx={kind:'tutor',sessionId:sid(72),claimNonce:id(6072)};
const convoEffect=(e,qty)=>effect(77,72,e,convoCtx,qty,'scoring',CONVO_SCORING_COMPONENT.configurationSha256,1);
for(let e=7201;e<7224;e++)assert.equal((await convoEffect(e,small)).dispatch,true);
assert.equal((await convoEffect(7224,small)).reason,'effect-limit','a 25th convo score is refused');
assert.equal((await scoringSession(78,73,[comp('brain'),lessonStt,tts],'convo')).reason,'quote-mismatch','a convo quote without scoring refuses every live score');
groups.push('live convo scoring: a 30 s Speechace score dispatches on the reviewed convo scoring component and is charged its envelope once; 25th score effect-limit; a convo quote without it refuses as quote-mismatch');

 // Source/catalog verifier for lock order and production clock authority. Actual
 // independent PostgreSQL deadlock contention remains a release acceptance gate.
 const claimPositions=['from auth.users where id=p_user_id for key share','from luvani_private.paid_admission_config where singleton for update','paid_context_active_v1(p_user_id,p_context,true','from luvani_private.paid_operations where id=p_operation_id for update','from luvani_private.paid_execution_global_days where day=day_key for update','from luvani_private.paid_execution_account_days where user_id=p_user_id and day=day_key for update','from luvani_private.paid_execution_vendor_days where day=day_key and provider=c->>\'provider\' for update'].map(text=>claimSource.indexOf(text));
 assert.ok(claimPositions.every((pos,i)=>pos>=0 && (i===0 || pos>claimPositions[i-1])),'claim lock order drift');
 assert.ok(claimSource.lastIndexOf('stamp:=clock_timestamp();')>claimSource.indexOf('from luvani_private.paid_operations where id=p_operation_id for update'));
 assert.equal(claimSource.includes('paid_fixture_clock'),false);
 groups.push('catalog source lock-order verification Auth→paid config→context→operation→execution global/account/vendor; server UTC timestamp refreshed after operation wait; no shipped clock override');

 for(const label of groups)console.log(`PASS: ${label}`);
 console.log(`All ${groups.length} paid admission proof groups passed; synthetic units only, no hosted/provider calls, SDK/price/concurrency acceptance pending.`);
}catch(error){console.error(JSON.stringify({message:error.message,code:error.code,where:error.where,position:error.position}));process.exitCode=1;}finally{await db.close();}
