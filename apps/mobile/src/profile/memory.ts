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
 * ## A goal rides beside the facts, never among them
 *
 * The learner's typed goals ride the snapshot as `memory.learnerGoals`, a
 * wire-only field, not as facts. `StoredProfile.learnerGoals` is their only
 * home: `brainAfterRecap` drops the field from the agent's echo, so a goal
 * never becomes a stored fact, never duplicates, and leaves with its removal.
 * The twelve-fact cap is the extraction's alone. Older builds appended goals
 * as "Their goal: …" facts and a recap stored them; `withoutGoalEchoes`
 * cleans those on read and on the next recap (LEARN-009).
 *
 * ## What leaves the phone
 *
 * `snapshotFor` is what rides the join credential: the brain with the
 * learner's name folded in (as `withLearnerName` always did), the tombstones
 * applied, and the goals beside the facts. The legal notice names the goals among what
 * the language model is sent, and says the facts can be removed here.
 */

import { isLearnerGoal, normalise, parsePreviousCorrection, phraseKeyOf, reviewFocusFromDeck, type ConversationPack, type ReviewCard, type TutorReviewFocus, type TutorPreviousCorrection } from '@luvani/core';
import { MAX_MEMORY_FACTS, validFactSource, withLearnerName, memoryPaused, withoutForgottenMemory, type LearnerProfile, type RememberedFact } from '@luvani/brain/profile';

import type { StoredProfile } from './store.ts';

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
 * this module could have written, deduped, with no expiry or count-based eviction. Used by the
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
  return keys;
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
  return withoutForgottenMemory(brain, forgotten);
}

/** The facts the learner can see: what the brain holds, minus the tombstoned. */
export function visibleFacts(profile: StoredProfile): readonly RememberedFact[] {
  return withoutForgotten(withoutGoalEchoes(profile.brain), profile.forgottenFacts).memory.facts;
}

/**
 * Forget one fact. The tombstone is written and the fact leaves the brain in
 * the same step, so the screen and the next snapshot agree at once.
 */
export function withFactForgotten(profile: StoredProfile, en: string): StoredProfile {
  const key = factKey(en);
  if (key.length === 0) return profile;
  const forgottenFacts = [...profile.forgottenFacts.filter((held) => held !== key), key];
  return { ...profile, forgottenFacts, brain: withoutForgotten(profile.brain, forgottenFacts) };
}

/** Replace a remembered detail and retire the old wording from future extraction. */
export function withFactEdited(profile: StoredProfile, original: string, replacement: string, now = Date.now()): StoredProfile {
  const text = goalText(replacement);
  const fact = visibleFacts(profile).find((item) => item.en === original);
  if (text === null || fact === undefined || text === original) return profile;
  const next = withFactForgotten(profile, original);
  const key = factKey(text);
  const facts = next.brain.memory.facts.filter((item) => factKey(item.en) !== key);
  return {
    ...next,
    forgottenFacts: next.forgottenFacts.filter((held) => held !== key),
    brain: { ...next.brain, memory: { ...next.brain.memory, opener: null, facts: [...facts, { ...fact, en: text, fr: null, source: 'learner' as const, updatedAt: new Date(now).toISOString() }].slice(-MAX_MEMORY_FACTS) } },
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

/**
 * The brain without the goal facts older builds appended to the snapshot and
 * a recap then stored: exactly kind 'goal', no `notedAt`, and the old
 * "Their goal: " wording. A goal the extraction wrote has a `notedAt` and stays.
 */
export function withoutGoalEchoes(brain: LearnerProfile): LearnerProfile {
  const facts = brain.memory.facts.filter((fact) => !(fact.kind === 'goal' && fact.notedAt === '' && fact.en.startsWith('Their goal: ')));
  return facts.length === brain.memory.facts.length ? brain : { ...brain, memory: { ...brain.memory, facts } };
}

/**
 * The brain as it rides the join credential: the name folded in, the
 * tombstones and old goal echoes removed, and the learner's typed goals beside
 * the facts as `memory.learnerGoals`. A paused memory carries neither.
 */
export function snapshotFor(profile: StoredProfile, deck: readonly ReviewCard[] = [], now = Date.now(), previousCorrection?: TutorPreviousCorrection, continuedPack?: Pick<ConversationPack, 'keyPhrases'>): LearnerProfile & { reviewFocus?: TutorReviewFocus[]; previousCorrection?: TutorPreviousCorrection } {
  const { learnerGoals: _staleGoals, ...brainMemory } = profile.brain.memory;
  const brain = withoutGoalEchoes({ ...profile.brain, memory: brainMemory });
  const withName = withLearnerName(withoutForgotten(brain, profile.forgottenFacts), profile.name);
  // The onboarding goal is an answer, like the name, not a remembered fact: it
  // rides every path, the paused one included.
  const goal = isLearnerGoal(profile.onboardingGoal) ? profile.onboardingGoal : null;
  const named: LearnerProfile = { ...withName, memory: { ...withName.memory, goal } };
  // Code picks the focus and its ask: the profile says which phrases were only
  // ever said with help, and a continued conversation's own phrases rank first.
  const focus = reviewFocusFromDeck(deck, now, {
    phrases: Object.values(profile.brain.phrases),
    preferKeys: continuedPack?.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)),
  });
  const correction = parsePreviousCorrection(previousCorrection);
  const extras = { ...(focus.length ? { reviewFocus: focus } : {}), ...(correction ? { previousCorrection: correction } : {}) };
  if (memoryPaused(named)) return { ...named, ...extras, memory: { ...named.memory, facts: [], opener: null } };
  if (profile.learnerGoals.length === 0) return { ...named, ...extras };
  return { ...named, ...extras, memory: { ...named.memory, learnerGoals: [...profile.learnerGoals] } };
}


