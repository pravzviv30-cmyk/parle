/**
 * Whatever the vendor calls a sound, translated into the one alphabet the
 * inventory speaks.
 *
 * `parseSpeechace` used to take the vendor's `phone` string and hand it on as an
 * IPA symbol. Downstream that becomes an exact `BY_IPA.get(ipa)` lookup, and a
 * miss is skipped with a comment about not guessing — so a vendor that answers
 * in X-SAMPA, or in ASCII because a request went out without the right dialect,
 * produces a session where every single observation is silently discarded and
 * there is never a focus point. Not an error. Not a warning. Just a learner who
 * is told nothing, session after session, and no way to tell that from a learner
 * who is doing fine.
 *
 * So: translate what can be translated, and count what cannot, so an alphabet
 * change shows up as a line in the log rather than as a slow silence.
 */

const FRENCH_IPA = new Set([
  'i', 'e', 'ɛ', 'a', 'ɔ', 'o', 'u', 'y', 'ø', 'œ', 'ə',
  'ɑ̃', 'ɛ̃', 'ɔ̃', 'œ̃',
  'j', 'ɥ', 'w',
  'p', 'b', 't', 'd', 'k', 'g',
  'f', 'v', 's', 'z', 'ʃ', 'ʒ',
  'm', 'n', 'ɲ', 'ŋ',
  'l', 'ʁ',
]);

/**
 * X-SAMPA and the ASCII conventions that travel with it, plus the handful of
 * near-miss IPA spellings vendors use for the same sound.
 *
 * French /ʁ/ arrives as R, r, or the uvular fricative's other symbols; the
 * distinction between them is not one this product teaches, so they all land on
 * the sound the drills are written for.
 */
const ALIASES: Record<string, string> = {
  // vowels
  I: 'i', E: 'ɛ', A: 'a', O: 'ɔ', U: 'u', Y: 'y',
  '2': 'ø', '9': 'œ', '@': 'ə', '6': 'ə', ':': '',
  // nasal vowels, in every ASCII spelling seen in the wild
  'a~': 'ɑ̃', 'A~': 'ɑ̃', 'an': 'ɑ̃', 'ɑ': 'ɑ̃', 'ã': 'ɑ̃',
  'e~': 'ɛ̃', 'E~': 'ɛ̃', 'in': 'ɛ̃', 'ẽ': 'ɛ̃',
  'o~': 'ɔ̃', 'O~': 'ɔ̃', on: 'ɔ̃', 'õ': 'ɔ̃',
  '9~': 'œ̃', 'un': 'œ̃', 'œ~': 'œ̃',
  // semivowels
  H: 'ɥ', W: 'w', J: 'j',
  // consonants
  S: 'ʃ', Z: 'ʒ', N: 'ŋ', G: 'ŋ',
  R: 'ʁ', r: 'ʁ', ʀ: 'ʁ', χ: 'ʁ', ʕ: 'ʁ',
  // ARPAbet-ish, which shows up when a request lands on an English model
  SH: 'ʃ', ZH: 'ʒ', NG: 'ŋ', IY: 'i', EH: 'ɛ', AA: 'a', AO: 'ɔ', UW: 'u',
  P: 'p', B: 'b', T: 't', D: 'd', K: 'k', G_: 'g', F: 'f', V: 'v', M: 'm', L: 'l',
};

/**
 * The vendor's symbol as an inventory IPA symbol, or null if we do not know.
 *
 * Null is deliberately different from a guess. Naming the wrong sound to a
 * learner is worse than naming none.
 */
export function toInventoryIpa(symbol: string): string | null {
  const trimmed = symbol.trim();
  if (trimmed.length === 0) return null;

  // Length markers and stress digits carry no phoneme identity here.
  const bare = trimmed.replace(/[ːˈˌ0-9]+$/u, '') || trimmed;
  for (const candidate of [trimmed, bare, trimmed.normalize('NFD'), bare.normalize('NFD')]) {
    if (FRENCH_IPA.has(candidate)) return candidate;
  }
  for (const candidate of [trimmed, bare]) {
    const mapped = ALIASES[candidate];
    if (mapped !== undefined && FRENCH_IPA.has(mapped)) return mapped;
  }
  return null;
}

/** Is this already a symbol the inventory knows? Exposed for tests. */
export function isInventoryIpa(symbol: string): boolean {
  return FRENCH_IPA.has(symbol);
}
