/**
 * Practice now: a short queue chosen on purpose, played through the ordinary
 * drill engine.
 *
 * This is a selection policy, not a scheduler. `dueCards` still decides what
 * scheduled review is and in what order; `pickForStage` and `stageForReps`
 * still decide which exercise a phrase gets; `answerCurrent` and `summarise`
 * still run the sitting. This file adds only three things on top of them.
 *
 * Who plays. The recommended sitting takes a little due review and a little
 * of the learner's latest saved conversation, three and three, capped at six
 * distinct phrases. Either side fills what the other cannot, and a phrase in
 * both is attributed to review, because it is due whether or not the
 * conversation brought it up. Picking a conversation explicitly plays that
 * conversation alone, due or not.
 *
 * Where each phrase came from. Attribution rides on each target, so unrelated
 * review never counts as practice of the chosen conversation.
 *
 * What a grade is owed. Rehearsing a card before it is due is practice, not a
 * spaced return, so a successful early rehearsal hands the scheduler nothing:
 * no interval, no rep, no evidence. A miss on one still uses the existing
 * 'again' policy, and never carries a transfer mark with it. Due targets grade
 * exactly as an ordinary drill sitting does.
 *
 * Pure, deterministic, no clock reads. `buildDrillSession` is untouched.
 */

import { dueCards, type ReviewCard } from '../review/scheduler.ts';
import { isDue } from '../review/evidence.ts';
import {
  pickForStage,
  stageForReps,
  summarise,
  DRILL_STAGES,
  type AnsweredExercise,
  type DrillSessionState,
  type DrillSummary,
} from './session.ts';
import type { DrillExercise } from './types.ts';

/** At most this many distinct phrases in one practice sitting. */
export const PRACTICE_QUEUE_CAP = 6;

/** Each source's first share of a balanced sitting, before the other fills spare room. */
export const PER_SOURCE_CAP = 3;

export type PracticeSource = { kind: 'review' } | { kind: 'pack'; packId: string };

export interface PracticeTarget {
  /** The review card identity this target drills. */
  phraseKey: string;
  source: PracticeSource;
  /** The bank exercise chosen for it, by id. */
  exerciseId: string;
  /**
   * The card was due when this was chosen. Only a scheduled target may move the
   * schedule on success; see `practiceGrades`.
   */
  scheduled: boolean;
}

export interface PracticeSelection {
  targets: PracticeTarget[];
  shape: 'balanced' | 'review-only' | 'pack-only' | 'empty';
  /** The conversation that contributed at least one target, or null when none did. */
  packId: string | null;
}

/** The only parts of a saved conversation selection needs. */
export interface PracticePack {
  id: string;
  /** In the pack's own order, which is the order its phrases are offered. */
  phraseKeys: readonly string[];
}

/** A practice sitting, and what of the selection could not be played. */
export interface PracticeSession {
  state: DrillSessionState;
  /** The targets actually in the queue, in queue order, with their resolved exercise ids. */
  targets: PracticeTarget[];
  /**
   * Targets whose phrase has nothing left in the bank. They are not in the
   * queue and not in `answered`: a caller must say so, never count them done.
   */
  missing: PracticeTarget[];
}

export type PracticeOutcome = 'recalled' | 'practised' | 'unresolved';

const EMPTY: PracticeSelection = { targets: [], shape: 'empty', packId: null };

/**
 * The exercise a phrase would get through the ordinary stage rule, or null when
 * the bank has none. A phrase the deck knows plays at its earned rung; a phrase
 * it has never met starts at the easiest, exactly as `buildDrillSession`
 * introduces new material.
 */
function exerciseFor(phraseKey: string, deck: readonly ReviewCard[], bank: readonly DrillExercise[]): DrillExercise | null {
  const candidates = bank.filter((e) => e.phraseKey === phraseKey);
  if (candidates.length === 0) return null;
  const card = deck.find((c) => c.id === phraseKey);
  return pickForStage(candidates, card ? stageForReps(card.reps) : DRILL_STAGES[0]!);
}

