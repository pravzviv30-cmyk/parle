/**
 * The session journal on disk.
 *
 * Storage shell only: every rule lives in journalRules.ts so it can be tested
 * without a renderer. This file is a versioned envelope, a write chain and the
 * one function that turns a recovered journal back into practice.
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
import { activeUserId, userKey } from '../storage/scope.ts';
import { mergeSessionTopics } from '../topics/store.ts';
import { isWorthKeeping, journalFor, journalWithDrills, recoveryPlan, type SessionJournal } from './journalRules.ts';

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

async function write(key: string, journal: SessionJournal): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(journal));
  } catch {
    // Storage full or unavailable. Nothing is lost that was not already at
    // risk, and the session on screen is unaffected.
  }
}

/** Write the recap down the moment it lands, before anything can be closed. */
export function journalRecap(recap: RecapPayload, savedAt = Date.now()): Promise<void> {
  const journal = journalFor(recap, savedAt);
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

/** Banking succeeded, so there is nothing left to recover. */
export function clearJournal(): Promise<void> {
  return serialized((key) => clearAt(key));
}

async function clearAt(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Left behind. The next launch banks it, and mergeCards keeps existing
    // scheduling, so the worst case is a card that keeps the due date it
    // already had.
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
 * Bank first, clear second, always. A crash between the two costs a repeat of
 * work that is idempotent; the other order costs the session.
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

  if (plan.topics.length > 0) await mergeSessionTopics(plan.topics);
  if (plan.phrases.length > 0) await addPhrases(plan.phrases, { stagger: true });
  if (plan.drills.length > 0) await mergeExercises(plan.drills);
  await serialized(() => clearAt(key));
  return plan.phrases.length;
}
