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