function scheduledNow(phraseKey: string, deck: readonly ReviewCard[], now: number): boolean {
  const card = deck.find((c) => c.id === phraseKey);
  return card !== undefined && isDue(card, now);
}

/** A pack's playable phrases as targets, in pack order, first occurrence only, skipping `exclude`. */
function packTargets(
  pack: PracticePack,
  deck: readonly ReviewCard[],
  bank: readonly DrillExercise[],
  now: number,
  exclude: ReadonlySet<string>,
): PracticeTarget[] {
  const seen = new Set<string>();
  const out: PracticeTarget[] = [];
  for (const phraseKey of pack.phraseKeys) {
    if (seen.has(phraseKey) || exclude.has(phraseKey)) continue;
    seen.add(phraseKey);
    const exercise = exerciseFor(phraseKey, deck, bank);
    if (!exercise) continue;
    out.push({ phraseKey, source: { kind: 'pack', packId: pack.id }, exerciseId: exercise.id, scheduled: scheduledNow(phraseKey, deck, now) });
  }
  return out;
}

/**
 * The recommended short sitting.
 *
 * `packs` is the caller's eligible conversations, latest first. The first one
 * with a playable phrase that review is not already covering contributes; a
 * newer conversation without usable exercises gives way rather than producing
 * an empty primary action.
 *
 * Review is `dueCards` filtered to phrases the bank can drill, in its own
 * order. Phrases in that capped review set are attributed to review; a due
 * phrase beyond the review cap may still be offered by its pack.
 */
export function selectPracticeQueue(input: {
  deck: readonly ReviewCard[];
  bank: readonly DrillExercise[];
  packs: readonly PracticePack[];
  now: number;
}): PracticeSelection {
  const { deck, bank, packs, now } = input;

  const review: PracticeTarget[] = [];
  const reviewKeys = new Set<string>();
  for (const card of dueCards(deck, now)) {
    if (reviewKeys.has(card.id)) continue;
    const exercise = exerciseFor(card.id, deck, bank);
    if (!exercise) continue;
    reviewKeys.add(card.id);
    review.push({ phraseKey: card.id, source: { kind: 'review' }, exerciseId: exercise.id, scheduled: true });
  }

  let fromPack: PracticeTarget[] = [];
  let packId: string | null = null;
  for (const pack of packs) {
    const candidates = packTargets(pack, deck, bank, now, reviewKeys);
    if (candidates.length > 0) {
      fromPack = candidates;
      packId = pack.id;
      break;
    }
  }

  let r = Math.min(PER_SOURCE_CAP, review.length);
  let p = Math.min(PER_SOURCE_CAP, fromPack.length);
  // Spare room goes to whichever side still has material. At most one side
  // can be short while the other has more, so the order of these two is moot.
  r = Math.min(review.length, r + (PRACTICE_QUEUE_CAP - r - p));
  p = Math.min(fromPack.length, p + (PRACTICE_QUEUE_CAP - r - p));

  const targets = [...review.slice(0, r), ...fromPack.slice(0, p)];
  if (targets.length === 0) return { ...EMPTY, targets: [] };
  if (p === 0) return { targets, shape: 'review-only', packId: null };
  if (r === 0) return { targets, shape: 'pack-only', packId };
  return { targets, shape: 'balanced', packId };
}

/**
 * Practise one saved conversation now, due or not. Up to six of its playable
 * phrases, in pack order. A phrase that happens to be due is marked scheduled,
 * because answering it is a real return; the rest are early rehearsal.
 */
export function selectPackQueue(
  pack: PracticePack,
  deck: readonly ReviewCard[],
  bank: readonly DrillExercise[],
  now: number,
): PracticeSelection {
  const targets = packTargets(pack, deck, bank, now, new Set()).slice(0, PRACTICE_QUEUE_CAP);
  if (targets.length === 0) return { ...EMPTY, targets: [] };
  return { targets, shape: 'pack-only', packId: pack.id };
}

