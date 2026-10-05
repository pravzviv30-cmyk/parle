import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { BADGES, MONTH_NAMES, badgeFor, monthlyQuestBadgeId, type BadgeFacts } from './catalogue.ts';
import { newBadges } from './award.ts';
import { streakFrom, type StreakCover } from '../streak/streak.ts';

const nothing: BadgeFacts = {
  longestStreak: 0,
  lifetimeDays: 0,
  conversations: 0,
  scenesOnOwn: 0,
  allA0ScenesEarned: false,
  phraseCards: 0,
  recalls: 0,
  goalDays: 0,
  level: 1,
  soundChecks: 0,
  questMonths: [],
};

/** Each badge, the fact it reads, and the threshold, written out apart from the catalogue. */
const THRESHOLDS: readonly [id: string, fact: keyof BadgeFacts, at: number][] = [
  ['streak-7', 'longestStreak', 7],
  ['streak-30', 'longestStreak', 30],
  ['streak-100', 'longestStreak', 100],
  ['streak-365', 'longestStreak', 365],
  ['days-50', 'lifetimeDays', 50],
  ['days-200', 'lifetimeDays', 200],
  ['first-conversation', 'conversations', 1],
  ['scene-own', 'scenesOnOwn', 1],
  ['phrases-25', 'phraseCards', 25],
  ['phrases-100', 'phraseCards', 100],
  ['recall-100', 'recalls', 100],
  ['goal-7', 'goalDays', 7],
  ['level-10', 'level', 10],
  ['level-25', 'level', 25],
  ['sound-first', 'soundChecks', 1],
];

