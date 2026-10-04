/** Disposable full migration replay and real >10k-row / >32MiB export proof. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const db = new PGlite();
const id = n => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = bytes => createHash('sha256').update(bytes).digest();
const call = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_,i) => `$${i+1}`).join(',')}) value`, args)).rows[0].value;
let proofGroups = 0;
const pass = message => { proofGroups++; console.log(`PASS ${message}`); };
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,created_at timestamptz,last_sign_in_at timestamptz,raw_app_meta_data jsonb);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
  const files = (await readdir(new URL('supabase/migrations/', root))).filter(n => n.endsWith('.sql')).sort();
  for (const file of files) await db.exec(await readFile(new URL(`supabase/migrations/${file}`, root), 'utf8'));
  const exportMigration = files.find(file => file.endsWith('_bounded_account_exports.sql'));
  assert.ok(exportMigration);
  const down = await readFile(new URL(`supabase/rollback/${exportMigration.split('_')[0]}_down.sql`, root), 'utf8');
  await assert.rejects(db.exec(down)); await db.exec('rollback');
  await db.exec("set luvani.rollback_account_exports='on'");
  await db.exec(down);
  await db.exec(await readFile(new URL(`supabase/migrations/${exportMigration}`, root), 'utf8'));
  pass(`all ${files.length} migrations replay; default rollback refused, explicitly interlocked never-issued rollback and reapply succeed`);

  for (let n=1; n<=4; n++) {
    await db.query('insert into auth.users(id,email,created_at,last_sign_in_at,raw_app_meta_data) values($1,$2,clock_timestamp(),clock_timestamp(),$3)', [id(n),`synthetic.${n}@example.invalid`,{ controlSecret: 'NEVER_EXPORT_AUTH_METADATA' }]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [id(n+10),id(n)]);
  }
  assert.equal((await call('prepare_account_export_v2', [id(1),id(11),id(101)])).reason, 'export-disabled');
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_exports')).rows[0].n, 0);
  await db.query(`insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch)
    select ('a0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,1,1,$2 from generate_series(1,12001)n`, [id(1),id(80)]);
  // Legitimate text shape: 300 lines, <=2000 chars each, about180KiB per text.
  await db.query(`insert into public.saved_conversation_text(session_id,user_id,payload)
    select ('b0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,$1,
      jsonb_build_object('sessionId','b0000000-0000-4000-8000-'||lpad(n::text,12,'0'),'title','Synthetic archive',
        'lines',(select jsonb_agg(jsonb_build_object('id',line::text,'who','learner','fr',repeat('é',180),'frWritten',null,'en',repeat('e',80))) from generate_series(1,300)line))
      from generate_series(1,200)n`, [id(1)]);
  await db.query('insert into public.session_grants(session_id,user_id,usage_epoch,auth_session_id,claim_nonce,checkpoint_digest,checkpoint_baseline) values($1,$2,$3,$4,$5,$6,$7)', [id(81),id(1),id(80),id(11),id(83),'f'.repeat(64),{ private: 'NEVER_EXPORT_CHECKPOINT_BASELINE' }]);
  await db.query('insert into public.session_usage(session_id,user_id,seconds) values($1,$2,2)', [id(85),id(2)]);
  await assert.rejects(call('export_account_data', [id(1)]), /preparation limit/);
  await call('configure_account_export_v2', [true,134217728,100,536870912]);
  const job = await call('prepare_account_export_v2', [id(1),id(11),id(101)]);
  assert.equal(job.kind,'ready'); assert.ok(job.totalBytes>32*1024*1024); assert.ok(job.totalBytes<128*1024*1024);
  assert.equal(job.totalParts,Math.ceil(job.totalBytes/65536));
  assert.equal(Date.parse(job.expiresAt)-Date.parse(job.snapshotAt),15*60*1000);
  assert.deepEqual(await call('prepare_account_export_v2', [id(1),id(11),id(101)]),job);
  assert.equal((await call('prepare_account_export_v2',[id(1),id(11),id(102)])).reason,'export-active');
  assert.equal((await call('prepare_account_export_v2',[id(2),id(12),id(101)])).reason,'export-unavailable');
  pass(`legacy export explicitly refuses oversized account; v2 stages ${job.totalBytes}bytes/${job.totalParts}parts including12001usage rows, defaultsOFF and idempotent owner-bound preparation`);

  // Live changes after preparation must not appear in ANY later export part.
  await db.query('update public.session_usage set seconds=2 where user_id=$1',[id(1)]);
  await db.query('update auth.users set email=$1 where id=$2',['new.after.snapshot@example.invalid',id(1)]);
  await db.query('insert into public.session_usage(session_id,user_id,seconds) values($1,$2,3)',[id(84),id(1)]);
  assert.equal((await call('account_export_part_v2',[id(2),id(12),id(101),0])).kind,'unavailable');
  assert.equal((await call('account_export_part_v2',[id(1),id(12),id(101),0])).kind,'unavailable');
  const decoder = new TextDecoder('utf-8',{fatal:true});
  let chain=sha(Buffer.alloc(0)),bytes=0,carry='',usageRows=0,textRows=0,manifests=0,grantRows=0;
  const inspect = line => {
    assert.ok(!line.includes('NEVER_EXPORT_AUTH_METADATA')); assert.ok(!line.includes('NEVER_EXPORT_CHECKPOINT_BASELINE'));
    const record=JSON.parse(line);
    if (record.kind==='manifest') {
      manifests++; assert.equal(record.account.id,id(1)); assert.equal(record.account.email,'synthetic.1@example.invalid');assert.equal(record.datasets.length,16);
      assert.deepEqual(Object.keys(record.account).sort(),['createdAt','email','id','lastSignInAt']);
    } else if (record.dataset==='session_usage') { usageRows++;assert.equal(record.row.user_id,id(1)); assert.equal(record.row.seconds,1);assert.equal(record.row.charged_seconds,1); }
    else if (record.dataset==='saved_conversation_text') {textRows++;assert.equal(record.row.payload.lines.length,300);assert.equal(record.row.payload.lines[0].fr,'é'.repeat(180));}
    else if (record.dataset==='session_grants') {
      grantRows++; assert.equal(record.row.session_id,id(81));
      for(const key of ['auth_session_id','claim_nonce','request_digest','checkpoint_digest','checkpoint_content_hash','checkpoint_baseline','checkpoint_seconds','checkpoint_learner_turns','completion_digest','completion_content_hash'])assert.ok(!(key in record.row));
    }
  };
  for(let part=0;part<job.totalParts;part++) {
    const row=await call('account_export_part_v2',[id(1),id(11),id(101),part]);
    assert.equal(row.kind,'part');assert.equal(row.version,2);assert.equal(row.part,part);assert.equal(row.exportId,id(101));assert.equal(row.totalParts,job.totalParts);
    assert.equal(row.nextPart,part+1<job.totalParts?part+1:null);
    const chunk=Buffer.from(row.dataBase64,'base64');assert.equal(chunk.toString('base64'),row.dataBase64);assert.equal(chunk.length,row.bytes);assert.ok(chunk.length<=65536);
    const hash=sha(chunk);assert.equal(hash.toString('hex'),row.sha256);chain=sha(Buffer.concat([chain,hash]));bytes+=chunk.length;
    carry+=decoder.decode(chunk,{stream:true});let at;
    while((at=carry.indexOf('\n'))>=0){inspect(carry.slice(0,at));carry=carry.slice(at+1);}
    assert.ok(Buffer.byteLength(carry)<262144,'the incremental verifier retains only one bounded row');
  }
  carry+=decoder.decode();assert.equal(carry,'');assert.equal(bytes,job.totalBytes);assert.equal(chain.toString('hex'),job.rootSha256);
  assert.equal(manifests,1);assert.equal(usageRows,12001);assert.equal(textRows,200);assert.equal(grantRows,1);
  pass('every byte/part/SHA256 chain verified incrementally; UTF8 splits survive; all12001usage and200large-text records complete; live mutations/new rows/email absent; sensitive Auth/control fields excluded');

  await call('purge_account_export_v2',[id(2),id(101)]);
  assert.equal((await call('account_export_part_v2',[id(1),id(11),id(101),0])).kind,'part');
  await call('configure_account_export_v2',[true,65536,1,65536]);
  assert.equal((await call('prepare_account_export_v2',[id(2),id(12),id(102)])).reason,'export-capacity');
  await db.query("update luvani_private.account_exports set expires_at=clock_timestamp()-interval '1 second' where export_id=$1",[id(101)]);
  assert.equal((await call('account_export_part_v2',[id(1),id(11),id(101),0])).kind,'unavailable');
  assert.equal((await call('prepare_account_export_v2',[id(2),id(12),id(102)])).reason,'export-capacity','expired bytes consume capacity until actual purge');
  assert.equal((await call('cleanup_account_exports_v2',[1])).jobsDeleted,1);
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_export_parts')).rows[0].n,0);
  assert.equal((await call('prepare_account_export_v2',[id(1),id(11),id(103)])).reason,'export-too-large');
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_exports where user_id=$1',[id(1)])).rows[0].n,0);
  assert.equal((await call('prepare_account_export_v2',[id(2),id(12),id(102)])).kind,'ready');
  pass('foreign purge cannot delete; real TTL refuses delivery; physically retained expired data counts toward global ceilings; bounded cleanup frees all parts; oversized source publishes zero jobs/parts');

  await call('configure_account_export_v2',[true,134217728,100,536870912]);
  await db.exec("create function luvani_private.export_test_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic write failure';end$$;create trigger export_test_failure before insert on luvani_private.account_export_parts for each row execute function luvani_private.export_test_failure();");
  await assert.rejects(call('prepare_account_export_v2',[id(3),id(13),id(104)]),/synthetic write failure/);
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_exports where export_id=$1',[id(104)])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_export_parts where export_id=$1',[id(104)])).rows[0].n,0);
  await db.exec('drop trigger export_test_failure on luvani_private.account_export_parts;drop function luvani_private.export_test_failure();');
  await call('prepare_account_export_v2',[id(3),id(13),id(104)]);
  await call('begin_account_erasure_v1',[id(3),false]);
  assert.equal((await call('account_export_part_v2',[id(3),id(13),id(104),0])).kind,'unavailable');
  assert.equal((await call('prepare_account_export_v2',[id(3),id(13),id(105)])).reason,'inactive-identity');
  await db.query('delete from auth.users where id=$1',[id(3)]);
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_exports where user_id=$1',[id(3)])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::integer n from luvani_private.account_export_parts where export_id=$1',[id(104)])).rows[0].n,0);
  pass('injected fragment failure rolls back entire job atomically; deletion fence blocks preparation/delivery and Auth cascade removes artifact plus parts');

  for(const role of ['anon','authenticated','service_role']) {
    await db.exec(`set role ${role}`);
    for(const table of ['account_export_config','account_exports','account_export_parts'])await assert.rejects(db.query(`select * from luvani_private.${table}`));
    if(role!=='service_role')for(const [name,args]of[['configure_account_export_v2',[true]],['prepare_account_export_v2',[id(4),id(14),id(105)]],['account_export_part_v2',[id(2),id(12),id(102),0]],['purge_account_export_v2',[id(2),id(102)]],['cleanup_account_exports_v2',[1]]])await assert.rejects(call(name,args));
    else assert.equal((await call('account_export_part_v2',[id(2),id(12),id(102),0])).kind,'part');
    await db.exec('reset role');
  }
  await call('purge_account_export_v2',[id(2),id(102)]);
  await assert.rejects(db.exec(down),/artifacts have been issued/);await db.exec('rollback');
  assert.equal((await db.query('select ever_issued from luvani_private.account_export_config')).rows[0].ever_issued,true);
  pass('five RPCs deny app roles; all three private tables deny even service direct access; issued-ever rollback refuses after purge, retaining provenance');
  console.log(JSON.stringify({status:'pass',migrationCount:files.length,proofGroups,largeArchiveBytes:job.totalBytes,largeArchiveParts:job.totalParts,usageRows,textRows,hostedConcurrencyVerified:false}));
} catch(error) {
  console.error('FAIL disposable account export proof:',error instanceof Error?error.message:'sanitized failure');process.exitCode=1;
} finally {await db.close();}
