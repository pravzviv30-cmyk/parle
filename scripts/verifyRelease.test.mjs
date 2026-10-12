import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { GATES,ROLES,NODE_VERSION,pinnedImage,validHash,releaseIdentity,approvalIdentity,validatePromotion,verifyEvidenceArtifacts,checkSource,repositoryFromRemote,validateCiCaptures } from './verifyRelease.mjs';
import { ROOT,sha256,canonical } from './releaseSchemaManifest.mjs';
import { COVERAGE,PHASES,verifyDrill } from '../deployment/recoveryDrill.mjs';

const now=Date.parse('2026-10-04T12:00:00Z'),hash=s=>sha256(s),url='https://github.com/luvani-test-fixtures/release-evidence';
// Deliberately synthetic offline protocol fixtures; no hosted checks are made.
function fixture() {
  const catalog={tables:[],routines:[]};
  const c={version:1,repository:{host:'github.com',fullName:'fixture/luvani'},gitSha:hash('git').slice(0,40),createdAt:new Date(now-1000).toISOString(),nodeVersion:NODE_VERSION,
    image:`registry.test/luvani@sha256:${hash('image')}`,baseImage:`node:24.16.0-bookworm-slim@sha256:${hash('base')}`,
    audioDecoder:{image:`registry.test/decoder@sha256:${hash('decoder-image')}`,sha256:hash('decoder-binary')},packageLockSha256:hash('lock'),schema:{migrationCount:1,migrations:[{name:'202610040001_fixture.sql',version:'202610040001',sha256:hash('sql')}],catalog,catalogSha256:hash(canonical(catalog))},
    entrypoints:Object.fromEntries(Object.entries(ROLES).map(([role,path])=>[role,{path,sha256:hash(path)}])),
    target:{environment:'staging',supabaseProjectRef:'fixture-project',livekitProjectRef:'fixture-livekit'},acceptance:{},promotionApprovals:[]};
  const binding=releaseIdentity(c),review={status:'passed',reviewedBy:'fixture-operator',reviewedAt:new Date(now-500).toISOString(),expiresAt:new Date(now+60_000).toISOString(),
    evidence:[{url,sha256:hash('offline evidence'),artifactPath:'/private/tmp/offline-release-test-fixture.json'}],releaseSha256:binding,environment:'staging'};
  for(const name of GATES)c.acceptance[name]=structuredClone(review);
  Object.assign(c.acceptance.exactCiAndProtection,{checkedGitSha:c.gitSha,branchProtectionHttpStatus:200,requiredChecks:['gate'],protectedBranch:'main'});
  Object.assign(c.acceptance.containerArtifact,{verifiedImage:c.image,verifiedBaseImage:c.baseImage,provenanceSha256:hash('provenance'),sbomSha256:hash('sbom'),nativeArtifactsSha256:hash('native'),decoderCaptureSha256:hash('decoder-capture'),runtimeCaptureSha256:hash('runtime-capture'),audioDecoderImage:c.audioDecoder.image,audioDecoderSha256:c.audioDecoder.sha256,platform:'linux/amd64'});
  c.acceptance.hostedSchemaSecurity.hostedCatalogSha256=c.schema.catalogSha256;
  Object.assign(c.acceptance.isolatedRestoreAndDeletionReplay,{observedRpoSeconds:30,observedRtoSeconds:60,approvedRpoSeconds:60,approvedRtoSeconds:120,deletionsReplayed:2,
    deletionJournalArtifactSha256:hash('journal'),deletionJournalImplementationUrl:url});
  c.acceptance.voicePhysicalDevice.captureArtifactPath=review.evidence[0].artifactPath;
  Object.assign(c.acceptance.maintenanceAndAlerts,{captureArtifactPath:review.evidence[0].artifactPath,configSha256:hash('monitor-config'),rulesSha256:hash('monitor-rules')});
  approve(c);return c;
}
function approve(c) {
  const candidateSha256=approvalIdentity(c);
  c.promotionApprovals=['fixture-operator','fixture-independent-reviewer'].map(reviewedBy=>({decision:'approved',reviewedBy,candidateSha256,
    reviewedAt:new Date(now-250).toISOString(),expiresAt:new Date(now+60_000).toISOString(),evidence:[{url,sha256:hash(reviewedBy),artifactPath:'/private/tmp/offline-approval-test-fixture.json'}]}));
}
const validate=c=>validatePromotion(c,{now});

