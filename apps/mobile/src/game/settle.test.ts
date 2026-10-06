/**
 * The settle pipeline (F744): every finished sitting settles once, through
 * game/settle.ts, into a GameDelta read back from disk.
 *
 * What it has to hold, in order of how badly it would hurt to get wrong: a
 * sitting settled after the account changed lands nowhere; a replay changes
 * nothing; a moment is only ever about a fact on disk, and nothing plays on a
 * phone the existing-learner seed has not introduced; a capped sitting still
 * counts for the day, the goal and the quests; a guest's day one lights once;
 * a sitting counts for the local day it finished; a learner back after a long
 * absence is told the truth; quests never promise what the app cannot keep;
 * only a paid plan covers a missed day; and two devices that settled the same
 * day agree after a merge.
 *
 * The storage double is the one `game/store.test.ts` uses. The environment is
 * pinned (a fixed clock, a goal, a microphone) so every day key is known. The
 * app runs the seed when the game layer mounts, so a test that expects moments
 * runs it first, as the app does.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAY_ONE_QUESTS, addDays, isQuestId, localDayKey, streakFrom, xpCreditedFor, type QuestId } from '@luvani/core';

import { endCardView } from '../celebrate/endCardModel.ts';
import { attachCelebrationListener, discardBufferedCelebrations, type CelebrationEvent } from '../celebrate/events.ts';
import { TIMELINES } from '../celebrate/timelines.ts';
import type { GuestPractice } from '../onboarding/guestModel.ts';
import { loadActiveDays, loadActivity, recordActiveDay, recordActivity, recordActivityOnce } from '../progress/activity.ts';
import { setActiveUser } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { catchUpQuietly, seedExistingLearner } from './catchUp.ts';
import { GAME_COPY } from './copy.ts';
import { allQuestsDoneNow } from './delta.ts';
import { loadGameLocal, setPaidSince } from './gameLocal.ts';
import { settleGuestHandoff } from './guestHandoff.ts';
import { emptyGame, readGame, type StoredGame } from './model.ts';
import { beginSettle, configureGameEnvironment, finishSettle, readGameFacts, settleSitting } from './settle.ts';
import { addClaims, loadGame, setQuestDay } from './store.ts';
import { NO_OUTSIDE_FACTS, badgeFactsFrom, gameViewFrom, type BillingFacts } from './view.ts';

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
  shared.multiGet = (keys: string[]): Promise<[string, string | null][]> => Promise.resolve(keys.map((key) => [key, map.get(key) ?? null]));
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

const HOUR = 3_600_000;
const MINUTE = 60_000;
const DAY = 86_400_000;
/** Local noon, so no sitting in a test is near a midnight. In the past, because the store refuses rows dated after tomorrow. */
const NOW = new Date(2026, 9, 5, 12, 0, 0).getTime();
const TODAY = localDayKey(NOW);

let disk: Map<string, string>;
let uid: string;
let restore: () => void = () => {};
let heard: CelebrationEvent[] = [];
let detach: () => void = () => {};

const gameKey = (who = uid): string => `luvani.u.${who}.game`;
const activityKey = (who = uid): string => `luvani.u.${who}.activity`;

function pin(overrides: { now?: number; billing?: () => BillingFacts | null; canRecord?: () => boolean; goal?: 5 | 10 | 15 | 20 | null; phraseCards?: number } = {}): void {
  restore();
  restore = configureGameEnvironment({
    now: () => overrides.now ?? NOW,
    billing: () => Promise.resolve(overrides.billing?.() ?? null),
    canRecord: () => Promise.resolve(overrides.canRecord?.() ?? true),
    outside: () => Promise.resolve({ ...NO_OUTSIDE_FACTS, goalTarget: overrides.goal === undefined ? 5 : overrides.goal, phraseCards: overrides.phraseCards ?? 0 }),
  });
}

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
  pin();
  discardBufferedCelebrations();
  heard = [];
  detach = attachCelebrationListener((events) => heard.push(...events));
});

afterEach(() => {
  detach();
  restore();
  restore = () => {};
  discardBufferedCelebrations();
});

const policy = createSyncPolicy({ now: () => NOW });
function merge(namespace: string, local: unknown, remote: unknown): unknown {
  const result = policy.merge({ namespace, local, remote });
  assert.equal(result.kind, 'merged', `${namespace} did not merge`);
  return (result as { data: unknown }).data;
}

function convo(at: number, xp: number, activeMs: number) {
  return settleSitting({
    source: 'convo',
    at,
    xpEarned: xp,
    activeMs,
    write: () => recordActivity('convo', xp, at, { durationMs: activeMs, activeMs, finished: true }),
  });
}

function drill(at: number, xp: number, activeMs?: number) {
  return settleSitting({
    source: 'drill',
    at,
    xpEarned: xp,
    ...(activeMs === undefined ? {} : { activeMs }),
    write: () => recordActivity('drill', xp, at, { ...(activeMs === undefined ? {} : { activeMs }), finished: true }),
  });
}

const streakMoments = (): CelebrationEvent[] => heard.filter((e) => e.type === 'streak-extended' || e.type === 'streak-milestone');

