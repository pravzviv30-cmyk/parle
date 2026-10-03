/** Explicit saved-text requests. No disk cache, background upload or automatic save. */
import { conversationTextCursor, isConversationText, isSavedConversationText, type ConversationText, type ConversationTextPage } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
export type TextResult<T> = { ok: true; value: T } | { ok: false; message: string };
const failure = (): TextResult<never> => ({ ok: false, message: 'That could not be confirmed. Check your connection and try again.' });
const owns = async (user: AuthUser, adapter: AuthAdapter, scope: number) => scope === scopeGeneration() && activeUserId() === user.id && (await adapter.getSession())?.id === user.id;
async function requestFor(user: AuthUser, adapter: AuthAdapter, path: string, init: RequestInit, request: typeof fetch): Promise<Response | null> {
  const scope = scopeGeneration();
  const current = async () => scope === scopeGeneration() && activeUserId() === user.id && (await adapter.getSession())?.id === user.id;
  if (adapter.kind !== 'supabase' || !await current()) return null;
  const token = await adapter.getAccessToken();
  if (!token || !await current()) return null;
  const response = await request(`${TOKEN_SERVER}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  return await current() ? response : null;
}
export async function saveText(user: AuthUser, adapter: AuthAdapter, conversation: ConversationText, request: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<TextResult<void>> {
  if (!isConversationText(conversation)) return { ok: false, message: 'The complete conversation text is not available to save.' };
  const scope = scopeGeneration();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!await owns(user, adapter, scope)) return failure();
      const response = await requestFor(user, adapter, '/conversation-text', { method: 'POST', body: JSON.stringify({ consent: true, conversation }) }, request);
      if (!response) return failure();
      const body: unknown = await response.json();
      if (!await owns(user, adapter, scope)) return failure();
      const v = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
      if (response.ok && v.saved === true) return { ok: true, value: undefined };
      if (response.status === 409 && v.error === 'deleted') return { ok: false, message: 'This conversation text was deleted. It cannot be saved again.' };
      if (response.status !== 409 || v.error !== 'not-ready') return failure();
      if (attempt < 2) await sleep(1000);
    }
    return { ok: false, message: 'Your practice is still being saved. Try saving the text again in a moment.' };
  } catch { return failure(); }
}
export async function listText(user: AuthUser, adapter: AuthAdapter, request: typeof fetch = fetch, after: string | null = null): Promise<TextResult<ConversationTextPage>> {
  const scope = scopeGeneration();
  try {
    if (after !== null && conversationTextCursor(after) === null) return failure();
    const response = await requestFor(user, adapter, `/conversation-text${after === null ? '' : `?after=${encodeURIComponent(after)}`}`, { method: 'GET' }, request);
    if (!response?.ok) return failure();
    const body: unknown = await response.json();
    if (!await owns(user, adapter, scope) || typeof body !== 'object' || body === null || !Array.isArray((body as { conversations?: unknown }).conversations)) return failure();
    const { conversations: rows, nextCursor } = body as { conversations: unknown[]; nextCursor: unknown };
    if (rows.length > 10 || !rows.every(isSavedConversationText) || (nextCursor !== null && conversationTextCursor(nextCursor) === null)) return failure();
    if (nextCursor !== null) {
      const last = rows.at(-1), cursor = conversationTextCursor(nextCursor)!;
      if (!last || cursor.savedAt !== last.savedAt || cursor.sessionId !== last.sessionId || nextCursor === after) return failure();
    }
    return { ok: true, value: { conversations: rows, nextCursor: nextCursor as string | null } };
  } catch { return failure(); }
}
export async function deleteText(user: AuthUser, adapter: AuthAdapter, sessionId: string, request: typeof fetch = fetch): Promise<TextResult<void>> {
  const scope = scopeGeneration();
  try {
    const response = await requestFor(user, adapter, `/conversation-text/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }, request);
    if (!response?.ok) return failure();
    const body: unknown = await response.json();
    return await owns(user, adapter, scope) && typeof body === 'object' && body !== null && (body as { deleted?: unknown }).deleted === true ? { ok: true, value: undefined } : failure();
  } catch { return failure(); }
}
