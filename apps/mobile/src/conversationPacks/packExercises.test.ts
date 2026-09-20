import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, phraseKeyOf, validateExercise } from '@luvani/core';

import { REPEATED_PHRASES, packExercisesFor, repairKeyOf, reviewPhrasesFor } from './packExercises.ts';

function pack(corrections = true) {
  return buildConversationPack({
    id: 's1', sessionId: 's1', learnerId: 'l', createdAt: '2026-09-12T20:00:00.000Z',
    title: { fr: 'Le code wifi', en: 'The wifi password' }, summary: 's',
    keyPhrases: [
      ['Le code wifi', 'The wifi password'],
      ['Je peux avoir la clé', 'Can I have the key'],
      ['Bonne soirée', 'Have a good evening'],
      ['Merci beaucoup', 'Thank you very much'],
      ['À demain', 'See you tomorrow'],
    ].map(([fr, en]) => ({ fr: fr!, frWritten: null, en: en! })),
    corrections: corrections ? [{ quote: 'je veux le wifi', better: 'Je voudrais le code wifi', betterEn: 'I would like the wifi password', why: 'Softer.' }] : [],
  });
}

describe('the drills a pack does not yet carry (F553)', () => {
  test('recovering a pack restores phrase and correction cards without claiming mastery', () => {
    const phrases = reviewPhrasesFor(pack());
    assert.equal(phrases.length, 6);
    assert.ok(phrases.some((p) => p.fr === 'Je voudrais le code wifi'));
    assert.ok(phrases.every((p) => p.note?.includes('The wifi password')));
    assert.ok(phrases.every((p) => !('mastered' in p) && !('timesUsedWell' in p)));
    assert.equal(reviewPhrasesFor({ ...pack(), keyPhrases: [...pack().keyPhrases, ...pack().keyPhrases] }).length, 6);
  });
  test('a pack synthesises a repair drill and a repeat for its key phrases, keyed by phrase', () => {
    const drills = packExercisesFor(pack());
    for (const drill of drills) assert.ok(validateExercise(drill).ok, `${drill.id} is not a valid exercise`);

    const repairKey = phraseKeyOf('Je voudrais le code wifi');
    assert.equal(repairKeyOf(pack()), repairKey);
    const repair = drills.filter((drill) => drill.phraseKey === repairKey);
    assert.deepEqual(repair.map((drill) => drill.kind).sort(), ['repeat-this', 'translate'], 'the repair has no translate and repeat pair');
    const repeat = repair.find((drill) => drill.kind === 'repeat-this');
    assert.ok(repeat && repeat.kind === 'repeat-this');
    assert.equal(repeat.reference, 'Je voudrais le code wifi');
    assert.equal(repeat.noMicTwin.kind, 'translate', 'the repeat has no silent twin, so a learner who cannot speak meets a dead beat');
    assert.equal(repeat.ipa, null, 'an IPA nobody authored was invented');

    // A repeat for the first few phrases, keyed so the bank folds them beside
    // the server's own translate pairs rather than over them.
    const repeats = drills.filter((drill) => drill.kind === 'repeat-this' && drill.phraseKey !== repairKey);
    assert.equal(repeats.length, REPEATED_PHRASES);
    assert.deepEqual(repeats.map((drill) => drill.phraseKey), ['Le code wifi', 'Je peux avoir la clé', 'Bonne soirée'].map(phraseKeyOf));
    assert.equal(new Set(drills.map((drill) => drill.id)).size, drills.length, 'two exercises share an id');

    // No correction, no repair drill, and nothing invented in its place.
    assert.equal(repairKeyOf(pack(false)), null);
    assert.ok(packExercisesFor(pack(false)).every((drill) => drill.phraseKey !== repairKey));
  });
});
