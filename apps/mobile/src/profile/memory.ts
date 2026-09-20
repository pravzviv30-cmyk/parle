/**
 * What the tutor remembers, as something the learner can see and edit (F562).
 *
 * The brain keeps up to twelve facts about the learner's life, written by the
 * post-session extraction and sent, the last five of them, into every new
 * scene. Until now no screen read them and nothing could remove one. This
 * module is every write the learner can make to that memory, and the one
 * place the session snapshot is composed.
 *
 * ## A forgotten fact is a tombstone
 *
 * `applyExtractionToProfile` dedupes a new fact against the facts already
 * held, on `normalise(fact.en)`. So a fact merely deleted from the brain
 * returns the next session that mentions it: the extraction sees nothing on
 * file and writes it again. A forget is therefore kept as the normalised key
 * in `StoredProfile.forgottenFacts`, and applied twice: to the brain at the
 * moment of forgetting, and to every recap's brain at the one write in
 * `ProfileContext.updateBrain`. The brain's merge unions the tombstones across
 * devices, so a forget on either phone is a forget on both.
 *
 * ## A goal rides last, or never
 *
 * The agent sends `facts.slice(-5)`. A goal placed at the head of the list
 * would be the first thing dropped; appended after the remembered facts it is
 * always among the five. The cap is the brain's own `MAX_MEMORY_FACTS`, taken
 * from the end, so the goals survive the cap too.
 *
 * ## What leaves the phone
 *
 * `snapshotFor` is what rides the join credential: the brain with the
 * learner's name folded in (as `withLearnerName` always did), the tombstones
 * applied, and the goals appended. The legal notice names the goals among what
 * the language model is sent, and says the facts can be removed here.
 */

import { normalise, reviewFocusFromDeck, type ReviewCard, type TutorReviewFocus } from '@luvani/core';
import { MAX_MEMORY_FACTS, withLearnerName, type LearnerProfile, type RememberedFact } from '@luvani/brain/profile';

import type { StoredProfile } from './store.ts';

/** Tombstones kept. Beyond this the oldest forget goes, which lets that fact return. */
export const MAX_FORGOTTEN_FACTS = 40;
/** Goals kept. Three is a promise a person can hold in their head. */
export const MAX_LEARNER_GOALS = 3;
/** One line. The same ceiling the seed topic keeps, for the same wire. */
export const MAX_GOAL_CHARS = 120;

/** The key a fact is forgotten under: the extraction's own dedupe key. */
export function factKey(en: string): string {
  return normalise(en);
}

/**
 * A stored list of tombstones, read sceptically: strings only, each a key
 * this module could have written, deduped, the newest kept. Used by the
 * version chain, so junk in the slot reads as no forget rather than as one.
 */
export function storedForgottenFacts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const key = factKey(raw);
    if (key.length === 0 || keys.includes(key)) continue;
    keys.push(key);
  }
  return keys.slice(-MAX_FORGOTTEN_FACTS);
}

/** One goal as this module keeps it, or null when there is nothing to keep. */
function goalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_GOAL_CHARS).trim();
  return text.length === 0 ? null : text;
}

/** A stored list of goals, read the same way: strings, trimmed, deduped, the last three. */
export function storedLearnerGoals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const goals: string[] = [];
  for (const raw of value) {
    const text = goalText(raw);
    if (text === null || goals.some((goal) => normalise(goal) === normalise(text))) continue;
    goals.push(text);
  }
  return goals.slice(-MAX_LEARNER_GOALS);
}

/** The brain without any fact the learner asked to forget. Pure. */
export function withoutForgotten(brain: LearnerProfile, forgotten: readonly string[]): LearnerProfile {
  if (forgotten.length === 0) return brain;
  const gone = new Set(forgotten);
  const facts = brain.memory.facts.filter((fact) => !gone.has(factKey(fact.en)));
  return facts.length === brain.memory.facts.length ? brain : { ...brain, memory: { ...brain.memory, facts } };
}

/** The facts the learner can see: what the brain holds, minus the tombstoned. */
export function visibleFacts(profile: StoredProfile): readonly RememberedFact[] {
  return withoutForgotten(profile.brain, profile.forgottenFacts).memory.facts;
}

