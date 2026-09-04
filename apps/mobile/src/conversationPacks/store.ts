/** Local cache for server-owned Conversation Packs. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isConversationPack, type ConversationPack } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { mergeExercises } from '../drill/store.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { orderedConversationPacks } from './model.ts';

const VERSION = 1;
const KEY = () => userKey('conversationPacks');

interface StoredConversationPacks {
  version: typeof VERSION;
  packs: ConversationPack[];
}

let writeChain: Promise<unknown> = Promise.resolve();

function serialised<T>(operation: (key: string) => Promise<T>): Promise<T> {
  const key = KEY();
  const run = () => operation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}

function readable(value: unknown): value is StoredConversationPacks {
  return typeof value === 'object' && value !== null &&
    (value as { version?: unknown }).version === VERSION &&
    Array.isArray((value as { packs?: unknown }).packs) &&
    (value as { packs: unknown[] }).packs.every(isConversationPack);
}

async function read(key: string): Promise<ConversationPack[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return readable(parsed) ? orderedConversationPacks(parsed.packs) : [];
  } catch {
    return [];
  }
}

/** Packs are server-owned, so a successful pull replaces a stale local view. */
export function replaceConversationPacks(packs: readonly ConversationPack[]): Promise<void> {
  return serialised(async (key) => {
    const ordered = orderedConversationPacks(packs);
    await AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, packs: ordered } satisfies StoredConversationPacks));
  });
}

export function loadConversationPacks(): Promise<ConversationPack[]> {
  return read(KEY());
}

export type ConversationPackSync = { ok: true; packs: ConversationPack[] } | { ok: false };

/**
 * Pull the source of truth, then bank pack exercises in the existing drill
 * store. This lets an interrupted post-session delivery recover without a
 * second practice system or a second set of review cards.
 */
export async function refreshConversationPacks(
  user: AuthUser,
  adapter: AuthAdapter,
  request: typeof fetch = fetch,
): Promise<ConversationPackSync> {
  if (adapter.kind !== 'supabase') return { ok: false };
  const token = await adapter.getAccessToken();
  if (!token) return { ok: false };
  try {
    const response = await request(`${TOKEN_SERVER}/conversation-packs`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false };
    const body: unknown = await response.json();
    const packs = typeof body === 'object' && body !== null && Array.isArray((body as { packs?: unknown }).packs)
      ? (body as { packs: unknown[] }).packs.filter((pack): pack is ConversationPack => isConversationPack(pack) && pack.learnerId === user.id)
      : [];
    const ordered = orderedConversationPacks(packs);
    await replaceConversationPacks(ordered);
    await mergeExercises(ordered.flatMap((pack) => pack.exercises));
    return { ok: true, packs: ordered };
  } catch {
    return { ok: false };
  }
}

onUserScopeReset(() => {
  writeChain = Promise.resolve();
});
