/** Disposable PostgreSQL/WASM proof of 20261026090000_practice_completion_signal.sql:
 * built-in translate exercises never complete a practice job, finish keeps them,
 * tombstones and owner fences still hold, and the rollback restores the old bodies. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {translationExercisesFor} from '@luvani/core';
const root=new URL('../',import.meta.url),db=new PGlite();
const migration='20261026090000_practice_completion_signal.sql';
const id=n=>`c1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),fenced=id(2);
const phrases=[{fr:'Bonjour',frWritten:null,en:'Hello'},{fr:'Merci beaucoup',frWritten:null,en:'Thank you very much'}];
const builtins=packId=>translationExercisesFor(packId,phrases);
const generated=(n,key='bonjour')=>({id:`gen:${key}:fill-blank:${n}`,kind:'fill-blank',phraseKey:key});
const pack=(n,exercises,learner=owner)=>({id:id(100+n),sessionId:id(100+n),learnerId:learner,state:'ready',createdAt:'2026-10-26T09:00:00Z',keyPhrases:phrases,exercises});
const receive=(p,final)=>db.query('select public.receive_conversation_practice($1::jsonb,$2)',[JSON.stringify(p),final]);
const job=async n=>(await db.query('select * from public.conversation_practice_jobs where pack_id=$1',[id(100+n)])).rows[0];
const stored=async n=>(await db.query('select payload from public.conversation_packs where id=$1',[id(100+n)])).rows[0]?.payload;
const claim=async n=>{
  await db.query("update public.conversation_practice_jobs set available_at=now()-interval '1 second' where pack_id=$1",[id(100+n)]);
  await db.query("update public.conversation_practice_jobs set available_at=now()+interval '1 hour' where pack_id<>$1",[id(100+n)]);
  const row=(await db.query('select * from public.claim_conversation_practice()')).rows[0];
  assert.equal(row?.pack_id,id(100+n));return row;
};
const finish=(j,ex)=>db.query('select public.finish_conversation_practice($1,$2,$3::jsonb) ok',[j.pack_id,j.lease_token,ex===null?null:JSON.stringify(ex)]).then(r=>r.rows[0].ok);
let groups=0;const pass=m=>{groups++;console.log(`PASS ${m}`);};
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role auth_deleter;create schema auth;
    create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id)on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role,auth_deleter;grant select,delete on auth.users to auth_deleter;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  const files=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')).sort();
  assert.ok(files.includes(migration));
  for(const file of files)await db.exec(await readFile(new URL(`supabase/migrations/${file}`,root),'utf8'));
  await db.exec(await readFile(new URL(`supabase/migrations/${migration}`,root),'utf8')); // idempotent re-apply
  await db.query('insert into auth.users values($1),($2)',[owner,fenced]);
  pass(`all ${files.length} migrations replay; practice completion signal re-applies`);

  // a) final pack with only built-in translations stays pending, so the worker retries it.
  const onlyBuiltins=builtins(id(101));assert.equal(onlyBuiltins.length,4);assert.ok(onlyBuiltins.every(e=>e.kind==='translate'));
  await receive(pack(1,onlyBuiltins),true);
  assert.equal((await job(1)).status,'pending');
  assert.deepEqual((await stored(1)).exercises,onlyBuiltins);
  pass('final pack with only built-in translate exercises leaves its job pending');

  // b) final pack carrying a generated drill completes.
  await receive(pack(2,[generated(1),...builtins(id(102))]),true);
  assert.equal((await job(2)).status,'complete');
  pass('final pack with a generated exercise completes its job');

  // c) finish keeps the stored built-ins alongside the generated drills, generated first, by id, capped at 24.
  let j=await claim(1);
  assert.equal(await finish(j,[generated(1),generated(2),generated(1)]),true);
  let ex=(await stored(1)).exercises;
  assert.deepEqual(ex.map(e=>e.id),[generated(1).id,generated(2).id,...onlyBuiltins.map(e=>e.id)]);
  assert.equal((await job(1)).status,'complete');
  // A late final receipt with no generated drills keeps them, with its own built-ins.
  await receive(pack(1,onlyBuiltins),true);
  assert.deepEqual((await stored(1)).exercises.map(e=>e.id),ex.map(e=>e.id));
  assert.equal((await job(1)).status,'complete');
  // Full 24 generated: generated are never crowded out; built-ins fill only spare room.
  await receive(pack(3,builtins(id(103))),true);j=await claim(3);
  const many=Array.from({length:22},(_,n)=>generated(n));
  assert.equal(await finish(j,many),true);ex=(await stored(3)).exercises;
  assert.equal(ex.length,24);assert.deepEqual(ex.slice(0,22).map(e=>e.id),many.map(e=>e.id));
  assert.ok(ex.slice(22).every(e=>e.kind==='translate'));
  await receive(pack(4,builtins(id(104))),true);j=await claim(4);
  await assert.rejects(finish(j,Array.from({length:25},(_,n)=>generated(n))),/invalid exercises/);
  assert.equal(await finish(j,Array.from({length:24},(_,n)=>generated(n))),true);
  assert.ok((await stored(4)).exercises.every(e=>e.kind!=='translate'));
  // A failed generation still backs off and stays retryable.
  await receive(pack(5,builtins(id(105))),true);j=await claim(5);
  assert.equal(await finish(j,null),true);assert.equal((await job(5)).status,'pending');
  assert.deepEqual((await stored(5)).exercises,builtins(id(105)));
  pass('finish stores generated drills plus stored built-ins (deduplicated, generated first, <=24); >24 still refused; failure retries');

  // d) tombstone blocks writes after delete; owner fence still raises.
  j=await claim(5);
  await db.query('delete from public.conversation_packs where id=$1',[id(105)]);
  assert.equal(await finish(j,[generated(9)]),false);
  await receive(pack(5,[generated(9)]),true);
  assert.equal(await stored(5),undefined);assert.equal(await job(5),undefined);
  await db.query('insert into luvani_private.tutor_account_fences(user_id) values($1)',[fenced]);
  await assert.rejects(receive(pack(6,[generated(1)],fenced),true),/inactive practice owner/);
  assert.equal(await stored(6),undefined);
  for(const role of ['anon','authenticated','service_role']){
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select luvani_private.practice_exercises_v1('[]','[]')"),/permission denied/);
    if(role!=='service_role')await assert.rejects(receive(pack(7,[generated(1)]),true),/permission denied/);
    await db.exec('reset role');
  }
  pass('tombstone blocks late finish and receipt; owner fence raises; helper and RPCs stay closed to clients');

  // e) rollback restores the previous behaviour, twice; re-apply restores the fix.
  const down=await readFile(new URL('supabase/rollback/20261026090000_down.sql',root),'utf8');
  await db.exec(down);await db.exec(down);
  await receive(pack(8,builtins(id(108))),true);
  assert.equal((await job(8)).status,'complete');
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname='practice_exercises_v1'")).rows[0].n,0);
  await db.exec(await readFile(new URL(`supabase/migrations/${migration}`,root),'utf8'));
  await receive(pack(9,builtins(id(109))),true);
  assert.equal((await job(9)).status,'pending');
  pass('rollback (run twice) restores the 20261004003511 completion rule; re-apply restores the fix');
  console.log(`PASS: all ${files.length} migrations replayed; ${groups} practice completion proof groups`);
} finally { await db.close(); }
