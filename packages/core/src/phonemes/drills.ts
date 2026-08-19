/**
 * The 60-second drill bank.
 *
 * Design rule: wherever possible a drill is built from **minimal pairs where both
 * words are real and common**. "Your /y/ scored 44%" is a number. "You just said
 * 'roue' (wheel) when you meant 'rue' (street)" is a reason to care. Motivation
 * comes from the consequence, not the score.
 *
 * Every pair below is a genuine French minimal pair: the two words differ in
 * exactly one phoneme and both are words a beginner will actually meet.
 */

import type { Phoneme } from './inventory.ts';

export interface DrillWord {
  word: string;
  ipa: string;
  gloss: string;
}

export interface MinimalPair {
  a: DrillWord;
  b: DrillWord;
}

export type DrillKind =
  /** Two real words separated by one phoneme. The strongest kind. */
  | 'minimal-pair'
  /** No usable minimal pair exists; drill the articulation in isolation. */
  | 'articulation'
  /** A rule spanning word boundaries (liaison, silent finals) rather than one sound. */
  | 'pattern';

export interface Drill {
  id: string;
  kind: DrillKind;
  /** The phoneme this drill repairs. */
  target: string;
  /** The phoneme the learner is wrongly substituting, when applicable. */
  contrast?: string;
  title: string;
  /** One sentence explaining why this matters, in the learner's own language. */
  why: string;
  pairs?: MinimalPair[];
  /** Used by 'articulation' and 'pattern' drills. */
  items?: DrillWord[];
  /** Target seconds. Kept at 60 so it never feels like homework. */
  durationSec: number;
}

