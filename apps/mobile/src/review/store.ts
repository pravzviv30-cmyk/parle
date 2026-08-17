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
  LESSONS,
  type ConvoPhrase,
  type ReviewCard,
  type ReviewGrade,
  type SessionSummary,
} from '@parle/core';

const KEY = 'parle.review.v1';

/**
 * All writers share one key via read-modify-write, and two of them are fired
 * without awaiting (a session summary and its recap phrases can land in the
 * same beat). Chaining every mutation through one promise makes lost updates
 * impossible without reaching for anything heavier than a queue of one.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(mutation, mutation);
  writeChain = next.catch(() => {});
  return next;
}

export async function loadDeck(): Promise<ReviewCard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReviewCard[]) : [];
  } catch {
    // A corrupt deck is not worth crashing over. Start fresh.
    return [];
  }
}

async function saveDeck(deck: readonly ReviewCard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(deck));
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
  return serialized(async () => {
    const existing = await loadDeck();
    const incoming = buildCardsFromSummary(summary, LESSONS, Date.now());
    await saveDeck(mergeCards(existing, incoming));
  });
}

/**
 * Fold a free conversation's new phrases into the deck.
 *
 * Same merge contract as `addFromSummary`: identity is the French line itself,
 * so a phrase the learner is already reviewing keeps its scheduling when a
 * later conversation surfaces it again.
 */
export async function addPhrases(phrases: readonly ConvoPhrase[]): Promise<void> {
  const now = Date.now();
  const incoming = phrases
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
  await serialized(async () => {
    const existing = await loadDeck();
    await saveDeck(mergeCards(existing, incoming));
  });
}

/** Apply one grade to one card, persist, and return the updated deck. */
export function gradeCard(id: string, grade: ReviewGrade): Promise<ReviewCard[]> {
  return serialized(async () => {
    const deck = await loadDeck();
    const updated = deck.map((c) => (c.id === id ? applyGrade(c, grade, Date.now()) : c));
    await saveDeck(updated);
    return updated;
  });
}

/** How many cards are waiting right now. Capped upstream at one calm sitting. */
export async function dueCount(now = Date.now()): Promise<number> {
  return dueCards(await loadDeck(), now).length;
}