describe('settling a finished sitting — F744', () => {
  test('settling a sitting records its day, goal, quests and badges once, and a replay changes nothing', async () => {
    // A brand-new learner, introduced silently when the game layer mounts.
    assert.equal(await seedExistingLearner(), null);

    const delta = await convo(NOW, 40, 6 * MINUTE);
    assert.ok(delta, 'a finished conversation did not settle');

    // The day, and the streak it starts.
    assert.deepEqual(await loadActiveDays(), [TODAY]);
    assert.equal(delta.streak.before.current, 0);
    assert.equal(delta.streak.after.current, 1);
    assert.equal(delta.streak.extendedNow, true, 'the first practice of the day did not extend the streak');
    assert.equal(delta.key, `sitting:convo:${NOW}`);

    // The goal: six measured minutes against five.
    const game = await loadGame();
    assert.deepEqual(game.goalDays, [TODAY]);
    assert.equal(delta.goal.metNow, true);
    assert.equal(delta.goal.minutesBefore, 0);
    assert.equal(delta.goal.minutesAfter, 6);

    // Today's quests, dealt once (day one, with a microphone), and the two this sitting finished.
    assert.deepEqual(game.questDays.map((row) => [row.day, row.ids]), [[TODAY, [...DAY_ONE_QUESTS]]]);
    assert.deepEqual(game.claims.map((c) => [c.questId, c.xp]).sort(), [['finish-practice', 10], ['minutes', 10]]);
    assert.deepEqual(delta.quests.completedNow, ['finish-practice', 'minutes']);
    assert.equal(allQuestsDoneNow(delta), false, 'two of three quests read as all three done');
    assert.equal(delta.quests.done, 2);

    // The badge, dated by the settle, and the XP and level read back from disk.
    assert.deepEqual(game.badges, [{ id: 'first-conversation', at: NOW }]);
    assert.deepEqual(delta.badges, ['first-conversation']);
    assert.deepEqual(delta.xp, { earned: 40, counted: 40, capped: false, bonus: 0, questXp: 20, totalBefore: 0, totalAfter: 60 });
    assert.deepEqual(delta.level, { before: 1, after: 2 });
    assert.deepEqual(game.xpMonths, [{ month: TODAY.slice(0, 7), xp: 40 }]);

    // The moments: each one a fact in the delta, queued on this phone in case of a crash.
    assert.deepEqual(heard.map((e) => e.key).sort(), ['badge:first-conversation', 'level:2', `streak:${TODAY}`]);
    assert.ok(heard.every((e) => e.origin === 'account'));
    assert.deepEqual((await loadGameLocal()).pending.map((p) => p.key).sort(), ['badge:first-conversation', 'level:2', `streak:${TODAY}`]);
    assert.deepEqual(game.seen.map((mark) => mark.key), ['intro'], 'the pipeline marked a moment seen, so the host would refuse to play it');

    // A replay, with a fresh token, writes nothing and reports nothing new.
    const gameBytes = disk.get(gameKey());
    const activityBytes = disk.get(activityKey());
    heard = [];
    const again = await finishSettle(await beginSettle(), { source: 'convo', at: NOW, xpEarned: 40, activeMs: 6 * MINUTE });
    assert.ok(again);
    assert.equal(disk.get(gameKey()), gameBytes, 'a replay changed the game facts');
    assert.equal(disk.get(activityKey()), activityBytes, 'a replay changed the activity log');
    assert.equal(again.streak.extendedNow, false);
    assert.deepEqual(again.quests.completedNow, []);
    assert.deepEqual(again.badges, []);
    assert.equal(again.goal.metNow, false);
    assert.equal(again.xp.counted, 0, 'a replay counted the same XP twice');
    assert.equal(again.xp.capped, false, 'a replay claimed the daily limit withheld something');
    assert.equal(again.xp.questXp, 0);
    assert.deepEqual(again.level, { before: 2, after: 2 });
    assert.deepEqual(heard.map((e) => e.key), [], 'a replay played a moment again');

    // And a token is spent once.
    const token = await beginSettle();
    assert.ok(await finishSettle(token, { source: 'convo', at: NOW, xpEarned: 40 }));
    assert.equal(await finishSettle(token, { source: 'convo', at: NOW, xpEarned: 40 }), null);

    // A win nothing grades still records its day, in the game store and not the log, with its +5 once.
    const phraseAt = NOW + HOUR;
    const settling = await beginSettle();
    assert.equal(await recordActiveDay(phraseAt), 'durable');
    const phrase = await finishSettle(settling, { source: 'phrase', at: phraseAt, xpEarned: 0, activeMs: 90_000 });
    assert.ok(phrase);
    assert.equal(phrase.xp.bonus, 5);
    assert.equal(phrase.xp.counted, 0);
    assert.equal(phrase.xp.capped, false);
    const held = await loadGame();
    assert.deepEqual(held.sittings, [{ at: phraseAt, source: 'phrase', activeMs: 90_000 }]);
    assert.deepEqual(held.bonus.map((b) => [b.key, b.xp]), [[`phrase:${TODAY}`, 5]]);
    assert.equal((await loadActivity({ strict: true })).length, 1, 'a zero-XP sitting wrote an activity entry');
    // It finished today's phrase quest, the third of three: the quest's own +10 and nothing more (D22).
    assert.deepEqual(phrase.quests.completedNow, ['phrase-of-day']);
    assert.equal(phrase.quests.done, 3);
    assert.equal(allQuestsDoneNow(phrase), true, 'the sitting that finished the third quest was not told so');
    assert.equal(phrase.xp.questXp, 10);
    assert.deepEqual(heard.map((e) => [e.type, e.key]), [], 'finishing the third quest played a takeover');
    const twice = await finishSettle(await beginSettle(), { source: 'phrase', at: phraseAt, xpEarned: 0, activeMs: 90_000 });
    assert.equal(twice?.xp.bonus, 0, 'the +5 for practising was credited twice');
    assert.equal(twice === null ? true : allQuestsDoneNow(twice), false, 'a replay said the third quest was finished again');
    assert.equal((await loadGame()).bonus.length, 1);
  });

  test('a capped sitting still records its day, its goal minutes and its quests', async () => {
    // Two sittings earlier today, never settled, already past the shown cap of 100.
    assert.equal(await recordActivity('lesson', 60, NOW - 3 * HOUR, { activeMs: MINUTE }), 'durable');
    assert.equal(await recordActivity('convo', 50, NOW - 2 * HOUR, { activeMs: MINUTE }), 'durable');
    const before = await loadActivity({ strict: true });

    const delta = await settleSitting({
      source: 'drill',
      at: NOW,
      xpEarned: 20,
      activeMs: 4 * MINUTE,
      write: () => recordActivity('drill', 20, NOW, { durationMs: 5 * MINUTE, activeMs: 4 * MINUTE, finished: true }),
    });
    assert.ok(delta);
    assert.equal(delta.xp.earned, 20);
    assert.equal(delta.xp.counted, 0, 'XP past the cap was counted');
    assert.equal(delta.xp.counted, xpCreditedFor(before, { at: NOW, xp: 20 }), 'the end card would name a figure the cap rule does not');
    assert.equal(delta.xp.capped, true);
    assert.equal(delta.streak.after.today, 'practised');
    assert.ok((await loadActiveDays()).includes(TODAY));
    assert.equal(delta.goal.minutesBefore, 2);
    assert.equal(delta.goal.minutesAfter, 6, 'the capped sitting\'s minutes did not reach the goal');
    assert.equal(delta.goal.metNow, true);
    assert.deepEqual(delta.quests.completedNow, ['finish-practice', 'minutes'], 'the capped sitting did not count for its quests');
  });

  test('a sitting settled after sign-out does nothing', async () => {
    assert.ok(await convo(NOW - HOUR, 30, 2 * MINUTE));

    // Signed out between the write and the settle.
    const token = await beginSettle();
    assert.equal(await recordActivity('drill', 12, NOW, { finished: true }), 'durable');
    const afterWrite = new Map(disk);
    setActiveUser(null);
    heard = [];
    assert.equal(await finishSettle(token, { source: 'drill', at: NOW, xpEarned: 12 }), null);
    assert.deepEqual(new Map(disk), afterWrite, 'a settle after sign-out wrote something');
    assert.deepEqual(heard.map((e) => e.key), []);

    // Another account signed in by the time the settle runs: nothing lands in it either.
    setActiveUser(uid);
    const second = await beginSettle();
    const other = nextUid();
    setActiveUser(other);
    assert.equal(await finishSettle(second, { source: 'phrase', at: NOW, xpEarned: 0 }), null);
    assert.equal(disk.has(gameKey(other)), false, 'a settle landed in the next account');
    assert.equal(disk.has(activityKey(other)), false);
    assert.equal(disk.has(`luvani.u.${other}.gameLocal`), false);

    // A sitting whose own write was refused settles nothing at all.
    setActiveUser(uid);
    const bytes = disk.get(gameKey());
    const refused = await settleSitting({ source: 'review', at: NOW, xpEarned: 3, write: () => Promise.resolve('failed' as const) });
    assert.equal(refused, null);
    assert.equal(disk.get(gameKey()), bytes, 'a sitting that never landed changed the game facts');
  });

  test('a kept guest practice lights day one once', async () => {
    const finishedAt = NOW - 2 * HOUR;
    const guest = { version: 2, attempts: [], kept: true, completed: true, finishedAt: [finishedAt] } as unknown as GuestPractice;

    // The hand-off runs before the game layer mounts, as it does in the app.
    const first = await settleGuestHandoff(guest);
    assert.equal(first.ack, 'durable');
    assert.ok(first.delta, 'the hand-off did not settle the guest practice');
    assert.equal(first.delta.source, 'guest');
    assert.equal(first.delta.streak.extendedNow, true, 'the account\'s day one was not lit by the hand-off');
    assert.equal(first.delta.streak.after.current, 1);
    assert.equal(first.delta.xp.bonus, 5, 'the guest\'s first practice was not credited once an account exists');
    assert.deepEqual(await loadActiveDays(), [TODAY]);
    const game = await loadGame();
    assert.ok(game.seen.some((mark) => mark.key === `streak:${TODAY}`), 'day one was not marked seen before it was recorded');
    assert.deepEqual(game.sittings, [{ at: finishedAt, source: 'guest' }]);
    assert.deepEqual(streakMoments(), [], 'the flame lit on the first-run screen lit again');

    // The game layer then mounts: the account already met it, so no intro sheet.
    assert.equal(await seedExistingLearner(), null, 'a practice kept a moment ago was introduced as practice saved before');
    assert.deepEqual(heard.map((e) => e.key), []);

    // Again: the same practice, kept twice. Nothing new, and the flame stays lit once.
    const bytes = disk.get(gameKey());
    const second = await settleGuestHandoff(guest);
    assert.equal(second.ack, 'durable');
    assert.equal(second.delta?.streak.extendedNow, false, 'day one lit a second time');
    assert.equal(second.delta?.xp.bonus, 0);
    assert.equal(disk.get(gameKey()), bytes);
    assert.deepEqual(streakMoments(), []);

    // A guest record with no finish day (the first run does not persist them yet, F751) lights nothing.
    const fresh = nextUid();
    setActiveUser(fresh);
    const none = await settleGuestHandoff({ ...guest, finishedAt: undefined } as GuestPractice);
    assert.deepEqual(none, { ack: 'durable', delta: null });
    assert.equal(disk.has(activityKey(fresh)), false, 'a guest without a finish day became a practice day');
    assert.equal(disk.has(gameKey(fresh)), false);
  });

  test('the guest hand-off never lights day one twice', async () => {
    // An account already introduced on this phone (it signed in here before),
    // so its moments would play: only the seen mark written first keeps the
    // flame the guest already saw from lighting again.
    assert.equal(await seedExistingLearner(), null);
    const guest = { version: 2, attempts: [], kept: true, completed: true, finishedAt: [NOW - HOUR] } as unknown as GuestPractice;
    const handed = await settleGuestHandoff(guest);
    assert.equal(handed.ack, 'durable');
    assert.equal(handed.delta?.streak.extendedNow, true);
    assert.deepEqual(streakMoments(), [], 'the hand-off lit day one again');

    // The account's own first practice that day is not a new day either.
    const later = await drill(NOW, 20, 4 * MINUTE);
    assert.ok(later);
    assert.equal(later.streak.extendedNow, false, 'a second practice on day one extended the streak');
    assert.equal(later.streak.after.current, 1);
    assert.deepEqual(streakMoments(), [], 'day one lit twice');
  });

  test('nothing plays on a phone the existing-learner seed has not introduced', async () => {
    // Nine days of practice ending yesterday, saved before this layer: a
    // seven-day badge is already true. The seed has not run on this phone.
    for (let n = 9; n >= 1; n -= 1) assert.equal(await recordActivity('drill', 20, NOW - n * DAY, { activeMs: MINUTE }), 'durable');
    const delta = await drill(NOW, 10, 2 * MINUTE);
    assert.ok(delta, 'the sitting itself did not settle');
    assert.equal(delta.streak.after.current, 10);
    assert.deepEqual(delta.badges, [], 'a months-old badge was awarded as news');
    assert.deepEqual((await loadGame()).badges, [], 'a badge was dated today that was earned before');
    assert.deepEqual(heard.map((e) => e.key), [], 'something burst onto a phone that was never introduced');
    assert.deepEqual((await loadGameLocal()).pending, []);

    // Once the seed runs, the old badge is counted from saved practice, undated, and nothing plays.
    // 190 XP from practice, and at most 20 from today's quests: Level 3 either way.
    assert.deepEqual(await seedExistingLearner(), { current: 10, level: 3 });
    assert.deepEqual((await loadGame()).badges, [{ id: 'streak-7', at: null }]);
    assert.deepEqual(heard.map((e) => e.key), []);
  });

  test('a sitting that finishes just before midnight counts for the day it finished', async () => {
    const late = new Date(2026, 9, 4, 23, 59, 50).getTime();
    const settled = new Date(2026, 9, 5, 0, 0, 5).getTime();
    const day = localDayKey(late);
    assert.notEqual(day, localDayKey(settled));
    pin({ now: settled });
    assert.equal(await seedExistingLearner(), null);

    const delta = await drill(late, 12, 6 * MINUTE);
    assert.ok(delta);
    assert.deepEqual(await loadActiveDays(), [day]);
    assert.equal(delta.streak.after.today, 'practised', 'the sitting was measured against a day it did not finish on');
    assert.equal(delta.streak.extendedNow, true);
    assert.equal(delta.goal.metNow, true, 'its minutes were counted for the wrong day');
    assert.deepEqual(streakMoments().map((e) => e.key), [`streak:${day}`], 'the flame lit for the day after the practice');

    const game = await loadGame();
    assert.deepEqual(game.goalDays, [day]);
    assert.deepEqual(game.questDays.map((row) => row.day), [day], 'the new day\'s quests were dealt by a sitting from the day before');
    assert.ok(game.claims.length > 0 && game.claims.every((claim) => claim.day === day), 'a quest was claimed for a day the sitting did not finish on');
  });

  test('a learner back after a long absence starts a new streak and keeps every practice day', async () => {
    // Ten days in a row, ending a month ago.
    for (let n = 40; n >= 31; n -= 1) assert.equal(await recordActivity('drill', 15, NOW - n * DAY, { activeMs: MINUTE }), 'durable');
    const intro = await seedExistingLearner();
    assert.deepEqual(intro, { current: 0, level: 3 });
    assert.equal(
      GAME_COPY.intro.body(intro.current, intro.level),
      'Your next practice starts a streak. You are at Level 3, counted from the practice already saved on your account.',
    );

    const delta = await drill(NOW, 5, 2 * MINUTE);
    assert.ok(delta);
    assert.equal(delta.streak.before.current, 0);
    assert.equal(delta.streak.after.current, 1);
    assert.equal(delta.streak.after.lifetimeDays, 11, 'a reset took the practice days already done');
    assert.equal(delta.streak.after.longest, 10);
    assert.equal(delta.streak.extendedNow, true);
    assert.equal(delta.streak.milestone, null);
    assert.equal(delta.streak.restoredBy, null, 'a free learner\'s month away was covered');
    assert.deepEqual((await loadGame()).covers, []);

    // One calm moment, and its words are the facts on disk.
    const moments = streakMoments();
    assert.equal(moments.length, 1);
    assert.equal(moments[0]!.type, 'streak-extended');
    assert.deepEqual(moments[0]!.data, { day: TODAY, current: 1, lifetimeDays: 11 });
    assert.equal(GAME_COPY.streak.line(1), 'Your streak starts today.');
    assert.equal(GAME_COPY.streak.lifetime(11), '11 days you have practised');
    assert.ok(!heard.some((e) => e.type === 'badge-earned'), 'the seven-day badge earned a month ago played as news');
  });

  test('today\'s quests never ask for live minutes the server has not confirmed or a recording the phone cannot make', async () => {
    let billing: BillingFacts | null = null;
    let canRecord = false;
    pin({ billing: () => billing, canRecord: () => canRecord, goal: 10, phraseCards: 12 });
    const dealt = async (): Promise<readonly QuestId[]> => {
      setActiveUser(nextUid());
      // A conversation yesterday: a practice day before today, so the day's three are drawn.
      assert.equal(await recordActivity('convo', 10, NOW - DAY, { finished: true }), 'durable');
      assert.ok(await drill(NOW, 8));
      const days = (await loadGame()).questDays;
      assert.equal(days.length, 1);
      return days[0]!.ids;
    };
    const LIVE: readonly QuestId[] = ['conversation', 'scene-on-own'];

    // Unknown billing (offline, unread) and no microphone.
    for (let i = 0; i < 40; i += 1) {
      const ids = await dealt();
      assert.ok(!ids.some((id) => LIVE.includes(id)), `a live quest was dealt while the plan was unknown: ${ids.join(', ')}`);
      assert.ok(!ids.includes('phrase-of-day'), 'a recording quest was dealt to a phone that cannot record');
    }
    // A plan with nothing left to start a room.
    billing = { plan: 'starter', lapsed: false, secondsRemaining: 0, canStart: false };
    for (let i = 0; i < 20; i += 1) {
      const ids = await dealt();
      assert.ok(!ids.some((id) => LIVE.includes(id)), `a live quest was dealt with no minutes left: ${ids.join(', ')}`);
    }
    // Confirmed minutes and a microphone: both kinds can be dealt, so the scan above could see them.
    billing = { plan: 'starter', lapsed: false, secondsRemaining: 600, canStart: true };
    canRecord = true;
    let live = false;
    let recording = false;
    for (let i = 0; i < 40; i += 1) {
      const ids = await dealt();
      live ||= ids.some((id) => LIVE.includes(id));
      recording ||= ids.includes('phrase-of-day');
    }
    assert.ok(live && recording, 'the scan could never have seen a live or recording quest');
  });

  test('a subscriber\'s missed day is covered by a freeze, and a free learner\'s is not', async () => {
    let billing: BillingFacts | null = null;
    pin({ billing: () => billing });
    const yesterday = addDays(TODAY, -1);
    const missedYesterday = async (plan: BillingFacts | null) => {
      setActiveUser(nextUid());
      billing = plan;
      // Four days in a row, then nothing yesterday. A paid plan was first seen ten days ago.
      for (const n of [5, 4, 3, 2]) assert.equal(await recordActivity('drill', 10, NOW - n * DAY, { finished: true }), 'durable');
      assert.equal(await setPaidSince(addDays(TODAY, -10)), 'durable');
      assert.ok(await seedExistingLearner());
      const delta = await drill(NOW, 10);
      assert.ok(delta);
      return { delta, covers: (await loadGame()).covers, paidSince: (await loadGameLocal()).paidSince };
    };

    const paid = await missedYesterday({ plan: 'regular', lapsed: false, secondsRemaining: 1200, canStart: true });
    assert.deepEqual(paid.covers, [{ day: yesterday, kind: 'freeze', at: NOW }]);
    assert.equal(paid.delta.streak.after.current, 5, 'the freeze did not keep the run');
    assert.equal(paid.delta.streak.restoredBy, 'freeze');
    assert.equal(paid.delta.streak.extendedNow, true);

    const free = await missedYesterday({ plan: 'trial', lapsed: false, secondsRemaining: 0, canStart: false });
    assert.deepEqual(free.covers, [], 'a free learner was given a paid perk');
    assert.equal(free.delta.streak.after.current, 1);
    assert.equal(free.paidSince, null, 'a plan that is not paid still counts as paid since');

    const lapsed = await missedYesterday({ plan: 'regular', lapsed: true, secondsRemaining: 0, canStart: false });
    assert.deepEqual(lapsed.covers, [], 'a lapsed plan kept its freezes');

    const unknown = await missedYesterday(null);
    assert.deepEqual(unknown.covers, [], 'a plan nobody could read spent a freeze');
    assert.equal(unknown.paidSince, addDays(TODAY, -10), 'an unread plan forgot when this phone first saw a paid one');
  });

  test('the at-most-once writer records the day of a finished sitting that earned no XP', async () => {
    // A practice sitting finished with nothing right goes through the frozen
    // completion plan (practice/completion.ts), which is only frozen for a
    // finished sitting. It used to answer `durable` and record no day at all.
    const at = new Date(2026, 9, 2, 12).getTime();
    assert.equal(await recordActivityOnce('drill', 0, at, { activeMs: 30_000, finished: true }), 'durable');
    assert.deepEqual(await loadActiveDays(), ['2026-10-02'], 'a finished practice sitting with no XP lost its day');
    assert.deepEqual(await loadActivity({ strict: true }), [], 'a sitting with no XP wrote an entry');

    // A replay of the same plan adds nothing: a day is a set.
    const bytes = disk.get(activityKey());
    assert.equal(await recordActivityOnce('drill', 0, at, { activeMs: 30_000, finished: true }), 'durable');
    assert.deepEqual(JSON.parse(disk.get(activityKey())!).activeDays, JSON.parse(bytes!).activeDays);

    // Without the word that it finished, still nothing, as before (F731).
    const other = nextUid();
    setActiveUser(other);
    assert.equal(await recordActivityOnce('drill', 0, at), 'durable');
    assert.equal(disk.has(activityKey(other)), false, 'a sitting nobody said was finished became a day');

    // An unreadable log is never replaced, for a day either.
    disk.set(activityKey(other), '{broken');
    assert.equal(await recordActivityOnce('drill', 0, at, { finished: true }), 'failed');
    assert.equal(disk.get(activityKey(other)), '{broken');
  });

  test('two devices settling the same day converge to one streak day and one set of claims after a merge', async () => {
    // The phone.
    assert.ok(await convo(NOW - HOUR, 40, 6 * MINUTE));
    const phone = { game: JSON.parse(disk.get(gameKey())!), activity: JSON.parse(disk.get(activityKey())!) };

    // The tablet, the same account, its own disk, a different practice the same day.
    disk = installDisk();
    assert.ok(await drill(NOW, 10, 7 * MINUTE));
    const tablet = { game: JSON.parse(disk.get(gameKey())!), activity: JSON.parse(disk.get(activityKey())!) };
    assert.deepEqual(phone.game.questDays[0].ids, tablet.game.questDays[0].ids, 'two devices dealt the same day different quests');

    const game = merge('game', phone.game, tablet.game) as typeof phone.game;
    const activity = merge('activity', phone.activity, tablet.activity) as { activeDays: string[] };
    assert.deepEqual(merge('game', tablet.game, phone.game), game, 'the merge depends on which device asks');

    const claimIds = (game.claims as { day: string; questId: string }[]).map((c) => `${c.day}|${c.questId}`);
    assert.equal(new Set(claimIds).size, claimIds.length, 'a quest was claimed twice for one day');
    assert.deepEqual(claimIds.sort(), [`${TODAY}|finish-practice`, `${TODAY}|minutes`]);
    assert.equal(game.questDays.length, 1);
    assert.deepEqual(game.goalDays, [TODAY]);
    assert.deepEqual(activity.activeDays, [TODAY]);
    const streak = streakFrom({ practiceDays: activity.activeDays, covers: game.covers, today: TODAY });
    assert.equal(streak.current, 1, 'two sittings on one day counted as two streak days');
    assert.equal(streak.lifetimeDays, 1);
  });
});

