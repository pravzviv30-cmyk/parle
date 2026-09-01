/**
 * Stand-in for the speech pipeline.
 *
 * Until the LiveKit agent and Speechace are wired up, this fabricates the shape of
 * data those services will return so the whole session loop, the ladder, the
 * scoring, and the end card can be driven and judged for real.
 *
 * The default profile is a genuine English-L1 error pattern rather than random
 * noise: a weak uvular /ʁ/ substituted with the English approximant, shaky nasal
 * vowels, everything else broadly fine. That is what an anglophone beginner
 * actually sounds like, and it means the end card exercises the real path through
 * the scorer rather than a lucky one.
 */

import type { LessonTurn, PhonemeObservation } from '@luvani/core';

export type LearnerProfile = 'anglophone-beginner' | 'confident' | 'struggling';

/** Mean score and the sound they slip into, per phoneme, for a typical anglophone. */
const ANGLOPHONE_WEAKNESS: Record<string, { mean: number; substituted?: string }> = {
  'ʁ': { mean: 44, substituted: 'l' },
  'y': { mean: 58, substituted: 'u' },
  'ɔ̃': { mean: 62 },
  'ɛ̃': { mean: 59 },
  'ɑ̃': { mean: 64 },
  'œ̃': { mean: 66 },
  'ʒ': { mean: 71, substituted: 'ʃ' },
  'ø': { mean: 63, substituted: 'u' },
  'e': { mean: 76 },
};

function jitter(mean: number, spread = 7): number {
  const v = mean + (Math.random() * 2 - 1) * spread;
  return Math.max(5, Math.min(100, Math.round(v)));
}

/**
 * Which spelling patterns carry each sound.
 *
 * A real assessor returns per-word alignment, so this only stands in for the mock —
 * but it doubles as the fallback for assessors that score a whole utterance without
 * telling us which word the sound was in. Feedback that quotes an entire sentence
 * back as "the word you got wrong" reads as broken.
 */
const CARRIER: Record<string, RegExp> = {
  'ʁ': /r/i,
  'y': /u/i,
  'ɔ̃': /on|om/i,
  'ɛ̃': /in$|ain|ein|im|ien/i,
  'ɑ̃': /an|en|am|em/i,
  'œ̃': /^un$|um/i,
  'ʒ': /^j|ge|jou/i,
  'ø': /eu/i,
  'œ': /eu|œu/i,
  'e': /é|er$|ez$/i,
  'ɛ': /è|ê|ai|ei/i,
  'u': /ou/i,
  'o': /o|au|eau/i,
  'w': /oi|ou[aeiy]/i,
  'ɥ': /ui/i,
};

/** The word in this line that most plausibly carries the sound. */
function carrierWord(line: string, ipa: string): string {
  const words = line
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, ''))
    .filter(Boolean);
  const pattern = CARRIER[ipa];
  const hit = pattern ? words.find((w) => pattern.test(w)) : undefined;
  return hit ?? words[0] ?? line;
}

export function mockObservations(turn: LessonTurn, profile: LearnerProfile = 'anglophone-beginner'): PhonemeObservation[] {
  return turn.focusPhonemes.map((ipa) => {
    const word = carrierWord(turn.target, ipa);
    if (profile === 'confident') return { ipa, score: jitter(92, 5), word };
    const weak = ANGLOPHONE_WEAKNESS[ipa];
    const base = profile === 'struggling' ? (weak?.mean ?? 70) - 15 : (weak?.mean ?? 82);
    return { ipa, score: jitter(base), word, substituted: weak?.substituted };
  });
}

/** Roughly how long it takes to say a line, for the speaking-share figure. */
export function estimateDurationSec(text: string): number {
  const syllables = Math.max(1, text.replace(/[^a-zà-ÿ]/gi, '').length / 2.6);
  return Math.round((syllables / 3.4) * 10) / 10; // ~3.4 syllables/sec, slow beginner pace
}
