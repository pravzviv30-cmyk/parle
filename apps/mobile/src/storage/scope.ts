/**
 * Per-account storage scope.
 *
 * Every on-device store keys its data under the signed-in user, so two
 * accounts on one phone never see each other's learning. The gate sets the
 * active user before anything behind it renders; a store asked for a key with
 * nobody signed in is a programming error and throws loudly rather than
 * silently sharing data.
 *
 * The pre-auth releases wrote four un-namespaced keys. The first account to
 * sign in on a device inherits that data once (it is theirs — there was only
 * ever one learner per install), then the legacy keys are gone and a marker
 * stops any later account from inheriting anything.
 *
 * A handful of keys are genuinely device-level rather than per-account, and
 * when the screen that read one is deleted the key is left behind on every
 * phone that has the app. The same seam sweeps those away.
 *
 * Not everything a learner leaves behind is a key. Two screens record audio,
 * and expo-audio writes those recordings into the app's cache as files. Those
 * files are swept here too — see `clearActiveUserData`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { sweepAttemptAudio, type AttemptAudioSweepResult } from './attemptAudio.ts';

let activeUid: string | null = null;

/**
 * A counter that moves every time the scope a key was bound under stops being
 * safe to write: an account switch, a sign-out, and a data reset.
 *
 * Binding the key at enqueue (every store does) stops a queued write landing in
 * the NEXT account. It does not stop it landing back in the SAME account's
 * namespace after `clearActiveUserData` removed it, which would resurrect a
 * deleted learner's data under their old uid. A store that captures this at
 * enqueue and compares it just before `setItem` closes both. The practice
 * stores do; older stores keep their own behaviour.
 */
let generation = 0;
let resetsInProgress = 0;

/** Module-level caches (e.g. the drill bank) register to drop on account switch. */
const resetHooks: (() => void)[] = [];
const cleanupHooks: (() => Promise<void>)[] = [];

/** Sensitive file cleanup is awaited on account deletion, unlike cache invalidation. */
export function onUserScopeCleanup(hook: () => Promise<void>): void {
  cleanupHooks.push(hook);
}

export function onUserScopeReset(hook: () => void): () => void {
  resetHooks.push(hook);
  return () => { const index = resetHooks.indexOf(hook); if (index >= 0) resetHooks.splice(index, 1); };
}

export function setActiveUser(uid: string | null): void {
  if (uid === activeUid) return;
  activeUid = uid;
  generation += 1;
  for (const hook of resetHooks) hook();
}

/** See `generation`. Read it when work is enqueued; compare it before the write. */
export function scopeGeneration(): number {
  return generation;
}

// Reset must remove data after opted-in disk writes, including a write that
// crossed the native bridge before the generation changed.
const pendingScopeWrites = new Set<Promise<unknown>>();
export async function writeInUserScope(owner: number, write: () => Promise<void>): Promise<boolean> {
  if (resetsInProgress > 0 || owner !== generation) return false;
  const pending = write();
  pendingScopeWrites.add(pending);
  try {
    await pending;
    return owner === generation;
  } finally {
    pendingScopeWrites.delete(pending);
  }
}

/** Native account writes participate in deletion's drain and reject stale work. */
export async function setItemInUserScope(owner: number, key: string, value: string): Promise<void> {
  if (!(await writeInUserScope(owner, () => AsyncStorage.setItem(key, value)))) {
    throw new Error('Account storage scope changed');
  }
}

export function activeUserId(): string | null {
  return activeUid;
}

export function userKey(suffix: string): string {
  if (activeUid === null) {
    throw new Error(`storage read for "${suffix}" with no signed-in user - stores live behind the auth gate`);
  }
  return `luvani.u.${activeUid}.${suffix}`;
}

/**
 * Every per-user key suffix in the app.
 *
 * Hand-maintained, and one that is missed here survives a reset — which for a
 * one-time flag means it never fires again for that learner, ever. Exported so
 * scope.test.ts can hold this list against every userKey call in the source
 * and fail the moment a new store forgets to join it.
 */
