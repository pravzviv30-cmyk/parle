/**
 * The crash window, and exactly how wide it is.
 *
 * Everything a conversation leaves behind arrives after the room has done its
 * work, in an order the learner cannot see: recap, then practice, then drills.
 * ConvoScreen banks on practice, with a fallback for the learner who taps Done
 * first. Nothing covered the learner who reads the recap and swipes the app
 * away, which is not an exotic way to leave an app.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { RecapPayload } from '@parle/core';

import { JOURNAL_VERSION, isWorthKeeping, journalFor, recoveryPlan } from './journalRules.ts';

const NOW = new Date(2026, 7, 20, 14).getTime();

const phrase = (fr: string, en: string) => ({ fr, frWritten: null, en, enLiteral: null, register: 'familier', note: null });

const recap = (over: Partial<RecapPayload> = {}): RecapPayload => ({
  headline: 'You ordered a coffee.',
  wins: ['You said it without help.'],
  fixes: [],
  phrases: [phrase('Ça marche', 'coming up'), phrase('Autre chose', 'something else')],
  nextFocus: 'The u sound',
  topics: [{ fr: 'Au café', en: 'Ordering at the café' }],
  cefr: { estimate: 'A1', confidence: 'low' },
  stats: { turns: 6, rescues: 1, unassistedRate: 0.7 },
  ...over,
});

describe('the session journal', () => {
  test('the recap is journalled the moment it arrives', () => {
    const journal = journalFor(recap(), NOW);

    assert.equal(journal.version, JOURNAL_VERSION);
    assert.equal(journal.savedAt, NOW);
    assert.deepEqual(journal.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose']);
    assert.deepEqual(journal.topics, [{ fr: 'Au café', en: 'Ordering at the café' }]);
  });

  test('only what becomes practice is kept, not the card the learner is reading', () => {
    // Re-showing a headline or a CEFR estimate a day later would be strange.
    // Phrases and topics are the two things that turn into practice.
    const journal = journalFor(recap(), NOW) as unknown as Record<string, unknown>;
    for (const field of ['headline', 'wins', 'fixes', 'cefr', 'stats', 'nextFocus']) {
      assert.equal(journal[field], undefined, `${field} has no business surviving the session`);
    }
  });

  test('an empty phrase is not worth a card', () => {
    const journal = journalFor(recap({ phrases: [phrase('  ', 'nothing')] }), NOW);
    assert.deepEqual(journal.phrases, []);
    assert.equal(isWorthKeeping(journal), false, 'and a journal with nothing in it is not worth writing');
  });

  test('banking the session clears the journal, so nothing is banked twice', () => {
    // Clearing is the store's job; what this holds is the other half of it —
    // once cleared, a launch finds nothing and must do nothing. The recap
    // arrives twice, once plain and once enriched with the learner model, so a
    // recovery that ran on leftovers would double every card.
    assert.equal(recoveryPlan(null), null);
    assert.equal(recoveryPlan(undefined), null);
    assert.equal(recoveryPlan({ version: JOURNAL_VERSION, savedAt: NOW, phrases: [], topics: [] }), null);
  });

  test('a journal orphaned by a crash banks its phrases on the next launch', () => {
    const plan = recoveryPlan(journalFor(recap(), NOW));

    assert.ok(plan, 'there is something to do');
    assert.deepEqual(plan.phrases.map((p) => p.fr), ['Ça marche', 'Autre chose']);
    assert.equal(plan.topics.length, 1, 'under the session it came from');
    assert.equal(plan.topics[0]!.title.en, 'Ordering at the café');
    assert.deepEqual(
      [...plan.topics[0]!.phraseKeys],
      ['phrase:ça marche', 'phrase:autre chose'],
      'keyed exactly as review/store.ts keys them, or the topic points at cards that do not exist',
    );
  });

  test('a journal from a version this build does not understand is left alone', () => {
    assert.equal(recoveryPlan({ ...journalFor(recap(), NOW), version: 99 }), null);
  });

  test('a corrupt journal is nothing to do, not a crash on launch', () => {
    // Same reasoning as topics/store.ts: the deck underneath lost nothing, and
    // the alternative is an app that will not open.
    assert.equal(recoveryPlan('nonsense'), null);
    assert.equal(recoveryPlan({ version: JOURNAL_VERSION, phrases: 'not an array' }), null);
    const halfBad = { version: JOURNAL_VERSION, savedAt: NOW, phrases: [phrase('Ça marche', 'coming up'), { fr: 5 }], topics: [] };
    assert.deepEqual(recoveryPlan(halfBad)?.phrases.map((p) => p.fr), ['Ça marche'], 'the readable half still lands');
  });

  test('a session with no topic still recovers its phrases', () => {
    // Topics are a nicety; the cards are the point.
    const plan = recoveryPlan(journalFor(recap({ topics: [] }), NOW));
    assert.equal(plan?.phrases.length, 2);
    assert.deepEqual(plan?.topics, []);
  });
});
