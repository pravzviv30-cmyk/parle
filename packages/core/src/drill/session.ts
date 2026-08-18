/**
 * The drill session — the review deck made active.
 *
 * Same architecture as the live session engine: one state object, pure
 * functions, no clock reads, no randomness, so every path is replayable in a
 * test. Three product rules shape the machine.
 *
 * A missed exercise goes to the back of the queue, not into a score. The
 * session completes only when everything has been answered correctly, so
 * finishing and getting it right are the same event — except that two misses
 * on one exercise let the learner proceed anyway. The phrase then returns
 * through the scheduler, quietly, another day. The cost of a miss is another
 * meeting, never a mark.
 *
 * The ramp: each phrase climbs from recognition to production across sittings
 * (options offered, then tokens offered, then nothing offered, then nothing
 * written). The stage comes from the review card's rep count, because reps is
 * the one number the scheduler already maintains that grows only on success:
 * 'good' and 'easy' increment it, 'again' leaves it alone. A phrase therefore
 * climbs exactly one rung per successful sitting and holds its rung after a
 * rough one, with no second counter to store, sync, or let drift from the
 * deck. One rung at a time is the ~80%-success target: each step removes a
 * single piece of scaffolding, never two at once.
 *
 * One memory system. Drill outcomes reschedule the same SM-2 cards the
 * flashcard deck shows, through the same `applyGrade` — a phrase can never be
 * "known" in the drills and "due" in the deck.
 */

import { applyGrade, dueCards, type ReviewCard, type ReviewGrade } from '../review/scheduler.ts';
import { gradeAnswer, type DrillVerdict } from './grading.ts';
import type { DrillExercise } from './types.ts';

/** The ramp, in climbing order. Recognition on the left, production on the right. */
export const DRILL_STAGES = ['options', 'tap-tokens', 'typed', 'spoken'] as const;

export type DrillStage = (typeof DRILL_STAGES)[number];

/** Which rung of the ramp an exercise format sits on. */
export function stageOf(exercise: DrillExercise): DrillStage {
  switch (exercise.kind) {
    case 'fill-blank':
      return exercise.options ? 'options' : 'typed';
    case 'best-sentence':
    case 'appropriate-reply':
      return 'options';
    case 'tap-translate':
      return 'tap-tokens';
    case 'listen-type':
      return 'typed';
    case 'repeat-this':
      return 'spoken';
  }
}

/** The rung a phrase has earned. See the ramp note at the top of the file. */
export function stageForReps(reps: number): DrillStage {
  return DRILL_STAGES[Math.min(Math.max(reps, 0), DRILL_STAGES.length - 1)]!;
}

/**
 * How many misses one exercise may absorb before the session moves on anyway.
 *
 * Mirrors MAX_ATTEMPTS_PER_TURN in the live session, for the same reason: a
 * bound keeps nobody drilling one phrase into the ground. The unresolved
 * exercise is not forgiven, just deferred — its card grades 'again' and the
 * scheduler brings it back within the sitting.
 */
export const MAX_MISSES = 2;

export type DrillOutcome = 'good' | 'typo' | 'unresolved';

export interface AnsweredExercise {
  id: string;
  /** Carried so outcomes can reschedule the right review card. */
  phraseKey: string;
  outcome: DrillOutcome;
  /** Every ask this exercise took, the final one included. */
  attempts: number;
}

export interface DrillSessionState {
  /** Remaining exercises in order; the head is the one on screen. */
  queue: DrillExercise[];
  /** Misses so far per exercise id, for the two-miss mercy rule. */
  missesById: Record<string, number>;
  /** Every exercise that has left the queue, in the order it left. */
  answered: AnsweredExercise[];
  startedAt: number;
  finished: boolean;
}

export interface DrillFeedback {
  verdict: DrillVerdict;
  /** The accepted form worth pointing at, in its real spelling. */
  closest: string | null;
  /** One short line for the UI. Copy-tested; never scolds, never a digit. */
  message: string;
  /** False when the exercise went to the back of the queue and will come back. */
  advanced: boolean;
}

/**
 * Every mid-session line a drill can show, from one place, pinned by the copy
 * tests. The miss line points at the real form in guillemets because showing
 * the right spelling teaches; naming what went wrong does not. Numbers never
 * appear here — they belong on the end card, where they can be given context.
 */
export const GOOD_FEEDBACK = 'Nickel.';

/** The typo was accepted; this line only keeps the real spelling in view. */
export function typoFeedback(exact: string): string {
  return `Presque. Ça s'écrit «${exact}».`;
}

export function missFeedback(exact: string | null): string {
  return exact === null ? 'Pas tout à fait.' : `Pas tout à fait. On dit: «${exact}».`;
}

