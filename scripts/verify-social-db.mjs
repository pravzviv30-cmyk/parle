/** Disposable PostgreSQL/WASM proof. Never connects to a Supabase project.
 * npm install --prefix /tmp/luvani-social-db @electric-sql/pglite
 * LUVANI_PGLITE_MODULE=/tmp/luvani-social-db/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-social-db.mjs
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.LUVANI_PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
const ids = ['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.learner_state(user_id uuid, namespace text, payload jsonb);
insert into auth.users values ${ids.map(id => `('${id}')`).join(',')};`);
await db.exec(readFileSync(new URL('../supabase/migrations/20260919120650_home_friends_daily.sql', import.meta.url),'utf8'));
async function rpc(user, action, args = {}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user ?? '']);
  await db.exec('set role authenticated');
  try { return (await db.query('select public.luvani_social($1,$2::jsonb) as result',[action,JSON.stringify(args)])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
const [a,b,c] = ids;
try {
  await assert.rejects(rpc(null,'snapshot'), /not_allowed/);
  for (let i=0;i<3;i++) await rpc(ids[i],'enrol',{username:`person${i}`,name:`Person ${i}`});
  await assert.rejects(rpc(c,'enrol',{username:'person0'}),/username_taken/);
  await rpc(a,'request',{username:'person1'});
  let snap = await rpc(b,'snapshot'); const request = snap.requests[0].id;
  assert.equal(snap.friends.length,0);
  await rpc(c,'accept',{id:request}); assert.equal((await rpc(b,'snapshot')).requests.length,1);
  await rpc(b,'accept',{id:request}); assert.equal((await rpc(a,'snapshot')).friends.length,1);
  const now = Date.now()-1000;
  const entries = [{at:now,kind:'convo',xp:65},{at:now,kind:'convo',xp:65},{at:now-1,kind:'review',xp:90},{at:now+864000000,kind:'convo',xp:100},{at:now,kind:'listen',xp:100}];
  await db.query('insert into public.learner_state values($1,$2,$3::jsonb)',[a,'activity',JSON.stringify({v:1,deviceId:'test',savedAt:now,data:{version:2,entries}})]);
  snap = await rpc(a,'snapshot'); assert.equal(snap.self.points,100); assert.equal(snap.self.conversations,1);
  assert.equal((await rpc(c,'snapshot')).friends.length,0);
  await rpc(a,'settings',{showScore:false}); assert.equal((await rpc(b,'snapshot')).friends[0].points,null);
  await rpc(a,'inviteChallenge',{id:b}); const challenge = (await rpc(b,'snapshot')).challenges[0].id;
  await rpc(c,'acceptChallenge',{id:challenge}); assert.equal((await rpc(b,'snapshot')).challenges[0].status,'pending');
  await rpc(b,'acceptChallenge',{id:challenge}); assert.equal((await rpc(a,'snapshot')).challenges[0].count,0,'old conversations must not count');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.social_profiles'),/permission denied/);
  await assert.rejects(db.query("select luvani_private.social_stats($1,now()-interval '7 days',now())",[b]),/permission denied/);
  await db.exec('reset role');
  await rpc(b,'block',{id:a}); assert.equal((await rpc(a,'snapshot')).friends.length,0); assert.equal((await rpc(a,'snapshot')).challenges.length,0);
  assert.equal((await rpc(a,'search',{username:'person1'})).length,0);
  await assert.rejects(rpc(a,'request',{username:'person1'}),/not_found/);
  await rpc(b,'unblock',{id:a}); assert.equal((await rpc(a,'snapshot')).friends.length,0);
  await rpc(a,'request',{username:'person1'}); await rpc(b,'accept',{id:(await rpc(b,'snapshot')).requests[0].id});
  await rpc(a,'settings',{enabled:false}); assert.equal((await rpc(b,'snapshot')).friends.length,0); assert.equal((await rpc(a,'snapshot')).settings.enabled,false);
  await db.query('delete from auth.users where id=$1',[a]); assert.equal((await db.query('select count(*)::int n from public.social_profiles where user_id=$1',[a])).rows[0].n,0);
  const rollback = readFileSync(new URL('../supabase/rollback/20260919120650_down.sql',import.meta.url),'utf8');
  await assert.rejects(db.exec(rollback),/Refusing to remove Friends data/);
  assert.equal((await db.query("select to_regclass('public.social_profiles') as name")).rows[0].name,'social_profiles');
  const personalRows = (await db.query('select count(*)::int n from public.learner_state')).rows[0].n;
  await db.exec("set luvani.remove_friends='yes'"); await db.exec(rollback);
  assert.equal((await db.query('select count(*)::int n from public.learner_state')).rows[0].n,personalRows);
  console.log('PASS: actual PostgreSQL migration, authentication, ownership, private scores, score caps, duplicate events, challenge consent, blocks, leaving, account deletion and guarded rollback preserving personal progress.');
} finally { await db.close(); }
