import * as Crypto from 'expo-crypto';
import { isTutorVoiceKey, phraseAudioFrench, readPhraseAudioSource, type PhraseAudioSource, type TutorVoiceKey } from '@luvani/core';
import { auth, authHeaders } from '../auth/adapter.ts';
import { activeUserId, onUserScopeCleanup, onUserScopeReset, scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { createPhraseAudioCache, isPhraseAudioWav } from './phraseAudioCache.ts';
import { phraseAudioFiles } from './phraseAudioFiles.ts';
const cache=createPhraseAudioCache(phraseAudioFiles);
const cancellations=new Set<()=>void>();
onUserScopeReset(()=>{for(const cancel of cancellations)cancel();void cache.reset().catch(()=>{console.error('[luvani] PHRASE_AUDIO_NOT_CLEARED');});});
onUserScopeCleanup(()=>cache.reset());
export interface KeptPhraseAudioRequest { userId:string; owner:number; source:PhraseAudioSource; voice:TutorVoiceKey; french:string; signal:AbortSignal; current:()=>boolean }
/** Only called for an explicit Hear. Returns a private URI, never auto-plays. */
export async function keptPhraseAudio(input:KeptPhraseAudioRequest):Promise<string|null> {
  const controller=new AbortController();
  let cancel:()=>void=()=>{};
  const ended=new Promise<null>(resolve=>{cancel=()=>{controller.abort();resolve(null);};});
  cancellations.add(cancel); input.signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,25_000);
  const current=()=>!controller.signal.aborted&&!input.signal.aborted&&input.current()&&input.owner===scopeGeneration()&&activeUserId()===input.userId;
  const owned=async()=>{const session=await auth.getSession();return current()&&session?.id===input.userId;};
  const hash=(text:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text);
  try {
    return await Promise.race([(async()=>{
      const source=readPhraseAudioSource(input.source),french=phraseAudioFrench(input.french);
      if(!source||!french||!isTutorVoiceKey(input.voice)||!current()||!await owned())return null;
      const headers=await authHeaders();
      if(!current()||!await owned())return null;
      const httpHeaders={'content-type':'application/json','x-luvani-user':encodeURIComponent(input.userId),...headers};
      const manifest=await fetch(`${TOKEN_SERVER}/phrase-audio/manifest`,{method:'POST',redirect:'error',headers:httpHeaders,signal:controller.signal,body:JSON.stringify({source,voice:input.voice})});
      if(!manifest.ok||!current())return null;
      const value:unknown=await manifest.json();
      if(typeof value!=='object'||value===null||Array.isArray(value))return null;
      const data=value as Record<string,unknown>,parsed=readPhraseAudioSource(data.source);
      if(!parsed||parsed.packId!==source.packId||parsed.kind!==source.kind||parsed.index!==source.index||data.voice!==input.voice||data.fr!==french||
        typeof data.frenchHash!=='string'||!/^[0-9a-f]{64}$/.test(data.frenchHash)||typeof data.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(data.fingerprint)||await hash(french)!==data.frenchHash||!current())return null;
      const key=await hash(JSON.stringify([input.userId,source.packId,source.kind,source.index,data.frenchHash,input.voice,data.fingerprint]));
      if(!current())return null;
      const cached=await cache.read(key,current);if(cached)return await owned()?cached:null;
      if(!current()||!await owned())return null;
      const freshHeaders=await authHeaders();
      if(!current()||!await owned())return null;
      const generated=await fetch(`${TOKEN_SERVER}/phrase-audio/generate`,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-luvani-user':encodeURIComponent(input.userId),...freshHeaders},signal:controller.signal,
        body:JSON.stringify({source,voice:input.voice,fingerprint:data.fingerprint,frenchHash:data.frenchHash})});
      if(!generated.ok||!current())return null;
      const declared=generated.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>882044))return null;
      const bytes=new Uint8Array(await generated.arrayBuffer());if(!current()||!isPhraseAudioWav(bytes)||!await owned())return null;
      let uri:string|null=null;
      const written=await writeInUserScope(input.owner,async()=>{uri=await cache.put(key,bytes,current);});
      if(written&&uri&&await owned())return uri;
      if(uri)await cache.discard(key);
      return null;
    })(),ended]);
  }catch{return null;}
  finally{clearTimeout(timer);input.signal.removeEventListener('abort',cancel);cancellations.delete(cancel);}
}
