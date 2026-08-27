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
 * **Version 3 adds a name for the batch and the conversation counts.** The name
 * is `batchId`, and it is honest about being small: it is what lets the clear at
 * the end of banking delete the batch that was banked rather than whatever
 * happens to be under the key by then. It is NOT what makes banking safe to
 * repeat — that is content identity, decided by `mergeCards`, `mergeTopics` and
 * `mergeExerciseBank`, each of which folds on the id a phrase or drill already
 * has. `convoUses` is the other half of what a conversation earned: the brain
 * counts a phrase every time the learner uses it correctly without being asked,
 * and until version 3 that count reached the profile and never reached the deck,
 * so the review card for a phrase someone had genuinely started using looked
 * exactly like the card for one they had read once. Version 1 and version 2
 * envelopes are still read and simply carry neither.
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

import { phraseKeyOf, type ConvoPhrase, type DrillExercise, type IncomingTopic, type RecapPayload } from '@parle/core';
import { MAX_PHRASES, repairProfile } from '@parle/brain/profile';

// The store folds these counts into the deck, so the shape is defined where the
// fold lives. A type-only import: nothing in this file touches a disk, which is
// what keeps every rule here checkable without a device.
import type { PhraseUse } from '../review/store.ts';

export const JOURNAL_VERSION = 3;

/**
 * Every envelope version this build can still bank.
 *
 * Repair forward, never reinterpret in place: a v1 journal is read as itself and
 * the fields it never had come back empty. Dropping v1 would mean the one
 * learner whose app died mid-session on the day they updated loses that session
 * to the upgrade, which is the exact failure this file exists to prevent. The
 * same now goes for v2, which is on every phone running the build before this
 * one.
 */
const READABLE_VERSIONS: readonly number[] = [1, 2, JOURNAL_VERSION];

export interface SessionJournal {
  version: typeof JOURNAL_VERSION;
  /** When the recap landed. Kept for debugging, never shown to a learner. */
  savedAt: number;
  /**
   * This batch's name, minted when the recap is journalled.
   *
   * `savedAt` plus a random suffix — no dependency, and no claim to be a UUID.
   * Its one job is the clear at the end of banking: delete the batch that was
   * banked, never whatever is under the key by the time the acknowledgements
   * come back. Banking twice is made safe by content identity, not by this.
   */
  batchId: string;
  phrases: ConvoPhrase[];
  topics: { fr: string; en: string }[];
  /**
   * The batch the tutor authored from this conversation.
   *
   * Bounded by `mergeExerciseBank`'s own cap on the way in, so a learner who
   * talks for an hour cannot grow this envelope without limit.
   */
  drills: DrillExercise[];
  /**
   * Lifetime counts of correct unprompted use, read off the recap's learner
   * model. Totals rather than deltas, and bounded by `MAX_PHRASES`, which is
   * the cap the model itself keeps.
   */
  convoUses: PhraseUse[];
}

/**
 * A name for this batch. `savedAt` first so it sorts, a random tail so two
 * sessions saved in the same millisecond are still two batches.
 */
