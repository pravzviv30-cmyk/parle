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
 */
export function applyGrade(card: ReviewCard, grade: ReviewGrade, now: number): ReviewCard {
  switch (grade) {
    case 'again':
      return {
        ...card,
        due: now + AGAIN_RETRY_MS,
        intervalDays: 0,
        ease: Math.max(MIN_EASE, roundEase(card.ease - 0.15)),
        lapses: card.lapses + 1,
      };

    case 'good': {
      const intervalDays = goodIntervalDays(card);
      return {
        ...card,
        due: now + intervalDays * DAY_MS,
        intervalDays,
        reps: card.reps + 1,
      };
    }

    case 'easy': {
      // "Easy" is a longer stride on the SAME staircase "good" walks — computed
      // from the good interval so it can never schedule a card sooner than
      // "good" would have, including on the graduation and relearning steps.
      const good = goodIntervalDays(card);
      const intervalDays = Math.max(good + 1, Math.round(good * EASY_BONUS));
      return {
        ...card,
        due: now + intervalDays * DAY_MS,
        intervalDays,
        ease: roundEase(card.ease + 0.1),
        reps: card.reps + 1,
      };
    }
  }
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
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due || a.addedAt - b.addedAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, cap));
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
