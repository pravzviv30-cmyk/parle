/**
 * What the learner can say now.
 *
 * PRODUCT.md promises "visible evidence they are improving", and there is a
 * gap between that promise and what Home actually shows. Session history is
 * written from exactly one place, the end of a guided lesson, so every free
 * conversation a learner has ever had is invisible to `buildProgressReport`.
 * Someone who only ever talks to the tutor sees the level card and then
 * nothing at all, forever.
 *
 * The fix is not to write history from the conversation screen, which already
 * records XP and would double-count it. It is to read the thing that DOES know
 * what a conversation produced: the review deck, grouped by the topics the
 * tutor curated out of it.
 *
 * ## A projection, never a store
 *
 * Nothing here is saved. This is the same discipline `path.ts` states in its
 * own header ("node state is a projection of the review deck, never stored")
 * and `topics.ts` follows for strength. A second copy of a derived value is a
 * second source of truth, and this repo has one rule about that.
 *
 * ## No percentage, and that is deliberate
 *
 * The app that prompted this shows "22% words learnt, 116 words in stack". It
 * can, because it ships a fixed list. Luvani's deck grows from whatever the
 * learner actually said, so there is no denominator, and inventing one would
 * be the same species of error as inventing a pronunciation score. Counts are
 * honest. A ratio would not be.
 */

import { reviewPhraseFor, isDue, isSettled, phraseKeyOf, type PracticeTopic, type ReviewCard } from '@luvani/core';

/** How settled a phrase is. The same three words the practice path uses. */
export type Hold = 'steady' | 'coming-back' | 'new';

export interface Phrase {
  /** The deck card's id, so a caller can find its way back. */
  id: string;
  /** The card's French phrase, from a conversation or authored lesson. */
  front: string;
  /** What it means. */
  back: string;
  hold: Hold;
}

export interface PhraseGroup {
  /** A topic id, or `lessons` for anything the path taught rather than a talk. */
  id: string;
  title: string;
  phrases: Phrase[];
}

/**
 * A phrase in the deck the learner has not yet recalled. No `hold`: a shelf is
 * a claim about how well a phrase is held, and nothing is held yet.
 */
export interface SavedPhrase {
  id: string;
  front: string;
  back: string;
  /** Known situation only; never inferred from the phrase's words. */
  source?: string;
}

export interface Phrasebook {
  /** Recalled phrases only, grouped by source. Saved-only phrases are never here. */
  groups: PhraseGroup[];
  /** How many recalled phrases in total. A count, never a ratio. Saved-only phrases are not in it. */
  count: number;
  /** How many conversations are represented. */
  topics: number;
  /**
   * Phrases in the deck that have never been recalled, newest saved first.
   * Kept apart from `groups` and `count` so a saved phrase is visible without
   * being counted as one the learner can say.
   */
  saved: SavedPhrase[];
}

/**
 * The saved-but-not-recalled list's heading and its one line. Honest about
 * what the list is: saved, not yet recalled, and how a phrase leaves it.
 * "Recalled" rather than "practised", because a card can have been tried and
 * missed (lapses without a success) and still be here.
 */
export const SAVED_TITLE = 'Saved, not recalled yet';
export const SAVED_NOTE = 'Each one joins your phrases once you recall it.';

/**
 * Where a phrase goes when neither a conversation topic nor a saved
 * conversation claims it. The id is kept for continuity; the title is neutral
 * because the source is not known, and "lessons" was a claim, not a fact:
 * saved-conversation phrases landed here with no topic and read as lessons.
 */
export const LESSONS_GROUP = 'lessons';
export const OTHER_PHRASES_TITLE = 'Other phrases';

/** The one thing the phrasebook needs to know about a saved conversation. */
export interface PhraseSourcePack {
  id: string;
  title: { en: string };
  keyPhrases: readonly { fr: string }[];
}

/**
 * Which shelf a phrase is on, asked of core rather than decided here.
 *
 * This file used to keep its own `STEADY_REPS = 2` and `STEADY_DAYS = 7`
 * beside the same arithmetic, which made it one of the four places that had an
 * opinion about whether a learner knew a phrase. `isDue` and `isSettled` are
 * the only copies of that rule now, so the shelf and the deck cannot drift
 * apart the way they were free to before.
 *
 * The three words the learner reads are unchanged, and so is the order of the
 * questions: due beats settled, because a phrase the scheduler is asking for
 * again is not one to display as settled however long its interval grew.
 */
