/**
 * The review deck on the device.
 *
 * AsyncStorage is enough for now. The deck is one small JSON array, the
 * scheduling math lives in @parle/core, and nothing here needs a backend —
 * reviewing must cost zero metered minutes, so nothing here may ever grow a
 * network call either. When accounts arrive this file is the only thing that
 * changes.
 *
 * The deck does reach the account now, but never from here: a local write is
 * flagged for the sync engine and the engine hands merged decks back through
 * `adoptDeck` below. Reviewing itself is still a disk read and a disk write, on
 * a plane, for free.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyGrade,
  buildCardsFromSummary,
  dueCards,
  mergeCards,
  newCard,
  staggerNewCards,
  LESSONS,
  type ConvoPhrase,
  type ReviewCard,
  type ReviewGrade,
  type SessionSummary,
} from '@parle/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('review');

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

/**
 * All writers share one key via read-modify-write, and two of them are fired
 * without awaiting (a session summary and its recap phrases can land in the
 * same beat). Chaining every mutation through one promise makes lost updates
 * impossible without reaching for anything heavier than a queue of one.
 */
let writeChain: Promise<unknown> = Promise.resolve();
const caches = new Map<string, Promise<ReviewCard[]>>();

onUserScopeReset(() => {
  caches.clear();
});

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

async function readDeck(key: string): Promise<ReviewCard[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReviewCard[]) : [];
  } catch {
    // A corrupt deck is not worth crashing over. Start fresh.
    return [];
  }
}

/**
 * The deck exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Deliberately not `loadDeckFor`. The cache answers a missing key with an empty
 * deck, and the merge policy has to be able to tell "no deck here" from "a deck
 * with nothing in it" — the first has no claim on anything, the second is a
 * learner who cleared theirs.
 */
async function persistedDeck(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // Unreadable is the same as absent here: the fold merges against nothing
    // and the account's deck is adopted whole, which is what a fresh device does.
    return null;
  }
}

/** The least a card must be to have an identity the merge can carry. */
function isCard(value: unknown): value is ReviewCard {
  return typeof value === 'object' && value !== null && typeof (value as ReviewCard).id === 'string';
}

function loadDeckFor(key: string): Promise<ReviewCard[]> {
  const cached = caches.get(key);
  if (cached) return cached;
  const pending = readDeck(key);
  caches.set(key, pending);
  return pending;
}

export function loadDeck(): Promise<ReviewCard[]> {
  return loadDeckFor(KEY());
}

async function saveDeck(key: string, deck: readonly ReviewCard[], origin: WriteOrigin): Promise<void> {
  const next = [...deck];
  caches.set(key, Promise.resolve(next));
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (origin === 'local') markDirty('review');
  } catch {
    // Storage full or unavailable. The deck still works for this launch.
  }
}

/**
 * Fold a finished session's cards into the deck.
 *
 * Merge, never replace: a card the learner has been reviewing keeps its
 * scheduling even when a new session produces the same word again.
 */
export function addFromSummary(summary: SessionSummary): Promise<void> {
  return serialized(async (key) => {
    const existing = await loadDeckFor(key);
    const incoming = buildCardsFromSummary(summary, LESSONS, Date.now());
    await saveDeck(key, mergeCards(existing, incoming), 'local');
  });
}

/**
 * Fold a free conversation's new phrases into the deck.
 *
 * Same merge contract as `addFromSummary`: identity is the French line itself,
 * so a phrase the learner is already reviewing keeps its scheduling when a
 * later conversation surfaces it again.
 *
 * `stagger` spaces a session's genuinely-new cards (core's rule: the first
 * few due now, the rest tomorrow) so one conversation never builds a wall of
 * due cards. Cards already in the deck keep their scheduling either way —
 * that is `mergeCards`' contract, not this function's choice.
 */
export async function addPhrases(phrases: readonly ConvoPhrase[], opts: { stagger?: boolean } = {}): Promise<void> {
  const now = Date.now();
  let incoming = phrases
    .filter((p) => p.fr.trim() !== '')
    .map((p) =>
      newCard(
        {
          id: `phrase:${p.fr.trim().toLowerCase()}`,
          kind: 'vocab',
          front: p.fr,
          back: p.enLiteral ? `${p.en} (literally: ${p.enLiteral})` : p.en,
          context: p.note ?? '',
          ipa: '',
        },
        now,
      ),
    );
  if (incoming.length === 0) return;
  if (opts.stagger) incoming = staggerNewCards(incoming, now);
  await serialized(async (key) => {
    const existing = await loadDeckFor(key);
    await saveDeck(key, mergeCards(existing, incoming), 'local');
  });
}

/** Apply one grade to one card, persist, and return the updated deck. */
export function gradeCard(id: string, grade: ReviewGrade): Promise<ReviewCard[]> {
  return gradeCards([{ id, grade }]);
}

/** Apply a whole sitting in one read and one compact write. */
export function gradeCards(grades: readonly { id: string; grade: ReviewGrade }[]): Promise<ReviewCard[]> {
  return serialized(async (key) => {
    let updated = await loadDeckFor(key);
    const now = Date.now();
    for (const { id, grade } of grades) {
      updated = updated.map((card) => (card.id === id ? applyGrade(card, grade, now) : card));
    }
    await saveDeck(key, updated, 'local');
    return updated;
  });
}

/** How many cards are waiting right now. Capped upstream at one calm sitting. */
export async function dueCount(now = Date.now()): Promise<number> {
  return dueCards(await loadDeck(), now).length;
}

/**
 * Fold the account's deck into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished deck, and the difference
 * is a learner's work. The engine read this key, spent a network round trip on
 * the pull, and only then adopted; a grade the learner applied in between was
 * written over by a deck computed before it existed, and — because the grade
 * left its dirty flag up — pushed to the account and lost on every device. So
 * the fold is called *here*, inside the chain, between the read and the write,
 * with the deck this store holds at that instant. Nothing is awaited between
 * the two, because the chain is the only place in this store where that is
 * true. Folding is safe rather than clever: core's `mergeDecks` is commutative
 * and idempotent, so folding a merge into a newer deck cannot lose either side.
 *
 * Scheduling is never recomputed here. Whatever due dates and intervals the
 * merge preserved are written down exactly as they arrived; deciding which of
 * two cards' scheduling survives is core's job, not this store's.
 */
function adoptDeck(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key) => {
    const folded = fold(await persistedDeck(key));
    // Validated the way anything off disk is: the fold merged in a payload
    // another device wrote, on a build this one has never seen.
    if (!Array.isArray(folded)) return 'declined';
    await saveDeck(key, folded.filter(isCard), 'adopted');
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('review', adoptDeck);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