export const USER_KEY_SUFFIXES = [
  'profile',
  'history',
  'review',
  'drills',
  'tutorIntro',
  'activity',
  'friends',
  'topics',
  'journal',
  'missions',
  'coachMarks',
  'soundChecks',
  'conversationPacks',
  'reminder',
  'bookmarks',
  'scenarioProgress',
  'suggestions',
  // The moments a learner brought to rehearse (F549): free text about their
  // own life, kept on this phone, in the export, and gone on a reset.
  'moments',
  // What this phone did with a pack (F550): practised, continued. Device-local
  // beside the pack cache it annotates, for the cache's own reason.
  'packMarks',
  // Completed conversation-practice facts, account-synced: ids, outcomes and
  // source links only, never answer text, transcript or audio.
  'practiceHistory',
  // That a conversation was opened from one of the learner's goals, and their
  // own "used outside" report: ids and the normalised goal key only (Stage 4).
  'goalSteps',
  // The one unfinished practice sitting on this phone and its completion plan:
  // exercise ids, settled outcomes and miss counts. Device-local by design.
  'practiceSession',
  // The analytics consent. It belongs here more sharply than most: an answer
  // that survived a deletion would be a permission outliving the account that
  // gave it, and an answer missing from the export would be a fact about the
  // learner the export does not admit to holding.
  'analytics',
  // The sync engine's dirty set. It has to be here even though no `userKey`
  // call in the source names it — the engine resolves it through an injected
  // key function, so scope.test.ts's literal scan cannot see it, and
  // sync/registry.test.ts holds this entry against SYNC_STATE_SUFFIX instead.
  // A queue that survived a data reset would ask the engine to push namespaces
  // the learner just cleared.
  'syncState',
  // A checkout fence contains only the selected store product and paid plan.
  'pendingPurchase',
] as const;

/**
 * One greppable line, the shape RECORDING_NOT_DISCARDED already uses. It
 * carries no path on purpose: that a sweep left something behind is the whole
 * signal, and a device path is the kind of thing that ends up in a support
 * ticket.
 */
export const ATTEMPT_AUDIO_NOT_SWEPT = '[luvani] ATTEMPT_AUDIO_NOT_SWEPT';

/**
 * The two effects a reset has outside AsyncStorage, injected so this policy can
 * be tested without a device. The defaults are the real ones: the platform pair
 * in attemptAudio.ts, and the console.
 */
export interface ClearHooks {
  sweepAudio?: () => AttemptAudioSweepResult;
  alarm?: (line: string) => void;
}

/**
 * Wipe the signed-in account's learning data (profile, history, deck, bank),
 * remove any attempt audio still on the device, and drop module caches. The
 * account itself survives; onboarding reruns.
 *
 * One door comes through here: account deletion, which deliberately keeps the
 * local session alive until this has run so the active namespace can still be
 * resolved. The progress reset left with Profile's dead buttons.
 *
 * Three orderings, and each is load-bearing.
 *
 * **Audio first.** Every attempt already deletes its own recording
 * (speech/discardRecording.ts). This is the backstop for the app killed
 * mid-attempt, for the builds that shipped before that discard existed, and for
 * whatever path nobody thought of. It runs ahead of the key removal so a
 * storage failure cannot skip it — the bytes nobody can inspect matter more
 * than the ones the learner can see are gone.
 *
 * **A failed sweep does not break the reset.** It cannot: the learner asked for
 * their data to go and most of it can. So the sweep is counted rather than
 * thrown, and a non-zero count leaves ATTEMPT_AUDIO_NOT_SWEPT in the log.
 * Swallowed is not the same as hidden.
 *
 * **A failed key removal still throws, exactly as it did.** App.tsx catches it
 * on the deletion path and tells the learner plainly that this device could not
 * finish erasing its local copy. That honesty is an existing property and
 * nothing here is allowed to quiet it.
 */
