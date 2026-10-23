/** Disposable sequential PostgreSQL/WASM proof; no hosted calls or paid work.
 * node scripts/verifyTutorSessions.mjs (root pinned dependency)
 * Independent concurrent PostgreSQL and actual SDK jobs remain acceptance.
 */
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const lifecycle = '20261003231627_authoritative_tutor_sessions.sql';
const root = new URL('../supabase/migrations/', import.meta.url);
const uuid = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const authId = n => uuid(1000+n), sid = n => uuid(2000+n), fence = n => uuid(3000+n);
const digest = n => n.toString(16).padStart(64,'0');
const call = async (name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,
  args.map(v=>v && typeof v==='object' ? JSON.stringify(v) : v))).rows[0].value;
const entitlement = async n => (await db.query('select * from public.entitlements where user_id=$1',[uuid(n)])).rows[0];
const reserve = (n,id,mode='lesson') => call('reserve_tutor_session_v1',[uuid(n),sid(id),`luvani-proof-${id}`,mode,digest(id),authId(n)]);
const claim = (n,id,nonce=id,mode='lesson') => call('claim_tutor_session_v1',[uuid(n),sid(id),`luvani-proof-${id}`,mode,fence(nonce)]);
const checkpoint = (n,id,revision,seconds,turns,pack=null,failure=null,hash=digest(revision),nonce=id) =>
  call('checkpoint_tutor_session_v1',[uuid(n),sid(id),fence(nonce),revision,hash,seconds,turns,failure,pack]);
const complete = (n,id,revision,seconds,turns,pack=null,failure=null,hash=digest(100+id),nonce=id) =>
  call('complete_tutor_session_v1',[uuid(n),sid(id),fence(nonce),revision,hash,seconds,turns,failure,pack]);
const baseline = (n,id,summary='A grounded learning baseline') => ({version:1,id:sid(id),sessionId:sid(id),learnerId:uuid(n),
  createdAt:'2026-10-04T00:00:00.000Z',lastPractisedAt:null,state:'ready',title:{fr:'Au café',en:'At the café'},summary,
  learnerGoal:null,tutorGoal:null,cefr:'A1',durationSec:30,topics:[],keyPhrases:[{fr:'Bonjour',frWritten:null,en:'Hello'}],
  wins:['A greeting'],corrections:[],pronunciationFocus:null,exercises:[],continuationSeed:{titleFr:'Au café',titleEn:'At the café',correctionFocus:null}});
