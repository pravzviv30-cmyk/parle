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
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let activeUid: string | null = null;

/** Module-level caches (e.g. the drill bank) register to drop on account switch. */
const resetHooks: (() => void)[] = [];

export function onUserScopeReset(hook: () => void): void {
  resetHooks.push(hook);
}

export function setActiveUser(uid: string | null): void {
  if (uid === activeUid) return;
  activeUid = uid;
  for (const hook of resetHooks) hook();
}

export function activeUserId(): string | null {
  return activeUid;
}

export function userKey(suffix: string): string {
  if (activeUid === null) {
    throw new Error(`storage read for "${suffix}" with no signed-in user - stores live behind the auth gate`);
  }
  return `parle.u.${activeUid}.${suffix}`;
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
  // The sync engine's dirty set. It has to be here even though no `userKey`
  // call in the source names it — the engine resolves it through an injected
  // key function, so scope.test.ts's literal scan cannot see it, and
  // sync/registry.test.ts holds this entry against SYNC_STATE_SUFFIX instead.
  // A queue that survived a data reset would ask the engine to push namespaces
  // the learner just cleared.
  'syncState',
] as const;

/**
 * Wipe the signed-in account's learning data (profile, history, deck, bank)
 * and drop module caches. The account itself survives; onboarding reruns.
 */
export async function clearActiveUserData(): Promise<void> {
  if (activeUid === null) return;
  try {
    await AsyncStorage.multiRemove(USER_KEY_SUFFIXES.map((s) => `parle.u.${activeUid}.${s}`));
  } finally {
    for (const hook of resetHooks) hook();
  }
}

const MIGRATED_MARKER = 'parle.legacyMigrated.v1';

/** Legacy pre-auth key → per-user suffix. Payload versions live inside the JSON. */
const LEGACY_KEYS: readonly (readonly [string, string])[] = [
  ['parle.profile.v1', 'profile'],
  ['parle.history.v1', 'history'],
  ['parle.review.v1', 'review'],
  ['parle.drills.v1', 'drills'],
];

/**
 * One-time inheritance of pre-auth device data by the first account.
 * Idempotent: the marker short-circuits, and an existing namespaced value is
 * never overwritten. Copy lands before delete, so a crash between the two
 * leaves data duplicated rather than lost.
 */
export async function migrateLegacyStores(uid: string): Promise<void> {
  try {
    const targets = LEGACY_KEYS.map(([, suffix]) => `parle.u.${uid}.${suffix}`);
    const keys = [MIGRATED_MARKER, ...LEGACY_KEYS.map(([legacy]) => legacy), ...targets];
    const values = new Map(await AsyncStorage.multiGet(keys));
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
    await AsyncStorage.multiSet([...writes, [MIGRATED_MARKER, '1']]);
    if (removals.length > 0) await AsyncStorage.multiRemove(removals);
  } catch {
    // Storage unavailable. The learner starts clean; nothing is corrupted.
  }
}
