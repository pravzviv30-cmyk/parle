/**
 * The goal-step store on this device (Stage 4, 2026-09-25).
 *
 * Contract test 5: a row recorded twice is one row and one dirty flag; an
 * invalid row answers `failed` and writes nothing; an account switch or a data
 * reset between enqueue and drain lands nothing anywhere; the adopter declines
 * a fold it cannot read and does not raise the flag for one it can.
 *
 * Contract test 11: the self-report is honest by construction. Recording that
 * the learner used a conversation outside the app moves `goalSteps` and
 * nothing else: every other learning store's raw bytes are unchanged.
 */

import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearActiveUserData, setActiveUser } from '../storage/scope.ts';
import { adopterFor, clearDirty, dirtyStamp, resetSyncRegistry } from '../sync/registry.ts';
import { factKey } from '../profile/memory.ts';
import { loadGoalSteps, recordGoalStepStarted, recordUsedOutside } from './store.ts';

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
  shared.multiSet = (pairs: [string, string][]): Promise<void> => {
    for (const [key, value] of pairs) map.set(key, value);
    return Promise.resolve();
  };
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `22222222-2222-4222-8222-${String(++uids).padStart(12, '0')}`;

const SESSION = '3f1c2a9e-6b1d-4a0e-9c55-1f2e3d4c5b6a';
const GOAL = factKey('Order a coffee in Paris');

let disk: Map<string, string>;
let uid: string;
const key = (suffix = 'goalSteps', who = uid): string => `luvani.u.${who}.${suffix}`;

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

describe('the goal-step store — contract test 5', () => {
  test('recording the same step twice is one row and one dirty flag', async () => {
    const step = { sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 1_700_000_000_000 };
    assert.equal(await recordGoalStepStarted(step), 'durable');
    const stamp = dirtyStamp('goalSteps');
    assert.notEqual(stamp, null, 'a local write did not raise the flag, so it would never be pushed');
    const bytes = disk.get(key());

    assert.equal(await recordGoalStepStarted({ ...step, at: step.at + 5 }), 'durable', 'the second record did not answer durable');
    assert.equal(dirtyStamp('goalSteps'), stamp, 'a replay raised the flag again');
    assert.equal(disk.get(key()), bytes, 'a replay wrote to the disk');
    assert.equal((await loadGoalSteps()).length, 1);

    // The self-report is idempotent the same way.
    assert.equal(await recordUsedOutside({ stepId: SESSION, goalKey: GOAL, at: step.at + 10 }), 'durable');
    const second = dirtyStamp('goalSteps');
    assert.equal(await recordUsedOutside({ stepId: SESSION, goalKey: GOAL, at: step.at + 20 }), 'durable');
    assert.equal(dirtyStamp('goalSteps'), second);
    const rows = await loadGoalSteps();
    assert.deepEqual(rows.map((row) => row.kind), ['step-started', 'used-outside']);
    assert.equal(rows[1]!.id, `u.${SESSION}`);
  });

  test('an invalid row answers failed and writes nothing', async () => {
    for (const bad of [
      { sessionId: 'not a pack id', goalKey: GOAL, task: 'mission:cafe', at: 5 },
      { sessionId: SESSION, goalKey: 'Not Normalised', task: 'mission:cafe', at: 5 },
      { sessionId: SESSION, goalKey: GOAL, task: 'mission:a sentence', at: 5 },
      { sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 0 },
    ]) {
      assert.equal(await recordGoalStepStarted(bad), 'failed', `${JSON.stringify(bad)} was accepted`);
    }
    assert.equal(await recordUsedOutside({ stepId: 'bad id', goalKey: GOAL, at: 5 }), 'failed');
    assert.equal(disk.has(key()), false, 'an invalid row reached the disk');
    assert.equal(dirtyStamp('goalSteps'), null, 'an invalid row raised the flag');
  });

  test('an account switch between enqueue and drain lands nothing in either account', async () => {
    const inFlight = recordGoalStepStarted({ sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 5 });
    const next = nextUid();
    setActiveUser(next);
    assert.equal(await inFlight, 'failed', 'a write bound to the old account claimed to be durable');
    assert.equal(disk.has(key('goalSteps', uid)), false, 'the write landed in the account that asked after it signed out');
    assert.equal(disk.has(key('goalSteps', next)), false, 'the write landed in the account that signed in after it');
  });

  test('a data reset after enqueue refuses the write, so a deleted namespace is not brought back', async () => {
    const inFlight = recordUsedOutside({ stepId: SESSION, goalKey: GOAL, at: 5 });
    await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }), alarm: () => {} });
    assert.equal(await inFlight, 'failed');
    assert.equal(disk.has(key()), false, 'a write queued before the reset landed after it');
  });

  test('the adopter declines an unreadable fold and adopts a good one without raising the flag', async () => {
    await recordGoalStepStarted({ sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 5 });
    clearDirty('goalSteps', dirtyStamp('goalSteps')!);
    const before = disk.get(key());
    const adopt = adopterFor('goalSteps');
    assert.ok(adopt, 'goalSteps registered no adopter, so a merge can never come back');

    for (const junk of [{ version: 2, steps: [] }, 'nonsense', null]) {
      assert.equal(await adopt(() => junk), 'declined');
      assert.equal(disk.get(key()), before, 'an unreadable fold overwrote good local data');
    }

    const seen: unknown[] = [];
    const reply = await adopt((current) => {
      seen.push(current);
      return {
        version: 1,
        steps: [
          { kind: 'step-started', id: SESSION, at: 5, goalKey: GOAL, task: 'mission:cafe' },
          { kind: 'used-outside', id: `u.${SESSION}`, at: 9, goalKey: GOAL },
        ],
      };
    });
    assert.equal(reply, 'adopted');
    assert.deepEqual(seen[0], JSON.parse(before!), 'the fold was handed something other than the disk');
    assert.equal((await loadGoalSteps()).length, 2);
    assert.equal(dirtyStamp('goalSteps'), null, 'adopting raised the flag, which is a pointless push cycle');
  });

  test('a disk written by a newer build refuses local writes and visible reads', async () => {
    disk.set(key(), JSON.stringify({ version: 2, steps: [] }));
    assert.equal(await recordGoalStepStarted({ sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 5 }), 'failed');
    await assert.rejects(loadGoalSteps());
    assert.equal(disk.get(key()), JSON.stringify({ version: 2, steps: [] }), 'an older build wrote over a newer disk');
  });
});

