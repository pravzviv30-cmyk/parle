import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVEL_NAMES,
  LEVEL_THRESHOLDS,
  DAILY_XP_CAP,
  levelFor,
  lessonXp,
  conversationXp,
  drillXp,
  reviewXp,
  totalXp,
  xpCreditedFor,
  LEVEL_STEP_MAX,
  levelStep,
  levelThreshold,
  xpLevelFor,
  type DatedXp,
} from './levels.ts';

describe('the ladder', () => {
  test('names and thresholds stay the same length', () => {
    assert.equal(LEVEL_NAMES.length, LEVEL_THRESHOLDS.length);
  });

  test('thresholds only ever increase', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i += 1) {
      assert.ok(LEVEL_THRESHOLDS[i]! > LEVEL_THRESHOLDS[i - 1]!, `threshold ${i} must exceed ${i - 1}`);
    }
  });

  test('each level is harder to reach than the last', () => {
    const steps = LEVEL_THRESHOLDS.slice(1).map((t, i) => t - LEVEL_THRESHOLDS[i]!);
    for (let i = 1; i < steps.length; i += 1) {
      assert.ok(steps[i]! > steps[i - 1]!, `step ${i} must be longer than step ${i - 1}`);
    }
  });

  test('every boundary, and one either side of it', () => {
    LEVEL_THRESHOLDS.forEach((threshold, i) => {
      assert.equal(levelFor(threshold).index, i, `${threshold} is exactly level ${i}`);
      assert.equal(levelFor(threshold + 1).index, i, `${threshold + 1} is still level ${i}`);
      if (i > 0) {
        assert.equal(levelFor(threshold - 1).index, i - 1, `${threshold - 1} is still level ${i - 1}`);
      }
    });
  });

  test('starts at Beginner and cannot go below it', () => {
    assert.equal(levelFor(0).name, 'Beginner');
    assert.equal(levelFor(-500).name, 'Beginner');
  });

  test('the top of the ladder has nothing after it', () => {
    const top = levelFor(LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]! + 10_000);
    assert.equal(top.name, 'Veteran');
    assert.equal(top.next, null);
  });

  test('counts forward to the next level, never backward from the last', () => {
    const standing = levelFor(500);
    assert.equal(standing.name, 'Rookie');
    assert.deepEqual(standing.next, { name: 'General', xpAway: 100 });
  });
});

describe('what earns XP', () => {
  test('a lesson pays for words said and for needing less help', () => {
    assert.equal(lessonXp({ wordsProduced: [], unassistedRate: 0 }), 20);
    assert.equal(lessonXp({ wordsProduced: ['a', 'b', 'c'], unassistedRate: 0 }), 26);
    assert.equal(lessonXp({ wordsProduced: ['a', 'b', 'c'], unassistedRate: 0.5 }), 36);
  });

  test('the word bonus stops counting past ten, and the whole thing caps', () => {
    const many = Array.from({ length: 40 }, (_, i) => `w${i}`);
    assert.equal(lessonXp({ wordsProduced: many, unassistedRate: 1 }), 50);
    assert.ok(lessonXp({ wordsProduced: many, unassistedRate: 1 }) <= 60);
  });

  test('a conversation pays more than a lesson for the same effort', () => {
    assert.ok(
      conversationXp({ phraseCount: 3, unassistedRate: 0.6 }) > lessonXp({ wordsProduced: ['a', 'b', 'c'], unassistedRate: 0.6 }),
    );
  });

  test('conversation caps at seventy however much was said', () => {
    assert.equal(conversationXp({ phraseCount: 500, unassistedRate: 1 }), 70);
  });

  test('a clean drill answer is worth more than one that needed the spelling', () => {
    assert.equal(drillXp({ clean: 1, typoCorrected: 0 }), 2);
    assert.equal(drillXp({ clean: 0, typoCorrected: 1 }), 1);
    assert.equal(drillXp({ clean: 30, typoCorrected: 30 }), 30);
  });

  test('review pays per card recalled, and caps', () => {
    assert.equal(reviewXp({ recalled: 7 }), 7);
    assert.equal(reviewXp({ recalled: 900 }), 20);
  });

  test('nothing ever pays negative, whatever it is handed', () => {
    assert.equal(drillXp({ clean: -5, typoCorrected: -5 }), 0);
    assert.equal(reviewXp({ recalled: -5 }), 0);
    assert.equal(conversationXp({ phraseCount: -5, unassistedRate: 0 }), 25);
  });
});

describe('the daily cap', () => {
  // A fixed clock, so the test says something about dates rather than about
  // the day it happens to run.
  const day = (d: number, hour = 12) => new Date(2026, 0, d, hour).getTime();

  test('one ordinary day is counted in full', () => {
    assert.equal(totalXp([{ at: day(1), xp: 40 }, { at: day(1), xp: 30 }]), 70);
  });

  test('a marathon day cannot buy a level', () => {
    const marathon = Array.from({ length: 12 }, () => ({ at: day(1), xp: 60 }));
    assert.equal(totalXp(marathon), DAILY_XP_CAP);
  });

  test('the cap is per day, so returning is what accumulates', () => {
    const week = Array.from({ length: 5 }, (_, i) => ({ at: day(i + 1), xp: 300 }));
    assert.equal(totalXp(week), DAILY_XP_CAP * 5);
  });

  test('a late-night session counts for the day the learner had it', () => {
    // 23:30 and 00:30 are different local days, and must be counted apart.
    const late = [
      { at: day(1, 23) + 30 * 60_000, xp: 80 },
      { at: day(2, 0) + 30 * 60_000, xp: 80 },
    ];
    assert.equal(totalXp(late), 160);
  });

  test('an empty history is zero, not a crash', () => {
    assert.equal(totalXp([]), 0);
  });
});

