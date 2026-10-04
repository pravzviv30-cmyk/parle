/** Offline integrity/acceptance of externally captured tests. Never calls devices/providers. */
import {readFile,stat}from 'node:fs/promises';
import {resolve,isAbsolute}from 'node:path';
import {fileURLToPath}from 'node:url';
import {createHash}from 'node:crypto';
export const VOICE_SCENARIOS=Object.freeze(['accented-fr','noisy-accented-fr','reconnect','background-resume','typed-fallback','safety-expected','unsafe-canary','failed-session-refund','practice-baseline-preserved']);
export const ACCENT_CLASSES=Object.freeze(['fr-native','fr-ca','learner-accent']);
const MAX_AGE=7*86400000,MAX_FILE=50*1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&!/^([a-f0-9])\1{63}$/.test(v);
const git=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)&&!/^([a-f0-9])\1{39}$/.test(v);
const tag=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{2,63}$/.test(v);
const text=v=>typeof v==='string'&&v.trim().length>=1&&v.length<=128&&!/[\r\n]/.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const ratio=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const fail=code=>{throw new Error(`voice-acceptance-refused:${code}`);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))fail('shape');};
function artifact(v,synthetic){
 exact(v,['url','sha256','artifactPath']);let u;try{u=new URL(v.url);}catch{fail('evidence-url');}
 if(typeof v.url!=='string'||u.protocol!=='https:'||u.username||u.password||u.hash||(!synthetic&&/(?:^|\.)(?:test|invalid|example\.com|example\.org|example\.net)$/.test(u.hostname))||!sha(v.sha256)||typeof v.artifactPath!=='string'||!isAbsolute(v.artifactPath))fail('evidence-artifact');
}
function review(v,subject,synthetic,now){
 exact(v,['reviewedBy','reviewedAt','expiresAt','subjectSha256','evidence']);artifact(v.evidence,synthetic);
 const at=typeof v.reviewedAt==='string'?Date.parse(v.reviewedAt):NaN,expiry=typeof v.expiresAt==='string'?Date.parse(v.expiresAt):NaN;
 if(!text(v.reviewedBy)||v.reviewedBy.trim().length<3||!Number.isFinite(at)||!Number.isFinite(expiry)||at>now+60000||now-at>MAX_AGE||expiry<=now||expiry<=at||expiry-at>MAX_AGE||v.subjectSha256!==subject)fail('review');
}
export const voiceCaptureIdentity=v=>{const {reviews,...body}=v;return hash(canonical(body));};
export const voicePolicyIdentity=v=>{const {review,...body}=v;return hash(canonical(body));};
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];};
export function validateVoiceAcceptance(v,expected,{now=Date.now()}={}){
 exact(v,['version','captureKind','capturedAt','release','corpus','configuration','devices','policy','cases','evidence','reviews']);
 if(v.version!==1||!['synthetic','physical-device'].includes(v.captureKind))fail('version-kind');
 const synthetic=v.captureKind==='synthetic',captured=typeof v.capturedAt==='string'?Date.parse(v.capturedAt):NaN;
 if(!Number.isFinite(captured)||captured>now+60000||now-captured>MAX_AGE)fail('stale-capture');
 exact(v.release,['releaseSha256','gitSha','image','schemaSha256']);
 if(!sha(v.release.releaseSha256)||!git(v.release.gitSha)||!sha(v.release.schemaSha256)||typeof v.release.image!=='string'||!/^\S+@sha256:[a-f0-9]{64}$/.test(v.release.image)||!sha(v.release.image.split('@sha256:')[1])||canonical(v.release)!==canonical(expected))fail('release-binding');
 exact(v.corpus,['sha256','locale','rubricSha256','consentSha256','fixtures']);
 if(!sha(v.corpus.sha256)||!sha(v.corpus.rubricSha256)||!sha(v.corpus.consentSha256)||v.corpus.locale!=='fr'||!Array.isArray(v.corpus.fixtures)||v.corpus.fixtures.length<6||v.corpus.fixtures.length>1000)fail('corpus');
 const fixtures=new Map();for(const f of v.corpus.fixtures){exact(f,['id','accentClass','sourceSha256']);if(!tag(f.id)||fixtures.has(f.id)||!ACCENT_CLASSES.includes(f.accentClass)||!sha(f.sourceSha256))fail('fixture');fixtures.set(f.id,f);}
 for(const accent of ACCENT_CLASSES)if([...fixtures.values()].filter(f=>f.accentClass===accent).length<2)fail('accent-corpus-coverage');
 exact(v.configuration,['sha256','models']);if(!sha(v.configuration.sha256)||!Array.isArray(v.configuration.models)||v.configuration.models.length<1||v.configuration.models.length>16)fail('configuration');
 const models=new Set();for(const model of v.configuration.models){exact(model,['provider','model','voice','configurationSha256']);if(!tag(model.provider)||!text(model.model)||typeof model.voice!=='string'||model.voice.length>128||!sha(model.configurationSha256)||models.has(canonical(model)))fail('model-configuration');models.add(canonical(model));}
 if(!Array.isArray(v.devices)||v.devices.length<2||v.devices.length>20)fail('devices');const devices=new Map();
 for(const d of v.devices){exact(d,['id','platform','physical','model','osVersion','buildSha256']);if(!tag(d.id)||devices.has(d.id)||!['ios','android'].includes(d.platform)||typeof d.physical!=='boolean'||(!synthetic&&!d.physical)||!text(d.model)||!text(d.osVersion)||!sha(d.buildSha256))fail('physical-device');devices.set(d.id,d);}
 for(const platform of ['ios','android'])if(![...devices.values()].some(d=>d.platform===platform))fail('platform-coverage');
 exact(v.policy,['minCasesPerPlatform','minVoiceCasesPerPlatform','minAccentCasesPerPlatform','maxP50TurnMillis','maxP95TurnMillis','maxP50CostMicroUsd','maxP95CostMicroUsd','minTranscriptAccuracy','minLearningScore','minTaskSuccessRatio','review']);
 if(!integer(v.policy.minCasesPerPlatform,20,10000)||!integer(v.policy.minVoiceCasesPerPlatform,10,10000)||!integer(v.policy.minAccentCasesPerPlatform,2,1000)||v.policy.minCasesPerPlatform<v.policy.minVoiceCasesPerPlatform||['maxP50TurnMillis','maxP95TurnMillis'].some(k=>!integer(v.policy[k],1,900000))||['maxP50CostMicroUsd','maxP95CostMicroUsd'].some(k=>!integer(v.policy[k],1,1000000000000))||v.policy.maxP50TurnMillis>v.policy.maxP95TurnMillis||v.policy.maxP50CostMicroUsd>v.policy.maxP95CostMicroUsd||['minTranscriptAccuracy','minLearningScore','minTaskSuccessRatio'].some(k=>!ratio(v.policy[k])||v.policy[k]<=0))fail('reviewed-policy');
 review(v.policy.review,voicePolicyIdentity(v.policy),synthetic,now);
 if(!Array.isArray(v.evidence)||v.evidence.length<1||v.evidence.length>4096)fail('evidence-inventory');const evidence=new Map();
 for(const e of v.evidence){artifact(e,synthetic);if(evidence.has(e.sha256))fail('duplicate-evidence');evidence.set(e.sha256,e);}
 for(const ref of [v.corpus.sha256,v.corpus.rubricSha256,v.corpus.consentSha256,v.configuration.sha256,...[...fixtures.values()].map(f=>f.sourceSha256),...[...devices.values()].map(d=>d.buildSha256)])if(!evidence.has(ref))fail('unhashed-source-evidence');
 if(!Array.isArray(v.cases)||v.cases.length<40||v.cases.length>20000)fail('case-count');const ids=new Set();
 for(const c of v.cases){
  exact(c,['id','deviceId','fixtureId','scenario','mode','configurationSha256','measurements','assertions','evidenceSha256']);
  if(!tag(c.id)||ids.has(c.id)||!devices.has(c.deviceId)||!fixtures.has(c.fixtureId)||!VOICE_SCENARIOS.includes(c.scenario)||!['voice','typed'].includes(c.mode)||c.configurationSha256!==v.configuration.sha256||!sha(c.evidenceSha256)||!evidence.has(c.evidenceSha256))fail('case-binding');ids.add(c.id);
  exact(c.measurements,['turnMillis','costMicroUsd','providerAttempts','transcriptAccuracy','learningScore']);
  if(!integer(c.measurements.turnMillis,0,900000)||!integer(c.measurements.costMicroUsd,0,1000000000000)||!integer(c.measurements.providerAttempts,0,1024)||!ratio(c.measurements.transcriptAccuracy)||!ratio(c.measurements.learningScore))fail('measurements');
  exact(c.assertions,['taskSuccess','safetyExpected','canaryBlocked','unusedRefundCorrect','practiceBaselinePreserved']);if(Object.values(c.assertions).some(x=>typeof x!=='boolean'))fail('assertions');
  if((['reconnect','background-resume','typed-fallback','safety-expected','practice-baseline-preserved'].includes(c.scenario)&&!c.assertions.taskSuccess)||(c.scenario==='typed-fallback'&&c.mode!=='typed')||(['accented-fr','noisy-accented-fr'].includes(c.scenario)&&c.mode!=='voice')||!c.assertions.safetyExpected||(c.scenario==='unsafe-canary'&&(!c.assertions.canaryBlocked||c.measurements.costMicroUsd!==0||c.measurements.providerAttempts!==0))||(c.scenario==='failed-session-refund'&&!c.assertions.unusedRefundCorrect)||(c.scenario==='practice-baseline-preserved'&&!c.assertions.practiceBaselinePreserved))fail('safety-refund-preservation');
 }
 const platforms={};for(const platform of ['ios','android']){
  const cases=v.cases.filter(c=>devices.get(c.deviceId).platform===platform),voice=cases.filter(c=>['accented-fr','noisy-accented-fr'].includes(c.scenario)&&c.mode==='voice');
  if(cases.length<v.policy.minCasesPerPlatform||voice.length<v.policy.minVoiceCasesPerPlatform||VOICE_SCENARIOS.some(s=>!cases.some(c=>c.scenario===s)))fail('scenario-platform-coverage');
  for(const accent of ACCENT_CLASSES)if(voice.filter(c=>fixtures.get(c.fixtureId).accentClass===accent).length<v.policy.minAccentCasesPerPlatform)fail('accent-platform-coverage');
  const stats={cases:cases.length,voiceCases:voice.length,p50TurnMillis:percentile(voice.map(c=>c.measurements.turnMillis),.5),p95TurnMillis:percentile(voice.map(c=>c.measurements.turnMillis),.95),p50CostMicroUsd:percentile(voice.map(c=>c.measurements.costMicroUsd),.5),p95CostMicroUsd:percentile(voice.map(c=>c.measurements.costMicroUsd),.95),transcriptAccuracy:voice.reduce((n,c)=>n+c.measurements.transcriptAccuracy,0)/voice.length,learningScore:voice.reduce((n,c)=>n+c.measurements.learningScore,0)/voice.length,taskSuccessRatio:voice.filter(c=>c.assertions.taskSuccess).length/voice.length};
  if(stats.p50TurnMillis>v.policy.maxP50TurnMillis||stats.p95TurnMillis>v.policy.maxP95TurnMillis||stats.p50CostMicroUsd>v.policy.maxP50CostMicroUsd||stats.p95CostMicroUsd>v.policy.maxP95CostMicroUsd||stats.transcriptAccuracy<v.policy.minTranscriptAccuracy||stats.learningScore<v.policy.minLearningScore||stats.taskSuccessRatio<v.policy.minTaskSuccessRatio)fail('reviewed-threshold-exceeded');
  platforms[platform]=stats;
 }
 if(!Array.isArray(v.reviews)||v.reviews.length!==2)fail('two-independent-reviews');const reviewers=new Set();for(const r of v.reviews){review(r,voiceCaptureIdentity(v),synthetic,now);reviewers.add(r.reviewedBy.trim().toLowerCase());}if(reviewers.size!==2)fail('independent-reviewers');
 return {version:1,captureSha256:voiceCaptureIdentity(v),releaseSha256:v.release.releaseSha256,captureKind:v.captureKind,schemaValidated:true,localIntegrityVerified:false,reviewedCaptureAccepted:false,independentlyMeasured:false,platforms};
}
async function verifyFile(e,maxBytes=MAX_FILE){const info=await stat(e.artifactPath);if(!info.isFile()||info.size<1||info.size>maxBytes)fail('artifact-size');const bytes=await readFile(e.artifactPath);if(hash(bytes)!==e.sha256)fail('artifact-hash');return bytes;}
async function jsonArtifact(e,maxBytes=65536){try{return JSON.parse((await verifyFile(e,maxBytes)).toString('utf8'));}catch(error){if(error.message.startsWith('voice-acceptance-refused:'))throw error;fail('json-capture');}}
async function verifyReview(r){let capture;try{capture=JSON.parse((await verifyFile(r.evidence,65536)).toString('utf8'));}catch{fail('review-capture');}exact(capture,['decision','reviewedBy','reviewedAt','expiresAt','subjectSha256']);if(capture.decision!=='approved'||['reviewedBy','reviewedAt','expiresAt','subjectSha256'].some(k=>capture[k]!==r[k]))fail('review-capture');}
/** Hashes actual local artifact copies. External reviewers attest source/device authenticity. */
export async function verifyVoiceAcceptanceArtifacts(v,expected,options={}){
 const report=validateVoiceAcceptance(v,expected,options);for(const e of v.evidence)await verifyFile(e);await verifyReview(v.policy.review);for(const r of v.reviews)await verifyReview(r);
 const find=ref=>v.evidence.find(e=>e.sha256===ref);
 const corpus=await jsonArtifact(find(v.corpus.sha256));exact(corpus,['version','locale','fixtures']);
 if(corpus.version!==1||corpus.locale!=='fr'||canonical(corpus.fixtures)!==canonical(v.corpus.fixtures))fail('corpus-capture');
 const configuration=await jsonArtifact(find(v.configuration.sha256));exact(configuration,['version','models']);
 if(configuration.version!==1||canonical(configuration.models)!==canonical(v.configuration.models))fail('configuration-capture');
 const rubric=await jsonArtifact(find(v.corpus.rubricSha256));exact(rubric,['version','rubricId','transcriptMetric','learningMetric','taskSuccessMetric','reviewedBy']);
 if(rubric.version!==1||['rubricId','transcriptMetric','learningMetric','taskSuccessMetric','reviewedBy'].some(k=>!text(rubric[k])))fail('rubric-capture');
 for(const d of v.devices){
  const build=await jsonArtifact(find(d.buildSha256));exact(build,['version','platform','gitSha','artifactSha256','artifactUrl']);
  let url;try{url=new URL(build.artifactUrl);}catch{fail('build-capture');}
  if(build.version!==1||build.platform!==d.platform||build.gitSha!==v.release.gitSha||!sha(build.artifactSha256)||url.protocol!=='https:'||url.username||url.password)fail('build-capture');
 }
 for(const c of v.cases){
  const trace=await jsonArtifact(find(c.evidenceSha256));
  exact(trace,['version','caseId','deviceId','fixtureId','scenario','mode','release','configurationSha256','deviceBuildSha256','physical','recordedAt','measurements','assertions']);
  const recorded=typeof trace.recordedAt==='string'?Date.parse(trace.recordedAt):NaN;
  if(trace.version!==1||trace.caseId!==c.id||trace.deviceId!==c.deviceId||trace.fixtureId!==c.fixtureId||trace.scenario!==c.scenario||trace.mode!==c.mode||canonical(trace.release)!==canonical(v.release)||trace.configurationSha256!==c.configurationSha256||trace.deviceBuildSha256!==v.devices.find(d=>d.id===c.deviceId).buildSha256||trace.physical!==(v.captureKind==='physical-device')||!Number.isFinite(recorded)||recorded>Date.parse(v.capturedAt)+60000||Date.parse(v.capturedAt)-recorded>MAX_AGE||canonical(trace.measurements)!==canonical(c.measurements)||canonical(trace.assertions)!==canonical(c.assertions))fail('case-capture');
 }
 // Consent must be an explicit accountable source capture, not an unchecked flag.
 let consent;try{consent=JSON.parse((await verifyFile(v.evidence.find(e=>e.sha256===v.corpus.consentSha256),65536)).toString('utf8'));}catch{fail('consent-capture');}
 exact(consent,['version','corpusSha256','consentBasis','reviewedBy','reviewedAt','allowedPurposes']);
 if(consent.version!==1||consent.corpusSha256!==v.corpus.sha256||!['consented-participants','licensed-corpus','synthetic'].includes(consent.consentBasis)||(!['synthetic'].includes(v.captureKind)&&consent.consentBasis==='synthetic')||!text(consent.reviewedBy)||!Number.isFinite(Date.parse(consent.reviewedAt))||!Array.isArray(consent.allowedPurposes)||!consent.allowedPurposes.includes('voice-acceptance'))fail('consent-capture');
 return {...report,localIntegrityVerified:true,reviewedCaptureAccepted:v.captureKind==='physical-device'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==7||process.argv[2]!=='--capture'||process.argv[4]!=='--release'||process.argv[6]!=='--verify')fail('usage');
  const bytes=await readFile(resolve(process.argv[3]));if(bytes.length>1024*1024)fail('manifest-size');const v=JSON.parse(bytes);const expected=JSON.parse(await readFile(resolve(process.argv[5])));
  console.log(JSON.stringify(await verifyVoiceAcceptanceArtifacts(v,expected)));if(v.captureKind==='synthetic')process.exitCode=2;
 }catch(error){console.error(error.message.startsWith('voice-acceptance-refused:')?error.message:'voice-acceptance-refused:unavailable-artifact');process.exitCode=1;}
}
