/**
 * The coaching pair: what a turn's coaching named, and whether a form was
 * among it. Kept free of the engine so `profile.ts` can share it (F1120).
 */

import { normalise } from '@luvani/core';

import type { TutorTurn } from '../contract/types.ts';

/**
 * What this turn's coaching named, normalised once.
 *
 * `quoted` is what the model says the learner got wrong: the verbatim fragment
 * handed back to them. `named` is that plus the form offered instead, which the
 * *tutor* produced, not the learner. Two lists because the two exclusions they
 * feed have different lifetimes: a quote is wrong for the rest of the session,
 * while an offered form is only "not the learner's own words" in the same
 * breath it was modelled in.
 *
 * `applyTurnToProfile` in profile/profile.ts and the engine's end card both
 * import this pair, so one turn gets one verdict. It lives on its own so the
 * profile module, which the app bundles, loads no conversation engine code.
 */
export function coachedForms(turn: TutorTurn): { quoted: string[]; named: string[] } {
  const quoted: string[] = [];
  const named: string[] = [];
  for (const item of turn.coach) {
    const quote = normalise(item.quote);
    if (quote.length > 0) {
      quoted.push(quote);
      named.push(quote);
    }
    for (const offered of [item.better, item.betterWritten]) {
      if (offered === null) continue;
      const key = normalise(offered);
      if (key.length > 0) named.push(key);
    }
  }
  return { quoted, named };
}

/**
 * Was any of these forms named in that coaching?
 *
 * Matched on whole normalised words rather than equality, because a coach item
 * quotes a *fragment* of what the learner said: an exact comparison would miss
 * the phrase sitting inside a quote of the whole sentence, which is the common
 * case. Padding both sides with a space keeps "on" from matching inside
 * "bonjour". normalise() has already reduced everything to space-separated
 * words, so a word boundary is a space.
 *
 * Over-matching costs one line off an end card; under-matching congratulates
 * somebody on the phrase they were just corrected for. The doubt goes this way
 * on purpose, the same way it does where credit is minted.
 */
export function namedInCoaching(coached: readonly string[], ...forms: readonly (string | null)[]): boolean {
  for (const form of forms) {
    if (form === null) continue;
    const needle = normalise(form);
    if (needle.length === 0) continue;
    if (coached.some((text) => ` ${text} `.includes(` ${needle} `))) return true;
  }
  return false;
}
