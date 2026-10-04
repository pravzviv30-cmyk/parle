/** Full hosted-catalog evidence workflow. Never opens a network/SQL connection.
 * Prepare read-only SQL; an operator executes it against the explicit target;
 * verify the captured JSON against current migration bytes and disposable catalog.
 * Matching capture is evidence comparison, not proof of capture provenance,
 * hosted Auth configuration, runtime behavior or independent SQL concurrency.
 */
import { readFile,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT,CATALOG_SQL,buildSchemaManifest,canonical,sha256 } from './releaseSchemaManifest.mjs';
const MAX_BYTES=16*1024*1024;
const HASH=/^[0-9a-f]{64}$/,SHA=/^[0-9a-f]{40}$/;
const CATEGORIES=['roles','schemas','tables','policies','routines','sequences','defaultPrivileges'];
const withoutId=request=>{const {requestSha256,...rest}=request;return rest;};
export function requestIdentity(request){return sha256(canonical(withoutId(request)));}
export function validateRequest(request) {
 if(request?.version!==1 || !HASH.test(request.requestSha256??'') || requestIdentity(request)!==request.requestSha256)throw new Error('invalid prepared request identity');
 if(!SHA.test(request.source?.gitSha??'') || typeof request.source.dirty!=='boolean' || request.source.catalogQuerySha256!==sha256(CATALOG_SQL))throw new Error('invalid source/query binding');
 let target;try{target=new URL(request.target?.projectUrl);}catch{throw new Error('explicit target URL required');}
 if(target.protocol!=='https:' || target.username || target.password || target.search || target.hash || target.pathname!=='/' || /^(localhost|127\.|0\.0\.0\.0)/.test(target.hostname))throw new Error('explicit secure project origin required');
 const schema=request.schema;
 if(schema?.version!==1 || !Number.isSafeInteger(schema.migrationCount) || schema.migrationCount<1 || !Array.isArray(schema.migrations) || schema.migrations.length!==schema.migrationCount || new Set(schema.migrations.map(m=>m.version)).size!==schema.migrationCount)throw new Error('complete migration inventory required');
 for(const m of schema.migrations)if(!/^\d{12,14}$/.test(m.version) || !m.name?.startsWith(`${m.version}_`) || !m.name.endsWith('.sql') || !HASH.test(m.sha256))throw new Error('invalid migration identity');
 if(schema.catalogSha256!==sha256(canonical(schema.catalog)) || request.source.migrationInventorySha256!==sha256(canonical(schema.migrations)) || CATEGORIES.some(c=>!Array.isArray(schema.catalog?.[c])))throw new Error('invalid complete catalog binding');
 return request;
}
export function captureSql(request) {
 validateRequest(request);
 // Every interpolation below is a validated fixed-format SHA256, never a URL,
 // credential or arbitrary operator string. READ ONLY is set before the query.
 const query=CATALOG_SQL.trim().replace(/;$/,'');
 return `-- Prepared capture request SHA256:${request.requestSha256}\n-- Run ONLY on the target origin named in the separate request JSON.\n-- -X -q -t -A -v ON_ERROR_STOP=1 yields one JSON row without psql wrappers.\nbegin read only;\nwith app_catalog as (${query})\nselect jsonb_build_object(\n 'version',1,'requestSha256','${request.requestSha256}',\n 'catalogQuerySha256','${request.source.catalogQuerySha256}',\n 'executedAt',clock_timestamp(),'postgresVersion',current_setting('server_version'),\n 'databaseName',current_database(),'readOnly',current_setting('transaction_read_only')='on',\n 'migrationVersions',(select coalesce(jsonb_agg(version order by version),'[]') from supabase_migrations.schema_migrations),\n 'catalog',(select catalog from app_catalog)) as capture;\ncommit;\n`;
}
export function catalogDifferences(expected,actual,limit=100) {
 const differences=[];
 const walk=(a,b,path)=>{
  if(differences.length>=limit)return;
  if(canonical(a)===canonical(b))return;
  if(Array.isArray(a) && Array.isArray(b)) {
   if(a.length!==b.length)differences.push(`${path}.length`);
   for(let n=0;n<Math.max(a.length,b.length) && differences.length<limit;n++)walk(a[n],b[n],`${path}[${n}]`);
  } else if(a && b && typeof a==='object' && typeof b==='object') {
   for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],`${path}.${key}`);
  } else differences.push(path);
 };
 walk(expected,actual,'catalog');return differences;
}
export function validateCapture(request,capture,{now=Date.now(),maxAgeMs=3600000}={}) {
 validateRequest(request);
 if(capture?.version!==1 || capture.requestSha256!==request.requestSha256 || capture.catalogQuerySha256!==request.source.catalogQuerySha256)throw new Error('capture does not match prepared source/query request');
 if(capture.readOnly!==true || typeof capture.postgresVersion!=='string' || !capture.postgresVersion.trim() || typeof capture.databaseName!=='string' || !capture.databaseName.trim())throw new Error('capture lacks read-only/database/version receipt');
 const timestamp=Date.parse(capture.executedAt);
 if(!Number.isFinite(timestamp) || timestamp>now+5000 || timestamp<now-maxAgeMs)throw new Error('capture time missing, future or stale');
 const expectedVersions=request.schema.migrations.map(m=>m.version).sort();
 if(!Array.isArray(capture.migrationVersions) || canonical(capture.migrationVersions)!==canonical(expectedVersions))throw new Error('hosted migration history differs from current source inventory');
 if(CATEGORIES.some(c=>!Array.isArray(capture.catalog?.[c])))throw new Error('capture is not the full application catalog; backend_catalog_v1 REST output is insufficient');
 const actualSha256=sha256(canonical(capture.catalog));
 if(actualSha256!==request.schema.catalogSha256) {
  const differences=catalogDifferences(request.schema.catalog,capture.catalog);
  const error=new Error(`current hosted catalog drift unresolved (${differences.slice(0,20).join(', ')}). Managed-owner/default ACL or PostgreSQL rendering differences require reviewed same-version baseline; no fields are ignored.`);
  error.differences=differences;error.actualCatalogSha256=actualSha256;throw error;
 }
 return {status:'matched-captured-catalog',gitSha:request.source.gitSha,dirtySource:request.source.dirty,
  migrationCount:request.schema.migrationCount,catalogSha256:actualSha256,captureCanonicalSha256:sha256(canonical(capture)),
  target:request.target,executedAt:capture.executedAt,postgresVersion:capture.postgresVersion,
  capturedProvenanceVerified:false,hostedRuntimeVerified:false,concurrentVerified:false,
  limitation:'Offline comparison of operator-captured bytes; target/transport provenance, managed Auth/Storage/config, RLS behavior and concurrency require separate independent acceptance.'};
}
async function jsonFile(path) {
 const bytes=await readFile(resolve(path));if(bytes.length>MAX_BYTES)throw new Error('catalog evidence exceeds 16MiB bound');return {value:JSON.parse(bytes.toString('utf8')),artifactSha256:sha256(bytes)};
}
async function main(args) {
 const options={};
 for(let n=0;n<args.length;n+=2){if(!args[n]?.startsWith('--') || !args[n+1] || options[args[n]])throw new Error('invalid/duplicate arguments');options[args[n]]=args[n+1];}
 if(options['--prepare'] && options['--sql'] && options['--project-url'] && Object.keys(options).length===3) {
  const schema=await buildSchemaManifest();
  const gitSha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  const dirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:ROOT,encoding:'utf8'}).trim());
  const request={version:1,createdAt:new Date().toISOString(),target:{projectUrl:new URL(options['--project-url']).origin},
   source:{gitSha,dirty,catalogQuerySha256:sha256(CATALOG_SQL),migrationInventorySha256:sha256(canonical(schema.migrations))},schema};
  // Validate original supplied URL too; origin alone must not hide userinfo/path.
  if(new URL(options['--project-url']).href!==new URL(request.target.projectUrl).href)throw new Error('project URL must be an origin without credentials/path/query');
  request.requestSha256=requestIdentity(request);validateRequest(request);
  await writeFile(resolve(options['--prepare']),`${JSON.stringify(request,null,2)}\n`,{flag:'wx',mode:0o600});
  await writeFile(resolve(options['--sql']),captureSql(request),{flag:'wx',mode:0o600});
  console.log(`Prepared ${schema.migrationCount}-migration full catalog capture; no hosted query executed. Source dirty:${dirty}.`);
  console.log('Operator: use an independently reviewed read-only database connection with psql -X -q -t -A -v ON_ERROR_STOP=1 -f QUERY.sql > CAPTURE.json; then --request REQUEST.json --capture CAPTURE.json --output NEW_REPORT.json [--catalog-output NEW_CATALOG.json]. Never paste a database URL into evidence.');
 } else if(options['--request'] && options['--capture'] && options['--output'] && (Object.keys(options).length===3 || (Object.keys(options).length===4 && options['--catalog-output']))) {
  const requestFile=await jsonFile(options['--request']),captureFile=await jsonFile(options['--capture']);
  const request=requestFile.value,capture=captureFile.value;
  validateRequest(request);
  const current=await buildSchemaManifest();
  const currentSha=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
  if(request.source.gitSha!==currentSha || canonical(request.schema.migrations)!==canonical(current.migrations) || request.schema.catalogSha256!==current.catalogSha256)throw new Error('prepared request differs from current source HEAD/migration bytes/catalog; prepare again');
  const report={...validateCapture(request,capture),requestArtifactSha256:requestFile.artifactSha256,captureArtifactSha256:captureFile.artifactSha256};
  if(options['--catalog-output']) {
    const bytes=`${JSON.stringify(capture.catalog,null,2)}\n`;
    await writeFile(resolve(options['--catalog-output']),bytes,{flag:'wx',mode:0o600});
    report.verifiedCatalogArtifact={path:resolve(options['--catalog-output']),sha256:sha256(bytes)};
  }
  await writeFile(resolve(options['--output']),`${JSON.stringify(report,null,2)}\n`,{flag:'wx',mode:0o600});
  console.log(`Captured ${report.migrationCount}-migration catalog matched. Capture provenance, runtime, concurrency and managed platform configuration remain external acceptance.`);
 } else throw new Error('Usage: --prepare NEW_REQUEST.json --sql NEW_QUERY.sql --project-url HTTPS_PROJECT_ORIGIN | --request REQUEST.json --capture CAPTURE.json --output NEW_REPORT.json [--catalog-output NEW_CATALOG.json]');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