test('explicit immutable image reference and patch-pinned base, no invented digest',()=>{
  assert.ok(pinnedImage(fixture().image));assert.ok(pinnedImage(fixture().baseImage,true));
  for(const value of ['node:24','node:24.16.0-bookworm-slim','registry.test/app:latest',`node:24.16.0-bookworm-slim@sha256:${'0'.repeat(64)}`])assert.equal(pinnedImage(value,true),false);
  assert.equal(validHash('pending'),false);
});
test('complete synthetic protocol is accepted but is not a hosted verification',()=>assert.equal(validate(fixture()).environment,'staging'));
test('missing/pending evidence, URL/hash, expiry and unknown gates fail closed',()=>{
  for(const mutate of [c=>c.acceptance.voicePhysicalDevice.status='pending',c=>c.acceptance.authConfiguration.evidence=[],
    c=>c.acceptance.authConfiguration.evidence[0].url='https://example.com/proof',c=>c.acceptance.authConfiguration.evidence[0].sha256='0'.repeat(64),
    c=>c.acceptance.billingAndCost.expiresAt=new Date(now-1).toISOString(),c=>c.acceptance.unknown={status:'passed'}]) {
    const c=fixture();mutate(c);approve(c);assert.throws(()=>validate(c),/release refused/);
  }
});
test('actual target, SHA, image, environment and schema cannot reuse another attestation',()=>{
  for(const mutate of [c=>c.gitSha=hash('other').slice(0,40),c=>c.image=`registry.test/other@sha256:${hash('other image')}`,
    c=>c.repository.fullName='other/repo',c=>c.target.environment='production',c=>c.target.supabaseProjectRef='different-target',c=>c.schema.catalog.tables.push({name:'unexpected'}),
    c=>c.acceptance.hostedSchemaSecurity.hostedCatalogSha256=hash('drift')]) {
    const c=fixture();mutate(c);approve(c);assert.throws(()=>validate(c),/release refused/);
  }
});
test('403 protection response and nonexact CI SHA cannot be certified',()=>{
  for(const mutate of [c=>c.acceptance.exactCiAndProtection.branchProtectionHttpStatus=403,c=>c.acceptance.exactCiAndProtection.checkedGitSha=hash('previous').slice(0,40)]) {
    const c=fixture();mutate(c);approve(c);assert.throws(()=>validate(c),/protected-branch/);
  }
});
test('native artifacts/provenance/SBOM and measured recovery with off-backup journal are mandatory',()=>{
  for(const mutate of [c=>delete c.acceptance.containerArtifact.nativeArtifactsSha256,c=>delete c.acceptance.containerArtifact.sbomSha256,
    c=>delete c.acceptance.isolatedRestoreAndDeletionReplay.deletionJournalArtifactSha256,c=>c.acceptance.isolatedRestoreAndDeletionReplay.observedRtoSeconds=121,
    c=>delete c.acceptance.isolatedRestoreAndDeletionReplay.deletionsReplayed]) {
    const c=fixture();mutate(c);approve(c);assert.throws(()=>validate(c),/release refused/);
  }
});
test('two different final approvals bind the complete evidence package',()=>{
  const missing=fixture();missing.promotionApprovals=[];assert.throws(()=>validate(missing),/two independent/);
  const same=fixture();same.promotionApprovals[1].reviewedBy=same.promotionApprovals[0].reviewedBy;assert.throws(()=>validate(same),/distinct/);
  const changed=fixture();changed.acceptance.voicePhysicalDevice.evidence[0].sha256=hash('changed');assert.throws(()=>validate(changed),/stale candidate/);
});
test('container build refuses missing pin/full revision before install',()=>{
  const result=spawnSync(process.execPath,['deployment/validateBuild.mjs'],{cwd:ROOT,env:{PATH:process.env.PATH,NODE_IMAGE:'node:24',GIT_SHA:'pending'},encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/exact reviewed image digest/);
});
test('static decoder image keeps byte verification and final nonroot offline runtime proofs',async()=>{
  const docker=await readFile(resolve(ROOT,'Dockerfile'),'utf8');
  assert.match(docker,/COPY --from=audio-decoder \/ffmpeg \/usr\/local\/bin\/luvani-ffmpeg/);
  const runtime=docker.slice(docker.indexOf('\nUSER node\n'));
  assert.match(runtime,/RUN --network=none node deployment\/verifyAudioDecoder\.mjs/);
  assert.match(runtime,/node deployment\/nativeArtifacts\.mjs --verify/);
  assert.match(runtime,/cd services\/tutor-agent[\s\S]*await VAD\.load\(\)/);
  const env={PATH:process.env.PATH,NODE_IMAGE:`node:24.16.0-bookworm-slim@sha256:${hash('base')}`,
    GIT_SHA:hash('source').slice(0,40),AUDIO_DECODER_IMAGE:`mwader/static-ffmpeg@sha256:${hash('image')}`,AUDIO_DECODER_SHA256:hash('decoder')};
  const valid=spawnSync(process.execPath,['deployment/validateBuild.mjs'],{cwd:ROOT,env,encoding:'utf8'});
  assert.equal(valid.status,0,valid.stderr);
  for(const change of [{AUDIO_DECODER_IMAGE:'mwader/static-ffmpeg:latest'},{AUDIO_DECODER_SHA256:'0'.repeat(64)},{AUDIO_DECODER_SHA256:'pending'}]) {
    const refused=spawnSync(process.execPath,['deployment/validateBuild.mjs'],{cwd:ROOT,env:{...env,...change},encoding:'utf8'});
    assert.notEqual(refused.status,0);
    assert.match(refused.stderr,/reviewed immutable decoder image and actual executable SHA256/);
  }
});
test('container secret separation refuses a tutor with database service credentials',()=>{
  const result=spawnSync(process.execPath,['deployment/validateEnvironment.mjs','tutor'],{cwd:ROOT,env:{PATH:process.env.PATH,NODE_ENV:'production',
    LIVEKIT_URL:'wss://fixture.test',LIVEKIT_API_KEY:'fixture',LIVEKIT_API_SECRET:'fixture',LUVANI_AGENT_SECRET:'x'.repeat(32),TOKEN_SERVER_URL:'https://fixture.test',TUTOR_LLM:'openai',SUPABASE_SERVICE_ROLE_KEY:'must-never-print'},encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/wrong role secret SUPABASE_SERVICE_ROLE_KEY/);assert.ok(!result.stderr.includes('must-never-print'));
});
test('launcher accepts only known single roles and hands over with exec',async()=>{
  const source=await readFile(resolve(ROOT,'deployment/entrypoint.sh'),'utf8');assert.equal((source.match(/exec node --experimental-strip-types/g)??[]).length,5);
  execFileSync('/bin/sh',['-n','deployment/entrypoint.sh'],{cwd:ROOT});
  const result=spawnSync('/bin/sh',['deployment/entrypoint.sh','unexpected'],{cwd:ROOT,env:{PATH:process.env.PATH,NODE_ENV:'production'},encoding:'utf8'});
  assert.notEqual(result.status,0);
});
test('actual captured evidence bytes, branch protection, exact CI and hosted catalog are checked',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'luvani-release-evidence-'));
  try {
    const c=fixture();
    const copy=async(name,body,urlValue=url)=>{
      const artifactPath=resolve(directory,name),bytes=typeof body==='string'?body:JSON.stringify(body);
      await writeFile(artifactPath,bytes);return {url:urlValue,sha256:hash(bytes),artifactPath};
    };
    const reviewed=await copy('review.txt','Offline reviewed fixture, not real hosted evidence.');
    for(const gate of Object.values(c.acceptance))gate.evidence=[reviewed];
    const protection={httpStatus:200,requestUrl:'https://api.github.com/repos/fixture/luvani/branches/main/protection',body:{enforce_admins:{enabled:true},required_pull_request_reviews:{required_approving_review_count:1},required_status_checks:{contexts:['gate']}}};
    const ci={httpStatus:200,requestUrl:`https://api.github.com/repos/fixture/luvani/commits/${c.gitSha}/check-runs`,body:{check_runs:[{id:123,url:'https://api.github.com/repos/fixture/luvani/check-runs/123',app:{slug:'github-actions'},name:'gate',head_sha:c.gitSha,status:'completed',conclusion:'success'}]}};
    const p=await copy('protection.json',protection,protection.requestUrl),runs=await copy('ci.json',ci,ci.requestUrl),hosted=await copy('catalog.json',c.schema.catalog);
    Object.assign(c.acceptance.exactCiAndProtection,{branchProtectionArtifactPath:p.artifactPath,ciArtifactPath:runs.artifactPath,evidence:[p,runs]});
    Object.assign(c.acceptance.hostedSchemaSecurity,{hostedCatalogArtifactPath:hosted.artifactPath,evidence:[hosted]});
    approve(c);for(const approval of c.promotionApprovals)approval.evidence=[reviewed];
    c.acceptance.voicePhysicalDevice.captureArtifactPath=reviewed.artifactPath;c.acceptance.maintenanceAndAlerts.captureArtifactPath=reviewed.artifactPath;approve(c);
    for(const approval of c.promotionApprovals)approval.evidence=[reviewed];
    validate(c);await assert.rejects(verifyEvidenceArtifacts(c),/container captured hash\/path differs/);
    await writeFile(p.artifactPath,'changed bytes');await assert.rejects(verifyEvidenceArtifacts(c),/hash differs/);
    protection.httpStatus=403;
    c.acceptance.exactCiAndProtection.evidence[0]=await copy('protection.json',protection,protection.requestUrl);
    await assert.rejects(verifyEvidenceArtifacts(c),/403 is unresolved/);
    protection.httpStatus=200;c.acceptance.exactCiAndProtection.evidence[0]=await copy('protection.json',protection,protection.requestUrl);
    ci.body.check_runs[0].head_sha=hash('old').slice(0,40);c.acceptance.exactCiAndProtection.evidence[1]=await copy('ci.json',ci,ci.requestUrl);
    await assert.rejects(verifyEvidenceArtifacts(c),/exact-head successful check missing/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
test('recovery inventory refuses missing Storage bodies, deletion gap and invalid timing',()=>{
  const reviewed=name=>({name,status:'passed',evidenceUrl:url,sha256:hash(name)});
  const drill={version:1,isolatedTarget:true,sourceProjectRef:'source',targetProjectRef:'isolated',approvedRpoSeconds:60,approvedRtoSeconds:120,
    observedRpoSeconds:30,deletionsExpected:2,deletionsReplayed:2,journalHighWaterBefore:2,journalHighWaterAfter:2,
    coverage:COVERAGE.map(reviewed),phases:PHASES.map((name,i)=>({...reviewed(name),startedAt:new Date(now+i*1000).toISOString(),completedAt:new Date(now+(i+1)*1000).toISOString()}))};
  assert.equal(verifyDrill(drill).observedRtoSeconds,7);
  for(const mutate of [d=>d.coverage=d.coverage.filter(x=>x.name!=='storageMetadataAndBodies'),d=>d.deletionsReplayed=1,
    d=>d.targetProjectRef=d.sourceProjectRef,d=>d.phases[1].startedAt=new Date(now).toISOString(),d=>d.approvedRtoSeconds=1]) {
    const d=structuredClone(drill);mutate(d);assert.throws(()=>verifyDrill(d));
  }
});
test('maintenance refuses missing external journal and other roles cannot receive its key',()=>{
  const result=spawnSync(process.execPath,['deployment/validateEnvironment.mjs','maintenance'],{cwd:ROOT,env:{PATH:process.env.PATH,NODE_ENV:'production',
    SUPABASE_URL:'https://fixture.test',SUPABASE_SERVICE_ROLE_KEY:'fixture',LIVEKIT_URL:'wss://fixture.test',LIVEKIT_API_KEY:'fixture',LIVEKIT_API_SECRET:'fixture'},encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/LUVANI_DELETION_JOURNAL/);
});
test('source gate replays every migration and includes privacy/worker/catalog security',async()=>{
  const schema=await checkSource();assert.ok(schema.migrationCount>=31);assert.equal(schema.migrationCount,schema.migrations.length);
  assert.ok(schema.catalog.tables.some(t=>t.name==='account_erasure_jobs'));
  assert.ok(schema.catalog.tables.some(t=>t.name==='backend_worker_heartbeats'));
  assert.ok(schema.catalog.routines.some(r=>r.name==='backend_catalog_v1' && !r.execute.anon && !r.execute.authenticated && r.execute.service_role));
  assert.equal(schema.replay.hostedVerified,false);assert.equal(schema.replay.concurrentVerified,false);
});

test('canonical origin and actual CI/protection captures bind one repository, refusing forks and path lookalikes',()=>{
 assert.deepEqual(repositoryFromRemote('git@github.com:Fixture/Luvani.git'),{host:'github.com',fullName:'fixture/luvani'});
 assert.deepEqual(repositoryFromRemote('https://github.com/Fixture/Luvani'),{host:'github.com',fullName:'fixture/luvani'});
 for(const remote of ['https://github.com.evil.test/a/b','https://secret@github.com/a/b.git','git@github.com:a/b.git/other'])assert.throws(()=>repositoryFromRemote(remote));
 const c=fixture(),root='https://api.github.com/repos/fixture/luvani';
 const protection={httpStatus:200,requestUrl:`${root}/branches/main/protection`,body:{enforce_admins:{enabled:true},required_pull_request_reviews:{required_approving_review_count:1},required_status_checks:{contexts:['gate']}}};
 const ci={httpStatus:200,requestUrl:`${root}/commits/${c.gitSha}/check-runs?per_page=100&filter=latest`,body:{check_runs:[{id:123,url:`${root}/check-runs/123`,app:{slug:'github-actions'},name:'gate',head_sha:c.gitSha,status:'completed',conclusion:'success'}]}};
 assert.doesNotThrow(()=>validateCiCaptures(c,protection,ci));
 for(const mutate of [p=>p.requestUrl=p.requestUrl.replace('fixture/luvani','other/repository'),p=>p.requestUrl+='?untrusted=1']){const p=structuredClone(protection);mutate(p);assert.throws(()=>validateCiCaptures(c,p,ci));}
 for(const mutate of [r=>r.requestUrl=r.requestUrl.replace('fixture/luvani','fork/luvani'),r=>r.requestUrl+=`&path=/commits/${c.gitSha}/check-runs`,r=>r.requestUrl=r.requestUrl.replace('check-runs?','check-runs-suffix?'),r=>r.body.check_runs[0].url=r.body.check_runs[0].url.replace('fixture/luvani','fork/luvani'),r=>r.body.check_runs[0].app.slug='unreviewed-app',r=>r.body.check_runs[0].head_sha=hash('fork').slice(0,40)]){const r=structuredClone(ci);mutate(r);assert.throws(()=>validateCiCaptures(c,protection,r));}
});
