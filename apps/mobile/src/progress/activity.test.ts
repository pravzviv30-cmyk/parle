/**
 * How long a sitting took, on the disk and across a sync fold.
 *
 * `durationMs` is the first field added to `ActivityEntry` since the log
 * existed, and there is already a log on every phone that has been used. So the
 * three things that can go wrong are all here: a new entry that does not carry
 * the measurement, an old entry that reads back as something the app refuses,
 * and a device that synced before the field existed folding its copy in and
 * quietly deleting the measurement a newer device made.
 *
 * The storage double is the one storeBinding.test.ts uses: AsyncStorage
 * resolves under plain node but has no implementation off a device, and every
 * store imports the same module object, so assigning the methods onto it is
 * enough.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { sameData } from '../sync/envelope.ts';
import { adopterFor } from '../sync/registry.ts';
import { claimActivityInstant, loadActiveDays, loadActivity, recordActivity, recordActivityOnce, type ActivityEntry } from './activity.ts';

function installDisk(initial: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
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
const nextUid = (): string => `22222222-2222-4222-8222-${String(++uids).padStart(12, '0')}`;

let disk: Map<string, string>;
let uid: string;

beforeEach(() => {
  disk = installDisk();
  uid = nextUid();
  setActiveUser(uid);
});

const policy = createSyncPolicy({ now: () => Date.UTC(2026, 8, 4, 12, 0, 0) });

function merge(local: unknown, remote: unknown): unknown {
  const result = policy.merge({ namespace: 'activity', local, remote });
  return result.kind === 'merged' ? result.data : `quiet:${result.reason}`;
}

const entriesOf = (blob: unknown): ActivityEntry[] => (blob as { entries: ActivityEntry[] }).entries;

test('a visible activity read distinguishes absence from corrupt or refused history', async () => {
  const key = `luvani.u.${uid}.activity`;
  assert.deepEqual(await loadActivity({ strict: true }), []);
  disk.set(key, JSON.stringify({ version: 1, entries: [{ at: 9, kind: 'lesson', xp: 20 }] }));
  assert.deepEqual(await loadActivity({ strict: true }), [{ at: 9, kind: 'lesson', xp: 20 }], 'the legacy envelope remains valid');
  disk.set(key, JSON.stringify({ version: 2, entries: [{ at: 9, kind: 'drill', xp: 3, activeMs: -4 }, { at: 10, kind: 'drill', xp: 3, activeMs: 4_000 }] }));
  await assert.rejects(loadActivity({ strict: true }), /unreadable/);
  await assert.rejects(loadActiveDays(), /Unreadable/);
  assert.deepEqual(await loadActivity(), [{ at: 10, kind: 'drill', xp: 3, activeMs: 4_000 }], 'legacy normalization stays available internally');
  disk.set(key, '{broken');
  await assert.rejects(loadActivity({ strict: true }));
  AsyncStorage.getItem = async () => { throw new Error('device refused'); };
  await assert.rejects(loadActivity({ strict: true }), /device refused/);
});

test('erase waits for a dispatched activity write and stale queued sittings cannot recreate it', async () => {
  let entered!: () => void;
  let release!: () => void;
  const dispatched = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.setItem = async (key, value) => { entered(); await held; disk.set(key, value); };
  AsyncStorage.multiRemove = async keys => { for (const key of keys) disk.delete(key); };
  const first = recordActivity('convo', 5, 10);
  await dispatched;
  const queued = recordActivity('review', 3, 11);
  const erasing = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release();
  await Promise.all([first, queued, erasing]);
  assert.equal(disk.has(`luvani.u.${uid}.activity`), false);
});

test('an activity write does not replace unreadable existing sittings with a fresh log', async () => {
  const key = `luvani.u.${uid}.activity`;
  disk.set(key, '{broken');
  await recordActivity('review', 3, 10);
  assert.equal(disk.get(key), '{broken');
  assert.equal(await recordActivityOnce('review', 3, 10), 'failed');
  assert.equal(await claimActivityInstant('review', 3, 10), null);
  assert.equal(await adopterFor('activity')!(() => ({ version: 2, entries: [] })), 'declined');
  assert.equal(disk.get(key), '{broken');
  const invalidDays = JSON.stringify({ version: 2, entries: [], activeDays: ['2026-02-30'] });
  disk.set(key, invalidDays);
  await recordActivity('review', 3, 11);
  assert.equal(disk.get(key), invalidDays, 'a malformed date was normalized away by a writer');
  await assert.rejects(loadActiveDays(), /Unreadable/);
});

test('activity sync adoption declines when the device refuses its write', async () => {
  AsyncStorage.setItem = async () => { throw new Error('device refused'); };
  const adopt = adopterFor('activity');
  assert.ok(adopt);
  assert.equal(await adopt(() => ({ version: 2, entries: [{ at: 10, kind: 'review', xp: 3 }] })), 'declined');
});

describe('a sitting that records how long it took', () => {
  test('an activity entry carries its duration, an old one without it still reads, and sync keeps the copy that has one — F395', async () => {
    // ── 1. The measurement reaches the disk, beside the XP that was already there.
    await recordActivity('convo', 12, 1_000, { durationMs: 425_000 });
    assert.deepEqual(
      await loadActivity(),
      [{ at: 1_000, kind: 'convo', xp: 12, durationMs: 425_000 }],
      'the sitting was logged without the minutes the screen measured',
    );

    // ── 2. A caller with nothing to report leaves no field, rather than a zero.
    //     Absent means "not measured"; zero would be a claim that it took no time.
    await recordActivity('review', 4, 2_000);
    const [, unmeasured] = await loadActivity();
    assert.equal(unmeasured?.xp, 4);
    assert.equal(
      Object.prototype.hasOwnProperty.call(unmeasured ?? {}, 'durationMs'),
      false,
      'a sitting nobody measured was written with a duration anyway, which is a number nobody observed',
    );

    // ── 3. A duration that is not a measurement is dropped, never stored. The store
    //     must not hold a row its own reader would throw away.
    for (const nonsense of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await recordActivity('drill', 3, 3_000, { durationMs: nonsense });
    }
    for (const entry of await loadActivity()) {
      assert.ok(
        entry.durationMs === undefined || (Number.isFinite(entry.durationMs) && entry.durationMs >= 0),
        `a duration of ${String(entry.durationMs)} reached the log`,
      );
    }

    // ── 4. A sitting that produced no French still leaves no mark, and therefore no
    //     minutes. This is the guard that stops a "time spent" figure climbing while
    //     nothing was learned.
    const before = (await loadActivity()).length;
    await recordActivity('convo', 0, 4_000, { durationMs: 600_000 });
    assert.equal(
      (await loadActivity()).length,
      before,
      'a sitting worth no XP wrote an entry, so its minutes would be counted for nothing',
    );

    // ── 5. A log written before this field existed still reads. Byte for byte the
    //     shape that is on phones today: no durationMs anywhere.
    const key = `luvani.u.${uid}.activity`;
    disk.set(key, JSON.stringify({ version: 1, entries: [{ at: 9, kind: 'lesson', xp: 20 }], backfilled: true }));
    assert.deepEqual(
      await loadActivity(),
      [{ at: 9, kind: 'lesson', xp: 20 }],
      'an entry written before durationMs existed no longer reads back, so an upgrade would erase the log',
    );

    // ── 6. The fold. The same sitting, logged by two devices: one before this field
    //     shipped and one after. The identity is still (at, kind, xp), so it is one
    //     row and not two, and the row that survives is the one carrying the
    //     measurement — whichever side asked.
    const measured = { version: 1, entries: [{ at: 9, kind: 'lesson', xp: 20, durationMs: 512_000 }] };
    const older = { version: 1, entries: [{ at: 9, kind: 'lesson', xp: 20 }] };

    const forward = merge(measured, older);
    const backward = merge(older, measured);
    assert.ok(sameData(forward, backward), 'the answer depends on which device asked');
    assert.deepEqual(
      entriesOf(forward),
      [{ at: 9, kind: 'lesson', xp: 20, durationMs: 512_000 }],
      'the device that synced before durationMs existed erased a measurement the other device made',
    );
    assert.equal(entriesOf(forward).length, 1, 'the same sitting became two rows, so its XP is counted twice');

    // And it settles: folding the answer back in changes nothing, which is what
    // stops the two devices trading revisions forever.
    assert.ok(sameData(merge(forward, older), forward), 'the log keeps moving after both sides agree');
  });
});

describe('active learning time on the log (Phase 1B)', () => {
  test('a measured active total is stored beside the wall-clock duration, never derived from it', async () => {
    await recordActivity('drill', 5, 1_000, { durationMs: 900_000, activeMs: 240_000 });
    await recordActivity('lesson', 6, 2_000, { durationMs: 300_000 });
    const [both, wallOnly] = await loadActivity();
    assert.deepEqual(both, { at: 1_000, kind: 'drill', xp: 5, durationMs: 900_000, activeMs: 240_000 });
    assert.equal(Object.prototype.hasOwnProperty.call(wallOnly ?? {}, 'activeMs'), false, 'wall time was copied into activeMs');
  });

  test('a malformed active total is dropped, and the sitting still lands', async () => {
    for (const nonsense of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await recordActivity('review', 2, 3_000 + Math.random(), { activeMs: nonsense });
    }
    const entries = await loadActivity();
    assert.equal(entries.length, 3);
    for (const entry of entries) assert.equal(entry.activeMs, undefined);
  });

  test('a stored entry with a malformed active total is refused by the reader, as durationMs is', async () => {
    disk.set(`luvani.u.${uid}.activity`, JSON.stringify({ version: 2, entries: [{ at: 9, kind: 'drill', xp: 3, activeMs: -4 }, { at: 10, kind: 'drill', xp: 3, activeMs: 4_000 }] }));
    assert.deepEqual(await loadActivity(), [{ at: 10, kind: 'drill', xp: 3, activeMs: 4_000 }]);
  });

  test('the at-most-once writer carries the active total and a replay stays one row', async () => {
    // A recent stamp: the writer prunes to 400 days against the real clock.
    const when = Date.now() - 60_000;
    const at = await claimActivityInstant('drill', 7, when);
    assert.equal(at, when);
    assert.equal(await recordActivityOnce('drill', 7, when, { durationMs: 70_000, activeMs: 31_000 }), 'durable');
    assert.equal(await recordActivityOnce('drill', 7, when, { durationMs: 70_000, activeMs: 31_000 }), 'durable');
    assert.deepEqual(await loadActivity(), [{ at: when, kind: 'drill', xp: 7, durationMs: 70_000, activeMs: 31_000 }]);
  });

  test('sync keeps the copy carrying an active total, whichever side asks, and settles', () => {
    const measured = { version: 2, entries: [{ at: 9, kind: 'drill', xp: 4, durationMs: 60_000, activeMs: 20_000 }] };
    const wallOnly = { version: 2, entries: [{ at: 9, kind: 'drill', xp: 4, durationMs: 60_000 }] };
    const bare = { version: 1, entries: [{ at: 9, kind: 'drill', xp: 4 }] };
    for (const other of [wallOnly, bare]) {
      const forward = merge(measured, other);
      const backward = merge(other, measured);
      assert.ok(sameData(forward, backward), 'the answer depends on which device asked');
      assert.deepEqual(entriesOf(forward), measured.entries, 'an older copy erased the measured active time');
      assert.ok(sameData(merge(forward, other), forward), 'the fold keeps moving');
    }
  });

  test('sync refuses a row with a malformed active total, as the store does', () => {
    const bad = { version: 2, entries: [{ at: 9, kind: 'drill', xp: 4, activeMs: Number.NaN }, { at: 11, kind: 'drill', xp: 4, activeMs: -1 }] };
    assert.deepEqual(entriesOf(merge(bad, { version: 2, entries: [] })), []);
  });
});

describe('a light day is a durable date, never a grade', () => {
  test('completing light practice adds one active date without XP, and repeats and quiet days cannot reduce it', async () => {
    const { recordActiveDay, loadActiveDays } = await import('./activity.ts');
    const at = new Date(2026, 9, 2, 12).getTime();
    assert.equal(await recordActiveDay(at), 'durable');
    assert.equal(await recordActiveDay(at + 1000), 'durable');
    assert.deepEqual(await loadActiveDays(), ['2026-10-02']);
    assert.deepEqual(await loadActivity(), []);
    await recordActivity('review', 5, at + 86400000);
    assert.deepEqual(await loadActiveDays(), ['2026-10-02', '2026-10-03']);
    assert.equal(await recordActiveDay(NaN), 'failed');
  });
  test('a light-day write is bound before a switch of account and reports a refused disk write honestly', async () => {
    const { recordActiveDay, loadActiveDays } = await import('./activity.ts');
    const at = new Date(2026, 9, 2, 12).getTime();
    const writing = recordActiveDay(at);
    const other = nextUid();
    setActiveUser(other);
    assert.equal(await writing, 'failed');
    assert.deepEqual(await loadActiveDays(), []);
    setActiveUser(uid);
    assert.deepEqual(await loadActiveDays(), []);
    (AsyncStorage as unknown as { setItem: () => Promise<void> }).setItem = async () => { throw new Error('unavailable'); };
    assert.equal(await recordActiveDay(at + 86400000), 'failed');
    assert.deepEqual(await loadActiveDays(), []);
  });
});


test('a pending light-day read cannot resurrect a reset account', async () => {
  const { recordActiveDay } = await import('./activity.ts');
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.getItem = async key => { const raw = disk.get(key) ?? null; started(); await delayed; return raw; };
  AsyncStorage.multiRemove = async keys => { for (const key of keys) disk.delete(key); };
  const writing = recordActiveDay();
  await entered;
  await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release();
  assert.equal(await writing, 'failed');
  assert.equal(disk.has(`luvani.u.${uid}.activity`), false);
});

test('reset waits for an already issued light-day disk write before removing data', async () => {
  const { recordActiveDay } = await import('./activity.ts');
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.setItem = async (key, value) => { started(); await delayed; disk.set(key, value); };
  AsyncStorage.multiRemove = async keys => { for (const key of keys) disk.delete(key); };
  const writing = recordActiveDay();
  await entered;
  const resetting = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release();
  await resetting;
  assert.equal(await writing, 'failed');
  assert.equal(disk.has(`luvani.u.${uid}.activity`), false);
});

describe('a finished sitting is a practice day whatever it earned — F731', () => {
  test('a finished sitting that earns no XP still records a practice day', async () => {
    const { dirtyStamp, clearDirty } = await import('../sync/registry.ts');
    const key = `luvani.u.${uid}.activity`;
    const at = new Date(2026, 9, 2, 12).getTime();
    const earlier = dirtyStamp('activity');
    if (earlier !== null) clearDirty('activity', earlier);

    // A drill set worked to its end with nothing right. Before this, the call
    // returned nothing and wrote nothing, so the learner's day vanished from the streak.
    const ack = await recordActivity('drill', 0, at, { durationMs: 600_000, activeMs: 420_000, finished: true });
    assert.equal(ack, 'durable', 'a finished sitting with no XP did not say its day landed');
    assert.deepEqual(await loadActiveDays(), ['2026-10-02'], 'the day of a finished sitting with no XP is missing');
    assert.deepEqual(await loadActivity({ strict: true }), [], 'a sitting with no XP wrote an entry, so XP or minutes could follow it');
    const stamp = dirtyStamp('activity');
    assert.notEqual(stamp, null, 'the new day was not flagged for the account, so another device never hears of it');
    clearDirty('activity', stamp!);

    // The same day again, and a finished conversation with nothing in it: still one day, still no entry.
    assert.equal(await recordActivity('convo', -3, at + 60_000, { finished: true }), 'durable');
    assert.deepEqual(await loadActiveDays(), ['2026-10-02']);
    assert.deepEqual(await loadActivity({ strict: true }), []);

    // A sitting that did earn XP is unchanged: one entry, its day, and now its answer.
    assert.equal(await recordActivity('review', 4, at + 86_400_000), 'durable');
    assert.deepEqual(await loadActiveDays(), ['2026-10-02', '2026-10-03']);
    assert.equal((await loadActivity({ strict: true })).length, 1);

    // What cannot be a sitting records nothing and says so.
    const before = disk.get(key);
    assert.equal(await recordActivity('drill', Number.NaN, at, { finished: true }), 'failed');
    assert.equal(await recordActivity('drill', 0, Number.NaN, { finished: true }), 'failed');
    assert.equal(disk.get(key), before, 'a malformed sitting changed the log');

    // An unreadable log is never replaced with a fresh one, for a day or an entry.
    disk.set(key, '{broken');
    assert.equal(await recordActivity('drill', 0, at, { finished: true }), 'failed');
    assert.equal(await recordActivity('drill', 5, at), 'failed');
    assert.equal(disk.get(key), '{broken');
  });

  test('a sitting left before it finished, with no XP, writes no practice day', async () => {
    const { dirtyStamp, clearDirty } = await import('../sync/registry.ts');
    const key = `luvani.u.${uid}.activity`;
    const at = new Date(2026, 9, 2, 12).getTime();
    const earlier = dirtyStamp('activity');
    if (earlier !== null) clearDirty('activity', earlier);

    // The bank drill records on the way out. Opened and left from the header
    // with nothing answered, it arrives with 0 XP and a measured stay, and it
    // never says it finished. Counting that as a day would be progress the
    // learner did not make.
    assert.equal(await recordActivity('drill', 0, at, { durationMs: 4_000, activeMs: 0 }), 'durable', 'nothing to write is not a failure');
    assert.equal(await recordActivity('drill', 0, at, { durationMs: 4_000, activeMs: 0, finished: false }), 'durable');
    assert.equal(await recordActivity('convo', -1, at), 'durable');
    assert.equal(disk.has(key), false, 'a sitting nobody finished wrote to the log');
    assert.deepEqual(await loadActiveDays(), [], 'a sitting nobody finished became a practice day');
    assert.equal(dirtyStamp('activity'), null, 'a sitting nobody finished was flagged for the account');

    // On a log that already holds a day, it changes nothing either.
    assert.equal(await recordActivity('review', 3, at - 86_400_000), 'durable');
    const bytes = disk.get(key);
    assert.equal(await recordActivity('drill', 0, at, { durationMs: 4_000 }), 'durable');
    assert.equal(disk.get(key), bytes);
    assert.deepEqual(await loadActiveDays(), ['2026-10-01']);
  });
});
