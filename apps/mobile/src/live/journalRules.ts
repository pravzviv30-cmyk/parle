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
 * **Version 4 adds the curated grouping and the unbanked lessons.** Until now
 * the only thing ever written down was what the recap said, which is everything
 * the conversation touched — a dozen phrases. Curation then edits that down to
 * a few and groups them, and none of that reached the disk, so a bank that
 * failed retried LARGER, differently-grouped content than the session had
 * decided on, and the tutor's authored extensions were recorded nowhere at all.
 * `curated` is that grouping, and its presence is also the flag: an envelope
 * that has one has been through the practice editor and is banked whole, while
 * an envelope that has none never was and is capped on the way out by
 * `MAX_RECOVERED_PHRASES`. `lessons` is the other half of the same idea for the
 * scripted product: a lesson deck the review store refused to write is kept
 * here and retried by the same once-per-launch pass, instead of vanishing the
 * way it used to. Versions 1 to 3 are still read and simply carry neither.
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

import {
  phraseKeyOf,
  type ConvoPhrase,
  type DrillExercise,
  type IncomingTopic,
  type RecapPayload,
  type SessionSummary,
} from '@parle/core';
import { MAX_PHRASES, repairProfile } from '@parle/brain/profile';

// The store folds these counts into the deck, so the shape is defined where the
// fold lives. A type-only import: nothing in this file touches a disk, which is
// what keeps every rule here checkable without a device.
import type { PhraseUse } from '../review/store.ts';

export const JOURNAL_VERSION = 4;

/**
 * The most phrases a journal that was never curated may bank.
 *
 * Curation's own cap, and deliberately the same number: `MAX_KEPT_PHRASES` in
 * packages/brain/src/curate/curate.ts. A recap holds everything the
 * conversation touched, so a learner who read the recap and swiped the app away
 * used to get a dozen cards at the next launch — the exact card flood curation
 * exists to prevent, delivered by crash. It is a cap and not a fix: seven
 * earned phrases are dropped on that path, which is curation's own position
 * about what a learner will genuinely revisit tomorrow.
 *
 * The number is written here rather than imported because reaching brain's
 * curate module from the phone would pull zod and the whole structured-output
 * schema into the bundle for one integer. `ConvoScreen`'s leave-early fallback
 * already keeps its own copy of the same five; this is the name it should use.
 */
export const MAX_RECOVERED_PHRASES = 5;

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
const READABLE_VERSIONS: readonly number[] = [1, 2, 3, JOURNAL_VERSION];

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
  /**
   * The practice editor's grouping, once it has run. Empty until then.
   *
   * Not decoration and not a duplicate of `topics`: `topics` is the list of
   * scenes the conversation passed through, while this is which phrase belongs
   * on which card, which is the decision curation exists to make. Recovery
   * banks the grouping verbatim when it is here, so a batch replayed at the
   * next launch lands on the same topic rows as the batch that was banked from
   * the room. Its presence is also what says this envelope is curated, and so
   * exempt from `MAX_RECOVERED_PHRASES`.
   */
  curated: IncomingTopic[];
  /**
   * Scripted lesson decks the review store could not write.
   *
   * A list, because a learner on a full phone can finish two lessons before
   * anything has room again, and losing the first to the second would be the
   * same silent drop this field exists to close. Stored as the summary rather
   * than as built cards: the cards carry timestamps, and rebuilding them at the
   * next launch produces a card due now, which is exactly what the write that
   * failed would have produced.
   */
  lessons: SessionSummary[];
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
    // Nothing has curated this yet, and saying so is the point: an uncurated
    // envelope is the one `recoveryPlan` caps.
    curated: [],
    lessons: [],
  };
}

/**
 * The envelope a recap belongs in, given whatever is already on the key.
 *
 * The recap arrives TWICE on an ordinary session — once plain, once enriched
 * with the learner model — and the second one races the practice message,
 * because the agent runs memory extraction and curation concurrently. So the
 * enriched recap can land on a key the practice editor has already written, and
 * it carries the same dozen phrases the first one did. Writing them back would
 * un-curate a batch that had been curated, on disk, seconds before banking.
 *
 * A curated envelope therefore keeps its phrases and its grouping, and takes
 * from the late recap only the thing it actually brought: the counts off the
 * enriched learner model, which is the entire reason there is a second recap.
 *
 * `batchId` is deliberately NOT carried across. From in here a second recap and
 * a whole new conversation look identical, and giving the next session the last
 * one's name is what lets an old bank delete a conversation nobody has banked.
 * The cost is one extra idempotent replay at the next launch, and the merges
 * make that free.
 */
