/** Execute the shipped route with faked HTTP/auth edges and real storage helpers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { conversationTextCursor, isConversationText } from '@luvani/core';
import { saveConversationText, deleteConversationText, listConversationText } from './conversationText.ts';
const server = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const route = server.slice(server.indexOf('    const textDelete ='), server.indexOf('    // The tutor agent writes a completed Pack'));
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const conversation = { sessionId: '11111111-1111-4111-8111-111111111111', title: 'Au café', lines: [{ id: 't1', who: 'learner' as const, fr: 'Bonjour', frWritten: null, en: null }] };
async function execute(method: string, body: unknown, options: { path?: string; authorised?: boolean; limited?: boolean; configured?: boolean } = {}) {
  const calls: { url: string; body: unknown }[] = [];
  let reads = 0;
  let output: { status: number; body: unknown } | null = null;
  const request = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(init.body as string) : null });
    if (String(input).includes('save_conversation_text')) return Response.json('saved');
    if (String(input).includes('delete_conversation_text')) return Response.json(true);
    return Response.json([], { headers: { 'content-range': '*/0' } });
  }) as typeof fetch;
  const world = {
    req: { method, headers: { authorization: 'Bearer learner-token' } }, res: {},
    url: new URL(options.path ?? '/conversation-text', 'https://tokens.test'),
    withinLimits: async () => options.limited !== true, ipCheck: () => null,
    RATE_LIMITS: { conversationPackIp: {}, conversationPackUser: {} },
    users: { resolve: async (bearer: unknown, claimed: unknown) => { assert.equal(bearer, 'Bearer learner-token'); assert.equal(claimed, null); return options.authorised === false ? { ok: false, status: 401, message: 'Sign in.' } : { ok: true, userId: 'authenticated-owner' }; } },
    process: { env: options.configured === false ? {} : { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' } },
    json: (_res: unknown, status: number, value: unknown) => { output = { status, body: value }; },
    readJson: async (_req: unknown, limit: number) => { reads++; assert.equal(limit, 256 * 1024); return body; },
    sessionIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    conversationTextCursor, isConversationText, fetch: request,
    saveConversationText: (db: string, key: string, owner: string, value: typeof conversation) => saveConversationText(db, key, owner, value, request),
    deleteConversationText: (db: string, key: string, owner: string, id: string) => deleteConversationText(db, key, owner, id, request),
    listConversationText,
  };
  const names = Object.keys(world);
  const fn = new AsyncFunction(...names, stripTypeScriptTypes(`async function lifted() { ${route} }`).replace(/^async function lifted\(\) \{/, '').replace(/\}\s*$/, ''));
  await fn(...Object.values(world));
  return { calls, reads, output: output as { status: number; body: unknown } | null };
}
test('saved text routes refuse unauthorised, unconfigured, limited and nonconsenting requests before storage', async () => {
  for (const options of [{ authorised: false }, { configured: false }, { limited: true }]) {
    const result = await execute('POST', { consent: true, conversation }, options);
    assert.equal(result.calls.length, 0); assert.equal(result.reads, 0);
  }
  for (const body of [{ conversation }, { consent: false, conversation }, { consent: true, conversation: { ...conversation, audio: 'must not be uploaded' } }]) {
    const result = await execute('POST', body);
    assert.equal(result.output?.status, 400); assert.equal(result.calls.length, 0);
  }
});
test('saved text save, list and deletion trust only the bearer-resolved owner', async () => {
  const save = await execute('POST', { consent: true, conversation, userId: 'claimed-other-owner' });
  assert.equal(save.output?.status, 200);
  assert.deepEqual(save.calls[0]?.body, { p_user_id: 'authenticated-owner', p_session_id: conversation.sessionId, p_payload: conversation });
  const deletion = await execute('DELETE', null, { path: `/conversation-text/${conversation.sessionId}?userId=other` });
  assert.deepEqual(deletion.calls[0]?.body, { p_user_id: 'authenticated-owner', p_session_id: conversation.sessionId });
  const list = await execute('GET', null, { path: '/conversation-text?userId=other' });
  assert.equal(new URL(list.calls[0]!.url).searchParams.get('user_id'), 'eq.authenticated-owner');
  assert.deepEqual(list.output?.body, { conversations: [], nextCursor: null });
  const invalid = await execute('GET', null, { path: '/conversation-text?after=invalid' });
  assert.equal(invalid.output?.status, 400); assert.equal(invalid.calls.length, 0);
});
