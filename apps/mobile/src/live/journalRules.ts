/**
 * What a finished conversation leaves on disk until it is safely banked.
 *
 * The order everything arrives in is what makes this necessary. The agent ships
 * the recap first, then curates practice, then authors drills, and ConvoScreen
 * banks when the practice message lands. There is a leave-early fallback for the
 * learner who taps Done before that, and it is a real one, but it only runs on a
 * tap: read the recap, swipe the app away, and the session's phrases are gone
 * even though they were sitting in memory the whole time.
 *
 * So the recap is written down the moment it arrives, and cleared the moment
 * banking succeeds. Anything still on disk at the next launch belongs to a
 * session that ended without being banked, and gets banked then.
 *
 * The rules are here rather than in the store for the reason live/thinking.ts
 * exists: apps/mobile has no renderer, so anything worth checking has to be
 * reachable without one. The store is a versioned envelope and a write chain,
 * and nothing else.
 *
 * What this does NOT recover, stated plainly because the alternative is a
 * promise it cannot keep: a session killed BEFORE the recap. The wire's
 * ConvoView carries no phrase list, so until the recap the app holds a
 * transcript and nothing more, and turning a transcript into review cards is
 * curation. Curation is the agent's decision. The app does not get to invent it.
 */

import type { ConvoPhrase, IncomingTopic, RecapPayload } from '@parle/core';

export const JOURNAL_VERSION = 1;

export interface SessionJournal {
  version: typeof JOURNAL_VERSION;
  /** When the recap landed. Kept for debugging, never shown to a learner. */
  savedAt: number;
  phrases: ConvoPhrase[];
  topics: { fr: string; en: string }[];
}

/**
 * The smallest thing worth keeping from a recap.
 *
 * Not the whole payload: the headline, the wins and the CEFR estimate are for
 * the card the learner is looking at right now, and re-showing them a day later
 * would be strange. Phrases and topics are the two things that become practice.
 */
export function journalFor(recap: RecapPayload, savedAt: number): SessionJournal {
  return {
    version: JOURNAL_VERSION,
    savedAt,
    phrases: recap.phrases.filter((phrase) => phrase.fr.trim() !== ''),
    topics: recap.topics,
  };
}

/** Whether there is anything in it worth a write, or a recovery. */
export function isWorthKeeping(journal: SessionJournal): boolean {
  return journal.phrases.length > 0;
}

const isPhrase = (value: unknown): value is ConvoPhrase =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ConvoPhrase).fr === 'string' &&
  typeof (value as ConvoPhrase).en === 'string';

const isTopic = (value: unknown): value is { fr: string; en: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { fr: unknown }).fr === 'string' &&
  typeof (value as { en: unknown }).en === 'string';

/**
 * What to do with whatever was found on disk at launch.
 *
 * Null means nothing to do, and it is the answer for every ordinary launch:
 * no journal, a journal from a version this build does not understand, or a
 * journal with nothing bankable left in it. A corrupt blob is also null rather
 * than a crash, on the same reasoning as topics/store.ts — the deck underneath
 * lost nothing, and the alternative is an app that will not open.
 */
export function recoveryPlan(raw: unknown): { phrases: ConvoPhrase[]; topics: IncomingTopic[] } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SessionJournal>;
  if (candidate.version !== JOURNAL_VERSION) return null;
  if (!Array.isArray(candidate.phrases)) return null;

  const phrases = candidate.phrases.filter(isPhrase).filter((phrase) => phrase.fr.trim() !== '');
  if (phrases.length === 0) return null;

  const topicList = Array.isArray(candidate.topics) ? candidate.topics.filter(isTopic) : [];
  const phraseKeys = phrases.map((phrase) => `phrase:${phrase.fr.trim().toLowerCase()}`);

  // Every recovered phrase goes under the session's first topic, which is the
  // scene itself. That is the same shape the leave-early fallback already banks,
  // so a recovered session and an early exit produce the same practice rather
  // than two subtly different ones.
  const home = topicList[0];
  return { phrases, topics: home === undefined ? [] : [{ title: home, phraseKeys }] };
}
