import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { conversationTextCursor, isConversationText, isSavedConversationText } from '@luvani/core';
const conversation = { sessionId: '11111111-1111-4111-8111-111111111111', title: 'At the café', lines: [{ id: 't1', who: 'learner' as const, fr: 'Bonjour', frWritten: null, en: null }] };
const user = { id: 'owner' };
function shipped(state: { generation: number; owner: string }) {
  const source = stripTypeScriptTypes(readFileSync(new URL('./textClient.ts', import.meta.url), 'utf8').split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, ''));
  return new Function('conversationTextCursor', 'isConversationText', 'isSavedConversationText', 'activeUserId', 'scopeGeneration', 'TOKEN_SERVER', source + '\nreturn {saveText,listText,deleteText,findText};')(conversationTextCursor, isConversationText, isSavedConversationText, () => state.owner, () => state.generation, 'https://tokens.invalid');
}
test('explicit text save retries pending completion with one immutable payload and stops on a deletion fence', async () => {
  const state = { generation: 0, owner: 'owner' };
  const client = shipped(state);
  const adapter = { kind: 'supabase', getSession: async () => user, getAccessToken: async () => 'token' };
  let calls = 0, waits = 0;
  const request = async (url: string, init: RequestInit) => {
    calls++; assert.equal(url, 'https://tokens.invalid/conversation-text');
    assert.deepEqual(JSON.parse(init.body as string), { consent: true, conversation });
    return calls < 3 ? Response.json({ error: 'not-ready' }, { status: 409 }) : Response.json({ saved: true });
  };
  assert.equal((await client.saveText(user, adapter, conversation, request, async () => { waits++; })).ok, true);
  assert.equal(calls, 3); assert.equal(waits, 2);
  calls = 0;
  const deleted = await client.saveText(user, adapter, conversation, async () => { calls++; return Response.json({ error: 'deleted' }, { status: 409 }); }, async () => {});
  assert.equal(deleted.ok, false); assert.match(deleted.message, /cannot be saved again/); assert.equal(calls, 1);
  const pending = await client.saveText(user, adapter, conversation, async () => Response.json({ error: 'not-ready' }, { status: 409 }), async () => {});
  assert.match(pending.message, /still being saved/);
});
test('a text save never uploads an earlier account after sign-in or header ownership changes', async () => {
  for (const when of ['before', 'headers', 'reply', 'body', 'wait']) {
    const state = { generation: 0, owner: 'owner' };
    let authOwner = 'owner', calls = 0;
    const client = shipped(state);
    if (when === 'before') authOwner = 'other';
    const adapter = { kind: 'supabase', getSession: async () => ({ id: authOwner }), getAccessToken: async () => { if (when === 'headers') authOwner = 'other'; return 'token'; } };
    const request = async () => {
      calls++; if (when === 'reply') authOwner = 'other';
      if (when === 'body') return { ok: true, status: 200, json: async () => { authOwner = 'other'; return { saved: true }; } };
      return when === 'wait' ? Response.json({ error: 'not-ready' }, { status: 409 }) : Response.json({ saved: true });
    };
    assert.equal((await client.saveText(user, adapter, conversation, request, async () => { state.generation++; })).ok, false, when);
    assert.equal(calls, when === 'before' || when === 'headers' ? 0 : 1, when);
  }
});
test('text listing and deletion never claim a late foreign-account result', async () => {
  const state = { generation: 0, owner: 'owner' };
  const client = shipped(state);
  const adapter = { kind: 'supabase', getSession: async () => user, getAccessToken: async () => 'token' };
  const change = async () => { state.generation++; return Response.json({ deleted: true, conversations: [{ ...conversation, savedAt: '2026-10-02T12:00:00Z' }] }); };
  assert.equal((await client.listText(user, adapter, change)).ok, false);
  assert.equal((await client.deleteText(user, adapter, conversation.sessionId, change)).ok, false);
  const result = await client.listText(user, adapter, async () => Response.json({ conversations: [{ ...conversation, savedAt: 'bad' }] }));
  assert.equal(result.ok, false);
});

test('older text pages carry only a validated cursor and reject non-progressing or mismatched pages', async () => {
  const state = { generation: 0, owner: 'owner' };
  const client = shipped(state);
  const adapter = { kind: 'supabase', getSession: async () => user, getAccessToken: async () => 'token' };
  const saved = { ...conversation, savedAt: '2026-10-02T12:00:00.123456Z' };
  const cursor = JSON.stringify({ savedAt: saved.savedAt, sessionId: saved.sessionId });
  const first = await client.listText(user, adapter, async () => Response.json({ conversations: [saved], nextCursor: cursor }));
  assert.equal(first.ok, true);
  const older = await client.listText(user, adapter, async (url: string) => {
    assert.equal(new URL(url).searchParams.get('after'), cursor);
    return Response.json({ conversations: [], nextCursor: null });
  }, cursor);
  assert.equal(older.ok, true);
  for (const payload of [{ conversations: [saved], nextCursor: cursor }, { conversations: [], nextCursor: cursor }, { conversations: [saved], nextCursor: 'invalid' }]) {
    assert.equal((await client.listText(user, adapter, async () => Response.json(payload), cursor)).ok, false);
  }
});

test('saved text lookup pages at most five pages for one conversation', async () => {
  const state = { generation: 0, owner: 'owner' };
  const client = shipped(state);
  const adapter = { kind: 'supabase', getSession: async () => user, getAccessToken: async () => 'token' };
  const row = (n: number) => ({ ...conversation, sessionId: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, savedAt: `2026-10-02T12:00:${String(59 - n).padStart(2, '0')}Z` });
  const pages = (count: number) => { let calls = 0; const request = async (url: string) => {
    const after = new URL(url).searchParams.get('after');
    const n = after === null ? 0 : Number(JSON.parse(after).sessionId.slice(-12));
    calls++; const saved = row(n + 1);
    return Response.json({ conversations: [saved], nextCursor: n + 1 < count ? JSON.stringify({ savedAt: saved.savedAt, sessionId: saved.sessionId }) : null });
  }; return { request, calls: () => calls }; };
  const third = pages(10);
  assert.deepEqual(await client.findText(user, adapter, row(3).sessionId, third.request), { ok: true, value: row(3) });
  assert.equal(third.calls(), 3, 'paging went on past the conversation');
  const far = pages(10);
  assert.deepEqual(await client.findText(user, adapter, row(6).sessionId, far.request), { ok: true, value: null }, 'past five pages lands on the list');
  assert.equal(far.calls(), 5);
  const short = pages(2);
  assert.deepEqual(await client.findText(user, adapter, row(9).sessionId, short.request), { ok: true, value: null });
  assert.equal(short.calls(), 2, 'paging went on past the last page');
  assert.equal((await client.findText(user, adapter, row(1).sessionId, async () => Response.json({}, { status: 503 }))).ok, false);
});
