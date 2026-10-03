/**
 * What a stored sound check survives.
 *
 * F468 added `phoneme` to the record so a later screen can look the sound up
 * instead of only printing a sentence about it. The dangerous way to do that is
 * a version bump: this store has no upgrade function, `read` returns an empty
 * array on a version it does not recognise, and every learner keeps up to sixty
 * checks. So the key is nullable at `version: 1`, and this is the test that
 * says so out loud — it fails the moment somebody bumps the constant.
 */

import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adopterFor } from '../sync/registry.ts';

import { clearActiveUserData, setActiveUser, userKey } from '../storage/scope.ts';
import { loadSoundChecks, recordSoundCheck } from './store.ts';

/** Give the shared AsyncStorage module an implementation for this test. */
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

let disk: Map<string, string>;

beforeEach(() => {
  disk = installDisk();
  setActiveUser('learner-1');
});

describe('a sound check written before it knew the sound — F468', () => {
  test('a row with no phoneme at all is kept, not discarded', () => {
    // This is the whole argument for a nullable key over a version bump. The
    // row below is exactly what a build before F468 wrote.
    const old = {
      version: 1,
      evidence: [{ missionId: 'mission:cafe', reference: 'Un café, s’il vous plaît', at: 10, kind: 'assessed-focus', focus: 'The u in tu is worth another go' }],
    };
    disk.set(userKey('soundChecks'), JSON.stringify(old));

    return loadSoundChecks().then((kept) => {
      assert.equal(kept.length, 1, 'a check written before the key existed was thrown away');
      assert.equal(kept[0]?.focus, 'The u in tu is worth another go');
    });
  });

  test('an old row and a new one live side by side', () => {
    disk.set(
      userKey('soundChecks'),
      JSON.stringify({
        version: 1,
        evidence: [{ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'assessed-clear', focus: null }],
      }),
    );

    return recordSoundCheck({ missionId: 'mission:cafe', reference: 'b', at: 20, kind: 'assessed-focus', focus: 'one sound', phoneme: 'y' })
      .then(() => loadSoundChecks())
      .then((kept) => {
        assert.equal(kept.length, 2, 'writing a row with a phoneme dropped the row without one');
        assert.equal(kept.find((item) => item.reference === 'b')?.phoneme, 'y');
      });
  });

  test('a row carrying junk where the phoneme goes is refused, not trusted', () => {
    disk.set(
      userKey('soundChecks'),
      JSON.stringify({
        version: 1,
        evidence: [{ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'assessed-clear', focus: null, phoneme: 7 }],
      }),
    );

    return loadSoundChecks().then((kept) => {
      assert.deepEqual(kept, [], 'a number was accepted as a phoneme symbol');
    });
  });
});

test('a visible sound-check read distinguishes absence from corrupt or refused evidence', async () => {
  assert.deepEqual(await loadSoundChecks({ strict: true }), []);
  disk.set(userKey('soundChecks'), JSON.stringify({ version: 1, evidence: [{ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'assessed-focus', focus: null }] }));
  assert.equal((await loadSoundChecks({ strict: true })).length, 1, 'legacy evidence without a phoneme remains valid');
  disk.set(userKey('soundChecks'), JSON.stringify({ version: 1, evidence: [{ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'assessed-focus', focus: null, phoneme: 7 }] }));
  await assert.rejects(loadSoundChecks({ strict: true }), /unreadable/);
  disk.set(userKey('soundChecks'), '{broken');
  await assert.rejects(loadSoundChecks({ strict: true }));
  AsyncStorage.getItem = async () => { throw new Error('device refused'); };
  await assert.rejects(loadSoundChecks({ strict: true }), /device refused/);
});

test('erase waits for a dispatched sound-check write and stale queued checks cannot recreate it', async () => {
  let entered!: () => void;
  let release!: () => void;
  const dispatched = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.setItem = async (key, value) => { entered(); await held; disk.set(key, value); };
  AsyncStorage.multiRemove = async keys => { for (const key of keys) disk.delete(key); };
  const first = recordSoundCheck({ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'self-guided', focus: null, phoneme: null });
  await dispatched;
  const queued = recordSoundCheck({ missionId: 'mission:cafe', reference: 'b', at: 11, kind: 'self-guided', focus: null, phoneme: null });
  const erasing = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release();
  await Promise.all([first, queued, erasing]);
  assert.equal(disk.has(userKey('soundChecks')), false);
});

test('a sound-check write does not replace unreadable existing evidence with a fresh list', async () => {
  const key = userKey('soundChecks');
  disk.set(key, '{broken');
  await recordSoundCheck({ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'self-guided', focus: null, phoneme: null });
  assert.equal(await adopterFor('soundChecks')!(() => ({ version: 1, evidence: [] })), 'declined');
  assert.equal(disk.get(key), '{broken');
});

test('sound-check sync adoption declines when the device refuses its write', async () => {
  AsyncStorage.setItem = async () => { throw new Error('device refused'); };
  const adopt = adopterFor('soundChecks');
  assert.ok(adopt);
  assert.equal(await adopt(() => ({ version: 1, evidence: [{ missionId: 'mission:cafe', reference: 'a', at: 10, kind: 'self-guided', focus: null, phoneme: null }] })), 'declined');
});
