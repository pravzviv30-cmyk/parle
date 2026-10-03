import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationPack } from '@luvani/core';
import { sourceForKeptFrench } from './phraseAudioSource.ts';
const id='33333333-3333-4333-8333-333333333333';
const pack=buildConversationPack({id,sessionId:id,learnerId:'owner',createdAt:'2026-10-02T12:00:00Z',title:{fr:'Au café',en:'At the café'},summary:'An order.',keyPhrases:[{fr:'Un café, merci.',frWritten:null,en:'A coffee, thanks.'}],corrections:[{quote:'Je suis vingt ans.',better:'J’ai vingt ans.',betterEn:'I’m twenty.',why:'Use avoir for age.'}]});
test('kept phrase audio projects only exact owned ready French, including corrected turn lines',()=>{
 assert.deepEqual(sourceForKeptFrench('Un café, merci.',[pack],'owner'),{packId:id,kind:'phrase',index:0});assert.deepEqual(sourceForKeptFrench('J’ai vingt ans.',[pack],'owner'),{packId:id,kind:'correction',index:0});
 for(const words of ['Un cafe, merci.','un café, merci.','Un café merci.','A coffee, thanks.'])assert.equal(sourceForKeptFrench(words,[pack],'owner'),null);
 for(const invalid of [{...pack,state:'archived' as const},{...pack,learnerId:'other'},{...pack,sessionId:'other'},{...pack,createdAt:'bad'}])assert.equal(sourceForKeptFrench('Un café, merci.',[invalid],'owner'),null);
 assert.equal(sourceForKeptFrench('Un café, merci.',[pack],null),null);
});
