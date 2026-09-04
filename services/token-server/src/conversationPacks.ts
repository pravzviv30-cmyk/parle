/** Server-owned Conversation Pack persistence. */

import { isConversationPack, type ConversationPack } from '@luvani/core';

function headers(serviceRoleKey: string): Record<string, string> {
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
}

function root(url: string): string {
  return url.replace(/\/+$/, '');
}

export function validConversationPackFor(pack: unknown, userId: string, sessionId?: string): pack is ConversationPack {
  return isConversationPack(pack) &&
    pack.id === pack.sessionId &&
    pack.learnerId === userId &&
    (sessionId === undefined || pack.sessionId === sessionId);
}

/** Upsert by session id, so a retry cannot create a second pack. */
export async function saveConversationPack(
  baseUrl: string,
  serviceRoleKey: string,
  pack: ConversationPack,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`${root(baseUrl)}/rest/v1/conversation_packs?on_conflict=session_id`, {
    method: 'POST',
    headers: {
      ...headers(serviceRoleKey),
      'content-type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    signal: AbortSignal.timeout(5_000),
    body: JSON.stringify({
      id: pack.id,
      session_id: pack.sessionId,
      user_id: pack.learnerId,
      state: pack.state,
      payload: pack,
      created_at: pack.createdAt,
    }),
  });
  if (!response.ok) throw new Error(`conversation pack write failed (${response.status})`);
}

/** Only rows owned by the authenticated caller are ever returned. */
export async function listConversationPacks(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  request: typeof fetch = fetch,
): Promise<ConversationPack[]> {
  const response = await request(
    `${root(baseUrl)}/rest/v1/conversation_packs?user_id=eq.${encodeURIComponent(userId)}&select=payload&order=created_at.desc`,
    { headers: headers(serviceRoleKey), signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`conversation pack read failed (${response.status})`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('conversation pack read returned an invalid payload');
  return rows.flatMap((row) => {
    const payload = typeof row === 'object' && row !== null ? (row as { payload?: unknown }).payload : undefined;
    return validConversationPackFor(payload, userId) ? [payload] : [];
  });
}

/** A server-side user predicate prevents an id from becoming a foreign delete. */
export async function deleteConversationPack(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  packId: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(
    `${root(baseUrl)}/rest/v1/conversation_packs?id=eq.${encodeURIComponent(packId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { ...headers(serviceRoleKey), Prefer: 'return=minimal' }, signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`conversation pack delete failed (${response.status})`);
}

/**
 * Delete every Pack owned by one caller. The generated drills deliberately do
 * not live in this table, so deleting conversation history never locks a
 * learner out of phrases or review cards they have already earned.
 */
export async function deleteAllConversationPacks(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(
    `${root(baseUrl)}/rest/v1/conversation_packs?user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { ...headers(serviceRoleKey), Prefer: 'return=minimal' }, signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`conversation pack bulk delete failed (${response.status})`);
}
