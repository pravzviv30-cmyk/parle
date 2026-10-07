/**
 * The game store on this device (F729).
 *
 * What it has to hold, in order of how badly it would hurt to get wrong:
 * bytes this build would not write are refused rather than repaired; an
 * awarded badge is never taken back by a write, a fold or an age window; a
 * write queued under one account lands nowhere else; and the seam with the
 * sync engine behaves like every other synced store's (a learner's own write
 * raises the flag, an adoption does not, an unreadable fold is declined, and a
 * write that lands during an adoption survives it).
 *
 * The storage double is the one `goals/store.test.ts` uses.
 */

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { adopterFor, clearDirty, dirtyStamp, resetSyncRegistry } from '../sync/registry.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { emptyGame, GAME_VERSION } from './model.ts';
import {
  addBonus,
  addClaims,
  addCovers,
  appendSitting,
  awardBadges,
  hasSeen,
  loadGame,
  markGoalDay,
  markSeen,
  raiseXpMonths,
  setQuestDay,
} from './store.ts';

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
  shared.multiGet = (keys: string[]): Promise<[string, string | null][]> =>
    Promise.resolve(keys.map((key) => [key, map.get(key) ?? null]));
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `33333333-3333-4333-8333-${String(++uids).padStart(12, '0')}`;

const DAY = 86_400_000;
const AT = Date.UTC(2026, 9, 5, 9);

let disk: Map<string, string>;
let uid: string;
const key = (who = uid): string => `luvani.u.${who}.game`;

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

const policy = createSyncPolicy({ now: () => AT });
const merge = (local: unknown, remote: unknown): unknown => {
  const result = policy.merge({ namespace: 'game', local, remote });
  return result.kind === 'merged' ? result.data : `quiet:${result.reason}`;
};