function feedbackMessage(verdict: DrillVerdict, closest: string | null): string {
  switch (verdict) {
    case 'good':
      return GOOD_FEEDBACK;
    case 'typo':
      // A typo verdict always carries the near-matched form; the fallback only
      // keeps machine-built edge cases from ever rendering an empty quote.
      return closest === null ? GOOD_FEEDBACK : typoFeedback(closest);
    case 'miss':
      return missFeedback(closest);
  }
}

/**
 * Build a sitting from the deck and the exercise bank.
 *
 * `dueCards` decides who plays — same cap, same overdue-first order as the
 * flashcard deck, because this is the same review, worn differently. Each due
 * phrase contributes the one bank exercise matching its earned stage. A phrase
 * the bank cannot drill is skipped without comment; the flashcard deck still
 * covers it.
 */
export function buildDrillSession(
  deck: readonly ReviewCard[],
  bank: readonly DrillExercise[],
  now: number,
  opts?: {
    /**
     * Restrict the sitting to these phrases — one node of the practice path.
     * Omitted, the whole deck plays, so every existing two- and three-argument
     * call behaves exactly as before.
     */
    only?: readonly string[];
  },
): DrillSessionState {
  // The filter is applied to the DECK, before `dueCards`, and that ordering is
  // the whole point. `dueCards` takes the most overdue twenty across the entire
  // deck; filtering after it would let twenty unrelated overdue cards fill the
  // cap and leave a node's own phrases out of its own sitting. On a small dev
  // deck that bug is invisible, and on a real one it is the only behaviour.
  const scope = opts?.only;
  const scopedDeck = scope ? deck.filter((c) => scope.includes(c.id)) : deck;
  const scopedBank = scope ? bank.filter((e) => scope.includes(e.phraseKey)) : bank;

  const queue: DrillExercise[] = [];
  for (const card of dueCards(scopedDeck, now)) {
    const forPhrase = scopedBank.filter((e) => e.phraseKey === card.id);
    if (forPhrase.length === 0) continue;
    queue.push(pickForStage(forPhrase, stageForReps(card.reps)));
  }

  // Phrases the deck has never met are new material, offered at the easiest
  // stage — this is what a first-ever open shows, since a fresh deck has
  // nothing due at all. Capped so a big bank cannot bury a newcomer, and
  // skipped entirely once a real review load exists: introduction gives way
  // to maintenance, never competes with it.
  if (queue.length < NEW_PHRASES_PER_SESSION) {
    const known = new Set(scopedDeck.map((card) => card.id));
    const queued = new Set(queue.map((exercise) => exercise.phraseKey));
    for (const exercise of scopedBank) {
      if (queue.length >= NEW_PHRASES_PER_SESSION) break;
      if (known.has(exercise.phraseKey) || queued.has(exercise.phraseKey)) continue;
      queued.add(exercise.phraseKey);
      const forPhrase = scopedBank.filter((e) => e.phraseKey === exercise.phraseKey);
      queue.push(pickForStage(forPhrase, DRILL_STAGES[0]!));
    }
  }

  return { queue, missesById: {}, answered: [], startedAt: now, finished: queue.length === 0 };
}

/** New phrases introduced per sitting when the review load leaves room. */
export const NEW_PHRASES_PER_SESSION = 6;

/**
 * The bank exercise for a phrase at a stage. When the bank has nothing at the
 * earned stage, fall back to the nearest easier one — extra scaffolding is a
 * smaller wrong than demanding production the learner has not earned — and
 * only reach upward when nothing easier exists. First match wins, so a bank's
 * ordering is a preference, not an accident.
 */
function pickForStage(candidates: readonly DrillExercise[], stage: DrillStage): DrillExercise {
  const earned = DRILL_STAGES.indexOf(stage);
  for (let i = earned; i >= 0; i--) {
    const hit = candidates.find((e) => stageOf(e) === DRILL_STAGES[i]);
    if (hit) return hit;
  }
  for (let i = earned + 1; i < DRILL_STAGES.length; i++) {
    const hit = candidates.find((e) => stageOf(e) === DRILL_STAGES[i]);
    if (hit) return hit;
  }
  return candidates[0]!;
}

/**
 * Answer the exercise at the head of the queue.
 *
 * A miss sends the exercise to the back of the queue — the session is not over
 * until everything has been answered correctly — unless this was its second
 * miss, in which case the learner proceeds and the exercise is recorded
 * unresolved. A typo resolves the exercise like a correct answer and is
 * tracked separately, because a slipped finger is not a missing memory.
 *
 * Answering a finished session changes nothing: there is no exercise to
 * grade, so there is no feedback to give.
 */
