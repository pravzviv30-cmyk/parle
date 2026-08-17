import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assembleRecap } from './recap.ts';
import { createConversation, type ConversationState } from './conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { sampleCoachItem } from '../contract/samples.ts';
import { copyViolations } from '../copy.ts';

function baseState(overrides: Partial<ConversationState> = {}): ConversationState {
  const state = createConversation(
    CAFE_FRAME,
    { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0 },
    { strictness: 'balanced', maxTurns: 24 },
    1_000,
  );
  return { ...state, ...overrides };
}

const CEFR = { estimate: 'A2', confidence: 'low' } as const;

describe('the recap says one thing, not everything', () => {
  test('fixes dedupe by finding, sort by importance, and cap at six', () => {
    const deferred = [
      sampleCoachItem({ kind: 'grammar-slip', quote: 'au la boulangerie' }),
      sampleCoachItem({ kind: 'grammar-slip', quote: 'AU LA BOULANGERIE' }), // dup, case-insensitive
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'je ne sais pas' }),
      sampleCoachItem({ kind: 'anglicism', quote: 'je suis excité' }),
      sampleCoachItem({ kind: 'grammar-slip', quote: 'b' }),
      sampleCoachItem({ kind: 'grammar-slip', quote: 'c' }),
      sampleCoachItem({ kind: 'grammar-slip', quote: 'd' }),
      sampleCoachItem({ kind: 'grammar-slip', quote: 'e' }),
    ];
    const { recap } = assembleRecap(baseState({ deferred }), CEFR);
    assert.equal(recap.fixes.length, 6);
    assert.equal(recap.fixes[0]!.kind, 'textbook-phrasing', 'importance order');
    const quotes = recap.fixes.map((f) => f.quote.toLowerCase());
    assert.equal(new Set(quotes).size, quotes.length, 'duplicates survived');
  });

  test('wins dedupe and cap at five', () => {
    const { recap } = assembleRecap(
      baseState({ usedWell: ['Bonjour', 'bonjour', 'Ça marche', 'Merci', 'Santé', 'Carrément', 'Nickel'] }),
      CEFR,
    );
    assert.equal(recap.wins.length, 5);
    assert.equal(recap.wins[0], 'Bonjour');
  });

  test('exactly one next focus: the top recurring error, phrased for a human', () => {
    const { recap } = assembleRecap(baseState({ errorTags: { 'ne-retention': 3, 'gender-agreement': 1 } }), CEFR);
    assert.match(recap.nextFocus, /drop the ne/i);
  });

  test('an unmapped tag still reads as words, never as a kebab tag', () => {
    const { recap } = assembleRecap(baseState({ errorTags: { 'liaison-timing': 2 } }), CEFR);
    assert.ok(recap.nextFocus.includes('liaison timing'));
    assert.ok(!recap.nextFocus.includes('liaison-timing'));
  });

  test('no errors at all still leaves one gentle focus', () => {
    const { recap } = assembleRecap(baseState(), CEFR);
    assert.ok(recap.nextFocus.length > 0);
  });
});

describe('headline and closure', () => {
  test('a clean run gets the strongest line', () => {
    const state = baseState({ turnCount: 8 });
    const { recap } = assembleRecap(state, CEFR);
    assert.equal(recap.headline, 'You carried that scene.');
  });

  test('every headline branch passes the copy rules', () => {
    const branches = [
      baseState({ turnCount: 8 }),
      baseState({ turnCount: 2, usedWell: ['a', 'b', 'c'] }),
      baseState({ turnCount: 2 }),
    ];
    for (const state of branches) {
      const { recap } = assembleRecap(state, CEFR);
      assert.deepEqual(copyViolations(recap.headline), [], recap.headline);
      assert.deepEqual(copyViolations(recap.nextFocus), [], recap.nextFocus);
    }
  });

  test('assembling the recap finishes the conversation and carries the stats', () => {
    const { recap, state } = assembleRecap(baseState({ turnCount: 5 }), CEFR);
    assert.equal(state.finished, true);
    assert.equal(recap.stats.turns, 5);
    assert.equal(recap.stats.rescues, 0);
    assert.equal(recap.cefr.estimate, 'A2');
  });
});
