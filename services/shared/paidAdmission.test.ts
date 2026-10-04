import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {paidAdmission,paidAdmissionRpc,decodePaidComponent,PaidAdmissionError,type PaidRpc,type PaidComponent,type ReservePaidRequest,type ClaimPaidRequest} from './paidAdmission.ts';
const id=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const now=Date.parse('2026-10-04T12:00:00Z');
const component:PaidComponent={key:'judge',kind:'llm',provider:'openai',model:'offline-fixture-model',voice:'',configurationSha256:hash('component'),maxEffects:2,maxProviderAttempts:2,maxInputBytes:1024,maxOutputTokens:600,maxAudioMillis:0,maxTextBytes:0,microUsd:100};
const reserve:ReservePaidRequest={userId:id(1),operationId:id(2),activity:'api-judge',context:{kind:'api',authSessionId:id(3),operationId:id(2)},requestDigest:hash('request')};
const claim:ClaimPaidRequest={effectId:id(4),componentKey:'judge',provider:'openai',model:component.model,voice:'',configurationSha256:component.configurationSha256,maxProviderAttempts:2,quantities:{inputBytes:512,outputTokens:600,audioMillis:0,textBytes:0},context:reserve.context};
function fixture(options:{dispatch?:boolean;malformed?:boolean;rpc?:PaidRpc}={}){
 const calls:string[]=[];
 const rpc:PaidRpc=options.rpc??(async(name,args)=>{calls.push(name);return name==='reserve_paid_operation_v1'?{kind:'reserved',version:1,operationId:id(2),quoteId:id(5),configurationSha256:hash('config'),activity:'api-judge',requestDigest:hash('request'),components:[component],expiresAt:new Date(now+3600000).toISOString(),day:'2026-10-04',microUsd:100,providerCalls:4,replayed:false}:
 {kind:'claimed',version:1,dispatch:options.dispatch??true,operationId:options.malformed?id(99):args.p_operation_id,effectId:args.p_effect_id,componentKey:args.p_component_key,executionDay:'2026-10-04',executionMicroUsdCharged:100,executionProviderCalls:2,dispatchUntil:new Date(now+1000).toISOString()};});
 return {calls,client:paidAdmission({rpc,bindings:{'api-judge':{quoteId:id(5),configurationSha256:hash('config')}},now:()=>now})};
}
test('one-use permit invokes exactly one callback, including provider failure',async()=>{
 const {client,calls}=fixture(),reservation=await client.reserve(reserve),permit=await reservation.claim(claim);let dispatched=0;
 await assert.rejects(permit.run(async()=>{dispatched++;throw new Error('synthetic provider failure');}));
 await assert.rejects(permit.run(async()=>{dispatched++;return true;}),PaidAdmissionError);assert.equal(dispatched,1);assert.deepEqual(calls,['reserve_paid_operation_v1','claim_paid_effect_v1']);
});
test('lost SQL claim acknowledgement cannot authorize a repeated paid effect',async()=>{
 let claimed=false,dispatched=0;
 const base=fixture();
 const rpc:PaidRpc=async(name,args)=>{
  if(name==='reserve_paid_operation_v1')return {kind:'reserved',version:1,operationId:id(2),quoteId:id(5),configurationSha256:hash('config'),activity:'api-judge',requestDigest:hash('request'),components:[component],expiresAt:new Date(now+1000).toISOString(),day:'2026-10-04',microUsd:100,providerCalls:4,replayed:true};
  if(!claimed){claimed=true;throw new Error('ACK lost after durable claim');}
  return {kind:'claimed',version:1,dispatch:false,operationId:args.p_operation_id,effectId:args.p_effect_id,componentKey:args.p_component_key,executionDay:'2026-10-04',executionMicroUsdCharged:100,executionProviderCalls:2,dispatchUntil:new Date(now+1000).toISOString()};
 };
 const first=await fixture({rpc}).client.reserve(reserve);await assert.rejects(first.claim(claim),PaidAdmissionError);
 // Fresh client has no memory of the previous process; SQL replay is authoritative.
 const restarted=await fixture({rpc}).client.reserve(reserve);await assert.rejects(restarted.claim(claim),e=>e instanceof PaidAdmissionError && e.reason==='already-dispatched');
 assert.equal(dispatched,0);assert.ok(base.client);
});
test('actual provider/model/voice/config/retry and quantities must match before RPC dispatch',async()=>{
 for(const mutate of [(c:ClaimPaidRequest)=>c.provider='anthropic',(c:ClaimPaidRequest)=>c.model='other-model',(c:ClaimPaidRequest)=>c.voice='other-voice',(c:ClaimPaidRequest)=>c.configurationSha256=hash('other'),(c:ClaimPaidRequest)=>c.maxProviderAttempts=3,(c:ClaimPaidRequest)=>c.quantities.inputBytes=1025,(c:ClaimPaidRequest)=>c.quantities.audioMillis=1,(c:ClaimPaidRequest)=>c.quantities.outputTokens=0]){
  const {client,calls}=fixture(),reservation=await client.reserve(reserve),bad=structuredClone(claim);mutate(bad);await assert.rejects(reservation.claim(bad),PaidAdmissionError);assert.deepEqual(calls,['reserve_paid_operation_v1']);
 }
});
test('malformed contract kinds, identities, zero relevant maxima and unsafe integers are refused',()=>{
 for(const kind of [['llm'],{kind:'llm'},null,1])assert.throws(()=>decodePaidComponent({...component,kind}),PaidAdmissionError);
 for(const bad of [{...component,maxOutputTokens:0},{...component,microUsd:0},{...component,maxEffects:1025},{...component,maxInputBytes:1.5},{...component,maxProviderAttempts:Infinity},{...component,voice:'unexpected'},{...component,unreviewed:true}])assert.throws(()=>decodePaidComponent(bad),PaidAdmissionError);
 assert.deepEqual(decodePaidComponent(component),component);
});
test('missing quote binding, malformed claim, expiry and aborted request are fail closed',async()=>{
 await assert.rejects(paidAdmission({rpc:async()=>{throw new Error('must not call');},bindings:{}}).reserve(reserve),PaidAdmissionError);
 const bad=await fixture({malformed:true}).client.reserve(reserve);await assert.rejects(bad.claim(claim),PaidAdmissionError);
 const controller=new AbortController();controller.abort();await assert.rejects(fixture().client.reserve({...reserve,signal:controller.signal}),PaidAdmissionError);
 const {client}=fixture({dispatch:false});const reservation=await client.reserve(reserve);await assert.rejects(reservation.claim(claim),e=>e instanceof PaidAdmissionError && e.reason==='already-dispatched');
});
test('service RPC adapter restricts names/URLs, makes no retries and redacts transport errors',async()=>{
 assert.throws(()=>paidAdmissionRpc('http://fixture.test','fixture'),PaidAdmissionError);
 assert.throws(()=>paidAdmissionRpc('https://name:secret@fixture.test','fixture'),PaidAdmissionError);
 let attempts=0;const key='offline-credential-never-logged';
 const rpc=paidAdmissionRpc('https://fixture.test',key,async()=>{attempts++;throw new Error(`upstream echoed ${key}`);});
 await assert.rejects(rpc('claim_paid_effect_v1',{}),e=>e instanceof PaidAdmissionError && !e.message.includes(key));assert.equal(attempts,1);
});

