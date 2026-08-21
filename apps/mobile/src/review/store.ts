/**
 * The review deck on the device.
 *
 * AsyncStorage is enough for now. The deck is one small JSON array, the
 * scheduling math lives in @parle/core, and nothing here needs a backend —
 * reviewing must cost zero metered minutes, so nothing here may ever grow a
 * network call either. When accounts arrive this file is the only thing that
 * changes.
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

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('review');

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

async function saveDeck(key: string, deck: readonly ReviewCard[]): Promise<void> {
  const next = [...deck];
  caches.set(key, Promise.resolve(next));
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
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
    await saveDeck(key, mergeCards(existing, incoming));
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
    await saveDeck(key, mergeCards(existing, incoming));
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
    await saveDeck(key, updated);
    return updated;
  });
}

/** How many cards are waiting right now. Capped upstream at one calm sitting. */
export async function dueCount(now = Date.now()): Promise<number> {
  return dueCards(await loadDeck(), now).length;
}
