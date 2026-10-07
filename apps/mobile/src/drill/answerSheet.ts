/**
 * What the answer sheet says, how it sounds and when it moves on, decided
 * apart from drawing it (README Part 5.E "Answer sheet"; core-loop 2.1 with
 * its review's findings 1 and 2, and founder decision D21).
 *
 * One verdict, one sheet:
 *
 * - **good**: mint, a check, a warm line that rotates by the answer's place in
 *   the sitting (a run of three or more real passes rotates a run line
 *   instead), `correct` and `arrived()`, and on to the next exercise after
 *   `SHEET_AUTO_MS`. A repeat-this is the learner's own word that they said
 *   it, so it is told "You said it." and nothing about accuracy.
 * - **typo**: sun, a check (the drill accepted it), "Nearly." and the real
 *   spelling in guillemets, `nearly` and `soft()`.
 * - **first miss**: core hands nothing over on a first miss (`closest` is null
 *   by design, so the retry tests memory), so the sheet is calm: "This one
 *   comes round again." No French, no mark, no sound, no haptic.
 * - **second miss**: the two-miss mercy moves on, so now the form is shown:
 *   "Here's how it goes.", the French on its own line, and "It'll come back in
 *   your review." It waits for Continue, because it is the one sheet with
 *   French to read. Still no mark, no sound and no haptic.
 *
 * With a screen reader on, or not yet known to be off, nothing moves on by
 * itself: every sheet waits for Continue, and on a phone the reader is moved
 * onto that Continue as the sheet arrives (`sheetArrival`).
 *
 * The own-words outcome card takes the same tones from core's
 * `ownWordsFeedback`: "That works." good, "Nearly there." in the nearly tone
 * (D21), and the reveal calm and silent.
 *
 * Every line here is warm plain English with no digit, no scold and no French
 * praise (D14); the French is only ever the learner's own phrase. Pure, so
 * `answerSheet.test.ts` holds it.
 */

import { ownWordsFeedback, type DrillExercise, type FeedbackTone, type SettledVerdict } from '@luvani/core';

import type { SfxId } from '../sound/sfxIds.ts';
import { COMBO_GLOW_FROM, type OwnWordsDecided } from './combo.ts';

/** The warm lines a good answer rotates through. */
export const GOOD_LINES = ['Nicely done.', "That's right.", 'Spot on.', 'Exactly.', "Yes, that's it.", 'Good one.'] as const;

/** The lines a good answer rotates through once a run of real passes glows. */
export const RUN_LINES = ['On a roll.', "You're in the flow.", 'Smooth.'] as const;

/** What a repeat-this hears: the learner said it, and that is all the drill knows. */
export const SAID_IT_LINE = 'You said it.';

export const SHEET_COPY = {
  typo: 'Nearly.',
  typoDetail: (form: string): string => `It's spelt «${form}». That one counts.`,
  firstMiss: 'This one comes round again.',
  secondMiss: "Here's how it goes.",
  secondMissAfter: "It'll come back in your review.",
  continue: 'Continue',
} as const;

/** How long a sheet that moves on by itself stays, in ms. */
export const SHEET_AUTO_MS = 1400;
/** A typo has a spelling to read, so it stays a little longer. */
export const SHEET_TYPO_MS = 2200;

/** The sheet's ground: mint for a pass, sun for nearly, paper for calm. */
export type SheetTone = FeedbackTone;

/** The haptic a sheet gives, through motion/haptics. */
export type SheetHaptic = 'arrived' | 'soft';

export interface AnswerSheetModel {
  readonly tone: SheetTone;
  readonly headline: string;
  /** The English line under the headline, or null. */
  readonly detail: string | null;
  /** The learner's French, shown on its own line in guillemets, or null. */
  readonly french: string | null;
  /** A line under the French, or null. */
  readonly after: string | null;
  /** The check mark. Never on a miss. */
  readonly mark: boolean;
  readonly sound: SfxId | null;
  readonly haptic: SheetHaptic | null;
  /** Moves on by itself after this many ms, or null to wait for Continue. */
  readonly autoAdvanceMs: number | null;
}

