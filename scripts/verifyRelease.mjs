/** Local release evidence validation. This script never deploys or contacts a host. */
import { readFile, writeFile, access, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContainerCaptures } from '../deployment/containerAcceptance.mjs';
import { verifyVoiceAcceptanceArtifacts } from './verifyVoiceAcceptance.mjs';
import { verifyMonitoringAcceptanceArtifacts } from '../deployment/observabilityAcceptance.mjs';
import { ROOT, sha256, canonical, buildSchemaManifest, migrationInventory } from './releaseSchemaManifest.mjs';

export const NODE_VERSION='24.16.0';
export const ROLES=Object.freeze({api:'services/token-server/src/server.ts',tutor:'services/tutor-agent/src/agent.ts',
  practice:'services/token-server/src/practiceWorker.ts',maintenance:'services/token-server/src/maintenanceWorker.ts',observability:'deployment/observability.mjs'});
export const GATES=Object.freeze(['exactCiAndProtection','containerArtifact','hostedSchemaSecurity','authConfiguration',
  'secretsAndIngress','voicePhysicalDevice','leaseConcurrencyAndDrain','billingAndCost','maintenanceAndAlerts',
  'isolatedRestoreAndDeletionReplay','mobileEnvironment']);
const MAX_AGE=7*24*60*60*1000;
const fail=message=>{throw new Error(`release refused: ${message}`);};
export const validHash=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value) && !/^([a-f0-9])\1{63}$/.test(value);
const validSha=value=>typeof value==='string' && /^[a-f0-9]{40}$/.test(value) && !/^([a-f0-9])\1{39}$/.test(value);
export function pinnedImage(value,base=false) {
  if (typeof value!=='string' || !/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(value)) return false;
  const digest=value.split('@sha256:')[1];
  return validHash(digest) && (!base || value.startsWith(`node:${NODE_VERSION}-bookworm-slim@sha256:`));
}
function evidence(entry,label,now) {
  if (!entry || entry.status!=='passed' || typeof entry.reviewedBy!=='string' || entry.reviewedBy.trim().length<3) fail(`${label} has no accountable passed review`);
  const reviewed=Date.parse(entry.reviewedAt),expires=Date.parse(entry.expiresAt);
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires) || reviewed>now+60_000 || now-reviewed>MAX_AGE || expires<=now || expires-reviewed>MAX_AGE || expires<=reviewed) fail(`${label} evidence expired or malformed`);
  if (!Array.isArray(entry.evidence) || !entry.evidence.length) fail(`${label} needs evidence URLs and hashes`);
  for (const item of entry.evidence) {
    let url;try {url=new URL(item.url);}catch{fail(`${label} evidence URL invalid`);}
    if (url.protocol!=='https:' || url.username || url.password || /(?:example\.(?:com|org|net)|localhost|invalid)$/i.test(url.hostname)
      || /(?:placeholder|todo|replace.me)/i.test(item.url) || !validHash(item.sha256) || typeof item.artifactPath!=='string' || !item.artifactPath.startsWith('/')) fail(`${label} evidence URL/hash/artifact unreviewable`);
  }
}
export function repositoryFromRemote(remote) {
  if(typeof remote!=='string')fail('GitHub origin required');
  const match=remote.match(/^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)(?:\.git)?$/);
  if(!match)fail('reviewed GitHub origin required');
  return {host:'github.com',fullName:match[1].toLowerCase()};
}
function repository(candidate) {
  const r=candidate.repository;
  if(r?.host!=='github.com' || typeof r.fullName!=='string' || !/^[a-z0-9-]+\/[a-z0-9._-]+$/.test(r.fullName) || r.fullName.endsWith('/.') || r.fullName.endsWith('/..'))fail('canonical GitHub repository required');
  return r.fullName;
}
export function validateCiCaptures(candidate,protection,ci) {
  const p=candidate.acceptance.exactCiAndProtection,fullName=repository(candidate),root=`https://api.github.com/repos/${fullName}`;
  if(protection.httpStatus!==200 || protection.requestUrl!==`${root}/branches/${encodeURIComponent(p.protectedBranch)}/protection` || !protection.body?.enforce_admins?.enabled || !(protection.body.required_pull_request_reviews?.required_approving_review_count>=1))fail('captured real branch protection/reviews/admin enforcement for candidate repository required;403 is unresolved');
  const protectedChecks=[...(protection.body.required_status_checks?.contexts??[]),...(protection.body.required_status_checks?.checks??[]).map(x=>x.context)];
  if(p.requiredChecks.some(name=>!protectedChecks.includes(name)))fail('captured protection does not require declared checks');
  let url;try{url=new URL(ci.requestUrl);}catch{fail('actual exact-head CI capture required');}
  if(ci.httpStatus!==200 || `${url.origin}${url.pathname}`!==`${root}/commits/${candidate.gitSha}/check-runs` || url.username || url.password || url.hash || new Set(url.searchParams.keys()).size!==[...url.searchParams.keys()].length || [...url.searchParams].some(([key,value])=>key==='filter'?!['latest','all'].includes(value):['per_page','page'].includes(key)?!/^[1-9][0-9]*$/.test(value) || key==='per_page' && Number(value)>100:true))fail('actual exact-head CI capture for candidate repository required');
  for(const name of p.requiredChecks)if(!ci.body?.check_runs?.some(run=>run.name===name && run.head_sha===candidate.gitSha && run.status==='completed' && run.conclusion==='success' && Number.isSafeInteger(run.id) && run.id>0 && run.url===`${root}/check-runs/${run.id}` && run.app?.slug==='github-actions'))fail(`exact-head successful check missing: ${name} (candidate repository GitHub Actions run required)`);
}
export function releaseIdentity(candidate) {
  return sha256(canonical({version:candidate.version,gitSha:candidate.gitSha,nodeVersion:candidate.nodeVersion,image:candidate.image,
    repository:candidate.repository,baseImage:candidate.baseImage,audioDecoder:candidate.audioDecoder,packageLockSha256:candidate.packageLockSha256,schemaSha256:candidate.schema?.catalogSha256,
    migrations:candidate.schema?.migrations,entrypoints:candidate.entrypoints,target:candidate.target}));
}
export function approvalIdentity(candidate) {
  const {promotionApprovals,...body}=candidate;
  return sha256(canonical(body));
}
export function validatePromotion(candidate,{now=Date.now()}={}) {
  if (candidate?.version!==1 || !validSha(candidate.gitSha) || candidate.nodeVersion!==NODE_VERSION || !pinnedImage(candidate.image) || !pinnedImage(candidate.baseImage,true)
    || !pinnedImage(candidate.audioDecoder?.image) || !validHash(candidate.audioDecoder?.sha256) || !validHash(candidate.packageLockSha256) || !validHash(candidate.schema?.catalogSha256)) fail('invalid artifact identity');
  repository(candidate);
  const created=Date.parse(candidate.createdAt);
  if (!Number.isFinite(created) || created>now+60_000 || now-created>MAX_AGE) fail('candidate expired');
  if (!['staging','production'].includes(candidate.target?.environment) || !/^[a-z0-9-]{8,100}$/.test(candidate.target?.supabaseProjectRef??'')
    || !/^[a-zA-Z0-9_-]{3,100}$/.test(candidate.target?.livekitProjectRef??'')) fail('explicit actual target projects required');
  if (/example|placeholder|replace|unknown/i.test(`${candidate.target.supabaseProjectRef} ${candidate.target.livekitProjectRef}`)) fail('placeholder target');
  for (const [role,path] of Object.entries(ROLES)) if (candidate.entrypoints?.[role]?.path!==path || !validHash(candidate.entrypoints[role].sha256)) fail(`entrypoint ${role} not bound`);
  if (!candidate.schema.migrations?.length || candidate.schema.migrationCount!==candidate.schema.migrations.length || candidate.schema.catalogSha256!==sha256(canonical(candidate.schema.catalog))) fail('invalid schema inventory');
  if (!candidate.acceptance || Object.keys(candidate.acceptance).sort().join()!==[...GATES].sort().join()) fail('acceptance inventory missing/unknown');
  const binding=releaseIdentity(candidate);
  for (const name of GATES) {
    const gate=candidate.acceptance[name];evidence(gate,name,now);
    if (gate.releaseSha256!==binding || gate.environment!==candidate.target.environment) fail(`${name} is bound to another artifact or target`);
  }
  // Require measured results and an external deletion-journal implementation,
  // rather than interpreting a passed checkbox as recovery/branch protection.
  const recovery=candidate.acceptance.isolatedRestoreAndDeletionReplay;
  for (const key of ['observedRpoSeconds','observedRtoSeconds','approvedRpoSeconds','approvedRtoSeconds','deletionsReplayed']) {
    if (!Number.isSafeInteger(recovery[key]) || recovery[key]<0 || recovery[key]>31536000) fail(`restore measurement ${key} required`);
  }
  if (recovery.approvedRpoSeconds<1 || recovery.approvedRtoSeconds<1 || recovery.observedRpoSeconds>recovery.approvedRpoSeconds || recovery.observedRtoSeconds>recovery.approvedRtoSeconds) fail('restore exceeds approved recovery target');
  if (!validHash(recovery.deletionJournalArtifactSha256) || typeof recovery.deletionJournalImplementationUrl!=='string') fail('off-backup deletion journal implementation evidence required');
  const journal=new URL(recovery.deletionJournalImplementationUrl);
  if (journal.protocol!=='https:' || !recovery.evidence.some(e=>e.url===journal.href || e.url===recovery.deletionJournalImplementationUrl)) fail('journal implementation URL not supported by reviewed evidence');
  const protection=candidate.acceptance.exactCiAndProtection;
  if (protection.checkedGitSha!==candidate.gitSha || protection.branchProtectionHttpStatus!==200 || !Array.isArray(protection.requiredChecks) || !protection.requiredChecks.length
    || protection.requiredChecks.some(v=>typeof v!=='string' || !v.trim()) || typeof protection.protectedBranch!=='string' || !protection.protectedBranch.trim()) fail('real successful protected-branch/exact-head acceptance required (403 is unresolved)');
  const artifact=candidate.acceptance.containerArtifact;
  if (artifact.verifiedImage!==candidate.image || artifact.verifiedBaseImage!==candidate.baseImage || !validHash(artifact.provenanceSha256) || !validHash(artifact.sbomSha256)
    || artifact.audioDecoderImage!==candidate.audioDecoder.image || artifact.audioDecoderSha256!==candidate.audioDecoder.sha256 || !validHash(artifact.nativeArtifactsSha256) || !validHash(artifact.decoderCaptureSha256) || !validHash(artifact.runtimeCaptureSha256) || !['linux/amd64','linux/arm64'].includes(artifact.platform)) fail('image/provenance/SBOM/native-runtime evidence required');
  for(const [name,key] of [['voicePhysicalDevice','captureArtifactPath'],['maintenanceAndAlerts','captureArtifactPath']])if(typeof candidate.acceptance[name][key]!=='string' || !candidate.acceptance[name].evidence.some(e=>e.artifactPath===candidate.acceptance[name][key]))fail(`${name} structured hashed acceptance capture required`);
  if(!validHash(candidate.acceptance.maintenanceAndAlerts.configSha256) || !validHash(candidate.acceptance.maintenanceAndAlerts.rulesSha256))fail('reviewed monitoring configuration/rules required');
  if (candidate.acceptance.hostedSchemaSecurity.hostedCatalogSha256!==candidate.schema.catalogSha256) fail('hosted application schema inventory differs');
  if (!Array.isArray(candidate.promotionApprovals) || candidate.promotionApprovals.length!==2) fail('two independent final promotion approvals required');
  const approvedHash=approvalIdentity(candidate);
  const identities=new Set();
  for (const approval of candidate.promotionApprovals) {
    evidence({...approval,status:approval.decision==='approved'?'passed':'pending'},'promotion approval',now);
    if (approval.candidateSha256!==approvedHash) fail('promotion approval binds stale candidate');
    identities.add(approval.reviewedBy.trim().toLowerCase());
  }
  if (identities.size!==2) fail('promotion reviewers must be distinct');
  return {releaseSha256:binding,candidateSha256:approvedHash,gitSha:candidate.gitSha,image:candidate.image,environment:candidate.target.environment};
}

