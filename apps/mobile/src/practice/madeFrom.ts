/**
 * Practice, made from the learner's own conversations (F554, F557, F558).
 *
 * Three cards above the archive, each from the newest ready pack: the moment
 * worth replaying, which is the pack's first correction said honestly as what
 * they said and a better way; the phrase worth making theirs; and the sound
 * to tune, which is the newest sound check rather than anything the pack
 * carries, because nothing writes the pack's own field.
 *
 * ## Say it, only where a sitting would have something in it
 *
 * `buildDrillSession` scoped to one phrase plays the card when it is due and
 * offers new material only for a phrase the deck has never met. A phrase that
 * is in the bank and not yet due queues nothing, and the sitting ends the
 * moment it opens, which is the defect `PracticeTab.test.ts` was written
 * against. So the phrase card offers Say it only for a phrase the deck does
 * not know or wants back, and hear otherwise.
 *
 * Null means there is no ready pack, and the tab draws the starter set
 * instead. Nothing here is a count, and nothing is stored.
 */

import { drillsFor, focusDrillSteps, isDue, phraseKeyOf, type ConversationPack, type FocusStep, type ReviewCard } from '@luvani/core';

import { latestReadyPack } from '../conversationPacks/model.ts';
import { withMarks, type PackMark } from '../conversationPacks/marks.ts';
import { repairKeyOf } from '../conversationPacks/packExercises.ts';
import { soundFocus } from '../conversationPacks/closure.ts';
import type { Acoustic } from '../myfrench/acoustic.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';

export const MADE_FROM = {
  replay: {
    label: 'Replay a moment',
    gloss: 'Listen and try again',
    /** What the row's tap does before it opens anything: the better line, spoken. */
    listen: 'Hear the better line',
    said: 'What you said',
    better: 'A better way',
    action: 'Try it again',
  },
  phrase: {
    label: 'Make this phrase yours',
    gloss: 'Say it in your own words',
    saved: 'In your phrase bank',
    save: 'Keep this phrase',
    say: 'Say it',
    hear: 'Hear it',
  },
  sound: {
    label: 'Tune one sound',
    gloss: 'Focus on a tricky sound',
    check: 'Check this sound',
    none: 'After your next situation, a short sound check names one sound to tune.',
    go: 'Choose a situation',
  },
} as const;

/** Every line this module can say, for the copy sweeps. */
export const MADE_FROM_COPY: readonly string[] = [
  ...Object.values(MADE_FROM.replay),
  ...Object.values(MADE_FROM.phrase),
  ...Object.values(MADE_FROM.sound),
];

export interface Replay {
  packId: string;
  /** The conversation it came from, in the learner's language. */
  from: string;
  quote: string;
  better: string;
  betterEn: string;
  why: string;
  /** The better line's deck key, which is what the drill opens on. */
  key: string;
}

export interface PhraseToOwn {
  packId: string;
  from: string;
  fr: string;
  en: string;
  key: string;
  /** A card for it exists in the deck. */
  saved: boolean;
  /** A sitting scoped to it would have something in it. */
  sayable: boolean;
}

export interface SoundToTune {
  acoustic: Acoustic;
  missionId: string;
  steps: readonly FocusStep[];
}

export interface MadeFrom {
  replay: Replay | null;
  phrase: PhraseToOwn | null;
  sound: SoundToTune | null;
}

/** The newest sound check, with the steps to work it, or null. Read by the starter too. */
export function soundToTune(checks: readonly SoundCheckEvidence[]): SoundToTune | null {
  const focus = soundFocus(checks);
  if (focus === null) return null;
  const drill = drillsFor(focus.ipa)[0];
  return { acoustic: focus.acoustic, missionId: focus.missionId, steps: drill === undefined ? [] : focusDrillSteps(drill) };
}

function replayOf(pack: ConversationPack): Replay | null {
  const repair = pack.corrections[0];
  const key = repairKeyOf(pack);
  if (repair === undefined || key === null) return null;
  return { packId: pack.id, from: pack.title.en, quote: repair.quote, better: repair.better, betterEn: repair.betterEn, why: repair.why, key };
}

function phraseOf(pack: ConversationPack, deck: readonly ReviewCard[], now: number): PhraseToOwn | null {
  const candidates = pack.keyPhrases.map((phrase) => ({ ...phrase, key: phraseKeyOf(phrase.fr) }));
  if (candidates.length === 0) return null;
  const cardFor = (key: string) => deck.find((card) => card.id === key);
  // The first phrase the deck does not hold yet, else the first one it wants
  // back, else the first: the slot is worth more on a phrase not yet theirs.
  const chosen =
    candidates.find((phrase) => cardFor(phrase.key) === undefined) ??
    candidates.find((phrase) => {
      const card = cardFor(phrase.key);
      return card !== undefined && isDue(card, now);
    }) ??
    candidates[0]!;
  const card = cardFor(chosen.key);
  return {
    packId: pack.id,
    from: pack.title.en,
    fr: chosen.fr,
    en: chosen.en,
    key: chosen.key,
    saved: card !== undefined,
    sayable: card === undefined || isDue(card, now),
  };
}

export function madeFromConversations(input: {
  packs: readonly ConversationPack[];
  marks: readonly PackMark[];
  deck: readonly ReviewCard[];
  checks: readonly SoundCheckEvidence[];
  now: number;
}): MadeFrom | null {
  const pack = latestReadyPack(withMarks(input.packs, input.marks));
  if (pack === null) return null;
  return {
    replay: replayOf(pack),
    phrase: phraseOf(pack, input.deck, input.now),
    sound: soundToTune(input.checks),
  };
}
