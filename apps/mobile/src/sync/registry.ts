import { scopeGeneration, writeInUserScope } from '../storage/scope.ts';

/**
 * The seam between the twelve device stores and the one background reconciler.
 *
 * Two directions, in the mould of `onUserScopeReset` in storage/scope.ts:
 *
 *   store  -> engine   `markDirty('review')`, called after a write actually reaches disk
 *   engine -> store    `registerSyncAdopter('review', adopt)`, called with a **fold**
 *
 * The adopter is the important half, and it is why the engine has no `setItem` for a
 * store's key anywhere in it. Every store in this app is a read-modify-write over one
 * AsyncStorage key, serialised through its own promise chain and answering reads from
 * its own in-memory cache. An engine that wrote that key directly would race the chain
 * (the store's next write rebuilds from the value it read *before* the engine's, and
 * silently drops the merge) and would leave the cache stale until the next launch. So
 * merged state goes back the way every other write goes: through the store, on the
 * store's chain, updating the store's cache. Adoption is slower than a direct write, and
 * that is the trade — correctness over latency.
 *
 * ## Why the adopter is handed a fold and not a blob
 *
 * Going through the store's chain is necessary and was not sufficient. The engine reads
 * a namespace off disk, spends a network round trip on the pull, and only then adopts.
 * An adopter handed a *finished* blob writes a value computed from a world that is by
 * then several hundred milliseconds old, and a grade, a banked session or a finished
 * conversation's profile delta that landed in between is written over. Worse, the write
 * that was clobbered left its dirty flag up, so the next cycle pushes the clobbered
 * state to the account and clears the flag: the learner's work is then gone on every
 * device, silently. That was F93.
 *
 * So the engine hands over a `SyncFold` instead. The store calls it **inside its own
 * write chain**, with the value it holds at that instant, and writes what comes back.
 * Read, fold and write then happen with nothing able to land between them, because the
 * chain is the one place in the app where that is true. The fold is legal because every
 * policy in sync/policy.ts is commutative and idempotent by construction, and every one
 * of them but `profile` is associative too — so folding a merge into a newer local state
 * cannot lose either side, and folding twice is the same as folding once. policy.test.ts
 * property-tests all three over generated blobs.
 *
 * `profile` is the exception and it is named rather than hidden. Everything outside
 * brain's phrase and error-pattern unions is taken whole from the evidence-heavier side,
 * so two sides carrying equal evidence fall through to a tiebreak that the first merge has
 * already moved. A profile field written during a cycle can therefore still lose that
 * tiebreak. That is strictly better than what it replaced — a blind adoption lost *every*
 * field of such a write — and field-wise merge is Phase 4's job, with the rest of the
 * mastery reconciliation.
 *
 * The dirty set is an optimisation, not a correctness dependency. It says "these
 * namespaces changed since the last successful push", it survives a restart, and if it
 * is ever wrong the launch-time full reconcile in the engine catches up. That is what
 * makes the crash window between a store's disk write and this module's persist cost one
 * launch rather than a learner's week.
 *
 * No react-native import: persistence arrives through `attachDirtyStore`, so this file
 * and everything that depends on it runs under plain `node --test`.
 */

/** A namespace is exactly a per-user storage key suffix, so the two never drift. */
export type SyncNamespace = string;

/**
 * Fold the account's state into whatever this store holds right now.
 *
 * `current` is the store's blob **in the shape the engine reads off disk** — the value
 * the store would write this instant, not its in-memory model, because the engine's
 * policies merge persisted shapes. `null` means this store has never written the key.
 *
 * The return is the value to write. It is a pure function of `current`: no promise, no
 * await, nothing that could let another write in. Call it once, inside the chain,
 * between the read and the write:
 *
 * ```ts
 * registerSyncAdopter('review', (fold) =>
 *   chain(async () => {
 *     const next = parseDeck(fold(serialise(cache)));   // fold, then validate
 *     cache = next;
 *     await AsyncStorage.setItem(key, JSON.stringify(next));
 *     return 'adopted';
 *   }),
 * );
 * ```
 *
 * Calling it outside the chain, or awaiting anything between calling it and writing what
 * it returned, reopens exactly the window it exists to close. Calling it twice is
 * harmless — the policies are idempotent — but pointless.
 */
