/**
 * The reconciler: the client `learner_state` has never had.
 *
 * A learner's months of work currently live on exactly one phone. The table has existed
 * since 202608220001 with four proven row level security policies on it and no code that
 * ever writes to it. This is that code.
 *
 * The shape is a **state-based reconciler**, not an operation log. Per namespace: read
 * what is on this device, read what is in the account, merge them under a per-domain
 * policy, write the result back through the store that owns it, and push the whole blob
 * with a compare-and-swap on `learner_state.revision`. Zero rows back from the swap means
 * another device wrote first, so pull, merge and try again. Convergence comes from every
 * merge policy being commutative and idempotent by construction, which is what makes a
 * duplicate push, a replayed retry and a reconnect all harmless without ordering
 * infrastructure.
 *
 * Local first, always. Nothing here is on the path of a learner saving anything: the
 * stores write to disk exactly as they did before, and this runs afterwards, in the
 * background, and is allowed to fail. An engine that cannot reach the network is a
 * learner who can still study.
 *
 * ## Four decisions worth keeping
 *
 * **Everything binds once, at start.** uid, the storage key for every namespace, the
 * token getter, the device id. This is review/store.ts:44-47's discipline applied to a
 * whole subsystem: a sign-out while a retry is queued must never redirect that retry into
 * the next account. A straggler is aimed at the old uid with the old learner's token, and
 * dies at row level security, which is exactly where it should die.
 *
 * **No second Supabase client.** Transport is raw PostgREST over an injected `fetch`,
 * with `apikey` and the learner's own bearer from `auth/supabaseAdapter.ts`'s existing
 * `getAccessToken()`. A `createClient` here would mean a second session store and a
 * second refresh loop running beside the first, racing it for the same refresh token.
 * The learner's JWT *is* the enforcement; routing this through the token server's
 * service role would step around the only security property in this schema that has
 * actually been measured.
 *
 * **The engine never writes a store's key, and never hands a store a finished blob.** It
 * calls an adopter the store registered, with a *fold* the store applies inside its own
 * write chain. Everything this file computes is computed from a world it read before a
 * network round trip; the fold is how that stale answer meets the store's live one
 * without either side being written over. See sync/registry.ts for the whole argument.
 *
 * **Silent without a token.** Mock auth returns null, and then this makes no request at
 * all, so the run-with-no-keys promise holds.
 *
 * The merge policies live in sync/policy.ts and are reached only through `SyncPolicy`
 * below. This file decides *when* to merge and what to do with the answer; it has no
 * opinion about what a profile or a deck means.
 */

import {
  MAX_ENVELOPE_BYTES,
  envelopeBytes,
  parseJson,
  readEnvelope,
  sameData,
  sealEnvelope,
  type EnvelopeRejection,
} from './envelope.ts';
import { createBackoff, type Backoff } from './backoff.ts';
import {
  SYNC_STATE_SUFFIX,
  adopterFor,
  attachDirtyStore,
  clearDirty,
  dirtyNamespaces,
  dirtyStamp,
  onDirty,
  type DirtyStorage,
  type SyncAdoption,
  type SyncFold,
} from './registry.ts';

// ────────────────────────────────────────────────────────────────── the seams

