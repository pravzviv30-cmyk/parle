import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assembleRecap, HEADLINE_FAMILIES, MAX_FIXES } from './recap.ts';
import { buildConversationPack, MAX_PACK_CORRECTIONS } from '@luvani/core';
import { createConversation, type ConversationState } from './conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { sampleCoachItem } from '../contract/samples.ts';
import { copyViolations } from '../copy.ts';

function baseState(overrides: Partial<ConversationState> = {}): ConversationState {
  const state = createConversation(
    CAFE_FRAME,
    { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null },
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
    // Which family answered, not which words came out of it. Three sentences
    // forever is how an end card stops meaning anything, and this is the line a
    // learner sees most often because most sessions land in the same branch.
    const state = baseState({ turnCount: 8 });
    const { recap } = assembleRecap(state, CEFR);
    assert.ok(
      HEADLINE_FAMILIES.carried.includes(recap.headline),
      `a carried session said something else: "${recap.headline}"`,
    );
  });

  test('every line of every headline family is clean and distinct', () => {
    const seen = new Set<string>();
    for (const [name, family] of Object.entries(HEADLINE_FAMILIES)) {
      assert.ok(family.length >= 2, `${name} is not a family, it is one line`);
      for (const line of family) {
        assert.deepEqual(copyViolations(line), [], `${name}: "${line}"`);
        assert.ok(!seen.has(line), `"${line}" appears in two families, so the outcome is not legible`);
        seen.add(line);
      }
    }
  });

  test('two sessions of different lengths do not end on the same sentence', () => {
    const a = assembleRecap(baseState({ turnCount: 8 }), CEFR).recap.headline;
    const b = assembleRecap(baseState({ turnCount: 9 }), CEFR).recap.headline;
    assert.notEqual(a, b, 'the end card says the same thing whatever happened');
  });

  test('the same session always ends the same way', () => {
    const a = assembleRecap(baseState({ turnCount: 8 }), CEFR).recap.headline;
    const b = assembleRecap(baseState({ turnCount: 8 }), CEFR).recap.headline;
    assert.equal(a, b, 'the headline is a random draw, which makes the recap untestable');
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

describe('the recap remembers what you talked about', () => {
  test('topics ride the recap in order, frame first', () => {
    const { recap } = assembleRecap(
      baseState({
        topics: [
          { en: 'Ordering at the café', fr: 'Au café', turn: 0 },
          { en: 'Rugby', fr: 'Le rugby', turn: 4 },
        ],
      }),
      CEFR,
    );
    assert.deepEqual(recap.topics, [
      { fr: 'Au café', en: 'Ordering at the café' },
      { fr: 'Le rugby', en: 'Rugby' },
    ]);
  });
});

describe('the recap and the conversation pack keep the same fixes (F906)', () => {
  test('every fix the recap holds reaches the conversation pack', () => {
    assert.equal(MAX_PACK_CORRECTIONS, MAX_FIXES, 'the pack cap and the recap cap cannot drift');
    const deferred = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((quote) =>
      sampleCoachItem({ kind: 'grammar-slip', quote: `au la ${quote}` }));
    const { recap } = assembleRecap(baseState({ deferred }), CEFR);
    assert.equal(recap.fixes.length, MAX_FIXES);
    const pack = buildConversationPack({
      id: 'pack-1', sessionId: 'session-1', learnerId: 'learner-1', createdAt: '2026-10-28T00:00:00.000Z',
      title: { fr: 'Au café', en: 'At the café' }, summary: recap.headline, keyPhrases: [],
      corrections: recap.fixes.slice(0, MAX_PACK_CORRECTIONS).map((fix) => ({
        quote: fix.quote, better: fix.better, betterEn: fix.betterEn, why: fix.why,
      })),
    });
    assert.deepEqual(pack.corrections.map((c) => c.quote), recap.fixes.map((f) => f.quote));
  });
});
