/** Ephemeral bounded decoding. Container bytes are never a duration estimate. */
import {spawn} from 'node:child_process';
import {readFile,realpath,stat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {sniffAudio} from './toneperfect.ts';
export interface DecodedAudio {wav:Uint8Array;audioMillis:number}
let active=0;
const verified=new Map<string,Promise<string>>();
async function executable(env:Record<string,string|undefined>):Promise<string> {
 const path=env.LUVANI_AUDIO_DECODER_PATH,sha=env.LUVANI_AUDIO_DECODER_SHA256;
 if(!path || !isAbsolute(path) || !/^[a-f0-9]{64}$/.test(sha??''))throw new Error('audio-decoder-unconfigured');
 const key=`${path}:${sha}`;let work=verified.get(key);
 if(!work){work=(async()=>{const resolved=await realpath(path);const info=await stat(resolved);if(!info.isFile() || info.size>128*1024*1024 || !(info.mode&0o111))throw new Error('invalid-audio-decoder');
  if(createHash('sha256').update(await readFile(resolved)).digest('hex')!==sha)throw new Error('audio-decoder-mismatch');return resolved;})();verified.set(key,work);work.catch(()=>verified.delete(key));}
 return work;
}
export function pcmWav(pcm:Uint8Array):Uint8Array {
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}
/** Two decoders per process, 2MiB compressed, 30s mono PCM, 5s wall time.
 * Runtime container must provide a reviewed immutable binary and CPU/memory limits.
 * Unsupported/nonseekable encodings refuse rather than forwarding unchecked audio.
 * Anonymous guest speech may hold at most one of the two (token-server onboardingSpeech.ts).
 */
export async function decodeAudio(audio:Uint8Array,options:{env?:Record<string,string|undefined>;signal?:AbortSignal;timeoutMs?:number}={}):Promise<DecodedAudio> {
 if(audio.length<1 || audio.length>2097152 || sniffAudio(audio).mime==='application/octet-stream' || active>=2)throw new Error('audio-input-refused');
 const timeout=options.timeoutMs??5000;if(!Number.isInteger(timeout) || timeout<1 || timeout>5000)throw new Error('invalid-audio-deadline');
 active++;let childOwnsSlot=false;
 try {
  const program=await executable(options.env??process.env);options.signal?.throwIfAborted();
  return await new Promise((resolve,reject)=>{
   const child=spawn(program,['-hide_banner','-loglevel','error','-nostdin','-threads','1','-filter_threads','1','-max_alloc','16777216','-protocol_whitelist','pipe','-format_whitelist','wav,mov,matroska,webm,ogg,mp3','-i','pipe:0','-map','0:a:0','-vn','-sn','-dn','-t','30.001','-ac','1','-ar','16000','-f','s16le','pipe:1'],{stdio:['pipe','pipe','ignore'],env:{PATH:'/usr/bin:/bin'},windowsHide:true});
   childOwnsSlot=true;child.once('close',()=>{active--;});
   const chunks:Buffer[]=[];let size=0,settled=false;
   const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);if(error){child.kill('SIGKILL');reject(error);}else if(size<2 || size%2 || size>960000)reject(new Error('audio-duration-refused'));else resolve({wav:pcmWav(Buffer.concat(chunks)),audioMillis:Math.ceil(size/32)});};
   const cancel=()=>finish(new Error('audio-decode-stopped'));const timer=setTimeout(cancel,timeout);options.signal?.addEventListener('abort',cancel,{once:true});
   child.once('error',()=>finish(new Error('audio-decoder-unavailable')));child.once('close',code=>finish(code===0?undefined:new Error('audio-decode-refused')));
   child.stdout.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>960000)finish(new Error('audio-duration-refused'));else chunks.push(chunk);});
   child.stdin.on('error',()=>finish(new Error('audio-decode-refused')));child.stdin.end(audio);
   if(options.signal?.aborted)cancel();
  });
 } finally {if(!childOwnsSlot)active--;}
}
