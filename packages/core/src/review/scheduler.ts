/**
 * Spaced repetition, sized for one calm sitting.
 *
 * This is the retention surface the competitor research pointed at: Issen's
 * best-loved feature is flashcards built from words you actually said, and
 * Duolingo's is a mistakes queue that quietly re-asks what you missed. Both
 * need a scheduler. Neither needs a research-grade one.
 *
 * So this is FSRS in spirit and SM-2 in arithmetic: three grades, an ease
 * factor, exponential interval growth. Zero dependencies, pure functions,
 * because the deck must work offline and cost zero metered minutes — reviewing
 * is the free daily habit that keeps a learner warm between paid sessions.
 *
 * Two deliberate departures from the classical algorithms:
 *
 * First, only three grades. Anki's four-button choice ("was that Hard or
 * Good?") is a self-assessment test stapled onto every card. A beginner should
 * spend their judgement on the French, not on grading themselves.
 *
 * Second, `dueCards` is capped. An SRS that has been ignored for two weeks
 * greets its owner with a wall of two hundred reds, and that wall is the last
 * thing most people see before deleting the app. Twenty cards is a sitting;
 * the rest simply wait their turn, unannounced.
 */

import { addEvidence, isDue, isSettled, presentationOf, type PhraseEvidence } from './evidence.ts';

export type ReviewCardKind = 'vocab' | 'phoneme' | 'turn';

export type ReviewGrade = 'again' | 'good' | 'easy';

export interface ReviewCard {
  /** Stable identity, e.g. 'vocab:café' — what `mergeCards` dedupes on. */
  id: string;
  kind: ReviewCardKind;
  /** What the learner is shown first. */
  front: string;
  /** The reveal. Drawn from lesson content, never generated. */
  back: string;
  /** The sentence or exchange this came from. Honest context beats a dictionary. */
  context: string;
  /** Broad IPA when we know it for certain, else empty. Wrong IPA is worse than none. */
  ipa: string;
  /** Epoch ms when the card entered the deck. */
  addedAt: number;
  /** Epoch ms when the card should next be shown. */
  due: number;
  /** Current interval. 0 until the first successful review. */
  intervalDays: number;
  /** Growth multiplier, SM-2 style. */
  ease: number;
  /** Successful reviews so far. */
  reps: number;
  /** Times the learner pressed "again". Never shown to the learner. */
  lapses: number;
  /**
   * What this phrase has been shown to be worth. Monotone counters, and absent
   * means all zero so a deck written before them stays readable. Read it with
   * `evidenceOf`, never field by field; see `evidence.ts` for what each count
   * is allowed to claim.
   */
  evidence?: PhraseEvidence;
  /**
   * Epoch ms of the grade at which this card first became settled.
   *
   * `isSettled` already says *whether* a card is settled, from `due`, `reps`
   * and `intervalDays`. It cannot say *when*, and no amount of reading the
   * counters recovers it: they are where the card is now, not the moment it
   * arrived. So a screen that wants to say what a week of review actually
   * retained has nothing to count, and this is the one field that gives it
   * something honest to count.
   *
   * Absent means one of two things, and neither is a zero. Either the card is
   * not settled, or it settled before this field existed. Both are "we do not
   * know when", and a reader must treat them the same way: leave the claim out
   * rather than substitute a date.
   *
   * Cleared on `again`, deliberately. A lapsed card is not settled any more,
   * and when it settles again that is a second, real transition on a date a
   * counter may honestly use. Keeping the old timestamp would date a memory to
   * a week the learner had already forgotten it.
   */
  settledAt?: number;
}

/**
 * What earned a grade, when anything did.
 *
 * Optional, and an omitted context grades exactly as this scheduler always
 * has. That matters because the two callers are honest about different things:
 * the review screen knows an attempt was required before the answer appeared,
 * a drill knows whether it changed the situation, and a self-graded card in a
 * quiet moment knows neither and should claim neither.
 */
export interface GradeContext {
  /** How the learner produced the answer BEFORE the card revealed it. */
  attempt?: 'typed' | 'said';
  /** The same phrase asked in a changed situation. */
  transfer?: boolean;
}

