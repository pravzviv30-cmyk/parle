/** Reviewed binary bytes, executable startup and synthetic duration limits only. */
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AUDIO_DECODER_FIXTURES} from '../services/shared/audioDecoderFixtures.ts';
import {decodeAudio,pcmWav} from '../services/shared/audioDecode.ts';
const path=process.env.LUVANI_AUDIO_DECODER_PATH,sha=process.env.LUVANI_AUDIO_DECODER_SHA256;
if(path!=='/usr/local/bin/luvani-ffmpeg' || !/^[a-f0-9]{64}$/.test(sha??''))throw new Error('Reviewed immutable decoder path/hash required');
const info=await stat(path);if(!info.isFile() || info.size<1 || info.size>128*1024*1024 || !(info.mode&0o111) || (info.mode&0o022))throw new Error('Decoder must be an immutable executable regular file');
if(createHash('sha256').update(await readFile(path)).digest('hex')!==sha)throw new Error('Decoder bytes differ from reviewed artifact');
const version=spawnSync(path,['-version'],{encoding:'utf8',timeout:2000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin'}});
if(version.status!==0 || !version.stdout.startsWith('ffmpeg version '))throw new Error('Decoder cannot execute on actual runtime');
const decoded=await decodeAudio(pcmWav(new Uint8Array(32000)));if(decoded.audioMillis!==1000)throw new Error('Decoder synthetic PCM verification failed');
for(const value of Object.values(AUDIO_DECODER_FIXTURES)) {const result=await decodeAudio(Buffer.from(value,'base64'));if(result.audioMillis<900 || result.audioMillis>1100)throw new Error('Compressed synthetic decoder verification failed');}
let refused=false;try{await decodeAudio(pcmWav(new Uint8Array(992000)));}catch{refused=true;}if(!refused)throw new Error('Decoder accepted overlong synthetic audio');
console.log(JSON.stringify({version:1,status:'passed',platform:process.platform,architecture:process.arch,decoderSha256:sha,versionOutputSha256:createHash('sha256').update(version.stdout).digest('hex'),syntheticMillis:1000,compressedFixtures:Object.keys(AUDIO_DECODER_FIXTURES),over30SecondsRefused:true,paidCalls:0}));
