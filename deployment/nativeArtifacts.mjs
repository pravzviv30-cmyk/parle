/** Offline imports + installed native-byte inventory; no voice/provider calls. */
import { readdir, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
const root=resolve(new URL('../',import.meta.url).pathname),args=process.argv.slice(2);
const require=createRequire(new URL('../services/tutor-agent/package.json',import.meta.url));
if(args.includes('--verify')) {
  for(const name of ['@livekit/rtc-node','@livekit/local-inference','onnxruntime-node'])require(name);
}
const paths=[];
async function walk(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())await walk(path);
    else if(entry.isFile() && /\.(?:node|onnx|so(?:\.\d+)*|dylib|dll)$/i.test(entry.name))paths.push(path);
  }
}
for(const directory of ['node_modules','services/tutor-agent/node_modules']) {
  try{await walk(resolve(root,directory));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const artifacts=[];
for(const path of paths.sort()) {
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
  artifacts.push({path:relative(root,path),bytes:(await stat(path)).size,sha256:hash.digest('hex')});
}
if(!artifacts.length)throw new Error('No native runtime/model artifacts found');
let decoder;
if(process.env.LUVANI_AUDIO_DECODER_PATH) {
 const path=process.env.LUVANI_AUDIO_DECODER_PATH;const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);const sha256=hash.digest('hex');if(sha256!==process.env.LUVANI_AUDIO_DECODER_SHA256)throw new Error('Decoder artifact changed');decoder={path,bytes:(await stat(path)).size,sha256};
}
const manifest={version:1,...(decoder?{decoder}:{}),nodeVersion:process.versions.node,platform:process.platform,architecture:process.arch,artifacts};
const output=args.indexOf('--output');
if(output>=0 && args[output+1])await writeFile(resolve(args[output+1]),`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx',mode:0o644});
else console.log(JSON.stringify(manifest));