function mintBatchId(savedAt: number): string {
  return `b${savedAt.toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * What the learner used well in conversation, off the profile blob the recap
 * arrived with.
 *
 * Through `repairProfile`, because that is the single forward-migration point
 * for a learner model and this blob came off the wire from a build that may not
 * be this one. Anything it cannot make sense of comes back as an empty list
 * rather than a throw: a fold that is skipped loses nothing that was ever on
 * disk, while a recap that crashed on the way to the journal loses the session.
 *
 * Only counts above zero are carried. A zero raises nothing on the way in, so
 * keeping it would be envelope weight with no effect. If the model somehow
 * holds more phrases than its own cap, the smallest counts are the ones
 * dropped: a phrase used once has the least to lose.
 */
export function convoUsesFrom(profile: unknown): PhraseUse[] {
  try {
    const used = Object.values(repairProfile(profile).phrases)
      .filter((phrase) => typeof phrase.timesUsedWell === 'number' && phrase.timesUsedWell > 0)
      .map((phrase) => ({ fr: phrase.fr, uses: Math.floor(phrase.timesUsedWell) }))
      .filter((use) => typeof use.fr === 'string' && use.fr.trim() !== '');
    if (used.length <= MAX_PHRASES) return used;
    return [...used].sort((a, b) => b.uses - a.uses).slice(0, MAX_PHRASES);
  } catch {
    return [];
  }
}

/**
 * The smallest thing worth keeping from a recap.
 *
 * Not the whole payload: the headline, the wins and the CEFR estimate are for
 * the card the learner is looking at right now, and re-showing them a day later
 * would be strange. Phrases, topics and drills are what become practice.
 */
export function journalFor(recap: RecapPayload, savedAt: number, profile: unknown = null): SessionJournal {
  return {
    version: JOURNAL_VERSION,
    savedAt,
    batchId: mintBatchId(savedAt),
    phrases: recap.phrases.filter((phrase) => phrase.fr.trim() !== ''),
    topics: recap.topics,
    drills: [],
    convoUses: convoUsesFrom(profile),
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
    batchId: mintBatchId(savedAt),
    phrases: [],
    topics: [],
    drills: [],
    convoUses: [],
  };
  // `existing` came off a disk an older build may have written, so the two
  // fields version 3 added are repaired forward here rather than assumed. A
  // batch with no name would be cleared by anything; an unreadable count list
  // reads as no counts.
  return {
    ...base,
    version: JOURNAL_VERSION,
    batchId: typeof base.batchId === 'string' && base.batchId !== '' ? base.batchId : mintBatchId(savedAt),
    convoUses: Array.isArray(base.convoUses) ? base.convoUses : [],
    drills: [...drills],
  };
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

/** A count is a French line and a number, and nothing off a disk is trusted to be. */
const isUse = (value: unknown): value is PhraseUse =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PhraseUse).fr === 'string' &&
  typeof (value as PhraseUse).uses === 'number' &&
  Number.isFinite((value as PhraseUse).uses);

/**
 * Everything one conversation asks the practice stores to keep.
 *
 * The shape `bankPractice` takes, and deliberately the shape a recovered
 * journal produces, so a session banked on the way out of the room and a
 * session banked at the next launch travel the identical path. Two paths would
 * be two sets of bugs.
 */
export interface PracticeBatch {
  /**
   * The journal entry this batch came out of, or null for a batch banked
   * straight from a live session and for an envelope written before v3. Only
   * the clear reads it, and only to avoid deleting a batch it did not bank.
   */
  batchId: string | null;
  phrases: ConvoPhrase[];
  topics: IncomingTopic[];
  drills: DrillExercise[];
  convoUses: PhraseUse[];
}

/**
 * What to do with whatever was found on disk at launch.
 *
 * Null means nothing to do, and it is the answer for every ordinary launch:
 * no journal, a journal from a version this build does not understand, or a
 * journal with nothing bankable left in it. A corrupt blob is also null rather
 * than a crash, on the same reasoning as topics/store.ts — the deck underneath
 * lost nothing, and the alternative is an app that will not open.
 */
export function recoveryPlan(raw: unknown): PracticeBatch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SessionJournal>;
  if (typeof candidate.version !== 'number' || !READABLE_VERSIONS.includes(candidate.version)) return null;

  const phrases = Array.isArray(candidate.phrases)
    ? candidate.phrases.filter(isPhrase).filter((phrase) => phrase.fr.trim() !== '')
    : [];
  const drills = Array.isArray(candidate.drills) ? candidate.drills.filter(isDrill) : [];
  // Counts alone are not a session. They raise evidence on cards that are
  // already in the deck, and a journal holding nothing else has nothing to bank.
  if (phrases.length === 0 && drills.length === 0) return null;

  const topicList = Array.isArray(candidate.topics) ? candidate.topics.filter(isTopic) : [];
  const phraseKeys = phrases.map((phrase) => phraseKeyOf(phrase.fr));

  // Every recovered phrase goes under the session's first topic, which is the
  // scene itself. That is the same shape the leave-early fallback already banks,
  // so a recovered session and an early exit produce the same practice rather
  // than two subtly different ones.
  const home = topicList[0];
  return {
    // An envelope from before v3 has no name, and says so rather than being
    // given one now: a name minted at recovery would claim to identify a batch
    // it was not there for.
    batchId: typeof candidate.batchId === 'string' && candidate.batchId !== '' ? candidate.batchId : null,
    phrases,
    // A topic with no phrases under it is a heading pointing at nothing, so a
    // drills-only recovery carries no topic at all.
    topics: home === undefined || phraseKeys.length === 0 ? [] : [{ title: home, phraseKeys }],
    drills,
    convoUses: Array.isArray(candidate.convoUses) ? candidate.convoUses.filter(isUse) : [],
  };
}
