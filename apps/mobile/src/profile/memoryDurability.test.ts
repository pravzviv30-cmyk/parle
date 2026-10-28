import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveUser, userKey, clearActiveUserData, onUserScopeCleanup } from '../storage/scope.ts';
import { adopterFor } from '../sync/registry.ts';
import { createStoredProfile, loadProfile, saveProfile, saveMemoryChange } from './store.ts';
import { withMemoryPaused, withFactForgotten } from './memory.ts';

test('memory controls acknowledge only durable writes; refusal keeps cold-reloaded memory unchanged and retry succeeds', async () => {
  await setActiveUser('memory-ack-fixture');
  const disk = new Map<string, string>();
  let refuse = false;
  const store = AsyncStorage as unknown as Record<string, unknown>;
  store.getItem = async (key: string) => disk.get(key) ?? null;
  store.setItem = async (key: string, value: string) => {
    if (refuse && key === userKey('profile')) throw new Error('synthetic storage refusal');
    disk.set(key, value);
  };
  const profile = createStoredProfile({ name: 'James', motivation: null }, 1000);
  profile.brain.memory.facts = [{ kind: 'interest', en: 'Likes jazz', fr: null, happensAround: null, notedAt: '2026-01-01', source: 'conversation', updatedAt: '2026-01-01' }];
  assert.equal(await saveProfile(profile), true);
  refuse = true;
  assert.equal(await saveMemoryChange((current) => withMemoryPaused(current, true, 2000)), null);
  assert.equal((await loadProfile())?.brain.memory.control, undefined);
  assert.equal(await saveMemoryChange((current) => withFactForgotten(current, 'Likes jazz')), null);
  assert.equal((await loadProfile())?.brain.memory.facts.length, 1);
  const adopter = adopterFor('profile');
  assert.ok(adopter);
  await assert.rejects(adopter(() => withMemoryPaused(profile, true, 2000)), /could not be saved/);
  assert.equal((await loadProfile())?.brain.memory.control, undefined);
  refuse = false;
  const saved = await saveMemoryChange((current) => withMemoryPaused(withFactForgotten(current, 'Likes jazz'), true, 2000));
  assert.ok(saved);
  assert.equal((await loadProfile())?.brain.memory.control?.paused, true);
  assert.deepEqual((await loadProfile())?.brain.memory.facts, []);
  // An older whole-profile recap/save cannot overwrite the acknowledged
  // privacy choice even if it was queued before the screen updated.
  assert.equal(await saveProfile(profile), true);
  const reloaded = await loadProfile();
  assert.ok(reloaded);
  assert.equal(reloaded.brain.memory.control?.paused, true);
  assert.deepEqual(reloaded.brain.memory.facts, []);
  assert.deepEqual(reloaded.forgottenFacts, ['likes jazz']);
});

test('reset waits for every profile native-bridge write before removing the account keys', async () => {
  for (const action of ['save', 'memory', 'adopt'] as const) {
    setActiveUser(`memory-reset-${action}`);
    const key = userKey('profile');
    const profile = createStoredProfile({ name: 'James', motivation: null }, 1000);
    const disk = new Map([[key, JSON.stringify(profile)]]);
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const store = AsyncStorage as unknown as Record<string, unknown>;
    store.getItem = async (name: string) => disk.get(name) ?? null;
    store.setItem = async (name: string, value: string) => {
      if (name === key) { entered(); await held; }
      disk.set(name, value);
    };
    store.multiRemove = async (names: string[]) => { for (const name of names) disk.delete(name); };
    const adopter = adopterFor('profile')!;
    const write = action === 'save' ? saveProfile(profile)
      : action === 'memory' ? saveMemoryChange((current) => withMemoryPaused(current, true, 2000))
      : adopter(() => withMemoryPaused(profile, true, 2000));
    // Attach the rejection handler before reset can cause an adoption to refuse.
    const result = Promise.resolve(write).catch(() => 'refused');
    await started;
    let cleared = false;
    const reset = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) }).then(() => { cleared = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cleared, false, `${action}: reset must await the pending native write`);
    release();
    await result;
    await reset;
    assert.equal(disk.has(key), false, `${action}: the old profile was resurrected after reset`);
  }
});

test('profile writes started during reset are refused, including reads that finish after removal', async () => {
  setActiveUser('memory-reset-new-work');
  const key = userKey('profile');
  const profile = createStoredProfile({ name: 'James', motivation: null }, 1000);
  const disk = new Map([[key, JSON.stringify(profile)]]);
  let releaseCleanup!: () => void;
  let cleanupStarted!: () => void;
  let releaseRead!: () => void;
  let readStarted!: () => void;
  let holdCleanup = true;
  let holdRead = false;
  const cleanupHeld = new Promise<void>((resolve) => { releaseCleanup = resolve; });
  const cleanupEntered = new Promise<void>((resolve) => { cleanupStarted = resolve; });
  const readHeld = new Promise<void>((resolve) => { releaseRead = resolve; });
  const readEntered = new Promise<void>((resolve) => { readStarted = resolve; });
  onUserScopeCleanup(async () => {
    if (holdCleanup) { cleanupStarted(); await cleanupHeld; }
  });
  const store = AsyncStorage as unknown as Record<string, unknown>;
  let writes = 0;
  store.getItem = async (name: string) => {
    const value = disk.get(name) ?? null;
    if (holdRead) { readStarted(); await readHeld; }
    return value;
  };
  store.setItem = async (name: string, value: string) => { writes += 1; disk.set(name, value); };
  store.multiRemove = async (names: string[]) => { for (const name of names) disk.delete(name); };
  const reset = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  await cleanupEntered;
  assert.equal(await saveProfile(profile), false);
  assert.equal(await saveMemoryChange((current) => withMemoryPaused(current, true, 2000)), null);
  await assert.rejects(adopterFor('profile')!(() => profile), /could not be saved/);
  holdRead = true;
  const delayed = saveProfile(profile);
  await readEntered;
  holdCleanup = false;
  releaseCleanup();
  await reset;
  releaseRead();
  assert.equal(await delayed, false);
  assert.equal(writes, 0);
  assert.equal(disk.has(key), false);
  holdRead = false;
  assert.equal(await saveProfile(profile), true, 'a completed reset releases the write fence');
});
