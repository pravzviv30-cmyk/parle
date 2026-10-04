/** Disposable sequential PostgreSQL/WASM proof; never connects to hosted services.
 * Preserves migration31 account fencing and tests new Friends launch capability.
 * Independent PostgreSQL concurrency and staffed moderation remain external.
 */
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const root=fileURLToPath(new URL('../',import.meta.url));
const migration='20261004004023_friends_launch_guard.sql';
const sql=await readFile(`${root}/supabase/migrations/${migration}`,'utf8');
const down=await readFile(`${root}/supabase/rollback/20261004004023_down.sql`,'utf8');
const db=new PGlite(),groups=[];
const uid=n=>`14000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function role(name,user='') { await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);if(name)await db.exec(`set role ${name}`); }
const owner=()=>role('');
async function social(n,action,args={}) { await role('authenticated',uid(n));try{return (await db.query('select public.luvani_social($1,$2::jsonb) as value',[action,JSON.stringify(args)])).rows[0].value;}finally{await owner();} }
const config=async()=> (await db.query('select * from luvani_private.friends_launch_config')).rows[0];
const reviewed=()=>db.query("update luvani_private.friends_launch_config set enabled=true,reviewed_by='disposable-reviewer',evidence_url='https://fixture.test/moderation',evidence_sha256=$1,expires_at=clock_timestamp()+interval '1 hour'",[createHash('sha256').update('offline synthetic review only').digest('hex')]);
const refusal=async(pattern)=>{await assert.rejects(db.exec(down),pattern);await db.exec('rollback');};
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
 const migrations=(await readdir(`${root}/supabase/migrations`)).filter(n=>n.endsWith('.sql')).sort();
 let wrapperBefore;
 for(const file of migrations) {
  if(file===migration)wrapperBefore=(await db.query("select oid,md5(pg_get_functiondef(oid)) as hash from pg_proc where oid='public.luvani_social(text,jsonb)'::regprocedure")).rows[0];
  await db.exec(await readFile(`${root}/supabase/migrations/${file}`,'utf8'));
 }
 assert.ok(wrapperBefore);
 const wrapperAfter=(await db.query("select oid,md5(pg_get_functiondef(oid)) as hash from pg_proc where oid='public.luvani_social(text,jsonb)'::regprocedure")).rows[0];
 assert.deepEqual(wrapperAfter,wrapperBefore,'public privacy wrapper changed');
 for(let n=1;n<=3;n++)await db.query('insert into auth.users(id) values($1)',[uid(n)]);
 assert.equal((await config()).enabled,false);assert.equal((await config()).ever_enabled,false);
 for(const action of ['snapshot','enrol','search','request','report','block','settings'])await assert.rejects(social(1,action,{username:'alice.test',id:uid(2),reason:'test'}),e=>e.code==='PT503');
 assert.equal((await db.query('select count(*)::int as n from public.social_profiles')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int as n from public.social_reports')).rows[0].n,0);
 groups.push(`all ${migrations.length} migrations, default OFF with zero side effects; wrapper OID/body preserved`);

 for(const name of ['anon','authenticated','service_role']) {
  await role(name,uid(1));
  for(const statement of ['select * from luvani_private.friends_launch_config',
   "update luvani_private.friends_launch_config set enabled=true",
   'delete from luvani_private.friends_launch_config',
   'insert into luvani_private.friends_launch_config(singleton) values(true)',
   'select luvani_private.enforce_friends_launch_v1()',
   'select luvani_private.validate_friends_launch_config_v1()',
   "select luvani_private.social_dispatch('enrol','{\"username\":\"alice.test\"}')"])await assert.rejects(db.exec(statement),e=>e.code==='42501');
 }
 await owner();
 const helper=(await db.query("select prosecdef,proconfig from pg_proc where oid='luvani_private.enforce_friends_launch_v1()'::regprocedure")).rows[0];
 assert.equal(helper.prosecdef,true);assert.ok(helper.proconfig.includes('search_path=""'));
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='luvani_private.friends_launch_config'::regclass")).rows[0].relrowsecurity,true);
 groups.push('anon/authenticated/service cannot configure, read private review or call helpers/dispatcher directly; RLS and fixed path');

 await refusal(/maintenance interlock/);
 assert.equal((await config()).enabled,false,'refused rollback destroyed singleton');
 await db.exec("select set_config('luvani.friends_rollback_maintenance','approved',false)");
 await db.exec(down);
 assert.equal((await db.query("select to_regclass('luvani_private.friends_launch_config') as v")).rows[0].v,null);
 assert.deepEqual((await db.query("select oid,md5(pg_get_functiondef(oid)) as hash from pg_proc where oid='public.luvani_social(text,jsonb)'::regprocedure")).rows[0],wrapperBefore);
 await db.exec(sql);assert.equal((await config()).enabled,false);
 groups.push('atomic refusal, explicit unactivated maintenance rollback/reapply preserve public wrapper');

 const valid="enabled=true,reviewed_by='fixture-reviewer',evidence_url='https://fixture.test/moderation',evidence_sha256=md5('a')||md5('b'),expires_at=clock_timestamp()+interval '1 hour'";
 for(const suffix of ["reviewed_by=null","reviewed_by='  '","evidence_url=null","evidence_url='http://fixture.test'","evidence_url='https://name:fake-credential@fixture.test'","evidence_sha256=null","evidence_sha256=repeat('0',64)","expires_at=null","expires_at=clock_timestamp()-interval '1 second'","expires_at=clock_timestamp()+interval '8 days'"]) {
  // Override a field through an outer CTE avoids duplicate UPDATE assignments.
  const [field,value]=suffix.split(/=(.*)/s);
  const assignments=valid.split(',').filter(v=>!v.startsWith(`${field}=`)).concat(`${field}=${value}`).join(',');
  await assert.rejects(db.exec(`update luvani_private.friends_launch_config set ${assignments}`),e=>e.code==='PT400');
 }
 await assert.rejects(db.exec('delete from luvani_private.friends_launch_config'),e=>e.code==='PT409');
 assert.equal((await config()).ever_enabled,false);
 groups.push('strict null-safe reviewer/HTTPS/hash/seven-day expiry validation; singleton deletion denied');

 await reviewed();assert.equal((await config()).ever_enabled,true);assert.ok((await config()).reviewed_at);
 assert.deepEqual(await social(1,'enrol',{username:'alice.test',name:'Alice'}),{ok:true});
 await social(2,'enrol',{username:'bob.test',name:'Bob'});await social(3,'enrol',{username:'carol.test',name:'Carol'});
 assert.deepEqual(await social(1,'request',{username:'bob.test'}),{ok:true});
 const request=(await social(2,'snapshot')).requests[0];await social(2,'accept',{id:request.id});
 assert.equal((await social(1,'snapshot')).friends[0].id,uid(2));
 await assert.rejects(social(3,'report',{id:uid(1),reason:'unrelated owner'}),/not_allowed/);
 await social(2,'report',{id:uid(1),reason:'fixture abuse report'});
 assert.equal((await db.query('select count(*)::int as n from public.social_reports')).rows[0].n,1);
 assert.equal((await social(1,'snapshot')).friends.length,0);
 assert.deepEqual(await social(1,'search',{username:'bob.test'}),[]);
 groups.push('owner-reviewed synthetic activation retains request/accept/report/block and cross-account relationships');

 await db.exec("update luvani_private.friends_launch_config set enabled=false,ever_enabled=false");
 assert.equal((await config()).ever_enabled,true);await assert.rejects(social(1,'snapshot'),e=>e.code==='PT503');
 await refusal(/ever enabled/);assert.equal((await config()).ever_enabled,true);
 await reviewed();await db.exec("update luvani_private.friends_launch_config set expires_at=clock_timestamp()+interval '0.2 seconds'");
 await new Promise(resolve=>setTimeout(resolve,350));await assert.rejects(social(1,'snapshot'),e=>e.code==='PT503');
 assert.equal((await config()).enabled,true,'expiry must deny without mutating operator config');
 groups.push('disable and actual time expiry deny; historical activation fence cannot be reset and prevents destructive rollback');

 await reviewed();await role('service_role');await db.query('select public.fence_tutor_account_v1($1)',[uid(3)]);await owner();
 await assert.rejects(social(3,'snapshot'),e=>e.code==='42501');
 await assert.rejects(social(99,'snapshot'),e=>e.code==='42501');
 await role('anon');await assert.rejects(db.exec("select public.luvani_social('snapshot','{}')"),e=>e.code==='42501');await owner();
 groups.push('enabled launch cannot bypass account erasure fence, missing auth parent or anonymous RPC ACL');
 for(const label of groups)console.log(`PASS: ${label}`);
 console.log(`All ${groups.length} Friends launch proof groups passed. Disposable sequential SQL only; moderation and hosted/concurrent acceptance remain unverified.`);
} finally {await db.close();}
