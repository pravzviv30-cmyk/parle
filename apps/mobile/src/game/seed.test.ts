/**
 * A learner who practised before the game layer existed (F745, game.md 3.6
 * with review finding 14).
 *
 * The update must not greet them with a burst of old levels, badges and a
 * milestone they passed weeks ago, and it must not invent anything: the streak
 * is counted from practice days already saved, a badge is dated only when the
 * data says when, no cover is written, and the one intro sheet is offered only
 * to someone who has practice days to be told about.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, localDayKey } from '@luvani/core';

import { attachCelebrationListener, discardBufferedCelebrations, type CelebrationEvent } from '../celebrate/events.ts';
import { recordActivity } from '../progress/activity.ts';
import { setActiveUser } from '../storage/scope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { catchUpQuietly, seedExistingLearner } from './catchUp.ts';
import { loadGameLocal } from './gameLocal.ts';
import { configureGameEnvironment, readGameFacts, settleSitting } from './settle.ts';
import { loadGame } from './store.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, type BillingFacts } from './view.ts';

function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
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
const nextUid = (): string => `55555555-5555-4555-8555-${String(++uids).padStart(12, '0')}`;

const DAY_MS = 86_400_000;
const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime();
const TODAY = localDayKey(NOW);

let disk: Map<string, string>;
let uid: string;
let billing: BillingFacts | null = null;
let restore: () => void = () => {};
let heard: CelebrationEvent[] = [];
let detach: () => void = () => {};

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
  billing = null;
  restore = configureGameEnvironment({
    now: () => NOW,
    billing: () => Promise.resolve(billing),
    canRecord: () => Promise.resolve(false),
    outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: 10 }),
  });
  discardBufferedCelebrations();
  heard = [];
  detach = attachCelebrationListener((events) => heard.push(...events));
});

afterEach(() => {
  detach();
  restore();
  discardBufferedCelebrations();
});

/** Eight days of practice ending today, the first a conversation: a live run of 8, Level 4. */
async function eightDaysOfPractice(): Promise<{ firstConvo: number }> {
  const firstConvo = NOW - 7 * DAY_MS - 3_600_000;
  assert.equal(await recordActivity('convo', 40, firstConvo, { activeMs: 300_000 }), 'durable');
  for (let n = 6; n >= 0; n -= 1) assert.equal(await recordActivity('drill', 40, NOW - n * DAY_MS - 3_600_000, { activeMs: 120_000 }), 'durable');
  return { firstConvo };
}

