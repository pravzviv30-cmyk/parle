/**
 * What this learner has already been shown about the tutor.
 *
 * Two facts live here, both per-account rather than per-install (the splash is
 * a fact about the device; these are facts about a person). Read inside the
 * Tutor tab rather than at the app root so the bottom nav never flashes and
 * Home is never held up waiting for a disk read only one tab cares about.
 *
 * `tutorIntro` is the old four-page explainer. It is demoted, not deleted —
 * the intro is still reachable from a link, and this flag still remembers who
 * has seen it — so nothing here changes when it stops gating the door.
 *
 * The coach marks are its replacement: small contextual notes shown where a
 * control matters. Their seen-state is **one key holding one array**, not one
 * key per mark. A key per mark is how a reset quietly misses one and a
 * one-time note never fires again for the rest of that learner's life.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey } from '../storage/scope.ts';

export async function hasSeenTutorIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(userKey('tutorIntro'))) !== null;
  } catch {
    return false;
  }
}

export async function markTutorIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(userKey('tutorIntro'), '1');
  } catch {
    // The learner may see it once more. Nothing is lost.
  }
}

/** Resolved per call: the active account can change between calls. */
const COACH_MARKS_KEY = () => userKey('coachMarks');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = COACH_MARKS_KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

async function readSeen(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // A plain array of ids, and an id this build does not know is kept rather
    // than dropped: it belongs to a mark some other build showed, and throwing
    // it away would show that mark again to someone who has already read it.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A corrupt list means a mark may appear one more time. Harmless.
    return [];
  }
}

/**
 * Which coach marks this learner has already read.
 *
 * Ids are `string` here on purpose: the sequencing rules and the `CoachMarkId`
 * union live in `tutor/coachMarks.ts`, and this store deliberately knows
 * nothing about which marks exist so it never has to be migrated when one is
 * added or retired.
 */
export function loadSeenCoachMarks(): Promise<string[]> {
  return readSeen(COACH_MARKS_KEY());
}

/** Remember that a mark has been read. Idempotent. */
export function markCoachMarkSeen(id: string): Promise<void> {
  return serialized(async (key) => {
    // Two marks can be dismissed in one beat, so this read-modify-write goes
    // through the chain: without it the second write loses the first one.
    const seen = await readSeen(key);
    if (seen.includes(id)) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify([...seen, id]));
    } catch {
      // Storage full or unavailable. The mark may show once more, never twice
      // in the same session, because the session's own state remembers it.
    }
  });
}
