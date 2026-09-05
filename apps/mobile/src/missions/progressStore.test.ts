/**
 * Where a learner left a scene: one row per mission, cleared by the finish.
 *
 * Three things have to hold together, and each one is a way the tutor's resume
 * door could tell a learner something untrue. A second walk-out of the same
 * scene has to replace the first, or the door offers the older, further-back
 * place. Finishing the mission has to clear the record, or the door claims
 * minutes remaining on a scene the learner has already come out the far side
 * of. And a fold has to keep the newer of two devices' accounts, because the
 * device that has not been opened in a week is the one with the stale one.
 *
 * The storage double is the one storeBinding.test.ts uses.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveUser } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { sameData } from '../sync/envelope.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import {
  clearScenarioProgress,
  loadScenarioProgress,
  recordScenarioProgress,
  type ScenarioRecord,
} from './progressStore.ts';
import { recordMissionCompletion } from './store.ts';

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
const nextUid = (): string => `33333333-3333-4333-8333-${String(++uids).padStart(12, '0')}`;

let disk: Map<string, string>;
let uid: string;

beforeEach(() => {
  disk = installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

const policy = createSyncPolicy({ now: () => Date.UTC(2026, 8, 4, 12, 0, 0) });

function merge(local: unknown, remote: unknown): unknown {
  const result = policy.merge({ namespace: 'scenarioProgress', local, remote });
  return result.kind === 'merged' ? result.data : `quiet:${result.reason}`;
}

const record = (missionId: string, at: number, elapsedMs: number, beatsDone: number): ScenarioRecord => ({
  missionId,
  at,
  elapsedMs,
  beatsDone,
});

describe('the record of a scene left part way through', () => {
  test('a partial scene record replaces its older self, is cleared by the finish, and survives a fold — F401', async () => {
    // ── 1. One record per mission, the newer walk-out replacing the older one.
    await recordScenarioProgress(record('cafe-order', 1_000, 60_000, 1));
    await recordScenarioProgress(record('market', 1_500, 30_000, 1));
    await recordScenarioProgress(record('cafe-order', 2_000, 240_000, 4));

    const held = await loadScenarioProgress();
    assert.deepEqual(
      held.filter((row) => row.missionId === 'cafe-order'),
      [record('cafe-order', 2_000, 240_000, 4)],
      'the scene the learner left twice kept two rows, so the resume door has two places to offer',
    );
    assert.equal(held.length, 2, 'replacing one mission took another mission down with it');

    // A record older than the one on disk changes nothing: a write that lands late
    // must not undo a fresher one.
    await recordScenarioProgress(record('cafe-order', 1_200, 90_000, 2));
    assert.deepEqual(
      (await loadScenarioProgress()).filter((row) => row.missionId === 'cafe-order'),
      [record('cafe-order', 2_000, 240_000, 4)],
      'an older walk-out overwrote a newer one',
    );

    // ── 2. Nothing derived is stored. `beatsTotal` lives in the catalogue, so two
    //     devices cannot disagree about how long the scene is.
    for (const row of await loadScenarioProgress()) {
      assert.deepEqual(
        Object.keys(row).sort(),
        ['at', 'beatsDone', 'elapsedMs', 'missionId'],
        'the record grew a field, and anything beyond these four is derived from them',
      );
    }

    // ── 3. Finishing the scene clears its record and leaves every other one.
    await recordMissionCompletion('cafe-order', 3, 3_000);
    assert.deepEqual(
      (await loadScenarioProgress()).map((row) => row.missionId),
      ['market'],
      'a finished mission still claims minutes remaining, from a walk-out the learner has since finished past',
    );

    // A finish for a mission nobody left part way writes nothing at all, so it
    // cannot create an empty row for an account that has never used this store.
    const untouched = nextUid();
    setActiveUser(untouched);
    await recordMissionCompletion('bakery', 2, 4_000);
    assert.equal(
      disk.has(`luvani.u.${untouched}.scenarioProgress`),
      false,
      'a finish created a scene-progress row for an account that never left a scene',
    );

    // ── 4. A clear on the account that has one is a real removal.
    setActiveUser(uid);
    await clearScenarioProgress('market');
    assert.deepEqual(await loadScenarioProgress(), [], 'clearing the last record left it behind');

    // ── 5. The fold. Two devices holding their own account of the same scene, and
    //     the newer one wins whichever side asks.
    const stale = { version: 1, records: [record('cafe-order', 1_000, 60_000, 1)] };
    const fresh = {
      version: 1,
      records: [record('cafe-order', 2_000, 240_000, 4), record('market', 1_500, 30_000, 1)],
    };

    const forward = merge(stale, fresh);
    const backward = merge(fresh, stale);
    assert.ok(sameData(forward, backward), 'the answer depends on which device asked');
    assert.deepEqual(
      (forward as { records: ScenarioRecord[] }).records,
      [record('market', 1_500, 30_000, 1), record('cafe-order', 2_000, 240_000, 4)],
      'the fold either lost a mission or kept the stale account of one',
    );
    assert.ok(sameData(merge(forward, stale), forward), 'the records keep moving after both sides agree');
  });
});
