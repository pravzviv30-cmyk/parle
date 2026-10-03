import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { selectedTutorSynthesisConfiguration } from '../../tutor-agent/src/voiceConfiguration.ts';
import { frenchAudioHash, generatePhraseAudio, phraseAudioManifest, phraseAudioWav } from './phraseAudio.ts';
const user='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const pack=buildConversationPack({id,sessionId:id,learnerId:user,createdAt:'2026-10-02T12:00:00Z',title:{fr:'Au café',en:'At the café'},summary:'An order.',keyPhrases:[{fr:'Un café, merci.',frWritten:null,en:'A coffee, thanks.'}]});
const source={packId:id,kind:'phrase' as const,index:0};
const env={SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake-service',ELEVEN_API_KEY:'fake-voice',LUVANI_PHRASE_AUDIO_GENERATION:'1'};
const config=selectedTutorSynthesisConfiguration('marie',env)!;
const reservation={fr:pack.keyPhrases[0]!.fr,payload:pack,fingerprint:config.fingerprint,rateRevision:'44444444-4444-4444-8444-444444444444',bucket:'trial',globalWindowStart:new Date(Date.now()-1000).toISOString(),paidWindowStart:null};
const run=(request:typeof fetch,overrides:Record<string,string|undefined>={},signal=new AbortController().signal)=>generatePhraseAudio(user,source,'marie',config.fingerprint,frenchAudioHash(reservation.fr),{...env,...overrides},signal,request);
test('saved audio generation stays dark for missing policy switch, keys, voice support or stale fingerprint',async()=>{
 const never=async()=>{throw new Error('must not dispatch');};
 for (const overrides of [{LUVANI_PHRASE_AUDIO_GENERATION:'0'},{ELEVEN_API_KEY:''},{SUPABASE_SERVICE_ROLE_KEY:''},{LUVANI_TTS_VENDOR:'fish'}]) assert.equal(await run(never,overrides),null);
 assert.equal(await generatePhraseAudio(user,source,'marie','b'.repeat(64),frenchAudioHash(reservation.fr),env,new AbortController().signal,never),null);
});
test('one generation dispatches only after atomic reservation and a fresh kill check, with exact live voice pins and no shared cache',async()=>{
 const calls:{url:string;body:unknown;headers:HeadersInit|undefined}[]=[];
 const wav=await run(async(url,init)=>{
  calls.push({url:String(url),body:JSON.parse(init!.body as string),headers:init!.headers});
  if(calls.length===1)return Response.json(reservation);
  if(calls.length===2)return Response.json(true);
  return new Response(new Uint8Array([0,0,1,0]),{headers:{'content-length':'4'}});
 });
 assert.equal(calls.length,3);assert.match(calls[0]!.url,/rpc\/reserve_phrase_audio$/);assert.deepEqual(calls[0]!.body,{p_user_id:user,p_pack_id:id,p_kind:'phrase',p_index:0,p_voice:'marie',p_fingerprint:config.fingerprint});
 assert.match(calls[1]!.url,/rpc\/phrase_audio_dispatch_allowed$/);
 assert.equal(calls[2]!.url,`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}?output_format=pcm_22050&optimize_streaming_latency=3`);
 assert.deepEqual(calls[2]!.body,{text:reservation.fr,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.4,similarity_boost:0.8,style:0.3,use_speaker_boost:true}});
 assert.ok(calls.every(call=>!call.url.includes('café')&&!call.url.includes('fake-voice')));
 assert.equal(Buffer.from(wav!).subarray(0,4).toString(),'RIFF');assert.equal(Buffer.from(wav!).readUInt32LE(24),22050);assert.equal(wav!.length,48);
});
test('unreserved, foreign, stale or malformed source never reaches the vendor',async()=>{
 for(const invalid of [null,{...reservation,payload:{...pack,learnerId:'other'}},{...reservation,payload:{...pack,state:'archived'}},{...reservation,payload:{...pack,id:'other'}},{...reservation,fr:'An edited arbitrary sentence'},{...reservation,fingerprint:'old'},{...reservation,payload:{...pack,exercises:'bad'}}]){
  let calls=0;assert.equal(await run(async()=>{calls++;return Response.json(invalid);}),null);assert.equal(calls,1);
 }
});
test('cancellation or either kill switch after reservation starts no billed vendor call',async()=>{
 const controller=new AbortController();let calls=0;
 assert.equal(await run(async()=>{calls++;controller.abort();return Response.json(reservation);},{},controller.signal),null);assert.equal(calls,1);
 calls=0;assert.equal(await run(async()=>Response.json(++calls===1?reservation:false)),null);assert.equal(calls,2);
 const changing={...env};calls=0;
 assert.equal(await generatePhraseAudio(user,source,'marie',config.fingerprint,frenchAudioHash(reservation.fr),changing,new AbortController().signal,async()=>{calls++;if(calls===1)return Response.json(reservation);changing.LUVANI_PHRASE_AUDIO_GENERATION='0';return Response.json(true);}),null);assert.equal(calls,2);
});
test('a billed vendor failure is never retried or refunded; oversized and malformed PCM never becomes a playable WAV',async()=>{
 for(const response of [new Response(null,{status:503}),new Response(new Uint8Array([0])),new Response(new Uint8Array([0,0]),{headers:{'content-length':'9999999'}}),new Response(new Uint8Array(882002)),new Response(new Uint8Array([0,0]),{headers:{'content-length':'4'}})]){
  let calls=0;await assert.rejects(run(async()=>++calls===1?Response.json(reservation):calls===2?Response.json(true):response),/unavailable/);assert.equal(calls,3);
 }
 assert.throws(()=>phraseAudioWav(new Uint8Array()),/unavailable/);
});
test('manifest discloses exact canonical French and opaque hashes, without vendor identity or spending a voice call',async()=>{
 let calls=0;const manifest=await phraseAudioManifest(user,source,'marie',env,new AbortController().signal,async()=>Response.json(++calls===1?[{payload:pack,state:'ready',session_id:id}]:[{session_id:id,user_id:user}]));
 assert.equal(calls,2);assert.deepEqual(manifest,{source,voice:'marie',fr:reservation.fr,frenchHash:frenchAudioHash(reservation.fr),fingerprint:config.fingerprint});assert.ok(!JSON.stringify(manifest).includes(config.voiceId));
});

