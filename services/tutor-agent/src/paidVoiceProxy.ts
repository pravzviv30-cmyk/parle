/** Per-job loopback transport: each real vendor attempt crosses paid admission.
 * No transcript, audio, URL, header or provider error is logged by this module.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { EventEmitter, once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { assertPaidDispatch, paidProviderFetch, type PaidDescriptor, type PaidGate } from '../../shared/paidExecution.ts';

export interface VendorSocket extends EventEmitter {
  readyState: number; bufferedAmount: number;
  send(data: Buffer | string, options: { binary: boolean }, callback?: (error?: Error) => void): void;
  close(code?: number, reason?: string): void; terminate(): void;
}
type SocketOptions = { headers: Record<string,string>; maxPayload: number; perMessageDeflate: false; handshakeTimeout: number; followRedirects: false };
type WsServer = { handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, callback:(client:VendorSocket)=>void): void; close(callback:()=>void):void };
const Ws = createRequire(import.meta.url)('ws') as {
  new(url:string,options:SocketOptions):VendorSocket;
  WebSocketServer: new(options:{noServer:true;maxPayload:number;perMessageDeflate:false} )=>WsServer;
};
export interface PaidVoiceProxyOptions {
  gate: PaidGate;
  signal: AbortSignal;
  maximumSessionMillis: number;
  credentials: { deepgram?:string; elevenlabs?:string; anthropic?:string; openai?:string };
  /** Local fixtures inject a transport; destinations and descriptors stay fixed. */
  request?: typeof fetch;
  websocketConnector?: (url:string,options:SocketOptions)=>VendorSocket;
  /** Guest scene only: TTS text must pass this exact-bytes check, and every model route is refused. */
  speechAllowList?: (text:string)=>boolean;
}
export interface PaidVoiceProxy {
  deepgramBaseURL:string; elevenlabsBaseURL:string; anthropicBaseURL:string; openaiBaseURL:string;
  close():Promise<void>;
}
const BODY_LIMIT=2*1024*1024, WS_REPLY_LIMIT=128*1024, BUFFER_LIMIT=256*1024;
let activeTransports=0;
const object=(value:unknown):value is Record<string,unknown>=>!!value && typeof value==='object' && !Array.isArray(value);
function target(raw:string|undefined):URL {
  if(!raw || raw.length>2048 || !raw.startsWith('/') || raw.startsWith('//') || /[\\\x00-\x20\x7f]/.test(raw))throw new Error('invalid-route');
  const url=new URL(raw,'http://127.0.0.1');
  if(raw!==url.pathname+url.search || url.hash)throw new Error('invalid-route');
  return url;
}
function parameters(url:URL,allowed:readonly string[]):Record<string,string> {
  const entries=[...url.searchParams];
  if(entries.length>32 || new Set(entries.map(([key])=>key)).size!==entries.length || entries.some(([key,value])=>!allowed.includes(key) || value.length>128))throw new Error('invalid-parameters');
  return Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)));
}
export function describeStreamingDeepgram(url:URL,maximumSessionMillis:number):PaidDescriptor {
  if(!Number.isInteger(maximumSessionMillis) || maximumSessionMillis<1 || maximumSessionMillis>900000)throw new Error('invalid-session-bound');
  const params=parameters(url,['model','language','encoding','sample_rate','channels','punctuate','smart_format','dictation','diarize','numerals','no_delay','interim_results','vad_events','endpointing','filler_words','profanity_filter','utterance_end_ms','mip_opt_out']);
  if(params.encoding!=='linear16' || params.sample_rate!=='16000' || params.channels!=='1' || params.mip_opt_out!=='true'
    || !/^nova-[23](?:-[a-z]+)?$/.test(params.model??'') || !/^(?:fr|fr-FR|fr-CA|en|en-US|en-GB|multi)$/.test(params.language??'')
    || params.language==='multi' && params.model!=='nova-3')throw new Error('unsupported-stt');
  for(const [key,value]of Object.entries(params)) {
    if(['model','language','encoding','sample_rate','channels'].includes(key))continue;
    if(['endpointing','utterance_end_ms'].includes(key)){if(value!=='false' && (!/^\d{1,5}$/.test(value) || Number(value)>10000))throw new Error('invalid-stt-setting');}
    else if(value!=='true' && value!=='false')throw new Error('invalid-stt-setting');
  }
  return {kind:'stt',provider:'deepgram',model:params.model!,voice:'',configuration:{parameters:params},quantities:{inputBytes:0,outputTokens:0,audioMillis:maximumSessionMillis,textBytes:0}};
}
function checkEleven(url:URL,body:string):void {
  const params=parameters(url,['output_format','optimize_streaming_latency','enable_logging']);
  if(!/^pcm_(?:16000|22050|24000|44100|48000)$/.test(params.output_format??'') || params.enable_logging!=='false'
    || params.optimize_streaming_latency!==undefined && !/^[0-4]$/.test(params.optimize_streaming_latency))throw new Error('unsupported-tts');
  const value:unknown=JSON.parse(body);
  if(!object(value) || Object.keys(value).some(key=>!['text','model_id','language_code','voice_settings','apply_text_normalization','apply_language_text_normalization'].includes(key))
    || typeof value.text!=='string' || !value.text.trim() || Buffer.byteLength(value.text)>8192
    || typeof value.model_id!=='string' || !/^eleven_[a-z0-9_]{1,64}$/.test(value.model_id)
    || value.language_code!==undefined && !['fr','en'].includes(String(value.language_code))
    || value.apply_text_normalization!==undefined && value.apply_text_normalization!=='auto'
    || value.apply_language_text_normalization!==undefined && typeof value.apply_language_text_normalization!=='boolean')throw new Error('unsupported-tts');
  if(value.voice_settings!==undefined) {
    if(!object(value.voice_settings) || Object.entries(value.voice_settings).some(([key,setting])=>
      !['stability','similarity_boost','style','speed','use_speaker_boost'].includes(key) || (key==='use_speaker_boost' ? typeof setting!=='boolean' : typeof setting!=='number' || !Number.isFinite(setting) || setting<(key==='speed'?0.7:0) || setting>(key==='speed'?1.2:1))))throw new Error('unsupported-voice-settings');
  }
}
function bytes(data:unknown):Buffer {
  if(Buffer.isBuffer(data))return data;
  if(data instanceof ArrayBuffer)return Buffer.from(data);
  if(Array.isArray(data) && data.every(Buffer.isBuffer))return Buffer.concat(data);
  throw new Error('invalid-frame');
}
function refused(res:ServerResponse,status=503):void {
  if(res.headersSent || res.destroyed || res.writableEnded){if(!res.writableEnded)res.destroy();return;}
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','connection':'close'});
  res.end('{"error":{"message":"Provider transport unavailable","type":"server_error"}}');
}
function stopped<T>(work:Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted){void work.catch(()=>{});return Promise.reject(new Error('transport-stopped'));}
  return new Promise<T>((resolve,reject)=>{
    const stop=()=>{signal.removeEventListener('abort',stop);reject(new Error('transport-stopped'));};
    signal.addEventListener('abort',stop,{once:true});
    work.then(value=>{signal.removeEventListener('abort',stop);resolve(value);},()=>{signal.removeEventListener('abort',stop);reject(new Error('transport-unavailable'));});
  });
}
/** The SDK receives only these opaque local base URLs and dummy vendor keys. */
export async function createPaidVoiceProxy(options:PaidVoiceProxyOptions):Promise<PaidVoiceProxy> {
  if(!Number.isInteger(options.maximumSessionMillis) || options.maximumSessionMillis<1 || options.maximumSessionMillis>900000)throw new Error('invalid-session-bound');
  options.signal.throwIfAborted();
  const prefix=`/${randomUUID()}`,controller=new AbortController();
  const signal=AbortSignal.any([options.signal,controller.signal]);
  const transport=paidProviderFetch(options.gate,options.request??fetch,30000);
  const connector=options.websocketConnector??((url,config)=>new Ws(url,config));
  const sockets=new Set<VendorSocket>(),controllers=new Set<AbortController>();
  let activeHttp=0,activeStreams=0,totalAudioBytes=0,closed=false;
  const wss=new Ws.WebSocketServer({noServer:true,maxPayload:BUFFER_LIMIT,perMessageDeflate:false});
  const server=createServer({maxHeaderSize:8192},(req,res)=>{void http(req,res).catch(()=>refused(res));});
  server.maxConnections=8;server.requestTimeout=10000;server.headersTimeout=5000;server.keepAliveTimeout=1000;
  async function http(req:IncomingMessage,res:ServerResponse):Promise<void> {
    let url:URL;try{url=target(req.url);}catch{refused(res,404);return;}
    const match=url.pathname.match(new RegExp(`^${prefix}/(anthropic/v1/messages|openai/v1/chat/completions|elevenlabs/v1/text-to-speech/[A-Za-z0-9_-]{1,128}/stream)$`));
    if(!match || req.method!=='POST' || signal.aborted){refused(res,404);return;}
    if(activeHttp>=4 || activeTransports>=64){refused(res,429);return;}
    if(!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(req.headers['content-type']??'') || req.headers['content-encoding'] && req.headers['content-encoding']!=='identity'){refused(res,400);return;}
    const declared=req.headers['content-length'];
    if(declared!==undefined && (!/^\d+$/.test(declared) || Number(declared)>BODY_LIMIT)){refused(res,413);return;}
    activeHttp++;activeTransports++;
    const job=new AbortController(),joined=AbortSignal.any([signal,job.signal]);controllers.add(job);
    const timer=setTimeout(()=>job.abort(),35000);
    const disconnected=()=>{if(!res.writableEnded)job.abort();};
    req.once('aborted',disconnected);res.once('close',disconnected);
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    try{
      const raw=await stopped((async()=>{const chunks:Buffer[]=[];let length=0;for await(const chunk of req){const part=Buffer.from(chunk as Buffer);length+=part.length;if(length>BODY_LIMIT)throw new Error('body-limit');chunks.push(part);}return Buffer.concat(chunks).toString('utf8');})(),joined);
      joined.throwIfAborted();
      const route=match[1]!,provider=route.split('/')[0] as 'anthropic'|'openai'|'elevenlabs';
      const credential=options.credentials[provider];if(!credential || /[\r\n]/.test(credential))throw new Error('unconfigured-provider');
      const path=route.slice(provider.length),vendor=new URL(`https://${provider==='elevenlabs'?'api.elevenlabs.io':provider==='anthropic'?'api.anthropic.com':'api.openai.com'}${path}${url.search}`);
      if(options.speechAllowList && provider!=='elevenlabs')throw new Error('scene-route');
      if(provider==='elevenlabs'){checkEleven(vendor,raw);if(options.speechAllowList && !options.speechAllowList(String((JSON.parse(raw) as {text:unknown}).text)))throw new Error('scene-text');}
      else if(url.search)throw new Error('invalid-parameters');
      const headers:Record<string,string>={'content-type':'application/json'};
      if(provider==='elevenlabs')headers['xi-api-key']=credential;
      else if(provider==='anthropic'){headers['x-api-key']=credential;headers['anthropic-version']='2023-06-01';}
      else headers.authorization=`Bearer ${credential}`;
      const response=await transport(vendor,{method:'POST',headers,body:raw,signal:joined});
      joined.throwIfAborted();
      if(!response.ok){await response.body?.cancel();refused(res);return;}
      res.writeHead(200,{'content-type':response.headers.get('content-type')??'application/octet-stream','cache-control':'no-store'});
      reader=response.body?.getReader();
      if(reader)for(;;){const part=await stopped(reader.read(),joined);if(part.done)break;if(res.writableLength+part.value.byteLength>BUFFER_LIMIT)throw new Error('response-backpressure');if(!res.write(part.value))await once(res,'drain',{signal:joined});}
      res.end();
    }catch{refused(res);}finally{
      job.abort();clearTimeout(timer);controllers.delete(job);req.removeListener('aborted',disconnected);res.removeListener('close',disconnected);
      void reader?.cancel().catch(()=>{});activeHttp--;activeTransports--;
    }
  }
  server.on('upgrade',(req,socket,head)=>{void upgrade(req,socket,head).catch(()=>socket.destroy());});
  async function upgrade(req:IncomingMessage,socket:Duplex,head:Buffer):Promise<void> {
    let url:URL;try{url=target(req.url);}catch{socket.destroy();return;}
    if(req.method!=='GET' || url.pathname!==`${prefix}/deepgram/v1/listen` || signal.aborted || activeStreams>=2 || activeTransports>=64 || head.length>BUFFER_LIMIT){socket.destroy();return;}
    let descriptor:PaidDescriptor;try{descriptor=describeStreamingDeepgram(url,options.maximumSessionMillis);}catch{socket.destroy();return;}
    const credential=options.credentials.deepgram;if(!credential || /[\r\n]/.test(credential)){socket.destroy();return;}
    activeStreams++;activeTransports++;socket.pause();
    const job=new AbortController();controllers.add(job);const joined=AbortSignal.any([signal,job.signal]);
    const timer=setTimeout(()=>job.abort(),8000);
    let upstream:VendorSocket|undefined,client:VendorSocket|undefined,allowedSignal:AbortSignal|undefined,finished=false;
    const finish=()=>{
      if(finished)return;finished=true;joined.removeEventListener('abort',finish);allowedSignal?.removeEventListener('abort',finish);socket.removeListener('close',finish);job.abort();clearTimeout(timer);controllers.delete(job);activeStreams--;activeTransports--;
      for(const stream of [upstream,client])if(stream){sockets.delete(stream);stream.terminate();}
      socket.destroy();
    };
    socket.once('close',finish);joined.addEventListener('abort',finish,{once:true});
    try{
      const allowed=await stopped(options.gate(descriptor,joined),joined);assertPaidDispatch(allowed);joined.throwIfAborted();
      allowedSignal=allowed;allowed.addEventListener('abort',finish,{once:true});
      const vendor=new URL(`wss://api.deepgram.com/v1/listen${url.search}`);
      assertPaidDispatch(allowed);
      upstream=connector(vendor.href,{headers:{Authorization:`Token ${credential}`},maxPayload:WS_REPLY_LIMIT,perMessageDeflate:false,handshakeTimeout:5000,followRedirects:false});
      if(finished || joined.aborted || allowed.aborted){upstream.terminate();return;}
      sockets.add(upstream);upstream.on('error',finish);upstream.once('close',finish);
      const pending:Buffer[]=[];let pendingBytes=0,connectionBytes=0;
      const forward=(to:VendorSocket,frame:Buffer,binary:boolean)=>{try{assertPaidDispatch(allowed);}catch{finish();return;}if(to.readyState!==1 || to.bufferedAmount+frame.length>BUFFER_LIMIT){finish();return;}to.send(frame,{binary},error=>{if(error)finish();});};
      upstream.on('message',(data:unknown,binary:boolean)=>{try{const frame=bytes(data);if(binary || frame.length>WS_REPLY_LIMIT){finish();return;}if(client)forward(client,frame,false);else{pendingBytes+=frame.length;if(pendingBytes>BUFFER_LIMIT){finish();return;}pending.push(frame);}}catch{finish();}});
      if(upstream.readyState!==1)await stopped(new Promise<void>((resolve,reject)=>{upstream!.once('open',resolve);upstream!.once('error',()=>reject(new Error('connect-unavailable')));upstream!.once('close',()=>reject(new Error('connect-unavailable')));}),joined);
      joined.throwIfAborted();allowed.throwIfAborted();clearTimeout(timer);
      wss.handleUpgrade(req,socket,head,local=>{
        if(finished){local.terminate();return;}
        client=local;sockets.add(local);local.on('error',finish);local.once('close',finish);
        let commandTokens=20,lastCommand=performance.now();
        local.on('message',(data:unknown,binary:boolean)=>{
          try{
            const frame=bytes(data);if(finished || joined.aborted || allowed.aborted){finish();return;}
            if(binary){
              if(!frame.length || frame.length%2 || frame.length>BUFFER_LIMIT || connectionBytes+frame.length>options.maximumSessionMillis*32 || totalAudioBytes+frame.length>options.maximumSessionMillis*32){finish();return;}
              connectionBytes+=frame.length;totalAudioBytes+=frame.length;
            }else{
              if(frame.length>64){finish();return;}
              const value:unknown=JSON.parse(frame.toString('utf8'));
              if(!object(value) || Object.keys(value).length!==1 || !['KeepAlive','Finalize','CloseStream'].includes(String(value.type))){finish();return;}
              const now=performance.now();commandTokens=Math.min(20,commandTokens+(now-lastCommand)/100);lastCommand=now;
              if(commandTokens<1){finish();return;}commandTokens--;
            }
            forward(upstream!,frame,binary);
          }catch{finish();}
        });
        for(const frame of pending)forward(local,frame,false);
        socket.resume();
      });
    }catch{finish();}
  }
  let closing:Promise<void>|undefined;
  const close=():Promise<void>=>closing??=Promise.resolve().then(async()=>{
    closed=true;controller.abort();for(const job of controllers)job.abort();for(const socket of sockets)socket.terminate();
    server.closeAllConnections();
    try{await stopped(Promise.all([new Promise<void>(resolve=>server.close(()=>resolve())),new Promise<void>(resolve=>wss.close(()=>resolve()))]),AbortSignal.timeout(2000));}
    catch{server.closeAllConnections();for(const socket of sockets)socket.terminate();}
  });
  signal.addEventListener('abort',()=>{void close();},{once:true});
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
    if(closed || signal.aborted)throw new Error('session-stopped');
    const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}${prefix}`;
    return {deepgramBaseURL:origin.replace(/^http/,'ws')+'/deepgram',elevenlabsBaseURL:origin+'/elevenlabs/v1',anthropicBaseURL:origin+'/anthropic',openaiBaseURL:origin+'/openai/v1',close};
  }catch(error){await close();throw error;}
}