const reconcile = () => call('reconcile_tutor_sessions_v1',[50,'{}']);
const expire = id => db.query("update public.session_grants set lease_until=clock_timestamp()-interval '10 seconds',hard_deadline=clock_timestamp()-interval '10 seconds' where session_id=$1",[sid(id)]);
const age = (id,seconds=120) => db.query('update public.session_grants set claimed_at=clock_timestamp()-make_interval(secs=>$2),hard_deadline=clock_timestamp()+make_interval(secs=>reserved_seconds-$2) where session_id=$1',[sid(id),seconds]);
const groups = [];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role auth_deleter;
    create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;
    grant select,delete on auth.users to auth_deleter;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  const migrations = (await readdir(root)).filter(n=>n.endsWith('.sql')).sort();
  for (const name of migrations.filter(n=>n<lifecycle)) await db.exec(await readFile(new URL(name,root),'utf8'));
  for (let n=1;n<=16;n++) {
    await db.query('insert into auth.users(id) values($1)',[uuid(n)]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[authId(n),uuid(n)]);
    await db.query("insert into public.entitlements(user_id,plan,seconds_used) values($1,'trial',0)",[uuid(n)]);
  }
  // Genuine pre-migration capped charge and unknown proof must remain intact.
  await db.query('update public.entitlements set seconds_used=1790 where user_id=$1',[uuid(16)]);
  const e16=await entitlement(16);
  await call('record_session_grant',[uuid(16),sid(900),e16.plan,e16.seconds_used,e16.period_end]);
  await call('consume_entitlement',[uuid(16),100,sid(900)]);
  await db.query('insert into public.session_usage(session_id,user_id,seconds) values($1,$2,40)',[sid(901),uuid(16)]);
  await db.exec(await readFile(new URL(lifecycle,root),'utf8'));
  for (const name of migrations.filter(n=>n>lifecycle)) await db.exec(await readFile(new URL(name,root),'utf8'));
  assert.equal((await call('tutor_session_schema_v1')).enabled,false);
  assert.equal((await reserve(1,1)).reason,'admission-disabled');
  assert.equal((await db.query('select charged_seconds from public.session_usage where session_id=$1',[sid(900)])).rows[0].charged_seconds,10);
  assert.equal((await db.query('select charged_seconds from public.session_usage where session_id=$1',[sid(901)])).rows[0].charged_seconds,null);
  assert.equal((await call('refund_failed_session',[uuid(16),sid(900),'tts_error'])).refundedSeconds,10);
  assert.equal((await entitlement(16)).seconds_used,1790);
  groups.push(`all ${migrations.length} migrations, OFF defaults, legacy exact/NULL proof and refund`);

  // A destructive schema rollback is forbidden once even one v1 was issued.
  // Before issue it requires admission OFF plus an explicit SQL maintenance flag.
  const rollback = await readFile(new URL('../supabase/rollback/20261003231627_down.sql',import.meta.url),'utf8');
  const refuseRollback=async pattern=>{await assert.rejects(db.exec(rollback),pattern);await db.exec('rollback');};
  await refuseRollback(/maintenance/i);
  await db.query("select set_config('luvani.lifecycle_rollback_maintenance','approved',false)");
  await db.exec(rollback);
  await db.exec(await readFile(new URL(lifecycle,root),'utf8'));
  assert.equal((await call('tutor_session_schema_v1')).enabled,false);
  groups.push('unissued maintenance rollback and reapply');

  await db.exec('update public.tutor_session_admission_config set enabled=true,max_active_sessions=2,max_daily_issued_seconds=100000');
  assert.equal(await call('active_tutor_identity_v1',[uuid(1),authId(1)]),true);
  assert.equal(await call('active_tutor_identity_v1',[uuid(1),authId(2)]),false);
  assert.equal(await call('active_tutor_identity_v1',[null,authId(1)]),false);
  await db.query("update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[authId(2)]);
  assert.equal(await call('active_tutor_identity_v1',[uuid(2),authId(2)]),false);
  await db.query('update auth.sessions set not_after=null where id=$1',[authId(2)]);
  await db.query("update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1",[uuid(2)]);
  assert.equal(await call('active_tutor_identity_v1',[uuid(2),authId(2)]),false);
  await db.query('update auth.users set banned_until=null where id=$1',[uuid(2)]);
  await assert.rejects(call('reserve_tutor_session_v1',[uuid(1),sid(1),'room','lesson',null,authId(1)]),/invalid tutor reservation/);
  await assert.rejects(call('reconcile_tutor_sessions_v1',[101,'{}']),/invalid reconciliation/);
  const r1=await reserve(1,1);assert.equal(r1.reservedSeconds,900);
  assert.equal((await reserve(1,1)).joinDeadline,r1.joinDeadline);
  assert.equal((await reserve(1,2)).reason,'session-active');
  await assert.rejects(reserve(2,1),/conflict/);
  assert.equal((await reserve(2,2)).kind,'reserved');
  assert.equal((await reserve(3,3)).reason,'capacity');
  assert.equal((await entitlement(1)).seconds_used,0);
  await refuseRollback(/admission.*disabled|ever.*issued/i);
  await db.exec('update public.tutor_session_admission_config set enabled=false');
  await refuseRollback(/ever.*issued/i);
  await db.exec('update public.tutor_session_admission_config set enabled=true');
  groups.push('identity ownership/expiry/ban, strict inputs, one-owner/global reservations, immutable issue proof');

  const c1=await claim(1,1);assert.equal(c1.kind,'claimed');
  assert.equal((await claim(1,1)).leaseUntil,c1.leaseUntil);
  assert.equal((await claim(1,1,99)).kind,'refused');
  assert.equal((await claim(2,1)).kind,'refused');
  assert.equal((await call('claim_tutor_session_v1',[uuid(1),sid(1),'wrong-room','lesson',fence(1)])).kind,'refused');
  await assert.rejects(checkpoint(1,1,1,900,1),/elapsed time/);
  await age(1);
  assert.equal((await checkpoint(1,1,1,100,1)).kind,'checkpointed');
  await checkpoint(1,1,1,100,1);
  await assert.rejects(checkpoint(1,1,1,101,1),/checkpoint conflicts/);
  await assert.rejects(checkpoint(1,1,3,100,1),/consecutive/);
  assert.equal((await checkpoint(1,1,2,100,1,null,null,digest(2),99)).kind,'refused');
  assert.equal((await call('receipt_tutor_session_v1',[uuid(1),sid(1)])).kind,'pending');
  const liveExport=await call('export_account_data',[uuid(1)]);
  const liveGrant=liveExport.session_grants.find(g=>g.session_id===sid(1));
  assert.equal(liveGrant.state,'active');assert.equal(liveGrant.reserved_seconds,900);
  for(const key of ['claim_nonce','auth_session_id','request_digest','checkpoint_revision','checkpoint_digest','checkpoint_content_hash',
    'checkpoint_seconds','checkpoint_learner_turns','checkpoint_failure','checkpoint_baseline','completion_digest','completion_content_hash','completion_source']) {
    assert.equal(Object.hasOwn(liveGrant,key),false,`${key} must not leak into owner export`);
  }
  assert.ok(!JSON.stringify(liveExport).includes(fence(1)));
  for(const name of ['consume_entitlement','refund_failed_session','record_session_grant']) {
    const args=name==='consume_entitlement'?[uuid(1),100,sid(1)]:name==='refund_failed_session'?[uuid(1),sid(1),'tts_error']:[uuid(1),sid(1),'trial',0,null];
    await assert.rejects(call(name,args),/version1/);
  }
  await assert.rejects(complete(1,1,1,101,1,null,null,digest(1)),/immutable checkpoint/);
  await assert.rejects(complete(1,1,1,100,1,null,null,digest(99)),/immutable checkpoint/);
  const done=await complete(1,1,2,100,1);assert.equal(done.receipt.chargedSeconds,100);assert.equal(done.receipt.releasedReservedSeconds,800);
  assert.equal((await entitlement(1)).seconds_used,100);
  const settledExport=await call('export_account_data',[uuid(1)]);
  assert.equal(settledExport.session_grants.find(g=>g.session_id===sid(1)).completion_receipt.chargedSeconds,100);
  assert.equal(settledExport.session_usage.find(u=>u.session_id===sid(1)).charged_seconds,100);
  assert.ok((await call('export_account_data',[uuid(2)])).session_grants.every(g=>g.user_id===uuid(2)));
  assert.deepEqual(await complete(1,1,2,100,1),done);
  await assert.rejects(complete(1,1,2,101,1),/completion conflicts/);
  assert.equal((await claim(1,1,88)).kind,'refused');
  assert.equal((await call('receipt_tutor_session_v1',[uuid(2),sid(1)])).kind,'gone');
  groups.push('fresh-process nonce/room/owner fence, monotonic/conflicting checkpoints, exact debit, unused release, completion replay, safe owned export');

  await claim(2,2);await age(2);await checkpoint(2,2,1,90,1);
  const abandon=await call('abandon_tutor_session_v1',[uuid(2),sid(2)]);assert.equal(abandon.kind,'cancel-pending');
  assert.equal((await reserve(2,22)).reason,'session-active');
  assert.equal((await claim(2,2,77)).kind,'refused');
  assert.equal((await checkpoint(2,2,2,91,1)).kind,'refused');
  const cancelled=await complete(2,2,2,90,1);assert.equal(cancelled.receipt.chargedSeconds,0);
  assert.equal((await entitlement(2)).seconds_used,0);
  await reserve(3,3);assert.equal((await call('abandon_tutor_session_v1',[uuid(3),sid(3)])).kind,'cancelled');
  assert.equal((await claim(3,3)).kind,'refused');
  await reserve(3,33);await claim(3,33);await expire(33);
  assert.equal((await checkpoint(3,33,1,10,1)).kind,'refused');
  const sweep=await reconcile();assert.ok(sweep.results.some(x=>x.sessionId===sid(33)));assert.equal((await entitlement(3)).seconds_used,0);
  await reconcile();assert.equal((await claim(3,33,66)).kind,'refused');
  groups.push('active abandon holds capacity, cancelled/new-job rejection, expired heartbeat no resurrection, orphan zero-charge reconciliation');

  await reserve(4,4,'convo-text');await claim(4,4,4,'convo-text');
  await age(4);
  await assert.rejects(checkpoint(4,4,1,30,1),/baseline is required/);
  const p4=baseline(4,4);await checkpoint(4,4,1,30,1,p4);
  await assert.rejects(checkpoint(4,4,2,31,1,{...p4,transcript:'forbidden'}),/unknown|private/);
  await assert.rejects(complete(4,4,2,31,1,null),/baseline is required/);
  const pending=await call('receipt_tutor_session_v1',[uuid(4),sid(4)]);assert.equal(pending.kind,'pending');
  await expire(4);const recovered=await reconcile();const rr=recovered.results.find(x=>x.sessionId===sid(4)).receipt;
  assert.equal(rr.chargedSeconds,0);assert.equal(rr.baselineStatus,'saved');
  assert.equal((await db.query('select payload from public.conversation_packs where id=$1',[sid(4)])).rows[0].payload.summary,p4.summary);
  assert.equal((await db.query('select checkpoint_baseline from public.session_grants where session_id=$1',[sid(4)])).rows[0].checkpoint_baseline,null);
  assert.equal((await complete(4,4,2,31,1,p4)).receipt.chargedSeconds,0,'late worker cannot override reconciler receipt');
  await db.query('delete from public.conversation_packs where id=$1',[sid(4)]);await reconcile();
  assert.equal((await db.query('select count(*)::int n from public.conversation_packs where id=$1',[sid(4)])).rows[0].n,0);
  await reserve(5,5,'convo');await claim(5,5,5,'convo');await age(5);const p5=baseline(5,5);await checkpoint(5,5,1,40,1,p5);
  await db.query('insert into public.conversation_practice_tombstones(pack_id) values($1)',[sid(5)]);
  const erased=await complete(5,5,2,40,1,p5);assert.equal(erased.receipt.baselineStatus,'deleted');
  assert.equal((await db.query('select count(*)::int n from public.conversation_packs where id=$1',[sid(5)])).rows[0].n,0);
  groups.push('durable baseline checkpoint, atomic pending/refused completion, crash recovery, minimal terminal proof, deleted baseline fence');

  await reserve(6,6);await claim(6,6);await age(6);const failed=await complete(6,6,1,80,1,null,'llm_error');
  assert.equal(failed.receipt.chargedSeconds,0);assert.equal(failed.receipt.releasedReservedSeconds,900);
  assert.equal((await entitlement(6)).seconds_used,0);
  await reserve(7,7);await claim(7,7);await age(7);assert.equal((await complete(7,7,1,80,0)).receipt.chargedSeconds,0);
  await db.query("update public.entitlements set plan='regular',period_end='2027-01-01',seconds_used=0 where user_id=$1",[uuid(8)]);
  await reserve(8,8);await claim(8,8);await age(8);await checkpoint(8,8,1,80,1);
  await db.query("update public.entitlements set plan='starter',seconds_used=70 where user_id=$1",[uuid(8)]);
  assert.equal((await checkpoint(8,8,2,90,1)).kind,'refused');
  const downgraded=await complete(8,8,2,90,1);assert.equal(downgraded.receipt.chargedSeconds,0);assert.equal((await entitlement(8)).seconds_used,70);
  await reserve(8,88);await claim(8,88);await age(88);await db.query("update public.entitlements set period_end='2027-02-01',seconds_used=25 where user_id=$1",[uuid(8)]);
  assert.equal((await complete(8,88,1,60,1)).receipt.chargedSeconds,0);assert.equal((await entitlement(8)).seconds_used,25);
  // This database reapplied the lifecycle migration alone above, so its cap is that file's 1800-second trial.
  // The REV-001 ten-minute free allowance (D24 window, 44-hour refill) and its 480/481 boundary are proved on the fresh replay below.
  await db.query('update public.entitlements set seconds_used=1680 where user_id=$1',[uuid(9)]);assert.equal((await reserve(9,9)).reservedSeconds,120);
  await call('abandon_tutor_session_v1',[uuid(9),sid(9)]);
  await db.query('update public.entitlements set seconds_used=1681 where user_id=$1',[uuid(9)]);assert.equal((await reserve(9,99)).reason,'insufficient-for-session');
  groups.push('full service failure/no-production refunds, plan downgrade/rollover fencing, minimum viable exact reservation');

  await reserve(10,10,'convo');await claim(10,10,10,'convo');await age(10);await checkpoint(10,10,1,30,1,baseline(10,10));
  assert.equal((await call('fence_tutor_account_v1',[uuid(10)])).kind,'fenced');
  assert.equal(await call('active_tutor_identity_v1',[uuid(10),authId(10)]),false);
  assert.equal((await checkpoint(10,10,2,40,1,baseline(10,10))).kind,'refused');
  await db.exec('set role auth_deleter');await db.query('delete from auth.users where id=$1',[uuid(10)]);await db.exec('reset role');
  assert.equal((await complete(10,10,2,40,1,baseline(10,10))).kind,'gone');
  assert.equal((await db.query('select count(*)::int n from public.tutor_room_stops where session_id=$1',[sid(10)])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.session_grants where user_id=$1',[uuid(10)])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.conversation_packs where user_id=$1',[uuid(10)])).rows[0].n,0);
  await call('reconcile_tutor_sessions_v1',[50,`{${sid(10)}}`]);
  assert.equal((await db.query('select count(*)::int n from public.tutor_room_stops where session_id=$1',[sid(10)])).rows[0].n,0);
  await reserve(11,11);await db.query('delete from auth.sessions where id=$1',[authId(11)]);
  assert.equal((await claim(11,11)).kind,'refused');await call('abandon_tutor_session_v1',[uuid(11),sid(11)]);
  groups.push('active account deletion fence/restricted cascade, surviving room-stop and ACK, deleted identity no resurrection, logout before join');

  await reserve(13,13);await db.exec('update public.tutor_session_admission_config set enabled=false');
  assert.equal((await claim(13,13)).reason,'admission-disabled');
  await db.exec('update public.tutor_session_admission_config set enabled=true');await call('abandon_tutor_session_v1',[uuid(13),sid(13)]);
  await reserve(14,14,'convo');await claim(14,14,14,'convo');await age(14);
  const p14=baseline(14,14);await checkpoint(14,14,1,60,1,p14);
  await db.exec(`create function luvani_private.proof_reject_baseline() returns trigger language plpgsql as $$begin raise exception 'injected baseline unavailable'; end$$;
    create trigger proof_reject_baseline before insert on public.conversation_packs for each row execute function luvani_private.proof_reject_baseline();`);
  await assert.rejects(complete(14,14,2,60,1,p14),/injected baseline/);
  assert.equal((await entitlement(14)).seconds_used,0,'failed baseline must roll back debit');
  assert.equal((await db.query('select count(*)::int n from public.session_usage where session_id=$1',[sid(14)])).rows[0].n,0,'failed baseline cannot create false settled proof');
  assert.equal((await call('receipt_tutor_session_v1',[uuid(14),sid(14)])).kind,'pending');
  await db.exec('drop trigger proof_reject_baseline on public.conversation_packs; drop function luvani_private.proof_reject_baseline();');
  const retry14=await complete(14,14,2,60,1,p14);assert.equal(retry14.receipt.chargedSeconds,60);assert.equal(retry14.receipt.baselineStatus,'saved');
  assert.deepEqual(await complete(14,14,2,60,1,p14),retry14);
  assert.equal((await db.query('select count(*)::int n from public.conversation_practice_jobs where pack_id=$1',[sid(14)])).rows[0].n,1);
  await reserve(15,15);await db.query("update public.session_grants set join_deadline=clock_timestamp()-interval '1 second' where session_id=$1",[sid(15)]);
  assert.equal((await claim(15,15)).kind,'refused');await reconcile();assert.equal((await entitlement(15)).seconds_used,0);
  await db.query('insert into auth.users(id) values($1)',[uuid(17)]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[authId(17),uuid(17)]);
  assert.equal((await call('fence_tutor_account_v1',[uuid(17)])).kind,'fenced');
  assert.equal(await call('active_tutor_identity_v1',[uuid(17),authId(17)]),false,'unprovisioned accounts also need deletion fence');
  groups.push('disable prevents pending claim, injected baseline rollback and identical retry, join expiry, unprovisioned account deletion fence');

  // Older join deadlines on healthy claimed jobs must not occupy the LIMIT and
  // starve a genuinely due later owner. No sleep; deterministic fixture clocks.
  await db.exec('update public.tutor_session_admission_config set max_active_sessions=3');
  await reserve(1,101);await claim(1,101);await reserve(2,102);await claim(2,102);await reserve(15,115);await claim(15,115);
  await db.query("update public.session_grants set join_deadline=clock_timestamp()-interval '5 minutes' where session_id=any($1::uuid[])",[`{${sid(101)},${sid(102)},${sid(115)}}`]);
  await expire(115);
  const unstarved=await call('reconcile_tutor_sessions_v1',[1,'{}']);
  assert.equal(unstarved.results.length,1);assert.equal(unstarved.results[0].sessionId,sid(115));
  assert.equal((await call('receipt_tutor_session_v1',[uuid(1),sid(101)])).state,'active');
  await complete(1,101,1,0,0);await complete(2,102,1,0,0);
  groups.push('due-only reconciliation cannot be starved by healthy jobs after their original join deadline');

  const issued=(await db.query('select sum(issued_seconds)::bigint n from public.tutor_session_budget_days')).rows[0].n;
  await db.query('update public.tutor_session_admission_config set max_daily_issued_seconds=$1',[issued]);
  assert.equal((await reserve(12,12)).reason,'daily-budget');
  assert.equal((await db.query('select sum(issued_seconds)::bigint n from public.tutor_session_budget_days')).rows[0].n,issued,'refund/abandon cannot recycle global issued exposure');
  const functions=(await db.query(`select p.oid,p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') service
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%tutor%v1' or p.proname='active_tutor_identity_v1')`)).rows;
  assert.equal(functions.length,11);assert.ok(functions.every(f=>!f.anon&&!f.authenticated&&f.service));
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(call('active_tutor_identity_v1',[uuid(1),authId(1)]),/permission denied/);
    await assert.rejects(db.query('select * from public.tutor_session_admission_config'),/permission denied/);
    await assert.rejects(db.query('select * from public.session_grants'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');assert.equal(await call('active_tutor_identity_v1',[uuid(1),authId(1)]),true);await db.exec('reset role');
  const catalog=(await db.query(`select count(*)::int n,count(*) filter(where c.relrowsecurity)::int rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','luvani_private') and c.relkind='r'`)).rows[0];
  assert.equal(catalog.n,catalog.rls);
  groups.push('non-recyclable daily exposure, service-only function/table ACLs and RLS');
  // Account cascades may erase every owned grant, but "ever issued" must still
  // prevent destructive schema rollback using its surviving exposure proof.
  await db.exec('update public.tutor_session_admission_config set enabled=false; delete from auth.users;');
  assert.equal((await db.query('select count(*)::int n from public.session_grants where lifecycle_version=1')).rows[0].n,0);
  await refuseRollback(/ever.*issued/i);
  assert.ok(Number((await db.query('select sum(issued_seconds)::bigint n from public.tutor_session_budget_days')).rows[0].n)>0);
  groups.push('issued-schema rollback remains forbidden after every owned grant/account is deleted');

  // D24 free taste as REV-001 (migration 43) leaves it: 600 s refilled 44 hours after the first debit, on a fresh replay of every migration. Separate from
  // the database above because that one rolls the lifecycle migration back and
  // reapplies it alone, which restores the pre-D24 bodies beneath this one.
  const taste = new PGlite();
  try {
    await taste.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role auth_deleter;
      create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
    for (const name of migrations) await taste.exec(await readFile(new URL(name,root),'utf8'));
    const t = async (name,args=[]) => (await taste.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,
      args.map(v=>v && typeof v==='object' ? JSON.stringify(v) : v))).rows[0].value;
    const row = async n => (await taste.query('select * from public.entitlements where user_id=$1',[uuid(n)])).rows[0];
    const read = async n => (await taste.query('select * from public.consume_entitlement($1,0,null)',[uuid(n)])).rows[0];
    const tReserve = (n,id) => t('reserve_tutor_session_v1',[uuid(n),sid(id),`luvani-taste-${id}`,'lesson',digest(id),authId(n)]);
    const tClaim = (n,id) => t('claim_tutor_session_v1',[uuid(n),sid(id),`luvani-taste-${id}`,'lesson',fence(id)]);
    const tAge = (id,seconds) => taste.query('update public.session_grants set claimed_at=clock_timestamp()-make_interval(secs=>$2),hard_deadline=clock_timestamp()+make_interval(secs=>reserved_seconds-$2) where session_id=$1',[sid(id),seconds]);
    const tComplete = (n,id,seconds) => t('complete_tutor_session_v1',[uuid(n),sid(id),fence(id),1,digest(500+id),seconds,1,null,null]);
    // Time passing moves no row: stand the refill time in the past without the write itself starting a new epoch.
    const passWindow = async n => { await taste.exec('alter table public.entitlements disable trigger entitlement_usage_epoch');
      try { await taste.query("update public.entitlements set period_end=clock_timestamp()-interval '1 second' where user_id=$1",[uuid(n)]); }
      finally { await taste.exec('alter table public.entitlements enable trigger entitlement_usage_epoch'); } };
    const refillMs = 44*3600000;
    await taste.exec('update public.tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000,max_account_daily_sessions=50,max_account_daily_seconds=100000');
    for (let n=51;n<=56;n++) {
      await taste.query('insert into auth.users(id) values($1)',[uuid(n)]);
      await taste.query('insert into auth.sessions(id,user_id) values($1,$2)',[authId(n),uuid(n)]);
    }
    assert.equal(await t('claim_trial_with_evidence',[uuid(51),'a'.repeat(43),'b'.repeat(43),false]),true);
    let e = await row(51);
    assert.equal(e.plan,'trial');assert.equal(e.seconds_used,0);assert.equal(e.weekly_taste,true);assert.equal(e.period_end,null,'an unspent taste already has a refill time');
    assert.equal(await t('claim_trial_with_evidence',[uuid(52),'a'.repeat(43),'c'.repeat(43),false]),false,'a claimed device minted a second taste');

    // The first debit starts the window and keeps the epoch; a later debit leaves the window.
    const epoch = e.usage_epoch;
    const first = await tReserve(51,51);assert.equal(first.reservedSeconds,600,'the free allowance is not ten minutes');
    await tClaim(51,51);await tAge(51,60);
    const started = Date.now();
    assert.equal((await tComplete(51,51,60)).receipt.chargedSeconds,60);
    e = await row(51);
    assert.equal(e.seconds_used,60);assert.equal(e.usage_epoch,epoch,'starting the window started a new usage epoch');
    assert.ok(Math.abs(new Date(e.period_end).getTime()-started-refillMs)<60000,'the first debit did not set the refill 44 hours out');
    const refillsAt = e.period_end;
    await tReserve(51,52);await tClaim(51,52);await tAge(52,30);await tComplete(51,52,30);
    e = await row(51);assert.equal(e.seconds_used,90);assert.deepEqual(e.period_end,refillsAt,'a later debit moved the refill');

    // A refill waits for a live claimed session, which is charged to its own window.
    await tReserve(51,53);await tClaim(51,53);await tAge(53,20);await passWindow(51);
    assert.equal((await read(51)).seconds_used,90,'a refill landed under a live session');
    assert.equal((await tComplete(51,53,20)).receipt.chargedSeconds,20);
    // Then the passed window refills on the next read: nothing spent, no refill time, a new epoch.
    const before = await row(51);
    const refilled = await read(51);
    assert.equal(refilled.seconds_used,0);assert.equal(refilled.period_end,null);assert.equal(refilled.weekly_taste,true);
    assert.notEqual(refilled.usage_epoch,before.usage_epoch,'a refill kept the last window\'s usage epoch');
    assert.equal((await tReserve(51,54)).reservedSeconds,600,'a refilled taste cannot be reserved');
    await t('abandon_tutor_session_v1',[uuid(51),sid(54)]);

    // An unclaimed row made by a billing refresh is a spent taste that never refills.
    await t('begin_billing_refresh',[uuid(53)]);
    e = await row(53);assert.equal(e.plan,'trial');assert.equal(e.seconds_used,600);assert.equal(e.weekly_taste,false);
    await passWindow(53);
    assert.equal((await read(53)).seconds_used,600,'an unclaimed row refilled');
    assert.equal((await tReserve(53,55)).reason,'exhausted');

    // A lapse falls back to a fresh taste that can be reserved.
    await taste.query("insert into public.entitlements(user_id,plan,seconds_used,period_end) values($1,'starter',9000,clock_timestamp()-interval '48 hours')",[uuid(54)]);
    const lapsed = await read(54);
    assert.deepEqual([lapsed.plan,lapsed.seconds_used,lapsed.period_end,lapsed.weekly_taste,lapsed.lapsed_from_paid],['trial',0,null,true,true]);
    await taste.query("insert into public.entitlements(user_id,plan,seconds_used,period_end) values($1,'regular',100,clock_timestamp()-interval '48 hours')",[uuid(55)]);
    const lazily = await tReserve(55,56);
    assert.equal(lazily.reservedSeconds,600,'a lapsed learner could not spend the taste');
    e = await row(55);assert.deepEqual([e.plan,e.weekly_taste,e.lapsed_from_paid],['trial',true,true]);
    await t('abandon_tutor_session_v1',[uuid(55),sid(56)]);
    await taste.query("insert into public.entitlements(user_id,plan,seconds_used,period_end) values($1,'regular',100,clock_timestamp()+interval '30 days')",[uuid(56)]);
    const ticket = await t('begin_billing_refresh',[uuid(56)]);
    const projected = await t('apply_billing_projection_v2',[uuid(56),ticket,'inactive',null,null,null,null,null,null]);
    assert.equal(projected.kind,'lapsed');
    assert.deepEqual([projected.entitlement.plan,projected.entitlement.seconds_used,projected.entitlement.weekly_taste,projected.entitlement.lapsed_from_paid],['trial',0,true,true]);

    // Lapsed and spent is subscription-lapsed; lapsed with a little left is short, not lapsed.
    await taste.query('update public.entitlements set seconds_used=600 where user_id=$1',[uuid(54)]);
    assert.equal((await tReserve(54,57)).reason,'subscription-lapsed');
    await taste.query('update public.entitlements set seconds_used=500 where user_id=$1',[uuid(54)]);
    assert.equal((await tReserve(54,58)).reason,'insufficient-for-session');
    await taste.query('update public.entitlements set seconds_used=480 where user_id=$1',[uuid(51)]);assert.equal((await tReserve(51,60)).reservedSeconds,120);
    await t('abandon_tutor_session_v1',[uuid(51),sid(60)]);
    await taste.query('update public.entitlements set seconds_used=481 where user_id=$1',[uuid(51)]);assert.equal((await tReserve(51,61)).reason,'insufficient-for-session');
    await taste.query('update public.entitlements set seconds_used=600 where user_id=$1',[uuid(51)]);
    assert.equal((await tReserve(51,59)).reason,'exhausted');

    // The two new wall doors, and nothing else, cross the product event trigger.
    const wall = (name,properties) => taste.query('insert into public.product_events(user_id,name,properties) values($1,$2,$3)',[uuid(51),name,JSON.stringify(properties)]);
    for (const entry of ['launch','locked']) {
      await wall('wall_shown',{entry,pages:4});
      await wall('wall_left',{entry,outcome:'unchanged',destination:'back'});
    }
    await assert.rejects(wall('wall_shown',{entry:'banner',pages:4}),/invalid wall_shown/);
    const cap = async plan => (await taste.query('select luvani_private.tutor_cap_v1($1) as cap',[plan])).rows[0].cap;
    const windowSrc = async () => (await taste.query("select prosrc from pg_proc where proname='taste_window_v1'")).rows[0].prosrc;
    const caps = async () => [await cap('trial'),await cap('starter'),await cap('regular')];
    assert.deepEqual(await caps(),[600,18000,36000]);assert.match(await windowSrc(),/interval '44 hours'/);

    // 44-hour boundary: no refill at 43h59m, a refill at 44 h (period_end is stood relative to now).
    const standRefill = async (n,sql) => { await taste.exec('alter table public.entitlements disable trigger entitlement_usage_epoch');
      try { await taste.query(`update public.entitlements set seconds_used=100,period_end=${sql} where user_id=$1`,[uuid(n)]); }
      finally { await taste.exec('alter table public.entitlements enable trigger entitlement_usage_epoch'); } };
    await standRefill(51,"clock_timestamp()+interval '60 seconds'"); // first debit 43h59m ago
    assert.equal((await read(51)).seconds_used,100,'a free window refilled before 44 hours');
    await standRefill(51,"clock_timestamp()"); // first debit exactly 44 h ago
    assert.equal((await read(51)).seconds_used,0,'a free window did not refill at 44 hours');

    // Paid: the six-argument projection clamps at the new caps, v2 grants up to them.
    for (const [n,plan,used,want] of [[57,'starter',40000,18000],[58,'regular',40000,36000]]) {
      await taste.query('insert into auth.users(id) values($1)',[uuid(n)]);
      const end = new Date(Date.now()+20*86400000).toISOString();
      await taste.query('insert into public.entitlements(user_id,plan,seconds_used,period_end) values($1,$2,$3,$4)',[uuid(n),plan,used,end]);
      const r = await t('apply_billing_projection',[uuid(n),await t('begin_billing_refresh',[uuid(n)]),'active',plan,end,null]);
      assert.equal(r.entitlement.seconds_used,want,`the six-argument projection did not clamp ${plan} at ${want}`);
    }
    const v2 = async (n,plan,grant) => { const ticket2 = await t('begin_billing_refresh',[uuid(n)]);
      return t('apply_billing_projection_v2',[uuid(n),ticket2,'active',plan,new Date(Date.now()+30*86400000).toISOString(),null,grant,null,null]); };
    for (let n=60;n<=65;n++) await taste.query('insert into auth.users(id) values($1)',[uuid(n)]);
    for (const [n,plan,grant] of [[60,'starter',18000],[61,'regular',36000],[62,'starter',4200],[63,'regular',8400]]) {
      const r = await v2(n,plan,grant);assert.equal(r.kind,'active');
      assert.equal(await cap(plan)-r.entitlement.seconds_used,grant,`v2 left the wrong remaining on ${plan}`);
      assert.equal(await cap(plan)-r.entitlement.withheld_seconds,grant,`v2 did not grant ${grant} on ${plan}`);
    }
    await assert.rejects(v2(64,'regular',36001),/grant|allowance/i);
    await assert.rejects(v2(65,'starter',18001),/grant|allowance/i);

    // Migration 43 twice is idempotent.
    const daily = migrations.find(name=>name.endsWith('_daily_free_allowance.sql'));
    const dailySql = await readFile(new URL(daily,root),'utf8');
    const snapshot = async () => (await taste.query('select user_id,plan,seconds_used,period_end,usage_epoch,weekly_taste from public.entitlements order by user_id')).rows;
    const s1 = await snapshot();await taste.exec(dailySql);assert.deepEqual(await snapshot(),s1,'re-applying 43 moved a row');
    assert.deepEqual(await caps(),[600,18000,36000]);

    // Rollback of 43: refused without the interlock, restores D24, safe twice; then re-apply.
    const dailyDown = await readFile(new URL(`../supabase/rollback/${daily.split('_')[0]}_down.sql`,import.meta.url),'utf8');
    await assert.rejects(taste.exec(dailyDown),/interlock/);
    assert.deepEqual(await caps(),[600,18000,36000],'a refused rollback changed the caps');
    // A paid row withholding against the REV-001 caps refuses the rollback even with the interlock.
    await taste.exec("set luvani.reopen_weekly_taste='yes'");
    await assert.rejects(taste.exec(dailyDown),/withheld_seconds/);
    await taste.exec('reset luvani.reopen_weekly_taste');
    assert.deepEqual(await caps(),[600,18000,36000],'a refused rollback changed the caps');
    await taste.exec("update public.entitlements set withheld_seconds=0,period_start=null,allowance_window_end=null where plan in ('starter','regular')");
    await taste.exec("set luvani.reopen_weekly_taste='yes'");await taste.exec(dailyDown);await taste.exec(dailyDown);await taste.exec('reset luvani.reopen_weekly_taste');
    assert.deepEqual(await caps(),[300,10800,18000]);assert.match(await windowSrc(),/interval '7 days'/);
    assert.equal((await taste.query('select max(seconds_used)::int n from public.entitlements where plan=$1',['trial'])).rows[0].n<=300,true);
    await taste.exec(dailySql);
    assert.deepEqual(await caps(),[600,18000,36000]);assert.match(await windowSrc(),/interval '44 hours'/);

    // The D24 rollback (after 43's) refuses without its interlock, restores the one-off trial, and 40 then 43 reapply.
    const tasteName = migrations.find(name=>name.endsWith('_weekly_free_taste.sql'));
    const tasteDown = await readFile(new URL(`../supabase/rollback/${tasteName.split('_')[0]}_down.sql`,import.meta.url),'utf8');
    await assert.rejects(taste.exec(tasteDown),/interlock/);
    await taste.exec("set luvani.reopen_weekly_taste='yes'");await taste.exec(dailyDown);await taste.exec('reset luvani.reopen_weekly_taste');
    await taste.exec("set luvani.reopen_one_off_trial='yes'");await taste.exec(tasteDown);await taste.exec('reset luvani.reopen_one_off_trial');
    assert.equal(await cap('trial'),1800);
    assert.equal((await taste.query("select count(*)::int n from information_schema.columns where table_name='entitlements' and column_name='weekly_taste'")).rows[0].n,0);
    await taste.exec(await readFile(new URL(tasteName,root),'utf8'));
    assert.equal(await cap('trial'),300);
    await taste.exec(dailySql);
    assert.deepEqual(await caps(),[600,18000,36000]);
    assert.equal((await row(51)).weekly_taste,true,'reapplying did not restore the claimed taste');
  } finally { await taste.close(); }
  // Migration 43 replays on a schema that never saw the held 42.
  const bare = new PGlite();
  try {
    await bare.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role auth_deleter;
      create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;
      alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
    for (const name of migrations.filter(n=>!n.endsWith('_speech_dataset_clips.sql'))) await bare.exec(await readFile(new URL(name,root),'utf8'));
    assert.equal((await bare.query("select count(*)::int n from pg_class where relname='speech_dataset_clips'")).rows[0].n,0);
    assert.equal((await bare.query("select luvani_private.tutor_cap_v1('regular') as cap")).rows[0].cap,36000);
  } finally { await bare.close(); }
  groups.push('REV-001 migration 43 replays without the held 42');
  groups.push('D24 taste with REV-001 figures: claim marks the taste, cap 600 (Core 18000, Max 36000), first debit starts a 44-hour window in the same epoch, live sessions defer the refill, a passed window refills to a new epoch, an unclaimed billing row never refills, every lapse lands on a reservable fresh taste, lapsed-and-spent is subscription-lapsed, wall doors launch/locked, refill at 44 h not 43h59m, 120 s floor at 480/481, six-arg projection clamps at 18000/36000, v2 grants 18000/36000/4200/8400 and refuses 36001/18001, 43 idempotent, interlocked 43 and 40 rollbacks and reapply');
  console.log(JSON.stringify({status:'PASS',migrationCount:migrations.length,proofGroups:groups.length,groups,
    limits:'Sequential disposable PostgreSQL/WASM. No hosted Auth, independent concurrent connections, actual SDK process/network shutdown, provider spend or deployed reconciler acceptance.'},null,2));
} finally {await db.close();}
