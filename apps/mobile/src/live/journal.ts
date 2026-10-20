/**
 * The session journal on disk.
 *
 * Storage shell only: every rule lives in journalRules.ts so it can be tested
 * without a renderer. This file is a versioned envelope, a write chain, the one
 * function that banks a batch, and the one that turns a recovered journal back
 * into practice through it.
 *
 * The clear is the dangerous end of this file, and `bankPractice` is the whole
 * answer to it. Deleting the journal is deleting the only copy of a session, so
 * it happens after every store the batch touches has said `durable` and never
 * on the strength of a promise resolving. Any store that says `failed` leaves
 * the journal exactly where it is, and the next launch tries again — there is
 * no in-session retry, because a phone that is out of space this second is
 * still out of space next second, and a loop would only spend the learner's
 * battery proving it.
 *
 * The write chain is not decoration. The recap arrives twice, once plain and
 * once enriched with the learner model, the practice message can land in the
 * same beat as either, and the drills arrive right behind them, so a save and a
 * clear can genuinely race for this key. Same arrangement as topics/store.ts,
 * for the same reason. Every mutation binds its key at enqueue, so a sign-out
 * while one is queued cannot redirect it into the next account.
 *
 * Device-local, and deliberately not synced: this is a crash buffer for one
 * device's unfinished session, and pushing it to the account would have a
 * second device re-bank a session the first one already banked.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrillExercise, RecapPayload, SessionSummary } from '@luvani/core';

import { mergeExercises } from '../drill/store.ts';
import { addFromSummary, addPhrases } from '../review/store.ts';
import type { PersistAck } from '../storage/ack.ts';
import { activeUserId, userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { mergeSessionTopics } from '../topics/store.ts';
import {
  isWorthKeeping,
  journalFor,
  journalWithDrills,
  journalWithLesson,
  journalWithPractice,
  journalWithRecap,
  recoveryPlan,
  type PracticeBatch,
  type SessionJournal,
} from './journalRules.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('journal');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/** Whatever is on disk right now, or null. Corrupt reads as null, never a throw. */
async function readJournal(key: string): Promise<SessionJournal | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as SessionJournal) : null;
  } catch {
    return null;
  }
}

async function write(key: string, journal: SessionJournal, owner: number): Promise<PersistAck> {
  try {
    await setItemInUserScope(owner, key, JSON.stringify(journal));
    return 'durable';
  } catch {
    // Storage full or unavailable. Nothing is lost that was not already at
    // risk, and the session on screen is unaffected.
    return 'failed';
  }
}

/**
 * Write the recap down the moment it lands, before anything can be closed.
 *
 * `profile` is the learner model that arrives beside the recap on the same
 * message. It is read for one thing — how many times each phrase has been used
 * well in conversation — and never stored whole: the journal is a crash buffer
 * for one session, not a second copy of the learner. An options object rather
 * than another positional, so a caller that only knows the recap says only
 * that, and an old two-argument call fails to compile instead of quietly
 * passing a timestamp where a profile goes.
 */
export function journalRecap(
  recap: RecapPayload,
  opts: { profile?: unknown; savedAt?: number } = {},
): Promise<void> {
  const savedAt = opts.savedAt ?? Date.now();
  const journal = journalFor(recap, savedAt, opts.profile ?? null);
  if (!isWorthKeeping(journal)) return Promise.resolve();
  return serialized(async (key, owner) => {
    // What survives a recap landing on a key that is not empty is a rule, not a
    // storage detail, so it lives in journalRules.ts with the rest of them.
    await write(key, journalWithRecap(await readJournal(key), recap, savedAt, opts.profile ?? null), owner);
  });
}

/**
 * Write the generated practice down the moment it lands.
 *
 * `ConvoScreen` merges the same batch into the bank in the same beat, so on an
 * ordinary session this is written and then cleared seconds later having never
 * been read. It exists for the session that is not ordinary: drills are the
 * last thing a conversation produces, and an app closed in that beat used to
 * lose the entire batch with nothing anywhere recording that it had existed.
 */
export function journalDrills(drills: readonly DrillExercise[], savedAt = Date.now()): Promise<void> {
  if (drills.length === 0) return Promise.resolve();
  return serialized(async (key, owner) => {
    const journal = journalWithDrills(await readJournal(key), drills, savedAt);
    if (!isWorthKeeping(journal)) return;
    await write(key, journal, owner);
  });
}

