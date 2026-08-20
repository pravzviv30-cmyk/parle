/**
 * The phrasebook is a projection, and it has to stay one.
 *
 * Two of these are load-bearing beyond their own behaviour. "a card the
 * learner has never recalled is not something they can say" is what keeps the
 * number evidence rather than a promise. And "nothing returns a ratio" is the
 * same rule that forbids inventing a pronunciation score, pointed at a
 * different number.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { phraseKeyOf, type PracticeTopic, type ReviewCard } from '@parle/core';
import { buildPhrasebook, hasPhrases, LESSONS_GROUP } from './phrasebook.ts';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
/** Epoch ms, because that is what a card stores. */
const days = (n: number) => NOW + n * 86_400_000;

function card(over: Partial<ReviewCard> & { front: string }): ReviewCard {
  return {
    id: `vocab:${over.front}`,
    kind: 'vocab',
    back: 'a gloss',
    context: '',
    ipa: '',
    addedAt: days(-30),
    due: days(10),
    intervalDays: 12,
    ease: 2.5,
    reps: 3,
    lapses: 0,
    ...over,
  };
}

function topic(id: string, title: string, fronts: string[]): PracticeTopic {
  return {
    id,
    title: { fr: title, en: title },
    discussed: ['2026-08-19'],
    phraseKeys: fronts.map(phraseKeyOf),
  };
}

describe('what gets in', () => {
  test('an empty deck produces nothing, and Home draws nothing', () => {
    const book = buildPhrasebook([], [], NOW);
    assert.equal(book.count, 0);
    assert.deepEqual(book.groups, []);
    assert.equal(hasPhrases(book), false);
  });

  test('a card the learner has never recalled is not something they can say', () => {
    const fresh = card({ front: 'la monnaie', reps: 0 });
    const known = card({ front: "l'addition", reps: 4 });
    const book = buildPhrasebook([fresh, known], [], NOW);
    assert.equal(book.count, 1, 'a card added an hour ago and never seen is not evidence');
    assert.equal(book.groups[0]?.phrases[0]?.front, "l'addition");
  });

  test('a sound is not a thing you can say', () => {
    const phoneme = card({ id: 'phoneme:ʁ', kind: 'phoneme', front: 'ʁ', reps: 9 });
    const words = card({ front: 'bonjour' });
    const book = buildPhrasebook([phoneme, words], [], NOW);
    assert.equal(book.count, 1);
  });
});

describe('how it groups', () => {
  const cafe = topic('topic:le-cafe', 'The cafe', ["l'addition", 'un croissant']);
  const market = topic('topic:le-marche', 'The market', ['des pommes']);

  test('phrases sit under the conversation they came out of', () => {
    const cards = [card({ front: "l'addition" }), card({ front: 'un croissant' }), card({ front: 'des pommes' })];
    const book = buildPhrasebook(cards, [cafe, market], NOW);
    assert.equal(book.groups.length, 2);
    assert.equal(book.groups[0]?.title, 'The cafe');
    assert.equal(book.groups[0]?.phrases.length, 2);
    assert.equal(book.groups[1]?.phrases.length, 1);
    assert.equal(book.topics, 2);
  });

  test('anything no conversation claims falls to the lessons group, last', () => {
    const cards = [card({ front: "l'addition" }), card({ front: 'merci beaucoup' })];
    const book = buildPhrasebook(cards, [cafe], NOW);
    const last = book.groups.at(-1);
    assert.equal(last?.id, LESSONS_GROUP);
    assert.equal(last?.phrases[0]?.front, 'merci beaucoup');
    assert.equal(book.topics, 1, 'the lessons group is not a conversation');
  });

  test('a phrase in two topics appears once, in the first', () => {
    const also = topic('topic:le-petit-dejeuner', 'Breakfast', ['un croissant']);
    const book = buildPhrasebook([card({ front: 'un croissant' })], [cafe, also], NOW);
    const total = book.groups.reduce((n, g) => n + g.phrases.length, 0);
    assert.equal(total, 1, 'the same phrase was listed twice');
    assert.equal(book.groups[0]?.id, 'topic:le-cafe', 'first lane wins, as it does in the mix');
  });

  test('a topic with nothing recalled yet does not render an empty heading', () => {
    const book = buildPhrasebook([card({ front: "l'addition" })], [cafe, market], NOW);
    assert.equal(book.groups.length, 1);
  });

  test('grouping survives accents and case, because one rule owns deck ids', () => {
    const shouty = topic('topic:le-cafe', 'The cafe', ["L'Addition"]);
    const book = buildPhrasebook([card({ front: "l'addition" })], [shouty], NOW);
    assert.equal(book.groups[0]?.id, 'topic:le-cafe');
  });
});

describe('how settled a phrase is', () => {
  test('a card that is due is coming back', () => {
    const book = buildPhrasebook([card({ front: 'bonsoir', due: days(-1) })], [], NOW);
    assert.equal(book.groups[0]?.phrases[0]?.hold, 'coming-back');
  });

  test('a card seen a few times on a long interval is steady', () => {
    const book = buildPhrasebook([card({ front: 'bonsoir', reps: 3, intervalDays: 12 })], [], NOW);
    assert.equal(book.groups[0]?.phrases[0]?.hold, 'steady');
  });

  test('a card seen once on a short interval is new', () => {
    const book = buildPhrasebook([card({ front: 'bonsoir', reps: 1, intervalDays: 2 })], [], NOW);
    assert.equal(book.groups[0]?.phrases[0]?.hold, 'new');
  });

  test('due beats settled, because coming back is the more useful thing to know', () => {
    const book = buildPhrasebook(
      [card({ front: 'bonsoir', reps: 9, intervalDays: 40, due: days(-2) })],
      [],
      NOW,
    );
    assert.equal(book.groups[0]?.phrases[0]?.hold, 'coming-back');
  });
});

describe('it never invents a denominator', () => {
  test('counts are counts', () => {
    const cards = ['un', 'deux', 'trois'].map((f) => card({ front: f }));
    const book = buildPhrasebook(cards, [], NOW);
    assert.equal(book.count, 3);
    assert.equal(Number.isInteger(book.count), true);
    assert.equal(Number.isInteger(book.topics), true);
  });

  test('nothing on the returned shape is a ratio', () => {
    const book = buildPhrasebook([card({ front: 'un' })], [], NOW);
    // Parle ships no fixed word list, so a percentage would have nothing behind
    // it. If a `progress` or `percent` field ever appears here, that is the
    // conversation this test exists to force.
    for (const key of Object.keys(book)) {
      assert.ok(
        !/percent|ratio|progress|share|rate/i.test(key),
        `\`${key}\` looks like a proportion, and there is no denominator to base one on`,
      );
    }
  });

  test('nothing is stored, so the same inputs always give the same answer', () => {
    const cards = [card({ front: 'un' }), card({ front: 'deux' })];
    const topics = [topic('topic:x', 'X', ['un'])];
    assert.deepEqual(buildPhrasebook(cards, topics, NOW), buildPhrasebook(cards, topics, NOW));
  });
});
