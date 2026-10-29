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

import { outOfTimeWords } from '../purchases/outOfTime.ts';

/** "on Thursday at 4:10 pm", or null when the body names no usable instant. */
export function refusalRefill(body: unknown): string | null {
  const at = (body as { refillsAt?: unknown } | null)?.refillsAt;
  if (typeof at !== 'string' || at.trim() === '') return null;
  const when = new Date(at);
  return Number.isFinite(when.getTime()) ? refillWhen(when) : null;
}

/**
 * The refusal's words (F911). A 402 that names its refill instant is a free
 * plan's (core sends `refillsAt` only for one), and gets the same words every
 * other screen says, the "not quite enough" lead included. A body without one
 * keeps the table's own sentence.
 */
export function refusalWords(
  copy: { label: string; message: string },
  code: string,
  body: unknown,
  now: number = Date.now(),
): { label: string; message: string } {
  if (refusalRefill(body) === null || (code !== 'exhausted' && code !== 'insufficient-for-session')) return copy;
  const at = (body as { refillsAt: string }).refillsAt;
  const words = outOfTimeWords({ plan: 'trial', reason: code, refillsAt: at, now });
  return { label: words.title, message: words.message };
}
