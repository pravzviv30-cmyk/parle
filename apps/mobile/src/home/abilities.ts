/**
 * What the learner can now do, for Home (F545).
 *
 * The passport already knows which situations were handled unaided, and Home
 * never said so. This is the fold Home draws: up to three stamps earned on
 * your own, in the passport's own words, and nothing at all for a learner
 * with none, on `passport.ts`'s rule that a rail of empty marks is a quota.
 *
 * One softer shape sits between those. A learner who has been through a
 * situation with help has a fact worth saying, and it is said as what it is:
 * so far, with help. Never as "you can now", which it is not yet.
 *
 * Revamp A added a second shape of the same facts and did not replace the
 * first. `abilitiesFrom` is the list, one row per situation, and the Progress
 * screen draws it; `canDoSentence` is the same passport as the one sentence
 * Home has room for. Two views, one fold, so the two can never disagree about
 * what a learner can do.
 */

import { lowerFirst } from '../copy/text.ts';
import { isStamped, type Stamp } from '../progress/passport.ts';

export const MAX_ABILITIES = 3;

export const ABILITIES_LABEL = 'You can now';
export const SO_FAR_LABEL = 'So far';

export interface Abilities {
  label: string;
  /** Stamps earned on your own, newest evidence first as the caller ordered them. */
  rows: readonly Stamp[];
  /** The softer sentence, when nothing is stamped yet but something was walked with help. */
  softLine: string | null;
}

export function abilitiesFrom(stamps: readonly Stamp[]): Abilities | null {
  const own = stamps.filter(isStamped).slice(0, MAX_ABILITIES);
  if (own.length > 0) return { label: ABILITIES_LABEL, rows: own, softLine: null };
  const helped = stamps.filter((stamp) => stamp.state === 'with-help');
  if (helped.length === 0) return null;
  return { label: SO_FAR_LABEL, rows: [], softLine: `With help so far: ${helped.map((stamp) => stamp.titleEn).join(', ')}.` };
}

/**
 * The same facts as one sentence, for Home's "Real progress" row (F572).
 *
 * The rows above belong to the Progress screen, where there is room for one
 * situation per line. Home has one line, and the founder's mockup fills it with
 * a sentence a learner would say out loud about themselves: "You can now order
 * at a café and ask for directions". So this is the same passport, joined.
 *
 * ## Why the joining is written out rather than looped
 *
 * One is a claim. Two is a claim with an "and" in it and no comma, because two
 * things joined by a comma reads as a list that got cut off. Three takes the
 * one comma English gives it. Beyond three the sentence stops being readable on
 * a phone, so it says three and then says there is more, which is true and is
 * not a count. A "5 situations" here would be the score this app does not keep.
 *
 * ## The two honest failures
 *
 * A learner who has been through situations only with help is told exactly
 * that, in those words, and never "you can now": the whole value of the claim
 * is that it is not made early. And a learner with nothing behind them is not
 * shown an empty row or a nought. They are told where this starts, which is a
 * sentence about the product rather than a report on them.
 */


/** The caps line over the sentence, on Home and on the Progress screen. */
export const REAL_PROGRESS_LABEL = 'Real progress';

/** What the row says before anything has been walked into at all. */
export const REAL_PROGRESS_START = 'Your first conversation is where this starts.';

/** The stem the claim is built on. Present tense, and about them. */
export const CAN_NOW = 'You can now ';

/** The softer stem, for situations walked with the tutor still helping. */
export const SO_FAR_WITH_HELP = 'So far, with help: ';

/** What a fourth situation and beyond is called, since it is never counted. */
export const AND_MORE = ' and more';

/** Which of the three sentences the row is saying. */
export type CanDoKind = 'own' | 'helped' | 'none';

export interface CanDo {
  label: string;
  /** The whole sentence, ready to draw. Never empty. */
  line: string;
  /**
   * The heading and the sentence as one thing to hear.
   *
   * The row reaches a screen reader as a single button, and a caps label and a
   * sentence underneath it would otherwise arrive as two unrelated nodes. Built
   * here rather than in the card, because joining two pieces of copy is copy.
   */
  spoken: string;
  kind: CanDoKind;
}

/** The two halves as one line, for the row that names itself once. */
function say(label: string, line: string): string {
  return `${label}. ${line}`;
}

/**
 * Up to three situations joined the way English joins them.
 *
 * One: "a". Two: "a and b", no comma. Three: "a, b and c". More than three:
 * the first three, then the fact that there are others, worded rather than
 * counted.
 */
function joinSituations(titles: readonly string[]): string {
  const shown = titles.slice(0, MAX_ABILITIES).map(lowerFirst);
  const rest = titles.length > MAX_ABILITIES ? AND_MORE : '';
  if (shown.length === 1) return `${shown[0]!}${rest}`;
  if (shown.length === 2) return `${shown[0]!} and ${shown[1]!}${rest}`;
  return `${shown[0]!}, ${shown[1]!} and ${shown[2]!}${rest}`;
}

/**
 * What the learner can now do, as the one sentence Home has room for.
 *
 * Always answers. Home's row is drawn for a learner with nothing behind them
 * too, because the row is also how they find out that this is what the app is
 * keeping track of.
 */
export function canDoSentence(stamps: readonly Stamp[]): CanDo {
  const own = stamps.filter(isStamped);
  if (own.length > 0) {
    const line = `${CAN_NOW}${joinSituations(own.map((stamp) => stamp.titleEn))}.`;
    return { label: REAL_PROGRESS_LABEL, line, spoken: say(REAL_PROGRESS_LABEL, line), kind: 'own' };
  }
  const helped = stamps.filter((stamp) => stamp.state === 'with-help');
  if (helped.length > 0) {
    const line = `${SO_FAR_WITH_HELP}${joinSituations(helped.map((stamp) => stamp.titleEn))}.`;
    return { label: REAL_PROGRESS_LABEL, line, spoken: say(REAL_PROGRESS_LABEL, line), kind: 'helped' };
  }
  return {
    label: REAL_PROGRESS_LABEL,
    line: REAL_PROGRESS_START,
    spoken: say(REAL_PROGRESS_LABEL, REAL_PROGRESS_START),
    kind: 'none',
  };
}
