/** Local cache for server-owned Conversation Packs. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isConversationPack, normaliseConversationPacks, type ConversationPack } from '@luvani/core';
import type { AuthAdapter, AuthUser } from '../auth/types.ts';
import { mergeExercises } from '../drill/store.ts';
import { packExercisesFor, reviewPhrasesFor } from './packExercises.ts';
import { addPhrases } from '../review/store.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { activeUserId, onUserScopeReset, userKey } from '../storage/scope.ts';
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
    // Normalised here rather than by each reader. `isConversationPack` accepts
    // a pack written before `topics` and `durationSec` existed, so the fields
    // the type promises can be absent on anything already on disk. Paying that
    // once at the boundary is what stopped Practice going blank on a real
    // learner's phone (F449).
    return readable(parsed) ? normaliseConversationPacks(orderedConversationPacks(parsed.packs)) : [];
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
export type ConversationPackMutation = { ok: true; packs: ConversationPack[] } | { ok: false; message: string };

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
  try {
    // Inside the try, not above it. `getAccessToken` refreshes the session over
    // the network when the access token is stale, so an expired refresh token
    // on a poor connection rejects here. Outside, that rejection escaped as an
    // unhandled one into whichever screen asked, rather than becoming the
    // `{ ok: false }` every caller is written against.
    const token = await adapter.getAccessToken();
    if (!token) return { ok: false };
    const response = await request(`${TOKEN_SERVER}/conversation-packs`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false };
    const body: unknown = await response.json();
    const packs = typeof body === 'object' && body !== null && Array.isArray((body as { packs?: unknown }).packs)
      ? (body as { packs: unknown[] }).packs.filter((pack): pack is ConversationPack => isConversationPack(pack) && pack.learnerId === user.id)
      : [];
    const ordered = normaliseConversationPacks(orderedConversationPacks(packs));
    if (activeUserId() !== user.id) return { ok: false };
    await replaceConversationPacks(ordered);
    if (activeUserId() !== user.id) return { ok: false };
    // A disconnected recap can lose the phrase packet too. Restoring only the
    // exercises leaves Drill with no review cards to schedule. Merge by phrase
    // identity, with no invented conversation-use or mastery evidence.
    await addPhrases(ordered.filter((pack) => pack.state === 'ready').flatMap(reviewPhrasesFor), { stagger: true });
    if (activeUserId() !== user.id) return { ok: false };
    await mergeExercises(ordered.flatMap((pack) => pack.exercises));
    // The repair and the repeats the server does not write (F553), keyed so
    // the bank folds them beside the server's own pairs rather than over them.
    if (activeUserId() !== user.id) return { ok: false };
    await mergeExercises(ordered.flatMap(packExercisesFor));
    return { ok: true, packs: ordered };
  } catch {
    return { ok: false };
  }
}

async function authorisedDelete(
  user: AuthUser,
  adapter: AuthAdapter,
  path: string,
  locally: (packs: readonly ConversationPack[]) => ConversationPack[],
  request: typeof fetch = fetch,
): Promise<ConversationPackMutation> {
  const current = await loadConversationPacks();
  // The local adapter has no server-owned Pack table. Keeping this path useful
  // for demos makes its privacy control truthful without pretending there was
  // anything to delete remotely.
  if (adapter.kind !== 'supabase') {
    const packs = locally(current);
    await replaceConversationPacks(packs);
    return { ok: true, packs };
  }
  const token = await adapter.getAccessToken();
  if (!token) return { ok: false, message: 'Please sign in again before changing your Tutor history.' };
  try {
    const response = await request(`${TOKEN_SERVER}${path}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, message: 'Your Tutor history was not changed. Please try again.' };
    const packs = locally(current).filter((pack) => pack.learnerId === user.id);
    await replaceConversationPacks(packs);
    return { ok: true, packs };
  } catch {
    return { ok: false, message: 'Your Tutor history was not changed. Check your connection and try again.' };
  }
}

/** Delete one Pack from the server and then replace only the local cache view. */
export function deleteConversationPackForLearner(
  user: AuthUser,
  adapter: AuthAdapter,
  packId: string,
  request: typeof fetch = fetch,
): Promise<ConversationPackMutation> {
  return authorisedDelete(user, adapter, `/conversation-packs/${encodeURIComponent(packId)}`, (packs) => packs.filter((pack) => pack.id !== packId), request);
}

/** Delete all curated conversation history while leaving earned drills intact. */
export function deleteAllConversationPacksForLearner(
  user: AuthUser,
  adapter: AuthAdapter,
  request: typeof fetch = fetch,
): Promise<ConversationPackMutation> {
  return authorisedDelete(user, adapter, '/conversation-packs', () => [], request);
}

onUserScopeReset(() => {
  writeChain = Promise.resolve();
});