/**
 * Write the curated batch down, and hand back the batch that names it.
 *
 * Called immediately before banking, and the reason is the retry. The journal
 * up to this point holds what the RECAP said, which is every phrase the
 * conversation touched; the app is about to bank what CURATION said, which is a
 * few of them, grouped, plus extensions the recap never carried. A bank that
 * fails leaves the first of those on disk and the next launch banks it — so the
 * learner's retry delivered more cards, in different groups, than the session
 * had decided on, and the tutor's authored phrases were lost with nothing
 * anywhere recording that they had existed.
 *
 * Returns the batch with the journal entry's name on it, which is what makes
 * the clear at the end of banking safe. A batch banked straight from the room
 * has no name and clears the key unconditionally; that was right while the room
 * wrote nothing down, and is wrong the moment it does. Hand the returned batch
 * to `bankPractice` and nothing else.
 *
 * Never throws and never rejects, and the `try` covers both: `serialized` binds
 * the account by calling `userKey()` on the spot, which throws by design the
 * instant nobody is signed in. That throw is synchronous, so a `.catch()` on
 * the returned promise would miss it and leave the caller's effect holding an
 * exception. A journal that cannot be written is a retry the learner does not
 * get, not a session that fails on screen, and the batch comes back unnamed so
 * the bank behaves exactly as it did before this write existed.
 */
export async function journalPractice(batch: PracticeBatch, savedAt = Date.now()): Promise<PracticeBatch> {
  try {
    return await serialized(async (key, owner) => {
      const journal = journalWithPractice(await readJournal(key), batch, savedAt);
      if (!isWorthKeeping(journal)) return batch;
      await write(key, journal, owner);
      return { ...batch, batchId: journal.batchId };
    });
  } catch {
    return batch;
  }
}

/**
 * Put a scripted lesson's cards in the deck, and keep them if the disk refuses.
 *
 * The conversation path has had an outbox since Phase 4 and the lesson path had
 * nothing: `addFromSummary` awaited an acknowledgement and dropped it, so a
 * learner who finished a lesson with a full phone lost the whole deck without a
 * word. This is that outbox, reused rather than rebuilt — same key, same
 * once-per-launch recovery, same rule about when it is safe to delete the only
 * copy of something.
 *
 * The summary is journalled only when the write actually failed. The ordinary
 * lesson writes its cards and touches this key not at all, which matters
 * because the key is also where an unbanked conversation waits.
 */
export async function bankLesson(summary: SessionSummary): Promise<PersistAck> {
  const owner = scopeGeneration();
  const uid = activeUserId();
  const ack = await acknowledged(() => addFromSummary(summary));
  if (owner !== scopeGeneration() || uid === null || uid !== activeUserId()) return 'failed';
  if (ack === 'durable') return ack;
  try {
    // `serialized` throws rather than rejects when nobody is signed in, which
    // is why this is a try and not a `.catch()`. Nothing is kept in that case,
    // and nothing can be: there is no account to keep it under.
    await serialized(async (key, owner) => {
      await write(key, journalWithLesson(await readJournal(key), summary, Date.now()), owner);
    });
  } catch {
    // Nothing more to try. The caller already knows the deck did not land.
  }
  return ack;
}

/**
 * Banking succeeded, so there is nothing left to recover.
 *
 * `batchId` names the batch that was banked. Given one, the journal is deleted
 * only when the copy on disk is still that batch: a session that finished while
 * the acknowledgements were coming back has written its own recap over this key,
 * and deleting it would throw away a conversation nobody has banked. Given
 * nothing — a batch banked straight from a live session, or an envelope written
 * before v3 carried a name — the key is cleared as it always was.
 */
export function clearJournal(batchId: string | null = null): Promise<PersistAck> {
  return serialized((key, owner) => clearAt(key, batchId, owner));
}

async function clearAt(key: string, batchId: string | null = null, owner = scopeGeneration()): Promise<PersistAck> {
  try {
    if (owner !== scopeGeneration()) return 'failed';
    if (batchId !== null) {
      const onDisk = await readJournal(key);
      const found = onDisk === null ? null : onDisk.batchId;
      // Nothing there, or the batch that was banked. Either way this key holds
      // nothing that still needs recovering.
      if (typeof found === 'string' && found !== '' && found !== batchId) return 'durable';
    }
    if (owner !== scopeGeneration()) return 'failed';
    await AsyncStorage.removeItem(key);
    return 'durable';
  } catch {
    // Left behind. The next launch banks it, and mergeCards keeps existing
    // scheduling, so the worst case is a card that keeps the due date it
    // already had.
    return 'failed';
  }
}

