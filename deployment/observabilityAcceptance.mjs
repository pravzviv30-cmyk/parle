/** Offline reviewed monitoring captures; no notifications, URLs fetched or deployments. */
import {readFile,stat}from 'node:fs/promises';
import {isAbsolute}from 'node:path';
import {createHash}from 'node:crypto';
import {validateObservabilityConfig}from './observability.mjs';
export const MONITOR_ALERTS=Object.freeze(['LuvaniMetricsExporterUnavailable','LuvaniMetricsSourceUnavailable','LuvaniWorkerUnavailable','LuvaniErasureDelayed','LuvaniApiErrorRatioHigh','LuvaniApiLatencyHigh']);
const hash=b=>createHash('sha256').update(b).digest('hex');
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&!/^([a-f0-9])\1{63}$/.test(v);
const tag=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{2,63}$/.test(v);
const fail=reason=>{throw new Error(`monitoring-acceptance-refused:${reason}`);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))fail('shape');};
function artifact(e,synthetic){exact(e,['url','sha256','artifactPath']);let u;try{u=new URL(e.url);}catch{fail('evidence');}if(typeof e.url!=='string'||u.protocol!=='https:'||u.username||u.password||!sha(e.sha256)||typeof e.artifactPath!=='string'||!isAbsolute(e.artifactPath)||(!synthetic&&/(?:^|\.)(?:test|invalid|example\.com|example\.org|example\.net)$/.test(u.hostname)))fail('evidence');}
export const monitoringCaptureIdentity=v=>{const {reviews,...body}=v;return hash(canon(body));};
export function validateMonitoringAcceptance(v,expected,{now=Date.now()}={}){
 exact(v,['version','captureKind','releaseSha256','configSha256','rulesSha256','capturedAt','apiInstance','assignedTeam','maxAckSeconds','promtoolSha256','probes','evidence','reviews']);
 const synthetic=v.captureKind==='synthetic';if(v.version!==1||!['synthetic','operator-capture'].includes(v.captureKind)||['releaseSha256','configSha256','rulesSha256','promtoolSha256'].some(k=>!sha(v[k]))||['releaseSha256','configSha256','rulesSha256'].some(k=>v[k]!==expected[k])||!tag(v.apiInstance)||!tag(v.assignedTeam)||!Number.isSafeInteger(v.maxAckSeconds)||v.maxAckSeconds<1||v.maxAckSeconds>86400)fail('release-routing');
 const at=typeof v.capturedAt==='string'?Date.parse(v.capturedAt):NaN;if(!Number.isFinite(at)||at>now+60000||now-at>7*86400000)fail('stale');
 if(!Array.isArray(v.evidence)||v.evidence.length<9||v.evidence.length>128)fail('evidence');const evidence=new Set();for(const e of v.evidence){artifact(e,synthetic);if(evidence.has(e.sha256))fail('duplicate-evidence');evidence.add(e.sha256);}
 for(const ref of [v.configSha256,v.rulesSha256,v.promtoolSha256])if(!evidence.has(ref))fail('unhashed-capture');
 if(!Array.isArray(v.probes)||v.probes.length!==MONITOR_ALERTS.length||new Set(v.probes.map(p=>p.alertName)).size!==MONITOR_ALERTS.length)fail('probe-inventory');
 for(const p of v.probes){exact(p,['alertName','firedAt','deliveredAt','acknowledgedAt','traceSha256']);const times=['firedAt','deliveredAt','acknowledgedAt'].map(k=>typeof p[k]==='string'?Date.parse(p[k]):NaN);if(!MONITOR_ALERTS.includes(p.alertName)||!sha(p.traceSha256)||!evidence.has(p.traceSha256)||times.some(t=>!Number.isFinite(t))||times[0]>times[1]||times[1]>times[2]||times[2]>at+60000||at-times[0]>7*86400000||times[2]-times[0]>v.maxAckSeconds*1000)fail('probe-delivery-ack');}
 if(!Array.isArray(v.reviews)||v.reviews.length!==2)fail('reviewers');const reviewers=new Set();for(const r of v.reviews){exact(r,['reviewedBy','reviewedAt','expiresAt','subjectSha256','scope','evidence']);artifact(r.evidence,synthetic);const rt=typeof r.reviewedAt==='string'?Date.parse(r.reviewedAt):NaN,expiry=typeof r.expiresAt==='string'?Date.parse(r.expiresAt):NaN;if(typeof r.reviewedBy!=='string'||r.reviewedBy.trim().length<3||r.reviewedBy.length>128||r.subjectSha256!==monitoringCaptureIdentity(v)||r.scope!=='thresholds-routing-oncall'||!Number.isFinite(rt)||!Number.isFinite(expiry)||rt>now+60000||now-rt>7*86400000||expiry<=now||expiry<=rt||expiry-rt>7*86400000)fail('reviewers');reviewers.add(r.reviewedBy.trim().toLowerCase());}if(reviewers.size!==2)fail('reviewers');
 return {version:1,releaseSha256:v.releaseSha256,captureSha256:monitoringCaptureIdentity(v),schemaValidated:true,localIntegrityVerified:false,reviewedCaptureAccepted:false,independentlyDelivered:false,probeCount:v.probes.length};
}
async function bytes(e){const info=await stat(e.artifactPath);if(!info.isFile()||info.size<1||info.size>1024*1024)fail('artifact-size');const value=await readFile(e.artifactPath);if(hash(value)!==e.sha256)fail('artifact-hash');return value;}
async function json(e){try{return JSON.parse((await bytes(e)).toString('utf8'));}catch(error){if(error.message.startsWith('monitoring-acceptance-refused:'))throw error;fail('artifact-json');}}
export async function verifyMonitoringAcceptanceArtifacts(v,expected,options={}){
 const report=validateMonitoringAcceptance(v,expected,options),copies=new Map();for(const e of v.evidence)copies.set(e.sha256,await bytes(e));
 const parse=ref=>{try{return JSON.parse(copies.get(ref).toString('utf8'));}catch{fail('artifact-json');}};
 const config=validateObservabilityConfig(parse(v.configSha256));if(!config.enabled||config.apiInstance!==v.apiInstance)fail('config-capture');
 const rules=copies.get(v.rulesSha256).toString('utf8');if(MONITOR_ALERTS.some(name=>!rules.includes('alert: '+name)))fail('rules-capture');
 const tool=parse(v.promtoolSha256);exact(tool,['version','command','exitCode','rulesSha256','testedAt']);if(tool.version!==1||tool.command!=='promtool check rules'||tool.exitCode!==0||tool.rulesSha256!==v.rulesSha256||typeof tool.testedAt!=='string'||!Number.isFinite(Date.parse(tool.testedAt))||Date.parse(tool.testedAt)>Date.parse(v.capturedAt)+60000||Date.parse(v.capturedAt)-Date.parse(tool.testedAt)>7*86400000)fail('promtool-capture');
 for(const p of v.probes){const trace=parse(p.traceSha256);exact(trace,['version','alertName','releaseSha256','apiInstance','assignedTeam','deliveryId','firedAt','deliveredAt','acknowledgedAt']);if(trace.version!==1||trace.releaseSha256!==v.releaseSha256||trace.apiInstance!==v.apiInstance||trace.assignedTeam!==v.assignedTeam||typeof trace.deliveryId!=='string'||!/^[A-Za-z0-9_-]{3,128}$/.test(trace.deliveryId)||['alertName','firedAt','deliveredAt','acknowledgedAt'].some(k=>trace[k]!==p[k]))fail('receiver-capture');}
 for(const r of v.reviews){const capture=await json(r.evidence);exact(capture,['decision','reviewedBy','reviewedAt','expiresAt','subjectSha256','scope']);if(capture.decision!=='approved'||['reviewedBy','reviewedAt','expiresAt','subjectSha256','scope'].some(k=>capture[k]!==r[k]))fail('review-capture');}
 return {...report,localIntegrityVerified:true,reviewedCaptureAccepted:v.captureKind==='operator-capture'};
}
