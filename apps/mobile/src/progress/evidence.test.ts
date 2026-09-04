/**
 * The evidence row, held to its one rule — F366, F367.
 *
 * Nothing is drawn at zero, and each fact appears only once it is real. The
 * screen that draws the row (`tabs/MyFrenchTab.tsx`) and the screen that
 * borrows the level line (`tabs/ProfileTab.tsx`) are read as source in their own
 * suites; this one holds the module.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { evidenceFrom, hasEvidence, levelName } from './evidence.ts';

const NOW = Date.parse('2026-09-03T10:00:00Z');
const nothing = { missions: [], book: { count: 0 }, activity: [] };
/** Enough XP to be somebody, dated inside the window totalXp counts. */
const someXp = [{ at: NOW - 60_000, xp: 40 }];

describe('the evidence row draws nothing at zero — F366', () => {
  test('nothing is drawn at zero, and each fact appears only once it is real — F366', () => {
    const empty = evidenceFrom(nothing);
    assert.equal(hasEvidence(empty), false, 'a learner who has done nothing was handed a row');
    assert.deepEqual(empty.stats, []);

    // One fact at a time, and only the fact that is true.
    const oneSituation = evidenceFrom({ ...nothing, missions: [{ timesFinished: 1 }, { timesFinished: 0 }] });
    assert.deepEqual(oneSituation.stats.map((s) => [s.value, s.label]), [['1', 'Situation handled']]);
    assert.equal(hasEvidence(oneSituation), true);

    const lines = evidenceFrom({ ...nothing, book: { count: 3 } });
    assert.deepEqual(lines.stats.map((s) => [s.value, s.label]), [['3', 'Lines kept']]);

    const level = evidenceFrom({ ...nothing, activity: someXp });
    assert.equal(level.stats.length, 1);
    assert.equal(level.stats[0]!.label, 'Level');
    assert.equal(level.stats[0]!.value, levelFor(40).name, 'the level is not the one core computes');

    // All three, in reading order, and the counts are the counts core keeps.
    const all = evidenceFrom({
      missions: missionStates([], [], NOW).map((item, i) => ({ ...item, timesFinished: i < 2 ? 1 : 0 })),
      book: { count: 1 },
      activity: someXp,
    });
    assert.deepEqual(
      all.stats.map((s) => s.label),
      ['Situations handled', 'Line kept', 'Level'],
    );
    assert.equal(all.situations, 2);
    assert.equal(all.lines, 1);

    // Copy rules: a label is words under a number, and never counts at anybody.
    for (const stat of [...oneSituation.stats, ...lines.stats, ...level.stats, ...all.stats]) {
      assert.doesNotMatch(stat.label, /\d/, `${stat.label} carries a digit`);
      assert.doesNotMatch(stat.label, /—/, `${stat.label} carries an em dash`);
      assert.doesNotMatch(stat.value, /%|\//, `${stat.value} is a ratio, and the row counts, never scores`);
      assert.equal(guiltIn(stat.label), undefined, `${stat.label} carries a guilt word`);
    }
  });
});

describe('the level name is evidence, not a promise — F367', () => {
  test('the level name is said only once something has been earned — F367', () => {
    // A brand new learner is a Beginner by definition, and saying so under
    // their name is telling them they have achieved nothing yet. The line
    // waits for the first XP, exactly as Home's level card does.
    assert.equal(levelName(levelFor(0)), null);
    assert.equal(levelName(levelFor(1)), levelFor(1).name);
    assert.equal(levelName(levelFor(9_999)), levelFor(9_999).name);
    assert.doesNotMatch(levelName(levelFor(150)) ?? '', /\d/, 'a level name is a word, never a number');
  });
});