describe('the numbered level a learner sees', () => {
  test('display levels rise on a fixed curve and never shrink a step', () => {
    // The curve is min(500, 50 + 25(n - 1)) per step, and this table is the
    // contract written down in docs/come-alive/game.md section 2.5.
    const table: Record<number, number> = {
      1: 0, 2: 50, 3: 125, 4: 225, 5: 350, 6: 500, 8: 875, 10: 1350,
      15: 2975, 20: 5225, 21: 5725, 25: 7725, 30: 10225,
    };
    for (const [level, xp] of Object.entries(table)) {
      assert.equal(levelThreshold(Number(level)), xp, `Level ${level} starts at ${xp} XP`);
      assert.equal(xpLevelFor(xp).level, Number(level), `${xp} XP is exactly Level ${level}`);
      if (xp > 0) assert.equal(xpLevelFor(xp - 1).level, Number(level) - 1, `${xp - 1} XP is still Level ${Number(level) - 1}`);
    }
    for (let n = 1; n < 400; n += 1) {
      assert.ok(levelStep(n + 1) >= levelStep(n), `step ${n + 1} is shorter than step ${n}`);
      assert.ok(levelStep(n) <= LEVEL_STEP_MAX, `step ${n} passes the ceiling`);
      assert.equal(levelThreshold(n + 1) - levelThreshold(n), levelStep(n), `Level ${n + 1} is not one step after Level ${n}`);
    }
    // More XP never shows a lower level, and every level's numbers add up.
    let previous = 0;
    for (let xp = 0; xp <= 12_000; xp += 7) {
      const shown = xpLevelFor(xp);
      assert.ok(shown.level >= previous, `${xp} XP showed a lower level than less XP did`);
      previous = shown.level;
      assert.equal(levelThreshold(shown.level) + shown.intoLevel, xp);
      assert.equal(shown.intoLevel + shown.toNext, shown.levelSpan);
      assert.ok(shown.toNext >= 1 && shown.intoLevel >= 0);
    }
  });

  test('a display level is a number on its own curve, apart from the content standing', () => {
    // 150 XP is Rookie for content and Level 3 for the learner. Neither reads
    // the other, so a change to one can never move what the other decides.
    assert.equal(levelFor(150).index, 1);
    assert.equal(xpLevelFor(150).level, 3);
    assert.deepEqual(xpLevelFor(0), { level: 1, intoLevel: 0, levelSpan: 50, toNext: 50 });
    assert.deepEqual(xpLevelFor(5225 + 499), { level: 20, intoLevel: 499, levelSpan: 500, toNext: 1 });
  });

  test('a total that is not a whole positive number never shows more XP than was earned', () => {
    assert.equal(xpLevelFor(-40).level, 1);
    assert.equal(xpLevelFor(Number.NaN).level, 1);
    assert.equal(xpLevelFor(Number.POSITIVE_INFINITY).level, 1);
    assert.equal(xpLevelFor(49.9).level, 1);
    assert.equal(levelThreshold(0), 0);
    assert.equal(levelThreshold(-3), 0);
  });
});

describe('the XP a sitting is credited with', () => {
  const day = (d: number, hour = 12) => new Date(2026, 0, d, hour).getTime();

  test('credited XP respects the daily cap', () => {
    const before: DatedXp[] = [{ at: day(1, 9), xp: 80 }];
    // 80 already counted today: a 30 XP sitting is credited with 20, not 30.
    assert.equal(xpCreditedFor(before, { at: day(1, 18), xp: 30 }), 20);
    // A full day credits nothing more, however much the sitting earned.
    assert.equal(xpCreditedFor([{ at: day(1, 9), xp: 100 }], { at: day(1, 18), xp: 60 }), 0);
    // Another day starts from nothing.
    assert.equal(xpCreditedFor(before, { at: day(2, 9), xp: 30 }), 30);
    // The cap is a parameter, and the default is the one shown cap of 100.
    assert.equal(xpCreditedFor(before, { at: day(1, 18), xp: 30 }, 150), 30);
    assert.equal(DAILY_XP_CAP, 100);

    // Summed over a whole history, the credits are exactly the capped total,
    // so an end card can never name XP the total did not gain.
    const history: DatedXp[] = [
      { at: day(1, 8), xp: 60 }, { at: day(1, 9), xp: 70 }, { at: day(1, 22), xp: 20 },
      { at: day(2, 8), xp: 25 }, { at: day(3, 8), xp: 70 }, { at: day(3, 9), xp: 70 },
    ];
    let credited = 0;
    history.forEach((entry, i) => {
      const gained = xpCreditedFor(history.slice(0, i), entry);
      assert.ok(gained >= 0 && gained <= entry.xp, `entry ${i} was credited ${gained} of ${entry.xp}`);
      credited += gained;
    });
    assert.equal(credited, totalXp(history));
  });

  test('the cap on the total is a parameter, and nothing pays negative', () => {
    const marathon = Array.from({ length: 4 }, () => ({ at: day(1), xp: 60 }));
    assert.equal(totalXp(marathon), DAILY_XP_CAP);
    assert.equal(totalXp(marathon, undefined, 150), 150);
    assert.equal(xpCreditedFor([], { at: day(1), xp: -10 }), 0);
  });
});
