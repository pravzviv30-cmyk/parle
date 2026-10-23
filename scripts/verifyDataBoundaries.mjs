/** Disposable SQL proof only: never connects to a hosted project or reads users.
 * node --experimental-strip-types scripts/verifyDataBoundaries.mjs (root pinned dependency)
 * Uses one PostgreSQL/WASM connection. It proves real SQL role/transaction behavior,
 * not independent-connection concurrency, PostgREST, cron scheduling or device load.
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createProfile, MAX_PHRASES } from '@luvani/brain/profile';
import { buildConversationPack, newCard } from '@luvani/core';
import { sealEnvelope, MAX_ENVELOPE_BYTES } from '../apps/mobile/src/sync/envelope.ts';
import { fullGame } from '../apps/mobile/src/game/capacityFixture.ts';

const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const root = fileURLToPath(new URL('..', import.meta.url));
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [a,b,c,d,e] = [1,2,3,4,5].map(id);
const owned = ['20261003230215_bounded_direct_data.sql','20261003230224_bounded_data_retention.sql','20261003230232_bounded_social_inbox.sql'];
const now = Date.now();
const eventProperties = { personalisedGreeting:false };
async function role(name, uid='') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]); await db.exec(`set role ${name}`); }
async function admin() { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
const state = (owner,namespace,payload) => db.query('insert into public.learner_state(user_id,namespace,payload) values($1,$2,$3::jsonb)',[owner,namespace,JSON.stringify(payload)]);
const envelope = data => sealEnvelope(data,'disposable-proof',now);
const event = (owner,occurredAt,receivedAt) => db.query('insert into public.product_events(user_id,name,properties,occurred_at,received_at) values($1,$2,$3::jsonb,coalesce($4::timestamptz,now()),coalesce($5::timestamptz,now()))',[owner,'onboarding_completed',JSON.stringify(eventProperties),occurredAt??null,receivedAt??null]);
const social = async (owner,action,args={}) => { await role('authenticated',owner); try { return (await db.query('select public.luvani_social($1,$2::jsonb) as value',[action,JSON.stringify(args)])).rows[0].value; } finally { await admin(); } };
async function quota(owner) { await admin(); return (await db.query('select * from luvani_private.data_write_quotas where user_id=$1',[owner])).rows[0]; }
async function retention(size=500) { await role('service_role'); try { return (await db.query('select public.run_data_retention_v1($1) as value',[size])).rows[0].value; } finally { await admin(); } }
const pass = label => console.log(`PASS: ${label}`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create role auth_deleter; create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;
    grant select,delete on auth.users to auth_deleter;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  const migrations=(await readdir(`${root}/supabase/migrations`)).filter(file=>file.endsWith('.sql')).sort();
  assert.equal(new Set(migrations.map(file=>file.split('_')[0])).size,migrations.length,'duplicate migration timestamp');
  let seeded=false;
  for (const file of migrations) {
    if (file===owned[0]) {
      // Legacy fixtures before new admission: no disabled trigger or bypass in the
      // production migrations. Receipt timestamps deliberately include a forgery.
      for (let n=1;n<=30;n++) await db.query('insert into auth.users values($1)',[id(n)]);
      await db.query(`insert into product_events(user_id,name,properties) select $1::uuid,'onboarding_completed','{"personalisedGreeting":false}'::jsonb from generate_series(1,9999)`,[b]);
      await db.query(`insert into product_events(user_id,name,properties,occurred_at) select $1::uuid,'onboarding_completed','{"personalisedGreeting":false}'::jsonb,now()-interval '14 months' from generate_series(1,3)`,[d]);
      await db.query(`insert into product_events(user_id,name,properties,occurred_at) values($1,'onboarding_completed','{"personalisedGreeting":false}',now()+interval '10 years')`,[d]);
      await db.query(`insert into learner_state(user_id,namespace,payload) values($1,'journal',jsonb_build_object('legacy',repeat('x',600000)))`,[d]);
      for(let n=1;n<=3;n++) await db.query("insert into trial_installations(installation_hash,first_user_hash,claimed_at) values($1,$2,now()-interval '25 months')",[String(n).repeat(43),String(n+3).repeat(43)]);
      await db.query("insert into social_profiles(user_id,username,display_name) values($1,'legacy.d','D'),($2,'legacy.e','E'),($3,'legacy.f','F')",[d,e,id(6)]);
      await db.query("insert into social_edges(sender,recipient,created_at) values($1,$2,now()-interval '15 days'),($1,$3,now()-interval '15 days')",[d,e,id(6)]);
      seeded=true;
    }
    await db.exec(await readFile(`${root}/supabase/migrations/${file}`,'utf8'));
  }
  assert.ok(seeded,'admission migration was not replayed');
  pass(`all ${migrations.length} migrations replayed in order with simulated Supabase table/sequence defaults`);
  // Owner-only fixture activation for the historical social behavior checks below.
  // Default-OFF, operator ACLs, expiry and sticky rollback are separately proved
  // by verifyFriendsLaunch.mjs. This synthetic URL is not a moderation attestation.
  await db.exec("update luvani_private.friends_launch_config set enabled=true,reviewed_by='disposable-fixture',evidence_url='https://fixture.test/moderation',evidence_sha256=md5('fixture')||md5('review'),expires_at=clock_timestamp()+interval '1 hour'");


  // PGlite's pg_locks cannot attest parent row locks. Instrument only this
  // disposable function after its real FOR KEY SHARE/check succeeds, then prove
  // the marker is present in a probe sorting BEFORE the admission row trigger.
  // Restore the exact migration function afterwards. This proves SQL execution
  // ordering, not blocking across independent PostgreSQL connections.
  const directSql=await readFile(`${root}/supabase/migrations/${owned[0]}`,'utf8');
  const statementFunction=directSql.match(/create function luvani_private\.lock_client_data_owner_v1\(\)[\s\S]*?end; \$\$;/)[0];
  const instrumentedStatement=statementFunction.replace('create function','create or replace function').replace('  return null;','  perform set_config(\'luvani.test.parent_checked\',\'yes\',true);\n  return null;');
  await db.exec(instrumentedStatement);
  await db.exec(`create function public.assert_test_parent_lock() returns trigger language plpgsql as $$
    begin if current_setting('luvani.test.parent_checked',true) is distinct from 'yes' then
      raise exception 'parent lock missing before row admission'; end if; return new; end; $$;
    create trigger aaa_test_parent_lock before insert or update on public.learner_state for each row execute function public.assert_test_parent_lock();`);
  await role('authenticated',id(999));
  await assert.rejects(state(id(999),'profile',{}),/account is not active/);
  await assert.rejects(db.query("update learner_state set payload='{}' where user_id=$1",[id(999)]),/account is not active/);
  await role('authenticated');await assert.rejects(state(a,'profile',{}),/account is not active/);
  await admin();

  // Current production structures, not only generic {} payloads. Sizes/caps come
  // from the actual profile, history, bookmarks and review constructors.
  const brain=createProfile();
  for(let n=0;n<MAX_PHRASES;n++) brain.phrases[`phrase${n}`]={fr:`Bonjour numéro ${n}`,frWritten:null,en:`Hello ${n}`,register:'neutral',introducedAt:new Date(now).toISOString(),timesUsedWell:3,mastered:false};
  const profile={version:8,name:'Camille',dob:null,ageConfirmed:true,ageStopAt:null,tutorVoice:'alexandre',preferTyping:false,forgottenFacts:['old memory'],learnerGoals:['Order lunch'],motivation:'travel',dailyGoalMin:10,onboardedAt:now,username:null,brain};
  const history=Array.from({length:50},(_,n)=>({endedAt:now-n,summary:{lessonId:'cafe',longestTurnSec:12,wordsProduced:['bonjour','café'],pronunciation:{stats:[{ipa:'y',sampleCount:2,meanScore:80}]},struggledTurnIds:[],completedTurns:3}}));
  const review=Array.from({length:1200},(_,n)=>newCard({id:`vocab:${n}`,kind:'vocab',front:'bonjour',back:'hello',context:'Bonjour = Hello',ipa:'bɔ̃ʒuʁ'},now));
  const payloads={profile,history,review,drills:{version:1,drills:[]},tutorIntro:1,
    activity:{version:2,entries:Array.from({length:5000},(_,n)=>({at:now-n,kind:'review',xp:3})),activeDays:[],backfilled:true},
    friends:{},topics:{version:1,topics:[]},journal:[],missions:{version:1,completions:[]},coachMarks:['mic'],soundChecks:{version:1,evidence:[]},
    bookmarks:{version:2,items:Array.from({length:3000},(_,n)=>({situation:`scene:${n}`,saved:true,at:now-n}))},
    scenarioProgress:{version:1,records:[]},practiceHistory:{version:1,events:[]},goalSteps:{version:1,steps:[]}};
  await role('authenticated',a);
  for(const [namespace,data] of Object.entries(payloads)) {
    assert.ok(Buffer.byteLength(JSON.stringify(envelope(data)))<=MAX_ENVELOPE_BYTES,`fixture ${namespace} exceeds mobile byte bound`);
    await state(a,namespace,envelope(data));
  }
  assert.equal((await db.query('select count(*)::integer as n from learner_state where user_id=$1',[a])).rows[0].n,16);
  // Two complete 16-namespace offline upload bursts and CAS revision behavior.
  for(let n=0;n<2;n++) await db.query('update learner_state set payload=payload,revision=999 where user_id=$1',[a]);
  const revision=(await db.query("select revision from learner_state where user_id=$1 and namespace='profile'",[a])).rows[0].revision;
  assert.equal(Number(revision),2);
  assert.equal((await db.query("update learner_state set payload=payload where user_id=$1 and namespace='profile' and revision=1 returning revision",[a])).rows.length,0);
  await admin(); const q0=await quota(a); assert.equal(q0.learner_minute,48);
  await db.exec('drop trigger aaa_test_parent_lock on learner_state; drop function public.assert_test_parent_lock();');
  await db.exec(statementFunction.replace('create function','create or replace function'));
  pass('all 16 namespaces; numeric tutorIntro; 200-phrase profile; 50 sessions; 1,200 constructed review cards; 5,000 activity entries; 3,000 bookmarks; offline burst/CAS');

  // F729: the largest game blob the bounds in game/model.ts allow, written by a
  // learner of its own so the one-minute burst arithmetic above is untouched (a
  // calendar-minute bucket would reset if this walk pushed it over a boundary).
  // Measured against the client envelope and the database's byte, item and depth limits.
  const fullGameEnvelope=envelope(fullGame(now));
  assert.ok(Buffer.byteLength(JSON.stringify(fullGameEnvelope))<=MAX_ENVELOPE_BYTES,'a full game blob exceeds the mobile byte bound');
  await role('authenticated',id(29)); await state(id(29),'game',fullGameEnvelope); await admin();
  assert.equal((await db.query("select count(*)::integer as n from learner_state where user_id=$1 and namespace='game'",[id(29)])).rows[0].n,1);
  pass('a game blob at every cap fits the envelope and the database byte, item and depth limits');

  // F729 rollback, disposable only: refused by default with nothing deleted (the
  // script owns its transaction, so the delete after a refused interlock never
  // runs); authorised, it deletes game rows and nothing else and restores the
  // sixteen-name check; the migration then re-applies, twice, and game is accepted again.
  const gameUp=await readFile(`${root}/supabase/migrations/20261006120000_learner_state_game.sql`,'utf8');
  const gameDown=await readFile(`${root}/supabase/rollback/20261006120000_down.sql`,'utf8');
  // One exec here is one implicit transaction either way; psql without ON_ERROR_STOP is not, so the file must own one.
  assert.match(gameDown,/^begin;[\s\S]*luvani\.remove_game[\s\S]*delete from public\.learner_state\s+where namespace = 'game';[\s\S]*^commit;\s*$/m,'the game rollback does not own its transaction around the interlock and the delete');
  await role('authenticated',id(29)); await state(id(29),'history',envelope([])); await admin();
  const gameOwnerRows=async()=>(await db.query('select namespace from learner_state where user_id=$1 order by namespace',[id(29)])).rows.map(row=>row.namespace);
  assert.deepEqual(await gameOwnerRows(),['game','history']);
  await assert.rejects(db.exec(gameDown),/Refusing to delete game rows/);
  await db.exec('rollback');
  assert.deepEqual(await gameOwnerRows(),['game','history'],'the game rollback deleted rows past its interlock');
  await db.query("select set_config('luvani.remove_game','yes',false)");
  await db.exec(gameDown);
  await db.query("select set_config('luvani.remove_game','',false)");
  assert.deepEqual(await gameOwnerRows(),['history'],'the game rollback deleted more than game rows, or none');
  await role('authenticated',id(29));
  try { await assert.rejects(state(id(29),'game',envelope({})),/learner_state_namespace_check/); } finally { await admin(); }
  await db.exec(gameUp); await db.exec(gameUp);
  await role('authenticated',id(29)); await state(id(29),'game',envelope({})); await admin();
  assert.deepEqual(await gameOwnerRows(),['game','history']);
  pass('game rollback refuses by default and deletes nothing; authorised it deletes only game rows and restores the sixteen-name check; the migration re-applies cleanly');

  // Speech dataset groundwork (inert): metadata only, service-only, closed shapes,
  // retention bounded by the database, path tied to the row, gone with the account.
  {
    const owner=id(31);
    let clipN=0; const nextClip=()=>`20000000-0000-4000-8000-${String(++clipN).padStart(12,'0')}`;
    const goodScores=[{ipa:'b',score:90,word:'bonjour'},{ipa:'ɔ̃',score:72.5,word:'bonjour',substituted:'o'}];
    const clip=(o={})=>{const cid=o.id??nextClip();const r={user_id:owner,consent_version:1,object_path:`${owner}/${cid}.wav`,lesson_id:'cafe-01',turn_id:'t1-greet',reference_line:'Bonjour, un café, s\'il vous plaît.',phonemes:['b','ɔ̃'],cefr_band:'A1',vendor:'speechace',scores:goodScores,duration_ms:2400,sample_rate_hz:16000,keep:'12 months',...o};
      return db.query('insert into public.speech_dataset_clips(id,user_id,consent_version,object_path,lesson_id,turn_id,reference_line,expected_phonemes,vendor,vendor_scores,cefr_band,duration_ms,sample_rate_hz,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13,now()+$14::interval)',
        [cid,r.user_id,r.consent_version,r.object_path,r.lesson_id,r.turn_id,r.reference_line,JSON.stringify(r.phonemes),r.vendor,JSON.stringify(r.scores),r.cefr_band,r.duration_ms,r.sample_rate_hz,r.keep]);};
    const clipCount=async()=>(await db.query('select count(*)::integer as n from public.speech_dataset_clips where user_id=$1',[owner])).rows[0].n;
    await db.query('insert into auth.users values($1)',[owner]);
    for(const client of ['anon','authenticated']){
      await role(client,owner);
      try {
        await assert.rejects(db.query('select * from public.speech_dataset_clips'),/permission denied/);
        await assert.rejects(clip(),/permission denied/);
      } finally { await admin(); }
    }
    const refuse=async(bad,name,why)=>assert.rejects(clip(bad),new RegExp(`violates check constraint "speech_dataset_clips_${name}"`),why);
    const firstId=nextClip();
    await role('service_role');
    try {
      await clip({id:firstId});
      await clip({keep:'24 months'});
      await clip({scores:[{ipa:'b',score:0,word:'b'},{ipa:'ʁ',score:100,word:'x'.repeat(40)}]});
      await assert.rejects(db.query('update public.speech_dataset_clips set consent_version=2 where user_id=$1',[owner]),/permission denied/,'service_role update');
      await assert.rejects(db.query('truncate public.speech_dataset_clips'),/permission denied/,'service_role truncate');
      await assert.rejects(db.query("insert into public.speech_dataset_clips(id,user_id,consent_version,object_path,lesson_id,turn_id,reference_line,vendor,cefr_band,duration_ms,sample_rate_hz,captured_at,expires_at) values($1,$2,1,$3,'cafe-01','t1','Bonjour','speechace','A1',2400,16000,now()-interval '1 year',now()+interval '1 month')",[id(40),owner,`${owner}/${id(40)}.wav`]),/permission denied/,'captured_at insert');
      for(const [bad,name,why] of [
        [{reference_line:'x'.repeat(201)},'reference_line','201-char line'],
        [{reference_line:'   '},'reference_line','whitespace-only line'],
        [{reference_line:'Bonjour\nmerci'},'reference_line','control character'],
        [{cefr_band:'B1'},'cefr_band','B1'],
        [{keep:'24 months 1 second'},'retention','24 months + 1 s'],
        [{keep:'-1 second'},'retention','expiry before capture'],
        [{object_path:`${id(30)}/${id(41)}.wav`},'object_path','foreign path'],
        [{object_path:`${owner}/${id(42)}.wav`},'object_path','path naming another clip'],
        [{sample_rate_hz:24000},'sample_rate','24 kHz'],
        [{consent_version:0},'consent_version','consent version 0'],
        [{duration_ms:0},'duration','0 ms'],
        [{duration_ms:30001},'duration','30001 ms'],
        [{lesson_id:'Cafe-01'},'lesson_id','uppercase lesson id'],
        [{phonemes:['b',1]},'phonemes_shape','non-string phoneme'],
        [{phonemes:['b','x'.repeat(9)]},'phonemes_shape','9-char phoneme'],
        [{scores:[{ipa:'b',score:90,word:'bon',transcript:'bonjour je voudrais'}]},'scores_shape','transcript key'],
        [{scores:[{ipa:'b',score:101,word:'bon'}]},'scores_shape','score 101'],
        [{scores:[{ipa:'b',word:'bon'}]},'scores_shape','missing score'],
        [{scores:['bonjour']},'scores_shape','string element'],
      ]) await refuse(bad,name,why);
      assert.equal(await clipCount(),3);
    } finally { await admin(); }
    assert.equal((await db.query("select count(*)::integer as n from public.speech_dataset_clips where captured_at>now()-interval '1 minute'")).rows[0].n,3,'captured_at did not default to now()');
    await assert.rejects(db.query("insert into public.speech_dataset_clips(id,user_id,consent_version,object_path,lesson_id,turn_id,reference_line,vendor,cefr_band,duration_ms,sample_rate_hz,captured_at,expires_at) values($1,$2,1,$3,'cafe-01','t1','Bonjour','speechace','A1',2400,16000,now()+interval '1 hour',now()+interval '2 hours')",[id(43),owner,`${owner}/${id(43)}.wav`]),/violates check constraint "speech_dataset_clips_captured_at"/,'future captured_at, even from the owner role');
    pass('speech_dataset_clips: anon and authenticated cannot read or write; service_role inserts valid rows (24 months exactly, PhonemeObservation scores) but cannot update, truncate or set captured_at; blank, long or control-character lines, B1, 24 months + 1 s, foreign or mismatched paths, 24 kHz, consent 0, 0 and 30001 ms, uppercase lesson id, non-string or 9-char phonemes and open or out-of-range score objects are refused by name');

    // Rollback, disposable only: refused by default with rows intact; authorised it
    // drops the table; the migration then re-applies twice and the cascade still holds.
    const clipUp=await readFile(`${root}/supabase/migrations/20261022200000_speech_dataset_clips.sql`,'utf8');
    const clipDown=await readFile(`${root}/supabase/rollback/20261022200000_down.sql`,'utf8');
    assert.match(clipDown,/^begin;[\s\S]*luvani\.remove_speech_clips[\s\S]*storage\.objects[\s\S]*drop table if exists public\.speech_dataset_clips;[\s\S]*^commit;\s*$/m,'the speech clips rollback does not own its transaction around the interlocks and the drop');
    await assert.rejects(db.exec(clipDown),/Refusing to drop speech dataset clips/);
    await db.exec('rollback');
    assert.equal(await clipCount(),3,'the speech clips rollback dropped rows past its interlock');
    await db.query("select set_config('luvani.remove_speech_clips','yes',false)");
    await db.exec(clipDown); await db.exec(clipDown);
    await db.query("select set_config('luvani.remove_speech_clips','',false)");
    assert.equal((await db.query("select to_regclass('public.speech_dataset_clips') as t")).rows[0].t,null,'the speech clips rollback left the table');
    await db.exec(clipUp); await db.exec(clipUp);
    await role('service_role');
    try {
      await clip();
      await assert.rejects(db.query('update public.speech_dataset_clips set consent_version=2'),/permission denied/,'re-applied grants allow update');
    } finally { await admin(); }
    await role('auth_deleter');await db.query('delete from auth.users where id=$1',[owner]);await admin();
    assert.equal((await db.query('select count(*)::integer as n from public.speech_dataset_clips')).rows[0].n,0,'speech clip outlived its account');
    pass('speech_dataset_clips rollback refuses by default with rows intact; authorised it drops the table and is safe twice; the migration re-applies twice with the same narrow grants; account deletion cascades');
  }

  await role('authenticated',a);
  const nearLimit=envelope({text:'quoted : space, comma, and café 👋',pad:''});
  nearLimit.data.pad='x'.repeat(MAX_ENVELOPE_BYTES-Buffer.byteLength(JSON.stringify(nearLimit)));
  assert.equal(Buffer.byteLength(JSON.stringify(nearLimit)),MAX_ENVELOPE_BYTES);
  await db.query("update learner_state set payload=$2::jsonb where user_id=$1 and namespace='journal'",[a,JSON.stringify(nearLimit)]);
  // A valid write may legitimately start a new calendar-minute bucket after
  // the earlier 48-write burst. Rejected writes must preserve the complete
  // accepted snapshot, whichever bucket that valid write established.
  const acceptedQuota=await quota(a);
  await role('authenticated',a);
  nearLimit.data.pad+='x';
  await assert.rejects(db.query("update learner_state set payload=$2::jsonb where user_id=$1 and namespace='journal'",[a,JSON.stringify(nearLimit)]),/byte limit/);
  await assert.rejects(state(a,'unknown',{}),/check constraint/);
  await assert.rejects(db.query("update learner_state set namespace='journal' where user_id=$1 and namespace='friends'",[a]),/identity is immutable/);
  for(const bad of [[...Array(20001)].map(()=>0), Object.fromEntries(Array.from({length:5001},(_,n)=>[String(n),0]))]) {
    await assert.rejects(db.query("update learner_state set payload=$2::jsonb where user_id=$1 and namespace='journal'",[a,JSON.stringify(envelope(bad))]),/item or depth/);
  }
  let deep=0;for(let n=0;n<26;n++) deep={nested:deep};
  await assert.rejects(db.query("update learner_state set payload=$2::jsonb where user_id=$1 and namespace='journal'",[a,JSON.stringify(envelope(deep))]),/item or depth/);
  const manyValues=Array.from({length:20000},()=>[0,0,0,0,0]);
  await assert.rejects(db.query("update learner_state set payload=$2::jsonb where user_id=$1 and namespace='journal'",[a,JSON.stringify(envelope(manyValues))]),/item or depth/);
  await assert.rejects(state(b,'profile',{}),/owner is invalid/);
  assert.equal((await db.query('select * from learner_state where user_id=$1',[b])).rows.length,0);
  await assert.rejects(db.query('select * from luvani_private.data_write_quotas'),/permission denied/);
  await assert.rejects(db.query("select luvani_private.admit_data_write_v1($1,'learner')",[a]),/permission denied/);
  await assert.rejects(db.query('select run_data_retention_v1(1)'),/permission denied/);
  await assert.rejects(db.query("insert into entitlements(user_id,plan) values($1,'regular')",[a]),/row-level security/);
  await assert.rejects(db.query('select refund_failed_session($1,$2,$3)',[a,id(99),'tts_error']),/permission denied/);
  await admin(); assert.deepEqual(await quota(a),acceptedQuota,'rejected writes changed the accepted quota snapshot');
  pass('rejected learner writes leave the full accepted quota snapshot unchanged without a calendar-minute assumption');
  pass('exact 512 KiB compact UTF-8 accepted; +1 byte/container/node/depth/identity violations rejected; RLS/privileged helpers remain closed');

  await role('authenticated',d);
  assert.ok((await db.query("select octet_length(payload::text)::integer as n from learner_state where user_id=$1 and namespace='journal'",[d])).rows[0].n>MAX_ENVELOPE_BYTES);
  await assert.rejects(db.query("update learner_state set payload=payload where user_id=$1 and namespace='journal'",[d]),/byte limit/);
  await db.query("update learner_state set payload='{}' where user_id=$1 and namespace='journal'",[d]);
  await role('authenticated',a);
  const remaining=240-(await quota(a)).learner_minute; await role('authenticated',a);
  await db.exec(`do $$ begin for n in 1..${remaining} loop update learner_state set payload='{}' where user_id='${a}' and namespace='journal'; end loop; end $$;`);
  await assert.rejects(db.query("update learner_state set payload='{}' where user_id=$1 and namespace='journal'",[a]),/learner write quota/);
  await admin(); assert.equal((await quota(a)).learner_minute,240);
  await db.query('update luvani_private.data_write_quotas set learner_minute=0,learner_day=20000 where user_id=$1',[a]);
  await role('authenticated',a); await assert.rejects(db.query("update learner_state set payload='{}' where user_id=$1 and namespace='journal'",[a]),/learner write quota/);
  await admin(); await db.query("update luvani_private.data_write_quotas set minute_started_at=now()-interval '1 day',day_started_at=(now() at time zone 'UTC')::date-1 where user_id=$1",[a]);
  await role('authenticated',a); await db.query("update learner_state set payload='{}' where user_id=$1 and namespace='journal'",[a]);
  assert.equal((await quota(a)).learner_day,1);
  await role('authenticated',a); await db.exec('begin'); await db.query("update learner_state set payload='{}' where user_id=$1 and namespace='journal'",[a]);await db.exec('rollback');assert.equal((await quota(a)).learner_day,1);
  pass('legacy state readable but must shrink on write; atomic 240/min and 20,000/day limits; reset and transaction rollback');

  await role('authenticated',c);
  await db.query(`insert into product_events(user_id,name,properties) select $1::uuid,'onboarding_completed','{"personalisedGreeting":false}' from generate_series(1,60)`,[c]);
  await assert.rejects(event(c),/product event quota/);
  await assert.rejects(event(a),/owner is invalid/);
  await assert.rejects(db.query("insert into product_events(user_id,name,properties) values($1,'trial_started','{}')",[c]),/quota|server-only/);
  await admin(); assert.equal((await quota(c)).events_minute,60);
  await db.query('update luvani_private.data_write_quotas set events_minute=0,events_day=1000 where user_id=$1',[c]);
  await role('authenticated',c); await assert.rejects(event(c),/product event quota/);
  await role('authenticated',b); await event(b);await assert.rejects(event(b),/retained product event quota/);
  await admin(); assert.equal((await db.query('select count(*)::integer as n from product_events where user_id=$1',[b])).rows[0].n,10000);
  await role('authenticated',e);
  await event(e,'2036-01-01','2000-01-01');
  assert.equal((await db.query("update product_events set received_at='2036-01-01' where user_id=$1 returning id",[e])).rows.length,0,'RLS must hide events from client UPDATE');
  await assert.rejects(db.query("insert into product_events(user_id,name,properties) values($1,'trial_started','{}')",[e]),/server-only/);
  await admin();
  const receipt=(await db.query('select received_at,occurred_at from product_events where user_id=$1',[e])).rows[0];
  assert.ok(Math.abs(Date.parse(receipt.received_at)-Date.now())<60000);
  await assert.rejects(db.query("update product_events set received_at='2036-01-01' where user_id=$1",[e]),/receipt identity is immutable/);
  const exportB=(await db.query('select public.export_account_data($1) as value',[b])).rows[0].value;assert.equal(exportB.product_events.length,10000);
  pass('direct/bulk event inserts:60/min,1,000/day,10,000 retained; untrusted clocks cannot set/change receipt; bounded event account still exports');

  // Old session fixtures are actual grant/debit functions, not invented ledger rows.
  await db.query("insert into entitlements(user_id,plan,seconds_used) values($1,'trial',0)",[a]);
  const sessions=[101,102,103].map(id);
  for(const session of sessions) {
    const ent=(await db.query('select * from entitlements where user_id=$1',[a])).rows[0];
    assert.equal((await db.query('select record_session_grant($1,$2,$3,$4,$5) as ok',[a,session,ent.plan,ent.seconds_used,ent.period_end])).rows[0].ok,true);
    await db.query('select consume_entitlement($1,100,$2)',[a,session]);
    await db.query("update session_usage set reported_at=now()-interval '25 months' where session_id=$1",[session]);
  }
  const pack=buildConversationPack({id:sessions[0],sessionId:sessions[0],learnerId:a,createdAt:new Date(now).toISOString(),title:{fr:'Au café',en:'At the café'},summary:'An order.',keyPhrases:[{fr:'Un café, merci.',frWritten:null,en:'A coffee, thanks.'}],corrections:[]});
  await role('service_role');await db.query('select receive_conversation_practice($1::jsonb,false)',[JSON.stringify(pack)]);await admin();
  await db.query("select refund_failed_session($1,$2,'tts_error')",[a,sessions[1]]);
  const expiredRequest=(await db.query('select id from social_edges where sender=$1 and recipient=$2',[d,e])).rows[0].id;
  await social(e,'accept',{id:expiredRequest});
  assert.equal((await db.query('select status from social_edges where id=$1',[expiredRequest])).rows[0].status,'pending','expired request accepted');
  assert.deepEqual(await social(d,'request',{username:'legacy.e'}),{ok:true});
  const freshRequest=(await db.query('select id,status,created_at from social_edges where sender=$1 and recipient=$2',[d,e])).rows[0];
  assert.notEqual(freshRequest.id,expiredRequest,'expired pair made fresh request an ignored conflict');
  assert.equal(freshRequest.status,'pending');assert.ok(Date.parse(freshRequest.created_at)>Date.now()-60000);
  await social(e,'accept',{id:expiredRequest});
  assert.equal((await db.query('select status from social_edges where id=$1',[freshRequest.id])).rows[0].status,'pending','stale identity accepted fresh reissue');
  assert.equal((await social(e,'snapshot')).requests[0].id,freshRequest.id);
  const before=(await db.query('select * from session_usage where user_id=$1 order by session_id',[a])).rows;
  const first=await retention(2);assert.equal(first.analyticsDeleted,2);assert.equal(first.installationMarkersDeleted,2);assert.equal(first.usageProofsPreserved,2);assert.equal(first.expiredRequestsDeleted,1);
  const second=await retention(2);assert.equal(second.analyticsDeleted,1);assert.equal(second.installationMarkersDeleted,1);assert.equal(second.usageProofsPreserved,1);
  const third=await retention(2);assert.equal(third.analyticsDeleted,0);assert.equal(third.installationMarkersDeleted,0);assert.equal(third.usageProofsPreserved,0);
  assert.equal((await db.query('select count(*)::integer as n from product_events where user_id=$1',[d])).rows[0].n,1,'future event should survive only on its trusted receipt, not disappear early');
  assert.equal((await db.query('select count(*)::integer as n from product_events where user_id=$1',[e])).rows[0].n,1,'forged old receipt caused early erasure');
  const after=(await db.query('select * from session_usage where user_id=$1 order by session_id',[a])).rows;
  for(let n=0;n<before.length;n++) { const {detail_retention_reviewed_at,...actual}=after[n],{detail_retention_reviewed_at:discard,...expected}=before[n]; assert.ok(detail_retention_reviewed_at);assert.deepEqual(actual,expected); }
  for(const invalid of [null,0,1001]) await assert.rejects(retention(invalid),/between 1 and 1000/);
  const allowance=(await db.query('select seconds_used from entitlements where user_id=$1',[a])).rows[0].seconds_used;
  for(const session of sessions) await db.query('select consume_entitlement($1,100,$2)',[a,session]);
  assert.equal((await db.query('select seconds_used from entitlements where user_id=$1',[a])).rows[0].seconds_used,allowance,'retention reopened debit');
  const firstRefund=(await db.query("select refund_failed_session($1,$2,'tts_error') as value",[a,sessions[0]])).rows[0].value;
  const retryRefund=(await db.query("select refund_failed_session($1,$2,'tts_error') as value",[a,sessions[0]])).rows[0].value;assert.deepEqual(retryRefund,firstRefund);
  await assert.rejects(db.query('select consume_entitlement($1,100,$2)',[b,sessions[0]]),/provisioned|another account/);
  const text={sessionId:sessions[0],title:'Au café',lines:[{id:'t1',who:'learner',fr:'Bonjour',frWritten:null,en:null}]};
  assert.equal((await db.query('select save_conversation_text($1,$2,$3::jsonb) as value',[a,sessions[0],JSON.stringify(text)])).rows[0].value,'saved');
  await db.query('select delete_conversation_text($1,$2)',[a,sessions[0]]);
  assert.equal((await db.query('select save_conversation_text($1,$2,$3::jsonb) as value',[a,sessions[0],JSON.stringify(text)])).rows[0].value,'deleted');
  await role('service_role');
  await db.query("update conversation_practice_jobs set available_at=now()-interval '1 second' where pack_id=$1",[sessions[0]]);
  const job=(await db.query('select * from claim_conversation_practice()')).rows[0];assert.ok(job.lease_token);
  assert.equal((await db.query('select finish_conversation_practice($1,$2,$3::jsonb) as ok',[sessions[0],job.lease_token,JSON.stringify([{id:'after-retention'}])])).rows[0].ok,true);
  await admin();
  await db.exec('update phrase_audio_policy set enabled=true');
  const fingerprint='a'.repeat(64);
  await db.query("insert into phrase_audio_rates(voice,fingerprint,micro_usd_per_utf8_byte,fixed_call_micro_usd,verified_at,expires_at) values('alexandre',$1,1,1,now(),now()+interval '1 day')",[fingerprint]);
  // Invented fixture rate only; default production switch was verified off.
  const reserved=(await db.query('select reserve_phrase_audio($1,$2,$3,0,$4,$5) as value',[a,sessions[0],'phrase','alexandre',fingerprint])).rows[0].value;assert.ok(reserved);
  const archive=(await db.query('select export_account_data($1) as value',[a])).rows[0].value;
  assert.equal(archive.session_usage.length,3);assert.equal(archive.session_grants.length,3);assert.ok(archive.session_usage.every(row=>row.detail_retention_reviewed_at));
  pass('bounded retention13/24months and14days; server-clock fixtures; repeat no-ops; all usage fields/fences preserved; debit/refund/text/practice/audio/export remain valid');

  // Coordinated senders hit one shared recipient profile fence. Real concurrent
  // sessions must still run in staging PostgreSQL; this is sequential actual SQL.
  for(let n=6;n<=28;n++) await social(id(n),'enrol',{username:`sender${n}`,name:`Sender ${n}`});
  const target=id(28);
  for(let n=6;n<26;n++) await social(id(n),'request',{username:'sender28'});
  assert.equal((await social(target,'snapshot')).requests.length,20);
  await assert.rejects(social(id(26),'request',{username:'sender28'}),/limit_reached/);
  await social(id(6),'request',{username:'sender28'}); // existing pair remains idempotent
  const incoming=(await social(target,'snapshot')).requests[0];
  await social(id(27),'accept',{id:incoming.id});assert.equal((await social(target,'snapshot')).requests.length,20);
  await social(target,'accept',{id:incoming.id});assert.equal((await social(target,'snapshot')).friends.length,1);
  await social(target,'block',{id:id(6)});await social(target,'unblock',{id:id(6)});assert.equal((await social(target,'snapshot')).friends.length,0);
  await role('authenticated',a);await assert.rejects(db.query('insert into social_edges(sender,recipient) values($1,$2)',[a,b]),/permission denied/);await admin();
  // Timestamp immutability prevents convenience updates postponing expiry.
  await assert.rejects(db.query("update social_edges set created_at=now()-interval '15 days'"),/identity is immutable/);
  const missing=(await db.query(`select con.conrelid::regclass::text as table_name,a.attname as column_name from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1] where con.contype='f' and con.connamespace='public'::regnamespace and array_length(con.conkey,1)=1 and not exists(select 1 from pg_index i where i.indrelid=con.conrelid and i.indisvalid and i.indpred is null and i.indkey[0]=con.conkey[1])`)).rows;
  assert.deepEqual(missing,[]);
  pass('20-sender recipient admission; existing pair retry; snapshot response shape; ownership/accept/block/unblock; immutable creation time; four missing FK indexes closed');

  for(const name of ['anon','authenticated']) {
    await role(name,a);await assert.rejects(db.query('select run_data_retention_v1(1)'),/permission denied/);await assert.rejects(db.query("select luvani_private.check_learner_payload_v1('{}')"),/permission denied/);await assert.rejects(db.query('select * from luvani_private.data_write_quotas'),/permission denied/);await admin();
  }
  const functions=(await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('admit_data_write_v1','lock_client_data_owner_v1','check_learner_payload_v1','bound_learner_write_v1','bound_product_event_v1','run_data_retention_v1','bound_incoming_request_v1')")).rows;
  assert.equal(functions.length,7);assert.ok(functions.every(row=>!row.anon&&!row.authenticated&&row.proconfig.includes('search_path=""')));
  await role('auth_deleter');await db.query('delete from auth.users where id=$1',[a]);await admin();
  assert.equal((await db.query('select count(*)::integer as n from luvani_private.data_write_quotas where user_id=$1',[a])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::integer as n from session_usage where user_id=$1',[a])).rows[0].n,0);
  assert.ok((await db.query('select * from conversation_practice_tombstones where pack_id=$1',[sessions[0]])).rows.length);
  await role('authenticated',a);await assert.rejects(state(a,'profile',{}),/account is not active/);await admin();
  pass('closed EXECUTE/private quota ACL/pinned paths; restricted Auth erasure cascades quota/proofs while preserving pack tombstone');
  // Refusal and explicitly authorized rollback/reapply are disposable only.
  // Each down script owns its transaction, so an interlock error aborts every
  // following statement even when a SQL client continues processing the file.
  const snapshotPreserved = async () => ({
    quotas:(await db.query('select * from luvani_private.data_write_quotas order by user_id')).rows,
    receipts:(await db.query('select id,received_at from product_events order by id')).rows,
    usage:(await db.query('select * from session_usage order by session_id')).rows,
    edges:(await db.query('select * from social_edges order by id')).rows,
    tombstones:(await db.query('select * from conversation_practice_tombstones order by pack_id')).rows,
  });
  const preserved=await snapshotPreserved();
  const rollbackSettings=['luvani.rollback_data_bounds','luvani.rollback_data_retention','luvani.rollback_social_bounds'];
  for(let n=2;n>=0;n--) {
    const down=await readFile(`${root}/supabase/rollback/${owned[n].split('_')[0]}_down.sql`,'utf8');
    await assert.rejects(db.exec(down),/Refusing to/);
    await db.exec('rollback');
    assert.deepEqual(await snapshotPreserved(),preserved,'default rollback changed retained data');
    await db.query('select set_config($1,$2,false)',[rollbackSettings[n],'yes']);
    await db.exec(down);
    await db.query('select set_config($1,$2,false)',[rollbackSettings[n],'']);
    assert.deepEqual(await snapshotPreserved(),preserved,'authorized rollback erased retained data');
  }
  assert.equal((await db.query("select to_regprocedure('public.run_data_retention_v1(integer)') as name")).rows[0].name,null);
  assert.equal((await db.query("select to_regprocedure('luvani_private.admit_data_write_v1(uuid,text)') as name")).rows[0].name,null);
  const restored=(await db.query("select pg_get_functiondef('luvani_private.social_dispatch(text,jsonb)'::regprocedure) as body")).rows[0].body;
  const original=await readFile(`${root}/supabase/migrations/20260919120650_home_friends_daily.sql`,'utf8');
  assert.ok(restored.includes(original.match(/create (?:or replace )?function luvani_private\.social_dispatch[\s\S]*?as \$\$([\s\S]*?)\$\$;/i)[1]),'social rollback did not restore the prior dispatcher body');
  for(const file of owned) await db.exec(await readFile(`${root}/supabase/migrations/${file}`,'utf8'));
  assert.deepEqual(await snapshotPreserved(),preserved,'reapplication reset quota, receipt, review or relationship provenance');
  const UTCFunctions=(await db.query("select proname,proconfig from pg_proc where proname in ('run_data_retention_v1','bound_incoming_request_v1','social_dispatch')")).rows;
  assert.equal(UTCFunctions.length,3);assert.ok(UTCFunctions.every(row=>row.proconfig.includes('TimeZone=UTC')));
  await role('authenticated',b);await assert.rejects(db.query('select run_data_retention_v1(1)'),/permission denied/);await admin();
  pass('all three rollbacks refuse by default; explicit atomic rollback/reapply retains quotas/receipts/usage/social/tombstones; prior dispatcher restored; UTC expiry and closed retention EXECUTE preserved');
  console.log('LIMITATION: no hosted calls, independent PostgreSQL connections, gateway body limits, cron execution, device/load calibration or speaking-detail erasure policy completion.');
} finally { await db.close(); }