export interface SheetInput {
  readonly verdict: SettledVerdict;
  /** Core's form worth pointing at; null on a first miss by design. */
  readonly closest: string | null;
  /** False when the exercise went to the back of the queue. */
  readonly advanced: boolean;
  readonly kind: DrillExercise['kind'];
  /** The run of real passes after this answer (drill/combo.ts). */
  readonly combo: number;
  /** The answer's place in the sitting, so the lines rotate without randomness. */
  readonly turn: number;
  /** True, or null while the OS has not said: either way the sheet waits. */
  readonly screenReader: boolean | null;
}

const rotate = <T>(lines: readonly T[], turn: number): T => lines[((Math.floor(turn) % lines.length) + lines.length) % lines.length]!;

function decide(input: SheetInput): AnswerSheetModel {
  const { verdict, closest } = input;
  if (verdict === 'good') {
    const headline =
      input.kind === 'repeat-this' ? SAID_IT_LINE : input.combo >= COMBO_GLOW_FROM ? rotate(RUN_LINES, input.turn) : rotate(GOOD_LINES, input.turn);
    return { tone: 'good', headline, detail: null, french: null, after: null, mark: true, sound: 'correct', haptic: 'arrived', autoAdvanceMs: SHEET_AUTO_MS };
  }
  if (verdict === 'typo') {
    return {
      tone: 'nearly',
      headline: SHEET_COPY.typo,
      detail: closest === null ? null : SHEET_COPY.typoDetail(closest),
      french: null,
      after: null,
      mark: true,
      sound: 'nearly',
      haptic: 'soft',
      autoAdvanceMs: SHEET_TYPO_MS,
    };
  }
  // A miss. The first hands nothing over; the second shows the form and waits.
  if (input.advanced && closest !== null) {
    return {
      tone: 'calm',
      headline: SHEET_COPY.secondMiss,
      detail: null,
      french: closest,
      after: SHEET_COPY.secondMissAfter,
      mark: false,
      sound: null,
      haptic: null,
      autoAdvanceMs: null,
    };
  }
  return {
    tone: 'calm',
    headline: input.advanced ? SHEET_COPY.secondMissAfter : SHEET_COPY.firstMiss,
    detail: null,
    french: null,
    after: null,
    mark: false,
    sound: null,
    haptic: null,
    autoAdvanceMs: SHEET_AUTO_MS,
  };
}

/** The sheet for one settled answer. */
export function sheetFor(input: SheetInput): AnswerSheetModel {
  const sheet = decide(input);
  // A screen reader decides its own pace: nothing moves on under it.
  return input.screenReader === false ? sheet : { ...sheet, autoAdvanceMs: null };
}

/**
 * How a screen reader meets a sheet as it arrives (F775).
 *
 * - **focus-continue**: the sheet waits, so the reader is moved onto its
 *   Continue, whose name carries the whole sheet. The learner hears it once
 *   and is already on the way on, rather than left on an answer that has gone.
 * - **announce**: the sheet moves on by itself, so it is said and focus stays put.
 * - **live-region**: on the web the sheet's live region speaks for itself and
 *   focus is left where the learner put it.
 */
export type SheetArrival = 'focus-continue' | 'announce' | 'live-region';

export function sheetArrival(sheet: Pick<AnswerSheetModel, 'autoAdvanceMs'>, web: boolean): SheetArrival {
  if (web) return 'live-region';
  return sheet.autoAdvanceMs === null ? 'focus-continue' : 'announce';
}

/** What Continue is called to a screen reader: the whole sheet, then the word. */
export function continueName(spoken: string): string {
  return spoken === '' ? SHEET_COPY.continue : `${spoken} ${SHEET_COPY.continue}`;
}

/** The own-words outcome's tone, line, mark, sound and haptic. Null decided means nobody judged it. */
export interface OwnWordsLook {
  readonly tone: SheetTone | null;
  readonly headline: string | null;
  readonly mark: boolean;
  readonly sound: SfxId | null;
  readonly haptic: SheetHaptic | null;
}

export function ownWordsLook(decided: OwnWordsDecided | null): OwnWordsLook {
  if (decided === null) return { tone: null, headline: null, mark: false, sound: null, haptic: null };
  const { tone, text } = ownWordsFeedback(decided);
  if (tone === 'good') return { tone, headline: text, mark: true, sound: 'correct', haptic: 'arrived' };
  if (tone === 'nearly') return { tone, headline: text, mark: false, sound: 'nearly', haptic: 'soft' };
  return { tone, headline: text, mark: false, sound: null, haptic: null };
}
