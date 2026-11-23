/**
 * Home's one nudge line (F767): said only while a streak is really running
 * and today is still open, in warm, factual words that pass the streak copy
 * rules, and on a milestone's eve it names the milestone.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addDays, streakFrom } from '@luvani/core';

import { guiltIn, streakGuiltIn } from '../copy/guilt.ts';
import { homeNudge, todayNudge } from './nudge.ts';

const TODAY = '2026-10-07';
const daysBefore = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 7 - (n - i)));
    return d.toISOString().slice(0, 10);
  });

describe("Home's nudge line — F767", () => {
  test('the nudge line is warm, factual and appears only when the streak is real and today is unpractised', () => {
    // A real run waiting on today: three practice days up to yesterday.
    const waiting = streakFrom({ practiceDays: daysBefore(3), covers: [], today: TODAY });
    assert.equal(waiting.current, 3);
    assert.equal(homeNudge(waiting), 'Your 3-day streak is waiting. A short practice today makes it 4.');

    // Practised today: nothing to say.
    const done = streakFrom({ practiceDays: [...daysBefore(3), TODAY], covers: [], today: TODAY });
    assert.equal(homeNudge(done), null, 'a learner who has practised today is nudged');

    // No run, a run that ended (a gap yesterday) and a first day: nothing.
    assert.equal(homeNudge(streakFrom({ practiceDays: [], covers: [], today: TODAY })), null, 'a learner with no run is nudged');
    assert.equal(homeNudge(streakFrom({ practiceDays: ['2026-10-03', '2026-10-04'], covers: [], today: TODAY })), null, 'a run that already ended is nudged as if it were waiting');
    // Unread facts: nothing, never a guess.
    assert.equal(homeNudge(null), null);
    assert.equal(homeNudge({ current: Number.NaN, today: 'open' }), null);

    // A covered yesterday keeps the run alive, so the line is still true.
    const covered = streakFrom({ practiceDays: ['2026-10-04', '2026-10-05'], covers: [{ day: '2026-10-06', kind: 'freeze', at: 1 }], today: TODAY });
    assert.equal(covered.current, 2);
    assert.match(homeNudge(covered) ?? '', /^Your 2-day streak is waiting\./);

    // On a milestone's eve the line names the milestone.
    const eve = streakFrom({ practiceDays: daysBefore(6), covers: [], today: TODAY });
    assert.equal(homeNudge(eve), 'One practice today reaches your 7-day milestone.');
    assert.equal(homeNudge({ current: 29, today: 'open' }), 'One practice today reaches your 30-day milestone.');

    // Warm and factual: every line it can say passes the streak copy rules,
    // with no dash, no shout and no claim of days in a row.
    const lines = [1, 2, 6, 12, 29, 99, 364, 729].map((current) => homeNudge({ current, today: 'open' })!);
    for (const line of lines) {
      assert.equal(streakGuiltIn(line), undefined, `"${line}" says "${streakGuiltIn(line) ?? ''}"`);
      assert.equal(guiltIn(line), undefined);
      assert.doesNotMatch(line, /[—–·!]/, `"${line}" carries a dash or shouts`);
      assert.doesNotMatch(line, /\bin a row\b|\bmissed\b|\blose\b|\bbefore midnight\b|\bhours?\b/i, `"${line}" threatens or counts down`);
    }

    // UI-015: TodayStats.tsx reads it (as TodayHero.tsx did) and the sky draws
    // it under the tiles, and only when there is one, in onBrand on the sky.
    const hero = readFileSync(new URL('../game/TodayStats.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    assert.match(hero, /const \{ nudge, ask \} = nudgeSlot\(run, today, known\);/);
    const sky = readFileSync(new URL('./SkyBand.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    assert.match(sky, /<Text style=\{\[type\.body, s\.grow, \{ color: t\.onBrand \}\]\}>\{nudge\}<\/Text>/);
  });
});

describe("Board A: a freeze covered a day, in Today's nudge slot (founder, 2026-11-19)", () => {
  const before = (n: number): string => addDays(TODAY, -n);
  const never = (): boolean => false;
  const freeze = (n: number) => ({ day: before(n), kind: 'freeze' as const, at: 1 });

  test('one covered day is yesterday or its weekday, with the freeze mark and its own seen key', () => {
    const yesterday = streakFrom({ practiceDays: [before(4), before(3), before(2)], covers: [freeze(1)], today: TODAY });
    assert.deepEqual(todayNudge(yesterday, TODAY, never), { text: 'A freeze covered yesterday.', freezeMark: true, seenKey: `covered:${before(1)}` });
    const monday = streakFrom({ practiceDays: [before(4), before(3), before(1)], covers: [freeze(2)], today: TODAY });
    assert.equal(monday.today, 'open');
    assert.deepEqual(todayNudge(monday, TODAY, never), { text: homeNudge(monday)!, freezeMark: false, seenKey: null }, 'a freeze before the last practice is old news');
  });

  test('a weekday names a covered day that was not yesterday', () => {
    const two = streakFrom({ practiceDays: [before(5), before(4), before(3)], covers: [freeze(2), { day: before(1), kind: 'travel' as const, at: 1 }], today: TODAY });
    assert.equal(todayNudge(two, TODAY, never)?.text, 'A freeze covered Monday.', 'a travel day was counted as a freeze');
  });

  test('two or more covered days are counted', () => {
    const run = streakFrom({ practiceDays: [before(5), before(4), before(3)], covers: [freeze(2), freeze(1)], today: TODAY });
    assert.deepEqual(todayNudge(run, TODAY, never), { text: 'Freezes covered 2 days.', freezeMark: true, seenKey: `covered:${before(1)}` });
  });

  test('once seen it is gone, and the usual line comes back', () => {
    const run = streakFrom({ practiceDays: [before(4), before(3), before(2)], covers: [freeze(1)], today: TODAY });
    assert.deepEqual(todayNudge(run, TODAY, (key) => key === `covered:${before(1)}`), { text: homeNudge(run)!, freezeMark: false, seenKey: null });
  });

  test('a milestone eve keeps the slot, and nothing speaks once today is practised', () => {
    const eve = streakFrom({ practiceDays: [6, 5, 4, 3, 2, 1].map((n) => before(n + 1)), covers: [freeze(1)], today: TODAY });
    assert.equal(eve.current, 6);
    assert.deepEqual(todayNudge(eve, TODAY, never), { text: 'One practice today reaches your 7-day milestone.', freezeMark: false, seenKey: null });
    const done = streakFrom({ practiceDays: [before(3), before(2), TODAY], covers: [freeze(1)], today: TODAY });
    assert.equal(todayNudge(done, TODAY, never), null);
    assert.equal(todayNudge(null, TODAY, never), null);
  });
});
