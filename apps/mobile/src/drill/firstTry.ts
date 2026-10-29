import type { DrillSessionState } from '@luvani/core';

/**
 * What a sitting got right the first time it was asked (F919).
 *
 * `right` is every first-attempt pass, a typo included, since a typo is a
 * slipped finger and not a missing memory. `clean` drops the typos, for the
 * XP that pays double, and `typos` is the first-try typos, for typo XP. Right only after a miss is in neither: the learner was
 * shown the answer (LEARN-017), so it is help, as LEARN-003 already rules for
 * the scheduler and practice/completion.ts for `recalled`.
 */
export function firstTry(state: Pick<DrillSessionState, 'answered'>): { right: number; clean: number; typos: number } {
  let right = 0;
  let clean = 0;
  let typos = 0;
  for (const a of state.answered) {
    if (a.attempts !== 1 || a.outcome === 'unresolved') continue;
    right += 1;
    if (a.outcome === 'good') clean += 1;
    else typos += 1;
  }
  return { right, clean, typos };
}
