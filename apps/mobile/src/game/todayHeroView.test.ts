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
import { statTileLayout, statTileView, todayHeroView, type TodayHeroView } from './todayHeroView.ts';
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
    assert.equal(hero.level.words, 'XP level 2');
    assert.equal(hero.level.label, 'XP level 2, 70 XP, 55 to the next. Opens Progress.');
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

    // The screen draws this model from the hooks and works nothing out itself
    // (UI-015: the retired stats-row hero's reads moved to TodayStats.tsx unchanged).
    const screen = stripComments(readFileSync(new URL('./TodayStats.tsx', import.meta.url), 'utf8')).replace(/\s+/g, ' ');
    assert.match(screen, /const hero = todayHeroView\(\{ streak: run, goal, level, xp \}\)/);
    for (const hook of ['useStreak()', 'useGoal()', 'useLevel()', 'useXp()']) assert.ok(screen.includes(hook), `the hero does not read ${hook}`);
    assert.doesNotMatch(screen, /\b(?:levelFor|xpLevelFor|totalXp|displayXp|goalProgressFrom|streakFrom)\(/, 'the hero works a number out itself');
    assert.match(screen, /if \(hero === null\) \{[^}]*tiles: failed \? null : <TodayStatTilesSkeleton/, 'an unread hero draws something other than nothing');
  });
});

// 2026-10-20, B5 learning-science review: with no run the stats tile names no
// streak until a run exists. UI-015: statTiles became statTileView, whose
// no-run tile is "Start" over "today" (founder, 2026-10-31); same intent.
import { statTileView as b5Tiles } from './todayHeroView.ts';
import { test as b5Test } from 'node:test';
import assertB5 from 'node:assert/strict';
b5Test('the streak tile names no streak before a run exists', () => {
  const hero = {
    flame: { lit: false, count: null, words: '', label: '' },
    goal: { minutes: 6, target: 10, fraction: 0.6, met: false, words: '', label: '' },
    level: { level: 2, words: '', label: '' },
  };
  assertB5.deepEqual(b5Tiles(hero).streak, { number: 'Start', label: 'today', lit: false });
  assertB5.doesNotMatch(JSON.stringify(b5Tiles(hero).streak), /streak/i);
  assertB5.deepEqual(b5Tiles({ ...hero, flame: { ...hero.flame, count: 3 } }).streak, { number: '3', label: 'days', lit: false });
  assertB5.deepEqual([b5Tiles(hero).goal.number, b5Tiles(hero).goal.of, b5Tiles(hero).goal.label], ['6', '/10', 'minutes']);
  const noGoal = b5Tiles({ ...hero, goal: { ...hero.goal, target: null, fraction: null } }).goal;
  assertB5.deepEqual([noGoal.number, noGoal.of, noGoal.label, noGoal.ring], ['6', null, 'minutes', false]);
});

describe("Today's chunky stat tiles (UI-015)", () => {
  const hero = (over: { count?: number | null; lit?: boolean; minutes?: number; under?: boolean; target?: number | null; level?: number } = {}): TodayHeroView => {
    const target = over.target === undefined ? 10 : over.target;
    const minutes = over.minutes ?? 4;
    return {
      flame: { lit: over.lit ?? true, count: over.count === undefined ? 3 : over.count, words: '', label: '' },
      goal: { minutes, underAMinute: over.under ?? false, target, fraction: target === null ? null : Math.min(1, minutes / target), met: false, words: '', label: '' },
      level: { level: over.level ?? 2, words: '', label: '' },
    };
  };

  test('the streak tile counts days, and says Start today with no run, never a nought', () => {
    assert.deepEqual(statTileView(hero()).streak, { number: '3', label: 'days', lit: true });
    assert.deepEqual(statTileView(hero({ count: 1, lit: false })).streak, { number: '1', label: 'day', lit: false });
    assert.deepEqual(statTileView(hero({ count: null, lit: false })).streak, { number: 'Start', label: 'today', lit: false });
  });

  test('the goal tile shows measured minutes over the goal, <1 under a minute, and no ring without a goal', () => {
    assert.deepEqual(statTileView(hero()).goal, { number: '4', of: '/10', label: 'minutes', ring: true, fraction: 0.4 });
    assert.deepEqual(statTileView(hero({ minutes: 0, under: true })).goal, { number: '<1', of: '/10', label: 'minutes', ring: true, fraction: 0 });
    assert.deepEqual(statTileView(hero({ target: null, minutes: 7 })).goal, { number: '7', of: null, label: 'minutes', ring: false, fraction: null });
  });

  test('the level tile is the number over the word', () => {
    assert.deepEqual(statTileView(hero({ level: 5 })).level, { number: '5', label: 'level' });
  });

  test('the tile layout follows the width and the text size', () => {
    assert.equal(statTileLayout(109, 1.0), 'side');
    assert.equal(statTileLayout(91, 1.0), 'stacked');
    assert.equal(statTileLayout(109, 1.3), 'stacked');
    assert.equal(statTileLayout(109, 1.6), 'rows');
    assert.equal(statTileLayout(Number.NaN, 1.0), 'stacked');
    assert.equal(statTileLayout(109, Number.NaN), 'stacked');
  });
});

