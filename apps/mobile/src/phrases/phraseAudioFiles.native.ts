/** App-private cache only. Expo 57 File/Directory API, no external storage. */
import { Directory, File, Paths } from 'expo-file-system';
import type { PhraseAudioFiles } from './phraseAudioCache.ts';
import { isPhraseAudioWav, MAX_PRIVATE_PHRASE_AUDIO_BYTES } from './phraseAudioCache.ts';
const root=new Directory(Paths.cache,'luvani-phrase-audio-v1');
let sequence=0;
function prepare(){if(!root.exists)root.create({idempotent:true,intermediates:true});}
export const phraseAudioFiles:PhraseAudioFiles={
  entries:async()=>{
    prepare();const rows=[];
    for(const entry of root.list()){
      if(!(entry instanceof File)||!/^[0-9a-f]{64}\.wav$/.test(entry.name)||entry.size<46||entry.size>MAX_PRIVATE_PHRASE_AUDIO_BYTES){
        if(!entry.name.endsWith('.used'))entry.delete();continue;
      }
      const key=entry.name.slice(0,-4),used=new File(root,`${key}.used`);
      if(!isPhraseAudioWav(entry.bytesSync())){entry.delete();if(used.exists)used.delete();continue;}
      const touched=used.exists&&used.size<=32?Number(used.textSync()):NaN;
      rows.push({key,uri:entry.uri,bytes:entry.size,usedAt:Number.isFinite(touched)?touched:entry.modificationTime??0});
    }
    // Orphan metadata contains no words; recover it after process interruption.
    const valid=new Set(rows.map(row=>`${row.key}.used`));
    for(const entry of root.list())if(entry.name.endsWith('.used')&&!valid.has(entry.name))entry.delete();
    return rows;
  },
  temporary:async bytes=>{prepare();const file=new File(root,`pending-${Date.now()}-${++sequence}.tmp`);file.write(bytes);return file.uri;},
  commit:async(uri,key)=>{const temp=new File(uri),target=new File(root,`${key}.wav`);await temp.move(target,{overwrite:true});return target.uri;},
  touch:async key=>{prepare();new File(root,`${key}.used`).write(String(Date.now()));},
  remove:async uri=>{const file=new File(uri);if(file.exists)file.delete();if(/^[0-9a-f]{64}\.wav$/.test(file.name)){const used=new File(root,`${file.name.slice(0,-4)}.used`);if(used.exists)used.delete();}},
  clear:async()=>{if(root.exists)root.delete();},
};
