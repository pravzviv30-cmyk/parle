import assert from 'node:assert/strict';import { test } from 'node:test';
import { CORRECTION_REASONS, type ConvoView } from '@luvani/core';import { ZERO_USAGE } from '@luvani/brain';
import { createCorrectionReasonReader, correctionReasonReaderFromEnv } from './correctionReason.ts';
const calibration = {revision:'invented-unit-fixture-only',model:'jev-1.13.0',task:'correction-reason',humanApproved:true,threshold:0.9} as const;
const sessionId='11111111-1111-4111-8111-111111111111';const said='Je suis vingt ans.';
const view = (id='v2') => ({textTurnId:id,coachNow:[{kind:'verb-form',quote:'Je suis vingt ans',better:'J’ai vingt ans'}]}) as ConvoView;
const answer = (id='verb-form', probability=0.9, model='jev-1.13.0') => ({model,answers:{reason:{type:'choice' as const,choice:id,confidence:0.1,probabilities:Object.fromEntries([...Object.keys(CORRECTION_REASONS),'none'].map(key=>[key,key===id?probability:(1-probability)/5]))}},usage:ZERO_USAGE});
test('correction reason Choice keeps only authored IDs and exact bounded current source',async()=>{
  let calls=0;let state:unknown;const reader=createCorrectionReasonReader({async systemOne(sent){calls++;state=sent;return answer();}},calibration);
  const result=await reader.read(sessionId,view(),said,new AbortController().signal,()=>{});
  assert.equal(result?.reason,'verb-form');assert.deepEqual(state,{quote:'Je suis vingt ans',better:'J’ai vingt ans'});
  assert.equal(await reader.read(sessionId,view(),said,new AbortController().signal,()=>{}),null);assert.equal(calls,1);
  assert.equal(await reader.read(sessionId,view('v3'),'invented',new AbortController().signal,()=>{}),null);assert.equal(calls,1);
  await reader.read(sessionId,view('v3'),said,new AbortController().signal,()=>{});await reader.read(sessionId,view('v4'),said,new AbortController().signal,()=>{});
  assert.equal(await reader.read(sessionId,view('v5'),said,new AbortController().signal,()=>{}),null);assert.equal(calls,3);
  for (const bad of [answer('verb-form',0.89),answer('none'),answer('verb-form',0.9,'jev-latest'),{...answer(),answers:{reason:{...answer().answers.reason,probabilities:{'verb-form':1}}}}]) {
    const other=createCorrectionReasonReader({async systemOne(){return bad;}},calibration);
    assert.equal(await other.read(sessionId,view(),said,new AbortController().signal,()=>{}),null);
  }
  assert.equal(correctionReasonReaderFromEnv({LUVANI_CORRECTION_REASONS:'1',TYPESAFE_API_KEY:'invented-not-sent'}),undefined);
});
test('a cancelled or slow correction reason never publishes a late answer but meters returned usage',async()=>{
  const controller=new AbortController();let complete!: (value:ReturnType<typeof answer>)=>void;const usage:unknown[]=[];
  const reader=createCorrectionReasonReader({systemOne(){return new Promise(resolve=>{complete=resolve;});}},calibration,5);
  const work=reader.read(sessionId,view(),said,controller.signal,value=>usage.push(value));controller.abort();assert.equal(await work,null);
  complete(answer());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(usage,[ZERO_USAGE]);
});
