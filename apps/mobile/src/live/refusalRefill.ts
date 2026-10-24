/**
 * When a refused free conversation comes back, from the 402 itself.
 *
 * The token server may name the refill instant on its refusal (`refillsAt`, an
 * ISO string, REV-001). It is said in core's words on this phone's own clock
 * ("on Thursday at 4:10 pm"), never as a countdown. A body without one, or with
 * one that will not parse, says nothing about time, and the screen keeps its
 * own sentence from the closed table: the server's prose is never rendered.
 */

import { refillWhen } from '@luvani/core';

import { freeBackLine } from '../purchases/planStatus.ts';

/** "on Thursday at 4:10 pm", or null when the body names no usable instant. */
export function refusalRefill(body: unknown): string | null {
  const at = (body as { refillsAt?: unknown } | null)?.refillsAt;
  if (typeof at !== 'string' || at.trim() === '') return null;
  const when = new Date(at);
  return Number.isFinite(when.getTime()) ? refillWhen(when) : null;
}

export const REFILL_LABEL = 'Free conversation used';
export const REFILL_STILL = 'Practice and review work offline, so you can carry on there.';

/** The refusal's words when the free conversation's return is known, or the table's own. */
export function refusalWords(
  copy: { label: string; message: string },
  when: string | null,
): { label: string; message: string } {
  return when === null ? copy : { label: REFILL_LABEL, message: `${freeBackLine(when)} ${REFILL_STILL}` };
}