/**
 * Turn a selection into a sitting.
 *
 * Each target plays its chosen exercise when the bank still has it for that
 * phrase. When it does not (a regenerated bank, a deleted conversation), the
 * phrase is re-picked through the ordinary stage rule, and when nothing is
 * left it is reported in `missing` rather than silently counted as done.
 *
 * `scheduled` is re-checked against the deck: a target chosen as due that has
 * since been graded elsewhere is early rehearsal now, and is treated as such.
 * The reverse is never promoted, so a target can lose the right to move the
 * schedule here but never gain it.
 *
 * A phrase listed twice plays once, first occurrence wins.
 */
export function buildPracticeSession(
  targets: readonly PracticeTarget[],
  bank: readonly DrillExercise[],
  deck: readonly ReviewCard[],
  now: number,
): PracticeSession {
  const queue: DrillExercise[] = [];
  const resolved: PracticeTarget[] = [];
  const missing: PracticeTarget[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    if (seen.has(target.phraseKey)) continue;
    seen.add(target.phraseKey);
    const chosen = bank.find((e) => e.id === target.exerciseId && e.phraseKey === target.phraseKey);
    const exercise = chosen ?? exerciseFor(target.phraseKey, deck, bank);
    if (!exercise) {
      missing.push(target);
      continue;
    }
    queue.push(exercise);
    resolved.push({
      ...target,
      exerciseId: exercise.id,
      scheduled: target.scheduled && scheduledNow(target.phraseKey, deck, now),
    });
  }

  return {
    state: { queue, missesById: {}, answered: [], startedAt: now, finished: queue.length === 0 },
    targets: resolved,
    missing,
  };
}

/**
 * The grades a practice sitting owes the scheduler.
 *
 * Scheduled targets: exactly `summarise`'s grades, transfer mark included.
 * Unscheduled targets: nothing on success, since an early rehearsal is not a
 * spaced return. 'again' on an unresolved phrase, through the existing policy,
 * with no transfer mark. A phrase with no target is not graded at all.
 */
export function practiceGrades(state: DrillSessionState, targets: readonly PracticeTarget[]): DrillSummary['grades'] {
  const byKey = new Map<string, PracticeTarget>();
  for (const t of targets) if (!byKey.has(t.phraseKey)) byKey.set(t.phraseKey, t);

  const out: DrillSummary['grades'] = [];
  for (const g of summarise(state).grades) {
    const target = byKey.get(g.phraseKey);
    if (target === undefined) continue;
    if (target.scheduled) out.push(g);
    else if (g.grade === 'again') out.push({ phraseKey: g.phraseKey, grade: 'again' });
  }
  return out;
}

/**
 * What one answered exercise honestly shows, for history and progress copy.
 *
 * 'recalled' is claimed for one case only: an English-to-French translation,
 * answered right on the first attempt with no spelling correction. That
 * format's screen shows the English meaning and nothing in French (no audio,
 * no options, no tiles, no sentence frame), and the learner types the French.
 *
 * Everything else that resolved is 'practised'. Repeat-this is imitation of a
 * shown line, listen-type is transcription, a typed fill-blank sits inside its
 * sentence and gloss, options and tiles hand over the French, French-to-English
 * shows the French, and own-words is the learner's own meaning rather than the
 * saved phrase. A retry or a typo is practised too, as is any record that does
 * not match the exercise it is read against.
 *
 * The answered record carries no help flag. A screen that lets the learner
 * peek at the answer before a translation must not report this outcome as is.
 */
export function practiceOutcomeOf(answer: AnsweredExercise, exercise: DrillExercise): PracticeOutcome {
  if (answer.outcome === 'unresolved') return 'unresolved';
  if (answer.id !== exercise.id || answer.phraseKey !== exercise.phraseKey) return 'practised';
  if (answer.outcome !== 'good' || answer.attempts !== 1) return 'practised';
  if (exercise.kind === 'translate' && exercise.direction === 'en-fr') return 'recalled';
  return 'practised';
}
