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
 * **Version 2 adds the drills.** Generated practice arrives last of all and used
 * to have no cover at all — ConvoScreen merged it straight into the in-memory
 * bank, so an app closed in that beat lost the whole batch, silently, with the
 * learner having no way to know a batch had ever existed. It now rides in the
 * same envelope as the phrases and is banked by the same once-per-launch pass.
 * A version 1 journal left by the previous build is still read: it simply has no
 * drills, which is the truth about it rather than a shape to reject.
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

import type { ConvoPhrase, DrillExercise, IncomingTopic, RecapPayload } from '@parle/core';

export const JOURNAL_VERSION = 2;

/**
 * Every envelope version this build can still bank.
 *
 * Repair forward, never reinterpret in place: a v1 journal is read as itself and
 * the fields it never had come back empty. Dropping v1 would mean the one
 * learner whose app died mid-session on the day they updated loses that session
 * to the upgrade, which is the exact failure this file exists to prevent.
 */
const READABLE_VERSIONS: readonly number[] = [1, JOURNAL_VERSION];

export interface SessionJournal {
  version: typeof JOURNAL_VERSION;
  /** When the recap landed. Kept for debugging, never shown to a learner. */
  savedAt: number;
  phrases: ConvoPhrase[];
  topics: { fr: string; en: string }[];
  /**
   * The batch the tutor authored from this conversation.
   *
   * Bounded by `mergeExerciseBank`'s own cap on the way in, so a learner who
   * talks for an hour cannot grow this envelope without limit.
   */
  drills: DrillExercise[];
}

/**
 * The smallest thing worth keeping from a recap.
 *
 * Not the whole payload: the headline, the wins and the CEFR estimate are for
 * the card the learner is looking at right now, and re-showing them a day later
 * would be strange. Phrases, topics and drills are what become practice.
 */
export function journalFor(recap: RecapPayload, savedAt: number): SessionJournal {
  return {
    version: JOURNAL_VERSION,
    savedAt,
    phrases: recap.phrases.filter((phrase) => phrase.fr.trim() !== ''),
    topics: recap.topics,
    drills: [],
  };
}

/**
 * The envelope a batch of drills belongs in.
 *
 * Drills land after the recap, so `existing` is normally the journal that recap
 * wrote. When it is null the recap either never arrived or had nothing worth
 * keeping, and the drills still deserve cover: they get an envelope of their
 * own with no phrases in it.
 */
export function journalWithDrills(
  existing: SessionJournal | null,
  drills: readonly DrillExercise[],
  savedAt: number,
): SessionJournal {
  const base: SessionJournal = existing ?? {
    version: JOURNAL_VERSION,
    savedAt,
    phrases: [],
    topics: [],
    drills: [],
  };
  return { ...base, version: JOURNAL_VERSION, drills: [...drills] };
}

/** Whether there is anything in it worth a write, or a recovery. */
export function isWorthKeeping(journal: SessionJournal): boolean {
  return journal.phrases.length > 0 || journal.drills.length > 0;
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
 * Identity is all a journalled drill has to carry.
 *
 * `mergeExerciseBank` folds on `phraseKey`, `kind` and `id`; the deeper shape
 * belongs to core's `DrillExercise` union. Checking those three keeps a corrupt
 * blob out of the bank without this file growing a second copy of that schema.
 */
const isDrill = (value: unknown): value is DrillExercise => {
  if (typeof value !== 'object' || value === null) return false;
  const drill = value as Record<string, unknown>;
  return typeof drill.id === 'string' && typeof drill.phraseKey === 'string' && typeof drill.kind === 'string';
};

/**
 * What to do with whatever was found on disk at launch.
 *
 * Null means nothing to do, and it is the answer for every ordinary launch:
 * no journal, a journal from a version this build does not understand, or a
 * journal with nothing bankable left in it. A corrupt blob is also null rather
 * than a crash, on the same reasoning as topics/store.ts — the deck underneath
 * lost nothing, and the alternative is an app that will not open.
 */
export function recoveryPlan(
  raw: unknown,
): { phrases: ConvoPhrase[]; topics: IncomingTopic[]; drills: DrillExercise[] } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SessionJournal>;
  if (typeof candidate.version !== 'number' || !READABLE_VERSIONS.includes(candidate.version)) return null;

  const phrases = Array.isArray(candidate.phrases)
    ? candidate.phrases.filter(isPhrase).filter((phrase) => phrase.fr.trim() !== '')
    : [];
  const drills = Array.isArray(candidate.drills) ? candidate.drills.filter(isDrill) : [];
  if (phrases.length === 0 && drills.length === 0) return null;

  const topicList = Array.isArray(candidate.topics) ? candidate.topics.filter(isTopic) : [];
  const phraseKeys = phrases.map((phrase) => `phrase:${phrase.fr.trim().toLowerCase()}`);

  // Every recovered phrase goes under the session's first topic, which is the
  // scene itself. That is the same shape the leave-early fallback already banks,
  // so a recovered session and an early exit produce the same practice rather
  // than two subtly different ones.
  const home = topicList[0];
  return {
    phrases,
    // A topic with no phrases under it is a heading pointing at nothing, so a
    // drills-only recovery carries no topic at all.
    topics: home === undefined || phraseKeys.length === 0 ? [] : [{ title: home, phraseKeys }],
    drills,
  };
}
