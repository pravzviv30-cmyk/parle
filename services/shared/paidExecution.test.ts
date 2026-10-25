import assert from 'node:assert/strict';
import {test} from 'node:test';
import {describePaidHttp,paidConfigurationSha256,paidProviderFetch,pcmAudioMillis,reservationGate} from './paidExecution.ts';
import {pcmWav} from './audioDecode.ts';
import type {PaidReservation} from './paidAdmission.ts';
const request=()=>({method:'POST',body:JSON.stringify({model:'reviewed-model',max_tokens:600,messages:[{role:'user',content:'private sentence'}]})});
test('actual provider model/output/input/configuration are inspected before dispatch; unsupported destinations/output never send',async()=>{
 const first=await describePaidHttp(new URL('https://api.anthropic.com/v1/messages'),request());assert.equal(first.quantities.inputBytes,Buffer.byteLength(request().body));assert.equal(first.quantities.outputTokens,600);
 const second=await describePaidHttp(new URL('https://api.anthropic.com/v1/messages'),{...request(),body:JSON.stringify({...JSON.parse(request().body),messages:[{role:'user',content:'another sentence'}]})});assert.equal(paidConfigurationSha256(first),paidConfigurationSha256(second));
 const changed=await describePaidHttp(new URL('https://api.anthropic.com/v1/messages'),{...request(),body:JSON.stringify({...JSON.parse(request().body),max_tokens:601})});assert.notEqual(paidConfigurationSha256(first),paidConfigurationSha256(changed));
 let sent=0,gated=0;const transport=paidProviderFetch(async()=>{gated++;return new AbortController().signal;},async()=>{sent++;return Response.json({ok:true});});
 for(const [url,init] of [['https://foreign.test/v1/messages',request()],['https://api.anthropic.com/v1/messages',{method:'POST',body:'{"model":"reviewed-model"}'}],['https://api.openai.com/v1/responses',{method:'POST',body:'{"model":"reviewed-model","max_output_tokens":0}'}]] as const)await assert.rejects(transport(url,init));assert.equal(sent,0);assert.equal(gated,0);
 await (await transport('https://api.anthropic.com/v1/messages',request())).json();assert.equal(sent,1);assert.equal(gated,1);
});
test('every retry crosses a distinct dispatch gate; unknown ACK or mismatch never reaches provider',async()=>{
 const d=await describePaidHttp(new URL('https://api.anthropic.com/v1/messages'),request());let calls=0;const ids:string[]=[];
 const c={key:'model',kind:'llm',provider:d.provider,model:d.model,voice:'',configurationSha256:paidConfigurationSha256(d),maxProviderAttempts:1,maxEffects:10,maxInputBytes:100000,maxOutputTokens:100000,maxAudioMillis:0,maxTextBytes:0};
 const reservation={components:[c],claim:async(value)=>{ids.push(value.effectId);if(ids.length===3)throw new Error('unknown ACK');return {dispatchUntil:Date.now()+60000,run:async(effect)=>effect()};}} as PaidReservation;
 const transport=paidProviderFetch(reservationGate(reservation,{kind:'api',authSessionId:'session',operationId:'operation'},new AbortController().signal),async(_url,init)=>{assert.equal(init?.redirect,'error');calls++;return Response.json({ok:true});});
 await (await transport('https://api.anthropic.com/v1/messages',request())).json();await (await transport('https://api.anthropic.com/v1/messages',request())).json();await assert.rejects(transport('https://api.anthropic.com/v1/messages',request()));assert.equal(calls,2);assert.equal(new Set(ids).size,3);
 await assert.rejects(transport('https://api.anthropic.com/v1/messages',{...request(),body:JSON.stringify({...JSON.parse(request().body),model:'changed'})}));assert.equal(calls,2);
});
test('hard header/body deadlines and response-byte ceilings work even for adapters that ignore cancellation',async()=>{
 const gate=async()=>new AbortController().signal;
 const hung=paidProviderFetch(gate,async()=>new Promise(()=>{}),5);await assert.rejects(hung('https://api.anthropic.com/v1/messages',request()));
 const body=paidProviderFetch(gate,async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}})),5);await assert.rejects((await body('https://api.anthropic.com/v1/messages',request())).text());
 const over=paidProviderFetch(gate,async()=>new Response(new Uint8Array(4*1024*1024+1)),1000);await assert.rejects((await over('https://api.anthropic.com/v1/messages',request())).text());
});
test('compressed/ambiguous audio is refused; actual normalized sample count determines admission',async()=>{
 const wav=pcmWav(new Uint8Array(32000));assert.equal(pcmAudioMillis(wav),1000);
 const stt=await describePaidHttp(new URL('https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&mip_opt_out=true'),{method:'POST',body:wav as BodyInit});assert.equal(stt.quantities.audioMillis,1000);
 await assert.rejects(describePaidHttp(new URL('https://api.deepgram.com/v1/listen?model=nova-3'),{method:'POST',body:new Uint8Array([1,2,3])}));
 const form=new FormData();form.append('text','Bonjour');form.append('dialect','fr-fr');form.append('user_audio_file',new Blob([wav as BlobPart]),'utterance.wav');const score=await describePaidHttp(new URL('https://api.speechace.co/api/scoring/text/v9/json?key=private-key&dialect=fr-fr'),{method:'POST',body:form});assert.equal(score.quantities.audioMillis,1000);assert.equal(score.quantities.inputBytes,Buffer.byteLength('Bonjour')+4096,'the WAV counts once, as audio millis');assert.ok(!JSON.stringify(score).includes('private-key'));
 await assert.rejects(describePaidHttp(new URL('https://api.toneperfect.app/v1/assess'),{method:'POST',body:form}));
 form.append('text','second charged interpretation');await assert.rejects(describePaidHttp(new URL('https://api.speechace.co/api/scoring/text/v9/json?key=private-key&dialect=fr-fr'),{method:'POST',body:form}));
 await assert.rejects(describePaidHttp(new URL('https://api.deepgram.com/v1/listen?model=nova-3&model=another'),{method:'POST',body:wav as BodyInit}));
});
test('provider-specific output fields, single outputs and actual string model identity cannot underdeclare spend',async()=>{
 for(const body of [{model:'m',max_tokens:1,max_output_tokens:50000},{model:'m',max_tokens:1},{model:['m'],max_output_tokens:1},{model:'m',max_output_tokens:1,n:2},{model:'m',max_output_tokens:1,background:true}])await assert.rejects(describePaidHttp(new URL('https://api.openai.com/v1/responses'),{method:'POST',body:JSON.stringify(body)}));
 const d=await describePaidHttp(new URL('https://api.openai.com/v1/responses'),{method:'POST',body:JSON.stringify({model:'m',max_output_tokens:50000})});assert.equal(d.quantities.outputTokens,50000);
});
test('finite OpenAI cache addresses share uncached-price configuration while charge-affecting settings remain bound',async()=>{
 const url=new URL('https://api.openai.com/v1/responses');
 const body={model:'reviewed-model',max_output_tokens:3000,store:false,reasoning:{effort:'low'},service_tier:'default',input:'Private sentence',prompt_cache_key:'luvani-turn-00000001'};
 const describe=(value:unknown)=>describePaidHttp(url,{method:'POST',body:JSON.stringify(value)});
 const a=await describe(body), b=await describe({...body,prompt_cache_key:'luvani-turn-abcdef09'});
 assert.equal(paidConfigurationSha256(a),paidConfigurationSha256(b));
 assert.equal(a.quantities.inputBytes,Buffer.byteLength(JSON.stringify(body)));
 for(const changed of [{...body,model:'other-model'},{...body,max_output_tokens:3001},{...body,reasoning:{effort:'high'}},{...body,store:true},{...body,service_tier:'priority'},{...body,text:{format:{type:'json_schema',schema:{type:'object'}}}}])assert.notEqual(paidConfigurationSha256(a),paidConfigurationSha256(await describe(changed)));
 for(const key of [42,['luvani-turn-00000001'],'private-learner-id','luvani-arbitrary-00000001','luvani-turn-'+ 'f'.repeat(9)])await assert.rejects(describe({...body,prompt_cache_key:key}));
});
test('provider privacy parameters are required at the outbound boundary',async()=>{
 const body=pcmWav(new Uint8Array(32000));
 for(const suffix of ['', '&mip_opt_out=false'])await assert.rejects(describePaidHttp(new URL('https://api.deepgram.com/v1/listen?model=nova-3'+suffix),{method:'POST',body:body as BodyInit}));
 for(const suffix of ['', '&enable_logging=true'])await assert.rejects(describePaidHttp(new URL('https://api.elevenlabs.io/v1/text-to-speech/Fixture?output_format=pcm_22050'+suffix),{method:'POST',body:JSON.stringify({model_id:'eleven_multilingual_v2',text:'Bonjour'})}));
});
test('TTS speed is input, not quote identity: an admitted speed hashes like no speed, anything else is refused',async()=>{
 const url=new URL('https://api.elevenlabs.io/v1/text-to-speech/Fixture/stream?output_format=pcm_22050&enable_logging=false');
 const settings={stability:0.4,similarity_boost:0.8,style:0.3,use_speaker_boost:true};
 const describe=(voice_settings:unknown)=>describePaidHttp(url,{method:'POST',body:JSON.stringify({text:'Bonjour',model_id:'eleven_multilingual_v2',voice_settings})});
 const plain=await describe(settings);
 // Byte-identical to the identity before speed existed: every bound quote keeps matching.
 assert.deepEqual(plain.configuration,{parameters:{enable_logging:'false',output_format:'pcm_22050'},model_id:'eleven_multilingual_v2',voice_settings:settings});
 for(const speed of [0.7,0.9,1,1.2])assert.equal(paidConfigurationSha256(await describe({...settings,speed})),paidConfigurationSha256(plain));
 for(const speed of [0.6,1.3,'0.9',null,Number.NaN])await assert.rejects(describe({...settings,speed}),(error:Error&{reason?:string})=>error.reason==='unsupported-adapter');
 assert.notEqual(paidConfigurationSha256(await describe({...settings,stability:0.5})),paidConfigurationSha256(plain));
});
test('an empty voice_settings with only an admitted speed hashes like voice_settings {}',async()=>{
 const url=new URL('https://api.elevenlabs.io/v1/text-to-speech/Fixture/stream?output_format=pcm_22050&enable_logging=false');
 const describe=(voice_settings:unknown)=>describePaidHttp(url,{method:'POST',body:JSON.stringify({text:'Bonjour',model_id:'eleven_multilingual_v2',voice_settings})});
 // Chosen behaviour: speed is removed, the (now empty) object stays, so it is not the same as omitting voice_settings.
 assert.equal(paidConfigurationSha256(await describe({speed:0.9})),paidConfigurationSha256(await describe({})));
 assert.notEqual(paidConfigurationSha256(await describe({speed:0.9})),paidConfigurationSha256(await describePaidHttp(url,{method:'POST',body:JSON.stringify({text:'Bonjour',model_id:'eleven_multilingual_v2'})})));
});
test('a keyterm STT descriptor against a plain-only quote is a quote-mismatch before any claim; the plain one is then admitted once',async()=>{
 const base={kind:'stt' as const,provider:'deepgram' as const,model:'nova-3',voice:'',quantities:{inputBytes:0,outputTokens:0,audioMillis:1000,textBytes:0}};
 const params={channels:'1',encoding:'linear16',language:'fr',mip_opt_out:'true',model:'nova-3',sample_rate:'16000'};
 const plain={...base,configuration:{parameters:params}},prompted={...base,configuration:{parameters:{...params,keyterm:'prompted'}}};
 let claims=0;
 const reservation={components:[{key:'stt',kind:'stt',provider:'deepgram',model:'nova-3',voice:'',configurationSha256:paidConfigurationSha256(plain),maxProviderAttempts:1,maxEffects:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:1000,maxTextBytes:0,microUsd:1}],
  claim:async()=>{claims++;return {dispatchUntil:Date.now()+60000,run:async(effect:()=>Promise<AbortSignal>)=>effect()};}} as unknown as PaidReservation;
 const gate=reservationGate(reservation,{kind:'tutor',sessionId:'11111111-1111-4111-8111-111111111111',claimNonce:'22222222-2222-4222-8222-222222222222'} as never,new AbortController().signal);
 await assert.rejects(gate(prompted),(error:Error&{reason?:string})=>error.reason==='quote-mismatch');
 assert.equal(claims,0);
 assert.equal((await gate(plain)).aborted,false);assert.equal(claims,1);
});