describe('the goal coin and a word for a number — Today sky fix round 1', () => {
  test('a chosen goal always draws the ring, still at its fraction when nothing counted; the clock only with no goal', async () => {
    const { goalCoin } = await import('./todayHeroView.ts');
    const goal = { number: '4', of: '/10', label: 'minutes', ring: true, fraction: 0.4 };
    assert.deepEqual(goalCoin(goal, undefined, 1000), { kind: 'ring', from: 0.4, to: 0.4, key: 'ring-still' }, 'no counter falls back to the clock');
    assert.deepEqual(goalCoin(goal, { from: 100, to: 400, mount: 2 }, 1000), { kind: 'ring', from: 0.1, to: 0.4, key: 'ring-2' });
    assert.deepEqual(goalCoin({ ...goal, ring: false, of: null, fraction: null }, undefined, 1000), { kind: 'clock' });
    const tiles = readFileSync(new URL('./TodayStatTiles.tsx', import.meta.url), 'utf8');
    assert.match(tiles, /const coin = goalCoin\(tiles\.goal, ring, RING_STEPS\);/);
    assert.match(tiles, /\{coin\.kind === 'ring'\s*\? <ProgressRing key=\{coin\.key\} from=\{coin\.from\} to=\{coin\.to\}/, 'the ring is still drawn only when a counter exists');
  });

  test('"Start" is set in bold15 beside the coin, and tiles stack rather than break a word', async () => {
    const { statNumberType, WORD_NUMBER_SIZE } = await import('./todayHeroView.ts');
    for (const digits of ['0', '3', '12', '<1']) assert.equal(statNumberType(digits), 'digits');
    assert.equal(statNumberType('Start'), 'word');
    assert.equal(WORD_NUMBER_SIZE, 15);
    const tiles = readFileSync(new URL('./TodayStatTiles.tsx', import.meta.url), 'utf8');
    assert.match(tiles, /const wordNumber = \[bType\.bold15, \{ color: t\.text \}\];/);
    assert.match(tiles, /<Text style=\{statNumberType\(tiles\.streak\.number\) === 'word' \? wordNumber : number\}>\{tiles\.streak\.number\}<\/Text>/, 'the word is set in the number size');
    assert.match(tiles, /wordsSide: \{ flex: 1, minWidth: 0 \}/);
    assert.match(tiles, /statTileLayout\([^;]*\[tiles\.streak\.number, tiles\.goal\.number, tiles\.level\.number\]\)/, 'the layout cannot see a word');
    // 402pt (iPhone 17 Pro): tile 118, beside the coin. 375: tile 109, too narrow for "Start" whole, so stacked.
    assert.equal(statTileLayout(118, 1.0, ['Start', '4', '2']), 'side');
    assert.equal(statTileLayout(109, 1.0, ['Start', '4', '2']), 'stacked');
    assert.equal(statTileLayout(109, 1.0, ['3', '4', '2']), 'side', 'digits alone changed the layout');
    assert.equal(statTileLayout(118, 1.15, ['Start', '4', '2']), 'stacked');
  });
});
