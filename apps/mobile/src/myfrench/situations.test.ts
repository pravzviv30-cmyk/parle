/**
 * The chip on a situation, and the four things the mockup's chips said.
 *
 * "100%", "85% Spoken", "70% Active" and "Locked - Next" are all claims this
 * product cannot make: three are shares with no denominator, and the fourth is
 * a state that does not exist, because every situation is open in any order.
 * These hold what replaced them to the same bar the rest of the tab keeps.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MissionState } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { STAMP_STATES } from '../progress/passport.ts';
import { CHIP, NEXT_PLACES, YOU_CAN_NOW, chipFor, splitByStamp } from './situations.ts';

const STATES: MissionState[] = ['new', 'in-progress', 'complete', 'needs-review'];

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the situation chip — F467', () => {
  test('only a scene handled with nothing handed over is filled', () => {
    // The same claim the passport's mark made, in words. If any other state
    // took the green, "on your own" would stop meaning anything.
    for (const stamp of STAMP_STATES) {
      for (const state of STATES) {
        const chip = chipFor(stamp, state);
        assert.equal(chip.earned, stamp === 'on-your-own', `${stamp}/${state} was filled as though it were earned`);
      }
    }
  });

  test('every combination says something, and nothing says it is locked', () => {
    // `suggestedMission` deliberately gates nothing, so a chip claiming a
    // situation is unavailable would be inventing a wall the product refuses.
    for (const stamp of STAMP_STATES) {
      for (const state of STATES) {
        const { text } = chipFor(stamp, state);
        assert.notEqual(text.trim(), '', `${stamp}/${state} produced an empty chip`);
        assert.doesNotMatch(text, /lock|unlock|not available|coming soon/i, `${stamp}/${state} says "${text}"`);
      }
    }
  });

  test('the three ways of not having finished are told apart', () => {
    // "Never walked into", "walked into and unfinished" and "the phrases are
    // going quiet" are different things, and only one of them is a first visit.
    assert.equal(chipFor('not-yet', 'new').text, CHIP.ready);
    assert.equal(chipFor('not-yet', 'in-progress').text, CHIP.started);
    assert.equal(chipFor('not-yet', 'needs-review').text, CHIP.again);
    assert.notEqual(CHIP.again, CHIP.ready, 'coming back to a scene and never having walked into it read the same');
    assert.equal(chipFor('with-help', 'complete').text, CHIP.helped);
    assert.equal(chipFor('on-your-own', 'complete').text, CHIP.own);
  });

  test('no chip carries a number, a share, or a word that scolds', () => {
    for (const text of Object.values(CHIP)) {
      assert.doesNotMatch(text, /\d|%/, `"${text}" counts at the learner on a row`);
      assert.equal(guiltIn(text), undefined, `"${text}" carries a banned word`);
      assert.ok(!text.includes('—'), `"${text}" carries an em dash`);
    }
  });

  test('a chip is short enough to sit beside a title', () => {
    // The whole reason this module exists, and the number is not arbitrary. At
    // 375pt an eighteen-character chip left the title column narrower than
    // "réception", so the word hyphenated itself in the middle. Twelve is what
    // fits beside the longest situation name this catalogue carries.
    for (const text of Object.values(CHIP)) {
      assert.ok(text.length <= 12, `"${text}" is ${text.length} characters and will break a title mid-word`);
    }
  });
});

describe('the situations, in two groups — F575', () => {
  const rows = [
    { id: 'cafe', earned: false },
    { id: 'hotel', earned: true },
    { id: 'market', earned: false },
    { id: 'street', earned: true },
  ];

  test('a learner meets the places that are theirs first, in the order they arrived', () => {
    const split = splitByStamp(rows);
    assert.deepEqual(split.own.map((row) => row.id), ['hotel', 'street'], 'the stamped rows do not lead, in the order they arrived');
    assert.deepEqual(split.next.map((row) => row.id), ['cafe', 'market']);
  });

  test('a learner on a first morning meets Next places alone and never an empty You can now', () => {
    // A heading over no rows says the learner has done none of this, which is
    // the one thing a page of places must not say before they have started.
    const none = splitByStamp(rows.map((row) => ({ ...row, earned: false })));
    assert.equal(none.own.length, 0);
    assert.equal(none.next.length, rows.length);
  });

  test('the place core suggests is the first one a learner sees under Next places', () => {
    // This is what let the next-situation card go: the suggestion is drawn once
    // now, as a row, rather than as a card with a pill at the foot of the page.
    const split = splitByStamp(rows, 'market');
    assert.deepEqual(split.next.map((row) => row.id), ['market', 'cafe'], 'the suggested place does not lead the rest');
    assert.deepEqual(split.own.map((row) => row.id), ['hotel', 'street'], 'the suggestion reordered the places already theirs');

    // Nothing suggested leaves the catalogue order alone, and a suggestion
    // already stamped is not pulled back out of the learner's own group.
    assert.deepEqual(splitByStamp(rows, null).next.map((row) => row.id), ['cafe', 'market']);
    assert.deepEqual(splitByStamp(rows, 'hotel').next.map((row) => row.id), ['cafe', 'market']);
  });

  test('every row is drawn exactly once, whatever core suggests', () => {
    // The split is a partition, not a filter. A row that fell out of both
    // groups would be a place the learner could no longer reach.
    for (const suggestedId of [null, 'cafe', 'hotel', 'market', 'street', 'missing']) {
      const split = splitByStamp(rows, suggestedId);
      const seen = [...split.own, ...split.next].map((row) => row.id).sort();
      assert.deepEqual(seen, ['cafe', 'hotel', 'market', 'street'], `a place was dropped or doubled for ${suggestedId}`);
    }
  });

  test('the headings name the two groups without counting or locking either', () => {
    for (const line of [...Object.values(YOU_CAN_NOW), ...Object.values(NEXT_PLACES)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—|lock(ed)? (behind|until)/i, `"${line}" counts, dashes or locks`);
    }
    // The three dots are the founder's, and they are what makes the heading run
    // into the row under it as one sentence about the learner.
    assert.equal(YOU_CAN_NOW.label, 'You can now...');
    assert.equal(NEXT_PLACES.label, 'Next places');
  });

  test('the card draws the split it did not make, and names no state of its own', () => {
    const card = read('./SituationsCard.tsx');
    assert.match(card, /const \{ own, next \} = splitByStamp\(model\.situations, model\.suggestedId\)/, 'the card splits the rows itself');
    assert.match(card, /\{own\.length > 0 && \(/, 'the you-can-now group draws with nothing in it');
    assert.match(card, /<Label>\{YOU_CAN_NOW\.label\}<\/Label>/, 'the card spells its own heading');
    assert.match(card, /<Label>\{NEXT_PLACES\.label\}<\/Label>/, 'the rest is not headed by the module\'s word');
    assert.ok(!card.includes("'on-your-own'") && !card.includes('isStamped('), 'the card decides who is stamped');
    assert.ok(!card.includes('ownLine'), 'the count above the situations came back; revamp A draws no digit on this page');
  });
});
