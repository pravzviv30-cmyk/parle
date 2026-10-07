import test from 'node:test';
import assert from 'node:assert/strict';
import { requestIdentity,validateRequest,captureSql,validateCapture,catalogDifferences } from './verifyCurrentHostedSchema.mjs';
import { canonical,sha256,CATALOG_SQL,MANAGED_DEFAULT_PRIVILEGES_SQL } from './releaseSchemaManifest.mjs';
const now=Date.parse('2026-10-04T12:00:00Z');
function fixtures(){
 const catalog={roles:[],schemas:[],tables:[{schema:'public',name:'example_fixture',rls:true,privileges:{anon:{select:false}}}],policies:[],routines:[],sequences:[],defaultPrivileges:[]};
 const migrations=[{name:'202610040001_fixture.sql',version:'202610040001',sha256:sha256('fixture SQL')}];
 const request={version:1,createdAt:new Date(now-1000).toISOString(),target:{projectUrl:'https://fixture-project.supabase.co'},
  source:{gitSha:sha256('git').slice(0,40),dirty:true,catalogQuerySha256:sha256(CATALOG_SQL),migrationInventorySha256:sha256(canonical(migrations))},
  schema:{version:1,migrationCount:1,migrations,catalog,catalogSha256:sha256(canonical(catalog))}};
 request.requestSha256=requestIdentity(request);
 const capture={version:1,requestSha256:request.requestSha256,catalogQuerySha256:request.source.catalogQuerySha256,executedAt:new Date(now-500).toISOString(),postgresVersion:'17.5',databaseName:'offline_fixture',readOnly:true,migrationVersions:['202610040001'],catalog:structuredClone(catalog)};
 return {request,capture};
}
test('full capture protocol can match offline fixtures and reports provenance/runtime unverified',()=>{
 const {request,capture}=fixtures(),report=validateCapture(request,capture,{now});assert.equal(report.status,'matched-captured-catalog');
 assert.equal(report.capturedProvenanceVerified,false);assert.equal(report.hostedRuntimeVerified,false);assert.equal(report.concurrentVerified,false);assert.equal(report.dirtySource,true);
});
test('SQL starts READ ONLY and binds exact query/source request and migration history',()=>{
 const {request}=fixtures(),sql=captureSql(request);assert.match(sql,/begin read only;/);assert.match(sql,/transaction_read_only/);
 assert.ok(sql.includes(request.requestSha256));assert.match(sql,/supabase_migrations.schema_migrations/);assert.ok(sql.includes(CATALOG_SQL.trim().replace(/;$/,'')));
 assert.doesNotMatch(sql,/https:\/\/|SUPABASE_SERVICE_ROLE_KEY/);
});
test('request tampering, partial catalog, query substitution and missing inventory are rejected',()=>{
 for(const change of [r=>r.source.gitSha='pending',r=>r.schema.migrations=[],r=>r.schema.catalogSha256=sha256('fake'),r=>r.source.catalogQuerySha256=sha256('different'),r=>delete r.schema.catalog.defaultPrivileges,r=>r.target.projectUrl='https://name:fake-password@fixture.test',r=>r.target.projectUrl='https://fixture.test/private']){
  const {request}=fixtures();change(request);request.requestSha256=requestIdentity(request);assert.throws(()=>validateRequest(request));
 }
 const {request}=fixtures();request.schema.catalog.tables[0].rls=false;assert.throws(()=>validateRequest(request),/identity/);
});
test('narrow REST output, stale/future/nonreadonly capture and source mismatch fail closed',()=>{
 for(const change of [c=>c.requestSha256=sha256('wrong'),c=>c.readOnly=false,c=>delete c.databaseName,c=>c.executedAt=new Date(now-3600001).toISOString(),c=>c.executedAt=new Date(now+6000).toISOString(),c=>c.migrationVersions.push('202601010001'),c=>c.catalog={tables:[],policies:[],routines:[]}]){
  const {request,capture}=fixtures();change(capture);assert.throws(()=>validateCapture(request,capture,{now}));
 }
});
test('RLS/default privileges/managed owner/function and formatting drift cannot be silently omitted',()=>{
 for(const change of [c=>c.catalog.tables[0].rls=false,c=>c.catalog.tables[0].privileges.anon.select=true,c=>c.catalog.defaultPrivileges.push({owner:'managed_owner',acl:[]}),c=>c.catalog.routines.push({name:'changed',definitionMd5:'rendered_other_version'})]){
  const {request,capture}=fixtures();change(capture);assert.throws(()=>validateCapture(request,capture,{now}),/drift unresolved/);
 }
 const {request,capture}=fixtures();capture.catalog.tables[0].rls=false;assert.ok(catalogDifferences(request.schema.catalog,capture.catalog).includes('catalog.tables[0].rls'));
});

test('prepared full SQL actually executes READ ONLY and captures every replayed object/history',async()=>{
 const { PGlite }=await import('@electric-sql/pglite');
 const { readFile }=await import('node:fs/promises');
 const { ROOT,buildSchemaManifest }=await import('./releaseSchemaManifest.mjs');
 const schema=await buildSchemaManifest();
 const request={version:1,createdAt:new Date().toISOString(),target:{projectUrl:'https://fixture-project.supabase.co'},
  source:{gitSha:sha256('offline git').slice(0,40),dirty:true,catalogQuerySha256:sha256(CATALOG_SQL),migrationInventorySha256:sha256(canonical(schema.migrations))},schema};
 request.requestSha256=requestIdentity(request);
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,banned_until timestamptz,deleted_at timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated,service_role;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
   create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);`);
  await db.exec(MANAGED_DEFAULT_PRIVILEGES_SQL);
  for(const migration of schema.migrations){await db.exec(await readFile(`${ROOT}/supabase/migrations/${migration.name}`,'utf8'));await db.query('insert into supabase_migrations.schema_migrations(version) values($1)',[migration.version]);}
  const outputs=await db.exec(captureSql(request));
  const capture=outputs.find(result=>result.rows?.[0]?.capture)?.rows[0].capture;
  assert.ok(capture);assert.equal(capture.readOnly,true);
  const report=validateCapture(request,capture);assert.equal(report.migrationCount,schema.migrationCount);
  assert.equal(report.catalogSha256,schema.catalogSha256);assert.equal(report.hostedRuntimeVerified,false);
 } finally {await db.close();}
});