/** A missed card comes back within the same sitting, not tomorrow. */
export const AGAIN_RETRY_MS = 10 * 60 * 1000;
/** SM-2's floor — below this, intervals stop growing and reviews pile up. */
export const MIN_EASE = 1.3;
/** SM-2's starting ease. */
export const DEFAULT_EASE = 2.5;
/** One calm sitting. See the note at the top of the file. */
export const DUE_CAP = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
/** First and second successful intervals, in days: tomorrow, then the weekend test. */
const GRADUATION_INTERVALS_DAYS = [1, 3] as const;
/** How much sooner "easy" pushes a card out compared to "good". */
const EASY_BONUS = 1.3;

/** Keep ease to two decimals so repeated ±0.15/±0.1 steps cannot accumulate float dust. */
function roundEase(ease: number): number {
  return Math.round(ease * 100) / 100;
}

/**
 * A brand-new card is due immediately.
 *
 * The best moment to meet a card for the first time is right after the session
 * that produced it, while the learner still remembers saying the sentence.
 */
export function newCard(fields: Pick<ReviewCard, 'id' | 'kind' | 'front' | 'back' | 'context' | 'ipa'>, now: number): ReviewCard {
  return {
    ...fields,
    addedAt: now,
    due: now,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    reps: 0,
    lapses: 0,
  };
}

/**
 * Apply one review. Pure: returns a new card, never mutates.
 *
 * 'again' brings the card back in ten minutes and restarts its climb, with a
 * slightly gentler slope (ease drops). 'good' walks the classical 1 day, 3
 * days, then multiply-by-ease staircase. 'easy' takes a longer stride and
 * steepens the slope for next time.
 *
 * `context` says what earned the grade, and it only ever adds to the card's
 * evidence — the schedule a grade produces is identical with it and without
 * it. Keeping the two apart is deliberate: rescheduling is a guess about a
 * memory, and evidence is a record of something the learner did.
 */
export function applyGrade(card: ReviewCard, grade: ReviewGrade, now: number, context: GradeContext = {}): ReviewCard {
  switch (grade) {
    // A lapse earns no evidence, whatever the attempt was. Forgetting is
    // rescheduling rather than failing, and it is equally not proof of
    // anything: the counters record what came out right.
    case 'again': {
      // The key is dropped rather than set to undefined. `mergeDecks` renders
      // a card's own keys to break its last tie, so a card carrying an explicit
      // `settledAt: undefined` and a card that never had the key would compare
      // as different cards while meaning exactly the same thing.
      const { settledAt: _lapsed, ...unsettled } = card;
      return {
        ...unsettled,
        due: now + AGAIN_RETRY_MS,
        intervalDays: 0,
        ease: Math.max(MIN_EASE, roundEase(card.ease - 0.15)),
        lapses: card.lapses + 1,
      };
    }

    case 'good': {
      const intervalDays = goodIntervalDays(card);
      return dated(
        earned(
          {
            ...card,
            due: now + intervalDays * DAY_MS,
            intervalDays,
            reps: card.reps + 1,
          },
          context,
        ),
        card,
        now,
      );
    }

    case 'easy': {
      // "Easy" is a longer stride on the SAME staircase "good" walks — computed
      // from the good interval so it can never schedule a card sooner than
      // "good" would have, including on the graduation and relearning steps.
      const good = goodIntervalDays(card);
      const intervalDays = Math.max(good + 1, Math.round(good * EASY_BONUS));
      return dated(
        earned(
          {
            ...card,
            due: now + intervalDays * DAY_MS,
            intervalDays,
            ease: roundEase(card.ease + 0.1),
            reps: card.reps + 1,
          },
          context,
        ),
        card,
        now,
      );
    }
  }
}

/**
 * What a correct answer proves, on top of what it schedules.
 *
 * One increment each, at most, per grade. An attempt raises recall evidence
 * because the learner produced the phrase before seeing it; a transfer-marked
 * exercise raises transfer evidence because the situation had changed. A grade
 * that carries no context adds nothing and returns the very same object, so
 * every existing caller keeps the deck it had.
 */
function earned(card: ReviewCard, context: GradeContext): ReviewCard {
  return addEvidence(card, {
    retrievals: context.attempt === undefined ? 0 : 1,
    transfers: context.transfer === true ? 1 : 0,
  });
}

