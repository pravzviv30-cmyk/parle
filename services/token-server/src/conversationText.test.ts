import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteConversationText, listConversationText, saveConversationText } from './conversationText.ts';
const conversation = { sessionId: '11111111-1111-4111-8111-111111111111', title: 'At the café', lines: [{ id: 't1', who: 'learner' as const, fr: 'Bonjour', frWritten: null, en: null }] };
test('opted-in text saves and deletes through owner-scoped service RPCs', async () => {
  for (const result of ['saved', 'deleted', 'not-ready'] as const) {
    const request = async (url: unknown, init?: RequestInit) => {
      assert.equal(url, 'https://db.test/rest/v1/rpc/save_conversation_text');
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer service');
      assert.deepEqual(JSON.parse(init!.body as string), { p_user_id: 'owner', p_session_id: conversation.sessionId, p_payload: conversation });
      return Response.json(result);
    };
    assert.equal(await saveConversationText('https://db.test/', 'service', 'owner', conversation, request as typeof fetch), result);
  }
  await deleteConversationText('https://db.test', 'service', 'owner', conversation.sessionId, (async (url: unknown, init?: RequestInit) => {
    assert.equal(url, 'https://db.test/rest/v1/rpc/delete_conversation_text');
    assert.deepEqual(JSON.parse(init!.body as string), { p_user_id: 'owner', p_session_id: conversation.sessionId });
    return Response.json(true);
  }) as typeof fetch);
});
test('saved text lists exclude deleted rows and fail visibly for corrupt stored data', async () => {
  const request = async (url: unknown) => {
    assert.match(String(url), /user_id=eq.owner%2Fid&deleted=eq.false&select=payload,saved_at/);
    return Response.json([{ payload: conversation, saved_at: '2026-10-02T12:00:00Z' }], { headers: { 'content-range': '0-0/1' } });
  };
  assert.equal((await listConversationText('https://db.test', 'service', 'owner/id', request as typeof fetch)).conversations[0]?.lines[0]?.fr, 'Bonjour');
  for (const invalid of [null, {}, [{ payload: { audio: 'raw' }, saved_at: 'bad' }]]) await assert.rejects(listConversationText('https://db.test', 'service', 'owner', (async () => Response.json(invalid)) as typeof fetch));
});

test('text pages preserve timestamp precision, ownership and older rows under a smaller database cap', async () => {
  const savedAt = '2026-10-02T12:00:00.123456+00:00';
  const page = await listConversationText('https://db.test', 'service', 'owner', (async (input: unknown, init?: RequestInit) => {
    assert.match(String(input), /order=saved_at.desc,session_id.desc&limit=10$/);
    assert.equal((init!.headers as Record<string, string>).Prefer, 'count=exact');
    return Response.json([{ payload: conversation, saved_at: savedAt }], { headers: { 'content-range': '0-0/3' } });
  }) as typeof fetch);
  assert.equal(page.conversations.length, 1);
  assert.ok(page.nextCursor);
  assert.deepEqual(JSON.parse(page.nextCursor), { savedAt, sessionId: conversation.sessionId });
  const older = await listConversationText('https://db.test', 'service', 'owner', (async (input: unknown) => {
    const query = new URL(String(input)).searchParams;
    assert.equal(query.get('user_id'), 'eq.owner');
    assert.equal(query.get('deleted'), 'eq.false');
    assert.equal(query.get('or'), `(saved_at.lt.${savedAt},and(saved_at.eq.${savedAt},session_id.lt.${conversation.sessionId}))`);
    return Response.json([], { headers: { 'content-range': '*/0' } });
  }) as typeof fetch, page.nextCursor);
  assert.deepEqual(older, { conversations: [], nextCursor: null });
  let called = false;
  await assert.rejects(listConversationText('https://db.test', 'service', 'owner', (async () => { called = true; return Response.json([]); }) as typeof fetch, '{"savedAt":"today,session_id.gt.0","sessionId":"any"}'));
  assert.equal(called, false, 'invalid cursor cannot broaden a service-role query');
  for (const range of [null, '0-0/*', '1-1/2', '0-3/4', '0-0/0']) {
    const headers: Record<string, string> = range === null ? {} : { 'content-range': range };
    await assert.rejects(listConversationText('https://db.test', 'service', 'owner', (async () => Response.json([{ payload: conversation, saved_at: savedAt }], { headers })) as typeof fetch));
  }
});