/** A local choice with a monotonic clock; learning progress and held facts stay. */
export function withMemoryPaused(profile: StoredProfile, paused: boolean, now = Date.now()): StoredProfile {
  if (!Number.isSafeInteger(now) || now < 0) return profile;
  const prior = profile.brain.memory.control?.changedAt ?? 0;
  const changedAt = Math.max(now, prior + 1);
  if (!Number.isSafeInteger(changedAt)) return profile;
  return { ...profile, brain: { ...profile.brain, memory: { ...profile.brain.memory, opener: null, control: { paused, changedAt } } } };
}

/** A late recap cannot undo the learner's current pause or restore forgotten details. */
export function brainAfterRecap(blob: LearnerProfile, current: StoredProfile): LearnerProfile {
  const memory = memoryPaused(current.brain) ? current.brain.memory : withOriginsCarried(blob.memory, current.brain.memory.facts);
  const control = current.brain.memory.control;
  // Goals live in `StoredProfile.learnerGoals` alone; the echo is never stored.
  const { learnerGoals: _echoedGoals, ...stored } = memory;
  const kept = { ...blob, memory: { ...stored, ...(control ? { control } : {}) } };
  return withoutForgotten(withoutGoalEchoes(kept), current.forgottenFacts);
}

/**
 * An older tutor agent rebuilds facts without `source` or `updatedAt`. Read
 * the raw value, not a repaired default: where the recap's fact has no valid
 * source, the stored copy's origin carries over, so a fact the learner wrote
 * never turns back into a conversation fact because an old agent echoed it.
 */
function withOriginsCarried(memory: LearnerProfile['memory'], held: readonly RememberedFact[]): LearnerProfile['memory'] {
  const byKey = new Map(held.map((fact) => [factKey(fact.en), fact]));
  const facts = memory.facts.map((fact) => {
    const raw = (fact as { source?: unknown }).source;
    if (raw === 'learner' || raw === 'conversation') return fact;
    const stored = byKey.get(factKey(fact.en));
    if (stored === undefined) return { ...fact, source: validFactSource(raw), updatedAt: typeof fact.updatedAt === 'string' && fact.updatedAt ? fact.updatedAt : fact.notedAt };
    return { ...fact, source: stored.source, updatedAt: stored.updatedAt };
  });
  return { ...memory, facts };
}

/** One quiet line on the memory screen saying who wrote the fact. */
export function factOriginLabel(fact: Pick<RememberedFact, 'source'>): string {
  return fact.source === 'learner' ? 'You wrote this' : 'Noted from a conversation';
}
