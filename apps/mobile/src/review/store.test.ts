import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newCard } from '@luvani/core';
import { loadDeck } from './store.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import { adopterFor } from '../sync/registry.ts';
const disk = new Map<string, string>();
let account = 0;
const storage = AsyncStorage as unknown as Record<string, unknown>;
function install() {
  disk.clear();
  storage.getItem = async (key: string) => disk.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { disk.set(key, value); };
  setActiveUser('deck-proof-' + ++account);
}
const card = newCard({ id: 'phrase:cafe', kind: 'vocab', front: 'Un café', back: 'A coffee', context: 'At a café', ipa: '' }, 100);

test('the owned review deck distinguishes absent from corrupt or refused bytes and a failed cache read can retry', async () => {
  install(); assert.deepEqual(await loadDeck(), []);
  for (const raw of ['{', '{}', '[null]', JSON.stringify([{ ...card, front: null }])]) {
    install(); const key = userKey('review'); disk.set(key, raw);
    await assert.rejects(loadDeck()); assert.equal(disk.get(key), raw);
    disk.set(key, JSON.stringify([card])); assert.deepEqual(await loadDeck(), [card]);
  }
  install(); storage.getItem = async () => { throw new Error('read refused'); };
  await assert.rejects(loadDeck(), /read refused/);
  storage.getItem = async (key: string) => disk.get(key) ?? null;
  assert.deepEqual(await loadDeck(), []);
});

test('deck sync cannot replace unreadable local material or acknowledge a refused adoption', async () => {
  install(); const key = userKey('review'); disk.set(key, '{');
  const adopt = adopterFor('review')!; let folded = false;
  await assert.rejects(adopt(() => { folded = true; return [card]; }));
  assert.equal(folded, false); assert.equal(disk.get(key), '{');
  disk.delete(key); storage.setItem = async () => { throw new Error('full'); };
  assert.equal(await adopt(() => [card]), 'declined');
  assert.equal(disk.has(key), false);
});
