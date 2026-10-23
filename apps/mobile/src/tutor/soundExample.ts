/**
 * How an end card introduces a sound: by a word first, the symbol on request.
 *
 * Whole-app Stage 3A (2026-09-25). "/y/" means nothing to most beginners;
 * "the sound in « tu »" is something they can hear in their head. So the lead
 * line is always a word, and the IPA is an optional detail behind a toggle.
 *
 * The example prefers a word the learner actually said in this session, because
 * that is the most concrete one there is; otherwise it is the inventory's first
 * example, which core biases toward beginner vocabulary. Nothing is invented:
 * an unknown sound has no example and the caller draws none.
 */

import { getPhoneme } from '@luvani/core';

export function soundExampleWord(ipa: string, heard?: string | null): string | null {
  const own = heard?.trim() ?? '';
  if (own.length > 0) return own;
  return getPhoneme(ipa)?.examples[0] ?? null;
}

/** "The sound in « tu »", or with the word it is easily confused with. */
export function soundInWord(word: string, notWord?: string | null): string {
  const not = notWord?.trim() ?? '';
  return not.length > 0 ? `The sound in « ${word} », not « ${not} »` : `The sound in « ${word} »`;
}

/**
 * The recap's sound heading, example first.
 *
 * The closure's acoustic panel names the sound in notation ("Your /y/, and the
 * /u/ it is not"). When the panel carries a minimal pair, the same contrast is
 * said with two real words instead. With no pair, the inventory's own example
 * word leads, as it does on the lesson summary; with neither, there is no
 * honest example and the original heading stands.
 */
export function exampleFirstHeading(
  acoustic: { heading: string; pair: { a: { word: string }; b: { word: string } } | null },
  example: string | null,
): string {
  if (acoustic.pair !== null) return soundInWord(acoustic.pair.a.word, acoustic.pair.b.word);
  const word = example?.trim() ?? '';
  return word.length > 0 ? soundInWord(word) : acoustic.heading;
}

/** The sounds that held up, named by words rather than symbols. */
export function heldSoundsLine(words: readonly string[]): string {
  const quoted = words.map((word) => `« ${word} »`).join(', ');
  return words.length === 1
    ? `You held the sound in ${quoted} steady in this lesson.`
    : `You held the sounds in ${quoted} steady in this lesson.`;
}

/** The label over one sound to work on, on the lesson end card and on a conversation recap that heard one. */
export const SOUND_FOCUS_LABEL = 'One sound to practise next';

/** The toggle that shows the notation and the scorer's reason, for those who want them. */
export const SOUND_DETAIL = {
  show: 'Show sound details',
  hide: 'Hide sound details',
} as const;
