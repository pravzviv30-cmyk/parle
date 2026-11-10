/**
 * What a learner reads when something throws.
 *
 * A caught error's message can be a code, a URL or a library sentence
 * ("Network request failed"), so a catch block never shows `cause.message`.
 * It passes the cause here: Luvani's own sentence (a LearnerError) is kept, a
 * dropped connection or a timeout gets the connection line, and anything else
 * gets the site's fallback.
 */

import { CONNECTION } from '../auth/friendly.ts';

/** An error whose message was written for the learner to read. */
export class LearnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LearnerError';
  }
}

const NETWORK_MESSAGE = /failed to fetch|load failed|network/i;

function isConnectionFailure(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;
  const { name, message } = cause as { name?: unknown; message?: unknown };
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return typeof message === 'string' && NETWORK_MESSAGE.test(message);
}

export function errorCopy(cause: unknown, fallback: string): string {
  if (cause instanceof LearnerError) return cause.message;
  return isConnectionFailure(cause) ? CONNECTION : fallback;
}
