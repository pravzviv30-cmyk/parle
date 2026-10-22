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

import { DRILL_FIXTURES, type DrillExercise } from '@luvani/core';

/**
 * A generous offline bank, bounded so parsing and rendering never grow forever.
 *
 * The shipped fixtures are the floor above the cap, so the cap must sit well
 * above `DRILL_FIXTURES.length` or tutor-written drills get no room at all. At
 * about 195 fixtures (two per mission phrase after mission-spine A2), 256 keeps
 * roughly 60 slots for generated drills. fixturesMissing.test.ts fails when fixtures plus
 * `MIN_GENERATED_HEADROOM` pass this cap: raise it with the content, not after.
 */
export const MAX_DRILL_EXERCISES = 256;

/** The fewest generated drills the bank must hold room for beside every fixture. */
export const MIN_GENERATED_HEADROOM = 48;

/**
 * Fixtures an already-stored bank should gain on read. Stored choices win:
 * a phrase the learner already holds any exercise for gains nothing, except
 * the authored own-words rung when that phrase has no own-words yet. A phrase
 * with no exercise at all (a newly shipped mission) gains all its fixtures.
 */
export function fixturesMissingFrom(
  bank: readonly DrillExercise[],
  fixtures: readonly DrillExercise[] = DRILL_FIXTURES,
): DrillExercise[] {
  const heldPhrases = new Set(bank.map(saved => saved.phraseKey));
  return fixtures.filter(fixture =>
    !heldPhrases.has(fixture.phraseKey) ||
    (fixture.kind === 'own-words' && !bank.some(saved =>
      saved.phraseKey === fixture.phraseKey && saved.kind === fixture.kind)));
}

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

  // Only the shipped formats are the offline floor. A pack's authored id is
  // still learner-specific material, not an immortal fixture. Reserve the
  // fixture formats, then prefer this batch and the newest remaining rows.
  const fixtureFormats = new Set(DRILL_FIXTURES.map(exerciseIdentity));
  const floor = merged.filter(exercise => fixtureFormats.has(exerciseIdentity(exercise)));
  const variable = merged.filter(exercise => !fixtureFormats.has(exerciseIdentity(exercise)));
  const incomingFormats = new Set(incoming.map(exerciseIdentity));
  const fresh = variable.filter(exercise => incomingFormats.has(exerciseIdentity(exercise)));
  const older = variable.filter(exercise => !incomingFormats.has(exerciseIdentity(exercise)));
  const room = Math.max(0, MAX_DRILL_EXERCISES - floor.length);
  const heldFresh = room === 0 ? [] : fresh.slice(-room);
  const olderRoom = Math.max(0, room - heldFresh.length);
  return [...floor.slice(0, MAX_DRILL_EXERCISES), ...(olderRoom === 0 ? [] : older.slice(-olderRoom)), ...(room === 0 ? [] : heldFresh)];
}
