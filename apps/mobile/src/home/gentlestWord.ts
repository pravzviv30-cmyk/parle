/**
 * Today's word for a learner whose level standing could not be read.
 *
 * Home's word is pitched: `wordsForLevel` narrows the pool to the learner's
 * tier, and the tier comes from XP that has to be read off the disk. So the
 * word waits on storage while the situation and the drawing beside it do not,
 * and that is deliberate, because a tier one word replaced a moment later is
 * the app appearing to change its mind about somebody.
 *
 * A read that fails never answers, so the word never arrives, and Home is left
 * with a hole where the day's card goes for the rest of the visit. This is the
 * other end of that: one word, at the gentlest tier, on the same clock reading
 * as everything else on the screen.
 *
 * `daily/tier.ts` had already settled the principle in as many words, for a
 * standing that reads as nonsense: "a learner whose stored XP is somehow
 * unreadable should meet the gentlest pool rather than a blank screen". A tier
 * is a pitch and never an assessment, so pitching low for a learner nobody
 * could measure claims nothing about them. It is the counts that must stay
 * withheld, because a nought where a real number belongs is the app forgetting
 * somebody who has been practising for months.
 */

import { DAILY_WORDS, dailyPick, wordsForLevel, type DailyWord } from '@luvani/core';

/**
 * The standing a learner is pitched at when theirs could not be read.
 *
 * Zero rather than an invented average: `wordTierFor` maps it to tier one, the
 * pool a first morning meets, and being shown it is not a claim that anybody
 * belongs there.
 */
export const UNREAD_LEVEL = 0;

/**
 * Today's gentlest word, or null when there is no honest card to draw.
 *
 * `dailyPick` throws on an empty pool on purpose, so that a content bug is
 * never papered over with a plausible card. This is the one caller that must
 * not pass that throw on: it runs inside the rescue of a read that has already
 * failed, and a throw there would be an unhandled rejection rather than a word.
 * The pool is a parameter so the empty case can be asked for in a test rather
 * than only reasoned about.
 */
export function gentlestWord(now: number, pool: readonly DailyWord[] = DAILY_WORDS): DailyWord | null {
  const gentlest = wordsForLevel(pool, UNREAD_LEVEL);
  return gentlest.length === 0 ? null : dailyPick(gentlest, now);
}
