/**
 * A focus drill, laid out as the sequence a learner is walked through.
 *
 * The end card names exactly one sound and attaches exactly one drill to it,
 * which is the product's headline promise. Until now the button under it did
 * nothing, so the promise ended at the naming. Turning a drill into something
 * playable is a sequencing decision — which words, in what order, paired with
 * what — and that belongs here in core rather than in a screen, for the same
 * reason every other rule does: a rule inside a component is a rule no test can
 * reach.
 *
 * A minimal pair yields two steps rather than one. The pair is the teaching
 * device, but the learner says one word at a time, and each word carries the
 * other alongside it so the contrast is visible while it is being said. That is
 * the whole pedagogy of the drill bank restated at the level of a single beat:
 * "you just said 'roue' when you meant 'rue'" only lands if both words are on
 * screen together.
 */

import type { Drill, DrillWord } from './drills.ts';

export interface FocusStep {
  /** The French word to say and hear. */
  word: string;
  ipa: string;
  gloss: string;
  /** The word this one is being told apart from, when there is one. */
  contrast: { word: string; gloss: string } | null;
}

const stepFrom = (word: DrillWord, contrast: DrillWord | null): FocusStep => ({
  word: word.word,
  ipa: word.ipa,
  gloss: word.gloss,
  contrast: contrast === null ? null : { word: contrast.word, gloss: contrast.gloss },
});

/**
 * Pairs first, then the standalone items.
 *
 * Order is not incidental: a pair teaches the contrast that makes the sound
 * matter, and an articulation item drills the sound on its own. Meeting the
 * reason before the exercise is the same order the drill bank's own `why` line
 * assumes.
 *
 * An empty result is a real answer, not a failure. A drill with neither pairs
 * nor items has nothing to play, and the card must offer nothing rather than
 * open an empty screen.
 */
export function focusDrillSteps(drill: Drill): FocusStep[] {
  const fromPairs = (drill.pairs ?? []).flatMap((pair) => [stepFrom(pair.a, pair.b), stepFrom(pair.b, pair.a)]);
  const fromItems = (drill.items ?? []).map((item) => stepFrom(item, null));
  return [...fromPairs, ...fromItems];
}
