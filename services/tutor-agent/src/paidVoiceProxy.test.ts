import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { createPaidVoiceProxy, describeStreamingDeepgram, type VendorSocket, type PaidVoiceProxy } from './paidVoiceProxy.ts';
import { paidConfigurationSha256, reservationGate, type PaidDescriptor, type PaidGate } from '../../shared/paidExecution.ts';
import type { PaidReservation } from '../../shared/paidAdmission.ts';
const WebSocket=createRequire(import.meta.url)('ws') as new(url:string,options?:unknown)=>VendorSocket;
const config='?model=nova-3&language=fr&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&mip_opt_out=true';
const credentials={deepgram:'stored-deepgram-fixture',elevenlabs:'stored-eleven-fixture',anthropic:'stored-anthropic-fixture',openai:'stored-openai-fixture'};
class FakeSocket extends EventEmitter implements VendorSocket {
  readyState=1;bufferedAmount=0;sent:{data:Buffer;binary:boolean}[]=[];
  send(data:Buffer|string,options:{binary:boolean},callback?:(error?:Error)=>void):void {this.sent.push({data:Buffer.from(data),binary:options.binary});callback?.();}
  close():void{this.terminate();}
  terminate():void{if(this.readyState===3)return;this.readyState=3;this.emit('close');}
}
async function until(test:()=>boolean):Promise<void>{for(let n=0;n<100;n++){if(test())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('fixture timed out');}
async function connect(proxy:PaidVoiceProxy,query=config):Promise<VendorSocket>{const client=new WebSocket(proxy.deepgramBaseURL+'/v1/listen'+query);client.on('error',()=>{});await once(client,'open');return client;}
function fixture(gate?:PaidGate,maximumSessionMillis=1000){
  const root=new AbortController(),descriptors:PaidDescriptor[]=[],upstreams:FakeSocket[]=[],connections:{url:string;options:unknown}[]=[];
  const options={gate:gate??(async(descriptor:PaidDescriptor)=>{descriptors.push(descriptor);return root.signal;}),signal:root.signal,maximumSessionMillis,credentials,
    websocketConnector:(url:string,options:unknown)=>{connections.push({url,options});const socket=new FakeSocket();upstreams.push(socket);return socket;}};
  return {root,descriptors,upstreams,connections,options};
}
test('streaming descriptor is actual pinned configuration, rejects encoding/unknown/ambiguous keys',()=>{
  const descriptor=describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+config),120000);
  assert.equal(descriptor.model,'nova-3');assert.equal(descriptor.quantities.audioMillis,120000);
  assert.equal((descriptor.configuration.parameters as Record<string,string>).language,'fr');
  assert.equal((descriptor.configuration.parameters as Record<string,string>).mip_opt_out,'true');
  for(const suffix of [config+'&api_key=private',config+'&model=nova-2',config.replace('16000','48000'),config.replace('linear16','opus'),config+'&keyterm=private',config.replace('&mip_opt_out=true',''),config.replace('mip_opt_out=true','mip_opt_out=false')])assert.throws(()=>describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+suffix),120000));
});
test('actual SDK-shaped nova3 multilingual conversation query retains fr/multi reset behavior',()=>{
  const actual='?model=nova-3&punctuate=true&smart_format=true&dictation=false&diarize=false&numerals=false&no_delay=true&interim_results=true&encoding=linear16&vad_events=true&sample_rate=16000&channels=1&endpointing=25&filler_words=false&profanity_filter=false&language=multi&mip_opt_out=true';
  for(const language of ['multi','fr']){
    const descriptor=describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+actual.replace('language=multi',`language=${language}`)),120000);
    assert.equal((descriptor.configuration.parameters as Record<string,string>).language,language);assert.equal(descriptor.quantities.audioMillis,120000);
  }
  assert.throws(()=>describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+actual.replace('nova-3','nova-2')),120000));
});
test('each actual reconnect is gated first with full reserved duration and outbound-only credentials',async()=>{
  const f=fixture();const proxy=await createPaidVoiceProxy(f.options);
  try{
    const client=await connect(proxy);await until(()=>f.upstreams.length===1);
    assert.equal(f.descriptors.length,1);assert.equal(f.descriptors[0]!.quantities.audioMillis,1000);
    assert.ok(f.connections[0]!.url.startsWith('wss://api.deepgram.com/v1/listen?'));
    assert.deepEqual((f.connections[0]!.options as {headers:unknown}).headers,{Authorization:'Token stored-deepgram-fixture'});
    const text=Buffer.from('{"type":"KeepAlive"}');client.send(text,{binary:false});client.send(Buffer.alloc(3200),{binary:true});
    await until(()=>f.upstreams[0]!.sent.length===2);assert.equal(f.upstreams[0]!.sent[1]!.data.length,3200);
    const received=once(client,'message');f.upstreams[0]!.emit('message',Buffer.from('{"type":"Results","fixture":"safe"}'),false);
    assert.equal(Buffer.from((await received)[0]).toString(),'{"type":"Results","fixture":"safe"}');
    client.terminate();await until(()=>f.upstreams[0]!.readyState===3);
    const next=await connect(proxy);assert.equal(f.descriptors.length,2);assert.equal(f.connections.length,2);next.terminate();
  }finally{await proxy.close();}
});
test('pending/failed admission never opens upstream and session abort drains boundedly',async()=>{
  const f=fixture(async()=>new Promise<AbortSignal>(()=>{}));const proxy=await createPaidVoiceProxy(f.options);
  const client=new WebSocket(proxy.deepgramBaseURL+'/v1/listen'+config);client.on('error',()=>{});
  const closed=new Promise<void>(resolve=>client.once('close',()=>resolve()));
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(f.connections.length,0);
  f.root.abort();await closed;await proxy.close();assert.equal(f.connections.length,0);
});
test('a permit boundary abort tears down an established vendor and local stream',async()=>{
  const permit=new AbortController(),f=fixture(async()=>permit.signal);const proxy=await createPaidVoiceProxy(f.options);
  try{const client=await connect(proxy);const closed=once(client,'close');permit.abort();await closed;assert.equal(f.upstreams[0]!.readyState,3);}finally{await proxy.close();}
});
test('exact UTC dispatch boundary refuses WS even before the timeout signal event is delivered',async()=>{
  const originalNow=Date.now,until=originalNow()+60000,root=new AbortController();let allowedWasAborted=true;
  const descriptor=describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+config),1000);
  const reservation={components:[{key:'stream',...descriptor,configurationSha256:paidConfigurationSha256(descriptor),maxProviderAttempts:1,maxEffects:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:1000,maxTextBytes:0,microUsd:1}],claim:async()=>({dispatchUntil:until,run:async(effect:()=>Promise<AbortSignal>)=>effect()})} as unknown as PaidReservation;
  const paid=reservationGate(reservation,{kind:'tutor',sessionId:'11111111-1111-4111-8111-111111111111',claimNonce:'22222222-2222-4222-8222-222222222222'},root.signal);
  const f=fixture(async(input,signal)=>{const allowed=await paid(input,signal);allowedWasAborted=allowed.aborted;Date.now=()=>until;return allowed;}),proxy=await createPaidVoiceProxy(f.options);
  try{await assert.rejects(connect(proxy));assert.equal(allowedWasAborted,false);assert.equal(f.connections.length,0);}finally{Date.now=originalNow;await proxy.close();}
});
test('the exact permit boundary also stops audio on an already established stream before timer delivery',async()=>{
  const originalNow=Date.now,until=originalNow()+60000,root=new AbortController();let allowedSignal:AbortSignal|undefined;
  const descriptor=describeStreamingDeepgram(new URL('wss://api.deepgram.com/v1/listen'+config),1000);
  const reservation={components:[{key:'stream',...descriptor,configurationSha256:paidConfigurationSha256(descriptor),maxProviderAttempts:1,maxEffects:1,maxInputBytes:0,maxOutputTokens:0,maxAudioMillis:1000,maxTextBytes:0,microUsd:1}],claim:async()=>({dispatchUntil:until,run:async(effect:()=>Promise<AbortSignal>)=>effect()})} as unknown as PaidReservation;
  const paid=reservationGate(reservation,{kind:'tutor',sessionId:'11111111-1111-4111-8111-111111111111',claimNonce:'22222222-2222-4222-8222-222222222222'},root.signal);
  const f=fixture(async(input,signal)=>{allowedSignal=await paid(input,signal);return allowedSignal;}),proxy=await createPaidVoiceProxy(f.options);
  try{const client=await connect(proxy),closed=once(client,'close');Date.now=()=>until;assert.equal(allowedSignal?.aborted,false);client.send(Buffer.alloc(3200),{binary:true});await closed;assert.equal(f.upstreams[0]!.sent.length,0);}finally{Date.now=originalNow;await proxy.close();}
});
test('two streams maximum and global/per-connection PCM duration cannot be exceeded',async()=>{
  const f=fixture(),proxy=await createPaidVoiceProxy(f.options);
  try{
    const first=await connect(proxy),second=await connect(proxy);
    await assert.rejects(connect(proxy));assert.equal(f.connections.length,2);
    first.send(Buffer.alloc(16000),{binary:true});second.send(Buffer.alloc(16000),{binary:true});await until(()=>f.upstreams.every(socket=>socket.sent.length===1));
    const closed=once(second,'close');second.send(Buffer.alloc(2),{binary:true});await closed;
    assert.equal(f.upstreams[1]!.sent.length,1,'frame beyond whole-session audio reservation never forwards');first.terminate();
  }finally{await proxy.close();}
});
test('unapproved controls, reply oversize and backpressure terminate without forwarding',async()=>{
  for(const mode of ['control','reply','backpressure','odd-pcm']){
    const f=fixture(),proxy=await createPaidVoiceProxy(f.options);
    try{const client=await connect(proxy),closed=once(client,'close');
      if(mode==='control')client.send(Buffer.from('{"type":"KeepAlive","audio":"private"}'),{binary:false});
      else if(mode==='reply')f.upstreams[0]!.emit('message',Buffer.alloc(128*1024+1),false);
      else if(mode==='backpressure'){f.upstreams[0]!.bufferedAmount=256*1024;client.send(Buffer.alloc(2),{binary:true});}
      else client.send(Buffer.alloc(3),{binary:true});
      await closed;assert.equal(f.upstreams[0]!.sent.length,0);
    }finally{await proxy.close();}
  }
});
test('Eleven HTTP admits exact SDK text/config and credentials, refuses web sockets/retention/unknown config',async()=>{
  const root=new AbortController(),descriptors:PaidDescriptor[]=[],outbound:{url:string;init:RequestInit|undefined}[]=[];
  const proxy=await createPaidVoiceProxy({signal:root.signal,maximumSessionMillis:120000,credentials,gate:async descriptor=>{descriptors.push(descriptor);return root.signal;},request:async(url,init)=>{outbound.push({url:String(url),init});return new Response(Buffer.alloc(320),{headers:{'content-type':'audio/pcm'}});}});
  const body={text:'Un café, merci.',model_id:'eleven_multilingual_v2',language_code:'fr',apply_text_normalization:'auto',voice_settings:{stability:0.5,similarity_boost:0.75,use_speaker_boost:true}};
  const url=proxy.elevenlabsBaseURL+'/text-to-speech/VoiceFixture/stream?output_format=pcm_24000&enable_logging=false';
  try{
    const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','xi-api-key':'incoming-private-ignore'},body:JSON.stringify(body)});
    assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,320);assert.equal(descriptors.length,1);
    assert.equal(descriptors[0]!.quantities.textBytes,Buffer.byteLength(body.text));assert.equal(descriptors[0]!.voice,'VoiceFixture');
    assert.equal(new Headers(outbound[0]!.init?.headers).get('xi-api-key'),'stored-eleven-fixture');assert.equal(outbound[0]!.init?.body,JSON.stringify(body));
    for(const [target,payload] of [[url.replace('false','true'),body],[url,{...body,unreviewed:true}],[url,{...body,text:'x'.repeat(8193)}],[url.replace('pcm_24000','mp3_44100'),body]] as const){const denied=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(denied.status,503);assert.doesNotMatch(await denied.text(),/incoming-private|unreviewed|x{20}/);}
    assert.equal(descriptors.length,1);assert.equal(outbound.length,1);
    const client=new WebSocket(url.replace(/^http/,'ws'));client.on('error',()=>{});await assert.rejects(once(client,'open'));assert.equal(descriptors.length,1);
  }finally{await proxy.close();}
});
test('Anthropic/OpenAI fixed endpoints gate each HTTP attempt including retries with bounded output',async()=>{
  const root=new AbortController(),descriptors:PaidDescriptor[]=[],outbound:{url:string;init:RequestInit|undefined}[]=[];
  const proxy=await createPaidVoiceProxy({signal:root.signal,maximumSessionMillis:120000,credentials,gate:async descriptor=>{descriptors.push(descriptor);return root.signal;},request:async(url,init)=>{outbound.push({url:String(url),init});return Response.json({fixture:'safe'});}});
  try{
    const anthropic={model:'claude-fixture',messages:[{role:'user',content:'PRIVATE_INPUT_MARKER'}],max_tokens:512,stream:true};
    for(let retry=0;retry<2;retry++){const response=await fetch(proxy.anthropicBaseURL+'/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':'ignore','anthropic-version':'untrusted'},body:JSON.stringify(anthropic)});assert.equal(response.status,200);await response.text();}
    const openai={model:'gpt-fixture',messages:[{role:'user',content:'PRIVATE_INPUT_MARKER'}],max_completion_tokens:512,stream:true};
    const response=await fetch(proxy.openaiBaseURL+'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(openai)});assert.equal(response.status,200);await response.text();
    assert.equal(descriptors.length,3);assert.equal(outbound[0]!.url,'https://api.anthropic.com/v1/messages');assert.equal(outbound[2]!.url,'https://api.openai.com/v1/chat/completions');
    assert.equal(new Headers(outbound[0]!.init?.headers).get('anthropic-version'),'2023-06-01');assert.equal(new Headers(outbound[2]!.init?.headers).get('authorization'),'Bearer stored-openai-fixture');
    assert.ok(!JSON.stringify(descriptors).includes('PRIVATE_INPUT_MARKER'));
    for(const target of [proxy.openaiBaseURL+'/models',proxy.anthropicBaseURL+'/v1/models','http://127.0.0.1:'+new URL(proxy.anthropicBaseURL).port+'/unknown/v1/messages'])assert.equal((await fetch(target)).status,404);
    const bad=await fetch(proxy.openaiBaseURL+'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...openai,max_completion_tokens:undefined})});assert.equal(bad.status,503);assert.equal(descriptors.length,3);
  }finally{await proxy.close();}
});
test('four HTTP transports maximum; session cancellation releases them without a fifth effect',async()=>{
  const root=new AbortController();let gates=0,outbound=0;
  const proxy=await createPaidVoiceProxy({signal:root.signal,maximumSessionMillis:120000,credentials,gate:async()=>{gates++;return root.signal;},request:async()=>{outbound++;return new Promise<Response>(()=>{});}});
  const body=JSON.stringify({model:'claude-fixture',max_tokens:512,messages:[{role:'user',content:'fixture'}]});
  const init={method:'POST',headers:{'content-type':'application/json'},body};
  const pending=Array.from({length:4},()=>fetch(proxy.anthropicBaseURL+'/v1/messages',init).then(response=>response.text()).catch(()=>undefined));
  try{
    await until(()=>outbound===4);
    const fifth=await fetch(proxy.anthropicBaseURL+'/v1/messages',init);assert.equal(fifth.status,429);await fifth.text();assert.equal(gates,4);
    root.abort();await Promise.all(pending);await proxy.close();assert.equal(outbound,4);
  }finally{root.abort();await proxy.close();}
});
test('HTTP oversized bodies and vendor-error private content never dispatch or reach SDK',async()=>{
  const root=new AbortController();let gates=0,outbound=0;
  const proxy=await createPaidVoiceProxy({signal:root.signal,maximumSessionMillis:120000,credentials,gate:async()=>{gates++;return root.signal;},request:async()=>{outbound++;return new Response('PRIVATE_PROVIDER_RESPONSE',{status:500});}});
  try{
    const target=proxy.anthropicBaseURL+'/v1/messages';
    const limit=2*1024*1024;
    const oversizedBody=JSON.stringify({model:'claude-fixture',max_tokens:512,messages:[{role:'user',content:'PRIVATE_INPUT'+'x'.repeat(limit)}]});
    assert.ok(Buffer.byteLength(oversizedBody)>limit);
    // No upload writer races with the deterministic Content-Length refusal.
    const declared=await rawUpload(target,{'content-length':String(Buffer.byteLength(oversizedBody))});
    assert.equal(declared.status,413);assert.equal(declared.transportErrorCode,undefined);
    assert.doesNotMatch(declared.body,/PRIVATE_INPUT|PRIVATE_PROVIDER_RESPONSE/);
    // Valid JSON without a declared length exercises the cumulative byte bound.
    // Iterator cancellation can reset the unfinished native HTTP writer; it must
    // never turn a received wrong status or a failed assertion into a pass.
    const streamed=await rawUpload(target,{'transfer-encoding':'chunked'},oversizedBody);
    if(streamed.status!==undefined)assert.equal(streamed.status,503);
    else assert.ok(streamed.transportErrorCode==='ECONNRESET' || streamed.transportErrorCode==='EPIPE','only a native unfinished-upload reset may replace the refusal response');
    if(streamed.transportErrorCode!==undefined)assert.ok(streamed.transportErrorCode==='ECONNRESET' || streamed.transportErrorCode==='EPIPE');
    assert.doesNotMatch(streamed.body,/PRIVATE_INPUT|PRIVATE_PROVIDER_RESPONSE/);
    assert.equal(gates,0);assert.equal(outbound,0);
    const denied=await fetch(target,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'claude-fixture',max_tokens:512,messages:[{role:'user',content:'PRIVATE_INPUT'}]})});
    assert.equal(denied.status,503);assert.deepEqual(await denied.json(),{error:{message:'Provider transport unavailable',type:'server_error'}});assert.equal(gates,1);assert.equal(outbound,1);
  }finally{await proxy.close();}
});

