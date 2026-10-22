import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConversation, createProfile, learnerSnapshotFrom, CAFE_FRAME, integrateTurn, sampleTurn, sampleCoachItem, type TurnView } from '@luvani/brain';
import { inCharacterRecast } from './spokenRecast.ts';

function example() {
  const state = createConversation(CAFE_FRAME, learnerSnapshotFrom(createProfile()), { strictness: 'balanced', maxTurns: 20 });
  return integrateTurn(state, { type: 'spoke', text: 'Je veux un café' }, sampleTurn({
    coach: [sampleCoachItem({ kind: 'register-mismatch', quote: 'Je veux un café', better: 'Je voudrais un café', betterEn: 'I would like a coffee', weight: 'matters-now' })],
    sceneReply: { speaker: 'Karim', fr: 'Avec du sucre ?', frWritten: 'Avec du sucre ?', en: 'With sugar?' },
  })).view;
}

test('the first earned spoken recast keeps the character, correct form and display meaning together', () => {
  const view = example();
  const recast = inCharacterRecast(view, 'Je veux un café.', false);
  assert.equal(recast.used, true);
  assert.equal(recast.view.sceneReply.fr, 'Ah, Je voudrais un café. Avec du sucre ?');
  assert.equal(recast.view.sceneReply.en, 'Ah, I would like a coffee. With sugar?');
  assert.equal(recast.view.sceneReply.speaker, view.sceneReply.speaker);
  assert.equal(recast.view.sceneReply.frWritten, null);
  assert.deepEqual(recast.view.coachNow, view.coachNow);
  assert.equal(view.sceneReply.fr, 'Avec du sucre ?', 'the source view stays immutable');
  assert.equal(inCharacterRecast(recast.view, 'Je veux un café', true).view, recast.view);
  assert.equal(inCharacterRecast({ ...view, sceneReply: { ...view.sceneReply, fr: 'Je voudrais un café. Avec du sucre ?' } }, 'Je veux un café', false).view.sceneReply.fr, 'Je voudrais un café. Avec du sucre ?');
});

test('a recast requires an actual inline finding about this attempt and never invents one from silence, narration or English help', () => {
  const view = example();
  const cases: [TurnView, string][] = [
    [view, 'Bonjour'],
    [{ ...view, coachNow: [] }, 'Je veux un café'],
    [{ ...view, reachedForEnglish: true }, 'Je veux un café'],
    [{ ...view, narration: view.sceneReply }, 'Je veux un café'],
    [{ ...view, coachNow: [{ ...view.coachNow[0]!, quote: 'veux un caf' }] }, 'Je veux un café'],
    [{ ...view, coachNow: [{ ...view.coachNow[0]!, better: 'Je veux un café' }] }, 'Je veux un café'],
    [{ ...view, coachNow: [{ ...view.coachNow[0]!, better: 'x'.repeat(241) }] }, 'Je veux un café'],
  ];
  for (const [candidate, said] of cases) {
    assert.equal(inCharacterRecast(candidate, said, false).used, false);
    assert.equal(inCharacterRecast(candidate, said, false).view, candidate);
  }
});

test('a beginner recast fits a short combined voice budget and preserves French accents when checking an existing echo', () => {
  const view = { ...example(), rung: 1 as const };
  assert.equal(inCharacterRecast(view, 'Je veux un café', false).used, true);
  const long = { ...view, coachNow: [{ ...view.coachNow[0]!, better: 'x'.repeat(239) }] };
  assert.equal(inCharacterRecast(long, 'Je veux un café', false).used, false);
  const combined = { ...view, sceneReply: { ...view.sceneReply, fr: 'x'.repeat(110) } };
  assert.equal(inCharacterRecast(combined, 'Je veux un café', false).used, false);
  const accent = { ...view, coachNow: [{ ...view.coachNow[0]!, quote: 'un ete', better: 'été' }], sceneReply: { ...view.sceneReply, fr: 'ete' } };
  assert.equal(inCharacterRecast(accent, 'un ete', false).view.sceneReply.fr, 'Ah, été. ete');
  const apostrophe = { ...view, coachNow: [{ ...view.coachNow[0]!, quote: 'je possède', better: 'J’ai' }], sceneReply: { ...view.sceneReply, fr: 'jai' } };
  assert.equal(inCharacterRecast(apostrophe, 'je possède', false).view.sceneReply.fr, 'Ah, J’ai. jai');
});

test('a reply whose English has not arrived yet keeps no English after a recast', () => {
  const view = example();
  const recast = inCharacterRecast({ ...view, sceneReply: { ...view.sceneReply, en: '' } }, 'Je veux un café.', false);
  assert.equal(recast.used, true);
  assert.equal(recast.view.sceneReply.fr, 'Ah, Je voudrais un café. Avec du sucre ?');
  assert.equal(recast.view.sceneReply.en, '');
});