/** Verify actual local copies of externally reviewed evidence, not hash syntax alone. */
export async function verifyEvidenceArtifacts(candidate) {
  const copies=new Map();
  for(const review of [...Object.values(candidate.acceptance),...candidate.promotionApprovals])for(const item of review.evidence) {
    const info=await stat(item.artifactPath);
    if(!info.isFile() || info.size<1 || info.size>50*1024*1024)fail('evidence file missing, empty or exceeds50MiB');
    const bytes=await readFile(item.artifactPath);
    if(sha256(bytes)!==item.sha256)fail('evidence artifact hash differs');
    copies.set(item.artifactPath,bytes);
  }
  const record=(path,gate)=>{
    if(!candidate.acceptance[gate].evidence.some(e=>e.artifactPath===path))fail(`${gate} capture is not hashed evidence`);
    try{return JSON.parse(copies.get(path).toString('utf8'));}catch{fail(`${gate} capture is not JSON`);}
  };
  const p=candidate.acceptance.exactCiAndProtection;
  const protection=record(p.branchProtectionArtifactPath,'exactCiAndProtection');
  const ci=record(p.ciArtifactPath,'exactCiAndProtection');
  validateCiCaptures(candidate,protection,ci);
  if(!p.evidence.some(e=>e.artifactPath===p.branchProtectionArtifactPath && e.url===protection.requestUrl))fail('protection evidence URL differs from actual capture');
  if(!p.evidence.some(e=>e.artifactPath===p.ciArtifactPath && e.url===ci.requestUrl))fail('CI evidence URL differs from actual capture');
  const container=candidate.acceptance.containerArtifact;
  const captures=Object.fromEntries([['receipt','receiptArtifactPath',null],['provenance','provenanceArtifactPath','provenanceSha256'],['sbom','sbomArtifactPath','sbomSha256'],['native','nativeArtifactPath','nativeArtifactsSha256'],['decoder','decoderArtifactPath','decoderCaptureSha256'],['runtime','runtimeArtifactPath','runtimeCaptureSha256']].map(([name,pathKey,hashKey])=>{
    const path=container[pathKey],evidence=container.evidence.find(e=>e.artifactPath===path);
    if(!evidence || hashKey && evidence.sha256!==container[hashKey])fail('container captured hash/path differs');
    return [name,record(path,'containerArtifact')];
  }));validateContainerCaptures(candidate,captures);
  const hosted=record(candidate.acceptance.hostedSchemaSecurity.hostedCatalogArtifactPath,'hostedSchemaSecurity');
  if(sha256(canonical(hosted))!==candidate.schema.catalogSha256)fail('actual captured hosted catalog differs');
  const voice=await verifyVoiceAcceptanceArtifacts(record(candidate.acceptance.voicePhysicalDevice.captureArtifactPath,'voicePhysicalDevice'),{releaseSha256:releaseIdentity(candidate),gitSha:candidate.gitSha,image:candidate.image,schemaSha256:candidate.schema.catalogSha256});
  if(!voice.reviewedCaptureAccepted)fail('real physical-device capture required');
  const monitor=candidate.acceptance.maintenanceAndAlerts;
  const alerts=await verifyMonitoringAcceptanceArtifacts(record(monitor.captureArtifactPath,'maintenanceAndAlerts'),{releaseSha256:releaseIdentity(candidate),configSha256:monitor.configSha256,rulesSha256:monitor.rulesSha256});
  if(!alerts.reviewedCaptureAccepted)fail('actual monitoring delivery/ack capture required');
}

