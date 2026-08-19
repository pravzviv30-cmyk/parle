/**
 * The French phoneme inventory, weighted for English-L1 learners.
 *
 * This file is the reason a French-only app beats a fifty-language one. A generic
 * tutor can tell you "your pronunciation was 62%". It cannot tell you that you
 * substituted /u/ for /y/ and therefore just said "all" when you meant "you",
 * because it has no per-language model of which contrasts carry meaning and which
 * errors an English speaker actually makes.
 *
 * Difficulty is specifically difficulty-for-an-English-speaker, not intrinsic
 * difficulty. /ʒ/ is trivial for a French child and awkward for an American,
 * because English only permits it word-medially ("measure"), never initially.
 */

export type PhonemeClass =
  | 'oral-vowel'
  | 'nasal-vowel'
  | 'semivowel'
  | 'plosive'
  | 'fricative'
  | 'nasal-consonant'
  | 'liquid';

/**
 * 1 — transfers directly from English, essentially free.
 * 2 — close English equivalent, small systematic difference (aspiration, tenseness).
 * 3 — exists in English but in restricted positions, or a contrast English blurs.
 * 4 — no English equivalent, but errors rarely destroy meaning.
 * 5 — no English equivalent AND the error changes what word you said.
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Phoneme {
  /** IPA symbol, the canonical key used everywhere in the system. */
  ipa: string;
  class: PhonemeClass;
  difficulty: Difficulty;
  /** Does English have a close-enough equivalent to transfer from? */
  existsInEnglish: boolean;
  /** Common French words containing it, biased toward A0 vocabulary. */
  examples: string[];
  /** Plain-English articulation instruction shown to the learner. No IPA jargon. */
  cue: string;
  /** What an English speaker typically produces instead. Drives error explanations. */
  typicalSubstitution?: string;
  /** Set when substituting produces a different real French word. */
  meaningBearing?: boolean;
  /** Shown when the learner is stuck; a physical trick rather than a description. */
  trick?: string;
}