export type SyncFold = (current: unknown) => unknown;

/**
 * What the store did.
 *
 * `declined` is for a store that read the folded value and could not use it: a shape its
 * parser rejects, a version it does not understand. It is not a failure — the store keeps
 * what it had, the engine records one line and carries on with the rest of the cycle.
 * Throwing, by contrast, ends the cycle for that namespace.
 */
export type SyncAdoption = 'adopted' | 'declined';

/**
 * Write the account's state back through the store that owns it.
 *
 * The store validates what the fold returns the way it validates anything off disk — it
 * may have been merged from a payload another device wrote — updates its cache, and
 * writes on its own chain. It must not call `markDirty` for this write: adopting is how
 * the device catches up with the account, not a new local change.
 *
 * The return type is load-bearing, not ceremony. An adopter's parameter is `unknown`, so
 * an old `(merged: unknown) => Promise<void>` adopter would still typecheck against a
 * fold-taking signature and would silently persist the *function*. `Promise<SyncAdoption>`
 * is what makes a store that has not been converted fail to compile instead.
 */
export type SyncAdopter = (fold: SyncFold) => Promise<SyncAdoption>;

/** The slice of AsyncStorage this module needs, injected so nothing here imports it. */
export interface DirtyStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * The user-scoped key suffix the dirty set lives under.
 *
 * Exported as one name so `USER_KEY_SUFFIXES` in storage/scope.ts and the engine cannot
 * disagree about it. It has to be in that list: a dirty set that outlived a data reset
 * would ask the engine to push namespaces the learner just cleared. registry.test.ts
 * holds the list to this constant, because scope.test.ts's scan reads literal
 * calls to `userKey` and the engine resolves this one through an injected function instead.
 */
export const SYNC_STATE_SUFFIX = 'syncState';

const PERSISTED_VERSION = 1;

interface Persisted {
  version: number;
  dirty: string[];
}

const adopters = new Map<SyncNamespace, SyncAdopter>();
const listeners: ((namespace: SyncNamespace) => void)[] = [];

/**
 * Dirty namespaces, each with the stamp of the write that dirtied it.
 *
 * A plain set would lose data. The engine reads a namespace, pushes it, and clears the
 * flag — and a write that landed while that push was in flight would be cleared along
 * with it, never pushed, and invisible until the learner next touched that store. The
 * stamp closes that: the engine remembers which one it was clearing, and a newer stamp
 * means somebody wrote again and the flag stays up.
 */
const dirty = new Map<SyncNamespace, number>();
let stamps = 0;

let storage: DirtyStorage | null = null;
let stateKey: string | null = null;
/** Persist writes are serialised for the same reason every store serialises its own. */
let persistChain: Promise<void> = Promise.resolve();

/**
 * Register the one adopter for a namespace. Returns an unregister for cleanup.
 *
 * Last registration wins. Two stores claiming one namespace is a bug, but throwing here
 * would take down a screen on a hot reload, and the scope test is what actually holds
 * one suffix to one store.
 */
export function registerSyncAdopter(namespace: SyncNamespace, adopter: SyncAdopter): () => void {
  adopters.set(namespace, adopter);
  return () => {
    if (adopters.get(namespace) === adopter) adopters.delete(namespace);
  };
}

export function adopterFor(namespace: SyncNamespace): SyncAdopter | null {
  return adopters.get(namespace) ?? null;
}

/**
 * A store's disk write succeeded and the account has not seen it yet.
 *
 * Call it *after* the write, never before: a flag raised for a write that then failed
 * would push whatever happened to be on disk, which is the previous value.
 */
