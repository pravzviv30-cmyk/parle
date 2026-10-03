import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { adopterFor } from '../sync/registry.ts';
import { clearActiveUserData, setActiveUser, userKey } from '../storage/scope.ts';
import { COMPLETIONS_PER_MISSION, loadMissionCompletions, recordMissionCompletion } from './store.ts';

const source = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8');

describe('mission completion history', () => {
  test('keeps prior finishes so best independence and repeat count remain evidence', () => {
    const writer = source.slice(source.indexOf('export function recordMissionCompletion'));
    assert.doesNotMatch(writer, /existing\.filter\(\(c\) => c\.id !== id\), \{ id, at, rung \}/);
    assert.match(writer, /existing\.filter\(\(c\) => c\.id === id\)/);
    assert.match(writer, /retainCompletions\(/);
    assert.match(writer, /COMPLETIONS_PER_MISSION/);
  });

  test('bounds the retained history', () => {
    assert.equal(COMPLETIONS_PER_MISSION, 20);
  });
});


test('recap history waits for the current mission win to reach disk', async () => {
  setActiveUser('mission-recap-review');
  const disk = new Map<string, string>();
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.getItem = async key => disk.get(key) ?? null;
  AsyncStorage.setItem = async (key, value) => {
    if (key.endsWith('.missions')) { started(); await delayed; }
    disk.set(key, value);
  };
  AsyncStorage.removeItem = async key => { disk.delete(key); };
  const saving = recordMissionCompletion('cafe-order', 4, 100);
  await entered;
  const recapRead = loadMissionCompletions({ strict: true });
  release();
  await saving;
  assert.deepEqual(await recapRead, [{ id: 'cafe-order', rung: 4, at: 100 }]);
});

test('a visible mission read distinguishes absence from corrupt or refused history', async () => {
  setActiveUser('mission-read-honesty');
  const disk = new Map<string, string>();
  const key = userKey('missions');
  AsyncStorage.getItem = async name => disk.get(name) ?? null;
  assert.deepEqual(await loadMissionCompletions(), [], 'an absent account key is a legitimate fresh path');
  disk.set(key, JSON.stringify({ version: 1, completions: [{ id: 'mission:cafe', at: 10, rung: 4 }] }));
  assert.deepEqual(await loadMissionCompletions(), [{ id: 'mission:cafe', at: 10, rung: 4 }]);
  disk.set(key, JSON.stringify({ version: 1, completions: [{ id: 'mission:cafe', at: 10, rung: 'four' }] }));
  await assert.rejects(loadMissionCompletions(), /unreadable/);
  disk.set(key, '{broken');
  await assert.rejects(loadMissionCompletions());
  AsyncStorage.getItem = async () => { throw new Error('device refused'); };
  await assert.rejects(loadMissionCompletions(), /device refused/);
});

test('erase waits for a dispatched mission write and stale queued wins cannot recreate it', async () => {
  setActiveUser('mission-reset-race');
  const disk = new Map<string, string>();
  let entered!: () => void;
  let release!: () => void;
  const dispatched = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  AsyncStorage.getItem = async key => disk.get(key) ?? null;
  AsyncStorage.setItem = async (key, value) => {
    if (key.endsWith('.missions')) { entered(); await held; }
    disk.set(key, value);
  };
  AsyncStorage.multiRemove = async keys => { for (const key of keys) disk.delete(key); };
  const first = recordMissionCompletion('mission:cafe', 4, 100);
  await dispatched;
  const queued = recordMissionCompletion('mission:cafe', 4, 101);
  const erasing = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  release();
  await Promise.all([first, queued, erasing]);
  assert.equal(disk.has(userKey('missions')), false);
});

test('a mission write does not replace unreadable existing wins with a fresh list', async () => {
  setActiveUser('mission-corrupt-write');
  const key = userKey('missions');
  const disk = new Map([[key, '{broken']]);
  AsyncStorage.getItem = async name => disk.get(name) ?? null;
  AsyncStorage.setItem = async (name, value) => { disk.set(name, value); };
  await recordMissionCompletion('mission:cafe', 4, 10);
  assert.equal(await adopterFor('missions')!(() => ({ version: 1, completions: [{ id: 'mission:cafe', at: 10, rung: 4 }] })), 'declined');
  assert.equal(disk.get(key), '{broken');
});

test('mission sync adoption declines when the device refuses its write', async () => {
  setActiveUser('mission-adoption-refused');
  AsyncStorage.getItem = async () => null;
  AsyncStorage.setItem = async () => { throw new Error('device refused'); };
  const adopt = adopterFor('missions');
  assert.ok(adopt);
  assert.equal(await adopt(() => ({ version: 1, completions: [{ id: 'mission:cafe', at: 10, rung: 4 }] })), 'declined');
});