export const FRENCH_PHONEMES: readonly Phoneme[] = [
  // ---------------------------------------------------------------- oral vowels
  {
    ipa: 'i',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['si', 'lit', 'midi', 'ici'],
    cue: 'Like "ee" in "see", but shorter and held perfectly still.',
    typicalSubstitution: 'iː',
    trick: 'English "ee" drifts as you say it. French "i" does not move at all.',
  },
  {
    ipa: 'e',
    class: 'oral-vowel',
    difficulty: 3,
    existsInEnglish: false,
    examples: ['été', 'nez', 'chez', 'parler'],
    cue: 'Like "ay" in "say", but stop before the "y". One pure sound.',
    typicalSubstitution: 'eɪ',
    trick: 'Say "say" and freeze your mouth halfway. That frozen sound is /e/.',
    // fée / fait, ces / sait, thé / tait — and it is what marks the verb tense.
    // See the e-closed-vs-open drill.
    meaningBearing: true,
  },
  {
    ipa: 'ɛ',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['mère', 'sept', 'faire', 'très'],
    cue: 'Like "e" in "bet". Jaw a little lower than /e/.',
  },
  {
    ipa: 'a',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['patte', 'la', 'chat', 'madame'],
    cue: 'Bright and forward, closer to "cat" than to "father".',
  },
  {
    ipa: 'ɔ',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['sort', 'homme', 'école', 'porte'],
    cue: 'Like "o" in British "hot". Lips rounded, jaw open.',
  },
  {
    ipa: 'o',
    class: 'oral-vowel',
    difficulty: 3,
    existsInEnglish: false,
    examples: ['eau', 'mot', 'chaud', 'gauche'],
    cue: 'Like "oh" with no "w" at the end. Round your lips before you start.',
    typicalSubstitution: 'oʊ',
    trick: 'Round your lips first, then make the sound. Do not move them again.',
  },
  {
    ipa: 'u',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['vous', 'tout', 'jour', 'bonjour'],
    cue: 'Like "oo" in "food", lips pushed tightly forward.',
  },
  {
    ipa: 'y',
    class: 'oral-vowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['tu', 'rue', 'sur', 'salut'],
    cue: 'Say "ee". Now round your lips as if for "oo", and keep your tongue still.',
    typicalSubstitution: 'u',
    meaningBearing: true,
    trick: 'Hold "eeee". Now push your lips into a whistle. Do not let your tongue follow.',
  },
  {
    ipa: 'ø',
    class: 'oral-vowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['deux', 'peu', 'bleu', 'jeudi'],
    cue: 'Say "ay" as in "say". Now round your lips and keep your tongue still.',
    typicalSubstitution: 'u',
    meaningBearing: true,
    trick: 'Same trick as /y/, one notch lower: start from "ay" instead of "ee".',
  },
  {
    ipa: 'œ',
    class: 'oral-vowel',
    difficulty: 4,
    existsInEnglish: false,
    examples: ['peur', 'sœur', 'fleur', 'heure'],
    cue: 'Like "e" in "bet" with rounded lips. Jaw lower than /ø/.',
    typicalSubstitution: 'ɜː',
    // Unround it, as the vowel in "her" does, and it lands on /ɛ/: peur becomes
    // père, sœur becomes serre. See the oeu-vs-e drill.
    meaningBearing: true,
  },
  {
    ipa: 'ə',
    class: 'oral-vowel',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['le', 'petit', 'je', 'demain'],
    cue: 'A short, lightly rounded "uh". Often dropped entirely in fast speech.',
  },

  // --------------------------------------------------------------- nasal vowels
  // English has no phonemic nasal vowels at all. All four are pure new territory,
  // and three of them separate extremely common A0 words.
  {
    ipa: 'ɑ̃',
    class: 'nasal-vowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['dans', 'temps', 'blanc', 'sans', 'trente'],
    cue: 'An open "ah" sent through your nose. The "n" is never actually pronounced.',
    typicalSubstitution: 'ɑn',
    meaningBearing: true,
    trick: 'Pinch your nose and say it. If the sound barely changes, it is not nasal yet.',
  },
  {
    ipa: 'ɛ̃',
    class: 'nasal-vowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['vin', 'pain', 'main', 'bien', 'cinq'],
    cue: 'A flat "a" as in "cat", sent through your nose. No "n" sound at the end.',
    typicalSubstitution: 'æn',
    meaningBearing: true,
    trick: 'Your tongue stays put and your mouth never closes. Closing makes an "n".',
  },
  {
    ipa: 'ɔ̃',
    class: 'nasal-vowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['bon', 'non', 'mon', 'pont', 'bonjour'],
    cue: 'A rounded "oh" through the nose, lips tight. No "n" at the end.',
    typicalSubstitution: 'ɔn',
    meaningBearing: true,
    trick: 'Round your lips hard. /ɔ̃/ with loose lips comes out as /ɑ̃/.',
  },
  {
    ipa: 'œ̃',
    class: 'nasal-vowel',
    difficulty: 4,
    existsInEnglish: false,
    examples: ['un', 'brun', 'parfum', 'lundi'],
    cue: 'Like /ɛ̃/ but with rounded lips.',
    typicalSubstitution: 'ʌn',
    // Most speakers under ~50 in northern France merge this with /ɛ̃/. We score it
    // leniently and never build a drill that depends on the contrast surviving.
  },

  // ---------------------------------------------------------------- semi-vowels
  {
    ipa: 'j',
    class: 'semivowel',
    difficulty: 1,
    existsInEnglish: true,
    examples: ['bien', 'yeux', 'fille', 'travail'],
    cue: 'Like "y" in "yes".',
  },
  {
    ipa: 'ɥ',
    class: 'semivowel',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['huit', 'lui', 'nuit', 'depuis'],
    cue: 'The /y/ sound turned into a glide. Round your lips and slide into the next vowel.',
    typicalSubstitution: 'w',
    meaningBearing: true,
    trick: 'It is /y/ said fast, not /w/. "lui" and "Louis" are different words.',
  },
  {
    ipa: 'w',
    class: 'semivowel',
    difficulty: 1,
    existsInEnglish: true,
    examples: ['oui', 'moi', 'trois', 'voiture'],
    cue: 'Like "w" in "we".',
  },

  // ------------------------------------------------------------------ plosives
  // French plosives are unaspirated. An English speaker's puff of air after p/t/k
  // is the single most recognisable marker of an anglophone accent.
  {
    ipa: 'p',
    class: 'plosive',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['pain', 'papa', 'petit', 'pardon'],
    cue: 'Like "p" with no puff of air after it.',
    typicalSubstitution: 'pʰ',
    trick: 'Hold a tissue in front of your mouth. It should not move.',
  },
  { ipa: 'b', class: 'plosive', difficulty: 1, existsInEnglish: true, examples: ['bon', 'bien', 'bonjour'], cue: 'Like "b" in "bed".' },
  {
    ipa: 't',
    class: 'plosive',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['tout', 'table', 'très', 'petit'],
    cue: 'Tongue against your teeth, not the ridge behind them. No puff of air.',
    typicalSubstitution: 'tʰ',
  },
  {
    ipa: 'd',
    class: 'plosive',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['deux', 'dans', 'demain', 'madame'],
    cue: 'Tongue against your teeth, not the ridge behind them.',
  },
  {
    ipa: 'k',
    class: 'plosive',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['café', 'quoi', 'comment', 'cinq'],
    cue: 'Like "k" with no puff of air after it.',
    typicalSubstitution: 'kʰ',
  },
  { ipa: 'g', class: 'plosive', difficulty: 1, existsInEnglish: true, examples: ['gare', 'gauche', 'grand'], cue: 'Like "g" in "go".' },

  // ----------------------------------------------------------------- fricatives
  { ipa: 'f', class: 'fricative', difficulty: 1, existsInEnglish: true, examples: ['faire', 'café', 'enfin'], cue: 'Like "f" in "fun".' },
  { ipa: 'v', class: 'fricative', difficulty: 1, existsInEnglish: true, examples: ['vous', 'vin', 'avec'], cue: 'Like "v" in "van".' },
  { ipa: 's', class: 'fricative', difficulty: 1, existsInEnglish: true, examples: ['sur', 'six', 'merci'], cue: 'Like "s" in "see".' },
  {
    ipa: 'z',
    class: 'fricative',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['zéro', 'maison', 'les amis'],
    cue: 'Like "z" in "zoo". Also the sound a silent "s" makes in a liaison.',
  },
  { ipa: 'ʃ', class: 'fricative', difficulty: 1, existsInEnglish: true, examples: ['chat', 'chercher', 'chaud'], cue: 'Like "sh" in "shoe".' },
  {
    ipa: 'ʒ',
    class: 'fricative',
    difficulty: 3,
    existsInEnglish: false,
    examples: ['je', 'rouge', 'bonjour', 'jour'],
    cue: 'The "s" in "measure". English never starts a word with this sound. French does it all the time.',
    typicalSubstitution: 'dʒ',
    trick: 'Say "measure", isolate the middle sound, then put it at the front of "je".',
    // j'ai / chez, joue / chou, gêne / chêne. See the zh-initial drill.
    meaningBearing: true,
  },

  // ------------------------------------------------------------ nasal consonants
  { ipa: 'm', class: 'nasal-consonant', difficulty: 1, existsInEnglish: true, examples: ['madame', 'merci', 'moi'], cue: 'Like "m" in "me".' },
  { ipa: 'n', class: 'nasal-consonant', difficulty: 1, existsInEnglish: true, examples: ['non', 'nous', 'bonne'], cue: 'Like "n" in "no".' },
  {
    ipa: 'ɲ',
    class: 'nasal-consonant',
    difficulty: 3,
    existsInEnglish: false,
    examples: ['agneau', 'montagne', 'champagne'],
    cue: 'One single sound, like the "ny" in "canyon" squeezed together.',
    typicalSubstitution: 'nj',
  },
  { ipa: 'ŋ', class: 'nasal-consonant', difficulty: 1, existsInEnglish: true, examples: ['parking', 'camping'], cue: 'Like "ng" in "sing". Only in borrowed words.' },

  // -------------------------------------------------------------------- liquids
  {
    ipa: 'l',
    class: 'liquid',
    difficulty: 2,
    existsInEnglish: true,
    examples: ['le', 'ville', 'elle', 'salut'],
    cue: 'Always bright and forward. Never the heavy "l" of English "full".',
    typicalSubstitution: 'ɫ',
  },
  {
    ipa: 'ʁ',
    class: 'liquid',
    difficulty: 5,
    existsInEnglish: false,
    examples: ['rue', 'Paris', 'merci', 'bonjour', 'très'],
    cue: 'Made at the very back of the throat, near where you gargle. Your tongue tip stays down and forward.',
    typicalSubstitution: 'ɹ',
    meaningBearing: true,
    trick: 'Whisper a soft "k", then let it buzz. The English "r" curls the tongue up. The French one never does.',
  },
] as const;

const BY_IPA = new Map(FRENCH_PHONEMES.map((p) => [p.ipa, p]));

export function getPhoneme(ipa: string): Phoneme | undefined {
  return BY_IPA.get(ipa);
}

/** Phonemes with no English equivalent — where practice time actually pays off. */
export function novelPhonemes(): Phoneme[] {
  return FRENCH_PHONEMES.filter((p) => !p.existsInEnglish);
}

/**
 * Phonemes where getting it wrong produces a different real word.
 * These are ranked first when choosing what to drill: an accent is cosmetic,
 * but saying "tout" when you meant "tu" is a failure to communicate.
 */
export function meaningBearingPhonemes(): Phoneme[] {
  return FRENCH_PHONEMES.filter((p) => p.meaningBearing === true);
}

/** Total inventory size — asserted in tests so accidental deletions are caught. */
export const PHONEME_COUNT = FRENCH_PHONEMES.length;