describe('the self-report touches nothing else — contract test 11', () => {
  test('recording used-outside leaves every other learning store byte-identical, and moves only goalSteps', async () => {
    const seeded: Record<string, string> = {
      activity: JSON.stringify({ version: 2, entries: [{ at: 1, kind: 'convo', xp: 12, activeMs: 60_000 }], backfilled: true }),
      review: JSON.stringify([{ id: 'phrase:merci', kind: 'vocab', front: 'Merci', back: 'thanks', context: '', ipa: '', addedAt: 1, due: 0, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 }]),
      drills: JSON.stringify({ version: 1, exercises: [], micSuppressedUntil: null }),
      practiceHistory: JSON.stringify({ version: 1, events: [], floor: 0 }),
      missions: JSON.stringify({ version: 1, completions: [{ id: 'mission:cafe', at: 1, rung: 2 }] }),
      history: JSON.stringify([{ endedAt: 1, summary: { lessonId: 'cafe' } }]),
      profile: JSON.stringify({ version: 8, name: 'Camille' }),
      soundChecks: JSON.stringify({ version: 1, evidence: [] }),
    };
    for (const [suffix, raw] of Object.entries(seeded)) disk.set(key(suffix), raw);
    await recordGoalStepStarted({ sessionId: SESSION, goalKey: GOAL, task: 'mission:cafe', at: 5 });
    const others = ['activity', 'review', 'drills', 'practiceHistory', 'missions', 'history', 'profile', 'soundChecks'];
    const stampsBefore = Object.fromEntries(others.map((suffix) => [suffix, dirtyStamp(suffix)]));
    const goalStampBefore = dirtyStamp('goalSteps');
    const keysBefore = [...disk.keys()].sort();

    assert.equal(await recordUsedOutside({ stepId: SESSION, goalKey: GOAL, at: 9 }), 'durable');

    for (const [suffix, raw] of Object.entries(seeded)) {
      assert.equal(disk.get(key(suffix)), raw, `the self-report changed ${suffix}; a report is not practice, XP, a grade or a card`);
      assert.equal(dirtyStamp(suffix), stampsBefore[suffix], `the self-report dirtied ${suffix}`);
    }
    assert.deepEqual([...disk.keys()].sort(), keysBefore, 'the self-report created a key of its own beside goalSteps');
    assert.notEqual(dirtyStamp('goalSteps'), goalStampBefore, 'the self-report did not move goalSteps');
  });
});