/**
 * Forget one fact. The tombstone is written and the fact leaves the brain in
 * the same step, so the screen and the next snapshot agree at once.
 */
export function withFactForgotten(profile: StoredProfile, en: string): StoredProfile {
  const key = factKey(en);
  if (key.length === 0) return profile;
  const forgottenFacts = [...profile.forgottenFacts.filter((held) => held !== key), key].slice(-MAX_FORGOTTEN_FACTS);
  return { ...profile, forgottenFacts, brain: withoutForgotten(profile.brain, forgottenFacts) };
}

/** Replace a remembered detail and retire the old wording from future extraction. */
export function withFactEdited(profile: StoredProfile, original: string, replacement: string): StoredProfile {
  const text = goalText(replacement);
  const fact = visibleFacts(profile).find((item) => item.en === original);
  if (text === null || fact === undefined || text === original) return profile;
  const next = withFactForgotten(profile, original);
  const key = factKey(text);
  const facts = next.brain.memory.facts.filter((item) => factKey(item.en) !== key);
  return {
    ...next,
    forgottenFacts: next.forgottenFacts.filter((held) => held !== key),
    brain: { ...next.brain, memory: { ...next.brain.memory, opener: null, facts: [...facts, { ...fact, en: text, fr: null }].slice(-MAX_MEMORY_FACTS) } },
  };
}

/** Edit in place, preserving the other goals and the existing goal limit. */
export function withGoalEdited(profile: StoredProfile, original: string, replacement: string): StoredProfile {
  const text = goalText(replacement);
  if (text === null) return profile;
  return { ...profile, learnerGoals: storedLearnerGoals(profile.learnerGoals.map((goal) => goal === original ? text : goal)) };
}

/**
 * Forget everything. Every fact currently held becomes a tombstone, and the
 * opener goes with them: it was written from those facts and would greet the
 * learner with something they just asked to forget.
 */
export function withMemoryCleared(profile: StoredProfile): StoredProfile {
  const keys = profile.brain.memory.facts.map((fact) => factKey(fact.en)).filter((key) => key.length > 0);
  const forgottenFacts = storedForgottenFacts([...profile.forgottenFacts, ...keys]);
  return {
    ...profile,
    forgottenFacts,
    brain: { ...profile.brain, memory: { ...profile.brain.memory, facts: [], opener: null } },
  };
}

/** Write a goal. A blank writes nothing; a repeat is not a second goal; the last three stay. */
export function withLearnerGoal(profile: StoredProfile, text: string): StoredProfile {
  const goal = goalText(text);
  if (goal === null) return profile;
  return { ...profile, learnerGoals: storedLearnerGoals([...profile.learnerGoals, goal]) };
}

/** Remove a goal, by its own text. */
export function withoutLearnerGoal(profile: StoredProfile, text: string): StoredProfile {
  return { ...profile, learnerGoals: profile.learnerGoals.filter((goal) => goal !== text) };
}

/** How a goal reads to the tutor. The learner's own words, said to be theirs. */
export function goalFact(goal: string): RememberedFact {
  return { kind: 'goal', fr: null, en: `Their goal: ${goal}`, happensAround: null, notedAt: '' };
}

/**
 * The brain as it rides the join credential: the name folded in, the
 * tombstones applied, the goals appended last, and the brain's own cap taken
 * from the end so the goals survive it.
 */
export function snapshotFor(profile: StoredProfile, deck: readonly ReviewCard[] = [], now = Date.now()): LearnerProfile & { reviewFocus?: TutorReviewFocus[] } {
  const named = withLearnerName(withoutForgotten(profile.brain, profile.forgottenFacts), profile.name);
  const focus = reviewFocusFromDeck(deck, now);
  const extras = focus.length ? { reviewFocus: focus } : {};
  if (profile.learnerGoals.length === 0) return { ...named, ...extras };
  const facts = [...named.memory.facts, ...profile.learnerGoals.map(goalFact)].slice(-MAX_MEMORY_FACTS);
  return { ...named, ...extras, memory: { ...named.memory, facts } };
}