describe('settling a finished sitting, after review — F744', () => {
  test('a cover this settle writes never replays a milestone the run had already passed', async () => {
    const paid: BillingFacts = { plan: 'regular', lapsed: false, secondsRemaining: 1200, canStart: true };
    pin({ billing: () => paid });

    // A freeze. Ten days in a row ending the day before yesterday, yesterday
    // missed, a plan first seen weeks ago. The seed meets a broken run, so no
    // milestone is marked seen, and the settle's own freeze brings the run back.
    for (let n = 11; n >= 2; n -= 1) assert.equal(await recordActivity('drill', 10, NOW - n * DAY, { finished: true }), 'durable');
    assert.equal(await setPaidSince(addDays(TODAY, -20)), 'durable');
    assert.ok(await seedExistingLearner());
    heard = [];
    const frozen = await drill(NOW, 10);
    assert.ok(frozen);
    assert.deepEqual((await loadGame()).covers.map((cover) => [cover.day, cover.kind]), [[addDays(TODAY, -1), 'freeze']]);
    assert.equal(frozen.streak.restoredBy, 'freeze');
    assert.equal(frozen.streak.after.current, 11);
    assert.equal(frozen.streak.milestone, null, 'a freeze replayed the 7 the run passed last week');
    assert.deepEqual(streakMoments().map((e) => e.key), [`streak:${TODAY}`], 'today\'s streak moment was lost to an old milestone');

    // A repair. Ten days ending three days ago, two days ago missed, yesterday
    // practised: the missed day sits behind a new run, where no freeze reaches,
    // and today's practice is the second in the window, so it completes the repair.
    uid = nextUid();
    setActiveUser(uid);
    for (let n = 12; n >= 3; n -= 1) assert.equal(await recordActivity('drill', 10, NOW - n * DAY, { finished: true }), 'durable');
    assert.equal(await recordActivity('drill', 10, NOW - DAY, { finished: true }), 'durable');
    assert.ok(await seedExistingLearner());
    heard = [];
    const repaired = await drill(NOW, 10);
    assert.ok(repaired);
    assert.deepEqual((await loadGame()).covers.map((cover) => [cover.day, cover.kind]), [[addDays(TODAY, -2), 'repair']]);
    assert.equal(repaired.streak.restoredBy, 'repair');
    assert.equal(repaired.streak.after.current, 12);
    assert.equal(repaired.streak.milestone, null, 'a repair replayed the 7 the run passed days ago');
    assert.deepEqual(streakMoments().map((e) => e.key), [`streak:${TODAY}`]);
  });

  test('a sitting after more than four hundred days of practice is credited every XP it earned', async () => {
    // A sitting a day for 410 days, newest first, so no write ages out an older one.
    for (let n = 1; n <= 410; n += 1) assert.equal(await recordActivity('drill', 20, NOW - n * DAY, { activeMs: MINUTE }), 'durable');
    assert.equal((await loadActivity({ strict: true })).length, 410);
    assert.ok(await seedExistingLearner());

    const delta = await drill(NOW, 20, 2 * MINUTE);
    assert.ok(delta);
    assert.equal((await loadActivity({ strict: true })).length, 401, 'the fixture did not age the oldest days out in the sitting\'s own write');
    assert.equal(delta.xp.counted, 20, 'the days that aged out were taken off this sitting\'s XP');
    assert.equal(delta.xp.capped, false, 'an uncapped sitting was told the daily limit was reached');
    assert.equal(delta.xp.totalAfter - delta.xp.totalBefore, delta.xp.counted + delta.xp.questXp + delta.xp.bonus, 'the total moved by something other than what this sitting credited');
  });

  test('a sitting that begins while the quiet catch-up is running keeps its own moments', async () => {
    assert.equal(await seedExistingLearner(), null);

    // The catch-up's read of the other stores is held open, as a slow disk would hold it.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let parked = false;
    restore();
    restore = configureGameEnvironment({
      now: () => NOW,
      billing: () => Promise.resolve(null),
      canRecord: () => Promise.resolve(true),
      outside: async () => {
        if (!parked) {
          parked = true;
          await gate;
        }
        return { ...NO_OUTSIDE_FACTS, goalTarget: 5 };
      },
    });
    const quiet = catchUpQuietly();
    while (!parked) await new Promise((resolve) => setImmediate(resolve));

    // A conversation finishes, and its write lands under the catch-up's reads.
    const settling = convo(NOW, 40, 6 * MINUTE);
    while ((await loadActivity({ strict: true })).length === 0) await new Promise((resolve) => setImmediate(resolve));
    release();

    assert.deepEqual(await quiet, []);
    const delta = await settling;
    assert.ok(delta);
    assert.deepEqual(delta.quests.completedNow, ['finish-practice', 'minutes'], 'the catch-up claimed the sitting\'s quests');
    assert.deepEqual(delta.badges, ['first-conversation'], 'the catch-up awarded the sitting\'s badge');
    assert.deepEqual(heard.map((e) => e.key).sort(), ['badge:first-conversation', 'level:2', `streak:${TODAY}`]);
    assert.deepEqual((await loadGame()).seen.map((mark) => mark.key), ['intro'], 'the catch-up marked the sitting\'s moments seen, so they never play');
  });

  test('two devices dealt different quests keep every quest they credited after a merge, and the chest and the count agree', async () => {
    // D22: there is no chest. The count alone says the day is done, and it never falls after a merge.
    // The phone dealt first and finished one of its three.
    const phoneDeal: [QuestId, QuestId, QuestId] = ['phrase-of-day', 'conversation', 'new-phrases'];
    assert.equal(await setQuestDay({ day: TODAY, ids: phoneDeal, at: NOW - 2 * HOUR }), 'durable');
    assert.equal(await addClaims([{ day: TODAY, questId: 'phrase-of-day', xp: 10, at: NOW - 2 * HOUR }]), 'durable');
    const phone = JSON.parse(disk.get(gameKey())!) as StoredGame;

    // The tablet, offline and without a microphone, was dealt three others and finished them all.
    disk = installDisk();
    const tabletDeal: [QuestId, QuestId, QuestId] = ['practise-twice', 'practice-set', 'sound-check'];
    assert.equal(await setQuestDay({ day: TODAY, ids: tabletDeal, at: NOW - HOUR }), 'durable');
    assert.equal(await addClaims(tabletDeal.map((questId) => ({ day: TODAY, questId, xp: 10, at: NOW - HOUR }))), 'durable');
    const tablet = JSON.parse(disk.get(gameKey())!) as StoredGame;
    // On its own the tablet's day reads all three done.
    assert.equal(gameViewFrom(await readGameFacts({ ...NO_OUTSIDE_FACTS, goalTarget: 5 }, null), TODAY).quests.done, 3);

    const game = merge('game', phone, tablet) as StoredGame;
    assert.deepEqual(game.questDays.map((row) => row.ids), [phoneDeal], 'the earliest deal is not the one kept');
    disk.set(gameKey(), JSON.stringify(game));

    const facts = await readGameFacts({ ...NO_OUTSIDE_FACTS, goalTarget: 5 }, null);
    const view = gameViewFrom(facts, TODAY);
    assert.deepEqual(view.quests.ids, phoneDeal);
    assert.equal(view.quests.done, 3, 'the tablet finished three quests today and the merged count says the day is not done');
    assert.equal(view.xp.quests, 10 + 3 * 10, 'a quest one device credited was taken back by the merge');
    assert.deepEqual(badgeFactsFrom(facts, view).questMonths, [{ month: TODAY.slice(0, 7), count: 4 }]);

    // The next sitting on the merged facts takes nothing back, adds no XP for the day being done and says nothing new.
    const delta = await drill(NOW, 10);
    assert.ok(delta);
    assert.deepEqual(delta.quests.completedNow, []);
    assert.equal(allQuestsDoneNow(delta), false, 'a sitting that finished no quest said the third was just finished');
    assert.equal(delta.quests.done, 3);
    assert.equal(delta.xp.questXp, 0);
    assert.ok(delta.xp.totalAfter >= delta.xp.totalBefore + delta.xp.counted);
    const claims = (await loadGame()).claims;
    assert.equal(claims.length, 4);
    assert.ok(claims.every((claim) => isQuestId(claim.questId)), 'a claim that is not a quest was written');
  });

  test('a sitting whose account changes while its snapshot is read never starts its write', async () => {
    const other = nextUid();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    const getItem = shared.getItem as (key: string) => Promise<string | null>;
    let switched = false;
    shared.getItem = (key: string): Promise<string | null> => {
      if (!switched && key === activityKey()) {
        switched = true;
        setActiveUser(other);
      }
      return getItem(key);
    };
    let started = 0;
    const delta = await settleSitting({
      source: 'drill',
      at: NOW,
      xpEarned: 12,
      write: () => {
        started += 1;
        return recordActivity('drill', 12, NOW, { finished: true });
      },
    });
    assert.ok(switched, 'the account never changed, so this checks nothing');
    assert.equal(delta, null);
    assert.equal(started, 0, 'the sitting\'s write was started after the account changed');
    assert.equal(disk.has(activityKey(other)), false, 'one learner\'s sitting landed in the next account');
    assert.equal(disk.has(gameKey(other)), false);
  });

  test('a sitting settled long after it finished yesterday deals and claims nothing for yesterday', async () => {
    assert.equal(await seedExistingLearner(), null);
    const evening = new Date(2026, 9, 4, 18, 0, 0).getTime();
    assert.notEqual(localDayKey(evening), TODAY);

    // Settled at noon the next day: a plan retried in the morning, a guest practice kept the day after.
    const delta = await drill(evening, 12, 6 * MINUTE);
    assert.ok(delta);
    assert.deepEqual(await loadActiveDays(), [localDayKey(evening)], 'the sitting no longer counts for the day it finished');
    const game = await loadGame();
    assert.deepEqual(game.questDays.map((row) => row.day), [TODAY], 'quests were dealt for a day the learner had already left');
    assert.ok(game.claims.every((claim) => claim.day === TODAY), 'a quest was claimed for a day the learner had already left');
  });

  test('the guest hand-off leaves today\'s quests to the first catch-up', async () => {
    // Before the game layer mounts, the phone reads as unable to record.
    pin({ canRecord: () => false });
    const guest = { version: 2, attempts: [], kept: true, completed: true, finishedAt: [NOW - HOUR] } as unknown as GuestPractice;
    const handed = await settleGuestHandoff(guest);
    assert.equal(handed.ack, 'durable');
    assert.ok(handed.delta);
    assert.deepEqual((await loadGame()).questDays, [], 'the hand-off dealt today\'s quests before the app knew the microphone');

    // The game layer mounts with the microphone known, and deals the day once.
    pin({ canRecord: () => true });
    assert.equal(await seedExistingLearner(), null);
    assert.deepEqual(await catchUpQuietly(), []);
    assert.deepEqual((await loadGame()).questDays.map((row) => [row.day, row.ids]), [[TODAY, [...DAY_ONE_QUESTS]]]);
    assert.deepEqual(streakMoments(), []);
  });

  test('a kept guest practice is still saved when the game layer cannot mark it seen', async () => {
    // A game record a newer build wrote: this build may not touch it.
    const newer = JSON.stringify({ version: 99 });
    disk.set(gameKey(), newer);
    const guest = { version: 2, attempts: [], kept: true, completed: true, finishedAt: [NOW - HOUR] } as unknown as GuestPractice;
    const handed = await settleGuestHandoff(guest);
    assert.equal(handed.ack, 'durable', 'the practice was reported unsaved because only the game layer could not write');
    assert.equal(handed.delta, null);
    assert.deepEqual(await loadActiveDays(), [TODAY], 'the guest\'s practice day was not recorded');
    assert.equal(disk.get(gameKey()), newer, 'a newer build\'s record was overwritten');
    assert.deepEqual(streakMoments(), [], 'the flame lit again with nothing marked seen');

    // A day that cannot be recorded is still a failure, so the hand-off can say so.
    uid = nextUid();
    setActiveUser(uid);
    disk.set(activityKey(), '{broken');
    assert.equal((await settleGuestHandoff(guest)).ack, 'failed');
  });
});

