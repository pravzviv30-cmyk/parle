/** Word-free paid exposure admission. No quotes/prices/default enablement invented. */
import { boundedFetchJson } from './boundedFetch.ts';
export const PAID_ACTIVITIES=['lesson','lesson-text','convo','convo-text','practice','api-transcribe','api-score','api-judge','api-fix-observer','api-fix-judge','phrase-audio','operator-warm','operator-eval'] as const;
export type PaidActivity=typeof PAID_ACTIVITIES[number];
export const PAID_PROVIDERS=['anthropic','openai','groq','deepgram','elevenlabs','fish','toneperfect','speechace','typesafe'] as const;
export type PaidProvider=typeof PAID_PROVIDERS[number];
export type PaidKind='llm'|'stt'|'tts'|'scoring'|'observer';
export interface PaidQuantities {inputBytes:number;outputTokens:number;audioMillis:number;textBytes:number}
export interface PaidComponent {
 key:string;kind:PaidKind;provider:PaidProvider;model:string;voice:string;configurationSha256:string;
 maxEffects:number;maxProviderAttempts:number;maxInputBytes:number;maxOutputTokens:number;maxAudioMillis:number;maxTextBytes:number;microUsd:number;
}
export interface PaidQuoteBinding {quoteId:string;configurationSha256:string;kinds?:readonly PaidKind[]}
export const PAID_KINDS:readonly PaidKind[]=['llm','observer','scoring','stt','tts'];
/** Optional binding kinds: non-empty, sorted, unique known kinds. Lets startup see the quote shape (F863). */
export const validBindingKinds=(kinds:unknown):kinds is readonly PaidKind[]=>Array.isArray(kinds) && kinds.length>0 && kinds.every((k,i)=>typeof k==='string' && PAID_KINDS.includes(k as PaidKind) && (i===0 || kinds[i-1]<k));
export type PaidContext={kind:'api';authSessionId:string;operationId:string}|{kind:'tutor';sessionId:string;claimNonce?:string}|{kind:'practice';packId:string;leaseToken:string};
export type PaidRpc=(name:'reserve_paid_operation_v1'|'claim_paid_effect_v1'|'resume_paid_tutor_v1'|'paid_admission_schema_v1',args:Record<string,unknown>,signal?:AbortSignal)=>Promise<unknown>;
export class PaidAdmissionError extends Error {
 readonly reason:string;
 constructor(reason='admission-unavailable'){super('paid-operation-unavailable');this.name='PaidAdmissionError';this.reason=reason;}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,HASH=/^[0-9a-f]{64}$/;
const MAX={maxEffects:1024,maxProviderAttempts:16,maxInputBytes:2097152,maxOutputTokens:100000,maxAudioMillis:900000,maxTextBytes:262144,microUsd:1000000000000};
const row=(value:unknown):Record<string,unknown>=>{if(!value || typeof value!=='object' || Array.isArray(value))throw new PaidAdmissionError('invalid-contract');return value as Record<string,unknown>;};
const exact=(value:Record<string,unknown>,keys:readonly string[])=>{if(Object.keys(value).length!==keys.length || !keys.every(k=>Object.hasOwn(value,k)))throw new PaidAdmissionError('invalid-contract');};
const integer=(value:unknown,min:number,max:number):value is number=>Number.isSafeInteger(value) && Number(value)>=min && Number(value)<=max;
export function decodePaidComponent(value:unknown):PaidComponent {
 const c=row(value);exact(c,['key','kind','provider','model','voice','configurationSha256',...Object.keys(MAX)]);
 if(typeof c.key!=='string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(c.key) || typeof c.kind!=='string' || !['llm','stt','tts','scoring','observer'].includes(c.kind)
  || !PAID_PROVIDERS.includes(c.provider as PaidProvider) || typeof c.model!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(c.model)
  || typeof c.voice!=='string' || c.voice.length>128 || typeof c.configurationSha256!=='string' || !HASH.test(c.configurationSha256))throw new PaidAdmissionError('invalid-component');
 for(const [name,max] of Object.entries(MAX))if(!integer(c[name],['maxEffects','maxProviderAttempts','microUsd'].includes(name)?1:0,max))throw new PaidAdmissionError('invalid-component');
 const component=c as unknown as PaidComponent;
 if((['llm','observer'].includes(component.kind) && (!component.maxInputBytes || !component.maxOutputTokens || component.maxAudioMillis!==0 || component.maxTextBytes!==0 || component.voice!==''))
  ||(component.kind==='stt' && (!component.maxAudioMillis || component.maxOutputTokens!==0 || component.maxTextBytes!==0 || component.voice!==''))
  ||(component.kind==='tts' && (!component.maxTextBytes || !component.voice || component.maxInputBytes!==0 || component.maxOutputTokens!==0 || component.maxAudioMillis!==0))
  ||(component.kind==='scoring' && (!component.maxAudioMillis || !component.maxTextBytes || component.maxOutputTokens!==0 || component.voice!=='')))throw new PaidAdmissionError('invalid-dimensions');
 return Object.freeze({...component});
}
function context(value:PaidContext,dispatch:boolean,operationId:string):PaidContext {
 const p=row(value);let keys:string[];
 if(p.kind==='api')keys=['kind','authSessionId','operationId'];
 else if(p.kind==='practice')keys=['kind','packId','leaseToken'];
 else if(p.kind==='tutor')keys=dispatch?['kind','sessionId','claimNonce']:['kind','sessionId'];
 else throw new PaidAdmissionError('invalid-context');
 exact(p,keys);for(const key of keys.filter(k=>k!=='kind'))if(typeof p[key]!=='string' || !UUID.test(p[key] as string))throw new PaidAdmissionError('invalid-context');
 if(p.kind==='api' && p.operationId!==operationId)throw new PaidAdmissionError('invalid-context');
 return Object.freeze({...p}) as PaidContext;
}
const KNOWN_REASONS=new Set(['inactive-owner','quote-mismatch','inactive-context','admission-disabled','quote-disabled','context-already-reserved','global-budget','account-budget','vendor-budget','not-reserved','vendor-disabled','quantity-limit','effect-limit','global-execution-budget','account-execution-budget','vendor-execution-budget']);
function refusal(value:Record<string,unknown>):void {if(value.kind==='refused')throw new PaidAdmissionError(KNOWN_REASONS.has(String(value.reason))?String(value.reason):'admission-unavailable');}
export interface ReservePaidRequest {userId:string;operationId:string;activity:PaidActivity;context:PaidContext;requestDigest:string;signal?:AbortSignal}
export interface ClaimPaidRequest {
 effectId:string;componentKey:string;provider:PaidProvider;model:string;voice:string;configurationSha256:string;
 maxProviderAttempts:number;quantities:PaidQuantities;context:PaidContext;signal?:AbortSignal;
}
export interface ResumePaidTutorRequest {userId:string;sessionId:string;claimNonce:string;signal?:AbortSignal}
export interface PaidPermit {readonly dispatchUntil:number;run<T>(effect:()=>Promise<T>):Promise<T>}
export interface PaidReservation {
 readonly operationId:string;readonly quoteId:string;readonly activity:PaidActivity;readonly requestDigest:string;
 readonly configurationSha256:string;readonly expiresAt:number;readonly components:readonly PaidComponent[];
 claim(request:ClaimPaidRequest):Promise<PaidPermit>;
}
/** The caller must pass the ACTUAL configured provider/model/voice/retry settings,
 * actual serialized input bytes and enforced output/audio/text maxima. This helper
 * cannot inspect SDK internals; unsupported/unchecked adapters must remain OFF.
 */
export function paidAdmission(options:{rpc:PaidRpc;bindings:Partial<Record<PaidActivity,PaidQuoteBinding>>;now?:()=>number}) {
 const bindings=structuredClone(options.bindings),now=options.now??Date.now;
 async function invoke(name:Parameters<PaidRpc>[0],args:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>> {
  if(signal?.aborted)throw new PaidAdmissionError();
  let answer:Record<string,unknown>;
  try{answer=row(await options.rpc(name,args,signal));}catch(error){if(error instanceof PaidAdmissionError)throw error;throw new PaidAdmissionError();}
  refusal(answer);return answer;
 }
 function decode(answer:Record<string,unknown>,request:{userId:string;context:PaidContext;signal?:AbortSignal;operationId?:string;activity?:PaidActivity;requestDigest?:string}):PaidReservation {
  const expiry=typeof answer.expiresAt==='string'?Date.parse(answer.expiresAt):NaN;
  if(answer.kind!=='reserved' || answer.version!==1 || typeof answer.operationId!=='string' || !UUID.test(answer.operationId)
   || typeof answer.activity!=='string' || !PAID_ACTIVITIES.includes(answer.activity as PaidActivity)
   || typeof answer.requestDigest!=='string' || !HASH.test(answer.requestDigest)
   || !Array.isArray(answer.components) || answer.components.length<1 || answer.components.length>16 || !Number.isFinite(expiry) || expiry<=now()
   || !integer(answer.microUsd,1,MAX.microUsd) || !integer(answer.providerCalls,1,1024) || typeof answer.replayed!=='boolean'
   || typeof answer.day!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(answer.day))throw new PaidAdmissionError('invalid-reservation');
  const operationId=answer.operationId,activity=answer.activity as PaidActivity,requestDigest=answer.requestDigest,binding=bindings[activity];
  if(!binding || typeof binding.quoteId!=='string' || typeof binding.configurationSha256!=='string' || !UUID.test(binding.quoteId) || !HASH.test(binding.configurationSha256)
   || (binding.kinds!==undefined && !validBindingKinds(binding.kinds))
   || answer.quoteId!==binding.quoteId || answer.configurationSha256!==binding.configurationSha256
   || (request.operationId!==undefined && request.operationId!==operationId) || (request.activity!==undefined && request.activity!==activity)
   || (request.requestDigest!==undefined && request.requestDigest!==requestDigest))throw new PaidAdmissionError('quote-mismatch');
  const original=context(request.context,false,operationId),components=Object.freeze(answer.components.map(decodePaidComponent));
  if(new Set(components.map(c=>c.key)).size!==components.length || components.reduce((n,c)=>n+c.microUsd,0)!==answer.microUsd
   || components.reduce((n,c)=>n+c.maxEffects*c.maxProviderAttempts,0)!==answer.providerCalls)throw new PaidAdmissionError('invalid-reservation');
  const reservedKinds=[...new Set(components.map(c=>c.kind))].sort();
  if(binding.kinds && JSON.stringify(reservedKinds)!==JSON.stringify(binding.kinds)){console.warn('[paid] binding kinds differ from the reserved quote',{activity,declared:binding.kinds.join(','),reserved:reservedKinds.join(',')});throw new PaidAdmissionError('quote-mismatch');}
  const allowedKinds:Partial<Record<PaidActivity,readonly PaidKind[]>>={'lesson-text':['llm'],'convo-text':['llm'],practice:['llm'],'api-judge':['llm'],'api-fix-judge':['llm'],'api-transcribe':['stt'],'api-score':['scoring'],'api-fix-observer':['observer'],'phrase-audio':['tts']};
  if(allowedKinds[activity] && components.some(c=>!allowedKinds[activity]!.includes(c.kind)))throw new PaidAdmissionError('invalid-reservation');
  if(['lesson','convo'].includes(activity) && ['llm','stt','tts'].some(kind=>!components.some(c=>c.kind===kind)))throw new PaidAdmissionError('invalid-reservation');
  return Object.freeze({operationId,quoteId:binding.quoteId,activity,requestDigest,configurationSha256:binding.configurationSha256,expiresAt:expiry,components,
   async claim(claim:ClaimPaidRequest):Promise<PaidPermit> {
    if(request.signal?.aborted || claim.signal?.aborted || now()>=expiry || !UUID.test(claim.effectId))throw new PaidAdmissionError();
    const component=components.find(c=>c.key===claim.componentKey);
    if(!component || claim.provider!==component.provider || claim.model!==component.model || claim.voice!==component.voice || claim.configurationSha256!==component.configurationSha256 || claim.maxProviderAttempts!==component.maxProviderAttempts)throw new PaidAdmissionError('quote-mismatch');
    const quantities=row(claim.quantities);exact(quantities,['inputBytes','outputTokens','audioMillis','textBytes']);
    for(const [key,limit] of [['inputBytes',component.maxInputBytes],['outputTokens',component.maxOutputTokens],['audioMillis',component.maxAudioMillis],['textBytes',component.maxTextBytes]] as const)if(!integer(quantities[key],limit>0?1:0,limit))throw new PaidAdmissionError('quantity-limit');
    const live=context(claim.context,true,operationId),normalized={...live} as Record<string,unknown>;delete normalized.claimNonce;
    if(JSON.stringify(Object.entries(normalized).sort())!==JSON.stringify(Object.entries(original).sort()))throw new PaidAdmissionError('invalid-context');
    const claimed=await invoke('claim_paid_effect_v1',{p_user_id:request.userId,p_operation_id:operationId,p_effect_id:claim.effectId,p_component_key:claim.componentKey,p_configuration_sha256:claim.configurationSha256,p_quantities:quantities,p_max_provider_attempts:claim.maxProviderAttempts,p_context:live},claim.signal);
    if(claimed.kind!=='claimed' || claimed.version!==1 || claimed.operationId!==operationId || claimed.effectId!==claim.effectId || claimed.componentKey!==claim.componentKey || typeof claimed.dispatch!=='boolean')throw new PaidAdmissionError('invalid-claim');
    if(!claimed.dispatch)throw new PaidAdmissionError('already-dispatched');
    const dispatchUntil=typeof claimed.dispatchUntil==='string'?Date.parse(claimed.dispatchUntil):NaN;
    const dayEnd=typeof claimed.executionDay==='string' && /^\d{4}-\d{2}-\d{2}$/.test(claimed.executionDay)?Date.parse(`${claimed.executionDay}T00:00:00Z`)+86400000:NaN;
    if(!Number.isFinite(dispatchUntil) || !Number.isFinite(dayEnd) || dispatchUntil<=now() || dispatchUntil>expiry || dispatchUntil>dayEnd
     || !integer(claimed.executionMicroUsdCharged,0,component.microUsd) || ![0,component.microUsd].includes(Number(claimed.executionMicroUsdCharged))
     || claimed.executionProviderCalls!==component.maxProviderAttempts)throw new PaidAdmissionError('invalid-claim');
    let used=false;
    return Object.freeze({dispatchUntil,async run<T>(effect:()=>Promise<T>):Promise<T>{
     if(used || request.signal?.aborted || claim.signal?.aborted || now()>=dispatchUntil)throw new PaidAdmissionError('already-dispatched');
     used=true;return effect();
    }});
   }});
 }
 return {
  async reserve(request:ReservePaidRequest):Promise<PaidReservation> {
   if(typeof request.userId!=='string' || !UUID.test(request.userId) || typeof request.operationId!=='string' || !UUID.test(request.operationId)
    || typeof request.requestDigest!=='string' || !HASH.test(request.requestDigest) || !PAID_ACTIVITIES.includes(request.activity))throw new PaidAdmissionError('invalid-request');
   const binding=bindings[request.activity];if(!binding || typeof binding.quoteId!=='string' || typeof binding.configurationSha256!=='string' || !UUID.test(binding.quoteId) || !HASH.test(binding.configurationSha256) || (binding.kinds!==undefined && !validBindingKinds(binding.kinds)))throw new PaidAdmissionError('quote-mismatch');
   const original=context(request.context,false,request.operationId);
   const answer=await invoke('reserve_paid_operation_v1',{p_user_id:request.userId,p_operation_id:request.operationId,p_quote_id:binding.quoteId,p_configuration_sha256:binding.configurationSha256,p_context:original,p_request_digest:request.requestDigest},request.signal);
   return decode(answer,request);
  },
  async resume(request:ResumePaidTutorRequest):Promise<PaidReservation> {
   for(const value of [request.userId,request.sessionId,request.claimNonce])if(typeof value!=='string' || !UUID.test(value))throw new PaidAdmissionError('invalid-request');
   const answer=await invoke('resume_paid_tutor_v1',{p_user_id:request.userId,p_session_id:request.sessionId,p_claim_nonce:request.claimNonce},request.signal);
   if(typeof answer.activity!=='string' || !['lesson','lesson-text','convo','convo-text'].includes(answer.activity) || answer.replayed!==true)throw new PaidAdmissionError('invalid-reservation');
   return decode(answer,{userId:request.userId,context:{kind:'tutor',sessionId:request.sessionId},...(request.signal?{signal:request.signal}:{})});
  },
 };
}
/** Service-side adapter only. Tutor must use the protected API bridge, never a DB key.
 * No automatic RPC retries. A transport timeout leaves exposure/dispatch uncertain.
 */
export function paidAdmissionRpc(baseUrl:string,key:string,request:typeof fetch=fetch):PaidRpc {
 const url=new URL(baseUrl);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || !key.trim())throw new PaidAdmissionError();
 return async(name,args,signal)=>{
  if(!['reserve_paid_operation_v1','claim_paid_effect_v1','resume_paid_tutor_v1','paid_admission_schema_v1'].includes(name))throw new PaidAdmissionError();
  try {
   const result=await boundedFetchJson(request,`${baseUrl.replace(/\/+$/,'')}/rest/v1/rpc/${name}`,{method:'POST',redirect:'error',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(args)},{timeoutMs:5000,maxBytes:32768,...(signal?{signal}:{})});
   if(result.status<200 || result.status>=300)throw new PaidAdmissionError();return result.value;
  }catch{throw new PaidAdmissionError();}
 };
}
