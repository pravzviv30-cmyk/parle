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
 * - **a miss with a form**: since LEARN-017 core hands over the right form
 *   (`closest`) on a first miss for every kind except listen-type and
 *   own-words, and on every second miss. The sheet is calm: "Here's how it
 *   goes." (or "Here is one reply that works." when several replies are
 *   right), the French on its own line, its one-line reason from
 *   `missReason`, then "This one comes round again." on a first miss or
 *   "It'll come back in your review." once the two-miss mercy moves on. It
 *   waits for Continue, because there is French to read. No mark, no sound,
 *   no haptic.
 * - **a first miss with no form** (listen-type, so the retry still tests the
 *   ear): "This one comes round again." alone, and it moves on by itself. No
 *   French, no mark, no sound, no haptic.
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
  oneOfMany: 'Here is one reply that works.',
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
  /** The right item's own French and English on a miss, "je vais prendre = I'll have", or null (LEARN-017). */
  readonly reason: string | null;
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
  /** Core's form worth pointing at; on a miss, the right answer (LEARN-017). */
  readonly closest: string | null;
  /** Core's `missReason` for the exercise, shown on a miss beside the form. */
  readonly reason?: string | null;
  /** An appropriate-reply with more than one right reply: the form is one of them. */
  readonly oneOfMany?: boolean;
  /** The answer is English (translate fr-en): never drawn as French. */
  readonly answerEnglish?: boolean;
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
    return { tone: 'good', headline, detail: null, french: null, reason: null, after: null, mark: true, sound: 'correct', haptic: 'arrived', autoAdvanceMs: SHEET_AUTO_MS };
  }
  if (verdict === 'typo') {
    return {
      tone: 'nearly',
      headline: SHEET_COPY.typo,
      detail: closest === null ? null : SHEET_COPY.typoDetail(closest),
      french: null,
      reason: null,
      after: null,
      mark: true,
      sound: 'nearly',
      haptic: 'soft',
      autoAdvanceMs: SHEET_TYPO_MS,
    };
  }
  // A miss shows the form, its one-line reason, and waits for Continue
  // (LEARN-017). The first comes round again in the sitting; the second goes
  // to review.
  if (closest !== null) {
    return {
      tone: 'calm',
      headline: input.oneOfMany === true ? SHEET_COPY.oneOfMany : SHEET_COPY.secondMiss,
      detail: null,
      // English is said once, inside the reason line, and never in guillemets.
      french: input.answerEnglish === true ? null : closest,
      reason: input.reason ?? (input.answerEnglish === true ? closest : null),
      after: input.advanced ? SHEET_COPY.secondMissAfter : SHEET_COPY.firstMiss,
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
    reason: null,
    after: null,
    mark: false,
    sound: null,
    haptic: null,
    autoAdvanceMs: SHEET_AUTO_MS,
  };
}

/** Everything the sheet says, in reading order, for a screen reader. */
export function spokenSheet(sheet: AnswerSheetModel, note: string | null): string {
  return [sheet.headline, sheet.detail, sheet.french, sheet.reason, sheet.after, note].filter((part): part is string => part !== null && part !== '').join(' ');
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