export function answerCurrent(state: DrillSessionState, answer: string | number | number[]): { state: DrillSessionState; feedback: DrillFeedback | null } {
  const exercise = state.queue[0];
  if (state.finished || !exercise) return { state, feedback: null };

  const { verdict, closest } = gradeAnswer(exercise, answer);
  const rest = state.queue.slice(1);
  const missesSoFar = state.missesById[exercise.id] ?? 0;

  if (verdict === 'miss' && missesSoFar + 1 < MAX_MISSES) {
    const next: DrillSessionState = {
      ...state,
      queue: [...rest, exercise],
      missesById: { ...state.missesById, [exercise.id]: missesSoFar + 1 },
    };
    return { state: next, feedback: { verdict, closest, message: feedbackMessage(verdict, closest), advanced: false } };
  }

  const outcome: DrillOutcome = verdict === 'miss' ? 'unresolved' : verdict;
  const next: DrillSessionState = {
    ...state,
    queue: rest,
    answered: [...state.answered, { id: exercise.id, phraseKey: exercise.phraseKey, outcome, attempts: missesSoFar + 1 }],
    finished: rest.length === 0,
  };
  return { state: next, feedback: { verdict, closest, message: feedbackMessage(verdict, closest), advanced: true } };
}

/**
 * Swap every remaining repeat-this for its pre-authored silent twin.
 *
 * "I can't speak right now" is a situation, not a preference to argue with, so
 * the swap must cost nothing: same queue positions, same session length, and
 * any misses already spent on a spoken exercise carry over to its twin — going
 * quiet must never hand out extra attempts. Idempotent, because after one pass
 * no repeat-this remains for a second pass to find.
 */
export function suppressMic(state: DrillSessionState): DrillSessionState {
  if (!state.queue.some((e) => e.kind === 'repeat-this')) return state;

  const missesById = { ...state.missesById };
  const queue = state.queue.map((e) => {
    if (e.kind !== 'repeat-this') return e;
    const twin = e.noMicTwin;
    const spent = missesById[e.id];
    if (spent !== undefined) {
      missesById[twin.id] = spent;
      delete missesById[e.id];
    }
    return twin;
  });
  return { ...state, queue, missesById };
}

export interface DrillSummary {
  /** Exercises the session holds, pending included. Numbers may appear on the end card only. */
  total: number;
  /** Ended correct, spelling slips included. */
  resolved: number;
  /** Of the resolved, how many needed the spelling pointed out. */
  typos: number;
  /** Proceeded past after two misses; their cards return through the scheduler. */
  unresolved: number;
  /** Extra asks the queue absorbed across the finished exercises. */
  retries: number;
  /** What each drilled phrase tells the scheduler. */
  grades: { phraseKey: string; grade: ReviewGrade }[];
}

/**
 * The end card's numbers, and the grades the scheduler is owed.
 *
 * A resolved exercise grades its card 'good' even when it took a retry or a
 * typo — the phrase came out in the end, and the in-session re-ask already was
 * the punishment-free correction. Unresolved grades 'again'. When a bank
 * drills one phrase through two exercises, the worse outcome speaks for the
 * phrase: a card must never be pushed a week out by one win when the same
 * sitting also produced a defeat.
 */
export function summarise(state: DrillSessionState): DrillSummary {
  let resolved = 0;
  let typos = 0;
  let unresolved = 0;
  let retries = 0;
  const grades = new Map<string, ReviewGrade>();

  for (const a of state.answered) {
    if (a.outcome === 'unresolved') unresolved += 1;
    else {
      resolved += 1;
      if (a.outcome === 'typo') typos += 1;
    }
    retries += Math.max(0, a.attempts - 1);
    if (grades.get(a.phraseKey) === 'again') continue;
    grades.set(a.phraseKey, a.outcome === 'unresolved' ? 'again' : 'good');
  }

  return {
    total: state.answered.length + state.queue.length,
    resolved,
    typos,
    unresolved,
    retries,
    grades: [...grades].map(([phraseKey, grade]) => ({ phraseKey, grade })),
  };
}

/**
 * Feed the session's outcomes back to the one memory system.
 *
 * Each drilled phrase reschedules the same card the flashcard deck shows,
 * through the existing `applyGrade` — no second scheduler, no forked SM-2.
 * Cards the session never touched pass through untouched.
 */
export function applyDrillResults(deck: readonly ReviewCard[], state: DrillSessionState, now: number): ReviewCard[] {
  const grades = new Map(summarise(state).grades.map((g) => [g.phraseKey, g.grade]));
  return deck.map((card) => {
    const grade = grades.get(card.id);
    return grade === undefined ? card : applyGrade(card, grade, now);
  });
}
