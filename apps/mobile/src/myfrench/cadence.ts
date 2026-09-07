/**
 * Sounding French, rather than being correct in French.
 *
 * The founder's mockup called this Native Cadence Builders, and the instinct
 * behind it is the sharpest thing in the whole design. A beginner's French
 * stops being a series of answers and becomes a conversation at the point where
 * they can join a thought, hedge one, or take a second without going silent.
 * That is not grammar and no exercise teaches it; it is a handful of words, and
 * a French ear hears them before it hears anything else.
 *
 * ## Authored, then earned
 *
 * The list is authored, so the section exists on a learner's first morning
 * instead of waiting for them to produce it by accident. What is NOT authored
 * is the mark: a connector reads as theirs only once the deck says they used it
 * unprompted in a real conversation, which is `isRetained` and the same
 * predicate Home and the ledger already read. So the panel starts as an offer
 * and turns, one word at a time, into a record.
 *
 * ## The count the mockup wanted, and why it is a sentence instead
 *
 * The mockup said "Spoken 14x naturally in sessions". The number is real -
 * `convoUses` counts exactly that - and it still may not be drawn. Digits are
 * banned from learner copy across this app and the tab's own suite enforces it,
 * for the reason PRODUCT.md gives: a count invites a target, and a target you
 * are under is a quota. "You have said this one yourself" makes the same claim
 * and cannot be fallen short of.
 */

import { connectorWords, phraseKeyOf, type DailyWord, type ReviewCard } from '@luvani/core';

import { isRetained } from '../progress/momentum.ts';

export const CADENCE = {
  label: 'Native cadence',
  title: 'Words that buy you a moment',
  blurb: 'These keep the rhythm going while you think. A French ear notices them before it notices grammar.',
  /** Said of a connector the learner has produced unprompted. Never a count. */
  yours: 'You have said this one yourself.',
} as const;

export interface CadenceWord {
  id: string;
  fr: string;
  en: string;
  /** One short sentence on how it is actually used, as authored. */
  note: string;
  exampleFr: string;
  exampleEn: string;
  /** True once the learner has used it unprompted in a real conversation. */
  yours: boolean;
}

export interface Cadence {
  words: readonly CadenceWord[];
  /** How many are theirs, for a caller that wants to lead with the earned ones. */
  earned: number;
}

function asWord(word: DailyWord, yours: boolean): CadenceWord {
  return { id: word.id, fr: word.fr, en: word.en, note: word.note, exampleFr: word.exampleFr, exampleEn: word.exampleEn, yours };
}

/**
 * The authored connectors, with the learner's own marked and lifted.
 *
 * Theirs first, then the rest in the order they were authored. A learner who
 * has earned three should meet those three at the top rather than hunting for
 * them, and the order below that is the one a learner meets them in.
 */
export function cadenceFrom(input: { deck: readonly ReviewCard[] }): Cadence {
  const mine = new Set(input.deck.filter(isRetained).map((card) => phraseKeyOf(card.front)));
  const words = connectorWords().map((word) => asWord(word, mine.has(phraseKeyOf(word.fr))));
  const earned = words.filter((word) => word.yours).length;
  return {
    words: [...words.filter((word) => word.yours), ...words.filter((word) => !word.yours)],
    earned,
  };
}
