/** Disposable PostgreSQL/WASM proof; no hosted users, providers or row-cap assumptions. */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildConversationPack,isConversationPack} from '@luvani/core';
const root=new URL('../',import.meta.url),db=new PGlite();
const id=n=>`b1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration='20261004015000_indexed_conversation_library.sql';
const call=async(owner,stamp=null,after=null,pack=null)=>(await db.query('select public.conversation_pack_page_v1($1,$2,$3,$4) value',[owner,stamp,after,pack])).rows[0].value;
let groups=0;const pass=m=>{groups++;console.log(`PASS ${m}`)};
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id)on delete cascade,not_after timestamptz);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
 const files=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files){
  if(file===migration){
   await db.query('insert into auth.users values($1)',[id(3)]);
   for(const[n,size]of[[5000,600000],[5001,1100000]])await db.query("insert into public.conversation_packs(id,session_id,user_id,state,payload,created_at)values($1,$1,$2,'ready',jsonb_build_object('legacy',repeat('x',$3::integer)),$4::timestamptz)",[id(n),id(3),size,`2026-10-04T00:00:0${n-5000}Z`]);
  }
  await db.exec(await readFile(new URL(`supabase/migrations/${file}`,root),'utf8'));
 }
 const down=await readFile(new URL('supabase/rollback/20261004015000_down.sql',root),'utf8');
 await assert.rejects(db.exec(down),/draining/);await db.exec('rollback');
 assert.ok((await db.query("select indexdef from pg_indexes where indexname='conversation_packs_user_created_id_idx'")).rows[0].indexdef.includes('(user_id, created_at DESC, id DESC)'));
 pass(`all ${files.length} migrations replayed; composite keyset index and default-refusal atomic rollback verified`);
 for(let n=1;n<=4;n++)await db.query('insert into auth.users values($1)on conflict do nothing',[id(n)]);
 // Same-millisecond microseconds plus many exact timestamp ties exercise both
 // key components. Add a larger foreign history which must never affect EOF.
 await db.query(`insert into public.conversation_packs(id,session_id,user_id,state,payload,created_at)
   select ('b2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('b2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1::uuid,'ready',jsonb_build_object('synthetic',n),
    '2026-10-04T00:00:00Z'::timestamptz+(n/4)*interval '1 microsecond' from generate_series(1,1203)n`,[id(1)]);
 await db.query(`insert into public.conversation_packs(id,session_id,user_id,state,payload,created_at)
   select ('b3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('b3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1::uuid,'ready','{"foreign":true}',clock_timestamp() from generate_series(1,1500)n`,[id(2)]);
 const expected=(await db.query('select id from public.conversation_packs where user_id=$1 order by created_at desc,id desc',[id(1)])).rows.map(r=>r.id);
 let cursor=null,seen=[],pages=0;
 while(true){
  const page=await call(id(1),cursor?.createdAt??null,cursor?.packId??null);pages++;
  assert.equal(page.kind,'page');assert.equal(page.version,1);assert.ok(page.rows.length<=20);
  for(const row of page.rows){assert.equal(row.payload.foreign,undefined);assert.match(row.createdAt,/\.\d{6}Z$/);seen.push(row.id);}
  if(!page.nextCursor)break;
  assert.ok(page.rows.length>0);assert.deepEqual(page.nextCursor,{createdAt:page.rows.at(-1).createdAt,packId:page.rows.at(-1).id});
  cursor=page.nextCursor;assert.ok(pages<100);
 }
 assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,1203);assert.equal(pages,61);
 pass('1203 owned rows complete across61 bounded pages beyond REST ceilings; microseconds and exact timestamp/UUID ties preserved; foreign1500 rows never leak or alter EOF');
 const first=await call(id(1));const last=first.rows.at(-1);await db.query('delete from public.conversation_packs where id=$1',[last.id]);
 const afterDelete=await call(id(1),first.nextCursor.createdAt,first.nextCursor.packId);
 assert.equal(afterDelete.rows[0].id,expected[20]);
 const oldId=expected.at(-1);assert.equal((await call(id(1),null,null,oldId)).rows[0].id,oldId);
 assert.equal((await call(id(2),null,null,oldId)).rows.length,0);
 assert.equal((await call(id(999))).kind,'inactive');
 await db.query('insert into luvani_private.tutor_account_fences(user_id)values($1)',[id(1)]);
 assert.equal((await call(id(1))).kind,'inactive');assert.equal((await call(id(1),null,null,oldId)).kind,'inactive');
 await db.query('delete from luvani_private.tutor_account_fences where user_id=$1',[id(1)]);
 await assert.rejects(call(id(1),'2026-10-04T00:00:00Z',null),/invalid conversation/);
 await assert.rejects(call(id(1),'2026-10-04T00:00:00Z',oldId,oldId),/invalid conversation/);
 pass('deleted cursor row still paginates correctly; old ID remains addressable; foreign/unknown/fenced identities refuse; half cursors/combined ID+cursor reject');
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(call(id(1)));await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await call(id(4))).rows.length,0);await db.exec('reset role');
 await db.exec('set enable_seqscan=off');
 const plan=(await db.query('explain (format json) select id,created_at,payload from public.conversation_packs where user_id=$1 and(created_at,id)<($2::timestamptz,$3::uuid)order by created_at desc,id desc limit 21',[id(1),first.nextCursor.createdAt,first.nextCursor.packId])).rows[0]['QUERY PLAN'];
 assert.ok(JSON.stringify(plan).includes('conversation_packs_user_created_id_idx'));await db.exec('reset enable_seqscan');
 pass('app roles denied, service RPC accepted; explicit planner proof can use composite index for keyset bound (not a hosted performance/independent-lock claim)');
 const legacyPage=await call(id(3));assert.equal(legacyPage.rows.length,2);assert.equal(legacyPage.nextCursor,null);
 for(const row of legacyPage.rows){assert.equal(row.payload,null);assert.equal(row.unavailable,'oversize');assert.ok(row.payloadBytes>524288);}
 assert.ok(JSON.stringify(legacyPage).length<1024);assert.equal((await call(id(3),null,null,id(5000))).rows[0].payload.legacy.length,600000);
 assert.equal((await call(id(3),null,null,id(5001))).rows[0].unavailable,'oversize');
 assert.equal((await db.query("select convalidated from pg_constraint where conname='conversation_packs_bounded_payload'")).rows[0].convalidated,false);
 await assert.rejects(db.query("insert into public.conversation_packs(id,session_id,user_id,state,payload)values($1,$1,$2,'ready',jsonb_build_object('huge',repeat('x',600000)))",[id(5002),id(3)]),/conversation_packs_bounded_payload/);
 await assert.rejects(db.query("update public.conversation_packs set state='archived' where id=$1",[id(5000)]),/conversation_packs_bounded_payload/);
 // Large but newly accepted full rows yield variable nonempty pages. Every
 // row is eventually reached and every complete response is under1MiB.
 for(let n=1;n<=7;n++)await db.query("insert into public.conversation_packs(id,session_id,user_id,state,payload,created_at)values($1,$1,$2,'ready',jsonb_build_object('weighted',repeat('x',300000)),$3::timestamptz)",[id(5100+n),id(3),`2026-10-05T00:00:0${n}Z`]);
 let weighted=null,weightedIds=[],weightedPages=0;
 do{const current=await call(id(3),weighted?.createdAt??null,weighted?.packId??null);weightedPages++;assert.ok(current.rows.length>0 && current.rows.length<=20);assert.ok(Buffer.byteLength(JSON.stringify(current))<=1048576);weightedIds.push(...current.rows.map(row=>row.id));weighted=current.nextCursor;if(weighted)assert.deepEqual(weighted,{createdAt:current.rows.at(-1).createdAt,packId:current.rows.at(-1).id});}while(weighted);
 assert.equal(weightedIds.length,9);assert.equal(new Set(weightedIds).size,9);assert.ok(weightedPages>1 && weightedPages<10);
 pass('future INSERT/UPDATE capped512KiB without scanning/deleting legacy; weighted nonempty pages preserve every entry and exact last-row cursor under1MiB;600KiB ID accessible,1.1MiB historical entry explicit oversize without blocking traversal');
 // The exact failing lifecycle acceptance now remains readable at55KiB.
 const auth=id(6001),session=id(6000),nonce=id(6002),hash='0123456789abcdef'.repeat(4);
 const rpc=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})value`,args)).rows[0].value;
 await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[auth,id(4)]);await db.query("insert into entitlements(user_id,plan)values($1,'trial')",[id(4)]);
 await db.exec('update tutor_session_admission_config set enabled=true,max_active_sessions=10,max_daily_issued_seconds=100000,max_account_daily_sessions=10,max_account_daily_seconds=9000');
 assert.equal((await rpc('reserve_tutor_session_v1',[id(4),session,'accepted-row-proof','convo-text',hash,auth])).kind,'reserved');
 assert.equal((await rpc('claim_tutor_session_v1',[id(4),session,'accepted-row-proof','convo-text',nonce])).kind,'claimed');
 const accepted=buildConversationPack({id:session,sessionId:session,learnerId:id(4),createdAt:'2026-10-06T00:00:00Z',title:{fr:'Au café',en:'At the cafe'},summary:'Une conversation. '.repeat(3000),keyPhrases:[{fr:'Un café',frWritten:null,en:'A coffee'}]});assert.ok(isConversationPack(accepted));
 assert.ok(Buffer.byteLength(JSON.stringify(accepted))>49152 && Buffer.byteLength(JSON.stringify(accepted))<131072);
 assert.equal((await rpc('complete_tutor_session_v1',[id(4),session,nonce,1,hash,0,0,null,accepted])).kind,'completed');
 assert.deepEqual((await call(id(4))).rows[0].payload,accepted);assert.deepEqual((await call(id(4),null,null,session)).rows[0].payload,accepted);
 await db.exec("update public.conversation_practice_jobs set status='complete'");
 const practice=buildConversationPack({...accepted,id:id(7000),sessionId:id(7000),summary:'A coffee.',keyPhrases:[],exercises:[]});await rpc('receive_conversation_practice',[practice,false]);
 await db.query("update public.conversation_practice_jobs set available_at=clock_timestamp()-interval '1 second' where pack_id=$1",[id(7000)]);
 const work=(await db.query('select * from public.claim_conversation_practice()')).rows[0];assert.equal(work.pack_id,id(7000));
 const before=(await db.query('select payload from conversation_packs where id=$1',[id(7000)])).rows[0].payload;
 await assert.rejects(rpc('finish_conversation_practice',[id(7000),work.lease_token,[{kind:'translate',fr:'x'.repeat(600000)}]]),/conversation_packs_bounded_payload/);
 assert.deepEqual((await db.query('select payload from conversation_packs where id=$1',[id(7000)])).rows[0].payload,before);
 assert.equal((await db.query('select status from conversation_practice_jobs where pack_id=$1',[id(7000)])).rows[0].status,'running');
 pass('actual core-valid55KiB reserve/claim/complete remains wholly readable in page and ID; practice expansion cannot exceed future cumulative row limit or partially settle its leased job');
 const rowsBefore=(await db.query('select count(*)::integer n from public.conversation_packs')).rows[0].n;
 await db.exec("set luvani.rollback_conversation_library='on'");await db.exec(down);
 assert.equal((await db.query('select count(*)::integer n from public.conversation_packs')).rows[0].n,rowsBefore);
 await db.exec(await readFile(new URL(`supabase/migrations/${migration}`,root),'utf8'));
 assert.equal((await call(id(1),null,null,oldId)).rows[0].id,oldId);
 assert.equal((await call(id(3),null,null,id(5001))).rows[0].unavailable,'oversize');
 pass('drained rollback/reapply preserves every full/exceptional row and constraints return without a legacy scan');
 console.log(JSON.stringify({result:'PASS',groups,migrations:files.length,ownedHistory:1203,pages:61}));
}finally{await db.close();}