export const DRILLS: readonly Drill[] = [
  {
    id: 'y-vs-u',
    kind: 'minimal-pair',
    target: 'y',
    contrast: 'u',
    title: 'tu / tout: round your lips',
    why: 'This is the single most meaning-destroying vowel error an English speaker makes in French. Each pair below is two different words.',
    durationSec: 60,
    pairs: [
      { a: { word: 'tu', ipa: 'ty', gloss: 'you' }, b: { word: 'tout', ipa: 'tu', gloss: 'all' } },
      { a: { word: 'rue', ipa: 'ʁy', gloss: 'street' }, b: { word: 'roue', ipa: 'ʁu', gloss: 'wheel' } },
      { a: { word: 'vu', ipa: 'vy', gloss: 'seen' }, b: { word: 'vous', ipa: 'vu', gloss: 'you (formal)' } },
      { a: { word: 'su', ipa: 'sy', gloss: 'known' }, b: { word: 'sous', ipa: 'su', gloss: 'under' } },
      { a: { word: 'nu', ipa: 'ny', gloss: 'bare' }, b: { word: 'nous', ipa: 'nu', gloss: 'we' } },
      { a: { word: 'dessus', ipa: 'dəsy', gloss: 'above' }, b: { word: 'dessous', ipa: 'dəsu', gloss: 'below' } },
    ],
  },
  {
    id: 'on-vs-an',
    kind: 'minimal-pair',
    target: 'ɔ̃',
    contrast: 'ɑ̃',
    title: 'bon / banc: rounding the nasal',
    why: 'Both are nasal vowels; only your lips tell them apart. Loose lips turn every "bon" into "banc".',
    durationSec: 60,
    pairs: [
      { a: { word: 'bon', ipa: 'bɔ̃', gloss: 'good' }, b: { word: 'banc', ipa: 'bɑ̃', gloss: 'bench' } },
      { a: { word: 'son', ipa: 'sɔ̃', gloss: 'his / her' }, b: { word: 'sans', ipa: 'sɑ̃', gloss: 'without' } },
      { a: { word: 'mon', ipa: 'mɔ̃', gloss: 'my' }, b: { word: 'ment', ipa: 'mɑ̃', gloss: '(he) lies' } },
      { a: { word: 'pont', ipa: 'pɔ̃', gloss: 'bridge' }, b: { word: 'pan', ipa: 'pɑ̃', gloss: 'section' } },
      { a: { word: 'long', ipa: 'lɔ̃', gloss: 'long' }, b: { word: 'lent', ipa: 'lɑ̃', gloss: 'slow' } },
    ],
  },
  {
    id: 'in-vs-an',
    kind: 'minimal-pair',
    target: 'ɛ̃',
    contrast: 'ɑ̃',
    title: 'pain / pan: the front nasal',
    why: '"Le vin" and "le vent" are wine and wind. Your tongue position is the only difference.',
    durationSec: 60,
    pairs: [
      { a: { word: 'pain', ipa: 'pɛ̃', gloss: 'bread' }, b: { word: 'pan', ipa: 'pɑ̃', gloss: 'section' } },
      { a: { word: 'vin', ipa: 'vɛ̃', gloss: 'wine' }, b: { word: 'vent', ipa: 'vɑ̃', gloss: 'wind' } },
      { a: { word: 'main', ipa: 'mɛ̃', gloss: 'hand' }, b: { word: 'ment', ipa: 'mɑ̃', gloss: '(he) lies' } },
      { a: { word: 'lin', ipa: 'lɛ̃', gloss: 'linen' }, b: { word: 'lent', ipa: 'lɑ̃', gloss: 'slow' } },
    ],
  },
  {
    id: 'in-vs-on',
    kind: 'minimal-pair',
    target: 'ɛ̃',
    contrast: 'ɔ̃',
    title: 'pain / pont: nasal against nasal',
    why: 'Once you can hear this pair, all four French nasal vowels come apart cleanly.',
    durationSec: 60,
    pairs: [
      { a: { word: 'pain', ipa: 'pɛ̃', gloss: 'bread' }, b: { word: 'pont', ipa: 'pɔ̃', gloss: 'bridge' } },
      { a: { word: 'vin', ipa: 'vɛ̃', gloss: 'wine' }, b: { word: 'vont', ipa: 'vɔ̃', gloss: '(they) go' } },
      { a: { word: 'bain', ipa: 'bɛ̃', gloss: 'bath' }, b: { word: 'bon', ipa: 'bɔ̃', gloss: 'good' } },
    ],
  },
  {
    id: 'nasal-not-n',
    kind: 'articulation',
    target: 'ɑ̃',
    title: 'The "n" you must not say',
    why: 'In a French nasal vowel the "n" is never pronounced. If your tongue touches the roof of your mouth, you have added a consonant that is not there.',
    durationSec: 60,
    items: [
      { word: 'dans', ipa: 'dɑ̃', gloss: 'in' },
      { word: 'temps', ipa: 'tɑ̃', gloss: 'time / weather' },
      { word: 'blanc', ipa: 'blɑ̃', gloss: 'white' },
      { word: 'trente', ipa: 'tʁɑ̃t', gloss: 'thirty' },
      { word: 'comment', ipa: 'kɔmɑ̃', gloss: 'how' },
    ],
  },
  {
    id: 'un-rounded-nasal',
    kind: 'articulation',
    target: 'œ̃',
    // Deliberately not a minimal pair. The textbook contrast here is brun /bʁœ̃/
    // against brin /bʁɛ̃/, but most French speakers under about fifty have merged
    // the two, so drilling it would train a distinction the learner will never
    // hear back from a real person. We teach the sound in the words that carry
    // it instead, and say plainly that the merge is fine.
    title: 'un, lundi, brun: the rounded nasal',
    why: 'You will say "un" within seconds of starting any French conversation. Round your lips and send it through your nose.',
    durationSec: 60,
    items: [
      { word: 'un', ipa: 'œ̃', gloss: 'a / one' },
      { word: 'un café', ipa: 'œ̃ ka.fe', gloss: 'a coffee' },
      { word: 'lundi', ipa: 'lœ̃.di', gloss: 'Monday' },
      { word: 'brun', ipa: 'bʁœ̃', gloss: 'brown' },
      { word: 'parfum', ipa: 'paʁ.fœ̃', gloss: 'perfume' },
    ],
  },
  {
    id: 'r-vs-l',
    kind: 'minimal-pair',
    target: 'ʁ',
    contrast: 'l',
    title: 'roi / loi: finding the back of the throat',
    why: 'The French R is made where you gargle, not where the English R curls. This pair forces the two apart.',
    durationSec: 60,
    pairs: [
      { a: { word: 'roi', ipa: 'ʁwa', gloss: 'king' }, b: { word: 'loi', ipa: 'lwa', gloss: 'law' } },
      { a: { word: 'rire', ipa: 'ʁiʁ', gloss: 'to laugh' }, b: { word: 'lire', ipa: 'liʁ', gloss: 'to read' } },
      { a: { word: 'rue', ipa: 'ʁy', gloss: 'street' }, b: { word: 'lu', ipa: 'ly', gloss: 'read' } },
      { a: { word: 'rond', ipa: 'ʁɔ̃', gloss: 'round' }, b: { word: 'long', ipa: 'lɔ̃', gloss: 'long' } },
    ],
  },
  {
    id: 'r-position',
    kind: 'articulation',
    target: 'ʁ',
    title: 'The R in the words you will say most',
    why: 'You cannot avoid this sound. It is in "merci", "bonjour" and "très". Get it right here and it works everywhere.',
    durationSec: 60,
    items: [
      { word: 'merci', ipa: 'mɛʁsi', gloss: 'thank you' },
      { word: 'bonjour', ipa: 'bɔ̃ʒuʁ', gloss: 'hello' },
      { word: 'très', ipa: 'tʁɛ', gloss: 'very' },
      { word: 'Paris', ipa: 'paʁi', gloss: 'Paris' },
      { word: 'pardon', ipa: 'paʁdɔ̃', gloss: 'sorry' },
    ],
  },
  {
    id: 'eu-vs-ou',
    kind: 'minimal-pair',
    target: 'ø',
    contrast: 'u',
    title: 'deux / doux: the other rounded vowel',
    why: 'You need this one to count to two. It is /y/’s slightly more open neighbour.',
    durationSec: 60,
    pairs: [
      { a: { word: 'deux', ipa: 'dø', gloss: 'two' }, b: { word: 'doux', ipa: 'du', gloss: 'soft' } },
      { a: { word: 'peu', ipa: 'pø', gloss: 'few' }, b: { word: 'pou', ipa: 'pu', gloss: 'louse' } },
      { a: { word: 'feu', ipa: 'fø', gloss: 'fire' }, b: { word: 'fou', ipa: 'fu', gloss: 'crazy' } },
      { a: { word: 'nœud', ipa: 'nø', gloss: 'knot' }, b: { word: 'nous', ipa: 'nu', gloss: 'we' } },
    ],
  },
  {
    id: 'oeu-vs-e',
    kind: 'minimal-pair',
    target: 'œ',
    contrast: 'ɛ',
    // The error an English speaker actually makes here is the vowel in "her":
    // central, and crucially unrounded. There is no French /ɜː/ to contrast
    // against, but an unrounded /œ/ lands on /ɛ/ — and that is a different word
    // every time, so the pairs below are exactly what the substitution costs.
    title: 'peur / père: keep your lips round',
    why: 'English "her" says this vowel with flat lips. Flatten yours in French and "peur" (fear) comes out as "père" (father).',
    durationSec: 60,
    pairs: [
      { a: { word: 'peur', ipa: 'pœʁ', gloss: 'fear' }, b: { word: 'père', ipa: 'pɛʁ', gloss: 'father' } },
      { a: { word: 'heure', ipa: 'œʁ', gloss: 'hour' }, b: { word: 'air', ipa: 'ɛʁ', gloss: 'air' } },
      { a: { word: 'meurt', ipa: 'mœʁ', gloss: '(he) dies' }, b: { word: 'mère', ipa: 'mɛʁ', gloss: 'mother' } },
      { a: { word: 'sœur', ipa: 'sœʁ', gloss: 'sister' }, b: { word: 'serre', ipa: 'sɛʁ', gloss: 'greenhouse' } },
      { a: { word: 'fleur', ipa: 'flœʁ', gloss: 'flower' }, b: { word: 'flair', ipa: 'flɛʁ', gloss: 'scent / flair' } },
    ],
  },
  {
    id: 'zh-initial',
    kind: 'minimal-pair',
    target: 'ʒ',
    contrast: 'ʃ',
    title: 'j’ai / chez: the hidden English sound',
    why: 'English only ever puts this sound inside a word ("measure"). French opens words with it, starting with "je".',
    durationSec: 60,
    pairs: [
      { a: { word: "j'ai", ipa: 'ʒe', gloss: 'I have' }, b: { word: 'chez', ipa: 'ʃe', gloss: 'at (someone’s place)' } },
      { a: { word: 'joue', ipa: 'ʒu', gloss: 'cheek' }, b: { word: 'chou', ipa: 'ʃu', gloss: 'cabbage' } },
      { a: { word: 'gêne', ipa: 'ʒɛn', gloss: 'embarrassment' }, b: { word: 'chêne', ipa: 'ʃɛn', gloss: 'oak' } },
    ],
  },
  {
    id: 'e-closed-vs-open',
    kind: 'minimal-pair',
    target: 'e',
    contrast: 'ɛ',
    title: 'fée / fait: stopping the glide',
    why: 'English turns every "ay" into a slide. French holds it still, and the difference marks your verb tenses.',
    durationSec: 60,
    pairs: [
      { a: { word: 'fée', ipa: 'fe', gloss: 'fairy' }, b: { word: 'fait', ipa: 'fɛ', gloss: 'fact / does' } },
      { a: { word: 'ces', ipa: 'se', gloss: 'these' }, b: { word: 'sait', ipa: 'sɛ', gloss: '(he) knows' } },
      { a: { word: 'thé', ipa: 'te', gloss: 'tea' }, b: { word: 'tait', ipa: 'tɛ', gloss: 'silences' } },
    ],
  },
  {
    id: 'ui-vs-wi',
    kind: 'minimal-pair',
    target: 'ɥ',
    contrast: 'w',
    title: 'lui / Louis: the glide only French has',
    why: 'This sound exists in no other major language. Substituting "w" is the classic anglophone tell.',
    durationSec: 60,
    pairs: [
      { a: { word: 'lui', ipa: 'lɥi', gloss: 'him' }, b: { word: 'Louis', ipa: 'lwi', gloss: 'Louis (name)' } },
      { a: { word: 'huit', ipa: 'ɥit', gloss: 'eight' }, b: { word: 'ouate', ipa: 'wat', gloss: 'cotton wool' } },
    ],
  },
  {
    id: 'unaspirated-stops',
    kind: 'articulation',
    target: 'p',
    title: 'Losing the puff of air',
    why: 'English fires a puff of air after p, t and k. French never does. Removing it changes your accent more than any single vowel.',
    durationSec: 60,
    items: [
      { word: 'papa', ipa: 'papa', gloss: 'dad' },
      { word: 'petit', ipa: 'pəti', gloss: 'small' },
      { word: 'café', ipa: 'kafe', gloss: 'coffee' },
      { word: 'table', ipa: 'tabl', gloss: 'table' },
      { word: 'quinze', ipa: 'kɛ̃z', gloss: 'fifteen' },
    ],
  },
  {
    id: 'silent-finals',
    kind: 'pattern',
    target: 't',
    title: 'The letters you do not say',
    why: 'Most final consonants in French are silent. Pronouncing them is the fastest way to sound foreign.',
    durationSec: 60,
    items: [
      { word: 'petit', ipa: 'pəti', gloss: 'small (silent "t")' },
      { word: 'grand', ipa: 'gʁɑ̃', gloss: 'big (silent "d")' },
      { word: 'vous', ipa: 'vu', gloss: 'you (silent "s")' },
      { word: 'chaud', ipa: 'ʃo', gloss: 'hot (silent "d")' },
      { word: 'beaucoup', ipa: 'boku', gloss: 'a lot (silent "p")' },
    ],
  },
  {
    id: 'liaison-basics',
    kind: 'pattern',
    target: 'z',
    title: 'Liaison: when the silent letter wakes up',
    why: 'A silent final consonant comes back to life before a vowel, and joins the next word. This is why spoken French sounds like one long stream.',
    durationSec: 60,
    items: [
      { word: 'les amis', ipa: 'le.za.mi', gloss: 'the friends ("s" turns into "z")' },
      { word: 'vous avez', ipa: 'vu.za.ve', gloss: 'you have ("s" turns into "z")' },
      { word: 'un enfant', ipa: 'œ̃.nɑ̃.fɑ̃', gloss: 'a child (the "n" links across)' },
      { word: 'deux heures', ipa: 'dø.zœʁ', gloss: 'two o’clock ("x" turns into "z")' },
      { word: "c'est un", ipa: 'sɛ.tœ̃', gloss: 'it is a (the "t" links across)' },
    ],
  },
] as const;

const BY_ID = new Map(DRILLS.map((d) => [d.id, d]));

export function getDrill(id: string): Drill | undefined {
  return BY_ID.get(id);
}

/**
 * Every drill that repairs a given phoneme, best first.
 *
 * Minimal-pair drills outrank articulation drills because a learner who can hear
 * the contrast fixes the sound far faster than one repeating an isolated word.
 */
export function drillsFor(ipa: string): Drill[] {
  const rank: Record<DrillKind, number> = { 'minimal-pair': 0, articulation: 1, pattern: 2 };
  return DRILLS.filter((d) => d.target === ipa).sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * Pick the single drill to show for a phoneme the learner is failing.
 *
 * If we know which sound they substituted, prefer the drill that contrasts
 * exactly those two — it addresses the mistake they actually made rather than
 * the sound in the abstract.
 */
export function bestDrillFor(phoneme: Phoneme, substituted?: string): Drill | undefined {
  const candidates = drillsFor(phoneme.ipa);
  if (substituted) {
    const exact = candidates.find((d) => d.contrast === substituted);
    if (exact) return exact;
  }
  return candidates[0];
}
