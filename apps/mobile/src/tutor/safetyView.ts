/**
 * What a safety decision does to the screen.
 *
 * The agent decides; this decides what the learner sees, and it is a decision
 * with a history. A learner disclosing suicidal ideation used to get the
 * emergency-number sentence as one grey line on an eight-second timer, and then
 * the recap card underneath it saying "Good session. The next one builds on
 * it." with experience points awarded on the same tick. Every part of that was
 * the app treating a crisis as a pipeline hiccup, because a crisis arrived on
 * the same frame a pipeline hiccup arrives on.
 *
 * Two actions, two surfaces, and the difference between them is the whole file:
 *
 *   stop      the session is over. The surface is the entire screen, it takes
 *             the place of the recap and the summary, and nothing that could
 *             congratulate is within reach of it.
 *   redirect  the conversation carries on somewhere safer. A line that stays
 *             put until the learner dismisses it, because the learner decides
 *             when they have read it, not a timer.
 *
 * Neither one is a notice. `live/useLiveSession.ts` clears a notice after eight
 * seconds, which is right for a voice outage and wrong for both of these.
 *
 * The rule lives here rather than in the two screens because apps/mobile has no
 * renderer, so a rule inside a `.tsx` is a rule nothing can ask a question
 * about. Same move as `choosingView.ts`, `review/cardView.ts` and
 * `live/thinking.ts`.
 */

import type { ServerMessage } from '@luvani/core';

/**
 * The safety frame, taken from the wire type rather than restated.
 *
 * `Extract` and not a hand-written interface: the protocol owns this shape, and
 * a copy of it here is a second opinion that goes stale the first time core
 * adds a field.
 */
export type SafetyDecision = Extract<ServerMessage, { t: 'safety' }>;

/**
 * The one line the app adds to a stop, and it says what happened rather than
 * how to feel about it. No apology, no "take care", nothing that reads as the
 * app having an opinion about the person on the other side.
 */
export const SESSION_ENDED = 'This session has ended.';

/** The way out of a stopped session. It leaves the room; it does not resume. */
export const CLOSE_LABEL = 'Close';
export const CLOSE_HINT = 'Close this session and go back';

/** The way past a redirect. The session is still running underneath it. */
export const DISMISS_LABEL = 'OK';
export const DISMISS_HINT = 'Dismiss this message and carry on';

/**
 * What the screens draw.
 *
 * A union rather than a bag of booleans, so a screen cannot render a stop's
 * copy on a redirect's surface: the two shapes do not have each other's fields.
 */
export type SafetySurface =
  | { kind: 'none' }
  | {
      kind: 'redirect';
      /** The tutor's own words, unchanged. */
      message: string;
      buttonLabel: string;
      buttonHint: string;
      /**
       * What a screen reader is told. Polite: the learner still has the floor
       * and may be mid-sentence, and cutting across them to read a line that is
       * going to stay on screen anyway helps nobody.
       */
      announce: string;
      politeness: 'polite';
    }
  | {
      kind: 'stop';
      /** The tutor's own words, unchanged. */
      message: string;
      /** The one line the app adds underneath. */
      ended: string;
      buttonLabel: string;
      buttonHint: string;
      /**
       * What a screen reader is told. Assertive, because the entire screen has
       * just been replaced. A surface that swaps in silently is a surface a
       * learner who is not watching never finds out about.
       */
      announce: string;
      politeness: 'assertive';
    };

/**
 * The decision, as a surface.
 *
 * The message is passed through untouched in both cases. It is written once, in
 * the agent's safety policy, and held there against docs/PRIVACY_AND_SAFETY.md;
 * an app that reworded it would put learner-facing crisis copy in two places
 * and only one of them under test.
 */
export function safetySurface(safety: SafetyDecision | null | undefined): SafetySurface {
  // Absent and null are the same answer: nothing has been decided. Tolerating
  // both is what lets a build whose hook predates the field render the ordinary
  // session rather than throw on the first frame.
  if (!safety) return { kind: 'none' };

  if (safety.action === 'stop') {
    return {
      kind: 'stop',
      message: safety.message,
      ended: SESSION_ENDED,
      buttonLabel: CLOSE_LABEL,
      buttonHint: CLOSE_HINT,
      announce: `${safety.message} ${SESSION_ENDED}`,
      politeness: 'assertive',
    };
  }

  return {
    kind: 'redirect',
    message: safety.message,
    buttonLabel: DISMISS_LABEL,
    buttonHint: DISMISS_HINT,
    announce: safety.message,
    politeness: 'polite',
  };
}

/**
 * Has this session been stopped?
 *
 * The one flag every withholding on both live screens reads: no end card, no
 * summary, no experience points, no recap handed on to be written down, no
 * practice banked, no mission recorded. The founder was asked and chose this
 * deliberately, including the cost: the ordinary practice from before the
 * disclosure goes too. A stopped session leaves nothing behind, which is what
 * the privacy doc promises and the only version of it that is simple enough to
 * be true.
 *
 * Derived from `safetySurface` rather than written twice, because two readings
 * of one frame is exactly how a screen comes to show a stop and bank a session
 * at the same time.
 */
export function stoppedBySafety(safety: SafetyDecision | null | undefined): boolean {
  return safetySurface(safety).kind === 'stop';
}
