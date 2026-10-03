/**
 * The situations a learner saved, on the device.
 *
 * Storage shell only, the same shape as missions/store.ts: a versioned
 * envelope, a serialised write chain, an adopter and a scope reset. What the
 * saved list is called and how it reads belongs to `bookmarks/view.ts`.
 *
 * **A set of saved ids would have been smaller and it would have been wrong.**
 * A union of two sets can only ever add, so an un-save on one phone comes back
 * the moment another device folds its older copy in, and it comes back silently
 * and repeatedly. So every row is stored per item, with the state the learner
 * chose and the moment they chose it, and the merge takes the newer of the two
 * states. Removing something is a decision, and a store that cannot express one
 * cannot keep it.
 *
 * **The device clock decides which of two states is newer, and that is the one
 * clock this file trusts.** There is no other evidence to order two taps by:
 * nothing about a bookmark counts up the way grades or sessions do. The cost is
 * the honest one, and it is small. Two phones whose clocks disagree by minutes,
 * both toggling the same situation inside that window, settle on the tap the
 * clocks call later rather than the tap that happened later. What that costs a
 * learner is one tap on a row they can see the state of.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistAck } from '../storage/ack.ts';
import { readOwnedCache } from '../storage/ownedRead.ts';
import { onUserScopeReset, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('bookmarks');

// v2 protects the larger daily collection from older clients' 200-row cap.
const VERSION = 2;

/**
 * How many situations a learner may have an opinion about.
 *
 * The pool is large and every un-save keeps a row, so this store grows with
 * taps rather than with saves and needs a bound of its own. The discard rule is
 * the oldest decision: a row nobody has touched in two hundred taps is the one
 * a learner is least likely to notice going.
 */
export const MAX_BOOKMARKS = 3000;

export interface BookmarkItem {
  /** Which situation, by the daily pool's own id. */
  scenarioId: string;
  /** Epoch milliseconds the learner last decided, injected by the caller. */
  at: number;
  /** What they decided. `false` is a real row, and that is the whole point. */
  saved: boolean;
}

interface StoredBookmarks {
  version: 1 | typeof VERSION;
  items: BookmarkItem[];
}

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

let writeChain: Promise<unknown> = Promise.resolve();

interface Bound { key: string; generation: number }

function serialized<T>(mutation: (bound: Bound) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const bound = { key: KEY(), generation: scopeGeneration() };
  const run = () => mutation(bound);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isItem(value: unknown): value is BookmarkItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.scenarioId === 'string' &&
    item.scenarioId.length > 0 &&
    typeof item.at === 'number' &&
    Number.isFinite(item.at) &&
    typeof item.saved === 'boolean'
  );
}

/**
 * Byte-stable rendering, used only to break a tie between two decisions
 * claiming the same instant. The same primitive `sync/policy.ts` orders by,
 * restated rather than imported because that file must load under plain node
 * and this one reaches AsyncStorage.
 */
function canonical(item: BookmarkItem): string {
  return JSON.stringify([item.scenarioId, item.at, item.saved]);
}

/** The later of two decisions about one situation. A max, so folding twice is a no-op. */
function newerOf(x: BookmarkItem, y: BookmarkItem): BookmarkItem {
  if (x.at !== y.at) return x.at > y.at ? x : y;
  return canonical(x) >= canonical(y) ? x : y;
}

/**
 * One row per situation, oldest decision first, capped.
 *
 * The order is part of the bytes, and the bytes have to match what the merge
 * policy produces from the same set: a row differing from the account's by
 * nothing but array order is re-adopted on every cycle, forever.
 */
function ordered(items: readonly BookmarkItem[]): BookmarkItem[] {
  const held = new Map<string, BookmarkItem>();
  for (const item of items) {
    const seen = held.get(item.scenarioId);
    held.set(item.scenarioId, seen === undefined ? item : newerOf(seen, item));
  }
  return [...held.values()]
    .sort((a, b) => a.at - b.at || (a.scenarioId < b.scenarioId ? -1 : a.scenarioId > b.scenarioId ? 1 : 0))
    .slice(-MAX_BOOKMARKS);
}

function readableBookmarks(value: unknown): value is StoredBookmarks {
  if (typeof value !== 'object' || value === null) return false;
  const stored = value as Partial<StoredBookmarks>;
  return [1, VERSION].includes(stored.version ?? 0) && Array.isArray(stored.items) && stored.items.every(isItem);
}

async function readItems(key: string): Promise<BookmarkItem[]> {
  const raw = await AsyncStorage.getItem(key);
  const parsed = readOwnedCache(raw, readableBookmarks);
  return parsed === null ? [] : parsed.items;
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 */
async function persistedItems(key: string): Promise<unknown> {
  return readOwnedCache(await AsyncStorage.getItem(key), readableBookmarks);
}

async function saveItems(bound: Bound, items: readonly BookmarkItem[], origin: WriteOrigin): Promise<PersistAck> {
  try {
    const written = await writeInUserScope(bound.generation, () =>
      AsyncStorage.setItem(bound.key, JSON.stringify({ version: VERSION, items: [...items] } satisfies StoredBookmarks)));
    if (!written) return 'failed';
    if (origin === 'local') markDirty('bookmarks');
    return 'durable';
  } catch {
    return 'failed';
  }
}

/**
 * Every decision this learner has made, saved and un-saved alike.
 *
 * The un-saved rows are handed out rather than filtered here on purpose: this
 * file holds the record and `bookmarks/view.ts` decides what a list of saved
 * situations is.
 */
export function loadBookmarks(): Promise<BookmarkItem[]> {
  return readItems(KEY());
}

/** Save or un-save one situation. The newer decision replaces the older one. */
export function setBookmark(scenarioId: string, saved: boolean, now = Date.now()): Promise<void> {
  return serialized(async (bound) => {
    const item: BookmarkItem = { scenarioId, at: now, saved };
    if (!isItem(item)) return;
    const existing = await readItems(bound.key);
    if (await saveItems(bound, ordered([...existing, item]), 'local') !== 'durable') throw new Error('Bookmark was not saved');
  });
}

/**
 * Fold the account's bookmarks into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished set, because it read this
 * key before the pull: a situation saved during the round trip would otherwise
 * be written over by a list computed before the tap. The union is by situation
 * with the newer decision winning, so folding twice is the same as folding
 * once, and the order and the cap are re-applied here rather than trusted from
 * the wire so that the disk ends up holding exactly what the engine is about to
 * push.
 */
function adoptBookmarks(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (bound) => {
    if (scopeGeneration() !== bound.generation) throw new Error('Bookmark account changed before adoption');
    const folded = fold(await persistedItems(bound.key));
    if (!readableBookmarks(folded) || folded.version !== VERSION) return 'declined';
    if (await saveItems(bound, ordered(folded.items), 'adopted') !== 'durable') throw new Error('Bookmark adoption was not durable');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('bookmarks', adoptBookmarks);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
