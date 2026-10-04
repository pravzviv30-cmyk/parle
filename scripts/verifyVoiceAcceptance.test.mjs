import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile}from 'node:fs/promises';
import {tmpdir}from 'node:os';
import {join}from 'node:path';
import {createHash}from 'node:crypto';
import {VOICE_SCENARIOS,ACCENT_CLASSES,validateVoiceAcceptance,verifyVoiceAcceptanceArtifacts,voiceCaptureIdentity,voicePolicyIdentity}from './verifyVoiceAcceptance.mjs';
const now=Date.now(),hash=s=>createHash('sha256').update(s).digest('hex'),stamp=new Date(now).toISOString(),expiry=new Date(now+3600000).toISOString();
async function fixture(kind='synthetic'){
 const dir=await mkdtemp(join(tmpdir(),'luvani-voice-acceptance-'));let counter=0;
 const evidence=[];
 const artifact=async(name,value,register=true)=>{const bytes=typeof value==='string'?value:JSON.stringify(value);const item={url:`https://evidence.fixture-domain.org/${name}`,sha256:hash(bytes),artifactPath:join(dir,`${++counter}.json`)};await writeFile(item.artifactPath,bytes);if(register)evidence.push(item);return item;};
 const release={releaseSha256:hash('synthetic release'),gitSha:hash('synthetic git').slice(0,40),image:`luvani-fixture@sha256:${hash('synthetic image')}`,schemaSha256:hash('synthetic schema')};
 const fixtures=[];for(let n=0;n<6;n++)fixtures.push({id:`fixture-${n}`,accentClass:ACCENT_CLASSES[n%3],sourceSha256:(await artifact(`corpus-${n}`,'synthetic offline source '+n)).sha256});
 const corpusFile=await artifact('corpus',{version:1,locale:'fr',fixtures});
 const rubric=await artifact('rubric',{version:1,rubricId:'synthetic-rubric',transcriptMetric:'synthetic accuracy unit',learningMetric:'synthetic rubric unit',taskSuccessMetric:'synthetic task unit',reviewedBy:'offline-fixture-reviewer'});
 const consent=await artifact('consent',{version:1,corpusSha256:corpusFile.sha256,consentBasis:kind==='synthetic'?'synthetic':'licensed-corpus',reviewedBy:'offline-fixture-reviewer',reviewedAt:stamp,allowedPurposes:['voice-acceptance']});
 const models=[{provider:'openai',model:'synthetic-model',voice:'',configurationSha256:hash('synthetic model config')}];
 const configuration=await artifact('configuration',{version:1,models});
 const devices=[];for(const platform of ['ios','android']){const build=await artifact(`${platform}-build`,{version:1,platform,gitSha:release.gitSha,artifactSha256:hash(`${platform} synthetic build`),artifactUrl:`https://build.fixture-domain.org/${platform}`});devices.push({id:`${platform}-001`,platform,physical:kind!=='synthetic',model:'Synthetic device protocol fixture',osVersion:'offline-test',buildSha256:build.sha256});}
 const policy={minCasesPerPlatform:20,minVoiceCasesPerPlatform:10,minAccentCasesPerPlatform:2,maxP50TurnMillis:1000,maxP95TurnMillis:2000,maxP50CostMicroUsd:100,maxP95CostMicroUsd:200,minTranscriptAccuracy:.8,minLearningScore:.8,minTaskSuccessRatio:.9};
 const mkReview=async(subject,who)=>{const capture={decision:'approved',reviewedBy:who,reviewedAt:stamp,expiresAt:expiry,subjectSha256:subject};return {...capture,evidence:await artifact(`${who}-review`,capture,false)};};
 const pr=await mkReview(voicePolicyIdentity(policy),'offline-policy-reviewer');delete pr.decision;policy.review=pr;
 const cases=[];for(const d of devices){for(let n=0;n<20;n++){
  const scenario=n<10?(n%2?'noisy-accented-fr':'accented-fr'):VOICE_SCENARIOS[2+(n-10)%7];
  const c={id:`${d.platform}-case-${String(n).padStart(2,'0')}`,deviceId:d.id,fixtureId:fixtures[n%6].id,scenario,mode:scenario==='typed-fallback'?'typed':'voice',configurationSha256:configuration.sha256,measurements:{turnMillis:100+n,costMicroUsd:scenario==='unsafe-canary'?0:10,providerAttempts:scenario==='unsafe-canary'?0:1,transcriptAccuracy:1,learningScore:1},assertions:{taskSuccess:true,safetyExpected:true,canaryBlocked:true,unusedRefundCorrect:true,practiceBaselinePreserved:true}};
  const trace={version:1,caseId:c.id,deviceId:c.deviceId,fixtureId:c.fixtureId,scenario:c.scenario,mode:c.mode,release,configurationSha256:c.configurationSha256,deviceBuildSha256:d.buildSha256,physical:kind==='physical-device',recordedAt:stamp,measurements:c.measurements,assertions:c.assertions};c.evidenceSha256=(await artifact(c.id,trace)).sha256;cases.push(c);
 }}
 const value={version:1,captureKind:kind,capturedAt:stamp,release,corpus:{sha256:corpusFile.sha256,locale:'fr',rubricSha256:rubric.sha256,consentSha256:consent.sha256,fixtures},configuration:{sha256:configuration.sha256,models},devices,policy,cases,evidence,reviews:[]};
 for(const who of ['offline-reviewer-one','offline-reviewer-two']){const r=await mkReview(voiceCaptureIdentity(value),who);delete r.decision;value.reviews.push(r);}
 return {value,dir,artifact};
}
async function withFixture(run,kind='synthetic'){const f=await fixture(kind);try{await run(f);}finally{await rm(f.dir,{recursive:true,force:true});}}
test('synthetic complete protocol validates but cannot approve production or claim independent measurement',async()=>withFixture(async({value})=>{
 const schema=validateVoiceAcceptance(value,value.release,{now});assert.equal(schema.schemaValidated,true);assert.equal(schema.reviewedCaptureAccepted,false);assert.equal(schema.independentlyMeasured,false);
 const report=await verifyVoiceAcceptanceArtifacts(value,value.release,{now});assert.equal(report.localIntegrityVerified,true);assert.equal(report.reviewedCaptureAccepted,false);assert.equal(report.platforms.ios.cases,20);assert.equal(report.platforms.android.voiceCases,10);assert.equal(report.platforms.ios.p50CostMicroUsd,10);
}));
test('exact source/image/schema/config, both platforms and required corpus/scenario completeness are mandatory',async()=>withFixture(async({value})=>{
 for(const change of [v=>v.release.gitSha=hash('other').slice(0,40),v=>v.release.image=`other@sha256:${hash('other')}`,v=>v.release.schemaSha256=hash('other'),v=>v.devices=v.devices.filter(d=>d.platform==='ios'),v=>v.cases[0].configurationSha256=hash('other'),v=>v.cases=v.cases.filter(c=>c.scenario!=='background-resume'),v=>v.corpus.fixtures[0].accentClass='unknown',v=>v.cases[0].fixtureId='missing-fixture',v=>v.evidence=[],v=>v.policy.minVoiceCasesPerPlatform=1]){const changed=structuredClone(value);change(changed);assert.throws(()=>validateVoiceAcceptance(changed,value.release,{now}),/voice-acceptance-refused/);}
}));
test('canary/provider dispatch, safety, failed-session refund and practice loss cannot pass',async()=>withFixture(async({value})=>{
 for(const change of [v=>v.cases.find(c=>c.scenario==='unsafe-canary').assertions.canaryBlocked=false,v=>v.cases.find(c=>c.scenario==='unsafe-canary').measurements.providerAttempts=1,v=>v.cases.find(c=>c.scenario==='unsafe-canary').measurements.costMicroUsd=1,v=>v.cases[0].assertions.safetyExpected=false,v=>v.cases.find(c=>c.scenario==='failed-session-refund').assertions.unusedRefundCorrect=false,v=>v.cases.find(c=>c.scenario==='practice-baseline-preserved').assertions.practiceBaselinePreserved=false,v=>v.cases.find(c=>c.scenario==='reconnect').assertions.taskSuccess=false]){const changed=structuredClone(value);change(changed);assert.throws(()=>validateVoiceAcceptance(changed,value.release,{now}),/safety-refund-preservation/);}
}));
test('measured p50/p95 and scored quality must satisfy current operator policy, exact independent review binding',async()=>withFixture(async({value})=>{
 for(const change of [v=>v.cases[0].measurements.turnMillis=900000,v=>v.cases[0].measurements.costMicroUsd=100000,v=>v.cases[0].measurements.learningScore=0,v=>v.policy.maxP50TurnMillis=0,v=>v.cases[0].measurements.costMicroUsd=Infinity,v=>v.reviews[1].reviewedBy=v.reviews[0].reviewedBy,v=>v.reviews[0].subjectSha256=hash('other'),v=>v.reviews[0].expiresAt=new Date(now-1).toISOString(),v=>v.cases[0].assertions.taskSuccess='true']){const changed=structuredClone(value);change(changed);assert.throws(()=>validateVoiceAcceptance(changed,value.release,{now}));}
}));
test('local trace/corpus/configuration/native-build/review bytes are hashed; absence or mutation refuses',async()=>withFixture(async({value})=>{
 const target=value.evidence.find(e=>e.sha256===value.cases[0].evidenceSha256);await writeFile(target.artifactPath,'tampered trace');await assert.rejects(verifyVoiceAcceptanceArtifacts(value,value.release,{now}),/artifact-hash/);
}));
test('physical-format unit fixture requires real-format traces/consent/provenance/reviews and never claims the runner measured quality',async()=>withFixture(async({value})=>{
 const report=await verifyVoiceAcceptanceArtifacts(value,value.release,{now});assert.equal(report.reviewedCaptureAccepted,true);assert.equal(report.independentlyMeasured,false);
 const nonphysical=structuredClone(value);nonphysical.devices[0].physical=false;assert.throws(()=>validateVoiceAcceptance(nonphysical,value.release,{now}),/physical-device/);
 // All numbers and artifacts in this test are generated synthetic protocol units.
 // No assertion here represents an actual physical device or provider result.
},'physical-device'));
