/**
 * The first win, decided (come alive, README Part 5.C row 8). Pure, so every
 * rule about what the learner is told after their first reply is tested here
 * rather than trusted to a screen.
 *
 * - The win is celebrated only for an accepted reply the learner really gave:
 *   typed or spoken, never a played model (`evidence === 'model'`). Only then
 *   does the page turn coral, the bloom open, the confetti throw and the
 *   `correct` sound and the `celebrate()` haptic play (README Part 5.A master
 *   table). Anything else is calm: paper, "Try this small change.", the model
 *   highlighted, the `nearly` sound and one `soft()`.
 * - The learner's own line sits beside the natural line, so they see what they
 *   said and how it is usually said. When the two are the same, one row says so.
 * - An echo, the tutor's question read back, is refused by core and its text
 *   already carries the model (founder decision D20), so the model is not shown
 *   a second time.
 * - The primary action is the next real exchange while one remains, then
 *   Continue.
 */

import type { SfxId } from '../../sound/sfxIds.ts';
import { FIRST_RUN_COPY } from './copy.ts';

/** The start of core's echo refusal (packages/core/src/onboarding.ts checkStarter, D20). */
export const ECHO_LINE = 'That repeats the question.';

export interface WinAttempt {
  readonly reply: string;
  readonly feedback: {
    readonly accepted: boolean;
    readonly text: string;
    readonly model: string;
    readonly evidence: 'typed' | 'spoken' | 'model';
  };
}

export interface WinView {
  /** An accepted reply the learner gave: the only reply that is celebrated. */
  readonly celebrate: boolean;
  /** The page title. */
  readonly title: string;
  /** The learner's own words, exactly as checked. */
  readonly said: string;
  /** The natural line, from the task. */
  readonly model: string;
  /** The learner said the natural line itself. */
  readonly identical: boolean;
  /** The reply was the question read back; its text already holds the model. */
  readonly echo: boolean;
  /** Whether the natural line gets its own row. */
  readonly showModel: boolean;
  /** The label over the natural line. */
  readonly modelLabel: string;
  /** The primary action's words. */
  readonly primary: string;
  /** What keeping the phrase is called here. */
  readonly keepLabel: string;
}

export function winView(attempt: WinAttempt, model: string, exchangesLeft: boolean): WinView {
  const celebrate = attempt.feedback.accepted && attempt.feedback.evidence !== 'model';
  const echo = !attempt.feedback.accepted && attempt.feedback.text.startsWith(ECHO_LINE);
  const identical = attempt.reply.trim() === model.trim();
  return {
    celebrate,
    title: attempt.feedback.accepted ? 'That reply works.' : 'Try this small change.',
    said: attempt.reply,
    model,
    identical,
    echo,
    showModel: !identical && !echo,
    modelLabel: attempt.feedback.accepted ? FIRST_RUN_COPY.naturalWay : FIRST_RUN_COPY.tryItLikeThis,
    primary: exchangesLeft ? FIRST_RUN_COPY.nextExchange : FIRST_RUN_COPY.continue,
    keepLabel: attempt.feedback.accepted ? FIRST_RUN_COPY.keepPhrase : FIRST_RUN_COPY.keepExample,
  };
}

/** The sound and haptic the win plays, once, when it arrives from a real submitted reply. */
export function winEffects(view: Pick<WinView, 'celebrate'>): { sound: SfxId; haptic: 'celebrate' | 'soft' } {
  return view.celebrate ? { sound: 'correct', haptic: 'celebrate' } : { sound: 'nearly', haptic: 'soft' };
}

/** The confetti a celebrated first reply throws: the phone budget (`BURST_MAX.phone`), and none otherwise. */
export const WIN_BURST = 36;
