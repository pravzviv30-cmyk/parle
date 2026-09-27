import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildConversationPack, withoutRevisionSource, withVerifiedRevisionSource, type ConversationPack } from '@luvani/core';
import { practiceJobs } from './practiceJobs.ts';
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

/**
 * A tutor revisit's pack names its source only after the owner check the
 * continuation route already uses. This replays the /conversation-packs/complete
 * sequence (strip, validate, owner-check, persist) against both persistence
 * paths, because server.ts boots on import and cannot be driven directly.
 */
describe('a revisit link is stored only when the learner owns the source', () => {
  const OWNER = '01234567-89ab-4def-8123-456789abcdea';
  const SOURCE = '11111111-2222-4333-8444-555555555555';
  const sessionId = '01234567-89ab-4def-8123-456789abcdef';
  const source = buildConversationPack({ ...sourceInput(SOURCE), learnerId: OWNER });
  const revisit = { ...buildConversationPack({ ...sourceInput(sessionId), learnerId: OWNER }), revisedFromPackId: SOURCE };

  function sourceInput(id: string) {
    return { id, sessionId: id, learnerId: OWNER, createdAt: '2026-09-04T12:00:00.000Z',
      title: { fr: 'Au café', en: 'At the cafe' }, summary: 'You ordered a coffee.',
      keyPhrases: [{ fr: 'Un café, merci.', frWritten: null, en: 'A coffee, thanks.' }] };
  }

  /** The route's sequence, with the database answering `rows` for the owner lookup. */
  async function complete(body: unknown, rows: (url: string) => unknown[] | Response, durable: boolean) {
    const lookups: string[] = [];
    let stored: unknown;
    const request = (async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === 'POST') {
        const sent = JSON.parse(String(init.body)) as { payload?: unknown; p_pack?: unknown };
        stored = durable ? sent.p_pack : sent.payload;
        return new Response(null, { status: 204 });
      }
      lookups.push(href);
      const answer = rows(href);
      return answer instanceof Response ? answer : new Response(JSON.stringify(answer));
    }) as typeof fetch;
    const { pack: incoming, claimedSource } = withoutRevisionSource(body);
    assert.equal(validConversationPackFor(incoming, OWNER, sessionId), true, 'a bad link never rejects the pack');
    const pack = await withVerifiedRevisionSource(incoming as ConversationPack, claimedSource, async (id) =>
      (await getConversationPack('https://project.supabase.co', 'secret', OWNER, id, request)) !== null);
    if (durable) await practiceJobs('https://project.supabase.co', 'secret', request).receive(pack, true);
    else await saveConversationPack('https://project.supabase.co', 'secret', pack, request);
    return { stored: stored as ConversationPack, lookups };
  }

  for (const durable of [false, true]) {
    const path = durable ? 'durable practice RPC' : 'ordinary upsert';

    test(`an owned source is linked in the stored payload (${path})`, async () => {
      const { stored, lookups } = await complete(revisit, () => [{ payload: source }], durable);
      assert.equal(stored.revisedFromPackId, SOURCE);
      assert.equal(lookups.length, 1);
      assert.match(lookups[0]!, new RegExp(`id=eq\\.${SOURCE}&user_id=eq\\.${OWNER}`), 'looked up under the pack owner');
      assert.deepEqual({ ...stored, revisedFromPackId: undefined }, { ...revisit, revisedFromPackId: undefined },
        'the link is an id only; nothing from the source pack is copied in');
      // And back out of storage intact.
      const [read] = await listConversationPacks('https://project.supabase.co', 'secret', OWNER, async () =>
        new Response(JSON.stringify([{ payload: stored }])));
      assert.equal(read?.revisedFromPackId, SOURCE);
    });

    test(`a foreign, missing, unfinished or unreadable source is stripped and the practice is kept (${path})`, async () => {
      const answers: [string, (url: string) => unknown[] | Response][] = [
        ['missing', () => []],
        ['foreign', () => [{ payload: { ...source, learnerId: 'someone-else' } }]],
        ['unfinished', () => [{ payload: { ...source, state: 'generating' } }]],
        ['unreadable', () => new Response(null, { status: 503 })],
      ];
      for (const [label, rows] of answers) {
        const { stored } = await complete(revisit, rows, durable);
        assert.equal('revisedFromPackId' in stored, false, `${label} source links nothing`);
        assert.deepEqual(stored.keyPhrases, revisit.keyPhrases, `${label} source still saves the practice`);
        assert.doesNotMatch(JSON.stringify(stored), /someone-else/);
      }
    });

    test(`no source and a malformed source are never looked up (${path})`, async () => {
      const ordinary = buildConversationPack(sourceInput(sessionId));
      for (const body of [ordinary, { ...ordinary, revisedFromPackId: null }, { ...ordinary, revisedFromPackId: 'x y' },
        { ...ordinary, revisedFromPackId: { transcript: 'private' } }, { ...ordinary, revisedFromPackId: sessionId }]) {
        const { stored, lookups } = await complete(body, () => { throw new Error('must not look up'); }, durable);
        assert.deepEqual(lookups, []);
        assert.equal('revisedFromPackId' in stored, false);
        assert.doesNotMatch(JSON.stringify(stored), /private/);
      }
    });
  }
});
