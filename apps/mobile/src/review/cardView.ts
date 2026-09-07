/**
 * What a review card is showing, and what it is still holding back.
 *
 * The screen used to decide this inline: one `flipped` boolean, a `frenchSide`
 * helper and a `showHear` expression spread across the JSX. That was checkable
 * only by eye, and it was wrong — a card the scheduler had asked for could be
 * turned over on sight, and a vocabulary card played its French while still on
 * the front. Reading a phrase and then agreeing you knew it is not recall, and
 * the deck's entire claim rests on recall.
 *
 * So the rule moved here, the way `tutor/choosingView.ts` and `live/thinking.ts`
 * moved before it. apps/mobile has no renderer (docs/TESTING.md), so anything
 * left inside a `.tsx` is a decision nothing can ask a question about.
 *
 * ## The policy is core's, not this file's
 *
 * `presentationOf` in `@luvani/core` says whether a card is an introduction or a
 * retrieval, and nothing here argues with it. A second copy of that rule is how
 * a deck starts revealing answers on one surface and asking for them on
 * another. This module answers the next question down: given that verdict and
 * what the learner has done so far, what is on the card.
 *
 * `sittingView` at the foot of the file is the same arrangement one level up.
 * The set of cards is the deck's, arrived at by rules about what is due and how
 * many a sitting may hold; the order they are met in, and the one line that
 * says why, are this file's.
 *
 * ## The inversion
 *
 * A vocabulary card fronts the French and glosses it on the back, because
 * meeting a new word means seeing it. Asked for retrieval it has to run the
 * other way: the English is the prompt, and the French it is asking for stays
 * off the screen until an attempt lands. A turn card already fronts the English
 * ask and keeps its French on the back, so retrieval only adds the gate.
 *
 * Getting that backwards produces a card that shows the learner the very French
 * it is asking them to produce, which is the bug this closes rather than a
 * detail of it. `faces()` is the one place either direction is decided.
 *
 * ## What an attempt is, and what it is not
 *
 * Typed, or said. "Said" covers out loud and in the head, on one tap, and it is
 * taken on trust: there is no microphone here, nothing is recorded, and nothing
 * is scored. Review runs offline and costs zero metered minutes, and grading a
 * spoken review attempt would be a pronunciation score wearing a different
 * name. Speech is invited, never captured, never remarked on.
 *
 * A typed attempt is echoed back under the answer with nothing attached to it.
 * No verdict word, no colour, no tick. The learner compares the two lines and
 * grades themselves with the same three buttons, because the app does not mark
 * French and every accent it could mark on would be a wrong thing to fail
 * someone for.
 */

import {
  firstReturn,
  presentationOf,
  type CardPresentation,
  type GradeContext,
  type ReviewCard,
  type ReviewCardKind,
} from '@luvani/core';

/** How the learner produced the answer, before the answer was on screen. */
export type AttemptKind = 'typed' | 'said';

/** Everything the learner has done with the card in front of them. */
export interface ReviewTurn {
  /** An introduction has been turned over. Means nothing in retrieval. */
  flipped: boolean;
  /** Retrieval only: the attempt that opened the answer, or none yet. */
  attempt: AttemptKind | null;
  /** The draft in the field. Echoed back after a typed attempt, never marked. */
  typed: string;
}

/** A card just dealt: nothing turned, nothing attempted, nothing typed. */
export const CARD_START: ReviewTurn = Object.freeze({ flipped: false, attempt: null, typed: '' });

/**
 * The ask on a retrieval prompt.
 *
 * Two sentences because both are true and the second is the permission: a
 * learner on a bus is not going to say it out loud, and a deck that only
 * accepts speaking would quietly shut them out of their own review.
 */
export const RETRIEVAL_ASK = 'Say it in French. Out loud or in your head.';

/** The two ways to say an attempt happened. */
export const TYPE_IT = 'Type it';
export const SAID_IT = 'I said it';

/** What the card is, said plainly, while it is an introduction. */
const INTRODUCTION_TAG: Record<ReviewCardKind, string> = {
  vocab: 'Word',
  phoneme: 'Sound',
  turn: 'Say it in French',
};

/**
 * The same, while it is asking.
 *
 * Only the turn card differs, and only to stop a stutter: its introduction tag
 * already says "Say it in French", and the retrieval ask under the prompt says
 * it again in full. One card, one instruction.
 */
const RETRIEVAL_TAG: Record<ReviewCardKind, string> = {
  vocab: 'Word',
  phoneme: 'Sound',
  turn: 'Line',
};

