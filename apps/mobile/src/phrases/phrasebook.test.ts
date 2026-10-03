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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SETTLED_DAYS, SETTLED_REPS, isSettled, phraseKeyOf, type PracticeTopic, type ReviewCard } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { buildPhrasebook, hasPhrases, hasSaved, LESSONS_GROUP, OTHER_PHRASES_TITLE, SAVED_NOTE, SAVED_TITLE } from './phrasebook.ts';

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
    // Luvani ships no fixed word list, so a percentage would have nothing behind
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

describe('the shelf is core\'s rule, not a second copy of it', () => {
  const hold = (over: Partial<ReviewCard>) =>
    buildPhrasebook([card({ front: 'bonsoir', ...over })], [], NOW).groups[0]?.phrases[0]?.hold;

  test('a phrase settles on the numbers core keeps, wherever core puts them', () => {
    // Driven off the exported thresholds rather than a 2 and a 7 typed here.
    // This file used to hold its own pair, which made the phrasebook one of the
    // four places with an opinion about whether somebody knew a phrase; the
    // point of moving them was that a change in core reaches this shelf.
    const notDue = { due: days(1) };
    assert.equal(hold({ ...notDue, reps: SETTLED_REPS, intervalDays: SETTLED_DAYS }), 'steady');
    assert.equal(hold({ ...notDue, reps: SETTLED_REPS - 1, intervalDays: SETTLED_DAYS }), 'new', 'one review short is not a habit');
    assert.equal(hold({ ...notDue, reps: SETTLED_REPS, intervalDays: SETTLED_DAYS - 1 }), 'new', 'one day short is not a habit');

    // And the shelf agrees with the projection it now asks, card for card.
    // reps starts at one: a card nobody has recalled is not in the phrasebook
    // at all, which is a different rule and has its own test above.
    for (const reps of [1, SETTLED_REPS, SETTLED_REPS + 3]) {
      for (const intervalDays of [0, SETTLED_DAYS - 1, SETTLED_DAYS, SETTLED_DAYS + 13]) {
        const c = card({ front: 'bonsoir', reps, intervalDays, due: days(1) });
        const expected = isSettled(c, NOW) ? 'steady' : 'new';
        assert.equal(hold({ reps, intervalDays, due: days(1) }), expected, `the shelf moved at reps ${reps}, interval ${intervalDays}`);
      }
    }
  });

  test('the three words the learner reads did not change when the rule moved', () => {
    // A relocation, not new copy. Someone opening the phrasebook the day after
    // this shipped sees exactly the shelves they saw the day before.
    // Comments stripped: the header explains what the two thresholds used to
    // be called, and an explanation of a removal is not the removal undone.
    const raw = readFileSync(fileURLToPath(new URL('./phrasebook.ts', import.meta.url)), 'utf8');
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.match(source, /'steady' \| 'coming-back' \| 'new'/, 'the shelf names changed');
    assert.ok(!source.includes('STEADY_REPS'), 'the phrasebook keeps its own threshold again');
    assert.ok(!source.includes('STEADY_DAYS'), 'the phrasebook keeps its own threshold again');
    assert.doesNotMatch(source, /card\.reps >=|card\.intervalDays >=|card\.due <=/, 'the phrasebook decides dueness itself again');
    assert.match(source, /isDue\(card, now\)/, 'dueness is no longer asked of core');
    assert.match(source, /isSettled\(card, now\)/, 'settledness is no longer asked of core');
  });
});

