/** Read-only owner contract validator. Does not apply SQL or invent prices. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePaidComponent,PAID_ACTIVITIES,PAID_PROVIDERS} from '../services/shared/paidAdmission.ts';
const HASH=/^[0-9a-f]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))throw new Error('invalid paid owner contract shape');};
function review(p,now){
 exact(p,['reviewedBy','evidenceUrl','evidenceSha256','expiresAt']);
 if(['reviewedBy','evidenceUrl','evidenceSha256','expiresAt'].some(k=>typeof p[k]!=='string'))throw new Error('current reviewed paid evidence required');
 let u;try{u=new URL(p.evidenceUrl);}catch{throw new Error('current reviewed paid evidence required');}
 const expiry=Date.parse(p.expiresAt);
 if(typeof p.reviewedBy!=='string'||p.reviewedBy.trim().length<3||p.reviewedBy.length>200||u.protocol!=='https:'||u.username||u.password||p.evidenceUrl.length>2048||!HASH.test(p.evidenceSha256??'')||p.evidenceSha256===p.evidenceSha256[0].repeat(64)||!Number.isFinite(expiry)||expiry<=now||expiry>now+7*86400000)throw new Error('current reviewed paid evidence required');
}
export function validatePaidBudgetContract(p,{now=Date.now()}={}){
 exact(p,['version','enabled','budgets','tutor','review','vendors','quotes','bindings','notes']);
 if(p.version!==1||typeof p.enabled!=='boolean'||!Array.isArray(p.notes)||!p.notes.every(n=>typeof n==='string')||p.notes.length>32)throw new Error('invalid paid contract version');
 const budgetNames=['globalDailyMicroUsd','accountDailyMicroUsd','globalDailyOperations','accountDailyOperations','globalDailyCalls','accountDailyCalls'];exact(p.budgets,budgetNames);
 for(const key of budgetNames)if(!integer(p.budgets[key],p.enabled?1:0,key.endsWith('MicroUsd')?1000000000000:1000000))throw new Error('finite paid budgets required');
 exact(p.tutor,['accountDailySessions','accountDailySeconds']);if(!integer(p.tutor.accountDailySessions,0,1000)||!integer(p.tutor.accountDailySeconds,0,900000))throw new Error('finite owner tutor caps required');
 if(p.enabled)review(p.review,now);else if(p.review!==null)review(p.review,now);
 if(!Array.isArray(p.vendors)||p.vendors.length>PAID_PROVIDERS.length||new Set(p.vendors.map(v=>v.provider)).size!==p.vendors.length)throw new Error('finite distinct vendor caps required');
 for(const v of p.vendors){exact(v,['provider','enabled','dailyMicroUsd','dailyOperations','dailyCalls']);if(!PAID_PROVIDERS.includes(v.provider)||typeof v.enabled!=='boolean'||!integer(v.dailyMicroUsd,v.enabled?1:0,1000000000000)||!integer(v.dailyOperations,v.enabled?1:0,1000000)||!integer(v.dailyCalls,v.enabled?1:0,1000000))throw new Error('invalid paid vendor cap');}
 if(!Array.isArray(p.quotes)||p.quotes.length>64||new Set(p.quotes.map(q=>q.id)).size!==p.quotes.length)throw new Error('finite distinct quote set required');
 for(const q of p.quotes){
  exact(q,['id','enabled','definition']);if(typeof q.id!=='string'||!UUID.test(q.id)||typeof q.enabled!=='boolean')throw new Error('invalid quote revision');
  const d=q.definition;exact(d,['activity','components','configurationSha256','reviewedBy','evidenceUrl','evidenceSha256','expiresAt']);
  if(!PAID_ACTIVITIES.includes(d.activity)||(typeof d.configurationSha256!=='string'||!HASH.test(d.configurationSha256))||!Array.isArray(d.components)||d.components.length<1||d.components.length>16||Buffer.byteLength(JSON.stringify(d))>32768)throw new Error('invalid paid quote');
  review({reviewedBy:d.reviewedBy,evidenceUrl:d.evidenceUrl,evidenceSha256:d.evidenceSha256,expiresAt:d.expiresAt},now);
  const components=d.components.map(decodePaidComponent);
  if(new Set(components.map(c=>c.key)).size!==components.length||components.reduce((n,c)=>n+c.microUsd,0)>1000000000000||components.reduce((n,c)=>n+c.maxEffects*c.maxProviderAttempts,0)>1024)throw new Error('paid quote envelope exceeds supported bounds');
  if(q.enabled&&components.some(c=>!p.vendors.some(v=>v.provider===c.provider&&v.enabled)))throw new Error('quote names disabled/missing vendor');
  const allowed={'lesson-text':['llm'],'convo-text':['llm'],practice:['llm'],'api-judge':['llm'],'api-fix-judge':['llm'],'api-transcribe':['stt'],'api-score':['scoring'],'api-fix-observer':['observer'],'phrase-audio':['tts']}[d.activity];
  if((allowed&&components.some(c=>!allowed.includes(c.kind)))||(['lesson','convo'].includes(d.activity)&&['llm','stt','tts'].some(k=>!components.some(c=>c.kind===k))))throw new Error('paid activity component mismatch');
  if(q.enabled&&['lesson','lesson-text','convo','convo-text'].includes(d.activity)&&(!p.tutor.accountDailySessions||!p.tutor.accountDailySeconds))throw new Error('enabled tutor quote requires owner session caps');
 }
 if(!p.bindings||typeof p.bindings!=='object'||Array.isArray(p.bindings)||Object.keys(p.bindings).length>PAID_ACTIVITIES.length)throw new Error('invalid quote binding map');
 for(const [activity,b]of Object.entries(p.bindings)){exact(b,['quoteId','configurationSha256']);if(!PAID_ACTIVITIES.includes(activity)||typeof b.quoteId!=='string'||!UUID.test(b.quoteId)||typeof b.configurationSha256!=='string'||!HASH.test(b.configurationSha256)||!p.quotes.some(q=>q.enabled&&q.id===b.quoteId&&q.definition.activity===activity&&q.definition.configurationSha256===b.configurationSha256))throw new Error('exact reviewed quote binding required');}
 if(p.enabled&&Object.keys(p.bindings).length===0)throw new Error('enabled paid contract requires explicit activity bindings');
 return {version:1,enabled:p.enabled,activityCount:Object.keys(p.bindings).length,quoteCount:p.quotes.length,applied:false,pricesVerified:false,runtimeEnvelopeVerified:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==3)throw new Error('Usage: node --experimental-strip-types deployment/validatePaidBudget.mjs FILE.json');const bytes=await readFile(resolve(process.argv[2]));if(bytes.length>1024*1024)throw new Error('paid owner contract exceeds1MiB');console.log(JSON.stringify(validatePaidBudgetContract(JSON.parse(bytes.toString('utf8')))));}catch(error){console.error(error.message);process.exitCode=1;}
}