test('protected tutor resume restores the exact existing quote and supports fenced claims through injected bridge',async()=>{
 const calls:{name:string,args:Record<string,unknown>}[]=[];
 const rpc:PaidRpc=async(name,args)=>{calls.push({name,args});return name==='resume_paid_tutor_v1'?
  {kind:'reserved',version:1,operationId:id(2),quoteId:id(5),configurationSha256:hash('config'),activity:'lesson-text',requestDigest:hash('request'),components:[component],expiresAt:new Date(now+3600000).toISOString(),day:'2026-10-04',microUsd:100,providerCalls:4,replayed:true}:
  {kind:'claimed',version:1,dispatch:true,operationId:id(2),effectId:args.p_effect_id,componentKey:'judge',executionDay:'2026-10-04',executionMicroUsdCharged:100,executionProviderCalls:2,dispatchUntil:new Date(now+1000).toISOString()};};
 const client=paidAdmission({rpc,bindings:{'lesson-text':{quoteId:id(5),configurationSha256:hash('config')}},now:()=>now});
 const receipt=await client.resume({userId:id(1),sessionId:id(8),claimNonce:id(9)});
 assert.equal(receipt.requestDigest,hash('request'));assert.equal(receipt.activity,'lesson-text');
 const permit=await receipt.claim({...claim,context:{kind:'tutor',sessionId:id(8),claimNonce:id(9)}});assert.equal(await permit.run(async()=>true),true);
 assert.deepEqual(calls[0],{name:'resume_paid_tutor_v1',args:{p_user_id:id(1),p_session_id:id(8),p_claim_nonce:id(9)}});
 assert.deepEqual(calls.map(c=>c.name),['resume_paid_tutor_v1','claim_paid_effect_v1']);
 await assert.rejects(paidAdmission({rpc,bindings:{},now:()=>now}).resume({userId:id(1),sessionId:id(8),claimNonce:id(9)}),PaidAdmissionError);
});
test('permit expires at server execution UTC boundary before callback; execution refusal remains explicit',async()=>{
 let clock=now;
 const rpc:PaidRpc=async(name,args)=>name==='reserve_paid_operation_v1'?
  {kind:'reserved',version:1,operationId:id(2),quoteId:id(5),configurationSha256:hash('config'),activity:'api-judge',requestDigest:hash('request'),components:[component],expiresAt:new Date(now+86400000).toISOString(),day:'2026-10-04',microUsd:100,providerCalls:4,replayed:false}:
  {kind:'claimed',version:1,dispatch:true,operationId:id(2),effectId:args.p_effect_id,componentKey:'judge',executionDay:'2026-10-04',executionMicroUsdCharged:100,executionProviderCalls:2,dispatchUntil:'2026-10-05T00:00:00Z'};
 const receipt=await paidAdmission({rpc,bindings:{'api-judge':{quoteId:id(5),configurationSha256:hash('config')}},now:()=>clock}).reserve(reserve);
 const permit=await receipt.claim(claim);assert.equal(permit.dispatchUntil,Date.parse('2026-10-05T00:00:00Z'));clock=permit.dispatchUntil;let calls=0;
 await assert.rejects(permit.run(async()=>{calls++;return true;}),PaidAdmissionError);assert.equal(calls,0);
 const refused=await fixture({rpc:async(name,args)=>name==='reserve_paid_operation_v1'?rpc(name,args):{kind:'refused',reason:'global-execution-budget'}}).client.reserve(reserve);
 await assert.rejects(refused.claim(claim),e=>e instanceof PaidAdmissionError && e.reason==='global-execution-budget');
});

test('service RPC propagates caller abort before dispatch, while headers wait and while body waits',async()=>{
 const before=new AbortController();before.abort();let calls=0;
 const noSend=paidAdmissionRpc('https://fixture.test','offline-credential',async()=>{calls++;return Response.json({});});
 await assert.rejects(noSend('claim_paid_effect_v1',{},before.signal),PaidAdmissionError);assert.equal(calls,0);
 for(const bodyWait of [false,true]){
  const caller=new AbortController();let forwarded:AbortSignal|undefined,releaseStart=()=>{};
  const started=new Promise<void>(resolve=>{releaseStart=resolve;});
  const rpc=paidAdmissionRpc('https://fixture.test','offline-credential',async(_url,init)=>{forwarded=init?.signal??undefined;releaseStart();return bodyWait?new Response(new ReadableStream({pull(){return new Promise(()=>{});}}),{headers:{'content-type':'application/json'}}):new Promise(()=>{});});
  const pending=rpc('claim_paid_effect_v1',{},caller.signal);await started;await new Promise(resolve=>setImmediate(resolve));caller.abort();
  await assert.rejects(pending,PaidAdmissionError);assert.equal(forwarded?.aborted,true);
 }
});
