/**
 * The game facts that stay on this phone (F729).
 *
 * Three promises: nothing here ever reaches the account (no adopter, no dirty
 * flag, an exclusion with its reason); the read is strict, so bytes this build
 * would not write are refused rather than repaired; and every list is bounded.
 */

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearActiveUserData, setActiveUser, USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { adopterFor, dirtyStamp, resetSyncRegistry } from '../sync/registry.ts';
import { SYNC_EXCLUSIONS, SYNC_POLICIES } from '../sync/policy.ts';
import {
  MAX_NUDGES,
  MAX_PENDING,
  dropCelebrations,
  enqueueCelebrations,
  loadGameLocal,
  logNudges,
  markIntroduced,
  markNudgeOpened,
  setLastPracticeOffset,
  setNudgesPausedAt,
  setPaidSince,
  setProtectedSince,
  readGameLocal,
  emptyGameLocal,
  updateGameLocal,
} from './gameLocal.ts';

function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;
const AT = Date.UTC(2026, 9, 5, 9);
const DAY = 86_400_000;

let disk: Map<string, string>;
let uid: string;
const key = (): string => `luvani.u.${uid}.gameLocal`;

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

describe('the device-only game facts — F729', () => {
  test('the device-only game facts never reach the account and are cleared with it', async () => {
    assert.ok(USER_KEY_SUFFIXES.includes('gameLocal'), 'a reset would leave this phone\'s game facts behind');
    assert.ok(!SYNC_POLICIES.some((entry) => entry.namespace === 'gameLocal'), 'the phone-only facts are synced');
    assert.match(SYNC_EXCLUSIONS.find((entry) => entry.namespace === 'gameLocal')?.reason ?? '', /facts about this phone/);
    assert.equal(adopterFor('gameLocal') ?? null, null, 'a store that never syncs registered an adopter');

    assert.equal(await setPaidSince('2026-10-01'), 'durable');
    assert.equal(await setLastPracticeOffset(-300), 'durable');
    assert.equal(await markIntroduced(AT), 'durable');
    assert.equal(dirtyStamp('gameLocal'), null, 'a phone-only write was flagged for the account');
    const local = await loadGameLocal();
    assert.equal(local.paidSince, '2026-10-01');
    assert.equal(local.lastPracticeOffsetMin, -300);
    assert.equal(local.introducedAt, AT);
    // Introduced once: a second call keeps the first moment.
    assert.equal(await markIntroduced(AT + DAY), 'durable');
    assert.equal((await loadGameLocal()).introducedAt, AT);

    await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
    assert.equal(disk.has(key()), false, 'a reset left the phone-only game facts behind');
  });

  test('protectedSince (D23) is stored, and a record written before it reads as null rather than refused', async () => {
    assert.equal(await setProtectedSince('2026-10-02'), 'durable');
    assert.equal((await loadGameLocal()).protectedSince, '2026-10-02');
    const { protectedSince: _absent, ...before } = { ...emptyGameLocal(), paidSince: '2026-10-01' };
    const read = readGameLocal(before);
    assert.ok(read, 'a version 1 record from before protectedSince was refused');
    assert.equal(read.protectedSince, null);
    assert.equal(read.paidSince, '2026-10-01');
    disk.set(key(), JSON.stringify(before));
    assert.equal((await loadGameLocal()).protectedSince, null);
    assert.equal(await setProtectedSince('2026-10-03'), 'durable', 'an old record could not take the new key');
    assert.equal((await loadGameLocal()).protectedSince, '2026-10-03');
    assert.equal(readGameLocal({ ...emptyGameLocal(), protectedSince: 'tomorrow' }), null, 'a malformed day was repaired');
    assert.equal(readGameLocal({ ...emptyGameLocal(), surprise: 1 }), null, 'an unknown key was accepted');
  });

  test('the device-only game facts refuse unknown bytes and stay bounded', async () => {
    // One nudge a day, the newest plan for it, an opening never forgotten, the last thirty days.
    const nudge = (d: number) => ({ day: new Date(AT + d * DAY).toISOString().slice(0, 10), fireAt: AT + d * DAY, variant: 'routine' as const });
    assert.equal(await logNudges(Array.from({ length: MAX_NUDGES + 10 }, (_, d) => nudge(d))), 'durable');
    const last = nudge(MAX_NUDGES + 9);
    assert.equal(await markNudgeOpened(last.day), 'durable');
    assert.equal(await logNudges([{ ...last, variant: 'streak', fireAt: last.fireAt + 60_000 }]), 'durable');
    const nudges = (await loadGameLocal()).nudges;
    assert.equal(nudges.length, MAX_NUDGES);
    assert.deepEqual(nudges.at(-1), { ...last, variant: 'streak', fireAt: last.fireAt + 60_000, opened: true });

    // A batch the ceiling would cut is refused whole and says so: a moment the
    // queue did not keep must never be reported as kept for a crash to replay.
    const beforeBatch = disk.get(key());
    const queued = (count: number) => Array.from({ length: count }, (_, n) => ({ key: `level:${n + 2}`, at: AT + n }));
    assert.equal(await enqueueCelebrations(queued(MAX_PENDING + 4)), 'failed', 'celebrations cut by the ceiling were reported as saved');
    assert.equal(disk.get(key()), beforeBatch, 'a refused batch was written in part');
    // Up to the ceiling, every one waits, once each, oldest first.
    assert.equal(await enqueueCelebrations(queued(MAX_PENDING)), 'durable');
    // A newer moment pushes the oldest out; one older than every waiting moment is refused.
    assert.equal(await enqueueCelebrations([{ key: `level:${MAX_PENDING + 5}`, at: AT + 999_999 }]), 'durable');
    const full = disk.get(key());
    assert.equal(await enqueueCelebrations([{ key: 'badge:streak-7', at: AT - 1 }]), 'failed', 'a moment the ceiling cut was reported as saved');
    assert.equal(disk.get(key()), full);
    // One already waiting is held, so queueing it again is no failure.
    assert.equal(await enqueueCelebrations([{ key: 'level:3', at: AT + 1 }]), 'durable');
    assert.equal(await enqueueCelebrations([]), 'durable', 'nothing offered is nothing to fail');
    const pending = (await loadGameLocal()).pending;
    assert.equal(pending.length, MAX_PENDING);
    assert.equal(pending[0]?.key, 'level:3');
    assert.equal(pending.at(-1)?.key, `level:${MAX_PENDING + 5}`);
    assert.equal(await dropCelebrations([`level:${MAX_PENDING + 5}`]), 'durable');
    assert.ok(!(await loadGameLocal()).pending.some((row) => row.key === `level:${MAX_PENDING + 5}`));

    // A write the reader would refuse is never made.
    const good = disk.get(key())!;
    assert.equal(await setLastPracticeOffset(60 * 24), 'failed', 'an offset no time zone has was stored');
    assert.equal(await setPaidSince('2026-02-30'), 'failed');
    assert.equal(await setNudgesPausedAt(Number.NaN), 'failed');
    assert.equal(await updateGameLocal((g) => ({ ...g, extra: true }) as never), 'failed');
    assert.equal(disk.get(key()), good);

    // Bytes on the disk this build would not write are refused, never repaired.
    for (const bytes of [{ ...JSON.parse(good), version: 2 }, { ...JSON.parse(good), nudges: [{ day: 'today', fireAt: AT, variant: 'routine' }] }, { ...JSON.parse(good), pending: 'all' }, '{broken']) {
      const raw = typeof bytes === 'string' ? bytes : JSON.stringify(bytes);
      disk.set(key(), raw);
      await assert.rejects(loadGameLocal(), /unreadable/);
      assert.equal(await setNudgesPausedAt(AT), 'failed');
      assert.equal(disk.get(key()), raw);
    }
  });
});
