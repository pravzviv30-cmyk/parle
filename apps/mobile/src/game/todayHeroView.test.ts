/**
 * Home's hero, from the records it reads (F767).
 *
 * The facts are built the way the game layer reads them (practice days, the
 * activity log with and without measured time, the game store) and folded by
 * `gameViewFrom`, the same fold the hooks serve, so what is held here is the
 * hero a phone would draw from those records. The screen is held to drawing
 * this model and nothing it worked out itself.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_NAMES } from '@luvani/core';

import type { ActivityEntry } from '../progress/activity.ts';
import { emptyGame } from './model.ts';
import { todayHeroView } from './todayHeroView.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, type GameFacts } from './view.ts';

const TODAY = '2026-10-07';
const at = (day: number, hour: number, minute = 0): number => new Date(2026, 9, day, hour, minute).getTime();
const MIN = 60_000;

function facts(overrides: Partial<GameFacts> & { goal?: 5 | 10 | 15 | 20 | null } = {}): GameFacts {
  const activity: ActivityEntry[] = [
    // A drill this morning, 6.5 measured minutes.
    { at: at(7, 9), kind: 'drill', xp: 30, activeMs: 6.5 * MIN },
    // A conversation with no measured time: untimed adds nothing to the minutes.
    { at: at(7, 10), kind: 'convo', xp: 40 },
  ];
  return {
    activity,
    practiceDays: ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
    game: emptyGame(),
    outside: { ...NO_OUTSIDE_FACTS, goalTarget: overrides.goal === undefined ? 10 : overrides.goal },
    billing: null,
    ...overrides,
  };
}

function heroOf(f: GameFacts) {
  const view = gameViewFrom(f, TODAY);
  return todayHeroView({ streak: view.streak, goal: view.goal, level: view.level, xp: view.xp });
}

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe("Home's today hero — F767", () => {
  test("Home's today hero shows the streak, today's measured goal minutes and the level from real records, and claims nothing it could not read", () => {
    const hero = heroOf(facts());
    assert.ok(hero, 'records that were read drew no hero');

    // The run: practice days in the live run, lit because today counts.
    assert.equal(hero.flame.count, 4);
    assert.equal(hero.flame.lit, true);
    assert.equal(hero.flame.words, 'day streak');
    assert.equal(hero.flame.label, '4-day streak, practised today. Opens your streak.');

    // Today's minutes: measured active time only, floored; the untimed
    // conversation adds nothing, and wall-clock time is never read.
    assert.equal(hero.goal.minutes, 6);
    assert.equal(hero.goal.target, 10);
    assert.equal(hero.goal.fraction, 0.6);
    assert.equal(hero.goal.met, false);
    assert.equal(hero.goal.words, '6 of 10 min today');
    assert.equal(hero.goal.label, 'Daily goal: 6 of 10 minutes practised today. Opens your streak.');

    // The level: a number from the displayed XP (70: Level 2, 55 to Level 3),
    // never a rank name.
    assert.equal(hero.level.level, 2);
    assert.equal(hero.level.words, 'Level 2');
    assert.equal(hero.level.label, 'Level 2, 70 XP, 55 XP to Level 3. Opens Progress.');
    for (const name of LEVEL_NAMES) {
      for (const said of [hero.level.words, hero.level.label, hero.flame.label, hero.goal.label]) {
        assert.ok(!said.includes(name), `the hero names the rank "${name}"`);
      }
    }

    // Before today's first practice the flame is unlit and the run still shows.
    const open = heroOf(facts({ practiceDays: ['2026-10-04', '2026-10-05', '2026-10-06'], activity: [] }))!;
    assert.equal(open.flame.lit, false);
    assert.equal(open.flame.count, 3);
    assert.equal(open.flame.label, '3-day streak, not practised yet today. Opens your streak.');
    assert.equal(open.goal.minutes, 0);
    assert.equal(open.goal.words, '0 of 10 min today');

    // No run: no number at all, and the words say how one starts.
    const none = heroOf(facts({ practiceDays: [], activity: [] }))!;
    assert.equal(none.flame.count, null, 'a learner with no run is shown a nought');
    assert.equal(none.flame.words, 'Start a streak');

    // No goal chosen: no ring, only the minutes.
    const free = heroOf(facts({ goal: null }))!;
    assert.equal(free.goal.fraction, null);
    assert.equal(free.goal.words, '6 min today');
    assert.equal(free.goal.label, '6 minutes practised today. Opens your streak.');

    // Met: the floored minutes reach the goal.
    const met = heroOf(facts({ goal: 5 }))!;
    assert.equal(met.goal.met, true);
    assert.equal(met.goal.fraction, 1);
    assert.equal(met.goal.words, 'Daily goal reached');

    // Anything unread draws no hero, never a nought.
    const view = gameViewFrom(facts(), TODAY);
    const full = { streak: view.streak, goal: view.goal, level: view.level, xp: view.xp };
    for (const missing of ['streak', 'goal', 'level', 'xp'] as const) {
      assert.equal(todayHeroView({ ...full, [missing]: null }), null, `with ${missing} unread the hero still draws`);
    }

    // The screen draws this model from the hooks and works nothing out itself.
    const screen = stripComments(readFileSync(new URL('./TodayHero.tsx', import.meta.url), 'utf8')).replace(/\s+/g, ' ');
    assert.match(screen, /const hero = todayHeroView\(\{ streak: run, goal, level, xp \}\)/);
    for (const hook of ['useStreak()', 'useGoal()', 'useLevel()', 'useXp()']) assert.ok(screen.includes(hook), `the hero does not read ${hook}`);
    assert.doesNotMatch(screen, /\b(?:levelFor|xpLevelFor|totalXp|displayXp|goalProgressFrom|streakFrom)\(/, 'the hero works a number out itself');
    assert.match(screen, /if \(hero === null\) \{[^}]*return failed \? null : <Skeleton/, 'an unread hero draws something other than nothing');
  });
});

// 2026-10-20, B5 learning-science review: with no run the stats tile says
// "Practice" over "not yet today", with no streak word until a run exists.
import { statTiles as b5Tiles } from './todayHeroView.ts';
import { test as b5Test } from 'node:test';
import assertB5 from 'node:assert/strict';
b5Test('the streak tile names no streak before a run exists', () => {
  const hero = {
    flame: { lit: false, count: null, words: '', label: '' },
    goal: { minutes: 6, target: 10, fraction: 0.6, met: false, words: '', label: '' },
    level: { level: 2, words: '', label: '' },
  };
  assertB5.deepEqual(b5Tiles(hero, 140).streak, { value: 'Practice', label: 'not yet today' });
  assertB5.doesNotMatch(JSON.stringify(b5Tiles(hero, 140).streak), /streak/i);
  assertB5.deepEqual(b5Tiles({ ...hero, flame: { ...hero.flame, count: 3 } }, 140).streak, { value: '3 days', label: 'streak' });
  assertB5.deepEqual(b5Tiles(hero, 140).goal, { value: '6 of 10', label: 'min today' });
  assertB5.deepEqual(b5Tiles({ ...hero, goal: { ...hero.goal, target: null, fraction: null } }, 140).goal, { value: '6 min', label: 'today' });
});