/** Every source file under a folder, tests included, as `[path, text]`. */
function sourcesUnder(dir: string): [string, string][] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((name) => /\.(?:ts|tsx|mjs)$/.test(name))
    .map((name) => [join(dir, name), readFileSync(join(dir, name), 'utf8')]);
}

describe('quests without a chest — F773', () => {
  test('finishing all three quests shows one quiet line and no chest', async () => {
    // Founder decision D22: quests stay, +10 each, and finishing all three is one quiet line with the quest sound.
    assert.equal(await seedExistingLearner(), null);

    // Two of today's three (day one, with a microphone): a conversation finishes a practice and five minutes.
    const first = await convo(NOW, 40, 6 * MINUTE);
    assert.ok(first);
    assert.deepEqual(first.quests.completedNow, ['finish-practice', 'minutes']);
    const partway = endCardView(first);
    assert.equal(partway.questProgress, GAME_COPY.quests.progress(2));
    assert.equal(partway.timeline, 'end-card', 'two of three quests played the quest sound');

    // The third: today's phrase.
    heard = [];
    const phraseAt = NOW + HOUR;
    const settling = await beginSettle();
    assert.equal(await recordActiveDay(phraseAt), 'durable');
    const third = await finishSettle(settling, { source: 'phrase', at: phraseAt, xpEarned: 0, activeMs: 90_000 });
    assert.ok(third);
    assert.deepEqual(third.quests.completedNow, ['phrase-of-day']);
    assert.equal(third.quests.done, 3);
    assert.equal(allQuestsDoneNow(third), true);

    // No chest claim is written and no chest XP is credited: three quests at +10, and nothing more.
    const game = await loadGame();
    assert.deepEqual(game.claims.map((claim) => [claim.questId, claim.xp]).sort(), [['finish-practice', 10], ['minutes', 10], ['phrase-of-day', 10]], 'finishing all three wrote a claim that is not a quest');
    assert.equal(third.xp.questXp, 10, 'finishing the third quest credited more than the quest itself');
    assert.equal(gameViewFrom(await readGameFacts({ ...NO_OUTSIDE_FACTS, goalTarget: 5 }, null), TODAY).xp.quests, 30);

    // No takeover is published for it, and no chest key is queued or remembered.
    assert.deepEqual(heard.map((event) => event.type), [], 'finishing all three quests published a takeover');
    assert.ok(!game.seen.some((mark) => mark.key.startsWith('chest')), 'a chest key was marked seen');
    assert.ok(!(await loadGameLocal()).pending.some((item) => item.key.startsWith('chest')), 'a chest moment waits to play');

    // The end card says the one quiet line, with the quest sound as it lands.
    const card = endCardView(third);
    assert.equal(card.questProgress, 'All three quests done today.');
    assert.equal(card.timeline, 'end-card-quests');
    assert.deepEqual(TIMELINES[card.timeline].beats.flatMap((beat) => (beat.sound === undefined ? [] : [beat.sound])), ['complete', 'quest']);
    // A later practice that day still reads the line, without the sound again.
    const later = await drill(NOW + 2 * HOUR, 10);
    assert.ok(later);
    assert.equal(endCardView(later).questProgress, 'All three quests done today.');
    assert.equal(endCardView(later).timeline, 'end-card', 'the quest sound played for a day already done');

    // The reader refuses what only a chest wrote; the rows beside it still read.
    assert.equal(await addClaims([{ day: TODAY, questId: 'chest' as QuestId, xp: 15, at: NOW }]), 'failed', 'the store took a chest claim');
    assert.equal(readGame({ ...emptyGame(), claims: [{ day: TODAY, questId: 'chest', xp: 15, at: NOW }] }), null);
    assert.equal(readGame({ ...emptyGame(), seen: [{ key: `chest:${TODAY}`, at: NOW }] }), null);
    assert.notEqual(readGame({ ...emptyGame(), seen: [{ key: `streak:${TODAY}`, at: NOW }] }), null);

    // And no source in the app or in core names the chest's XP, its takeover, its template or its delta flag.
    const banned = [['CHEST', 'XP'].join('_'), ['quest', 'chest'].join('-'), ['Quest', 'Chest'].join(''), ['chest', 'Now'].join(''), ['GAME_COPY', 'chest'].join('.'), ['celebrationKey', 'chest'].join('.')];
    const roots = [fileURLToPath(new URL('../', import.meta.url)), fileURLToPath(new URL('../../../../packages/core/src/', import.meta.url))];
    let read = 0;
    for (const root of roots) {
      for (const [path, text] of sourcesUnder(root)) {
        read += 1;
        for (const name of banned) assert.ok(!text.includes(name), `${path} names ${name}, which went with the chest (D22)`);
      }
    }
    assert.ok(read > 300, `only ${read} sources were read, so this scan proves nothing`);
  });
});
