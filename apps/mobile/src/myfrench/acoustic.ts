/**
 * One sound, and the two words that tell it apart.
 *
 * The founder's mockup asked for an Acoustic Precision panel, and almost all of
 * it was already written and had never been drawn. `phonemes/inventory.ts`
 * carries a plain-English articulation cue for all thirty-six French phonemes
 * and a physical trick for the twelve hardest; `phonemes/drills.ts` carries
 * minimal pairs with the word, its IPA and its meaning on both sides. Nothing
 * here invents content. It selects.
 *
 * ## Where the sound comes from, and why that matters
 *
 * From the learner's own last measured sound check, and from nowhere else. A
 * check is the one place in this app where audio is compared against a known
 * reference, so it is the only honest source for "this is your sound". Until
 * F468 the check stored a sentence about the sound and threw the sound away, so
 * this panel could not have existed at all.
 *
 * ## What this panel refuses to say
 *
 * No score, no percentage, no "mastered" or "contrast" badge on either word.
 * The mockup had them and they cannot be earned: there is no per-word history
 * to read, the offline path's observations are built in `mockSpeech.ts` and the
 * live path's scoring is behind a flag that is off. A badge would be a
 * measurement invented to fill a slot, which PEDAGOGY.md names as the one thing
 * pronunciation feedback may never do.
 *
 * It also never reprints the stored `focus` sentence. That sentence can say
 * "it came up 4 times today" (`phonemes/scoring.ts`), and this page is read
 * months later. The authored cue says the same thing and is true whenever it is
 * read. `sounds.ts` guards the other path for the same reason.
 */

import { bestDrillFor, getPhoneme, type MinimalPair } from '@luvani/core';

export const ACOUSTIC = {
  label: 'Acoustic precision',
  /** The chip beside the label. One sound, never a list of failings. */
  focusChip: 'Single sound focus',
  cueLabel: 'Physical cue',
  listen: 'Listen',
} as const;

export interface AcousticWord {
  word: string;
  /** Broad IPA, drawn in brackets the way the drill player draws it. */
  ipa: string;
  gloss: string;
}

export interface Acoustic {
  /** "Pure /y/, and the English oo it is not" — composed here, never in the tsx. */
  heading: string;
  /** The articulation instruction, authored and timeless. */
  cue: string;
  /** The physical image for the hardest sounds, or null. */
  trick: string | null;
  /** The two words a learner tells apart. Null when no pair exists for this sound. */
  pair: { a: AcousticWord; b: AcousticWord } | null;
  /** One sentence saying why this sound is worth the trouble. */
  why: string | null;
}

/** The pair a learner meets first: the drill's own opener. */
function firstPair(pairs: readonly MinimalPair[] | undefined): MinimalPair | null {
  return pairs === undefined || pairs.length === 0 ? null : pairs[0]!;
}

/**
 * The panel for one sound, or null.
 *
 * Null on three honest occasions: no check has named a sound, the symbol on the
 * record is not one this build knows, or the sound has no authored cue. The
 * screen draws nothing at all in each case rather than a frame with a gap in it.
 */
export function acousticFor(ipa: string | null): Acoustic | null {
  if (ipa === null || ipa === '') return null;
  const phoneme = getPhoneme(ipa);
  if (!phoneme) return null;

  const drill = bestDrillFor(phoneme, phoneme.typicalSubstitution);
  const pair = firstPair(drill?.pairs);

  return {
    heading: headingFor(ipa, phoneme.typicalSubstitution),
    cue: phoneme.cue,
    trick: phoneme.trick ?? null,
    pair: pair === null ? null : { a: pair.a, b: pair.b },
    why: drill?.why ?? null,
  };
}

/**
 * What the panel is called.
 *
 * The mockup wrote "Pure /y/ vs English 'oo' (/u/)". The contrast half is only
 * honest when the inventory actually records what an English speaker puts there
 * instead, so a sound with no typical substitution gets the shorter heading
 * rather than a comparison with nothing on the other side of it.
 */
function headingFor(ipa: string, substitution: string | undefined): string {
  return substitution === undefined ? `Your /${ipa}/` : `Your /${ipa}/, and the /${substitution}/ it is not`;
}
