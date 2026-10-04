/** Actual installed adapters against synthetic transports. No provider keys or calls. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {paidProviderFetch} from '../services/shared/paidExecution.ts';
import {brainClientFromEnv} from '../packages/brain/src/llm/factory.ts';
import {createPaidVoiceProxy} from '../services/tutor-agent/src/paidVoiceProxy.ts';

// Resolve the pinned worker dependency closure, regardless of npm hoisting.
// These installed packages publish matching index.js/index.cjs entry points.
const workerRequire=createRequire(new URL('../services/tutor-agent/package.json',import.meta.url));
const moduleUrl=name=>pathToFileURL(workerRequire.resolve(name).replace(/\.cjs$/,'.js')).href;
const credentials={anthropic:'synthetic-anthropic-key',openai:'synthetic-openai-key',elevenlabs:'synthetic-eleven-key',deepgram:'synthetic-deepgram-key'};
const verdict={meaningKept:true,comprehensible:true,natural:'yes',betterLine:null,note:''};

test('actual production Anthropic SDK parse and OpenAI Responses cross the paid boundary with exact body quantities',async()=>{
 const descriptors=[],outbound=[];
 const transport=paidProviderFetch(async descriptor=>{descriptors.push(descriptor);return new AbortController().signal;},async(url,init)=>{
  const body=JSON.parse(init.body);outbound.push({url:String(url),body,rawBody:init.body,headers:new Headers(init.headers)});
  assert.equal(init.redirect,'error');
  if(String(url)==='https://api.anthropic.com/v1/messages')return Response.json({id:'msg_synthetic',type:'message',role:'assistant',model:body.model,content:[{type:'text',text:JSON.stringify(verdict)}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
  assert.equal(String(url),'https://api.openai.com/v1/responses');
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(verdict)}]}],usage:{input_tokens:1,output_tokens:1}});
 });
 for(const brain of ['anthropic','openai']){
  const client=brainClientFromEnv({NODE_ENV:'production',TUTOR_LLM:brain,ANTHROPIC_API_KEY:credentials.anthropic,OPENAI_API_KEY:credentials.openai},transport);
  const result=await client.judge({kind:'judge',system:'Synthetic fixed grader',request:'Synthetic learner text',signal:new AbortController().signal});
  assert.deepEqual(result.verdict,verdict);
 }
 assert.equal(outbound.length,2);assert.equal(descriptors.length,2);
 assert.equal(descriptors[0].quantities.outputTokens,outbound[0].body.max_tokens);
 assert.equal(descriptors[1].quantities.outputTokens,outbound[1].body.max_output_tokens);
 for(let n=0;n<2;n++){
  assert.equal(descriptors[n].model,outbound[n].body.model);
  assert.equal(descriptors[n].quantities.inputBytes,Buffer.byteLength(outbound[n].rawBody));
  assert.ok(descriptors[n].quantities.outputTokens>0);
 }
 assert.equal(outbound[0].headers.get('x-api-key'),credentials.anthropic);
 assert.equal(outbound[1].headers.get('authorization'),`Bearer ${credentials.openai}`);
 let sent=0,gated=0;
 const forbidden=paidProviderFetch(async()=>{gated++;throw new Error('synthetic unknown acknowledgement');},async()=>{sent++;return Response.json({});});
 await assert.rejects(brainClientFromEnv({NODE_ENV:'production',TUTOR_LLM:'anthropic',ANTHROPIC_API_KEY:credentials.anthropic},forbidden).judge({kind:'judge',system:'Synthetic',request:'Synthetic'}));
 assert.equal(sent,0);assert.equal(gated,1,'SDK must not automatically retry an uncertain dispatch');
});

class FakeSocket extends EventEmitter {
 readyState=1;bufferedAmount=0;sent=[];
 send(data,options,callback){this.sent.push({bytes:Buffer.byteLength(data),binary:options.binary});callback?.();}
 terminate(){if(this.readyState===3)return;this.readyState=3;this.emit('close');}
 close(){this.terminate();}
}
async function until(predicate){for(let n=0;n<100;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('synthetic adapter did not dispatch');}

test('actual installed LiveKit Anthropic/OpenAI streams, Eleven HTTP and Nova3 multilingual STT use the guarded proxy',async()=>{
 const [{llm,initializeLogger},anthropic,openai,eleven,deepgram,{AudioFrame}]=await Promise.all([
  import(moduleUrl('@livekit/agents')),import(moduleUrl('@livekit/agents-plugin-anthropic')),import(moduleUrl('@livekit/agents-plugin-openai')),
  import(moduleUrl('@livekit/agents-plugin-elevenlabs')),import(moduleUrl('@livekit/agents-plugin-deepgram')),import(moduleUrl('@livekit/rtc-node')),
 ]);
 initializeLogger({pretty:false,level:'silent'});
 const descriptors=[],outbound=[],connections=[];
 const stop=new AbortController();let recognition;
 const proxy=await createPaidVoiceProxy({maximumSessionMillis:120000,signal:stop.signal,credentials,gate:async descriptor=>{descriptors.push(descriptor);return stop.signal;},websocketConnector:(url,options)=>{const socket=new FakeSocket();connections.push({url,options,socket});return socket;},request:async(url,init)=>{
  const body=JSON.parse(init.body);outbound.push({url:String(url),body,rawBody:init.body,headers:new Headers(init.headers)});
  assert.equal(init.redirect,'error');
  if(String(url).includes('elevenlabs'))return new Response(Buffer.alloc(48000),{headers:{'content-type':'audio/pcm'}});
  const events=String(url).includes('anthropic')?[
   ['message_start',{type:'message_start',message:{id:'synthetic',type:'message',role:'assistant',model:body.model,content:[],usage:{input_tokens:1,output_tokens:0}}}],
   ['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],
   ['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Bonjour.'}}],
   ['content_block_stop',{type:'content_block_stop',index:0}],
   ['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:1}}],
   ['message_stop',{type:'message_stop'}],
  ].map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''):
   [{id:'synthetic',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta:{role:'assistant',content:'Bonjour.'},finish_reason:null}]},{id:'synthetic',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}}].map(data=>`data: ${JSON.stringify(data)}\n\n`).join('')+'data: [DONE]\n\n';
  return new Response(events,{headers:{'content-type':'text/event-stream'}});
 }});
 try{
  for(const model of [new anthropic.LLM({model:'claude-synthetic',baseURL:proxy.anthropicBaseURL,apiKey:'proxy-only',maxTokens:3000,maxRetries:0}),new openai.LLM({model:'gpt-synthetic',baseURL:proxy.openaiBaseURL,apiKey:'proxy-only',maxCompletionTokens:3000})]){
   const chatCtx=new llm.ChatContext();chatCtx.addMessage({role:'user',content:'Synthetic French greeting'});
   const stream=model.chat({chatCtx,connOptions:{maxRetry:0,timeoutMs:5000,retryIntervalMs:1}});
   try{let text='';for await(const chunk of stream)text+=chunk.delta?.content??'';assert.equal(text,'Bonjour.');}
   finally{await stream.close();await model.aclose();}
  }
  const tts=new eleven.TTS({model:'eleven_multilingual_v2',voiceId:'VoiceFixture',baseURL:proxy.elevenlabsBaseURL,apiKey:'proxy-only',encoding:'pcm_24000',languageCode:'fr',enableLogging:false,voiceSettings:{stability:0.5,similarity_boost:0.75,use_speaker_boost:true}});
  const synthesis=tts.synthesize('Bonjour.');
  try{let frames=0;for await(const part of synthesis)if(part.frame)frames++;assert.ok(frames>0);}
  finally{await synthesis.close();}
  const stt=new deepgram.STT({model:'nova-3',language:'multi',baseUrl:proxy.deepgramBaseURL,apiKey:'proxy-only',sampleRate:16000,numChannels:1,mipOptOut:true});
  recognition=stt.stream();recognition.pushFrame(new AudioFrame(new Int16Array(3200),16000,1,3200));
  await until(()=>connections.length===1);await until(()=>connections[0].socket.sent.some(frame=>frame.binary));
  assert.equal(descriptors.at(-1).model,'nova-3');assert.equal(descriptors.at(-1).configuration.parameters.language,'multi');assert.equal(descriptors.at(-1).quantities.audioMillis,120000);
  assert.ok(connections[0].url.startsWith('wss://api.deepgram.com/v1/listen?'));
  assert.equal(connections[0].options.headers.Authorization,`Token ${credentials.deepgram}`);
  assert.equal(outbound.length,3);assert.equal(descriptors.length,4);
  assert.equal(descriptors[0].quantities.outputTokens,3000);assert.equal(descriptors[1].quantities.outputTokens,3000);assert.equal(descriptors[2].quantities.textBytes,8);
  assert.equal(outbound[0].body.max_tokens,3000);assert.equal(outbound[1].body.max_completion_tokens,3000);
  for(let n=0;n<2;n++)assert.equal(descriptors[n].quantities.inputBytes,Buffer.byteLength(outbound[n].rawBody));
  assert.equal(outbound[0].headers.get('x-api-key'),credentials.anthropic);assert.equal(outbound[0].headers.get('anthropic-version'),'2023-06-01');
  assert.equal(outbound[1].headers.get('authorization'),`Bearer ${credentials.openai}`);assert.equal(outbound[2].headers.get('xi-api-key'),credentials.elevenlabs);
  assert.equal(new URL(outbound[2].url).searchParams.get('enable_logging'),'false');
 }finally{recognition?.close();stop.abort();await proxy.close();}
});
