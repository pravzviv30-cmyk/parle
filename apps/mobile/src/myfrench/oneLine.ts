/**
 * One line, and never a second.
 *
 * This is the difference between My French and Practice, and it is deliberately
 * a small one. Practice runs a sitting: `dueCards` deals up to twenty, the
 * screen works through them, and the learner has agreed to a session. My French
 * deals exactly one card, says why that card, and then stops. Nothing here
 * holds a queue, counts a position, or offers another after the first is
 * graded, because a second card is a sitting and the sitting already has a
 * screen.
 *
 * The point is not to review more. It is that retrieval is the act that builds
 * a memory, and a learner who opened a page to look at their own French will
 * produce one line in the sixty seconds they were going to spend reading it.
 * The answer is withheld until an attempt lands, which is the whole reason this
 * is worth anything: a card showing both faces is reading, not recall.
 *
 * ## The four tiers, in order
 *
 * 1. `firstReturn` — a card got right once, a day ago, back for its first real
 *    test. It is true on exactly one day in a card's life and it is the highest
 *    yield single event in any spacing schedule. Today it arrives anonymously
 *    in the middle of a twenty card queue.
 * 2. A due card the learner has already used in a real conversation. The
 *    strongest thing they own, asked for while it is still theirs.
 * 3. Any due card, preferring one whose context says something both faces do
 *    not, because the sentence it came out of is the memory hook.
 * 4. Nothing due: one settled card, shown and NOT asked for. A learner who is
 *    up to date meets a phrase they own rather than an empty frame.
 *
 * ## What is not decided here
 *
 * How the card is presented, whether the answer may be shown, and what a grade
 * is worth are all `review/cardView.ts` and `review/store.ts`, reused verbatim.
 * A second copy of the reveal gate is how one surface starts handing out the
 * French for a keystroke while the other still asks for it.
 *
 * ## No copy here names a day
 *
 * `cardView.ts` records why: a card is due from the moment its day is up, so a
 * learner returning after a week meets a first return whose one day was six
 * days ago. "Yesterday" would be wrong for exactly the learner who most needs
 * this page. `settledAt` is absent both when a card is unsettled and when it
 * settled before the field existed, so it cannot date anything either.
 */

import {
  evidenceStateOf,
  firstReturn,
  isDue,
  isSettled,
  type ReviewCard,
} from '@luvani/core';

/**
 * Why this card, said to the learner.
 *
 * One sentence per tier, in the same order. They are the honest reason rather
 * than a flourish: the learner is told the rule that picked their card, which
 * is what stops a single card reading as an arbitrary sample of a hidden queue.
 */
export const REASONS = {
  firstReturn: 'This one is back on purpose. Saying it again is what makes it stay.',
  used: 'You said this one in a real conversation. It is round again.',
  due: 'One that is round again.',
  settled: 'Nothing is waiting. Here is one that is yours.',
} as const;

/** The two grades. `easy` is a sitting's nuance and has no place in a single card. */
export const GRADE_LABELS = { good: 'That was it', again: 'Not yet' } as const;

/** After a grade, and then nothing. The visit is complete, not paused. */
export const CLOSING_LINE = 'Kept. That is the whole visit.';

/** The caps micro-label above the card. */
export const ONE_LINE_LABEL = 'One line, right now';

/**
 * The typed way in.
 *
 * The card offers both ways the sitting offers, because a learner on a train
 * cannot say it out loud and a learner cooking cannot type. `CHECK` is the same
 * word the drills use for the same act: land what you have and see the line.
 */
export const TYPE_PROMPT = 'Say it in French';
export const TYPE_LABEL = 'Your answer in French';
export const CHECK = 'Check';

export type OneLineTier = 'firstReturn' | 'used' | 'due' | 'settled';

export interface OneLine {
  card: ReviewCard;
  /** Which rule picked it, so a test can walk the order rather than the prose. */
  tier: OneLineTier;
  reason: string;
  /**
   * Whether the learner may be asked to produce it.
   *
   * False on the settled tier only. A card the scheduler is not asking for is a
   * gift, and turning it into a test would make being up to date cost something.
   */
  askable: boolean;
}

/** Context worth preferring: present, and saying something neither face says. */
function carriesContext(card: ReviewCard): boolean {
  const context = card.context;
  return context !== '' && context !== card.front && context !== card.back;
}

/**
 * The single card this visit deals, or null.
 *
 * Phoneme cards are excluded throughout. A sound is not a line you can say, and
 * `phrasebook.ts` excludes them from "what you can say now" for the same reason.
 * A card with no successful review is excluded too: `presentationOf` would make
 * it an introduction, and asking someone to produce a phrase they have never
 * recalled is a test with no teaching in it.
 */
export function oneLineFrom(input: { deck: readonly ReviewCard[]; now: number }): OneLine | null {
  const { deck, now } = input;
  const sayable = deck.filter((card) => card.kind !== 'phoneme' && card.reps >= 1);
  if (sayable.length === 0) return null;

  const first = sayable.find((card) => firstReturn(card, now));
  if (first) return { card: first, tier: 'firstReturn', reason: REASONS.firstReturn, askable: true };

  const due = sayable.filter((card) => isDue(card, now));
  const used = due.find((card) => {
    const state = evidenceStateOf(card, now);
    return state === 'used' || state === 'transferred';
  });
  if (used) return { card: used, tier: 'used', reason: REASONS.used, askable: true };

  if (due.length > 0) {
    const withContext = due.find(carriesContext);
    return { card: withContext ?? due[0]!, tier: 'due', reason: REASONS.due, askable: true };
  }

  const settled = sayable.find((card) => isSettled(card, now));
  if (settled) return { card: settled, tier: 'settled', reason: REASONS.settled, askable: false };

  return null;
}