/**
 * Put one conversation's practice where it belongs, and clear the journal only
 * if every store that took part says the write reached the disk.
 *
 * `banked` means the journal is gone and this batch is not coming back.
 * `kept` means at least one store could not write, the journal is untouched,
 * and the next launch's `recoverJournal` will try the whole batch again.
 *
 * Three properties make that retry safe, and none of them is new here. Every
 * merge is by content identity — `mergeTopics` on the topic id, `mergeCards` on
 * the phrase key, `mergeExerciseBank` on `(phraseKey, kind)` — so a second
 * delivery lands on the same rows rather than beside them. Scheduling a learner
 * earned survives, because `mergeCards` keeps the card that is already in the
 * deck. And the conversation counts fold by max rather than by addition, so
 * replaying a batch cannot inflate what a learner has been shown to know.
 *
 * All three stores are tried even after one has failed. They key on different
 * suffixes and can fail independently, and banking two thirds of a session is
 * better than banking none of it — the journal is kept either way, so whatever
 * did land is simply written again next time onto rows that already hold it.
 */
export async function bankPractice(batch: PracticeBatch): Promise<'banked' | 'kept'> {
  const owner = scopeGeneration();
  const uid = activeUserId();
  const current = () => uid !== null && uid === activeUserId() && owner === scopeGeneration();
  if (!current()) return 'kept';
  const topics = await acknowledged(() => mergeSessionTopics(batch.topics));
  if (!current()) return 'kept';
  // The counts ride the phrases' own write. One conversation, one deck write,
  // one acknowledgement to reason about.
  const phrases = await acknowledged(() => addPhrases(batch.phrases, { source: 'conversation', stagger: true, convoUses: batch.convoUses }));
  if (!current()) return 'kept';
  const drills = await acknowledged(() => mergeExercises(batch.drills));
  if (!current()) return 'kept';
  // A lesson deck riding in the same envelope, which only ever happens on a
  // recovered batch. Every one is tried even after one has failed, on the same
  // reasoning as the three stores: the journal is kept either way, and
  // `mergeCards` lands a redelivery on the rows it already wrote.
  let lessons: PersistAck = 'durable';
  for (const summary of batch.lessons ?? []) {
    if ((await acknowledged(() => addFromSummary(summary))) === 'failed') lessons = 'failed';
    if (!current()) return 'kept';
  }

  if (topics === 'failed' || phrases === 'failed' || drills === 'failed' || lessons === 'failed') return 'kept';

  // A clear that fails is not a bank that failed: the practice is on disk, and
  // the next launch replays a batch that every store already holds.
  await acknowledged(() => clearJournal(batch.batchId));
  if (!current()) return 'kept';
  return 'banked';
}

/**
 * A store write, and what it did, even when it did not get as far as answering.
 *
 * A store can throw rather than resolve — `userKey()` throws by design the
 * instant nobody is signed in, which is what a sign-out during banking looks
 * like from here. That is not durable, so it reads as `failed`: the journal
 * stays, and the launch that can honestly bank this batch banks it. It must
 * also not escape, because the one caller is the launch sequence and an
 * exception there leaves the app sitting on its splash screen.
 */
async function acknowledged(write: () => Promise<PersistAck>): Promise<PersistAck> {
  try {
    return await write();
  } catch {
    return 'failed';
  }
}

/**
 * Called once, after the account scope resolves. Anything still here belongs to
 * a session that ended without being banked.
 *
 * Safe to run when there is nothing to do, which is every ordinary launch, and
 * safe to run twice: `addPhrases` merges rather than replaces, so a card that is
 * already in the deck keeps the scheduling it earned, and `mergeExerciseBank`
 * replaces an exercise by identity rather than accumulating copies of it.
 *
 * Bank first, clear second, always — and clear only on every acknowledgement,
 * which is `bankPractice`'s job. This launch IS the retry: a batch kept because
 * the disk was full stays on disk, unchanged, for the launch after this one.
 *
 * Returns how many phrases were banked and can stop being kept. A batch that
 * could not be written answers zero, because nothing about it is finished.
 */
export async function recoverJournal(): Promise<number> {
  const uid = activeUserId();
  const owner = scopeGeneration();
  const key = KEY();

  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return 0;
  }
  if (owner !== scopeGeneration() || uid !== activeUserId()) return 0;
  if (!raw) return 0;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await serialized(() => clearAt(key, null, owner));
    return 0;
  }

  const plan = recoveryPlan(parsed);
  if (plan === null) {
    await serialized(() => clearAt(key, null, owner));
    return 0;
  }

  // The account this journal belongs to must still be the account signed in, or
  // banking would file one learner's conversation into the next learner's deck.
  // Nothing is deleted in that case: the journal stays for the launch that can
  // honestly bank it.
  if (uid === null || uid !== activeUserId()) return 0;

  return (await bankPractice(plan)) === 'banked' ? plan.phrases.length : 0;
}
