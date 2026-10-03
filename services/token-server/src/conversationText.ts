import { conversationTextCursor, isConversationText, isSavedConversationText, type ConversationText, type ConversationTextPage } from '@luvani/core';

function headers(key: string) { return { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }; }
async function rpc(base: string, key: string, name: string, body: unknown, request: typeof fetch) {
  const response = await request(`${base.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: headers(key), body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('conversation text storage unavailable');
  return response.json() as Promise<unknown>;
}
export async function saveConversationText(base: string, key: string, userId: string, conversation: ConversationText, request: typeof fetch = fetch): Promise<'saved' | 'deleted' | 'not-ready'> {
  if (!isConversationText(conversation)) throw new Error('invalid conversation text');
  const result = await rpc(base, key, 'save_conversation_text', { p_user_id: userId, p_session_id: conversation.sessionId, p_payload: conversation }, request);
  if (result !== 'saved' && result !== 'deleted' && result !== 'not-ready') throw new Error('invalid conversation text response');
  return result;
}
export async function deleteConversationText(base: string, key: string, userId: string, sessionId: string, request: typeof fetch = fetch): Promise<void> {
  if (await rpc(base, key, 'delete_conversation_text', { p_user_id: userId, p_session_id: sessionId }, request) !== true) throw new Error('conversation text deletion unavailable');
}
export async function listConversationText(base: string, key: string, userId: string, request: typeof fetch = fetch, after: string | null = null): Promise<ConversationTextPage> {
  const cursor = after === null ? null : conversationTextCursor(after);
  if (after !== null && cursor === null) throw new Error('invalid conversation cursor');
  // Keep the original timestamp precision. Converting through Date would lose
  // PostgreSQL's microseconds and skip conversations saved in the same moment.
  const filter = cursor ? `&or=${encodeURIComponent(`(saved_at.lt.${cursor.savedAt},and(saved_at.eq.${cursor.savedAt},session_id.lt.${cursor.sessionId}))`)}` : '';
  const response = await request(`${base.replace(/\/+$/, '')}/rest/v1/saved_conversation_text?user_id=eq.${encodeURIComponent(userId)}&deleted=eq.false&select=payload,saved_at&order=saved_at.desc,session_id.desc&limit=10${filter}`, { headers: { ...headers(key), Prefer: 'count=exact' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('conversation text storage unavailable');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > 10) throw new Error('invalid conversation text response');
  const range = response.headers.get('content-range');
  const match = range?.match(/^(?:\*|(\d+)-(\d+))\/(\d+)$/);
  const total = match?.[3];
  if (total === undefined || !Number.isSafeInteger(Number(total)) || Number(total) < rows.length || (Number(total) > 0 && rows.length === 0) ||
    (rows.length > 0 && (Number(match?.[1]) !== 0 || Number(match?.[2]) !== rows.length - 1))) throw new Error('invalid conversation text range');
  const conversations = rows.map(row => {
    if (typeof row !== 'object' || row === null || typeof row.payload !== 'object' || row.payload === null) throw new Error('invalid conversation text response');
    const saved = { ...row.payload, savedAt: row.saved_at };
    if (!isSavedConversationText(saved)) throw new Error('invalid conversation text response');
    return saved;
  });
  const last = conversations.at(-1);
  const nextCursor = Number(total) > conversations.length && last ? JSON.stringify({ savedAt: last.savedAt, sessionId: last.sessionId }) : null;
  if (nextCursor !== null && conversationTextCursor(nextCursor) === null) throw new Error('invalid conversation cursor');
  return { conversations, nextCursor };
}