function git(args) { return execFileSync('git',args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
function cleanHead() {
  if (git(['status','--porcelain','--untracked-files=all'])) fail('commit all reviewed source first; working tree is dirty');
  const sha=git(['rev-parse','HEAD']);if(!validSha(sha))fail('HEAD SHA invalid');return sha;
}
async function entrypoints() {
  return Object.fromEntries(await Promise.all(Object.entries(ROLES).map(async ([role,path])=>[role,{path,sha256:sha256(await readFile(resolve(ROOT,path)))}])));
}
export async function checkSource() {
  const files=['Dockerfile','.dockerignore','deployment/entrypoint.sh','deployment/compose.yaml','deployment/environment-contract.json','apps/mobile/eas.json','docs/BACKEND_RELEASE_RUNBOOK.md'];
  for (const file of files) await access(resolve(ROOT,file));
  const docker=await readFile(resolve(ROOT,'Dockerfile'),'utf8');
  if (!docker.includes('ARG NODE_IMAGE\n') || /ARG NODE_IMAGE=|FROM node:/.test(docker) || !docker.includes('USER node') || !docker.includes('npm ci') || docker.includes('--ignore-scripts')) fail('container dependency/runtime contract changed');
  const ignore=await readFile(resolve(ROOT,'.dockerignore'),'utf8');if(!ignore.includes('**/.env*') || !ignore.includes('**/node_modules') || !ignore.includes('.git'))fail('unsafe container build context');
  const profiles=JSON.parse(await readFile(resolve(ROOT,'apps/mobile/eas.json'),'utf8')).build;
  for(const [name,environment] of [['staging','preview'],['production','production']]) {
    const p=profiles?.[name];if(p?.environment!==environment || p.node!==NODE_VERSION || p.developmentClient!==false || p.env?.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT!=='0'
      || p.env?.EXPO_PUBLIC_LUVANI_WALL_PREVIEW!=='0' || JSON.stringify(p).includes('localhost'))fail(`unsafe EAS ${name} profile`);
  }
  const env=JSON.parse(await readFile(resolve(ROOT,'deployment/environment-contract.json'),'utf8'));
  if(env.version!==1 || env.roles?.tutor?.secrets?.includes('SUPABASE_SERVICE_ROLE_KEY') || !env.roles?.api?.secrets?.includes('LUVANI_METRICS_SECRET'))fail('service secret separation changed');
  await entrypoints();
  const schema=await buildSchemaManifest();
  console.log(`release source checks passed; ${schema.migrationCount} migrations, ${schema.catalog.tables.length} tables, ${schema.catalog.routines.length} routines; hosted/container/promotion acceptance pending`);
  return schema;
}
function argumentsFor(args) {
  const map=new Map();for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--') || args[i+1]===undefined || map.has(args[i]))fail('invalid/duplicate CLI arguments');map.set(args[i],args[i+1]);}return map;
}
async function main(args) {
  if(args.length===1 && args[0]==='--check'){await checkSource();return;}
  if(args.length===2 && args[0]==='--promotion') {
    const candidate=JSON.parse(await readFile(resolve(args[1]),'utf8'));
    const result=validatePromotion(candidate);
    await verifyEvidenceArtifacts(candidate);
    if(cleanHead()!==candidate.gitSha)fail('candidate is not current clean HEAD');
    if(canonical(repositoryFromRemote(git(['remote','get-url','origin'])))!==canonical(candidate.repository))fail('candidate differs from current origin repository');
    if(sha256(await readFile(resolve(ROOT,'package-lock.json')))!==candidate.packageLockSha256 || canonical(await entrypoints())!==canonical(candidate.entrypoints))fail('lock/entrypoints changed');
    if(canonical(await migrationInventory())!==canonical(candidate.schema.migrations))fail('migration inventory changed');
    const expected=await buildSchemaManifest();if(expected.catalogSha256!==candidate.schema.catalogSha256)fail('schema replay changed');
    console.log(JSON.stringify({...result,verified:'review evidence only; no deployment performed'}));return;
  }
  const map=argumentsFor(args),allowed=['--candidate','--image','--base-image','--decoder-image','--decoder-sha256','--environment'];
  if(map.size!==6 || [...map.keys()].some(k=>!allowed.includes(k)))fail('Usage: --check | --promotion FILE | --candidate NEW_FILE --image REF@sha256:DIGEST --base-image node:24.16.0-bookworm-slim@sha256:DIGEST --decoder-image REF@sha256:DIGEST --decoder-sha256 SHA256 --environment staging|production');
  const gitSha=cleanHead();
  if(process.versions.node!==NODE_VERSION || !pinnedImage(map.get('--image')) || !pinnedImage(map.get('--base-image'),true) || !pinnedImage(map.get('--decoder-image')) || !validHash(map.get('--decoder-sha256')) || !['staging','production'].includes(map.get('--environment')))fail('exact runtime, immutable images and explicit environment required');
  const schema=await checkSource();
  const candidate={version:1,gitSha,repository:repositoryFromRemote(git(['remote','get-url','origin'])),createdAt:new Date().toISOString(),nodeVersion:NODE_VERSION,image:map.get('--image'),baseImage:map.get('--base-image'),audioDecoder:{image:map.get('--decoder-image'),sha256:map.get('--decoder-sha256')},
    packageLockSha256:sha256(await readFile(resolve(ROOT,'package-lock.json'))),schema,entrypoints:await entrypoints(),target:{environment:map.get('--environment'),supabaseProjectRef:null,livekitProjectRef:null},
    acceptance:Object.fromEntries(GATES.map(name=>[name,{status:'pending',reviewedBy:null,reviewedAt:null,expiresAt:null,evidence:[],releaseSha256:null,environment:map.get('--environment')} ])),promotionApprovals:[]};
  if(cleanHead()!==gitSha)fail('source changed during candidate preparation');
  await writeFile(resolve(map.get('--candidate')),`${JSON.stringify(candidate,null,2)}\n`,{flag:'wx',mode:0o600});
  console.log(`candidate prepared for ${gitSha}; all ${GATES.length} external gates pending; promotion refused until completed and independently approved`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exit(1);});