/** The slice of `fetch` this engine uses. A real `fetch` satisfies it. */
export interface SyncRequest {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export interface SyncHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type SyncFetch = (url: string, init: SyncRequest) => Promise<SyncHttpResponse>;

/** The slice of AsyncStorage this engine reads. It never calls `setItem` on a store key. */
export interface SyncStorage extends DirtyStorage {
  getItem(key: string): Promise<string | null>;
}

// ───────────────────────────────────────────────────────── the policy interface

export interface SyncMergeRequest {
  readonly namespace: string;
  /** This device's blob, or null when this device has never written the namespace. */
  readonly local: unknown;
  /** The account's blob, or null when the account has no row for it yet. */
  readonly remote: unknown;
}

export type SyncMergeResult =
  /** The convergent merge of both sides. Idempotent: merging it again changes nothing. */
  | { readonly kind: 'merged'; readonly data: unknown }
  /**
   * Do nothing this cycle, and say why in one closed word.
   *
   * The case this exists for: the account's payload carries an inner schema version
   * newer than this build writes. An older app that merged it would silently drop every
   * field it did not recognise and push the loss to every other device. Going quiet
   * costs this device its sync until it updates; the alternative costs the learner data.
   */
  | { readonly kind: 'quiet'; readonly reason: SyncQuietReason };

export type SyncQuietReason = 'newer-schema' | 'not-synced' | 'unreadable-local';

export interface SyncPolicy {
  /** Every namespace this app syncs. Exclusions are simply absent, with a reason in policy.ts. */
  readonly namespaces: readonly string[];
  merge(request: SyncMergeRequest): SyncMergeResult;
}

// ──────────────────────────────────────────────────────────────── diagnostics

export type SyncPhase = 'pull' | 'merge' | 'adopt' | 'push' | 'cycle';

export type SyncStatus =
  | 'unchanged'
  | 'pushed'
  | 'adopted'
  | 'quiet'
  | 'quarantined'
  | 'refused'
  | 'conflict'
  | 'offline'
  | 'stopped'
  | 'unknown-namespace';

/**
 * Why something happened, from a closed set.
 *
 * Closed on purpose. A free-text `detail` field is how a phrase, a name or half a
 * payload ends up in a log line, and a type that cannot hold learner content is a
 * stronger promise than a rule saying nobody should put it there.
 */
export type SyncCode =
  | EnvelopeRejection
  | SyncQuietReason
  | 'no-token'
  | 'no-adopter'
  | 'over-size-cap'
  | 'stale-revision'
  | 'insert-conflict'
  | 'http-error'
  | 'bad-body'
  | 'network'
  | 'adopter-threw'
  | 'adopter-declined'
  | 'unfolded-adopter';

export interface SyncEvent {
  readonly namespace: string;
  readonly phase: SyncPhase;
  readonly status: SyncStatus;
  readonly attempt: number;
  readonly revision: number | null;
  readonly bytes: number | null;
  readonly code: SyncCode | null;
}

// ──────────────────────────────────────────────────────────────────── results

export interface SyncOutcome {
  readonly namespace: string;
  readonly status: SyncStatus;
  readonly revision: number | null;
  readonly adopted: boolean;
  readonly pushed: boolean;
  readonly attempts: number;
}

export interface SyncRunSummary {
  readonly outcomes: readonly SyncOutcome[];
  /** True when every namespace it looked at finished without a network failure. */
  readonly settled: boolean;
}

// ──────────────────────────────────────────────────────────────────── options

export interface SyncEngineOptions {
  /** The account, bound for the life of this engine. */
  readonly uid: string;
  /** Stable per-install id, for the envelope. Never a learner identifier. */
  readonly deviceId: string;
  /** Supabase project URL, no trailing slash needed. */
  readonly url: string;
  /** The publishable anon key, sent as `apikey`. Not a credential on its own. */
  readonly anonKey: string;
  /** The auth adapter's existing getter. Null means mock auth, and this stays silent. */
  readonly getAccessToken: () => Promise<string | null>;
  readonly fetch: SyncFetch;
  readonly storage: SyncStorage;
  /**
   * Resolve a per-user storage key. Pass `userKey` from storage/scope.ts; every key is
   * resolved once, here, so no later call can land under a different account.
   */
  readonly keyFor: (suffix: string) => string;
  readonly policy: SyncPolicy;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly schedule?: (run: () => void, ms: number) => void;
  readonly record?: (event: SyncEvent) => void;
  /** How many times to lose the compare-and-swap before giving up for this cycle. */
  readonly conflictBudget?: number;
  /** A burst of local writes becomes one push after this quiet period. */
  readonly debounceMs?: number;
}

export interface SyncEngine {
  /** Every namespace, whether or not it is dirty. The launch-time correctness backstop. */
  reconcileAll(): Promise<SyncRunSummary>;
  /** Only what changed since the last successful push. */
  flushDirty(): Promise<SyncRunSummary>;
  reconcile(namespace: string): Promise<SyncOutcome>;
  /** Foreground, or the network came back: clear the backoff and catch up. */
  resume(): void;
  stop(): void;
  stopped(): boolean;
  /** The retry schedule, exposed so a caller can see when the next attempt is due. */
  backoff(): Backoff;
}

const TABLE = 'learner_state';
const DEFAULT_CONFLICT_BUDGET = 3;
const DEFAULT_DEBOUNCE_MS = 1_500;

/**
 * Bind an engine to one account.
 *
 * Started from `SignedInRoot`'s effect after `recoverJournal()`, stopped in its cleanup.
 * Nothing here reaches for the active user again afterwards.
 */
export function startSync(options: SyncEngineOptions): SyncEngine {
  const uid = options.uid;
  const deviceId = options.deviceId;
  const base = options.url.replace(/\/+$/, '');
  const endpoint = `${base}/rest/v1/${TABLE}`;
  const anonKey = options.anonKey;
  const getAccessToken = options.getAccessToken;
  const request = options.fetch;
  const storage = options.storage;
  const policy = options.policy;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const schedule = options.schedule ?? ((run: () => void, ms: number) => void setTimeout(run, ms));
  const record = options.record ?? ((): void => {});
  const conflictBudget = options.conflictBudget ?? DEFAULT_CONFLICT_BUDGET;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  // Every key this engine will ever touch, resolved now, under this uid.
  const keys = new Map<string, string>();
  for (const namespace of policy.namespaces) keys.set(namespace, options.keyFor(namespace));
  const stateKey = options.keyFor(SYNC_STATE_SUFFIX);

  const retry = createBackoff({ random, now });
  /** Namespaces refused for size, held against the write that was too big. */
  const parked = new Map<string, number>();

  let halted = false;
  let cycle: Promise<unknown> = Promise.resolve();
  let wakePending = false;

  /**
   * The dirty set is read back from disk before the first cycle, not alongside it. A
   * launch that reconciled while the restore was still in flight would see an empty set
   * and treat last night's offline edit as nothing to push.
   */
  const restored = attachDirtyStore(storage, stateKey).catch(() => {});

  const unsubscribe = onDirty(() => {
    if (halted || wakePending) return;
    wakePending = true;
    schedule(() => {
      wakePending = false;
      if (!halted) void flushDirty();
    }, debounceMs);
  });

  // ───────────────────────────────────────────────────────────────── transport

  function headers(token: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  /** `user_id=eq.<bound uid>` on every request, under the policies, not instead of them. */
  function scope(namespace: string): string {
    return `user_id=eq.${encodeURIComponent(uid)}&namespace=eq.${encodeURIComponent(namespace)}`;
  }

  type Rows = { readonly kind: 'rows'; readonly rows: readonly Record<string, unknown>[] };
  type Failed = { readonly kind: 'failed'; readonly code: SyncCode; readonly status: number };

  async function send(url: string, init: SyncRequest): Promise<Rows | Failed> {
    let response: SyncHttpResponse;
    try {
      response = await request(url, init);
    } catch {
      return { kind: 'failed', code: 'network', status: 0 };
    }
    if (!response.ok) return { kind: 'failed', code: 'http-error', status: response.status };
    let body: unknown;
    try {
      body = parseJson(await response.text());
    } catch {
      return { kind: 'failed', code: 'bad-body', status: response.status };
    }
    if (body === null) return { kind: 'rows', rows: [] };
    if (!Array.isArray(body)) return { kind: 'failed', code: 'bad-body', status: response.status };
    const rows = body.filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row),
    );
    return { kind: 'rows', rows };
  }