describe('the game store — F729', () => {
  test('the game store refuses unknown bytes and keeps every awarded badge', async () => {
    // A badge is awarded twice over: counted from older practice, then dated.
    assert.equal(await awardBadges([{ id: 'streak-7', at: null }]), 'durable');
    assert.equal(await awardBadges([{ id: 'streak-7', at: AT }, { id: 'goal-7', at: AT + 5 }]), 'durable');
    assert.deepEqual((await loadGame()).badges, [{ id: 'goal-7', at: AT + 5 }, { id: 'streak-7', at: AT }]);
    // A later award of the same badge does not move its date, and a null never replaces a date.
    assert.equal(await awardBadges([{ id: 'streak-7', at: AT + DAY }, { id: 'goal-7', at: null }]), 'durable');
    assert.deepEqual((await loadGame()).badges, [{ id: 'goal-7', at: AT + 5 }, { id: 'streak-7', at: AT }]);

    // Nothing else the store does takes one back: not a year of other writes,
    // not the age windows those writes move, and not a fold of an account copy
    // that never heard of them. The year is the one before AT, because the store
    // refuses a row dated after tomorrow.
    const yearBefore = AT - 400 * DAY;
    for (let n = 0; n < 5; n += 1) {
      assert.equal(await appendSitting({ at: yearBefore + (n * 90 + 1) * DAY, source: 'phrase' }), 'durable');
      assert.equal(await markSeen([{ key: `streak:${new Date(yearBefore + n * 90 * DAY).toISOString().slice(0, 10)}`, at: yearBefore }]), 'durable');
    }
    assert.equal((await loadGame()).sittings.length, 5, 'later dates erased earlier sittings within the count bound');
    const adopt = adopterFor('game');
    assert.ok(adopt, 'the game store registered no adopter, so a merge could never come back');
    assert.equal(await adopt((current) => merge(current, { ...emptyGame(), badges: [] })), 'adopted');
    assert.deepEqual((await loadGame()).badges.map((b) => b.id), ['goal-7', 'streak-7'], 'an awarded badge was dropped');

    // Unknown bytes are refused, never repaired: a version from a newer build,
    // a stray key, a wrong type, a cover kind this build has never heard of.
    const good = disk.get(key())!;
    const refused: unknown[] = [
      { ...JSON.parse(good), version: GAME_VERSION + 1 },
      { ...JSON.parse(good), streak: 9 },
      { ...JSON.parse(good), sittings: [{ at: String(AT), source: 'phrase' }] },
      { ...JSON.parse(good), covers: [{ day: '2026-10-04', kind: 'earned', at: AT }] },
      { ...JSON.parse(good), badges: [{ id: 'streak-7', at: 'yesterday' }] },
      { ...JSON.parse(good), claims: 'lots' },
      '{broken',
    ];
    for (const bytes of refused) {
      const raw = typeof bytes === 'string' ? bytes : JSON.stringify(bytes);
      disk.set(key(), raw);
      await assert.rejects(loadGame(), /unreadable/, `${raw.slice(0, 60)} read as a game record`);
      await assert.rejects(hasSeen('level:2'), /unreadable/);
      assert.equal(await awardBadges([{ id: 'level-10', at: AT }]), 'failed', 'a write landed over bytes this build cannot read');
      assert.equal(await addCovers([{ day: '2026-10-04', kind: 'freeze', at: AT }]), 'failed');
      assert.equal(await adopt(() => emptyGame()), 'declined', 'an adoption wrote over bytes this build cannot read');
      assert.equal(disk.get(key()), raw, 'the unreadable bytes were repaired in place');
    }

    // And a row this build would never write is refused at the door, not stored.
    disk.set(key(), good);
    assert.equal(await addCovers([{ day: '2026-10-04', kind: 'earned' as never, at: AT }]), 'failed');
    assert.equal(await awardBadges([{ id: 'Not A Badge', at: AT }]), 'failed');
    assert.equal(disk.get(key()), good);
  });

  test("every game write lands, a replay writes nothing, and the account's own write is news", async () => {
    const writes: [string, () => Promise<string>][] = [
      ['sitting', () => appendSitting({ at: AT, source: 'drill', activeMs: 30_000 })],
      ['cover', () => addCovers([{ day: '2026-10-04', kind: 'freeze', at: AT }])],
      ['goal day', () => markGoalDay('2026-10-05')],
      ['claim', () => addClaims([{ day: '2026-10-05', questId: 'finish-practice', xp: 10, at: AT }])],
      ['bonus', () => addBonus([{ key: 'phrase:2026-10-05', xp: 5, at: AT }])],
      ['month', () => raiseXpMonths([{ month: '2026-10', xp: 120 }])],
      ['badge', () => awardBadges([{ id: 'first-conversation', at: AT }])],
      ['seen', () => markSeen([{ key: 'streak:2026-10-05', at: AT }])],
    ];
    for (const [name, write] of writes) {
      const before = dirtyStamp('game');
      if (before !== null) clearDirty('game', before);
      assert.equal(await write(), 'durable', `the ${name} did not land`);
      const stamp = dirtyStamp('game');
      assert.notEqual(stamp, null, `the ${name} was not flagged, so the account never hears of it`);
      clearDirty('game', stamp!);
      const bytes = disk.get(key());
      assert.equal(await write(), 'durable', `replaying the ${name} said it failed`);
      assert.equal(disk.get(key()), bytes, `replaying the ${name} wrote to the disk`);
      assert.equal(dirtyStamp('game'), null, `replaying the ${name} raised the flag`);
    }
    const game = await loadGame();
    assert.deepEqual(game.questMonths, [{ month: '2026-10', count: 1, xp: 10 }], 'the claim was not counted into its month');
    assert.deepEqual(game.bonusMonths, [{ month: '2026-10', xp: 5 }]);
    assert.equal(await hasSeen('streak:2026-10-05'), true);
    assert.equal(await hasSeen('streak:2026-10-06'), false);

    // v2 retains an older sitting within the count bound; a newer timestamp
    // cannot age out another device's evidence.
    assert.equal(await appendSitting({ at: AT - 61 * DAY, source: 'review' }), 'durable');
    const olderStamp = dirtyStamp('game');
    assert.notEqual(olderStamp, null);
    clearDirty('game', olderStamp!);

    // Nothing offered is nothing to write, never a failure: the settle pipeline
    // hands these helpers derived lists that are empty on most sittings.
    const settled = disk.get(key());
    const empties: [string, () => Promise<string>][] = [
      ['covers', () => addCovers([])],
      ['claims', () => addClaims([])],
      ['bonus', () => addBonus([])],
      ['months', () => raiseXpMonths([])],
      ['badges', () => awardBadges([])],
      ['seen', () => markSeen([])],
    ];
    for (const [name, write] of empties) {
      assert.equal(await write(), 'durable', `an empty list of ${name} answered failed, which means the disk refused`);
    }
    assert.equal(disk.get(key()), settled, 'an empty list wrote to the disk');
    assert.equal(dirtyStamp('game'), null, 'an empty list was flagged for the account');
    // An empty list is still nothing to fail on a disk this build cannot read;
    // a list with a row in it is not.
    disk.set(key(), '{broken');
    assert.equal(await awardBadges([]), 'durable');
    assert.equal(await awardBadges([{ id: 'level-10', at: AT }]), 'failed');
    assert.equal(disk.get(key()), '{broken');
  });

  test('a game row dated after tomorrow is refused, so one wrong clock cannot age out every device', async () => {
    // Every age window is measured back from the newest row, so one row a year
    // ahead would cut every real row on every device it reached. The local write
    // is the door this build controls.
    const now = Date.now();
    const ahead = now + 2 * DAY;
    const day = (at: number): string => new Date(at).toISOString().slice(0, 10);
    const farDay = day(now + 4 * DAY);
    const refused: [string, () => Promise<string>][] = [
      ['sitting', () => appendSitting({ at: ahead, source: 'drill' })],
      ['cover moment', () => addCovers([{ day: day(now), kind: 'freeze', at: ahead }])],
      ['cover day', () => addCovers([{ day: farDay, kind: 'freeze', at: now }])],
      ['goal day', () => markGoalDay(farDay)],
      ['quest day', () => setQuestDay({ day: farDay, ids: ['finish-practice', 'phrase-of-day', 'minutes'], at: now })],
      ['claim', () => addClaims([{ day: farDay, questId: 'xp', xp: 10, at: now }])],
      ['bonus key', () => addBonus([{ key: `review:${now + 4 * DAY}`, xp: 5, at: now }])],
      ['month', () => raiseXpMonths([{ month: day(now + 70 * DAY).slice(0, 7), xp: 10 }])],
      ['badge', () => awardBadges([{ id: 'streak-7', at: ahead }])],
      ['seen moment', () => markSeen([{ key: 'level:2', at: ahead }])],
      ['seen day', () => markSeen([{ key: `streak:${farDay}`, at: now }])],
    ];
    for (const [name, write] of refused) {
      assert.equal(await write(), 'failed', `a ${name} dated after tomorrow was written`);
    }
    assert.equal(disk.has(key()), false, 'a row dated after tomorrow reached the disk');

    // Today, and tomorrow anywhere on Earth, are fine.
    assert.equal(await appendSitting({ at: now, source: 'drill' }), 'durable');
    assert.equal(await markSeen([{ key: `streak:${day(now + DAY)}`, at: now + DAY - 1 }]), 'durable');
    assert.equal(await setQuestDay({ day: day(now + DAY), ids: ['finish-practice', 'phrase-of-day', 'minutes'], at: now }), 'durable');
  });

  test("a day's three quests are frozen the first time they are dealt", async () => {
    const first = { day: '2026-10-05', ids: ['finish-practice', 'phrase-of-day', 'minutes'] as ['finish-practice', 'phrase-of-day', 'minutes'], at: AT };
    assert.equal(await setQuestDay(first), 'durable');
    const bytes = disk.get(key());
    assert.equal(await setQuestDay({ day: '2026-10-05', ids: ['practise-twice', 'conversation', 'xp'], at: AT - 1 }), 'durable');
    assert.equal(disk.get(key()), bytes, 'a second deal reshuffled the day');
    assert.deepEqual((await loadGame()).questDays, [first]);
    assert.equal(await setQuestDay({ day: '2026-10-06', ids: ['xp', 'xp', 'minutes'] as never, at: AT }), 'failed', 'a day dealt one quest twice');
  });

  test('a game write queued under one account never lands in the next, nor after a reset', async () => {
    const queued = awardBadges([{ id: 'streak-7', at: AT }]);
    const other = nextUid();
    setActiveUser(other);
    assert.equal(await queued, 'failed');
    assert.equal(disk.has(key(uid)), false);
    assert.equal(disk.has(key(other)), false);

    assert.equal(await awardBadges([{ id: 'streak-7', at: AT }]), 'durable');
    assert.equal(disk.has(key(other)), true);
    const pending = markSeen([{ key: 'level:2', at: AT }]);
    await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
    assert.equal(await pending, 'failed');
    assert.equal(disk.has(key(other)), false, 'a reset left the game facts behind, or a queued write brought them back');
  });

  test('an adopted merge is news to nobody, and a write during the adoption survives it', async () => {
    assert.equal(await markGoalDay('2026-10-01'), 'durable');
    const stamp = dirtyStamp('game');
    assert.ok(stamp !== null);
    clearDirty('game', stamp);

    const adopt = adopterFor('game')!;
    const remote = { ...emptyGame(), goalDays: ['2026-10-02'] };
    // The engine read the disk, went to the network, and meanwhile the learner met a goal.
    const during = markGoalDay('2026-10-03');
    assert.equal(await adopt((current) => merge(current, remote)), 'adopted');
    assert.equal(await during, 'durable');
    assert.deepEqual((await loadGame()).goalDays, ['2026-10-01', '2026-10-02', '2026-10-03'], 'a goal day written during the cycle was lost');
    // The flag is the local write's, not the adoption's.
    assert.notEqual(dirtyStamp('game'), null);
    const local = dirtyStamp('game')!;
    clearDirty('game', local);
    assert.equal(await adopt((current) => merge(current, remote)), 'adopted');
    assert.equal(dirtyStamp('game'), null, 'adopting raised the flag, so the account would be sent its own state');
  });
});
