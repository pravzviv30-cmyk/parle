/**
 * Practice topics — what a conversation leaves behind, as objects.
 *
 * A topic is a title, the dates it was talked about, and the review-deck ids
 * of the phrases it carries. Nothing else on purpose: strength is a PROJECTION
 * of the review deck (exactly like path node state), so a topic card can never
 * say "learned" about phrases the scheduler is calling due. The store that
 * persists these lives in the app; every rule about them lives here, pure and
 * testable.
 */

import type { ReviewCard } from '../review/scheduler.ts';

export interface PracticeTopic {
  /** 'topic:' + slug of the English title — merge identity across sessions. */
  id: string;
  title: { fr: string; en: string };
  /** ISO dates of the sessions that touched it, oldest first, capped. */
  discussed: string[];
  /** Review-deck card ids ('phrase:…') this topic drills. */
  phraseKeys: string[];
}

/** A topic remembers this many sittings; older ones age out silently. */
export const MAX_DISCUSSED_DATES = 10;
/** Enough variety for Practice without turning one screen into an archive. */
export const MAX_STORED_TOPICS = 24;

/**
 * Merge identity. Case- and accent-insensitive on the English title, so the
 * curator writing "Ordering at the café" one week and "ordering at the cafe"
 * the next lands on one card, not two.
 */
export function topicId(titleEn: string): string {
  const slug = titleEn
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `topic:${slug}`;
}

/**
 * The deck id a spoken phrase lands under. ONE rule, stated here, because two
 * copies of it is how a topic ends up pointing at cards that do not exist:
 * the review store banks under exactly this key.
 */
export function phraseKeyOf(fr: string): string {
  return `phrase:${fr.trim().toLowerCase()}`;
}

export interface IncomingTopic {
  title: { fr: string; en: string };
  phraseKeys: readonly string[];
}

/**
 * Fold one session's curated topics into the stored list.
 *
 * Merge, never replace: a returning topic keeps its place and its history,
 * gains any new phrases (deduped, order kept), and records the sitting once.
 * New topics append at the end, so the path reads oldest first, the way the
 * learner's own story does.
 */
export function mergeTopics(
  existing: readonly PracticeTopic[],
  incoming: readonly IncomingTopic[],
  discussedOn: string,
): PracticeTopic[] {
  const merged = existing.map((topic) => ({ ...topic, discussed: [...topic.discussed], phraseKeys: [...topic.phraseKeys] }));
  for (const arrival of incoming) {
    const id = topicId(arrival.title.en);
    if (id === 'topic:') continue; // an empty title is not a card
    const known = merged.find((t) => t.id === id);
    if (known === undefined) {
      merged.push({
        id,
        title: { fr: arrival.title.fr, en: arrival.title.en },
        discussed: [discussedOn],
        phraseKeys: [...new Set(arrival.phraseKeys)],
      });
      continue;
    }
    for (const key of arrival.phraseKeys) {
      if (!known.phraseKeys.includes(key)) known.phraseKeys.push(key);
    }
    // One sitting, recorded once — a session that produces the same topic
    // twice (it cannot, but stores outlive invariants) still counts one date.
    if (known.discussed.at(-1) !== discussedOn) {
      known.discussed.push(discussedOn);
      if (known.discussed.length > MAX_DISCUSSED_DATES) {
        known.discussed.splice(0, known.discussed.length - MAX_DISCUSSED_DATES);
      }
    }
  }
  return merged.slice(-MAX_STORED_TOPICS);
}

/** One day, the unit the stagger below deals in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many of a session's new cards are due immediately. */
export const STAGGER_DUE_NOW = 3;

/**
 * Space a session's new cards so tomorrow is not a wall.
 *
 * A conversation used to drop every card due-at-once; five phrases at once is
 * still a pile. The first few stay due now (the learner is warm), the rest
 * wait a day. Pure over the incoming batch only — cards already in the deck
 * keep their scheduling untouched by the merge that follows.
 */
export function staggerNewCards(cards: readonly ReviewCard[], now: number): ReviewCard[] {
  return cards.map((card, index) => (index < STAGGER_DUE_NOW ? card : { ...card, due: now + DAY_MS }));
}
