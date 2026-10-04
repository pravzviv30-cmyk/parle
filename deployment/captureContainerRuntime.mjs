/** Explicit offline Docker capture. No pull, credentials, networking or deployment. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const execute=promisify(execFile),sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw new Error('runtime-capture-refused: actual local candidate image/labels/platform or runtime proof differs');};
export async function captureContainerRuntime(candidate,run=async args=>(await execute('docker',args,{timeout:60000,maxBuffer:8*1024*1024})).stdout) {
 const image=candidate.image,platform=candidate.acceptance?.containerArtifact?.platform;
 if(typeof image!=='string'||!/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(image)||!['linux/amd64','linux/arm64'].includes(platform)||!/^[a-f0-9]{40}$/.test(candidate.gitSha??''))fail();
 const inspections=JSON.parse(await run(['image','inspect',image]));if(!Array.isArray(inspections)||inspections.length!==1)fail();
 const i=inspections[0],labels=i.Config?.Labels,architecture=platform.split('/')[1];
 if(i.Os!=='linux'||i.Architecture!==architecture||!i.RepoDigests?.includes(image)||!/^sha256:[a-f0-9]{64}$/.test(i.Id??'')||labels?.['org.opencontainers.image.revision']!==candidate.gitSha||labels['org.opencontainers.image.base.name']!==candidate.baseImage||labels['io.luvani.audio-decoder.image']!==candidate.audioDecoder?.image||labels['io.luvani.audio-decoder.sha256']!==candidate.audioDecoder?.sha256)fail();
 const common=['run','--rm','--pull=never','--platform',platform,'--network','none','--read-only','--cap-drop=ALL','--security-opt','no-new-privileges:true','--user','node','--memory','512m','--cpus','1','--pids-limit','128','--tmpfs','/tmp:rw,nosuid,noexec,size=32m','--entrypoint','node',image];
 const nativeBytes=await run([...common,'deployment/nativeArtifacts.mjs','--verify']);
 const decoderBytes=await run([...common,'deployment/verifyAudioDecoder.mjs']);
 const native=JSON.parse(nativeBytes),decoder=JSON.parse(decoderBytes);
 return {nativeBytes,decoderBytes,capture:{version:1,image,gitSha:candidate.gitSha,platform,
  imageId:i.Id,inspectedRepoDigests:[image],revision:labels['org.opencontainers.image.revision'],baseImage:candidate.baseImage,audioDecoder:candidate.audioDecoder,
  nativeSha256:sha256(nativeBytes),decoderSha256:sha256(decoderBytes),native,decoder,authenticityIndependentlyVerified:false}};
}
async function main(args) {
 if(args.length!==2)throw new Error('Usage: node deployment/captureContainerRuntime.mjs CANDIDATE NEW_OUTPUT_DIRECTORY');
 const candidate=JSON.parse(await readFile(resolve(args[0]),'utf8'));
 const result=await captureContainerRuntime(candidate);
 const directory=resolve(args[1]);await mkdir(directory,{mode:0o700});
 for(const [name,bytes]of [['native.json',result.nativeBytes],['decoder.json',result.decoderBytes],['runtime.json',JSON.stringify(result.capture,null,2)+'\n']])await writeFile(resolve(directory,name),bytes,{flag:'wx',mode:0o600});
 console.log('Offline candidate runtime capture saved; authenticity and five-role acceptance still require independent review.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(()=>{console.error('Runtime capture failed; no deployment performed.');process.exitCode=1;});