test('saved tutor audio refuses credential-bearing redirects before another origin can receive them',async()=>{
 for(const redirectAt of [1,2,3]) {
  let calls=0;await assert.rejects(run(async(_url,init)=>{calls++;assert.equal(init!.redirect,'error');if(calls===redirectAt)throw new TypeError('redirect refused');return Response.json(calls===1?reservation:true);}),/redirect refused/);assert.equal(calls,redirectAt);
 }
 let calls=0;await phraseAudioManifest(user,source,'marie',env,new AbortController().signal,async(_url,init)=>{assert.equal(init!.redirect,'error');return Response.json(++calls===1?[{payload:pack,state:'ready',session_id:id}]:[{session_id:id,user_id:user}]);});assert.equal(calls,2);
});
test('saved audio dispatch gate refuses changed source completion and entitlement',async()=>{
 let calls=0;
 assert.equal(await run(async(_url,init)=>{
  if(++calls===1)return Response.json(reservation);
  assert.deepEqual(JSON.parse(init!.body as string),{p_user_id:user,p_pack_id:id,p_kind:'phrase',p_index:0,p_voice:'marie',p_fingerprint:config.fingerprint,p_rate_revision:reservation.rateRevision,p_expected_fr:reservation.fr,p_bucket:'trial',p_global_window_start:reservation.globalWindowStart,p_paid_window_start:null});
  return Response.json(false);
 }),null);assert.equal(calls,2,'a refused fresh source gate must not dispatch');
});
test('a changed saved-audio billing revision cannot use an older reservation',async()=>{
 let calls=0;assert.equal(await run(async(_url,init)=>{
  if(++calls===1)return Response.json(reservation);
  assert.equal(JSON.parse(init!.body as string).p_rate_revision,reservation.rateRevision);
  return Response.json(false); // actual SQL revision update refusal is in verifyPhraseAudioBudget.mjs
 }),null);assert.equal(calls,2);
});
test('saved tutor audio bounds fragmented PCM and does not await stalled cleanup',async()=>{
 let calls=0;
 const fragmented=new ReadableStream<Uint8Array>({start(controller){for(let i=0;i<1000;i++)controller.enqueue(new Uint8Array());for(let i=0;i<4;i++)controller.enqueue(new Uint8Array([i]));controller.close();}});
 const wav=await run(async()=>++calls===1?Response.json(reservation):calls===2?Response.json(true):new Response(fragmented));assert.equal(wav!.length,48);assert.deepEqual([...wav!.slice(44)],[0,1,2,3]);
 calls=0;const neverCancels=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(882002));},cancel(){return new Promise(()=>{});}});
 const held=setTimeout(()=>{},100);
 try{await Promise.race([assert.rejects(run(async()=>++calls===1?Response.json(reservation):calls===2?Response.json(true):new Response(neverCancels)),/unavailable/),new Promise((_resolve,reject)=>setTimeout(()=>reject(new Error('cleanup waited')),50))]);}finally{clearTimeout(held);}
 calls=0;const emptyForever=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array());}});
 await assert.rejects(run(async()=>++calls===1?Response.json(reservation):calls===2?Response.json(true):new Response(emptyForever)),/unavailable/);
});
test('saved tutor audio refuses dispatch outside its reserved budget period',async()=>{
 const expired=new Date(Date.now()-2592000000-1000).toISOString();
 for(const invalid of [{...reservation,globalWindowStart:expired},{...reservation,globalWindowStart:'infinity'},{...reservation,bucket:'paid',paidWindowStart:expired},{...reservation,bucket:'paid',paidWindowStart:null}]){
  let calls=0;assert.equal(await run(async()=>{calls++;return Response.json(invalid);}),null);assert.equal(calls,1,'no final gate or vendor for an expired reservation');
 }
 let calls=0;assert.equal(await run(async(_url,init)=>{if(++calls===1)return Response.json(reservation);assert.equal(JSON.parse(init!.body as string).p_global_window_start,reservation.globalWindowStart);return Response.json(false);}),null);assert.equal(calls,2);
});