export function markDirty(namespace: SyncNamespace): void {
  stamps += 1;
  dirty.set(namespace, stamps);
  persist();
  for (const listener of [...listeners]) {
    try {
      listener(namespace);
    } catch {
      // A listener that throws is the engine's problem, not this store's write.
    }
  }
}

/** Subscribe to local changes. Returns unsubscribe. */
export function onDirty(listener: (namespace: SyncNamespace) => void): () => void {
  listeners.push(listener);
  return () => {
    const at = listeners.indexOf(listener);
    if (at >= 0) listeners.splice(at, 1);
  };
}

/** The stamp of the latest local write to a namespace, or null if it is clean. */
export function dirtyStamp(namespace: SyncNamespace): number | null {
  return dirty.get(namespace) ?? null;
}

/** Everything waiting to be pushed, in the order it was first dirtied. */
export function dirtyNamespaces(): SyncNamespace[] {
  return [...dirty.keys()];
}

/**
 * Clear a namespace, but only if nothing has been written to it since `stamp`.
 *
 * The engine passes the stamp it read before it started pushing. A mismatch means a
 * local write landed mid-flight; the flag stays up and the next cycle carries it.
 */
export function clearDirty(namespace: SyncNamespace, stamp: number): boolean {
  if (dirty.get(namespace) !== stamp) return false;
  dirty.delete(namespace);
  persist();
  return true;
}

/**
 * Bind the dirty set to disk under a key the caller has already resolved.
 *
 * The engine calls this once at start, with the key it already resolved for the account
 * it bound, so a sign-out mid-flight cannot redirect the file to the next learner — the
 * same discipline review/store.ts uses for its deck.
 *
 * Anything already marked in memory survives: this launch's writes are newer than
 * whatever the last launch left behind, so the two are unioned rather than replaced.
 */
export async function attachDirtyStore(store: DirtyStorage, key: string): Promise<void> {
  storage = store;
  stateKey = key;
  let restored: string[] = [];
  try {
    const raw = await store.getItem(key);
    restored = readPersisted(raw);
  } catch {
    // No dirty set on disk, or storage unavailable. The launch reconcile covers it.
  }
  for (const namespace of restored) {
    if (!dirty.has(namespace)) {
      stamps += 1;
      dirty.set(namespace, stamps);
    }
  }
  persist();
}

/** Parse the persisted set defensively. A corrupt file means an empty set, never a throw. */
function readPersisted(raw: string | null): string[] {
  if (raw === null || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
  const record = parsed as Partial<Persisted>;
  if (record.version !== PERSISTED_VERSION || !Array.isArray(record.dirty)) return [];
  return record.dirty.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function persist(): void {
  const store = storage;
  const key = stateKey;
  if (store === null || key === null) return;
  const owner = scopeGeneration();
  const snapshot: Persisted = { version: PERSISTED_VERSION, dirty: [...dirty.keys()] };
  const write = async (): Promise<void> => {
    try {
      if (storage !== store || stateKey !== key) return;
      await writeInUserScope(owner, () => store.setItem(key, JSON.stringify(snapshot)));
    } catch {
      // Storage full or unavailable. The launch reconcile is the backstop.
    }
  };
  persistChain = persistChain.then(write, write);
}

/** Every persist scheduled so far has landed. For tests and for a clean stop. */
export function dirtySettled(): Promise<void> {
  return persistChain;
}

/**
 * Forget everything: adopters, flags and the disk binding.
 *
 * Called on account switch and between tests. Dropping the binding matters more than
 * dropping the flags — a persist that fired after the switch would write one learner's
 * pending namespaces into the next learner's key.
 */
export function resetSyncRegistry(): void {
  adopters.clear();
  dirty.clear();
  listeners.length = 0;
  storage = null;
  stateKey = null;
  stamps = 0;
  persistChain = Promise.resolve();
}
