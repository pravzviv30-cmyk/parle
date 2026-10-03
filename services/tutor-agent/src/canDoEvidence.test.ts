import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CanDoEvidenceLedger, getMission, type ConvoView } from '@luvani/core';
import { ZERO_USAGE } from '@luvani/brain';
import type { JevResult } from '@luvani/brain/llm';
import { acceptedChoice, canDoEvidenceReaderFromEnv, createCanDoEvidenceReader } from './canDoEvidence.ts';
const mission = getMission('mission:premier-cafe')!;
const sessionId = '11111111-1111-4111-8111-111111111111';
const calibration = { revision: 'invented-unit-fixture-only', model: 'jev-1.13.0', threshold: 0.8, humanApproved: true, task: 'can-do-evidence' } as const;
function ledger() {
  const result = new CanDoEvidenceLedger(mission.id);
  const view = { rung: 4, missionDone: true, missionTasks: { missionId: mission.id, items: mission.beatIds.map(id => ({ id, goalEn: id, achieved: true })) } } as ConvoView;
  result.recordAcceptedSource('Je voudrais un café, s’il vous plaît.', mission.beatIds[0]!, [], view, true);
  result.noteWinningView(view);return result;
}
const choice = (id: string, other: string, probability = 0.9) => ({ type: 'choice' as const, choice: id, confidence: 0.1, probabilities: { [id]: probability, [other]: 1 - probability } });
function answer(): JevResult { return { model: 'jev-1.13.0', usage: ZERO_USAGE, answers: { can_do: choice('current_can_do', 'none'), quote: choice('accepted-1', 'none') } }; }

test('can-do Choice uses complete probabilities and exact source IDs, never vendor confidence or prose', async () => {
  assert.equal(acceptedChoice(choice('yes', 'no'), ['yes','no']), 'yes');
  for (const bad of [choice('yes','no',0.79), { ...choice('yes','no'), probabilities: { yes: 0.9 } }, { ...choice('yes','no'), probabilities: { yes: 0.9, no: 0.2 } }, { ...choice('yes','no'), probabilities: { yes: NaN, no: 0.1 } }, { ...choice('yes','no'), probabilities: { yes: 0.9, typo: 0.1 } }, { ...choice('yes','no'), choice: 'invented prose' }, { ...choice('yes','no'), confidence: Infinity }]) assert.equal(acceptedChoice(bad, ['yes','no']), null);
  let sent: unknown;
  const reader = createCanDoEvidenceReader({ async systemOne(state) { sent = state;return answer(); } }, calibration);
  const result = await reader.read(ledger(), sessionId, mission.id, new AbortController().signal);
  assert.equal(result?.evidence?.quote, 'Je voudrais un café, s’il vous plaît.');
  const text = JSON.stringify(sent);assert.ok(!text.includes(sessionId));assert.ok(text.includes('accepted-1'));
  for (const response of [{ ...answer(), model: 'jev-latest' }, { ...answer(), answers: { ...answer().answers, quote: choice('invented-quote','none') } }, { ...answer(), answers: { ...answer().answers, can_do: choice('none','current_can_do') } }]) {
    const other = createCanDoEvidenceReader({ async systemOne() { return response; } }, calibration);
    assert.equal((await other.read(ledger(),sessionId,mission.id,new AbortController().signal))?.evidence, null);
  }
});

test('can-do optional work is bounded, revoked and dark without a reviewed French artifact', async () => {
  let calls = 0;
  const throwing = createCanDoEvidenceReader({ async systemOne() { calls++;throw new Error('offline'); } }, calibration);
  const cancelled = new AbortController();cancelled.abort();
  assert.equal(await throwing.read(ledger(),sessionId,mission.id,cancelled.signal), null);
  assert.equal(await throwing.read(ledger(),sessionId,'mission:unknown',new AbortController().signal), null);
  assert.equal(calls, 0);
  assert.equal(await throwing.read(ledger(),sessionId,mission.id,new AbortController().signal), null);
  const pending = createCanDoEvidenceReader({ systemOne(_state,_questions,signal) { return new Promise((_resolve,reject) => signal?.addEventListener('abort', () => reject(new Error('abort')), {once:true})); } }, calibration, 5);
  assert.equal(await pending.read(ledger(),sessionId,mission.id,new AbortController().signal), null);
  const held = ledger();let resolve!: (result: JevResult) => void;
  const reader = createCanDoEvidenceReader({ systemOne() { return new Promise(done => {resolve = done;}); } }, calibration);
  const work = reader.read(held,sessionId,mission.id,new AbortController().signal);held.clear();resolve(answer());
  assert.equal((await work)?.evidence, null);
  assert.equal(canDoEvidenceReaderFromEnv({ LUVANI_CAN_DO_EVIDENCE: '1', TYPESAFE_API_KEY: 'invented-not-sent' }), undefined);
  assert.equal(canDoEvidenceReaderFromEnv({}), undefined);
});
