import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConversationPack } from '@luvani/core';
import {
  deleteAllConversationPacks,
  deleteConversationPack,
  listConversationPacks,
  getConversationPack,
  saveConversationPack,
  validConversationPackFor,
} from './conversationPacks.ts';

const pack = buildConversationPack({
  id: '01234567-89ab-4def-8123-456789abcdef',
  sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'learner-1',
  createdAt: '2026-09-04T12:00:00.000Z',
  title: { fr: 'Au café', en: 'At the cafe' },
  summary: 'You ordered a coffee.',
  keyPhrases: [{ fr: 'Un café, s’il vous plaît.', frWritten: null, en: 'A coffee, please.' }],
});

test('continuation lookup never returns another learner or another conversation', async () => {
  const read = (payload: unknown) => getConversationPack('https://project.supabase.co', 'secret', 'learner-1', pack.id, async (url) => {
    assert.match(String(url), /user_id=eq\.learner-1/);
    assert.match(String(url), /&limit=1$/);
    return new Response(JSON.stringify([{ payload }]));
  });
  assert.deepEqual(await read(pack), pack);
  assert.equal(await read({ ...pack, learnerId: 'learner-2' }), null);
  assert.equal(await read({ ...pack, id: 'other', sessionId: 'other' }), null);
  assert.equal(await read({ ...pack, state: 'generating' }), null);
  await assert.rejects(getConversationPack('https://project.supabase.co', 'secret', 'learner-1', pack.id,
    async () => new Response(null, { status: 503 })), /read failed/);
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

test('bulk deletion is still scoped to the authenticated learner', async () => {
  let seenUrl = '';
  await deleteAllConversationPacks('https://project.supabase.co', 'secret', 'learner/one', async (url, init) => {
    seenUrl = String(url);
    assert.equal(init?.method, 'DELETE');
    return new Response(null, { status: 204 });
  });
  assert.match(seenUrl, /conversation_packs\?user_id=eq\.learner%2Fone$/);
});

/**
 * The two Practice card fields cross this boundary as data, not as speech.
 * `containsForbiddenConversationData` rejects a whole pack for one audio-ish
 * key anywhere in the graph, so "neither field trips it" is worth proving
 * rather than assuming: a learner losing a conversation over a topic list
 * would look exactly like the row never being written.
 */
const timedPack = buildConversationPack({
  id: '01234567-89ab-4def-8123-456789abcdef',
  sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'learner-1',
  createdAt: '2026-09-04T12:00:00.000Z',
  title: { fr: 'Au café', en: 'At the cafe' },
  summary: 'You ordered a coffee.',
  keyPhrases: [{ fr: 'Un café, s’il vous plaît.', frWritten: null, en: 'A coffee, please.' }],
  durationSec: 487,
  topics: [{ fr: 'Au café', en: 'At the cafe' }, { fr: 'Les croissants', en: 'Croissants' }],
});

test('a timed pack with topics survives the trust boundary intact', async () => {
  assert.equal(timedPack.durationSec, 487, 'the pack under test really is the timed one');
  assert.equal(timedPack.topics.length, 2);
  assert.equal(validConversationPackFor(timedPack, 'learner-1', timedPack.sessionId), true);

  // Through the wire the row actually travels on, because that is where a
  // field that cannot survive JSON would quietly disappear.
  const [read] = await listConversationPacks('https://project.supabase.co', 'secret', 'learner-1', async () => {
    return new Response(JSON.stringify([{ payload: timedPack }]));
  });
  assert.equal(read?.durationSec, 487);
  assert.deepEqual(read?.topics, timedPack.topics);
  assert.deepEqual(read, timedPack);
});

test('a pack stored before these fields existed still reaches the learner', async () => {
  const older: Record<string, unknown> = { ...timedPack };
  delete older.durationSec;
  delete older.topics;

  const packs = await listConversationPacks('https://project.supabase.co', 'secret', 'learner-1', async () => {
    return new Response(JSON.stringify([{ payload: older }]));
  });
  assert.equal(packs.length, 1, 'an older row is a real conversation, not a malformed one');
  assert.equal(packs[0]?.durationSec ?? null, null);
});