/**
 * The French on a card, and which face it lives on.
 *
 * Vocab fronts are French; phoneme cards carry their example word in context;
 * turn cards ask for French, so the French is the answer. `frontToo` is read
 * twice: it gates Hear-it on an introduction, and it is what tells `faces()`
 * which way round a retrieval runs.
 */
export function frenchSide(card: ReviewCard): { text: string; frontToo: boolean } | null {
  switch (card.kind) {
    case 'vocab':
      return { text: card.front, frontToo: true };
    case 'phoneme':
      return card.context ? { text: card.context, frontToo: true } : null;
    case 'turn':
      return { text: card.back, frontToo: false };
  }
}

/** The answer face, once there is anything to show on it. */
export interface CardAnswer {
  /** The reveal itself. In retrieval this is always the French. */
  text: string;
  /** The sentence it came out of, or empty. */
  context: string;
  /** Broad IPA, or empty. Never invented. */
  ipa: string;
}

export interface CardView {
  /** Core's verdict, carried through so the screen never recomputes it. */
  mode: CardPresentation;
  /** The caps micro-label. */
  tag: string;
  /** The large line the learner reads before anything is revealed. */
  prompt: string;
  /** The ask under a retrieval prompt. Null on an introduction. */
  ask: string | null;
  /** Whether the answer face is on screen. */
  revealed: boolean;
  /** The answer face, or null while it is still owed an attempt. */
  answer: CardAnswer | null;
  /** The French to speak, or null while nothing on this card may be heard. */
  hear: string | null;
  /** Whether tapping the card turns it over. Never while an attempt is owed. */
  flippable: boolean;
  /** Whether the two attempt affordances are on screen. */
  asksForAttempt: boolean;
  /** What the learner typed, shown back with nothing attached to it. */
  echo: string | null;
  /** Whether the three grade buttons are on screen. */
  grades: boolean;
  /** What a grade from here is allowed to claim. Empty claims nothing. */
  gradeContext: GradeContext;
  /**
   * What assistive tech is told the moment the answer arrives, or null when
   * nothing arrived. A reveal triggered by a button somewhere else on the
   * screen swaps the card's content without moving focus, so a screen reader
   * is told about it or it did not happen.
   */
  announce: string | null;
}

/** Which side is the question and which is the answer, for this presentation. */
function faces(card: ReviewCard, mode: CardPresentation): { prompt: string; answer: string } {
  if (mode === 'introduction') return { prompt: card.front, answer: card.back };
  // Retrieval asks for the French, so the French is the answer whichever face
  // it happens to live on, and the other face becomes the prompt.
  const french = frenchSide(card);
  return french?.frontToo === true
    ? { prompt: card.back, answer: card.front }
    : { prompt: card.front, answer: card.back };
}

/**
 * Whether Hear-it may play, and what it would play.
 *
 * An introduction may play its French from the front when the front IS the
 * French: meeting a word means hearing it. A retrieval may play nothing until
 * the attempt has landed, because a phrase arriving through the ear is the
 * answer arriving, and it would arrive before the learner produced anything.
 */
function hearable(
  french: { text: string; frontToo: boolean } | null,
  mode: CardPresentation,
  revealed: boolean,
): string | null {
  if (french === null) return null;
  if (revealed) return french.text;
  return mode === 'introduction' && french.frontToo ? french.text : null;
}

/**
 * The card, decided.
 *
 * `now` is the instant the sitting was dealt rather than a fresh clock read, so
 * a card that rejoins the end of a sitting after "Again" is presented the same
 * way it was the first time. A moving clock here would quietly turn a retrieval
 * into an introduction partway through a sitting.
 */
/**
 * The sentence a phrase came out of, or nothing.
 *
 * Blanked against BOTH faces rather than against the answer alone. A lesson
 * vocabulary card is built with the gloss on `back` and on `context` alike
 * (`packages/core/src/review/cards.ts`), and a retrieval on that card asks with
 * the gloss and answers with the word. Checking only the answer therefore let
 * the prompt be reprinted underneath itself, dressed as provenance it never
 * had. Context is worth drawing when it says something neither face already
 * said, and worth nothing otherwise (F466).
 */
function contextUnder(card: ReviewCard, prompt: string, answer: string): string {
  const context = card.context;
  if (context === '') return '';
  return context === answer || context === prompt ? '' : context;
}