export function journalWithRecap(
  existing: SessionJournal | null,
  recap: RecapPayload,
  savedAt: number,
  profile: unknown = null,
): SessionJournal {
  const fresh = journalFor(recap, savedAt, profile);
  if (existing === null) return fresh;
  const curated = Array.isArray(existing.curated) ? existing.curated : [];
  const edited = curated.length > 0;
  return {
    ...fresh,
    // Drills already on disk are carried across. The recap arrives before them
    // in the ordinary order, so this is usually a no-op — but when it is not,
    // the alternative is this write silently deleting a batch that was banked
    // nowhere else. A lesson deck waiting for a retry is carried for the same
    // reason and a stronger one: it belongs to a different session entirely,
    // and this write knows nothing about it.
    drills: Array.isArray(existing.drills) ? existing.drills : [],
    lessons: Array.isArray(existing.lessons) ? existing.lessons : [],
    curated,
    phrases: edited && Array.isArray(existing.phrases) ? existing.phrases : fresh.phrases,
    topics: edited && Array.isArray(existing.topics) ? existing.topics : fresh.topics,
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
    curated: [],
    lessons: [],
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
    curated: Array.isArray(base.curated) ? base.curated : [],
    lessons: Array.isArray(base.lessons) ? base.lessons : [],
    drills: [...drills],
  };
}

/**
 * The envelope a curated batch belongs in.
 *
 * This is the write that makes a retry honest. Until it existed the disk held
 * the recap's dozen phrases while the app banked curation's five, so a bank
 * that failed came back at the next launch as a bigger, differently grouped
 * batch than the session had decided on — and the tutor's authored extensions,
 * which the recap never carried, were recorded nowhere at all.
 *
 * The batch keeps the name the recap's envelope already had. It is the same
 * session and the same key, and minting a second name would leave `bankPractice`
 * unable to tell the batch it banked from whatever is under the key afterwards.
 *
 * Drills and counts are carried across rather than taken from the batch when
 * the batch has none: drills arrive last and may already be on disk, and a
 * caller that knows no counts must not be able to erase the ones the recap
 * read off the learner model.
 */
export function journalWithPractice(
  existing: SessionJournal | null,
  batch: PracticeBatch,
  savedAt: number,
): SessionJournal {
  const batchId =
    existing !== null && typeof existing.batchId === 'string' && existing.batchId !== ''
      ? existing.batchId
      : batch.batchId ?? mintBatchId(savedAt);
  const carriedDrills = Array.isArray(existing?.drills) ? existing.drills : [];
  const carriedUses = Array.isArray(existing?.convoUses) ? existing.convoUses : [];
  return {
    version: JOURNAL_VERSION,
    savedAt: typeof existing?.savedAt === 'number' ? existing.savedAt : savedAt,
    batchId,
    phrases: batch.phrases.filter((phrase) => phrase.fr.trim() !== ''),
    // The scene list the curated titles name, so an envelope stays readable on
    // its own terms even though `curated` is what recovery actually banks.
    topics: batch.topics.map((topic) => topic.title),
    drills: batch.drills.length > 0 ? [...batch.drills] : carriedDrills,
    convoUses: batch.convoUses.length > 0 ? [...batch.convoUses] : carriedUses,
    curated: [...batch.topics],
    lessons: [...(batch.lessons ?? []), ...(Array.isArray(existing?.lessons) ? existing.lessons : [])],
  };
}

/**
 * The envelope an unbanked lesson deck belongs in.
 *
 * The scripted path had no cover at all: `addFromSummary` awaited the review
 * store's acknowledgement and dropped it, so a full phone lost a lesson's cards
 * with nothing on disk saying they had ever been earned. A conversation in the
 * same situation is journalled and retried, and there is no reason a lesson
 * should be worth less.
 *
 * Deduplicated on the lesson id, because the retry is a whole-envelope replay
 * and a learner who fails to write the same lesson twice has one lesson's
 * cards to bank, not two.
 */
export function journalWithLesson(
  existing: SessionJournal | null,
  summary: SessionSummary,
  savedAt: number,
): SessionJournal {
  const base = journalWithDrills(existing, Array.isArray(existing?.drills) ? existing.drills : [], savedAt);
  const kept = base.lessons.filter((held) => held.lessonId !== summary.lessonId);
  return { ...base, lessons: [...kept, summary] };
}

