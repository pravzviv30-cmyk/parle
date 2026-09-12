import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildConversationPack, missionStates, phraseKeyOf, type RecapPayload, type ReviewCard } from '@luvani/core';

import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { MAX_CLOSURE_PHRASES, closureFromPack, closureFromRecap } from './closure.ts';

const NOW = Date.parse('2026-09-12T20:00:00.000Z');

function card(fr: string, convoUses = 0): ReviewCard {
  return {
    id: phraseKeyOf(fr), kind: 'turn', front: fr, back: 'x', context: '', ipa: '',
    addedAt: NOW - 86_400_000, due: NOW - 1, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0,
    evidence: { retrievals: 1, convoUses, transfers: 0 },
  };
}

const PHRASES = ['Le code wifi, s’il vous plaît', 'Je peux avoir la clé ?', 'À quelle heure est le petit déjeuner ?', 'Merci, bonne soirée'].map((fr, i) => ({
  fr, frWritten: null, en: `English ${i}`,
}));

function pack() {
  return buildConversationPack({
    id: 's1', sessionId: 's1', learnerId: 'l', createdAt: new Date(NOW).toISOString(),
    title: { fr: 'Le code wifi', en: 'The wifi password' },
    summary: 'You asked the desk for the wifi.',
    tutorGoal: 'Try “je voudrais” when you ask for something.',
    keyPhrases: PHRASES,
    wins: ['Bonjour', 'S’il vous plaît', 'Merci', 'Bonne soirée'],
    corrections: [{ quote: 'je veux le wifi', better: 'Je voudrais le code wifi', betterEn: 'I would like the wifi password', why: 'Softer, and what a receptionist expects.' }],
  });
}

const CHECK: SoundCheckEvidence = { missionId: 'mission:hotel', reference: 'x', at: NOW - 1000, kind: 'assessed-focus', focus: 'Round your lips more.', phoneme: 'y' };

describe('the closure a conversation earns (F552)', () => {
  test('a closure carries three phrases, one repair, one focus, one next mission and up to three wins, from the pack and nothing invented', () => {
    const progress = missionStates([], [], NOW);
    const bare = closureFromPack(pack(), { progress, deck: [], checks: [] });
    assert.equal(bare.title, 'The wifi password');
    assert.equal(bare.summary, 'You asked the desk for the wifi.');
    assert.equal(bare.didWell.length, 3, 'more than three wins is a list, not a closure');
    assert.equal(bare.phrases.length, MAX_CLOSURE_PHRASES);
    assert.deepEqual(bare.phrases.map((p) => p.fr), PHRASES.slice(0, 3).map((p) => p.fr));
    assert.equal(bare.repair!.better, 'Je voudrais le code wifi');
    assert.deepEqual(bare.focus, { kind: 'clarity', line: 'Try “je voudrais” when you ask for something.' }, 'with no sound measured, the focus is the tutor’s own clarity line');
    assert.ok(bare.nextMission !== null, 'no next situation was suggested');

    // A phrase already used in conversation gives its slot to one that is not.
    const used = closureFromPack(pack(), { progress, deck: [card(PHRASES[0]!.fr, 2)], checks: [] });
    assert.deepEqual(used.phrases.map((p) => p.fr), [PHRASES[1]!.fr, PHRASES[2]!.fr, PHRASES[3]!.fr]);

    // A measured sound outranks the clarity line.
    const heard = closureFromPack(pack(), { progress, deck: [], checks: [CHECK] });
    assert.equal(heard.focus!.kind, 'sound');
    if (heard.focus!.kind === 'sound') assert.equal(heard.focus!.missionId, 'mission:hotel');

    // With no context at all, nothing is invented: no next mission, no cadence.
    const early = closureFromPack(pack(), null);
    assert.equal(early.nextMission, null);
    assert.equal(early.focus!.kind, 'clarity');

    // No repair, no clarity, no sound: the focus is a cadence connector not
    // yet theirs, or null, never a sentence made up to fill the slot.
    const quiet = closureFromPack(buildConversationPack({ ...pack(), tutorGoal: null, corrections: [] }), { progress, deck: [], checks: [] });
    assert.equal(quiet.repair, null);
    assert.ok(quiet.focus === null || quiet.focus.kind === 'cadence');

    // The live recap builds the same shape, before the pack exists.
    const recap: RecapPayload = {
      headline: 'You carried the whole exchange.',
      wins: ['Bonjour'],
      fixes: [{ kind: 'register', quote: 'je veux', better: 'je voudrais', betterWritten: null, betterEn: 'I would like', why: 'Softer.', weight: 'matters-now' }],
      phrases: [{ fr: 'Je voudrais un café', frWritten: null, en: 'I would like a coffee', enLiteral: null, register: 'courant', note: null }],
      nextFocus: 'Keep “je voudrais” for asking.',
      topics: [{ fr: 'Au café', en: 'At the café' }],
      cefr: { estimate: 'A1', confidence: 'low' },
      stats: { turns: 6, rescues: 0, unassistedRate: 0.8 },
    };
    const fromRecap = closureFromRecap(recap, null);
    assert.equal(fromRecap.title, 'At the café');
    assert.equal(fromRecap.summary, 'You carried the whole exchange.');
    assert.equal(fromRecap.repair!.quote, 'je veux');
    assert.deepEqual(fromRecap.focus, { kind: 'clarity', line: 'Keep “je voudrais” for asking.' });
    assert.equal(fromRecap.phrases.length, 1);
  });
});