  // ─────────────────────────────────────────────────────────────── one namespace

  interface RemoteRow {
    readonly revision: number;
    readonly payload: unknown;
  }

  function readRow(row: Record<string, unknown>): RemoteRow | null {
    const revision = row.revision;
    if (typeof revision !== 'number' || !Number.isFinite(revision)) return null;
    return { revision, payload: row.payload ?? null };
  }

  async function pull(namespace: string, token: string): Promise<RemoteRow | null | Failed> {
    const result = await send(`${endpoint}?select=payload,revision&${scope(namespace)}&limit=1`, {
      method: 'GET',
      headers: headers(token),
    });
    if (result.kind === 'failed') return result;
    const first = result.rows[0];
    if (first === undefined) return null;
    const row = readRow(first);
    return row ?? { kind: 'failed', code: 'bad-body', status: 200 };
  }

  async function readLocal(key: string): Promise<unknown> {
    try {
      return parseJson(await storage.getItem(key));
    } catch {
      // Storage unavailable this launch. Treated as "this device has nothing to add",
      // which is safe: the merge then adopts the account's state rather than pushing
      // an emptiness that never happened.
      return null;
    }
  }

  function event(
    namespace: string,
    phase: SyncPhase,
    status: SyncStatus,
    attempt: number,
    revision: number | null,
    bytes: number | null,
    code: SyncCode | null,
  ): void {
    try {
      record({ namespace, phase, status, attempt, revision, bytes, code });
    } catch {
      // A diagnostics sink must never be able to fail a sync.
    }
  }

