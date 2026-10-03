/** Phone projection for a server locator, never synthesis authority. */
import { isConversationPack, phraseAudioFrench, readPhraseAudioSource, type ConversationPack, type PhraseAudioSource } from '@luvani/core';
export function sourceForKeptFrench(raw:string,packs:readonly ConversationPack[],userId:string|null):PhraseAudioSource|null {
  const french=phraseAudioFrench(raw);if(!french||!userId)return null;
  const sorted=packs.filter(pack=>isConversationPack(pack)&&pack.state==='ready'&&pack.learnerId===userId&&pack.id===pack.sessionId&&Number.isFinite(Date.parse(pack.createdAt))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  for(const pack of sorted){
    for(const [kind,items]of [['phrase',pack.keyPhrases.map(phrase=>phrase.fr)],['correction',pack.corrections.map(correction=>correction.better)]]as const){
      const index=items.findIndex(value=>phraseAudioFrench(value)===french);
      if(index>=0){const source=readPhraseAudioSource({packId:pack.id,kind,index});if(source)return source;}
    }
  }
  return null;
}
