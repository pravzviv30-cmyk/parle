/**
 * The session journal on disk.
 *
 * Storage shell only: every rule lives in journalRules.ts so it can be tested
 * without a renderer. This file is a versioned envelope, a write chain and the
 * one function that turns a recovered journal back into practice.
 *
 * The write chain is not decoration. The recap arrives twice, once plain and
 * once enriched with the learner model, and the practice message can land in
 * the same beat as either, so a save and a clear can genuinely race for this
 * key. Same arrangement as topics/store.ts, for the same reason.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecapPayload } from '@parle/core';

import { addPhrases } from '../review/store.ts';
import { userKey } from '../storage/scope.ts';
import { mergeSessionTopics } from '../topics/store.ts';
import { isWorthKeeping, journalFor, recoveryPlan } from './journalRules.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('journal');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: () => Promise<T>): Promise<T> {
  const next = writeChain.then(mutation, mutation);
  writeChain = next.catch(() => {});
  return next;
}

/** Write the recap down the moment it lands, before anything can be closed. */
export function journalRecap(recap: RecapPayload, savedAt = Date.now()): Promise<void> {
  const journal = journalFor(recap, savedAt);
  if (!isWorthKeeping(journal)) return Promise.resolve();
  return serialized(async () => {
    try {
      await AsyncStorage.setItem(KEY(), JSON.stringify(journal));
    } catch {
      // Storage full or unavailable. Nothing is lost that was not already at
      // risk, and the session on screen is unaffected.
    }
  });
}

/** Banking succeeded, so there is nothing left to recover. */
export function clearJournal(): Promise<void> {
  return serialized(async () => {
    try {
      await AsyncStorage.removeItem(KEY());
    } catch {
      // Left behind. The next launch banks it, and mergeCards keeps existing
      // scheduling, so the worst case is a card that keeps the due date it
      // already had.
    }
  });
}

/**
 * Called once, after the account scope resolves. Anything still here belongs to
 * a session that ended without being banked.
 *
 * Safe to run when there is nothing to do, which is every ordinary launch, and
 * safe to run twice: `addPhrases` merges rather than replaces, so a card that is
 * already in the deck keeps the scheduling it earned.
 */
export async function recoverJournal(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(KEY());
  } catch {
    return 0;
  }
  if (!raw) return 0;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await clearJournal();
    return 0;
  }

  const plan = recoveryPlan(parsed);
  if (plan === null) {
    await clearJournal();
    return 0;
  }

  if (plan.topics.length > 0) await mergeSessionTopics(plan.topics);
  await addPhrases(plan.phrases, { stagger: true });
  await clearJournal();
  return plan.phrases.length;
}
