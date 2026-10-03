/** Web preview: bounded memory URLs only; no shared browser persistence. */
import type { PhraseAudioFiles } from './phraseAudioCache.ts';
const entries=new Map<string,{key:string;uri:string;bytes:number;usedAt:number}>();
let sequence=0;
export const phraseAudioFiles:PhraseAudioFiles={
  entries:async()=>[...entries.values()].filter(row=>row.key!==''),
  temporary:async bytes=>{const uri=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'audio/wav'}));entries.set(uri,{key:'',uri,bytes:bytes.length,usedAt:++sequence});return uri;},
  commit:async(uri,key)=>{const row=entries.get(uri);if(!row)throw new Error('Audio unavailable');row.key=key;return uri;},
  touch:async key=>{for(const row of entries.values())if(row.key===key)row.usedAt=++sequence;},
  remove:async uri=>{URL.revokeObjectURL(uri);entries.delete(uri);},
  clear:async()=>{for(const uri of entries.keys())URL.revokeObjectURL(uri);entries.clear();},
};
