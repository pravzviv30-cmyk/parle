/** Disposable PostgreSQL proof. npm install --prefix <temporary-dir> @electric-sql/pglite@0.3.14 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to the temporary pglite/dist/index.js path.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create role auth_deleter;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema auth to auth_deleter;
    grant select,delete on auth.users to auth_deleter;
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    grant usage on schema public to service_role;
    insert into auth.users values('11111111-1111-4111-8111-111111111111');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202609040001_conversation_packs.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260920194653_conversation_practice_jobs.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260920200454_practice_receipt_finalization.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20260920200807_practice_account_deletion.sql',import.meta.url),'utf8'));
  const id='22222222-2222-4222-8222-222222222222';
  const pack={id,sessionId:id,learnerId:'11111111-1111-4111-8111-111111111111',state:'ready',createdAt:'2026-09-20T12:00:00Z',exercises:[]};
  const receive=(p=pack,final=false)=>db.query('select public.receive_conversation_practice($1::jsonb,$2)',[JSON.stringify(p),final]);
  const claim=async()=>{
    await db.query("update public.conversation_practice_jobs set available_at=now()-interval '1 second'");
    return (await db.query('select * from public.claim_conversation_practice()')).rows[0];
  };
  const finish=(j,ex)=>db.query('select public.finish_conversation_practice($1,$2,$3::jsonb) as ok',[j.pack_id,j.lease_token,ex===null?null:JSON.stringify(ex)]);
  await db.exec('set role service_role');
  await receive(); await receive();
  assert.equal((await db.query('select * from public.conversation_practice_jobs')).rows.length,1);
  const first=await claim(); assert.ok(first.lease_token);
  assert.equal((await db.query('select * from public.claim_conversation_practice()')).rows.length,0);
  await db.exec("update public.conversation_practice_jobs set lease_until=now()-interval '1 second'");
  const second=await claim(); assert.notEqual(second.lease_token,first.lease_token);
  assert.equal((await finish(first,[{id:'stale'}])).rows[0].ok,false);
  assert.equal((await finish(second,[{id:'enriched'}])).rows[0].ok,true);
  await receive();
  assert.equal((await db.query('select payload from public.conversation_packs')).rows[0].payload.exercises[0].id,'enriched');
  await receive({...pack,exercises:[]},true); // late failed analyst cannot erase recovery
  assert.equal((await db.query('select payload from public.conversation_packs')).rows[0].payload.exercises[0].id,'enriched');
  const deletedJob=second;
  await db.query('delete from public.conversation_packs where id=$1',[id]);
  assert.equal((await finish(deletedJob,[{id:'late'}])).rows[0].ok,false);
  await receive({...pack,exercises:[{id:'late-agent'}]},true);
  assert.equal((await db.query('select * from public.conversation_packs')).rows.length,0);
  assert.equal((await db.query('select * from public.conversation_practice_jobs')).rows.length,0);
  const retryId='33333333-3333-4333-8333-333333333333';
  await receive({...pack,id:retryId,sessionId:retryId});
  for(let i=0;i<5;i++){const j=await claim(); assert.ok(j); await finish(j,null);}
  assert.equal((await db.query('select status,attempts from public.conversation_practice_jobs')).rows[0].status,'failed');
  assert.equal(await claim(),undefined);
  await receive({...pack,id:retryId,sessionId:retryId},true);
  assert.equal((await db.query('select status from public.conversation_practice_jobs')).rows[0].status,'failed');
  for(const role of ['anon','authenticated']){
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query('select * from public.claim_conversation_practice()'),/permission denied/);
    await assert.rejects(db.query('select * from public.conversation_practice_jobs'),/permission denied/);
    await assert.rejects(receive(),/permission denied/);
  }
  await db.exec('reset role; set role auth_deleter');
  await db.query('delete from auth.users where id=$1',[pack.learnerId]);
  await db.exec('reset role');
  assert.equal((await db.query('select * from public.conversation_practice_jobs')).rows.length,0);
  console.log('PASS: SQL receipt idempotency, leases, crash recovery, stale fencing, retry exhaustion, privacy deletion, account cascade and role isolation.');
} finally { await db.close(); }