describe('provenance is a fact, never a guess — whole-app phase 1', () => {
  const cafe = topic('topic:le-cafe', 'The cafe', ["l'addition"]);
  const pack = { id: 'pack-1', title: { en: 'Ordering at a café' }, keyPhrases: [{ fr: 'Sur place, merci.' }] };

  test('a saved-conversation phrase with no topic sits under that conversation, not under lessons', () => {
    const book = buildPhrasebook([card({ front: "l'addition" }), card({ front: 'Sur place, merci.' })], [cafe], NOW, [pack]);
    assert.deepEqual(book.groups.map((g) => g.title), ['The cafe', 'Ordering at a café']);
    assert.ok(!book.groups.some((g) => g.id === LESSONS_GROUP), 'a pack phrase was labelled as a lesson');
  });

  test('a topic still wins over a pack for the same phrase, so a phrase is listed once', () => {
    const also = { ...pack, keyPhrases: [{ fr: "l'addition" }] };
    const book = buildPhrasebook([card({ front: "l'addition" })], [cafe], NOW, [also]);
    assert.equal(book.groups.length, 1);
    assert.equal(book.groups[0]?.id, 'topic:le-cafe');
  });

  test('a phrase saved from a conversation but never recalled is shown apart, and never counted as retained — Stage 1', () => {
    // The finding: a phrase the learner saved from a conversation lands in the
    // deck at reps 0, the retained groups rightly leave it out, and so it
    // vanished from the page entirely. It is shown now, in its own list under
    // an honest name, and it still adds nothing to the count or the groups.
    const older = card({ front: 'Sur place, merci.', reps: 0, addedAt: days(-2) });
    const newer = card({ front: 'Autre chose ?', reps: 0, addedAt: days(-1) });
    const lapsed = card({ front: 'un croissant', reps: 0, lapses: 2, addedAt: days(-3) });
    const known = card({ front: "l'addition", reps: 4 });
    const sound = card({ id: 'phoneme:y', kind: 'phoneme', front: 'y', reps: 0 });
    const book = buildPhrasebook([older, known, newer, sound, lapsed], [cafe], NOW, [pack]);

    assert.equal(book.count, 1, 'a saved phrase was counted as one the learner can say');
    assert.deepEqual(book.groups.map((g) => g.id), ['topic:le-cafe'], 'a saved phrase reached a retained group');
    assert.deepEqual(book.saved.map((p) => p.front), ['Autre chose ?', 'Sur place, merci.', 'un croissant'], 'the saved list is not every unrecalled phrase, newest first');
    assert.equal(book.saved.find((p) => p.front === 'Sur place, merci.')?.source, 'Ordering at a café', 'a saved line loses its known situation');
    assert.equal(book.saved.find((p) => p.front === 'Autre chose ?')?.source, undefined, 'an unknown source is guessed from the words');
    assert.ok(!book.saved.some((p) => p.front === 'y'), 'a sound is not a phrase, saved or not');
    for (const phrase of book.saved) {
      assert.equal('hold' in phrase, false, 'a saved phrase carries a shelf, which is a claim about how well it is held');
    }
    assert.equal(hasPhrases(buildPhrasebook([older], [], NOW)), false, 'a saved phrase alone makes the retained list look non-empty');
    assert.equal(hasSaved(buildPhrasebook([older], [], NOW)), true);
    assert.equal(hasSaved(buildPhrasebook([known], [], NOW)), false);
    assert.deepEqual(buildPhrasebook([], [], NOW).saved, []);

    // The name says what is true: saved, and not yet recalled. No word that
    // claims the learner holds it, no count, no dash, nothing that scolds.
    for (const line of [SAVED_TITLE, SAVED_NOTE]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—/, `"${line}" counts something or carries an em dash`);
      assert.doesNotMatch(line, /retain|know|mastered|learnt|learned|can say/i, `"${line}" claims retention`);
    }
    assert.match(SAVED_TITLE, /^Saved/, 'the heading does not say these are saved');
  });

  test('an unknown source reads as a neutral group, never as lessons', () => {
    const book = buildPhrasebook([card({ front: 'merci beaucoup' })], [], NOW, []);
    assert.equal(book.groups[0]?.title, OTHER_PHRASES_TITLE);
    assert.doesNotMatch(OTHER_PHRASES_TITLE, /lesson/i);
  });
});

test('the phrase library displays and groups the French of turn cards, including saved-only lines',()=>{
 const fr='Un café, s’il vous plaît.';const en='A coffee, please.';
 const recalled=card({id:'turn:cafe:order',kind:'turn',front:en,back:fr,reps:1});
 const saved=card({id:'turn:cafe:thanks',kind:'turn',front:'Thank you.',back:'Merci.',reps:0});
 const book=buildPhrasebook([recalled,saved],[],NOW,[{id:'owned-pack',title:{en:'At the café'},keyPhrases:[{fr}]}]);
 assert.equal(book.count,1);assert.equal(book.groups[0]?.title,'At the café');
 assert.deepEqual(book.groups[0]?.phrases[0],{id:recalled.id,front:fr,back:en,hold:'new'});
 assert.deepEqual(book.saved,[{id:saved.id,front:'Merci.',back:'Thank you.'}]);
 const malformed=card({id:'bad',kind:'turn',front:'Coffee',back:' ',reps:1});
 assert.equal(buildPhrasebook([malformed],[],NOW).count,0,'an empty French answer was counted as a phrase');
});
