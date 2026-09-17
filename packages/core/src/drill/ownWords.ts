/**
 * Say it your own way — the rules around the one drill kind with no key.
 *
 * Every other exercise in this folder can be graded by a string comparison,
 * and that is exactly their limit: they can only ever ask for the sentence we
 * already taught. This kind hands the learner a situation and asks them to get
 * the meaning across in whatever French they have. What comes back is not
 * right or wrong, it is closer or further, so a comparison cannot settle it.
 *
 * The model observes, code decides, and this file is the seam. Somewhere
 * outside core a model reads the attempt and returns an `OwnWordsVerdict`: four
 * observations and no verdict about the learner. `decideOwnWords` turns those
 * observations into the only three things the session can do — carry on, ask
 * again, or show the phrase. Nothing here calls a model, imports one, or knows
 * one exists; hand it a verdict from a test fixture and it behaves identically.
 *
 * Two pedagogy calls are frozen into `decideOwnWords`, and both are the point
 * of the kind rather than details of it.
 *
 * Meaning kept and understood is good, full stop. Awkward French that a French
 * person would understand is a success at speaking, and marking it down is how
 * a learner is taught to say nothing rather than say it badly. `natural` is
 * still recorded, because the better line is worth showing; it just never costs
 * the learner the outcome. That is also why `betterLine` is a field and not a
 * grade.
 *
 * A meaning lost gets one more go before the phrase is shown, on the same
 * MAX_MISSES the rest of the drill engine uses. One retry is enough to recover
 * a fumbled start and few enough that nobody is left grinding at a sentence
 * they cannot build yet: the phrase comes back another day through the
 * scheduler, which is a cheaper teacher than a third attempt in a row.
 *
 * What this kind does NOT claim: an own-words success is evidence of production
 * in a situation, not evidence about pronunciation (no known-reference audio is
 * involved) and not a ladder rung earned. `OwnWordsExercise` carries no
 * `transfer` mark for the same reason — the mark feeds a phrase's evidence
 * record, and whether unscripted production should feed it is a decision nobody
 * has made yet.
 */

import { buildDrillSession, MAX_MISSES, type DrillSessionState } from './session.ts';
import type { OwnWordsExercise } from './types.ts';

/**
 * What a judge reports about one attempt. Observations only: three of these
 * four are things a reader of the attempt can see, and the fourth is a line
 * they would have said instead.
 *
 * This exact shape crosses the boundary — a model fills it in, the app hands it
 * to `decideOwnWords` unchanged. Adding a field here without adding it there is
 * how a contract quietly becomes two contracts, so it does not change casually.
 */
export type OwnWordsVerdict = {
  /** Did what they said still mean the thing they were asked to mean? */
  meaningKept: boolean;
  /** Would a French person have understood it, imperfections and all? */
  comprehensible: boolean;
  /** How it lands to a native ear. Never costs the learner the outcome. */
  natural: 'yes' | 'awkward' | 'no';
  /** The line worth showing instead, or null when theirs was already it. */
  betterLine: string | null;
  /** One short sentence for the learner, in the judge's own words. */
  note: string;
};

/**
 * The three moves a session has after a judgement: carry on, ask again, or
 * show the phrase and move on. Deliberately not a grade — the scheduler's
 * grade is derived from the session outcome, in `summarise`, where every other
 * kind's is derived too.
 */
export type OwnWordsDecision = 'good' | 'retry' | 'reveal';

/** How many meaning words a `mustKeep` list holds. Short enough to be checkable. */
export const MUST_KEEP_MAX = 3;

/**
 * English words that carry grammar rather than meaning. Dropping these leaves
 * what the learner's own French has to get across; keeping them would turn
 * "must keep" into "must translate word for word", which is the opposite of
 * the exercise. Politeness words are NOT in here: "please" is meaning in
 * French as much as in English, and losing it changes what was said.
 */
const FUNCTION_WORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'me',
  'my',
  'you',
  'your',
  'we',
  'us',
  'our',
  'it',
  'its',
  'he',
  'she',
  'they',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'will',
  'would',
  'can',
  'could',
  'to',
  'of',
  'for',
  'and',
  'or',
  'but',
  'if',
  'so',
  'that',
  'this',
  'in',
  'on',
  'at',
  'with',
  'as',
  'from',
  'some',
  'any',
]);

/** Letters only, apostrophes kept inside a word, everything else a break. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}'’]+/u)
    .map((w) => w.replace(/^['’]+|['’]+$/gu, ''))
    .filter((w) => w.length > 0);
}

/**
 * The meaning the learner's own words have to carry, read off the English
 * gloss before anyone attempts anything.
 *
 * Deterministic and dumb on purpose: content words in the order they were
 * written, deduplicated, capped. It is a checkable note about what was asked,
 * not an answer key, and the judge is free to accept language that shares none
 * of these words as long as the meaning survives. A gloss made entirely of
 * function words keeps the whole gloss rather than returning nothing, because
 * an empty list would read as "nothing to keep".
 */
export function meaningWords(en: string): string[] {
  const kept: string[] = [];
  for (const word of words(en)) {
    if (FUNCTION_WORDS.has(word)) continue;
    if (kept.includes(word)) continue;
    kept.push(word);
    if (kept.length === MUST_KEEP_MAX) break;
  }
  if (kept.length > 0) return kept;
  const whole = en.trim();
  return whole === '' ? [] : [whole.toLowerCase()];
}

/**
 * Author the exercise for one phrase in one situation.
 *
 * `accepted` stays empty and that is the honest shape: this exercise has no
 * right string, and putting the taught phrase in there would quietly turn it
 * back into the recall drill it exists to replace.
 */
export function ownWordsFrom(phrase: { fr: string; en: string; key: string }, situation: string): OwnWordsExercise {
  return {
    kind: 'own-words',
    id: `own:${phrase.key}`,
    phraseKey: phrase.key,
    difficulty: 'production',
    fr: phrase.fr,
    en: phrase.en,
    situation,
    mustKeep: meaningWords(phrase.en),
    accepted: [],
  };
}

/**
 * Turn one judgement into one session move. See the note at the top of the
 * file for why awkward-but-understood is good, and why a lost meaning gets
 * exactly one more go.
 *
 * `misses` is how many times this exercise has already been missed, so the
 * bound is the same arithmetic `answerCurrent` applies to every other kind:
 * this attempt is the last one when `misses + 1` reaches MAX_MISSES.
 */
export function decideOwnWords(verdict: OwnWordsVerdict, misses: number): 'good' | 'retry' | 'reveal' {
  if (verdict.meaningKept && verdict.comprehensible) return 'good';
  return misses + 1 < MAX_MISSES ? 'retry' : 'reveal';
}

/**
 * A sitting of exactly one own-words exercise.
 *
 * Built through `buildDrillSession` rather than by hand so the app opens it
 * with the same state object, the same queue and the same `answerCurrent` as
 * any other drill. A second way to make a session is a second engine to keep
 * in step, and the miss counting would be the first thing to drift.
 *
 * The deck is empty and the bank holds one exercise, which is the builder's
 * never-met-this-phrase path: no card exists, so no rung is claimed for the
 * phrase, and no review card is invented by opening the screen.
 *
 * `now` only stamps `startedAt`; core still reads no clock, and the caller
 * passes its own so a sitting's length is measured against a real one.
 */
export function scopedOwnWordsSession(
  phrase: { fr: string; en: string; key: string },
  situation: string,
  now = 0,
): DrillSessionState {
  const exercise = ownWordsFrom(phrase, situation);
  return buildDrillSession([], [exercise], now, { only: [phrase.key] });
}