/** Native HTTP exposes the precise upload/response outcome without Undici's
 * wrapper variants. Only network events are captured; assertions stay outside. */
function rawUpload(target:string,headers:Record<string,string>,body?:string):Promise<{status?:number;body:string;transportErrorCode?:string}> {
  return new Promise((resolve,reject)=>{
    let done=false,status:number|undefined,responseBytes=0;
    const chunks:Buffer[]=[];
    const finish=(error?:Error & {code?:string})=>{
      if(done)return;done=true;clearTimeout(timer);
      resolve({status,body:Buffer.concat(chunks).toString('utf8'),transportErrorCode:error ? error.code??'UNKNOWN' : undefined});
    };
    const request=httpRequest(target,{method:'POST',agent:false,headers:{'content-type':'application/json',...headers}},response=>{
      status=response.statusCode;
      response.on('data',(chunk:Buffer)=>{
        responseBytes+=chunk.length;
        if(responseBytes>16*1024){if(!done){done=true;clearTimeout(timer);reject(new Error('fixture response exceeded bound'));}request.destroy();return;}
        chunks.push(chunk);
      });
      response.once('end',()=>finish());response.on('error',finish);
    });
    const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('fixture upload timed out'));}request.destroy();},10000);
    request.on('error',finish);
    request.end(body);
  });
}