  /**
   * Clear a dirty flag, but only while this engine is still the one running.
   *
   * Two reasons the flag has to be read against `halted`, both of them cross-account.
   * `resetSyncRegistry()` sets the stamp counter back to zero, so a straggler holding
   * stamp 3 from the account that just signed out would clear the *next* account's third
   * write — the flag would go down for a write nobody ever pushed. And a namespace this
   * engine pushed under the old uid says nothing about whether the new one is caught up.
   * Sign-out runs `stop(); resetSyncRegistry(); setActiveUser(null)` in one synchronous
   * turn, so reading the flag here, synchronously, is enough to be on the right side of it.
   */
  function clearIfRunning(namespace: string, stamp: number | null): void {
    if (halted || stamp === null) return;
    clearDirty(namespace, stamp);
  }

  function outcome(
    namespace: string,
    status: SyncStatus,
    revision: number | null,
    adopted: boolean,
    pushed: boolean,
    attempts: number,
  ): SyncOutcome {
    return { namespace, status, revision, adopted, pushed, attempts };
  }

  async function reconcile(namespace: string): Promise<SyncOutcome> {
    if (halted) return outcome(namespace, 'stopped', null, false, false, 0);
    const key = keys.get(namespace);
    if (key === undefined) {
      event(namespace, 'cycle', 'unknown-namespace', 0, null, null, 'not-synced');
      return outcome(namespace, 'unknown-namespace', null, false, false, 0);
    }

    const stampAtPark = parked.get(namespace);
    if (stampAtPark !== undefined && stampAtPark === (dirtyStamp(namespace) ?? 0)) {
      // Same oversized write as last time. Refuse it again without spending a request.
      event(namespace, 'push', 'refused', 0, null, null, 'over-size-cap');
      return outcome(namespace, 'refused', null, false, false, 0);
    }

    const token = await getAccessToken();
    if (token === null || token.length === 0) {
      event(namespace, 'cycle', 'offline', 0, null, null, 'no-token');
      return outcome(namespace, 'offline', null, false, false, 0);
    }

    let adopted = false;
    for (let attempt = 0; attempt <= conflictBudget; attempt += 1) {
      if (halted) return outcome(namespace, 'stopped', null, adopted, false, attempt);

      // Read the flag *before* the local blob, so a write that lands during this cycle
      // leaves a newer stamp behind and the flag survives the clear at the end.
      const stamp = dirtyStamp(namespace);
      const local = await readLocal(key);

      const pulled = await pull(namespace, token);
      if (pulled !== null && 'kind' in pulled) {
        event(namespace, 'pull', 'offline', attempt, null, null, pulled.code);
        return outcome(namespace, 'offline', null, adopted, false, attempt);
      }

      let remote: unknown = null;
      let quarantined = false;
      if (pulled !== null) {
        const reading = readEnvelope(pulled.payload);
        if (reading.ok) remote = reading.envelope.data;
        else {
          // The account's payload is not something this app can read. Do not merge it,
          // do not adopt it, and above all do not let it reach a store: an unreadable
          // blob has no claim on data this device can read.
          quarantined = true;
          event(namespace, 'pull', 'quarantined', attempt, pulled.revision, null, reading.reason);
        }
      }

      if (quarantined && local === null) {
        // Nothing here to repair it with. Leave the row exactly as it is, so an operator
        // still has whatever it holds, and let another device push over it.
        return outcome(namespace, 'quarantined', pulled === null ? null : pulled.revision, false, false, attempt);
      }

      const result: SyncMergeResult = quarantined
        ? { kind: 'merged', data: local }
        : policy.merge({ namespace, local, remote });
      if (result.kind === 'quiet') {
        event(namespace, 'merge', 'quiet', attempt, pulled === null ? null : pulled.revision, null, result.reason);
        return outcome(namespace, 'quiet', pulled === null ? null : pulled.revision, adopted, false, attempt);
      }
      let merged = result.data;

      if (!sameData(merged, local)) {
        // The last synchronous instant before this engine touches a store, and the only
        // place a `halted` check closes the account-switch window. Sign-out cleanup runs
        // `stop(); resetSyncRegistry(); setActiveUser(null)` in one turn, and the reset
        // hooks re-register every adopter under the *next* account — so an adopter
        // resolved after that point writes this learner's data into the next learner's
        // key. Nothing between here and the call below awaits, so nothing can change
        // underneath the check.
        if (halted) return outcome(namespace, 'stopped', null, adopted, false, attempt);
        const adopter = adopterFor(namespace);
        if (adopter === null) {
          // The store has not registered yet (a screen not mounted, a launch mid-boot).
          // Pushing the merge is still right — it is a superset — and this device picks
          // the merged value up on the next cycle once the store is there.
          event(namespace, 'adopt', 'unchanged', attempt, null, null, 'no-adopter');
        } else {
          const incoming = merged;
          // A holder rather than a `let`: the fold assigns from inside a closure, and a
          // narrowed `let` would read as `null` forever at the check after the await.
          const folded = { done: false, value: null as unknown };
          const fold: SyncFold = (current: unknown): unknown => {
            // This runs inside the store's write chain, with what the store holds *now*
            // — which may be newer than the `local` this cycle read before the pull.
            // Merging against `current` rather than replacing it is what keeps a write
            // that landed during the round trip.
            if (halted) return current;
            const again = policy.merge({ namespace, local: current, remote: incoming });
            // A policy that goes quiet on the store's own current state has no business
            // rewriting it. Handing `current` straight back is a write the store can
            // skip, and never a loss.
            const next = again.kind === 'merged' ? again.data : current;
            folded.done = true;
            folded.value = next;
            return next;
          };
          let reply: SyncAdoption;
          try {
            reply = await adopter(fold);
          } catch {
            event(namespace, 'adopt', 'offline', attempt, null, null, 'adopter-threw');
            return outcome(namespace, 'offline', null, false, false, attempt);
          }
          if (halted) return outcome(namespace, 'stopped', null, adopted, false, attempt);
          if (reply === 'declined') {
            // The store looked at the folded value and kept its own. Nothing is on disk
            // that was not there before, so there is nothing new to push either.
            event(namespace, 'adopt', 'unchanged', attempt, null, null, 'adopter-declined');
          } else if (!folded.done) {
            // An adopter that never folded wrote over its own state with a value computed
            // before the pull. That is precisely the defect the fold exists to prevent, so
            // it gets a line of its own rather than passing for a healthy adoption.
            adopted = true;
            event(namespace, 'adopt', 'adopted', attempt, null, null, 'unfolded-adopter');
          } else {
            // What the store now holds is what the account should hold. Pushing the fold
            // rather than the merge is what makes a mid-adoption write reach the account
            // in this cycle instead of the next one.
            merged = folded.value;
            adopted = true;
            event(namespace, 'adopt', 'adopted', attempt, null, null, null);
          }
        }
      }

      // A store that is empty here and absent there has nothing to say. Creating a row
      // for it would be a launch spending a write per unused namespace, forever.
      const needsPush =
        pulled === null ? !sameData(merged, null) : quarantined || !sameData(merged, remote);
      if (!needsPush) {
        clearIfRunning(namespace, stamp);
        const status: SyncStatus = adopted ? 'adopted' : 'unchanged';
        const revision = pulled === null ? null : pulled.revision;
        event(namespace, 'cycle', status, attempt, revision, null, null);
        return outcome(namespace, status, revision, adopted, false, attempt);
      }

      const envelope = sealEnvelope(merged, deviceId, now());
      const bytes = envelopeBytes(envelope);
      if (bytes === null || bytes > MAX_ENVELOPE_BYTES) {
        // Never truncated. Half a deck pushed as if it were the whole deck would converge
        // every other device down to the same half, permanently.
        parked.set(namespace, dirtyStamp(namespace) ?? 0);
        event(namespace, 'push', 'refused', attempt, pulled === null ? null : pulled.revision, bytes, 'over-size-cap');
        return outcome(namespace, 'refused', pulled === null ? null : pulled.revision, adopted, false, attempt);
      }
      parked.delete(namespace);

      if (halted) return outcome(namespace, 'stopped', null, adopted, false, attempt);
      const written =
        pulled === null
          ? await send(`${endpoint}?select=revision`, {
              method: 'POST',
              headers: headers(token, { Prefer: 'return=representation' }),
              body: JSON.stringify([{ user_id: uid, namespace, payload: envelope }]),
            })
          : await send(`${endpoint}?${scope(namespace)}&revision=eq.${pulled.revision}&select=revision`, {
              method: 'PATCH',
              headers: headers(token, { Prefer: 'return=representation' }),
              body: JSON.stringify({ payload: envelope, revision: pulled.revision + 1 }),
            });

      if (written.kind === 'failed') {
        // 409 on the insert means another device created the row between the pull and
        // the push. That is the same race as a lost compare-and-swap, so it takes the
        // same path: pull again and merge what is now there.
        if (written.status === 409) {
          event(namespace, 'push', 'conflict', attempt, null, bytes, 'insert-conflict');
          continue;
        }
        event(namespace, 'push', 'offline', attempt, null, bytes, written.code);
        return outcome(namespace, 'offline', null, adopted, false, attempt);
      }

      const landed = written.rows[0];
      if (landed === undefined) {
        // Zero rows changed: the revision moved under us. Somebody else won.
        event(namespace, 'push', 'conflict', attempt, pulled === null ? null : pulled.revision, bytes, 'stale-revision');
        continue;
      }

      const revision = readRow(landed)?.revision ?? null;
      clearIfRunning(namespace, stamp);
      const status: SyncStatus = quarantined ? 'quarantined' : adopted ? 'adopted' : 'pushed';
      event(namespace, 'push', status, attempt, revision, bytes, null);
      return outcome(namespace, status, revision, adopted, true, attempt);
    }

    event(namespace, 'cycle', 'conflict', conflictBudget, null, null, 'stale-revision');
    return outcome(namespace, 'conflict', null, adopted, false, conflictBudget);
  }

