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
import { evidenceFrom, hasEvidence } from './evidence.ts';

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

    // 2026-09-27: XP alone is no longer a fact the row says. Rank names left
    // with the CEFR spine; what a learner can do is the evidence now.
    const level = evidenceFrom({ ...nothing, activity: someXp });
    assert.deepEqual(level.stats, [], 'XP alone put a rank name in the row');
    assert.equal(hasEvidence(level), false);

    // Both facts, in reading order, and the counts are the counts core keeps.
    const all = evidenceFrom({
      missions: missionStates([], [], NOW).map((item, i) => ({ ...item, timesFinished: i < 2 ? 1 : 0 })),
      book: { count: 1 },
      activity: someXp,
    });
    assert.deepEqual(
      all.stats.map((s) => s.label),
      ['Situations handled', 'Line kept'],
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

describe('no rank name is said in the row — F367', () => {
  test('no rank name appears in the stats at any amount of XP — F367', () => {
    // F367 held that a level name at zero XP is a promise, not evidence. The
    // CEFR spine (2026-09-27) goes further: a rank name is never the evidence,
    // at any XP. The row says what was done; the spine says what you can do.
    const rankNames = new Set<string>([0, 1, 150, 9_999, 1_000_000].map((xp) => levelFor(xp).name));
    for (const xp of [1, 40, 150, 9_999]) {
      const evidence = evidenceFrom({
        missions: [{ timesFinished: 1 }],
        book: { count: 2 },
        activity: [{ at: NOW - 60_000, xp }],
      });
      for (const stat of evidence.stats) {
        assert.ok(!rankNames.has(stat.value), `at ${xp} XP the row said the rank name "${stat.value}"`);
        assert.notEqual(stat.label, 'Level', `at ${xp} XP the row carries a Level stat`);
      }
    }
  });

  test('the module no longer offers a level name to borrow — F367', async () => {
    const module: Record<string, unknown> = await import('./evidence.ts');
    assert.equal(module.levelName, undefined, 'levelName is back, and a screen can say a rank name again');
  });
});
