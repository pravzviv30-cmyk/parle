/**
 * Home's increments (F767): a number that rose since Home last drew it counts
 * up once, from where the learner last saw it, and never replays or runs
 * backwards.
 *
 * The rules are pure (`startFrom`, `startsFrom`, `withShown`); the store is
 * held against the same storage double the game store's suite uses, so the
 * memory that survives a refused write is proved, not assumed. The cards are
 * then held to counting from what this file answers.
 */

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveUser } from '../storage/scope.ts';
import {
  forgetShownInMemory,
  isHomeSeen,
  loadHomeSeen,
  markShown,
  startFrom,
  startsFrom,
  withShown,
  type HomeSeen,
} from './homeSeen.ts';

const TODAY = '2026-10-07';
const TOMORROW = '2026-10-08';

let refuseWrites = false;
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    if (refuseWrites) return Promise.reject(new Error('disk full'));
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');

describe("Home's increments — F767", () => {
  let disk: Map<string, string>;
  beforeEach(() => {
    disk = installDisk();
    refuseWrites = false;
    forgetShownInMemory();
    setActiveUser(nextUid());
  });

  test("Home's increments animate from the last shown value and never replay or count down", async () => {
    // Nothing remembered: drawn as it is. There is no earlier value to count
    // from, and counting up from nought would claim a rise that did not happen.
    assert.equal(startFrom(null, 'streak', 5, TODAY), 5);
    assert.equal(startFrom(null, 'minutes', 7, TODAY), 7);

    // A rise since Home last drew it counts up from the value last shown.
    const seen: HomeSeen = withShown(null, { streak: 4, minutes: 3, level: 2, questsDone: 1, lifetimeDays: 30 }, TODAY);
    assert.deepEqual(startsFrom(seen, { streak: 5, minutes: 7, level: 3, questsDone: 2, lifetimeDays: 31 }, TODAY), {
      streak: 4,
      minutes: 3,
      level: 2,
      questsDone: 1,
      lifetimeDays: 30,
    });

    // Never a replay: once shown, the same value starts where it is.
    const after = withShown(seen, { streak: 5, minutes: 7 }, TODAY);
    assert.equal(startFrom(after, 'streak', 5, TODAY), 5, 'a rise already shown plays again');
    assert.equal(startFrom(after, 'minutes', 7, TODAY), 7, 'a rise already shown plays again');
    // A value not drawn this time is kept until it is.
    assert.equal(after.values.level, 2);

    // Never down: a reset streak is drawn as it is, with nothing counting.
    assert.equal(startFrom(after, 'streak', 0, TODAY), 0, 'a reset streak counts down');
    assert.equal(startFrom(after, 'level', 1, TODAY), 1, 'a level counts down');

    // A new day starts the day's numbers at nought: a rise since midnight
    // counts up from nought, and yesterday's figure is never drawn falling.
    assert.equal(startFrom(after, 'minutes', 4, TOMORROW), 0, "today's minutes count from yesterday's");
    assert.equal(startFrom(after, 'minutes', 0, TOMORROW), 0);
    assert.equal(startFrom(seen, 'questsDone', 0, TOMORROW), 0, "yesterday's quests count down to today's");
    assert.equal(startFrom(after, 'streak', 6, TOMORROW), 5, 'the run forgot its last value overnight');
    const nextDay = withShown(after, { streak: 6 }, TOMORROW);
    assert.equal(nextDay.values.minutes, undefined, "yesterday's minutes are kept as today's");
    assert.equal(nextDay.values.lifetimeDays, 30);

    // Bytes this build would not write are not a snapshot.
    assert.equal(isHomeSeen({ version: 1, day: TODAY, values: { streak: -1 } }), false);
    assert.equal(isHomeSeen({ version: 1, day: TODAY, values: { rank: 3 } }), false);
    assert.equal(isHomeSeen({ version: 2, day: TODAY, values: {} }), false);
    assert.equal(isHomeSeen(after), true);

    // The store: what is drawn is remembered on this phone, under the account.
    assert.equal(await loadHomeSeen(), null);
    assert.equal(await markShown({ streak: 5, minutes: 7 }, TODAY, null), true);
    forgetShownInMemory();
    const read = await loadHomeSeen();
    assert.deepEqual(read?.values, { streak: 5, minutes: 7 }, 'the drawn values did not reach the disk');
    assert.equal([...disk.keys()].filter((key) => key.endsWith('.home-seen')).length, 1, 'the snapshot is not one key under the account');

    // A second card marks its own numbers without losing the first's.
    await markShown({ questsDone: 2 }, TODAY, read);
    assert.deepEqual((await loadHomeSeen())?.values, { streak: 5, minutes: 7, questsDone: 2 });

    // A write the disk refuses still never lets the same rise play twice while
    // the app is open: what was drawn is held in memory for the account.
    refuseWrites = true;
    assert.equal(await markShown({ streak: 6 }, TODAY, await loadHomeSeen()), false);
    assert.equal(startFrom(await loadHomeSeen(), 'streak', 6, TODAY), 6, 'a refused write lets a shown rise replay');

    // Another account starts from its own record, never this one's.
    setActiveUser(nextUid());
    assert.equal(await loadHomeSeen(), null, "one learner's last values reach the next");

    // The cards count from this answer. 2026-10-07 (Phase 4 review): the
    // answer is read once, for the first draw since Home mounted
    // (`homeDraw.ts` firstDraw), and remembered only once it is drawn where
    // the learner can see it; after that each counter moves by `nextDraw`,
    // held in `homeDraw.test.ts`, and the cards key every counter on its mount.
    const hook = stripComments(readFileSync(new URL('./useHomeDraw.ts', import.meta.url), 'utf8'));
    assert.match(hook, /const next = \{ model, draw: firstDraw\(gate \? seen : null, fresh, today\) \};/, 'the first draw does not start where home-seen says, or counts where the learner cannot see it');
    assert.match(hook, /void markShown\(fresh, today, seen\)/, 'what was drawn is not remembered');
    assert.match(hook, /if \(!gate\) return; const next = \{ model, draw: nextDraw\(before\.draw, fresh, today\) \};/, 'a new value is drawn, and remembered, while the learner cannot see it');
    // UI-015: TodayHero.tsx split in two: TodayStats.tsx holds the draw, TodayStatTiles.tsx the counters.
    const stats = stripComments(readFileSync(new URL('../game/TodayStats.tsx', import.meta.url), 'utf8'));
    const hero = stripComments(readFileSync(new URL('../game/TodayStatTiles.tsx', import.meta.url), 'utf8'));
    assert.match(stats, /useHomeDraw<HeroModel>\(today, hero === null \? null : \{ hero, nudge \}, \(model\) => heroCounts\(model\.hero\)\)/);
    assert.match(hero, /<CountUp key=\{`run-\$\{run\.mount\}`\} from=\{run\.from\} to=\{run\.to\}/, 'the run does not count from what was last shown');
    // Fix round 1: drawn through goalCoin, which passes the counter's from and to over RING_STEPS.
    assert.match(hero, /const coin = goalCoin\(tiles\.goal, ring, RING_STEPS\);/);
    assert.match(hero, /<ProgressRing key=\{coin\.key\} from=\{coin\.from\} to=\{coin\.to\}/, 'the ring does not draw from what was last shown');
    assert.match(hero, /<CountUp key=\{`level-\$\{chip\.mount\}`\} from=\{chip\.from\} to=\{chip\.to\}/, 'the level does not count from what was last shown');
    // 2026-10-20 UI-008, artboard B-Today: the flame is the still canvas
    // drawing now, so nothing lights or flickers; an open day draws it dimmed.
    // UI-015: the flame sits in its coin at the tile's own size, still dimmed on an open day.
    assert.match(hero, /<BArt name="flame" width=\{FLAME\.width\} height=\{FLAME\.height\} style=\{tiles\.streak\.lit \? undefined : s\.unlit\} \/>/, 'the flame does not say whether today has counted');
    assert.doesNotMatch(hero, /ignite=|flicker=/, 'the flame still animates outside the artboard');
    const quests = stripComments(readFileSync(new URL('../game/QuestsCard.tsx', import.meta.url), 'utf8'));
    assert.match(quests, /useHomeDraw\(view\?\.today \?\? null, fresh, questCounts\)/);
    assert.match(quests, /<CountUp key=\{`done-\$\{done\.mount\}`\} from=\{done\.from\} to=\{done\.to\}/, 'the quests count from somewhere other than what was last shown');
  });
});