  // ─────────────────────────────────────────────────────────────────── cycles

  async function run(namespaces: readonly string[]): Promise<SyncRunSummary> {
    const outcomes: SyncOutcome[] = [];
    let settled = true;
    for (const namespace of namespaces) {
      if (halted) break;
      const result = await reconcile(namespace);
      outcomes.push(result);
      if (result.status === 'offline' || result.status === 'conflict') settled = false;
    }
    if (settled) retry.succeeded();
    else {
      const delay = retry.failed();
      if (!halted) schedule(() => void flushDirty(), delay);
    }
    return { outcomes, settled };
  }

  /** One cycle at a time. Two overlapping cycles would fight over the same revisions. */
  function queue(namespaces: () => readonly string[]): Promise<SyncRunSummary> {
    const start = async (): Promise<SyncRunSummary> => {
      await restored;
      return run(namespaces());
    };
    const next = cycle.then(start, start);
    cycle = next.catch(() => {});
    return next;
  }

  function reconcileAll(): Promise<SyncRunSummary> {
    // A full pass is the backstop that makes the dirty set an optimisation: a crash
    // between a store's write and the flag reaching disk costs one launch, never data.
    parked.clear();
    return queue(() => policy.namespaces);
  }

  function flushDirty(): Promise<SyncRunSummary> {
    if (!retry.ready()) return Promise.resolve({ outcomes: [], settled: false });
    return queue(() => {
      const synced = new Set(policy.namespaces);
      return dirtyNamespaces().filter((namespace) => synced.has(namespace));
    });
  }

  return {
    reconcileAll,
    flushDirty,
    reconcile: (namespace: string) => queue(() => [namespace]).then((summary) =>
      summary.outcomes[0] ?? outcome(namespace, 'stopped', null, false, false, 0),
    ),
    resume(): void {
      if (halted) return;
      retry.resumed();
      parked.clear();
      void flushDirty();
    },
    stop(): void {
      halted = true;
      unsubscribe();
    },
    stopped: () => halted,
    backoff: () => retry,
  };
}
