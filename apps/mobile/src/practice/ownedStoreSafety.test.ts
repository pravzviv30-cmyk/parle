import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DRILL_FIXTURES } from '@luvani/core';

import { clearActiveUserData, setActiveUser, userKey } from '../storage/scope.ts';
import { adopterFor } from '../sync/registry.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadPackMarks, markPackPractised } from '../conversationPacks/marks.ts';
import { loadTopics } from '../topics/store.ts';
import { loadPracticeHistory } from './historyStore.ts';

const storage = AsyncStorage as unknown as Record<string, unknown>;
const disk = new Map<string, string>();
let nextAccount = 0;

function installDisk(): void {
  disk.clear();
  storage.getItem = async (key: string) => disk.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { disk.set(key, value); };
  storage.multiRemove = async (keys: string[]) => { for (const key of keys) disk.delete(key); };
}

function account(): void {
  setActiveUser(`owned-store-${++nextAccount}`);
}

const readers = [
  { suffix: 'practiceHistory', load: loadPracticeHistory, empty: { version: 1, events: [], floor: 0 } },
  { suffix: 'drills', load: loadDrillBank, empty: { version: 1, exercises: [], micSuppressedUntil: null } },
  { suffix: 'packMarks', load: loadPackMarks, empty: { version: 1, marks: [] } },
  { suffix: 'topics', load: loadTopics, empty: { version: 1, topics: [] } },
] as const;

test('practice history, bank, pack marks and topics distinguish absent from unreadable owned keys', async () => {
  installDisk();
  for (const reader of readers) {
    account();
    const key = userKey(reader.suffix);
    const absent = await reader.load();
    if (reader.suffix === 'drills') assert.equal(absent.length, DRILL_FIXTURES.length, 'a first install keeps authored drill fixtures');
    else assert.deepEqual(absent, [], `${reader.suffix}: absent should be empty`);
    for (const raw of [JSON.stringify(reader.empty), '{', JSON.stringify({ ...reader.empty, version: 99 })]) {
      account();
      const scoped = userKey(reader.suffix);
      disk.set(scoped, raw);
      if (raw === JSON.stringify(reader.empty)) await reader.load();
      else await assert.rejects(reader.load(), `${reader.suffix}: unreadable material was presented as empty`);
      assert.equal(disk.get(scoped), raw, `${reader.suffix}: a read rewrote the key`);
    }
    account();
    storage.getItem = async () => { throw new Error('native read refused'); };
    await assert.rejects(reader.load(), /native read refused|could not be read|Saved material/, `${reader.suffix}: a refused read was presented as empty`);
    storage.getItem = async (at: string) => disk.get(at) ?? null;
    assert.ok(key.includes(reader.suffix));
  }
});

test('unreadable local stores cannot be adopted as absent, and refused adoption is not acknowledged', async () => {
  installDisk();
  for (const reader of readers.filter(item => item.suffix !== 'packMarks')) {
    account();
    const adopt = adopterFor(reader.suffix);
    assert.ok(adopt, `${reader.suffix} has no sync adopter`);
    const key = userKey(reader.suffix);
    disk.set(key, '{');
    let folded = false;
    await assert.rejects(adopt(() => { folded = true; return reader.empty; }));
    assert.equal(folded, false, `${reader.suffix}: corrupt local bytes were passed to the fold as absent`);
    assert.equal(disk.get(key), '{');
    disk.delete(key);
    storage.setItem = async () => { throw new Error('native write refused'); };
    await assert.rejects(adopt(() => reader.empty), /not durable/);
    storage.setItem = async (at: string, value: string) => { disk.set(at, value); };
  }
});

test('held native adoption and pack-mark writes finish before account erasure removes their key', async () => {
  for (const writer of [
    { suffix: 'practiceHistory', begin: () => adopterFor('practiceHistory')!(() => ({ version: 1, events: [], floor: 0 })) },
    { suffix: 'drills', begin: () => adopterFor('drills')!(() => ({ version: 1, exercises: [], micSuppressedUntil: null })) },
    { suffix: 'topics', begin: () => adopterFor('topics')!(() => ({ version: 1, topics: [] })) },
    { suffix: 'packMarks', begin: () => markPackPractised('pack-one', 100) },
  ]) {
    installDisk(); account();
    const key = userKey(writer.suffix);
    let entered!: () => void;
    let release!: () => void;
    const nativeStarted = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    storage.setItem = async (at: string, value: string) => { entered(); await held; disk.set(at, value); };
    const writing = writer.begin();
    await nativeStarted;
    const reset = clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
    release();
    await assert.rejects(writing);
    await reset;
    assert.equal(disk.has(key), false, `${writer.suffix}: held write resurrected erased material`);
  }
});
