/** Real, isolated PostgreSQL with independent connections; no account or vendor keys. */
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
if (!process.env.EMBEDDED_POSTGRES_MODULE) throw new Error('Set EMBEDDED_POSTGRES_MODULE to an isolated installed test runtime.');
const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.EMBEDDED_POSTGRES_MODULE).href);
const dir=await mkdtemp(join(tmpdir(),'luvani-refund-pg-'));
const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'isolated-refund-fixture',port,persistent:false,onLog:()=>{},onError:()=>{}});
const connections=[];let started=false;
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const sid=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
const sql=async name=>await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
try {
 await pg.initialise();await pg.start();started=true;
 for(let i=0;i<3;i++){const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();await c.query("set statement_timeout='4s'");connections.push(c);}
 const [admin,a,b]=connections;
 await admin.query(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';`);
 for(const name of ['202608220001_luvani_learning.sql','202608230001_session_usage_idempotency.sql','202608240001_claim_trial_null_fix.sql','202608250001_consume_entitlement_null_fix.sql','202608300001_billing_events.sql','202608300002_paid_period_lapse.sql','202608300003_paid_lapse_marker.sql','202609100001_max_allowance_three_hundred.sql','20261002154637_atomic_billing_projection.sql']) await admin.query(await sql(name));
 // Export-only fixtures. Debit, trial, billing and new refund SQL are actual migrations.
 await admin.query('create table conversation_packs(id uuid primary key,session_id uuid,user_id uuid,state text,payload jsonb);create table saved_conversation_text(user_id uuid);create table phrase_audio_budgets(user_id uuid);');
 for(const table of ['social_profiles','social_blocks','social_reports','social_notices','social_reactions'])await admin.query(`create table ${table}(user_id uuid)`);
 for(const table of ['social_edges','social_challenges'])await admin.query(`create table ${table}(sender uuid,recipient uuid)`);
 await admin.query(await sql('20261002233520_failed_session_refunds.sql'));
 await admin.query('insert into auth.users values($1),($2)',[user,other]);
 await admin.query("insert into entitlements(user_id,plan,seconds_used) values($1,'trial',0),($2,'trial',0)",[user,other]);
 const balance=async()=> (await admin.query('select * from entitlements where user_id=$1',[user])).rows[0];
 const grant=async(id,c=admin,expected)=> {const e=expected ?? await balance();return (await c.query('select record_session_grant($1,$2,$3,$4,$5) as value',[user,id,e.plan,e.seconds_used,e.period_end])).rows[0].value;};
 const debit=(c,id)=>c.query('select to_jsonb(consume_entitlement($1,100,$2)) as value',[user,id]);
 const refund=(c,id)=>c.query("select refund_failed_session($1,$2,'tts_error') as value",[user,id]);
 const pidA=(await a.query('select pg_backend_pid() as value')).rows[0].value;
 const pidB=(await b.query('select pg_backend_pid() as value')).rows[0].value;
 const blocked=async()=>{
  for(let i=0;i<40;i++){const row=(await admin.query('select $1::integer=any(pg_blocking_pids($2::integer)) as value',[pidA,pidB])).rows[0];if(row.value)return;await new Promise(resolve=>setTimeout(resolve,25));}
  throw new Error('Second real transaction never waited on the first entitlement lock');
 };
 await grant(sid(1));await a.query('begin');await debit(a,sid(1));
 let waiting=refund(b,sid(1));await blocked();await a.query('commit');
 assert.equal((await waiting).rows[0].value.refundedSeconds,100);assert.equal((await balance()).seconds_used,0);
 assert.equal((await refund(admin,sid(1))).rows[0].value.refundedSeconds,100);assert.equal((await balance()).seconds_used,0);
 await grant(sid(2));await a.query('begin');await refund(a,sid(2));
 waiting=debit(b,sid(2));await blocked();await a.query('commit');await waiting;
 assert.equal((await balance()).seconds_used,0,'failure tombstone wins against blocked debit');
 await admin.query("update entitlements set plan='starter',period_end='2027-01-01',seconds_used=0 where user_id=$1",[user]);
 const old=await balance();await a.query('begin');
 const ticket=(await a.query('select begin_billing_refresh($1) as value',[user])).rows[0].value;
 await a.query("select apply_billing_projection($1,$2,'active','starter','2027-02-01',null)",[user,ticket]);
 waiting=grant(sid(3),b,old);await blocked();await a.query('commit');assert.equal(await waiting,false,'concurrent renewal refuses the stale signed-token snapshot');
 await grant(sid(4));await debit(admin,sid(4));await grant(sid(5));
 await a.query('begin');const renewal=(await a.query('select begin_billing_refresh($1) as value',[user])).rows[0].value;
 await a.query("select apply_billing_projection($1,$2,'active','starter','2027-03-01',null)",[user,renewal]);
 waiting=debit(b,sid(5));await blocked();await a.query('commit');await waiting;
 assert.equal((await balance()).seconds_used,0,'old issued epoch cannot debit the new cycle');
 assert.equal((await refund(admin,sid(4))).rows[0].value.kind,'historical-reversal');assert.equal((await balance()).seconds_used,0);
 await grant(sid(6));await debit(admin,sid(6));await a.query('begin');await refund(a,sid(6));
 waiting=refund(b,sid(6));await blocked();await a.query('commit');await waiting;assert.equal((await balance()).seconds_used,0,'concurrent duplicate refund is once-only');
 await assert.rejects(admin.query("select refund_failed_session($1,$2,'tts_error')",[other,sid(6)]),/owner|account/);
 console.log('PASS: real PostgreSQL '+(await admin.query('show server_version')).rows[0].server_version+'; independent transaction locks observed for debit→refund, refund→debit, renewal→grant, renewal→late debit and duplicate refunds. Old-period reversal and cross-owner denial checked. Isolated local instance, not hosted rollout proof.');
} finally {
 for(const c of connections){await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}
 if(started)await pg.stop();await rm(dir,{recursive:true,force:true});
}