function holdFor(card: ReviewCard, now: number): Hold {
  if (isDue(card, now)) return 'coming-back';
  if (isSettled(card, now)) return 'steady';
  return 'new';
}

/**
 * The learner's own lines, grouped by where they came from.
 *
 * Only cards the learner has actually recalled at least once are here. A card
 * added an hour ago and never seen is not something they can say yet, and
 * counting it would make the number a promise rather than evidence.
 *
 * Phoneme cards are excluded outright: a sound is not a thing you can say.
 */
export function buildPhrasebook(
  cards: readonly ReviewCard[],
  topics: readonly PracticeTopic[],
  now: number,
  /**
   * Saved conversations, a second known source. A phrase no topic claims but a
   * saved conversation holds is grouped under that conversation's title,
   * after the topics, rather than under a label that is not true.
   */
  packs: readonly PhraseSourcePack[] = [],
): Phrasebook {
  const said = cards.filter((c) => c.kind !== 'phoneme' && c.reps > 0 && reviewPhraseFor(c) !== null);

  // One phrase key can appear in two topics. First lane wins, which is the
  // same rule `mix.ts` uses when it interleaves, so a phrase never shows twice.
  const claimed = new Map<string, string>();
  const titles = new Map<string, string>();
  for (const topic of topics) {
    titles.set(topic.id, topic.title.en);
    for (const key of topic.phraseKeys) {
      if (!claimed.has(key)) claimed.set(key, topic.id);
    }
  }
  const packGroup = (id: string) => `pack:${id}`;
  for (const pack of packs) {
    titles.set(packGroup(pack.id), pack.title.en);
    for (const phrase of pack.keyPhrases) {
      const key = phraseKeyOf(phrase.fr);
      if (!claimed.has(key)) claimed.set(key, packGroup(pack.id));
    }
  }

  const byGroup = new Map<string, Phrase[]>();
  for (const card of said) {
    const pair = reviewPhraseFor(card);
    if (!pair) continue;
    const group = claimed.get(phraseKeyOf(pair.fr)) ?? LESSONS_GROUP;
    const phrase: Phrase = {
      id: card.id,
      front: pair.fr,
      back: pair.en,
      hold: holdFor(card, now),
    };
    const list = byGroup.get(group);
    if (list) list.push(phrase);
    else byGroup.set(group, [phrase]);
  }

  // Topics first, in the order the tutor curated them, then the lessons group
  // last, because the learner's own conversations are the point of the screen.
  const groups: PhraseGroup[] = [];
  for (const topic of topics) {
    const phrases = byGroup.get(topic.id);
    if (phrases && phrases.length > 0) {
      groups.push({ id: topic.id, title: titles.get(topic.id) ?? topic.title.en, phrases });
    }
  }
  for (const pack of packs) {
    const id = packGroup(pack.id);
    const phrases = byGroup.get(id);
    if (phrases && phrases.length > 0 && !groups.some((g) => g.id === id)) {
      groups.push({ id, title: titles.get(id) ?? pack.title.en, phrases });
    }
  }
  const lessons = byGroup.get(LESSONS_GROUP);
  if (lessons && lessons.length > 0) {
    groups.push({ id: LESSONS_GROUP, title: OTHER_PHRASES_TITLE, phrases: lessons });
  }

  // Saved from a conversation (or anywhere) and never recalled. Shown apart,
  // newest first, and never folded into the groups or the count above.
  const saved: SavedPhrase[] = cards
    .filter((c) => c.kind !== 'phoneme' && c.reps === 0 && reviewPhraseFor(c) !== null)
    .slice()
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((c) => {
      const pair = reviewPhraseFor(c)!;
      const sourceId = claimed.get(phraseKeyOf(pair.fr));
      const source = sourceId ? titles.get(sourceId) : undefined;
      return { id: c.id, front: pair.fr, back: pair.en, ...(source ? { source } : {}) };
    });

  return {
    groups,
    count: said.length,
    topics: groups.filter((g) => g.id !== LESSONS_GROUP).length,
    saved,
  };
}

/** Home shows the card only when there is something behind it. */
export function hasPhrases(book: Phrasebook): boolean {
  return book.count > 0;
}

/** Whether there is a saved-but-not-recalled phrase to show apart. */
export function hasSaved(book: Phrasebook): boolean {
  return book.saved.length > 0;
}
