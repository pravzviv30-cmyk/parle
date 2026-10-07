/**
 * Home's one nudge line (F767): said only while a streak is really running
 * and today is still open, in warm, factual words that pass the streak copy
 * rules, and on a milestone's eve it names the milestone.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { streakFrom } from '@luvani/core';

import { guiltIn, streakGuiltIn } from '../copy/guilt.ts';
import { homeNudge } from './nudge.ts';

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

    // The hero draws it under itself, and only when there is one.
    const hero = readFileSync(new URL('../game/TodayHero.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    assert.match(hero, /const nudge = homeNudge\(run\);/);
    assert.match(hero, /\{nudge !== null \? <Text style=\{\[type\.body, \{ color: paper\.ink \}\]\}>\{nudge\}<\/Text> : null\}/);
  });
});
