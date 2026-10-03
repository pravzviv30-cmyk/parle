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
import { onUserScopeReset, userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/**
 * The seen flag on disk, as JSON so the sync engine can read the same bytes
 * this store writes. `'1'` has always been the value; it is also valid JSON for
 * the number 1, which is why the engine reading this key through `JSON.parse`
 * sees a truthy value rather than a parse error.
 */
const SEEN = '1';

export async function hasSeenTutorIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(userKey('tutorIntro'))) !== null;
  } catch {
    return false;
  }
}

export async function markTutorIntroSeen(): Promise<void> {
  // Resolved before the await, not after: a sign-out that lands mid-write must
  // not mark the next learner as having seen an intro they have never seen.
  const key = userKey('tutorIntro');
  const owner = scopeGeneration();
  try {
    await setItemInUserScope(owner, key, SEEN);
    markDirty('tutorIntro');
  } catch {
    // The learner may see it once more. Nothing is lost.
  }
}

/**
 * Seen anywhere is seen: the account's answer only ever turns this on.
 *
 * There is no way back. That is the point of a one-time flag — a merge that
 * could clear it would show a learner the same four-page explainer again on a
 * new phone, having already read it on their old one.
 *
 * The fold still gets this device's own answer, because the engine's contract is
 * that it always does and an adopter that ignores it is reported as unfolded.
 * There is no write chain here and this is the one adopter that does not want
 * one: the value written is a constant, so two writers racing cannot produce a
 * result either of them did not ask for, and a flag that only ever turns on has
 * no read-modify-write to lose.
 */
async function adoptTutorIntro(fold: SyncFold): Promise<SyncAdoption> {
  // Bound before the read, not after: a sign-out landing mid-adoption must not
  // redirect one learner's answer into the next learner's key.
  const key = userKey('tutorIntro');
  const owner = scopeGeneration();
  const folded = fold(await readPersisted(key));
  if (folded === null || folded === undefined || folded === false || folded === 0) return 'declined';
  try {
    await setItemInUserScope(owner, key, SEEN);
  } catch {
    // Storage full, unavailable or stale. The next cycle may retry.
    return 'declined';
  }
  return 'adopted';
}

/** Resolved per call: the active account can change between calls. */
const COACH_MARKS_KEY = () => userKey('coachMarks');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = COACH_MARKS_KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/**
 * A key in the shape the sync engine reads it: the parsed value, or null when
 * nothing was ever written there.
 *
 * Both facts in this file go through it, because the merge has to be able to
 * tell a device that has never shown a mark from one whose list is genuinely
 * empty, and a device that has never seen the intro from one that answered no
 * — which is a thing this flag can never say, and must never be made to.
 */
async function readPersisted(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // A corrupt list means a mark may appear one more time. Harmless.
    return null;
  }
}

/**
 * A plain array of ids. An id this build does not know is kept rather than
 * dropped: it belongs to a mark some other build showed, and throwing it away
 * would show that mark again to someone who has already read it.
 */
function idsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

async function readSeen(key: string): Promise<string[]> {
  return idsOf(await readPersisted(key));
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
  return serialized(async (key, owner) => {
    // Two marks can be dismissed in one beat, so this read-modify-write goes
    // through the chain: without it the second write loses the first one.
    const seen = await readSeen(key);
    if (seen.includes(id)) return;
    try {
      await setItemInUserScope(owner, key, JSON.stringify([...seen, id]));
      markDirty('coachMarks');
    } catch {
      // Storage full or unavailable. The mark may show once more, never twice
      // in the same session, because the session's own state remembers it.
    }
  });
}

/**
 * Fold the account's marks into this device's, on this store's own chain.
 *
 * This one already read the disk inside the chain and unioned, which is what
 * every other adopter now does; the only change is that the account's side
 * arrives as a fold rather than as a finished list, so the union happens once,
 * in sync/policy.ts, over the marks this store holds at that instant. A mark
 * dismissed while the engine was on the network is kept rather than unread.
 *
 * Unioned again here with what this device had, because adoption must never be
 * able to *unread* a mark, and sorted for the same reason the policy sorts: an
 * array's order is part of its bytes, `markCoachMarkSeen` appends rather than
 * sorts, and a device whose row differed from the account's by order alone would
 * be re-adopted on every cycle for the rest of that install's life. It writes
 * every time rather than checking first, so there is no branch here that no test
 * ever takes. An id this build has never heard of is kept for the same reason
 * `readSeen` keeps it — it belongs to a mark some other build showed.
 */
function adoptCoachMarks(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    const current = await readPersisted(key);
    const seen = idsOf(current);
    const folded = fold(current);
    if (!Array.isArray(folded)) return 'declined';
    const union = [...new Set([...seen, ...idsOf(folded)])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    try {
      await setItemInUserScope(owner, key, JSON.stringify(union));
    } catch {
      // Storage full, unavailable or stale. The next cycle may retry.
      return 'declined';
    }
    return 'adopted';
  });
}

function registerAdopters(): void {
  registerSyncAdopter('tutorIntro', adoptTutorIntro);
  registerSyncAdopter('coachMarks', adoptCoachMarks);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopters();
onUserScopeReset(registerAdopters);
