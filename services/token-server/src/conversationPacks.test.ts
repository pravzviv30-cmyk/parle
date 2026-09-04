import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConversationPack } from '@luvani/core';
import { deleteConversationPack, listConversationPacks, saveConversationPack, validConversationPackFor } from './conversationPacks.ts';

const pack = buildConversationPack({
  id: '01234567-89ab-4def-8123-456789abcdef',
  sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'learner-1',
  createdAt: '2026-09-04T12:00:00.000Z',
  title: { fr: 'Au café', en: 'At the cafe' },
  summary: 'You ordered a coffee.',
  keyPhrases: [{ fr: 'Un café, s’il vous plaît.', frWritten: null, en: 'A coffee, please.' }],
});

test('pack writes upsert on the session identity', async () => {
  let seenUrl = '';
  let body: unknown;
  await saveConversationPack('https://project.supabase.co/', 'secret', pack, async (url, init) => {
    seenUrl = String(url);
    body = JSON.parse(String(init?.body));
    return new Response(null, { status: 201 });
  });
  assert.match(seenUrl, /conversation_packs\?on_conflict=session_id$/);
  assert.deepEqual(body, { id: pack.id, session_id: pack.sessionId, user_id: pack.learnerId, state: 'ready', payload: pack, created_at: pack.createdAt });
});

test('pack reads discard malformed and foreign rows at the server boundary', async () => {
  const packs = await listConversationPacks('https://project.supabase.co', 'secret', 'learner-1', async () => {
    return new Response(JSON.stringify([{ payload: pack }, { payload: { ...pack, learnerId: 'learner-2' } }, { payload: { audio: 'no' } }]));
  });
  assert.deepEqual(packs, [pack]);
  assert.equal(validConversationPackFor(pack, 'learner-1', pack.sessionId), true);
  assert.equal(validConversationPackFor(pack, 'learner-2'), false);
  assert.equal(validConversationPackFor({ ...pack, id: 'different-id' }, 'learner-1'), false);
});

test('pack deletion scopes the target to the authenticated learner', async () => {
  let seenUrl = '';
  await deleteConversationPack('https://project.supabase.co', 'secret', 'learner/one', pack.id, async (url) => {
    seenUrl = String(url);
    return new Response(null, { status: 204 });
  });
  assert.match(seenUrl, /id=eq\.01234567-89ab-4def-8123-456789abcdef/);
  assert.match(seenUrl, /user_id=eq\.learner%2Fone/);
});
