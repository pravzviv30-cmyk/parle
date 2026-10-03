import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZERO_USAGE } from '@luvani/brain';
import { createFixLineObserver, fixLineObserverFromEnv, fixesTarget } from './fixLineObserver.ts';
const calibration = { revision: 'invented-unit-fixture-only', model: 'jev-1.13.0', threshold: 0.9, task: 'fix-line', humanApproved: true } as const;
const input = { original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', attempt: 'J’ai vingt ans.' };
const result = (noul: number, model = 'jev-1.13.0') => ({ model, answers: { fixed: {type:'noul' as const,noul} }, usage: ZERO_USAGE });
test('correction-specific Noul uses only a finite probability of yes and the pinned model', async () => {
  for (const value of [0.9,1]) assert.equal(fixesTarget(result(value)),true);
  for (const value of [0.899,0,0.5,NaN,Infinity,1.1,-1]) assert.equal(fixesTarget(result(value)),false);
  assert.equal(fixesTarget(result(1,'jev-latest')),false);
  assert.equal(fixesTarget({...result(1),answers:{fixed:{type:'choice',choice:'yes',probabilities:{yes:1},confidence:1}}}),false);
  let sent: unknown;const usage: unknown[] = [];
  const observer = createFixLineObserver({async systemOne(state) {sent=state;return result(0.9);}},calibration);
  assert.equal(await observer.read(input,new AbortController().signal,value => usage.push(value)),true);
  assert.deepEqual(sent,{original:input.original,better:input.better,learner_retry:input.attempt});assert.deepEqual(usage,[ZERO_USAGE]);
  assert.equal(fixLineObserverFromEnv({LUVANI_FIX_LINE_JEV:'1',TYPESAFE_API_KEY:'invented-not-sent'}),undefined);
});
test('optional correction observer bounds uncertainty and meters late usage without a late pass', async () => {
  let calls=0;const cancelled = new AbortController();cancelled.abort();
  const fails = createFixLineObserver({async systemOne() {calls++;throw new Error('offline');}},calibration);
  assert.equal(await fails.read(input,cancelled.signal,()=>{}),false);assert.equal(calls,0);
  assert.equal(await fails.read(input,new AbortController().signal,()=>{}),false);
  let complete!: (value: ReturnType<typeof result>) => void;let signal: AbortSignal | undefined;const usage: unknown[] = [];
  const held = createFixLineObserver({systemOne(_state,_questions,abort) {signal=abort;return new Promise(resolve=>{complete=resolve;});}},calibration,5);
  assert.equal(await held.read(input,new AbortController().signal,value=>usage.push(value)),false);assert.equal(signal?.aborted,true);
  complete(result(1));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(usage,[ZERO_USAGE]);
});
