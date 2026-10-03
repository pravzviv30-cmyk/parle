/** Serialized private cache; no phrase text or vendor identity enters a filename. */
export interface PhraseAudioFile { key: string; uri: string; bytes: number; usedAt: number }
export interface PhraseAudioFiles {
  entries(): Promise<PhraseAudioFile[]>;
  temporary(bytes: Uint8Array): Promise<string>;
  commit(temporary: string, key: string): Promise<string>;
  touch(key: string): Promise<void>;
  remove(uri: string): Promise<void>;
  clear(): Promise<void>;
}
export const MAX_PRIVATE_PHRASE_AUDIO_BYTES = 882044;
export function isPhraseAudioWav(bytes: Uint8Array): boolean {
  if (bytes.length < 46 || bytes.length > MAX_PRIVATE_PHRASE_AUDIO_BYTES || bytes.length % 2) return false;
  const text=(at:number,n:number)=>String.fromCharCode(...bytes.subarray(at,at+n));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return text(0,4)==='RIFF' && text(8,8)==='WAVEfmt ' && text(36,4)==='data' && view.getUint32(4,true)===bytes.length-8 &&
    view.getUint32(16,true)===16 && view.getUint16(20,true)===1 && view.getUint16(22,true)===1 && view.getUint32(24,true)===22050 &&
    view.getUint32(28,true)===44100 && view.getUint16(32,true)===2 && view.getUint16(34,true)===16 && view.getUint32(40,true)===bytes.length-44;
}
export function createPhraseAudioCache(files: PhraseAudioFiles, maxEntries=20, maxBytes=8*1024*1024) {
  let queue: Promise<unknown>=Promise.resolve(), epoch=0;
  function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work);queue=next.catch(()=>{});return next;}
  const keyOk=(key:string)=>/^[0-9a-f]{64}$/.test(key);
  return {
    read: (key:string,current:()=>boolean):Promise<string|null>=> {
      const observed=epoch;
      return serial(async()=>{
        if(!keyOk(key)||observed!==epoch||!current())return null;
        const rows=await files.entries();
        const row=rows.find(row=>row.key===key&&row.bytes>=46&&row.bytes<=MAX_PRIVATE_PHRASE_AUDIO_BYTES);
        if(!row||observed!==epoch||!current())return null;
        await files.touch(key);
        return observed===epoch&&current()?row.uri:null;
      });
    },
    put: (key:string,bytes:Uint8Array,current:()=>boolean):Promise<string|null>=> {
      const observed=epoch;
      return serial(async()=>{
        if(!keyOk(key)||!isPhraseAudioWav(bytes)||observed!==epoch||!current())return null;
        const rows=(await files.entries()).sort((a,b)=>a.usedAt-b.usedAt);
        for(const row of rows.filter(row=>row.key===key)){await files.remove(row.uri);}
        const retained=rows.filter(row=>row.key!==key);
        let total=retained.reduce((sum,row)=>sum+row.bytes,0);
        while(retained.length>=maxEntries||total+bytes.length>maxBytes){const oldest=retained.shift();if(!oldest)return null;await files.remove(oldest.uri);total-=oldest.bytes;}
        if(observed!==epoch||!current())return null;
        let temporary:string|null=null,committed:string|null=null;
        try{
          temporary=await files.temporary(bytes);
          if(observed!==epoch||!current())return null;
          committed=await files.commit(temporary,key);temporary=null;
          if(observed!==epoch||!current())return null;
          await files.touch(key);
          if(observed!==epoch||!current())return null;
          return committed;
        }finally{
          if(temporary)await files.remove(temporary);
          if(committed&&(observed!==epoch||!current()))await files.remove(committed);
        }
      });
    },
    discard: (key:string):Promise<void>=>serial(async()=>{if(!keyOk(key))return;for(const row of await files.entries())if(row.key===key)await files.remove(row.uri);}),
    reset: ():Promise<void>=>{epoch++;return serial(()=>files.clear());},
  };
}
