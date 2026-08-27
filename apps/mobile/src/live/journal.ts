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
import type { DrillExercise, RecapPayload } from '@parle/core';

import { mergeExercises } from '../drill/store.ts';
import { addPhrases } from '../review/store.ts';
import type { PersistAck } from '../storage/ack.ts';
import { activeUserId, userKey } from '../storage/scope.ts';
import { mergeSessionTopics } from '../topics/store.ts';
import {
  isWorthKeeping,
  journalFor,
  journalWithDrills,
  recoveryPlan,
  type PracticeBatch,
  type SessionJournal,
} from './journalRules.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('journal');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
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

async function write(key: string, journal: SessionJournal): Promise<PersistAck> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(journal));
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
  return serialized(async (key) => {
    // Drills already on disk are carried across. The recap arrives before them
    // in the ordinary order, so this is usually a no-op — but when it is not,
    // the alternative is this write silently deleting a batch that was banked
    // nowhere else.
    const existing = await readJournal(key);
    const drills = Array.isArray(existing?.drills) ? existing.drills : [];
    await write(key, { ...journal, drills });
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
  return serialized(async (key) => {
    const journal = journalWithDrills(await readJournal(key), drills, savedAt);
    if (!isWorthKeeping(journal)) return;
    await write(key, journal);
  });
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
  return serialized((key) => clearAt(key, batchId));
}

async function clearAt(key: string, batchId: string | null = null): Promise<PersistAck> {
  try {
    if (batchId !== null) {
      const onDisk = await readJournal(key);
      const found = onDisk === null ? null : onDisk.batchId;
      // Nothing there, or the batch that was banked. Either way this key holds
      // nothing that still needs recovering.
      if (typeof found === 'string' && found !== '' && found !== batchId) return 'durable';
    }
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
  const topics = await acknowledged(() => mergeSessionTopics(batch.topics));
  // The counts ride the phrases' own write. One conversation, one deck write,
  // one acknowledgement to reason about.
  const phrases = await acknowledged(() => addPhrases(batch.phrases, { stagger: true, convoUses: batch.convoUses }));
  const drills = await acknowledged(() => mergeExercises(batch.drills));

  if (topics === 'failed' || phrases === 'failed' || drills === 'failed') return 'kept';

  // A clear that fails is not a bank that failed: the practice is on disk, and
  // the next launch replays a batch that every store already holds.
  await acknowledged(() => clearJournal(batch.batchId));
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
  const key = KEY();

  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return 0;
  }
  if (!raw) return 0;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await serialized(() => clearAt(key));
    return 0;
  }

  const plan = recoveryPlan(parsed);
  if (plan === null) {
    await serialized(() => clearAt(key));
    return 0;
  }

  // The account this journal belongs to must still be the account signed in, or
  // banking would file one learner's conversation into the next learner's deck.
  // Nothing is deleted in that case: the journal stays for the launch that can
  // honestly bank it.
  if (uid === null || uid !== activeUserId()) return 0;

  return (await bankPractice(plan)) === 'banked' ? plan.phrases.length : 0;
}