describe('milestone badges', () => {
  test('each badge awards at its threshold and never twice', () => {
    for (const [id, fact, at] of THRESHOLDS) {
      const below = newBadges({ ...nothing, [fact]: at - 1 }, []);
      assert.ok(!below.includes(id), `${id} awarded at ${fact} ${at - 1}`);
      const reached = newBadges({ ...nothing, [fact]: at }, []);
      assert.ok(reached.includes(id), `${id} not awarded at ${fact} ${at}`);
      assert.ok(!newBadges({ ...nothing, [fact]: at + 50 }, [id]).includes(id), `${id} awarded a second time`);
    }

    // All the beginner scenes is a yes or no, not a count.
    assert.ok(!newBadges(nothing, []).includes('path-a0'));
    assert.ok(newBadges({ ...nothing, allA0ScenesEarned: true }, []).includes('path-a0'));
    assert.deepEqual(newBadges({ ...nothing, allA0ScenesEarned: true }, ['path-a0']), []);

    // A month of quests: 29 is not it, 30 is, and a second ask awards nothing.
    const month = (count: number) => ({ ...nothing, questMonths: [{ month: '2026-10', count }] });
    assert.deepEqual(newBadges(month(29), []), []);
    assert.deepEqual(newBadges(month(30), []), ['quests-2026-10']);
    assert.deepEqual(newBadges(month(45), ['quests-2026-10']), []);

    // Every fixed badge is tested above, by id, so a new badge needs a threshold here too.
    assert.deepEqual(
      BADGES.map((b) => b.id).sort(),
      [...THRESHOLDS.map(([id]) => id), 'path-a0'].sort(),
    );

    // Everything at once, then again: the second answer is empty.
    const everything: BadgeFacts = {
      longestStreak: 400,
      lifetimeDays: 500,
      conversations: 9,
      scenesOnOwn: 9,
      allA0ScenesEarned: true,
      phraseCards: 300,
      recalls: 900,
      goalDays: 90,
      level: 40,
      soundChecks: 9,
      questMonths: [{ month: '2026-10', count: 31 }, { month: '2026-10', count: 30 }, { month: '2026-11', count: 30 }],
    };
    const first = newBadges(everything, []);
    assert.equal(first.length, BADGES.length + 2);
    assert.equal(new Set(first).size, first.length, 'one call awarded a badge twice');
    assert.deepEqual(newBadges(everything, first), []);
    assert.deepEqual(newBadges(everything, new Set(first)), []);
  });

  test('a streak badge stays true after a reset, because it reads the longest run', () => {
    assert.ok(newBadges({ ...nothing, longestStreak: 7 }, []).includes('streak-7'));
  });

  test('a monthly badge is named for its month, and an unreadable month earns nothing', () => {
    assert.equal(monthlyQuestBadgeId('2026-10'), 'quests-2026-10');
    assert.equal(monthlyQuestBadgeId('2026-13'), null);
    assert.equal(monthlyQuestBadgeId('October'), null);
    assert.deepEqual(newBadges({ ...nothing, questMonths: [{ month: '2026-13', count: 99 }] }, []), []);
    assert.deepEqual(badgeFor('quests-2026-10'), {
      id: 'quests-2026-10',
      title: 'October quests',
      line: 'You finished 30 quests in October.',
      hint: 'Finish 30 quests in one month',
      art: 'chest',
    });
    assert.equal(badgeFor('quests-2026-02')?.title, 'February quests');
    assert.equal(MONTH_NAMES.length, 12);
    assert.equal(badgeFor('no-such-badge'), null);
    assert.deepEqual(badgeFor('streak-7'), {
      id: 'streak-7',
      title: 'One week',
      line: 'You reached a 7-day streak.',
      hint: 'Reach a 7-day streak',
      art: 'flame',
    });
  });

  test('a streak badge never claims more days in a row than were practised', () => {
    // Seven practice days in one run, bridged by a freeze on the 4th and a repair on the 7th:
    // the longest run is 7, yet no 7 consecutive dates were practised.
    const practiceDays = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'];
    const covers: StreakCover[] = [
      { day: '2026-10-04', kind: 'freeze', at: 1 },
      { day: '2026-10-07', kind: 'repair', at: 2 },
    ];
    const streak = streakFrom({ practiceDays, covers, today: '2026-10-09' });
    assert.equal(streak.longest, 7);
    const earned = newBadges({ ...nothing, longestStreak: streak.longest, lifetimeDays: streak.lifetimeDays }, []);
    assert.ok(earned.includes('streak-7'));
    assert.equal(badgeFor('streak-7')?.line, 'You reached a 7-day streak.');

    // The line names the streak, which is true, never a run of dates, which may not be.
    for (const [id, n] of [['streak-7', 7], ['streak-30', 30], ['streak-100', 100], ['streak-365', 365]] as const) {
      assert.equal(badgeFor(id)?.line, `You reached a ${n}-day streak.`);
    }
    const all = [...BADGES.map((b) => badgeFor(b.id)!), ...MONTH_NAMES.map((_, i) => badgeFor(`quests-2026-${`${i + 1}`.padStart(2, '0')}`)!)];
    for (const badge of all) {
      for (const text of [badge.title, badge.line, badge.hint]) {
        assert.doesNotMatch(text, /in a row|consecutive|straight days/i, `${badge.id} claims a run of dates: "${text}"`);
      }
    }
  });

  test('every badge title, line and hint reads as a plain, kind fact', () => {
    // Mirrors the shared ban list in apps/mobile/src/copy/guilt.ts, less
    // "streak", which founder decision D2 retired. Substring on purpose.
    const BANNED = ['missed', 'lost', 'lose', 'break', 'keep it up', "don't", 'do not', 'again tomorrow or', 'failed', 'behind', 'owe', 'locked'];
    const titles = [
      ['streak-7', 'One week'],
      ['streak-30', 'One month'],
      ['streak-100', '100 days'],
      ['streak-365', 'One year'],
      ['days-50', '50 practice days'],
      ['days-200', '200 practice days'],
      ['first-conversation', 'First conversation'],
      ['scene-own', 'On your own'],
      ['path-a0', 'All beginner scenes'],
      ['phrases-25', '25 phrases kept'],
      ['phrases-100', '100 phrases kept'],
      ['recall-100', '100 recalls'],
      ['goal-7', 'Goal met 7 times'],
      ['level-10', 'Level 10'],
      ['level-25', 'Level 25'],
      ['sound-first', 'First sound check'],
    ];
    assert.deepEqual(BADGES.map((b) => [b.id, b.title]), titles);
    const all = [...BADGES.map((b) => badgeFor(b.id)!), ...MONTH_NAMES.map((_, i) => badgeFor(`quests-2026-${`${i + 1}`.padStart(2, '0')}`)!)];
    for (const badge of all) {
      for (const text of [badge.title, badge.line, badge.hint]) {
        assert.ok(text.trim().length > 0, `${badge.id} has an empty string`);
        assert.ok(!/[—–·]/.test(text), `${badge.id} uses a dash or a middot: "${text}"`);
        for (const word of BANNED) assert.ok(!text.toLowerCase().includes(word), `${badge.id} says "${word}": "${text}"`);
      }
      assert.match(badge.line, /^You .+\.$/, `${badge.id}'s line should say what the learner did`);
    }
  });
});
