import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildConversationPack, buildDrillSession, DRILL_FIXTURES, newCard, phraseKeyOf } from '@luvani/core';
import { loadDrillBank } from './store.ts';
import { MAX_DRILL_EXERCISES, mergeExerciseBank } from './merge.ts';
import { refreshConversationPacks, loadConversationPacks } from '../conversationPacks/store.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';

const disk = new Map<string, string>();
let refuse = '';
const storage = AsyncStorage as unknown as Record<string, unknown>;
storage.getItem = async (key: string) => disk.get(key) ?? null;
storage.setItem = async (key: string, value: string) => {
  if (refuse && key.endsWith(`.${refuse}`)) throw new Error('disk full');
  disk.set(key, value);
};
storage.removeItem = async (key: string) => { disk.delete(key); };

test('a persisted pre-update bank gains the fifth rung without replacing saved exercises', async () => {
  const uid = 'old-bank';
  setActiveUser(uid);
  const bankKey = userKey('drills');
  const previous = DRILL_FIXTURES.filter(item => item.kind !== 'own-words');
  const custom = { kind: 'listen-type', id: 'gen:mine', phraseKey: 'phrase:ma ligne', difficulty: 'production', fr: 'Ma ligne', accepted: ['Ma ligne'] };
  const raw = JSON.stringify({ version: 1, exercises: [...previous, custom], micSuppressedUntil: null });
  disk.set(bankKey, raw);
  const bank = await loadDrillBank();
  assert.deepEqual(bank.find(item => item.id === 'gen:mine'), custom);
  const key = "phrase:un café, s'il vous plaît";
  const card = { ...newCard({ id: key, kind: 'vocab', front: 'A coffee, please', back: "Un café, s'il vous plaît", context: '', ipa: '' }, 1), reps: 4 };
  assert.equal(buildDrillSession([card], bank, 1, { only: [key] }).queue[0]?.kind, 'own-words');
  assert.equal(disk.get(bankKey), raw, 'reading adds the fixture without writing learner data');
});

test('a full old bank reserves the new authored rung and admits fresh pack rungs', async () => {
  const uid = 'full-old-bank';
  setActiveUser(uid);
  const old = DRILL_FIXTURES.filter(item => item.kind !== 'own-words');
  const filler = Array.from({ length: MAX_DRILL_EXERCISES - old.length }, (_, index) => ({
    kind: 'listen-type' as const, id: `pack:old:${index}`, phraseKey: `phrase:old-${index}`,
    difficulty: 'production' as const, fr: 'Bonjour', accepted: ['Bonjour'],
  }));
  disk.set(userKey('drills'), JSON.stringify({ version: 1, exercises: [...old, ...filler], micSuppressedUntil: null }));
  const bank = await loadDrillBank();
  assert.equal(bank.length, MAX_DRILL_EXERCISES);
  assert.ok(bank.some(item => item.id === 'own-cafe'));
  const fresh = { kind: 'own-words' as const, id: 'own:new-pack', phraseKey: 'phrase:new-pack', difficulty: 'production' as const, fr: 'Une table', en: 'A table', situation: 'Ask for a table', mustKeep: ['table'], accepted: [] };
  const merged = mergeExerciseBank(bank, [fresh]);
  assert.equal(merged.length, MAX_DRILL_EXERCISES);
  assert.ok(merged.some(item => item.id === fresh.id));
  assert.ok(merged.some(item => item.id === 'own-cafe'));
  for (const fixture of DRILL_FIXTURES) assert.ok(merged.some(item => item.phraseKey === fixture.phraseKey && item.kind === fixture.kind), fixture.id);
});

test('a failed fifth-rung pack write keeps its source and reports failure until a durable retry', async () => {
  for (const suffix of ['review', 'drills']) {
    const uid = `pack-failure-${suffix}`;
    setActiveUser(uid);
    const user: AuthUser = { id: uid, email: null, provider: 'password' };
    const adapter = { kind: 'supabase', getAccessToken: async () => 'test' } as unknown as AuthAdapter;
    const pack = buildConversationPack({ id: `s-${suffix}`, sessionId: `s-${suffix}`, learnerId: uid, createdAt: new Date(1).toISOString(), title: { fr: 'La table', en: 'Ask for a table' }, summary: 'A table.', keyPhrases: [{ fr: 'Une table, merci', frWritten: null, en: 'A table, thank you' }] });
    const request: typeof fetch = async () => Response.json({ packs: [pack] });
    refuse = suffix;
    assert.deepEqual(await refreshConversationPacks(user, adapter, request), { ok: false });
    assert.equal((await loadConversationPacks())[0]?.id, pack.id, 'the pack remains a retryable source');
    setActiveUser(null); setActiveUser(uid);
    assert.ok(!(await loadDrillBank()).some(item => item.kind === 'own-words' && item.phraseKey === phraseKeyOf('Une table, merci')), 'the refused write was not durable');
    refuse = '';
    assert.equal((await refreshConversationPacks(user, adapter, request)).ok, true);
    setActiveUser(null); setActiveUser(uid);
    assert.ok((await loadDrillBank()).some(item => item.kind === 'own-words' && item.phraseKey === phraseKeyOf('Une table, merci')), 'retry survives cache reset');
  }
});