export async function clearActiveUserData(hooks: ClearHooks = {}): Promise<void> {
  const uid = activeUid;
  if (uid === null) return;
  // Before any await: a write enqueued before the reset must not land after it.
  generation += 1;
  resetsInProgress += 1;
  try {
    const sweep = hooks.sweepAudio ?? sweepAttemptAudio;
    const alarm = hooks.alarm ?? ((line: string): void => console.error(line));
    try {
      if (sweep().failed > 0) alarm(ATTEMPT_AUDIO_NOT_SWEPT);
    } catch {
      alarm(ATTEMPT_AUDIO_NOT_SWEPT);
    }
    await Promise.allSettled([...pendingScopeWrites]);
    const cleanup = await Promise.allSettled(cleanupHooks.map(hook => hook()));
    await AsyncStorage.multiRemove(USER_KEY_SUFFIXES.map((s) => `luvani.u.${uid}.${s}`));
    const refused = cleanup.find(result => result.status === 'rejected');
    if (refused?.status === 'rejected') throw refused.reason;
  } finally {
    // Work begun while cleanup was awaiting must also be stale after it ends.
    generation += 1;
    resetsInProgress -= 1;
    for (const hook of resetHooks) hook();
  }
}

const MIGRATED_MARKER = 'luvani.legacyMigrated.v1';

/** Legacy pre-auth key → per-user suffix. Payload versions live inside the JSON. */
const LEGACY_KEYS: readonly (readonly [string, string])[] = [
  ['luvani.profile.v1', 'profile'],
  ['luvani.history.v1', 'history'],
  ['luvani.review.v1', 'review'],
  ['luvani.drills.v1', 'drills'],
];

/**
 * Device-level keys whose reader has been deleted.
 *
 * These are not legacy keys, because there is nothing left to inherit.
 * `luvani.seenSplash.v1` recorded that this install had seen the pre-auth
 * splash; the splash is gone, so the flag now encodes "has seen a screen that
 * no longer exists". Removing it is the whole migration.
 *
 * Exported so scope.test.ts can hold the list against the app source and fail
 * if anything starts reading a key the sweep deletes.
 */
export const RETIRED_DEVICE_KEYS = ['luvani.seenSplash.v1'] as const;

/**
 * One-time inheritance of pre-auth device data by the first account.
 * Idempotent: the marker short-circuits, and an existing namespaced value is
 * never overwritten. Copy lands before delete, so a crash between the two
 * leaves data duplicated rather than lost.
 */
export async function migrateLegacyStores(uid: string): Promise<void> {
  const owner = scopeGeneration();
  try {
    const targets = LEGACY_KEYS.map(([, suffix]) => `luvani.u.${uid}.${suffix}`);
    const keys = [
      MIGRATED_MARKER,
      ...RETIRED_DEVICE_KEYS,
      ...LEGACY_KEYS.map(([legacy]) => legacy),
      ...targets,
    ];
    const values = new Map(await AsyncStorage.multiGet(keys));

    // Swept ahead of the marker, deliberately. Every device still carrying a
    // retired key inherited its pre-auth data long ago, so the marker is
    // already set and a sweep behind it would never run on the only devices
    // that need one. Idempotent because a key that is gone never reads as
    // present: after the launch that removes it this costs one entry in the
    // batch above and no write at all.
    const retired = RETIRED_DEVICE_KEYS.filter((key) => {
      const value = values.get(key);
      return value !== null && value !== undefined;
    });
    if (retired.length > 0) await AsyncStorage.multiRemove([...retired]);

    if (values.get(MIGRATED_MARKER) !== null) return;

    const writes: [string, string][] = [];
    const removals: string[] = [];
    LEGACY_KEYS.forEach(([legacy], index) => {
      const value = values.get(legacy);
      if (value === null || value === undefined) return;
      const target = targets[index]!;
      if (values.get(target) === null) writes.push([target, value]);
      removals.push(legacy);
    });

    // Copy first, mark second, delete last. A crash can leave a harmless
    // duplicate, but never delete the learner's only copy.
    if (!(await writeInUserScope(owner, () => AsyncStorage.multiSet([...writes, [MIGRATED_MARKER, '1']])))) return;
    if (removals.length > 0) await AsyncStorage.multiRemove(removals);
  } catch {
    // Storage unavailable. The learner starts clean; nothing is corrupted.
  }
}