describe('an existing learner meets the game layer — F745', () => {
  test('an existing learner is seeded from saved practice with every current moment marked seen', async () => {
    const { firstConvo } = await eightDaysOfPractice();

    const intro = await seedExistingLearner();
    assert.deepEqual(intro, { current: 8, level: 4 }, 'the intro sheet does not say the streak and level the saved practice shows');

    const game = await loadGame();
    // Badges derivable now: dated from the data where it says when, never invented.
    assert.deepEqual(
      game.badges,
      [
        { id: 'first-conversation', at: firstConvo },
        { id: 'streak-7', at: null },
      ],
    );
    assert.deepEqual(game.covers, [], 'the seed wrote a cover');
    // 28 to 30 September, then 1 to 5 October, 40 XP a day.
    assert.deepEqual(game.xpMonths, [{ month: '2026-09', xp: 120 }, { month: '2026-10', xp: 200 }], 'the monthly rollups do not hold the XP already earned');

    // Every moment that is true now is marked seen, so nothing bursts.
    const seen = new Set(game.seen.map((mark) => mark.key));
    for (const key of [`streak:${TODAY}`, `milestone:7:${addDays(TODAY, -7)}`, 'level:4', 'badge:streak-7', 'badge:first-conversation']) {
      assert.ok(seen.has(key), `${key} was not marked seen, so it would play as news`);
    }
    assert.equal((await loadGameLocal()).introducedAt, NOW);
    assert.deepEqual(heard.map((e) => e.key), [], 'the seed played something');

    // The quiet catch-up after it plays nothing, and the seed runs once.
    assert.deepEqual(await catchUpQuietly(), []);
    assert.deepEqual(heard.map((e) => e.key), []);
    const bytes = disk.get(`luvani.u.${uid}.game`);
    assert.equal(await seedExistingLearner(), null, 'the seed ran twice');
    assert.equal(disk.get(`luvani.u.${uid}.game`), bytes);

    // The streak itself is read from practice days, so the number is the saved one.
    const view = gameViewFrom(await readGameFacts({ ...NO_OUTSIDE_FACTS }, null), TODAY);
    assert.equal(view.streak.current, 8);
    assert.equal(view.level.level, 4);
  });

  test('a learner with no practice yet is introduced silently', async () => {
    assert.equal(await seedExistingLearner(), null, 'a brand-new learner was told about practice already saved');
    assert.equal((await loadGameLocal()).introducedAt, NOW, 'the seed did not record that it ran');
    const game = await loadGame();
    assert.deepEqual(game.badges, []);
    assert.deepEqual(game.seen.map((mark) => mark.key), ['intro'], 'the account was not marked introduced, or a moment was marked seen that never happened');
  });

  test('a durable moment a crash cut short plays once on the next launch, and a missed day moment is only marked seen', async () => {
    assert.equal(await seedExistingLearner(), null);
    const settled = await settleSitting({
      source: 'convo',
      at: NOW,
      xpEarned: 40,
      activeMs: 120_000,
      write: () => recordActivity('convo', 40, NOW, { activeMs: 120_000, finished: true }),
    });
    assert.ok(settled);
    const published = heard.map((e) => e.key).sort();
    assert.deepEqual(published, ['badge:first-conversation', 'level:2', `streak:${TODAY}`]);

    // The app is killed before the host plays anything. On the next launch the
    // catch-up finds all three still pending and none seen.
    setActiveUser(null);
    setActiveUser(uid);
    heard = [];
    const replayed = await catchUpQuietly();
    assert.deepEqual(replayed.map((e) => e.key).sort(), ['badge:first-conversation', 'level:2'], 'a durable moment was lost, or a day moment took over the screen');
    assert.deepEqual(heard.map((e) => e.key).sort(), ['badge:first-conversation', 'level:2']);
    const game = await loadGame();
    assert.ok(game.seen.some((mark) => mark.key === `streak:${TODAY}`), 'the missed day moment was neither played nor marked');
    assert.ok(!game.seen.some((mark) => mark.key === 'level:2'), 'the replayed level was marked seen before the host played it');
    assert.deepEqual((await loadGameLocal()).pending.map((p) => p.key).sort(), ['badge:first-conversation', 'level:2']);

    // Once per launch: a second foreground plays nothing more.
    heard = [];
    assert.deepEqual(await catchUpQuietly(), []);
    assert.deepEqual(heard.map((e) => e.key), []);
  });

  test('the intro sheet is shown once per account, whichever phone runs the seed first', async () => {
    await eightDaysOfPractice();
    assert.ok(await seedExistingLearner(), 'an existing learner was not introduced');
    const introduced = JSON.parse(disk.get(`luvani.u.${uid}.game`)!);

    // A second phone: its own disk, the account's game facts synced across, the same practice.
    disk = installDisk();
    await eightDaysOfPractice();
    disk.set(`luvani.u.${uid}.game`, JSON.stringify(introduced));
    assert.equal(await seedExistingLearner(), null, 'the account was introduced twice');
    assert.notEqual((await loadGameLocal()).introducedAt, null, 'the second phone was not introduced');
  });

  test('a paid subscriber starts with both freezes from the day of the update', async () => {
    await eightDaysOfPractice();
    billing = { plan: 'starter', lapsed: false, secondsRemaining: 600, canStart: true };
    assert.ok(await seedExistingLearner());
    assert.equal((await loadGameLocal()).paidSince, TODAY);
    const view = gameViewFrom(await readGameFacts({ ...NO_OUTSIDE_FACTS }, billing), TODAY);
    assert.equal(view.freezes, 2);
    assert.deepEqual((await loadGame()).covers, []);

    // A free learner holds none, and no day before the update is ever covered.
    setActiveUser(nextUid());
    billing = { plan: 'trial', lapsed: false, secondsRemaining: 0, canStart: false };
    await seedExistingLearner();
    assert.equal((await loadGameLocal()).paidSince, null);
  });
});
