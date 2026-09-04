/**
 * The drill bank's merge rule, pure.
 *
 * Extracted from store.ts so it can be tested under plain node: the store
 * imports AsyncStorage, which no node test can load, and this fold is the one
 * part of that file a learner would feel go wrong. Same split the topics store
 * states in its own header — store.ts keeps the versioned envelope, the
 * load-once cache and the write chain, and this decides what the bank holds
 * once a batch has landed.
 *
 * Replace, never accumulate. A regenerated drill for the same phrase in the
 * same format takes the earlier take's slot, so a learner is never asked the
 * same phrase in the same format twice in one sitting. `(phraseKey, kind, direction)`
 * is the real identity for a directional translation; every other kind has no
 * direction. A batch is free to re-issue ids, and two exercises for one phrase
 * in two different formats are two different drills, both wanted.
 *
 * Plain `id` is the fallback, for batches that kept their ids while changing
 * key or kind — that exercise still has a home, it just moved. When a match on
 * key-and-kind and a match on id land on two different rows, the id row goes:
 * one incoming exercise can only leave one exercise behind.
 */

import type { DrillExercise } from '@luvani/core';

/** A generous offline bank, bounded so parsing and rendering never grow forever. */
export const MAX_DRILL_EXERCISES = 160;

/**
 * A translation in each direction is two different retrieval tasks. Keep the
 * direction inside the identity so a French-to-English prompt cannot replace
 * the reverse prompt when a Conversation Pack reaches the ordinary drill bank.
 */
export function exerciseIdentity(exercise: DrillExercise): string {
  return exercise.kind === 'translate'
    ? `${exercise.phraseKey}\u0000${exercise.kind}\u0000${exercise.direction}`
    : `${exercise.phraseKey}\u0000${exercise.kind}`;
}

/**
 * The bank after `incoming` lands on it. Neither argument is mutated; the
 * caller owns what it does with the result.
 */
export function mergeExerciseBank(
  bank: readonly DrillExercise[],
  incoming: readonly DrillExercise[],
): DrillExercise[] {
  const merged: DrillExercise[] = [...bank];
  for (const exercise of incoming) {
    const byKey = merged.findIndex((e) => exerciseIdentity(e) === exerciseIdentity(exercise));
    const byId = merged.findIndex((e) => e.id === exercise.id);
    if (byKey !== -1) {
      merged[byKey] = exercise;
      // The id it used to carry cannot stay behind as a second copy of itself.
      if (byId !== -1 && byId !== byKey) merged.splice(byId, 1);
    } else if (byId !== -1) {
      merged[byId] = exercise;
    } else {
      merged.push(exercise);
    }
  }
  if (merged.length <= MAX_DRILL_EXERCISES) return merged;

  // Authored fixtures are the reliable offline floor. Generated variations are
  // the part that ages, so retain the newest ones inside the remaining budget.
  const authored = merged.filter((exercise) => !exercise.id.startsWith('gen:'));
  const generated = merged.filter((exercise) => exercise.id.startsWith('gen:'));
  const room = Math.max(0, MAX_DRILL_EXERCISES - authored.length);
  return [
    ...authored.slice(0, MAX_DRILL_EXERCISES),
    ...(room === 0 ? [] : generated.slice(-room)),
  ];
}