export function cardView(card: ReviewCard, now: number, turn: ReviewTurn = CARD_START): CardView {
  const mode = presentationOf(card, now);
  const { prompt, answer } = faces(card, mode);
  const french = frenchSide(card);
  const revealed = mode === 'introduction' ? turn.flipped : turn.attempt !== null;
  const typed = turn.typed.trim();

  return {
    mode,
    tag: (mode === 'introduction' ? INTRODUCTION_TAG : RETRIEVAL_TAG)[card.kind],
    prompt,
    ask: mode === 'retrieval' ? RETRIEVAL_ASK : null,
    revealed,
    answer: revealed ? { text: answer, context: contextUnder(card, prompt, answer), ipa: card.ipa } : null,
    hear: hearable(french, mode, revealed),
    flippable: mode === 'introduction',
    asksForAttempt: mode === 'retrieval' && !revealed,
    echo: revealed && turn.attempt === 'typed' && typed !== '' ? typed : null,
    grades: revealed,
    // Only a retrieval knows an attempt came first. An introduction knows
    // nothing about how the learner got there and claims nothing.
    gradeContext: mode === 'retrieval' && turn.attempt !== null ? { attempt: turn.attempt } : {},
    announce: mode === 'retrieval' && revealed ? answer : null,
  };
}

/**
 * Whether this draft is an attempt.
 *
 * An empty box is somebody who has not answered yet, and revealing on it would
 * hand out the French for a keystroke. "I said it" is always there for the
 * learner who has nothing to type, so nobody is stuck behind this.
 */
export function typedAttemptReady(typed: string): boolean {
  return typed.trim() !== '';
}

/** The sitting, in the order it will be dealt, and the line that opens it. */
export interface SittingView {
  /** Exactly the cards handed in, first returns first. Never more, never fewer. */
  cards: ReviewCard[];
  /** The line naming why the front of the sitting is what it is, or null. */
  opener: string | null;
}

/**
 * Why these cards are at the front, in two sentences and no numbers.
 *
 * "On purpose" is the whole job: it turns a repeat that looks like an accident
 * into the design. The second sentence is the reason a spaced deck works, put
 * as something still ahead of the learner rather than a verdict on what they
 * have done, because at this point they have not answered anything yet. No
 * count, no praise, and nothing that says a phrase went missing: the schedule
 * came round again, which is not the same as a memory being lost.
 */
export const SITTING_OPENER =
  'Some of these are back on purpose. Getting them right again is what makes them stay.';

/**
 * The sitting, ordered. `dealt` is the set; this only decides the sequence.
 *
 * `GRADUATION_INTERVALS_DAYS` has sent a first success back tomorrow since the
 * scheduler was written, and nothing ever said so. That card is the one thing a
 * sitting cannot fake: a phrase that survived a night's sleep rather than a
 * minute's echo. The learner met it somewhere in the middle of a queue with no
 * way of knowing it was the point of the whole deck.
 *
 * ## It reorders. It never re-selects.
 *
 * `dealt` is whatever the deck's own selection already returned, and what
 * happens to it is a stable partition: every card is pushed to exactly one of
 * two lists and the two are joined. The cards out are therefore the cards in,
 * and each group keeps the order it arrived in, so the longest-overdue-first
 * sort survives inside both halves rather than being replaced by a second
 * opinion about it.
 *
 * That is the entire safety argument and it is deliberately structural. The
 * selection puts the memories closest to fading first and stops at a cap,
 * because a sitting that grows without limit is the backlog wall that makes
 * people delete the app. A version of this that chose its own cards would let
 * twenty first returns push out cards that are genuinely fading, and it would
 * do it on exactly the deck where that hurts most: the one somebody came back
 * to after a fortnight away. Nothing in this module knows what due, capped or
 * overdue mean, which is why nothing in this module can starve them.
 *
 * `firstReturn` is core's and is not re-implemented here. It composes
 * `presentationOf`, so a sound card and a card looked at before its day is up
 * are already excluded, by the same rule `cardView` reads one card at a time.
 *
 * ## What the opener is allowed to claim
 *
 * That the cards are back to be tested. Nothing else. `reps` of one on a
 * one-day stride names a card the scheduler *sent* back; the evidence that the
 * memory actually held is the grade that follows, which the deck records as a
 * retrieval only when an attempt came first. Congratulating anybody here would
 * be marking a test before it was taken.
 *
 * It cannot say "yesterday" either, however much it wants to. A card is due
 * from the moment its day is up, so a learner returning after a week away meets
 * a first return whose one day was six days ago. The interval is one day; the
 * gap is whatever the learner's life was.
 *
 * One line, and null when there is nothing to name. A sentence on every sitting
 * is furniture, and a count of how many came back is the score wall this screen
 * exists to refuse.
 */
export function sittingView(dealt: readonly ReviewCard[], now: number): SittingView {
  const back: ReviewCard[] = [];
  const rest: ReviewCard[] = [];
  for (const card of dealt) (firstReturn(card, now) ? back : rest).push(card);
  return { cards: [...back, ...rest], opener: back.length === 0 ? null : SITTING_OPENER };
}