/**
 * Stamp the grade that settled this card, and only that grade.
 *
 * Three refusals, and each one is a false claim avoided:
 *
 * A card that already carries a date keeps it. The claim is when this memory
 * first held, not when it was last confirmed, and overwriting would turn a
 * two-month-old phrase into a fresh one every time it came round.
 *
 * A card that was already settled before this grade gets nothing new. Nothing
 * transitioned, so there is nothing to date. This is also what protects a deck
 * written before the field existed: an old settled card graded today would
 * otherwise be stamped with today, and a retention count reading it would
 * report a week's worth of memory that was actually a year's.
 *
 * A card that is still not settled gets nothing. `isSettled` owns the rule,
 * here as everywhere else, so the moment recorded is the moment that predicate
 * changed its mind and not a second opinion about what settled means.
 */
function dated(next: ReviewCard, before: ReviewCard, now: number): ReviewCard {
  if (next.settledAt !== undefined) return next;
  if (isSettled(before, now)) return next;
  if (!isSettled(next, now)) return next;
  return { ...next, settledAt: now };
}

/**
 * The classical 1 day, 3 days, then multiply-by-ease staircase. The 1-day floor
 * is for relearning: a lapsed card sits at intervalDays 0 with its reps intact,
 * and multiplying zero by anything schedules it for right now, forever.
 * Relearned cards graduate back to tomorrow instead.
 */
function goodIntervalDays(card: ReviewCard): number {
  return GRADUATION_INTERVALS_DAYS[card.reps] ?? Math.max(1, Math.round(card.intervalDays * card.ease));
}

/**
 * The cards to show right now: due ones only, longest-overdue first, capped.
 *
 * Overdue-first matters because those are the memories closest to fading.
 * The cap is the anti-backlog-wall rule — cards beyond it are not late, they
 * are queued, and nothing anywhere counts or displays what was left out.
 */
export function dueCards(cards: readonly ReviewCard[], now: number, cap = DUE_CAP): ReviewCard[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.due - b.due || a.addedAt - b.addedAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, cap));
}

/**
 * A card the learner first got right yesterday, back for its first real test.
 *
 * Naming, not scheduling. `GRADUATION_INTERVALS_DAYS` has always sent a first
 * success out one day, so this card already existed and already arrived on
 * time; nothing said what it was. It is the one thing in the deck that a
 * sitting cannot fake — a phrase that survived a night's sleep rather than a
 * minute's echo — and reading `reps` and `intervalDays` separately at each
 * call site is how two screens end up making that claim about different cards.
 *
 * Nothing here reschedules anything, and `dueCards` is untouched: this is a
 * question asked about a card, not a new way to pick one.
 *
 * The arithmetic does most of the excluding, which is why this is a
 * comparison and a reused rule rather than a list of special cases.
 *
 * `reps === 1` is the first success and only the first. A lapse leaves reps
 * intact, so a relearned card comes back to a one-day interval carrying reps
 * of three or five, and its own first return was weeks ago.
 *
 * `intervalDays === 1` is the one-day stride and only that. An "easy" first
 * success strides two days and a second success strides three, and a claim
 * about a one-day memory would be false of both.
 *
 * `presentationOf` decides the rest, and deliberately is not re-implemented
 * here. A phoneme card is a listening exercise on every day of its life, so it
 * is never a test of recall; a card seen before its due date is a look rather
 * than a return. Both rules already live in `evidence.ts`, and a second copy
 * of either is how a deck starts demanding a sound on one screen while
 * treating it as listening on another.
 *
 * What is deliberately absent is `lapses`. A card missed once before it was
 * ever right, then answered, has had exactly one success and gets its first
 * return like any other. The claim is that a memory is a day old, not that the
 * learner's record of it is clean.
 */
export function firstReturn(card: ReviewCard, now: number): boolean {
  return card.reps === 1 && card.intervalDays === 1 && presentationOf(card, now) === 'retrieval';
}

/**
 * Fold freshly-built cards into an existing deck.
 *
 * Identity wins: a card the learner has been reviewing for weeks keeps its
 * scheduling even when a new session produces the same word again. Resetting
 * it would throw away real memory data and re-show them a card they know.
 */
export function mergeCards(existing: readonly ReviewCard[], incoming: readonly ReviewCard[]): ReviewCard[] {
  const known = new Set(existing.map((c) => c.id));
  const merged = [...existing];
  for (const card of incoming) {
    if (known.has(card.id)) continue;
    known.add(card.id);
    merged.push(card);
  }
  return merged;
}
