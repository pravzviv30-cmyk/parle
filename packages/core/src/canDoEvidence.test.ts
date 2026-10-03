import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMission, encodeMessage, decodeServerMessage, type ConvoView } from './index.ts';
import { CanDoEvidenceLedger, readCanDoEvidence, currentCanDoQuote } from './canDoEvidence.ts';

const mission = getMission('mission:premier-cafe')!;
const sessionId = '11111111-1111-4111-8111-111111111111';
const view = (rung = 4, done = true): ConvoView => ({ rung, missionDone: done, missionTasks: { missionId: mission.id, items: mission.beatIds.map(id => ({ id, goalEn: id, achieved: done })) } }) as ConvoView;

test('can-do evidence is bound to the current independent finish and exact accepted learner source', () => {
  const ledger = new CanDoEvidenceLedger(mission.id);
  const partial = view(4, false);
  partial.missionTasks!.items[0]!.achieved = true;
  ledger.recordAcceptedSource('Un café, merci.', mission.beatIds[0]!, [], partial, true);
  ledger.noteWinningView(view(2));
  assert.equal(ledger.independentFinish, false, 'later independence cannot rewrite an assisted first win');
  ledger.noteWinningView(view(4));assert.equal(ledger.independentFinish, false);
  const fresh = new CanDoEvidenceLedger(mission.id);
  fresh.recordAcceptedSource('Invented replacement', mission.beatIds[0]!, [], partial, false);
  fresh.recordAcceptedSource('Un café, merci.', mission.beatIds[0]!, [], partial, true);
  assert.deepEqual(fresh.sources.map(row => row.quote), ['Un café, merci.']);
  fresh.recordAcceptedSource('A replay', mission.beatIds[0]!, [mission.beatIds[0]!], partial, true);
  assert.equal(fresh.sources.length, 1);
  fresh.noteWinningView(view());assert.equal(fresh.independentFinish, true);
  const evidence = fresh.resolve(sessionId, fresh.sources[0]!.sourceId)!;
  assert.deepEqual(readCanDoEvidence(evidence), evidence);
  const finish = { sessionId, missionId: mission.id, rung: 4 as const };
  assert.equal(currentCanDoQuote(evidence, finish, [{ who: 'learner', fr: 'Un café, merci.' }]), 'Un café, merci.');
  assert.equal(currentCanDoQuote(evidence, { ...finish, rung: 2 }, [{ who: 'learner', fr: evidence.quote }]), null);
  assert.equal(currentCanDoQuote(evidence, { ...finish, sessionId: 'other' }, [{ who: 'learner', fr: evidence.quote }]), null);
  assert.equal(currentCanDoQuote(evidence, finish, [{ who: 'tutor', fr: evidence.quote }]), null);
  assert.equal(fresh.resolve(sessionId, 'invented'), null);
  assert.equal(readCanDoEvidence({ ...evidence, beatId: 'invented' }), null);
  fresh.clear();assert.equal(fresh.resolve(sessionId, evidence.sourceId), null);
});

test('partial, legacy, unknown and malformed mission wins cannot supply quoted earning evidence', () => {
  for (const v of [view(4, false), { ...view(), missionTasks: null }, { ...view(), missionTasks: undefined }, { ...view(), rung: 99 }]) {
    const ledger = new CanDoEvidenceLedger(mission.id);ledger.noteWinningView(v as ConvoView);
    assert.equal(ledger.independentFinish, false);
  }
  const ledger = new CanDoEvidenceLedger('unknown');ledger.noteWinningView(view());assert.equal(ledger.independentFinish, false);
});


test('can-do wire rejects malformed provenance and keeps exact text without retaining caller objects', () => {
  const evidence = { sessionId, missionId: mission.id, sourceId: 'accepted-1', beatId: mission.beatIds[0]!, quote: 'Un café, merci.' };
  assert.deepEqual(decodeServerMessage(encodeMessage({t:'can-do-evidence',evidence})), {t:'can-do-evidence',evidence});
  for (const bad of [{...evidence,sessionId:'other'}, {...evidence,sourceId:'quote'}, {...evidence,quote:'x'.repeat(241)}, {...evidence,quote:'control\nline'}, {...evidence,quote:'   '}, {...evidence,missionId:'other'}, {...evidence,beatId:'other'}]) {
    assert.equal(decodeServerMessage(encodeMessage({t:'can-do-evidence',evidence:bad} as never)), null);
  }
  const ledger = new CanDoEvidenceLedger(mission.id);
  ledger.clear();ledger.recordAcceptedSource('Un café.',mission.beatIds[0]!,[],view(),true);ledger.noteWinningView(view());
  assert.deepEqual(ledger.sources,[]);assert.equal(ledger.independentFinish,false);
});
