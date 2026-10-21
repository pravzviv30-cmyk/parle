import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationPack, newCard } from '@luvani/core';
import { conversationContext, fromLine } from './context.ts';
test('in-context review quotes only the matching saved fragment and never fabricates a transcript',()=>{
  const card=newCard({id:'x',kind:'turn',front:'I am hungry.',back:"J’ai faim.",context:'',ipa:''},0);
  const pack=buildConversationPack({id:'x',sessionId:'x',learnerId:'a',createdAt:'2026-10-02T12:00:00Z',title:{fr:'Café',en:'Café'},summary:'',keyPhrases:[],corrections:[{quote:'Je suis faim.',better:"J’ai faim.",betterEn:'I am hungry.',why:'Hunger takes avoir.'}]});
  assert.deepEqual(conversationContext(card,[pack]),{quote:'Je suis faim.',label:'Your earlier line',title:'Café'});
  assert.equal(conversationContext({...card,back:'Bonjour.'},[pack]),null);
  assert.equal(conversationContext(card,[]),null);
  assert.equal(pack.corrections.length,1);
  assert.equal(conversationContext(card,[{...pack,id:'sample-cafe-morning'}])?.label,'Earlier line in the sample conversation');
});

// 2026-10-21 UI-008, artboard B-Review: the card says which conversation the phrase came from.
test('the card names the conversation it came from, and nothing when none is known',()=>{
  const card=newCard({id:'x',kind:'turn',front:'I am hungry.',back:"J’ai faim.",context:'',ipa:''},0);
  const pack=buildConversationPack({id:'x',sessionId:'x',learnerId:'a',createdAt:'2026-10-02T12:00:00Z',title:{fr:'Au café du coin',en:'At the corner café'},summary:'',keyPhrases:[],corrections:[{quote:'Je suis faim.',better:"J’ai faim.",betterEn:'I am hungry.',why:'Hunger takes avoir.'}]});
  assert.equal(fromLine(conversationContext(card,[pack])),'From Au café du coin');
  assert.equal(fromLine(conversationContext(card,[])),null);
  assert.equal(fromLine({title:'  '}),null);
});
