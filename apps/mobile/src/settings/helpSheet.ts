/**
 * Help and feedback, as a sheet in the app (F922).
 *
 * The row used to hand straight to `openMail`. On the web with no mail
 * handler, and on a phone with no mail account, that tap did nothing at all
 * and the result was thrown away. Now the row opens five short answers and,
 * last, the address as text with a button that tries the mail app.
 *
 * Every answer is assembled from copy the app already says somewhere else, so
 * the sheet cannot promise something the screens do not do. The one sentence
 * not exported elsewhere, `CONNECTED_TYPING`, is held by the suite to the end
 * of the wall's own `conversationLength`.
 */

import { PLANS } from '@luvani/core';
import { PRIMER_REFUSED, PRIMER_REFUSED_WEB } from '../onboarding/micPrimer.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';
import { LEAVE_KEEPS_WORK } from '../live/leaveConfirm.ts';
import { PREVIEW_COPY } from '../scenes/scenePreview.ts';
import { YOURS_ROWS, trialAllowance } from '../wall/wallCopy.ts';
import { conversationsIn } from '../wall/wallPlans.ts';
import { HELP_FEEDBACK_ROW } from './profileView.ts';
import { LINK_TROUBLE, LOCAL_PRACTICE_ROW, LOCAL_PRACTICE_SUB } from './sections.ts';
import type { LinkOutcome } from './links.ts';

/** The wall's own sentence about typing (`conversationLength`). */
export const CONNECTED_TYPING = 'Connected typing also uses live minutes.';
export const HELP_WRITE_HEADING = 'Write to us';
export const HELP_WRITE_LINE = 'We read every message. Here is our address, if you would rather copy it.';
export const HELP_WRITE_ACTION = 'Open mail';

export interface HelpAnswer {
  heading: string;
  lines: readonly string[];
}

export interface HelpSheetView {
  title: string;
  answers: readonly HelpAnswer[];
  write: { heading: string; line: string; address: string; action: string };
}

/** The free plan's live allowance, in the wall's words and core's number. */
function freeAllowance(): string {
  const minutes = Math.floor(PLANS.trial.secondsPerPeriod / 60);
  return trialAllowance(minutes, conversationsIn(minutes));
}

/** The sheet, for the web or a phone, writing to `address`. */
export function helpSheet(web: boolean, address: string): HelpSheetView {
  return {
    title: HELP_FEEDBACK_ROW,
    answers: [
      { heading: 'The microphone is blocked', lines: [web ? PRIMER_REFUSED_WEB : PRIMER_REFUSED] },
      {
        heading: 'Practising by typing',
        lines: [`At the start of a scene, choose ${TYPE_INSTEAD}.`, CONNECTED_TYPING],
      },
      {
        heading: 'What minutes are',
        lines: [PREVIEW_COPY.footnote, `${LOCAL_PRACTICE_ROW} in Settings is the same: ${LOCAL_PRACTICE_SUB.charAt(0).toLowerCase()}${LOCAL_PRACTICE_SUB.slice(1)}.`],
      },
      { heading: 'Leaving a scene', lines: ['Once you have replied, Leave is safe.', LEAVE_KEEPS_WORK] },
      { heading: 'What Free includes', lines: [freeAllowance(), ...YOURS_ROWS] },
    ],
    write: { heading: HELP_WRITE_HEADING, line: HELP_WRITE_LINE, address, action: HELP_WRITE_ACTION },
  };
}

/** What to say after the mail app was asked: nothing, or the shared trouble line. */
export function helpTrouble(outcome: LinkOutcome): string | null {
  return outcome === 'done' ? null : LINK_TROUBLE;
}
