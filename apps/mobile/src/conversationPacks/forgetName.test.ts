import assert from 'node:assert/strict';
import { test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildConversationPack, phraseKeyOf } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import { gradeCard, loadDeck } from '../review/store.ts';
import { conversationContext } from '../review/context.ts';
import { deleteAllConversationPacksForLearner, deleteConversationPackForLearner, loadConversationPacks, refreshConversationPacks } from './store.ts';
import { PAST_CONVERSATION_NOTE, conversationNote } from './packExercises.ts';

const disk = new Map<string, string>();
const storage = AsyncStorage as unknown as Record<string, unknown>;
storage.getItem = async (key: string) => disk.get(key) ?? null;
storage.setItem = async (key: string, value: string) => { disk.set(key, value); };
storage.removeItem = async (key: string) => { disk.delete(key); };
const adapter = { kind: 'supabase', getAccessToken: async () => 'fixture-token' } as unknown as AuthAdapter;
const user = (uid: string): AuthUser => ({ id: uid, email: null, provider: 'password' });
const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const pack = (uid: string, n: number, en: string, fr: string) => buildConversationPack({
  id: id(n), sessionId: id(n), learnerId: uid, createdAt: new Date(3000000 - n).toISOString(),
  title: { fr: en, en }, summary: 'A talk.',
  keyPhrases: [{ fr, frWritten: null, en: `${fr} in English` }],
  corrections: [{ quote: `${fr} wrong`, better: `${fr} mieux`, betterEn: 'Better', why: 'Because.' }],
});

test('deleting a conversation clears its name from review cards and keeps their schedule', async () => {
  const uid = 'forget-name';
  setActiveUser(uid);
  const doomed = pack(uid, 1, 'Dinner with Sam', 'Une soupe');
  const kept = pack(uid, 2, 'At the station', 'Un billet');
  const ok = await refreshConversationPacks(user(uid), adapter, async () => Response.json({ packs: [doomed, kept], nextCursor: null }));
  assert.equal(ok.ok, true);
  await gradeCard(phraseKeyOf('Une soupe'), 'good');
  const before = new Map((await loadDeck()).map((card) => [card.id, card]));
  assert.equal(before.get(phraseKeyOf('Une soupe'))?.context, conversationNote('Dinner with Sam'));

  const result = await deleteConversationPackForLearner(user(uid), adapter, doomed.id, async () => new Response(null, { status: 204 }));
  assert.equal(result.ok, true);

  const after = await loadDeck();
  assert.equal(after.length, before.size, 'no card was removed');
  for (const card of after) {
    const held = before.get(card.id)!;
    assert.doesNotMatch(card.context, /Dinner with Sam/);
    assert.deepEqual({ ...card, context: '' }, { ...held, context: '' }, 'schedule, sources and evidence are unchanged');
  }
  assert.equal(after.find((card) => card.id === phraseKeyOf('Une soupe'))?.context, PAST_CONVERSATION_NOTE);
  assert.equal(after.find((card) => card.id === phraseKeyOf('Un billet'))?.context, conversationNote('At the station'), 'a kept conversation keeps its name');
  // Persisted through the review key, so the deck syncs like any other edit.
  assert.doesNotMatch(disk.get(userKey('review'))!, /Dinner with Sam/);
  // Review's "From ..." line reads the pack cache, which no longer holds it.
  const card = after.find((row) => row.id === phraseKeyOf('Une soupe mieux'))!;
  assert.equal(conversationContext(card, await loadConversationPacks()), null);
});

test('deleting every conversation clears every conversation name from review cards', async () => {
  const uid = 'forget-all';
  setActiveUser(uid);
  await refreshConversationPacks(user(uid), adapter, async () => Response.json({ packs: [pack(uid, 3, 'Market day', 'Des pommes')], nextCursor: null }));
  const result = await deleteAllConversationPacksForLearner(user(uid), adapter, async () => new Response(null, { status: 204 }));
  assert.equal(result.ok, true);
  assert.ok((await loadDeck()).every((card) => !card.context.includes('Market day')));
});

test('a failed server delete leaves the names in place', async () => {
  const uid = 'forget-refused';
  setActiveUser(uid);
  const held = pack(uid, 4, 'Bakery', 'Une baguette');
  await refreshConversationPacks(user(uid), adapter, async () => Response.json({ packs: [held], nextCursor: null }));
  const result = await deleteConversationPackForLearner(user(uid), adapter, held.id, async () => new Response(null, { status: 500 }));
  assert.equal(result.ok, false);
  assert.equal((await loadDeck()).find((card) => card.id === phraseKeyOf('Une baguette'))?.context, conversationNote('Bakery'));
});

test('an unknown practice status from the server is stored as ready', async () => {
  const uid = 'status-parse';
  setActiveUser(uid);
  const odd = { ...pack(uid, 5, 'Odd', 'Un truc'), practiceStatus: 'exploding' };
  const fine = { ...pack(uid, 6, 'Fine', 'Un chose'), practiceStatus: 'failed' };
  const result = await refreshConversationPacks(user(uid), adapter, async () => Response.json({ packs: [odd, fine], nextCursor: null }));
  assert.equal(result.ok, true);
  const stored = await loadConversationPacks();
  assert.equal('practiceStatus' in stored.find((row) => row.id === id(5))!, false);
  assert.equal((stored.find((row) => row.id === id(6)) as { practiceStatus?: string }).practiceStatus, 'failed');
});
