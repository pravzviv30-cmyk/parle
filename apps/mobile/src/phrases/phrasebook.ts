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

import { isDue, isSettled, phraseKeyOf, type PracticeTopic, type ReviewCard } from '@luvani/core';

/** How settled a phrase is. The same three words the practice path uses. */
export type Hold = 'steady' | 'coming-back' | 'new';

export interface Phrase {
  /** The deck card's id, so a caller can find its way back. */
  id: string;
  /** The French, exactly as the learner said it. */
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

export interface Phrasebook {
  groups: PhraseGroup[];
  /** How many phrases in total. A count, never a ratio. */
  count: number;
  /** How many conversations are represented. */
  topics: number;
}

/** Where anything the learner met in a lesson rather than a conversation goes. */
export const LESSONS_GROUP = 'lessons';
const LESSONS_TITLE = 'From your lessons';

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
): Phrasebook {
  const said = cards.filter((c) => c.kind !== 'phoneme' && c.reps > 0);

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

  const byGroup = new Map<string, Phrase[]>();
  for (const card of said) {
    const group = claimed.get(phraseKeyOf(card.front)) ?? LESSONS_GROUP;
    const phrase: Phrase = {
      id: card.id,
      front: card.front,
      back: card.back,
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
  const lessons = byGroup.get(LESSONS_GROUP);
  if (lessons && lessons.length > 0) {
    groups.push({ id: LESSONS_GROUP, title: LESSONS_TITLE, phrases: lessons });
  }

  return {
    groups,
    count: said.length,
    topics: groups.filter((g) => g.id !== LESSONS_GROUP).length,
  };
}

/** Home shows the card only when there is something behind it. */
export function hasPhrases(book: Phrasebook): boolean {
  return book.count > 0;
}