/** Whether there is anything in it worth a write, or a recovery. */
export function isWorthKeeping(journal: SessionJournal): boolean {
  return journal.phrases.length > 0 || journal.drills.length > 0 || journal.lessons.length > 0;
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
 * A curated topic is a title and a list of card ids, and a topic that names no
 * card is a heading pointing at nothing.
 */
const isCurated = (value: unknown): value is IncomingTopic => {
  if (typeof value !== 'object' || value === null) return false;
  const topic = value as { title?: unknown; phraseKeys?: unknown };
  if (!Array.isArray(topic.phraseKeys) || !topic.phraseKeys.every((key) => typeof key === 'string')) return false;
  return isTopic(topic.title);
};

/**
 * The least a stored summary must be for `buildCardsFromSummary` to read it
 * without throwing: it dereferences the lesson id, the words, the phoneme
 * report and the struggled turns, and a half-written blob off a disk is exactly
 * the thing that has one of them missing. Anything short of that is dropped,
 * because a launch that crashes on a corrupt lesson takes the conversation
 * sitting beside it down too.
 */
const isSummary = (value: unknown): value is SessionSummary => {
  if (typeof value !== 'object' || value === null) return false;
  const summary = value as Record<string, unknown>;
  return (
    typeof summary.lessonId === 'string' &&
    Array.isArray(summary.wordsProduced) &&
    Array.isArray(summary.struggledTurnIds) &&
    typeof summary.pronunciation === 'object' &&
    summary.pronunciation !== null
  );
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
  /**
   * Scripted lesson decks riding along for a retry, and absent on every batch
   * that came out of a conversation. Optional rather than required so a caller
   * that has never seen a lesson says nothing about them.
   */
  lessons?: readonly SessionSummary[];
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

  const stored = Array.isArray(candidate.phrases)
    ? candidate.phrases.filter(isPhrase).filter((phrase) => phrase.fr.trim() !== '')
    : [];
  const drills = Array.isArray(candidate.drills) ? candidate.drills.filter(isDrill) : [];
  const lessons = Array.isArray(candidate.lessons) ? candidate.lessons.filter(isSummary) : [];
  const curated = Array.isArray(candidate.curated) ? candidate.curated.filter(isCurated) : [];

  // The practice editor has run on this envelope, so what is in it is already
  // the decision about what tomorrow is worth. Bank it whole: capping a curated
  // batch would drop the extensions the tutor authored, which sit past the
  // keep-list's own five and are the one thing in the batch nothing else holds.
  //
  // Nothing else has, so this is the recap's raw list — everything the
  // conversation touched. Banking it delivers by crash exactly the card flood
  // curation exists to prevent, so it is held to curation's own cap. The named
  // cost is real: a twelve-phrase conversation loses seven of them on this path.
  const phrases = curated.length > 0 ? stored : stored.slice(0, MAX_RECOVERED_PHRASES);

  // Counts alone are not a session. They raise evidence on cards that are
  // already in the deck, and a journal holding nothing else has nothing to bank.
  if (phrases.length === 0 && drills.length === 0 && lessons.length === 0) return null;

  const topicList = Array.isArray(candidate.topics) ? candidate.topics.filter(isTopic) : [];
  const phraseKeys = phrases.map((phrase) => phraseKeyOf(phrase.fr));

  // Every recovered phrase goes under the session's first topic, which is the
  // scene itself. That is the same shape the leave-early fallback already banks,
  // so a recovered session and an early exit produce the same practice rather
  // than two subtly different ones. A curated envelope needs none of that
  // guessing: it wrote down which phrase belongs on which card.
  const home = topicList[0];
  const fallbackTopics = home === undefined || phraseKeys.length === 0 ? [] : [{ title: home, phraseKeys }];
  return {
    // An envelope from before v3 has no name, and says so rather than being
    // given one now: a name minted at recovery would claim to identify a batch
    // it was not there for.
    batchId: typeof candidate.batchId === 'string' && candidate.batchId !== '' ? candidate.batchId : null,
    phrases,
    // A topic with no phrases under it is a heading pointing at nothing, so a
    // drills-only recovery carries no topic at all.
    topics: curated.length > 0 ? curated : fallbackTopics,
    drills,
    convoUses: Array.isArray(candidate.convoUses) ? candidate.convoUses.filter(isUse) : [],
    lessons,
  };
}
