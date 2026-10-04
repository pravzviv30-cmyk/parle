/**
 * The reconciler, against a PostgREST that behaves like the real one.
 *
 * The fake below is not a stub that returns what the engine wants. It implements the
 * three things `learner_state` actually does — row level security on `user_id`, a unique
 * `(user_id, namespace)`, and the BEFORE UPDATE trigger from
 * `supabase/migrations/202608260001_learner_state_revision.sql` — and the first test
 * reads that migration off disk and holds the fake to it. Without that, every test here
 * would be proving something about a mock.
 *
 * What is deliberately not proved here: that the live project behaves this way. That is
 * F91's harness against two real accounts. This file proves the client half, in
 * milliseconds, on every commit.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MAX_ENVELOPE_BYTES, readEnvelope, sealEnvelope } from './envelope.ts';
import {
  startSync,
  type SyncEngineOptions,
  type SyncEvent,
  type SyncFetch,
  type SyncHttpResponse,
  type SyncPolicy,
} from './engine.ts';
import {
  markDirty,
  registerSyncAdopter,
  resetSyncRegistry,
  dirtyNamespaces,
  dirtySettled,
  dirtyStamp,
} from './registry.ts';

const MIGRATION = readFileSync(
  new URL('../../../../supabase/migrations/202608260001_learner_state_revision.sql', import.meta.url),
  'utf8',
);

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

// ─────────────────────────────────────────────────────────── a fake learner_state

interface FakeRow {
  user_id: string;
  namespace: string;
  payload: unknown;
  revision: number;
}

interface SeenRequest {
  method: string;
  url: string;
  body: string | undefined;
  token: string;
}

function createRest() {
  const rows = new Map<string, FakeRow>();
  const tokens = new Map<string, string>();
  const requests: SeenRequest[] = [];
  const control = {
    offline: false,
    holdWhen: null as null | ((request: SeenRequest) => boolean),
    release: (): void => {},
  };

  const rowKey = (uid: string, namespace: string): string => `${uid}\u0000${namespace}`;
  const eq = (raw: string | null): string | null =>
    raw !== null && raw.startsWith('eq.') ? raw.slice(3) : null;
  const respond = (status: number, body: unknown): SyncHttpResponse => ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });

  const fetchImpl: SyncFetch = async (url, init) => {
    const token = (init.headers.Authorization ?? '').replace(/^Bearer /, '');
    const seen: SeenRequest = { method: init.method, url, body: init.body, token };
    requests.push(seen);
    if (control.offline) throw new Error('network unreachable');
    if (control.holdWhen?.(seen)) {
      control.holdWhen = null;
      await new Promise<void>((resolve) => {
        control.release = resolve;
      });
    }

    // Resolved after the hold, not before: a token can be revoked while a request is
    // already on the wire, and that is exactly the case the sign-out test needs.
    const caller = tokens.get(token) ?? null;
    if (caller === null) return respond(401, { message: 'invalid token' });

    const query = new URLSearchParams(url.split('?')[1] ?? '');

    if (init.method === 'POST') {
      const items = JSON.parse(init.body ?? '[]') as FakeRow[];
      const item = items[0];
      if (item === undefined) return respond(400, { message: 'empty insert' });
      // `with check (auth.uid() = user_id)` — a forged user_id is refused, not ignored.
      if (item.user_id !== caller) return respond(403, { message: 'row level security' });
      const key = rowKey(item.user_id, item.namespace);
      if (rows.has(key)) return respond(409, { message: 'duplicate key value violates unique constraint' });
      rows.set(key, { user_id: item.user_id, namespace: item.namespace, payload: item.payload, revision: 0 });
      return respond(201, [{ revision: 0 }]);
    }

    const uid = eq(query.get('user_id'));
    const namespace = eq(query.get('namespace'));
    if (uid === null || namespace === null) return respond(400, { message: 'missing filter' });
    const row = rows.get(rowKey(uid, namespace));
    // `using (auth.uid() = user_id)` — another account's row is not visible at all.
    const visible = row !== undefined && row.user_id === caller;

    if (init.method === 'GET') {
      return respond(200, visible ? [{ payload: row.payload, revision: row.revision }] : []);
    }

    if (init.method === 'PATCH') {
      const wanted = eq(query.get('revision'));
      if (!visible || String(row.revision) !== wanted) return respond(200, []);
      const body = JSON.parse(init.body ?? '{}') as { payload: unknown; revision?: number };
      row.payload = body.payload;
      // The trigger, not the client. Whatever `revision` the body carried is discarded.
      row.revision += 1;
      return respond(200, [{ revision: row.revision }]);
    }

    return respond(405, { message: 'not allowed' });
  };

  return { fetch: fetchImpl, rows, tokens, requests, control, rowKey };
}

type Rest = ReturnType<typeof createRest>;

// ───────────────────────────────────────────────────────────────── device storage

function createStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem: (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null),
    setItem: (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    },
  };
}

type Storage = ReturnType<typeof createStorage>;

// ─────────────────────────────────────────────────────────────────── test policy

interface Card {
  id: string;
  reps: number;
}

/**
 * Union by id, keeping the higher rep count. Commutative and idempotent, which is the
 * only property the engine relies on. The real table of policies is sync/policy.ts.
 */
const deckPolicy: SyncPolicy = {
  namespaces: ['review', 'profile'],
  merge({ local, remote }) {
    if (local === null && remote === null) return { kind: 'merged', data: null };
    const merged = new Map<string, Card>();
    for (const side of [remote, local]) {
      if (!Array.isArray(side)) continue;
      for (const item of side as Card[]) {
        if (item === null || typeof item !== 'object' || typeof item.id !== 'string') continue;
        const seen = merged.get(item.id);
        merged.set(item.id, seen ? { id: item.id, reps: Math.max(seen.reps, item.reps) } : item);
      }
    }
    return { kind: 'merged', data: [...merged.values()].sort((a, b) => (a.id < b.id ? -1 : 1)) };
  },
};

/** For the size test, where the blob is one enormous object rather than a deck. */
const wholeBlobPolicy: SyncPolicy = {
  namespaces: ['profile'],
  merge: ({ local, remote }) => ({ kind: 'merged', data: local ?? remote ?? null }),
};

/** The rule that protects a newer app's payload from an older one. */
const shyPolicy: SyncPolicy = {
  namespaces: ['review'],
  merge: () => ({ kind: 'quiet', reason: 'newer-schema' }),
};

// ────────────────────────────────────────────────────────────────────── plumbing

function manualScheduler() {
  const queued: (() => void)[] = [];
  return {
    schedule: (run: () => void): void => {
      queued.push(run);
    },
    queued,
  };
}

const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

async function until(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(`timed out waiting for ${label}`);
}

const keyFor = (uid: string) => (suffix: string) => `luvani.u.${uid}.${suffix}`;

function engineFor(
  rest: Rest,
  storage: Storage,
  uid: string,
  token: string | null,
  overrides: Partial<SyncEngineOptions> = {},
) {
  const events: SyncEvent[] = [];
  const scheduler = manualScheduler();
  const engine = startSync({
    uid,
    deviceId: `device-${uid.slice(0, 4)}`,
    url: 'https://project.supabase.co',
    anonKey: 'anon-publishable-key',
    getAccessToken: () => Promise.resolve(token),
    fetch: rest.fetch,
    storage,
    keyFor: keyFor(uid),
    policy: deckPolicy,
    now: () => 1_700_000_000_000,
    random: () => 0.5,
    schedule: scheduler.schedule,
    record: (event) => events.push(event),
    ...overrides,
  });
  return { engine, events, scheduler };
}

// ───────────────────────────────────────────────────────────── a folding store

interface FoldCall {
  /** What the store held when the fold ran. */
  readonly current: unknown;
  /** What the fold said to write. */
  readonly next: unknown;
}

interface StoreOptions {
  /** Hold the adopter here, to model a store whose write chain is already busy. */
  readonly waitFor?: Promise<void>;
  /** Fold twice. The policies are idempotent, so this must land the same value as once. */
  readonly twice?: boolean;
  /** Read the folded value and keep the store's own instead. */
  readonly decline?: boolean;
  /** Never call the fold, and write this instead — F93's defect, kept so a test can name it. */
  readonly blindly?: unknown;
}

/**
 * A store the way the app's stores work: one key, one cache, and a read-fold-write with
 * nothing awaited in between. That last part is the whole point — a real store gets it
 * from its serialised promise chain, and this gets it from being synchronous.
 */
function foldingStore(storage: Storage, key: string, namespace: string, options: StoreOptions = {}): FoldCall[] {
  const folds: FoldCall[] = [];
  registerSyncAdopter(namespace, async (fold) => {
    if (options.waitFor !== undefined) await options.waitFor;
    if ('blindly' in options) {
      await storage.setItem(key, JSON.stringify(options.blindly));
      return 'adopted';
    }
    const raw = storage.map.get(key);
    const current = raw === undefined ? null : (JSON.parse(raw) as unknown);
    let next = fold(current);
    folds.push({ current, next });
    if (options.twice === true) {
      const again = fold(next);
      folds.push({ current: next, next: again });
      next = again;
    }
    if (options.decline === true) return 'declined';
    await storage.setItem(key, JSON.stringify(next));
    return 'adopted';
  });
  return folds;
}

function payloadOf(rest: Rest, uid: string, namespace: string): unknown {
  const row = rest.rows.get(rest.rowKey(uid, namespace));
  if (row === undefined) return undefined;
  const reading = readEnvelope(row.payload);
  return reading.ok ? reading.envelope.data : { unreadable: true };
}

beforeEach(() => {
  resetSyncRegistry();
});

test('blackholed headers or body expire and the next healthy reconciliation runs', async () => {
  for (const stall of ['headers', 'body']) {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    let first = true;
    let signal: AbortSignal | undefined;
    const { engine } = engineFor(rest, createStorage(), ALICE, 'alice-jwt', {
      requestTimeoutMs: 10,
      fetch: async (url, init) => {
        if (!first) return rest.fetch(url, init);
        first = false; signal = init.signal;
        if (stall === 'headers') return new Promise(() => {});
        return { ok: true, status: 200, text: () => new Promise(() => {}) };
      },
    });
    assert.equal((await engine.reconcile('review')).status, 'offline');
    assert.equal(signal?.aborted, true);
    const healthy = await engine.reconcile('review');
    assert.notEqual(healthy.status, 'offline');
    engine.stop();
  }
});
test('account stop aborts an ignoring adapter and releases the cycle without adopting', async () => {
  const rest = createRest();
  let signal: AbortSignal | undefined;
  const { engine } = engineFor(rest, createStorage(), ALICE, 'alice-jwt', {
    fetch: async (_url, init) => { signal = init.signal; return new Promise(() => {}); },
  });
  const pending = engine.reconcile('review');
  await until(() => signal !== undefined, 'request signal');
  engine.stop();
  assert.equal((await pending).status, 'stopped');
  assert.equal(signal?.aborted, true);
});

// ────────────────────────────────────────────────────────────────────── the tests

describe('the sync engine — one account, many devices', () => {
  test('a stale-revision update changes no rows and a current one advances it by exactly one', async () => {
    // First: the fake is held to the migration, so nothing below is a proof about a mock.
    assert.match(MIGRATION, /add column if not exists revision bigint not null default 0/i);
    assert.match(MIGRATION, /new\.revision := old\.revision \+ 1;/);
    assert.match(MIGRATION, /before update on public\.learner_state/i);
    assert.match(MIGRATION, /create or replace trigger learner_state_revision_bump/i);
    assert.doesNotMatch(
      MIGRATION,
      /drop policy|create policy|alter table public\.learner_state (disable|enable) row level security/i,
      'the migration touched the row level security this schema is measured on',
    );

    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const storage = createStorage({ [`luvani.u.${ALICE}.review`]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt');

    // The first push creates the row at revision 0.
    const created = await engine.reconcile('review');
    assert.equal(created.status, 'pushed');
    assert.equal(created.revision, 0);

    // A current revision matches exactly one row and comes back one higher.
    const current = await rest.fetch(
      `https://project.supabase.co/rest/v1/learner_state?user_id=eq.${ALICE}&namespace=eq.review&revision=eq.0&select=revision`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer alice-jwt' },
        body: JSON.stringify({ payload: sealEnvelope([{ id: 'b', reps: 1 }], 'device-x', 1), revision: 99 }),
      },
    );
    assert.deepEqual(JSON.parse(await current.text()) as unknown, [{ revision: 1 }], 'a current revision advanced by one');
    assert.equal(
      rest.rows.get(rest.rowKey(ALICE, 'review'))?.revision,
      1,
      'the database decides the next revision, so a client that sent 99 does not get 99',
    );

    // A stale revision matches nothing. Zero rows back is the whole conflict signal.
    const stale = await rest.fetch(
      `https://project.supabase.co/rest/v1/learner_state?user_id=eq.${ALICE}&namespace=eq.review&revision=eq.0&select=revision`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer alice-jwt' },
        body: JSON.stringify({ payload: sealEnvelope([{ id: 'c', reps: 9 }], 'device-x', 2), revision: 1 }),
      },
    );
    assert.deepEqual(JSON.parse(await stale.text()) as unknown, [], 'a stale revision changed a row');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))?.revision, 1, 'the row moved on a stale update');
    assert.deepEqual(payloadOf(rest, ALICE, 'review'), [{ id: 'b', reps: 1 }], 'a stale update overwrote the payload');

    // And the engine really does send the swap that way round.
    const patches = rest.requests.filter((request) => request.method === 'PATCH' && request.token === 'alice-jwt');
    markDirty('review');
    await storage.setItem(`luvani.u.${ALICE}.review`, JSON.stringify([{ id: 'a', reps: 4 }]));
    await engine.reconcile('review');
    const sent = rest.requests.filter((request) => request.method === 'PATCH').slice(patches.length);
    assert.equal(sent.length >= 1, true, 'the engine never sent a compare-and-swap');
    assert.match(sent[0]!.url, /revision=eq\.1/, 'the engine did not pin the revision it read');
    assert.match(sent[0]!.url, new RegExp(`user_id=eq\\.${ALICE}`), 'the engine did not pin its own uid');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))?.revision, 2, 'the successful swap did not advance by one');
  });

  test('a duplicate push of the same envelope converges without double-applying anything', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'a', reps: 2 }]) });
    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt');

    const first = await engine.reconcile('review');
    assert.equal(first.status, 'pushed');
    const afterFirst = rest.rows.get(rest.rowKey(ALICE, 'review'))!;
    assert.equal(afterFirst.revision, 0);

    // Same device, same blob, nothing changed. A reconciler that pushed unconditionally
    // would advance the revision on every launch and make every other device conflict.
    const writesBefore = rest.requests.filter((request) => request.method !== 'GET').length;
    const second = await engine.reconcile('review');
    assert.equal(second.status, 'unchanged');
    assert.equal(second.pushed, false);
    assert.equal(
      rest.requests.filter((request) => request.method !== 'GET').length,
      writesBefore,
      'an unchanged namespace still spent a write',
    );
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 0, 'a no-op push advanced the revision');

    // Now the literal case: the exact same envelope delivered twice, as a retry that in
    // fact landed the first time. The second delivery pins a revision that has moved, so
    // it changes nothing at all.
    const envelope = sealEnvelope([{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }], 'device-a', 1);
    const url = `https://project.supabase.co/rest/v1/learner_state?user_id=eq.${ALICE}&namespace=eq.review&revision=eq.0&select=revision`;
    const init = {
      method: 'PATCH',
      headers: { Authorization: 'Bearer alice-jwt' },
      body: JSON.stringify({ payload: envelope, revision: 1 }),
    };
    const landed = JSON.parse(await (await rest.fetch(url, init)).text()) as unknown[];
    const replayed = JSON.parse(await (await rest.fetch(url, init)).text()) as unknown[];
    assert.deepEqual(landed, [{ revision: 1 }]);
    assert.deepEqual(replayed, [], 'the duplicate was applied a second time');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 1, 'one envelope, one revision');
    assert.deepEqual(
      payloadOf(rest, ALICE, 'review'),
      [{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }],
      'the duplicate doubled the contents',
    );

    // And the merge itself is idempotent, which is what makes all of the above safe:
    // reconciling again after the duplicate adds nothing and pushes nothing.
    await storage.setItem(key, JSON.stringify([{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }]));
    const third = await engine.reconcile('review');
    assert.equal(third.status, 'unchanged');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 1);
  });

  test('a corrupted server envelope is quarantined and never overwrites local data', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;
    const local = [{ id: 'a', reps: 3 }];
    const storage = createStorage({ [key]: JSON.stringify(local) });

    // What a service-role paste, a half-finished write or a future format looks like.
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: { totally: 'not an envelope' },
      revision: 7,
    });

    const adopted = foldingStore(storage, key, 'review');

    const { engine, events } = engineFor(rest, storage, ALICE, 'alice-jwt');
    const outcome = await engine.reconcile('review');

    assert.equal(outcome.status, 'quarantined');
    assert.deepEqual(adopted, [], 'an unreadable payload reached a store');
    assert.deepEqual(
      JSON.parse(storage.map.get(key)!) as unknown,
      local,
      'the device lost data to a payload it could not even read',
    );
    const quarantine = events.find((event) => event.status === 'quarantined');
    assert.equal(quarantine?.code, 'unknown-envelope-version', 'a bare store blob with no envelope around it');
    assert.equal(quarantine?.revision, 7);
    assert.equal(
      Object.values(quarantine ?? {}).some((value) => JSON.stringify(value).includes('not an envelope')),
      false,
      'the diagnostic quoted the payload it was complaining about',
    );

    // The row is repaired from the good side, under the swap, so the revision advances once.
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 8);
    assert.deepEqual(payloadOf(rest, ALICE, 'review'), local);

    // And the other half: a device with nothing of its own leaves the bad row alone
    // rather than replacing something it cannot read with nothing at all.
    resetSyncRegistry();
    rest.rows.set(rest.rowKey(ALICE, 'profile'), {
      user_id: ALICE,
      namespace: 'profile',
      payload: 'a bare string',
      revision: 2,
    });
    const empty = createStorage();
    const second = engineFor(rest, empty, ALICE, 'alice-jwt');
    const outcomeTwo = await second.engine.reconcile('profile');
    assert.equal(outcomeTwo.status, 'quarantined');
    assert.equal(outcomeTwo.pushed, false);
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'profile'))!.revision, 2, 'an empty device overwrote a row it could not read');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'profile'))!.payload, 'a bare string');
  });

  test('a push in flight during sign-out never writes under the next account', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    rest.tokens.set('bob-jwt', BOB);
    const key = `luvani.u.${ALICE}.review`;
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'a', reps: 5 }]) });
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'a', reps: 1 }], 'device-old', 1),
      revision: 4,
    });

    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt');
    rest.control.holdWhen = (request) => request.method === 'PATCH';
    const inFlight = engine.reconcile('review');
    await until(() => rest.requests.some((request) => request.method === 'PATCH'), 'the push to be on the wire');

    // The learner signs out. The engine stops, and Supabase revokes the session — so the
    // request already on the wire is now carrying a dead token.
    engine.stop();
    rest.tokens.delete('alice-jwt');
    rest.control.release();
    const outcome = await inFlight;
    assert.equal(outcome.pushed, false, 'a straggling push landed after sign-out');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 4, 'the straggler moved a row');

    // Bob signs in on the same phone and gets his own engine, his own uid, his own keys.
    const bobStorage = createStorage({ [`luvani.u.${BOB}.review`]: JSON.stringify([{ id: 'b', reps: 1 }]) });
    const bob = engineFor(rest, bobStorage, BOB, 'bob-jwt');
    const bobOutcome = await bob.engine.reconcile('review');
    assert.equal(bobOutcome.status, 'pushed');
    assert.deepEqual(payloadOf(rest, BOB, 'review'), [{ id: 'b', reps: 1 }], "bob's own row is missing");
    assert.deepEqual(
      payloadOf(rest, ALICE, 'review'),
      [{ id: 'a', reps: 1 }],
      "alice's row changed while bob was signed in",
    );

    // Every request the first engine ever made was aimed at the account it bound at start.
    const aliceRequests = rest.requests.filter((request) => request.token === 'alice-jwt');
    assert.equal(aliceRequests.length > 0, true);
    for (const request of aliceRequests) {
      const targetsAlice = request.url.includes(`user_id=eq.${ALICE}`) || (request.body ?? '').includes(ALICE);
      assert.equal(targetsAlice, true, `a request left without pinning the bound uid: ${request.method}`);
      assert.equal(request.url.includes(BOB), false, "a request from alice's engine named bob");
      assert.equal((request.body ?? '').includes(BOB), false, "a request body from alice's engine named bob");
    }

    // And a stopped engine is stopped: nothing it is asked to do afterwards reaches the network.
    const before = rest.requests.length;
    const after = await engine.reconcile('review');
    assert.equal(after.status, 'stopped');
    assert.equal(rest.requests.length, before, 'a stopped engine made a request');
  });

  test('an envelope over the size cap is refused with a diagnostic and never truncated', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.profile`;
    const oversized = { version: 1, notes: 'x'.repeat(MAX_ENVELOPE_BYTES) };
    const storage = createStorage({ [key]: JSON.stringify(oversized) });

    const { engine, events } = engineFor(rest, storage, ALICE, 'alice-jwt', { policy: wholeBlobPolicy });
    const outcome = await engine.reconcile('profile');

    assert.equal(outcome.status, 'refused');
    assert.equal(outcome.pushed, false);
    assert.equal(rest.requests.some((request) => request.method !== 'GET'), false, 'an oversized payload was sent anyway');
    assert.equal(rest.rows.size, 0, 'a refused payload created a row');

    const refusal = events.find((event) => event.status === 'refused');
    assert.equal(refusal?.code, 'over-size-cap');
    assert.equal(refusal?.namespace, 'profile');
    assert.equal((refusal?.bytes ?? 0) > MAX_ENVELOPE_BYTES, true, 'the diagnostic does not say how big it was');
    assert.equal(
      JSON.stringify(refusal).includes('xxx'),
      false,
      'the diagnostic carried the payload it was refusing',
    );

    // Nothing was trimmed to fit. Half a store pushed as if it were all of it would
    // converge every other device down to the same half, permanently.
    assert.deepEqual(JSON.parse(storage.map.get(key)!) as unknown, oversized, 'the local blob was edited to fit');

    // It stays parked while the same write is pending, rather than retrying forever.
    const spent = rest.requests.length;
    const again = await engine.reconcile('profile');
    assert.equal(again.status, 'refused');
    assert.equal(rest.requests.length, spent, 'a parked namespace kept spending requests');

    // And it is retried once the store has written something new.
    await storage.setItem(key, JSON.stringify({ version: 1, notes: 'small again' }));
    markDirty('profile');
    const recovered = await engine.reconcile('profile');
    assert.equal(recovered.status, 'pushed');
    assert.deepEqual(payloadOf(rest, ALICE, 'profile'), { version: 1, notes: 'small again' });
  });

  test('mock auth has no token, so the engine never touches the network', async () => {
    const rest = createRest();
    const storage = createStorage({ [`luvani.u.${ALICE}.review`]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    const { engine, events } = engineFor(rest, storage, ALICE, null);

    const summary = await engine.reconcileAll();
    assert.equal(rest.requests.length, 0, 'the run-with-no-keys promise made a request');
    assert.deepEqual(
      summary.outcomes.map((outcome) => outcome.status),
      ['offline', 'offline'],
    );
    assert.equal(events.every((event) => event.code === 'no-token'), true);
  });

  test('merged state reaches a store through its adopter, never by writing its key', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'local', reps: 1 }]) });
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'account', reps: 2 }], 'device-b', 1),
      revision: 0,
    });

    // No adopter yet: the engine must not write the key itself, whatever that costs it.
    const first = engineFor(rest, storage, ALICE, 'alice-jwt');
    const withoutAdopter = await first.engine.reconcile('review');
    assert.equal(withoutAdopter.adopted, false);
    assert.deepEqual(
      JSON.parse(storage.map.get(key)!) as unknown,
      [{ id: 'local', reps: 1 }],
      'the engine wrote a store key behind the store back',
    );
    assert.equal(
      first.events.some((event) => event.code === 'no-adopter'),
      true,
      'skipping adoption was not reported',
    );
    assert.deepEqual(
      payloadOf(rest, ALICE, 'review'),
      [{ id: 'account', reps: 2 }, { id: 'local', reps: 1 }],
      'the merge was still pushed, so nothing is lost while a store is not mounted',
    );

    // Now the store registers, the way it would from its module body on next launch.
    const through = foldingStore(storage, key, 'review');
    const second = engineFor(rest, storage, ALICE, 'alice-jwt');
    const adopted = await second.engine.reconcile('review');
    assert.equal(adopted.adopted, true);
    assert.equal(through.length, 1, 'adoption did not go through the store');
    assert.deepEqual(JSON.parse(storage.map.get(key)!) as unknown, [
      { id: 'account', reps: 2 },
      { id: 'local', reps: 1 },
    ]);
  });

  test('a local write that lands while a merge is being adopted survives the adoption', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;

    // The phone holds one card. The tablet pushed two, and the phone has not seen the
    // second one yet — the ordinary state of two devices.
    const phone = createStorage({ [key]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'a', reps: 1 }, { id: 'b', reps: 1 }], 'device-tablet', 1),
      revision: 0,
    });

    const folds = foldingStore(phone, key, 'review');
    const { engine } = engineFor(rest, phone, ALICE, 'alice-jwt');

    // The cycle has read the disk and is waiting on the pull. The learner grades card A
    // while the round trip is in the air, and the store's own chain puts reps 2 on disk
    // before the merge — computed from reps 1 — comes back to be adopted.
    rest.control.holdWhen = (request) => request.method === 'GET';
    const inFlight = engine.reconcile('review');
    await until(() => rest.requests.some((request) => request.method === 'GET'), 'the pull to be on the wire');
    await phone.setItem(key, JSON.stringify([{ id: 'a', reps: 2 }]));
    markDirty('review');
    rest.control.release();
    const outcome = await inFlight;

    assert.equal(outcome.adopted, true, 'the account never reached the store at all');
    assert.deepEqual(
      folds,
      [{ current: [{ id: 'a', reps: 2 }], next: [{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }] }],
      'the store was folded against a world older than the one it was holding',
    );
    assert.deepEqual(
      JSON.parse(phone.map.get(key)!) as unknown,
      [{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }],
      'the grade made during the pull was written over by the adoption',
    );

    // And it reaches the account in this cycle, because what gets pushed is what the
    // store now holds rather than the merge computed before the grade existed.
    assert.deepEqual(payloadOf(rest, ALICE, 'review'), [{ id: 'a', reps: 2 }, { id: 'b', reps: 1 }]);

    // The flag stays up regardless — the grade left a newer stamp than the one this
    // cycle was carrying — and the cycle after it finds nothing left to do.
    await dirtySettled();
    assert.deepEqual(dirtyNamespaces(), ['review'], 'a write made mid-cycle rode out on a flag it never earned');
    const settled = await engine.reconcile('review');
    assert.equal(settled.status, 'unchanged');
    await dirtySettled();
    assert.deepEqual(dirtyNamespaces(), []);
  });

  test("an adopted merge is folded into the store's current state, never written over it", async () => {
    const key = `luvani.u.${ALICE}.review`;
    const fromTheAccount = (): unknown => sealEnvelope([{ id: 'account', reps: 2 }], 'device-tablet', 1);
    const rowAt = (rest: Rest): void => {
      rest.tokens.set('alice-jwt', ALICE);
      rest.rows.set(rest.rowKey(ALICE, 'review'), {
        user_id: ALICE,
        namespace: 'review',
        payload: fromTheAccount(),
        revision: 0,
      });
    };

    // ── The seam itself: the store is asked what it holds, and folding twice is folding
    // once. That idempotence is the licence the whole design rests on, so it is measured
    // here and not merely asserted in a comment.
    const rest = createRest();
    rowAt(rest);
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'local', reps: 1 }]) });
    const folds = foldingStore(storage, key, 'review', { twice: true });
    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt');
    const adopted = await engine.reconcile('review');

    assert.equal(adopted.adopted, true);
    assert.equal(folds.length, 2, 'the store folded a different number of times than it was asked to');
    assert.deepEqual(folds[0]!.current, [{ id: 'local', reps: 1 }], 'the store was never asked what it holds');
    assert.deepEqual(folds[0]!.next, [{ id: 'account', reps: 2 }, { id: 'local', reps: 1 }]);
    assert.deepEqual(folds[1]!.next, folds[0]!.next, 'folding a second time moved the answer');
    assert.deepEqual(JSON.parse(storage.map.get(key)!) as unknown, folds[0]!.next);

    // ── An adopter that takes the value and writes over its own state is exactly F93,
    // and the engine says so rather than counting it as a healthy adoption.
    resetSyncRegistry();
    const blindRest = createRest();
    rowAt(blindRest);
    const blindStorage = createStorage({ [key]: JSON.stringify([{ id: 'local', reps: 1 }]) });
    foldingStore(blindStorage, key, 'review', { blindly: [{ id: 'account', reps: 2 }] });
    const blind = engineFor(blindRest, blindStorage, ALICE, 'alice-jwt');
    await blind.engine.reconcile('review');
    assert.equal(
      blind.events.some((event) => event.code === 'unfolded-adopter'),
      true,
      'an adopter that never folded was reported as a healthy adoption',
    );

    // ── And a store that reads the folded value and cannot use it keeps its own. The
    // merge is still pushed: it is a superset of what the account already had.
    resetSyncRegistry();
    const shyRest = createRest();
    rowAt(shyRest);
    const shyStorage = createStorage({ [key]: JSON.stringify([{ id: 'local', reps: 1 }]) });
    foldingStore(shyStorage, key, 'review', { decline: true });
    const shy = engineFor(shyRest, shyStorage, ALICE, 'alice-jwt');
    const declined = await shy.engine.reconcile('review');

    assert.equal(declined.adopted, false, 'a store that declined was counted as having adopted');
    assert.deepEqual(
      JSON.parse(shyStorage.map.get(key)!) as unknown,
      [{ id: 'local', reps: 1 }],
      "a declining store's own state was written over anyway",
    );
    assert.equal(shy.events.some((event) => event.code === 'adopter-declined'), true);
    assert.equal(declined.pushed, true, 'declining to adopt also stopped the account being caught up');
  });

  test('an adoption that outlives a sign-out never writes under the next account', async () => {
    const aliceKey = `luvani.u.${ALICE}.review`;
    const bobKey = `luvani.u.${BOB}.review`;

    // ── One phone, two accounts, one storage map, because that is what a phone is.
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    rest.tokens.set('bob-jwt', BOB);
    const phone = createStorage({
      [aliceKey]: JSON.stringify([{ id: 'alice', reps: 1 }]),
      [bobKey]: JSON.stringify([{ id: 'bob', reps: 1 }]),
    });
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'alice-tablet', reps: 1 }], 'device-tablet', 1),
      revision: 0,
    });

    // The store resolves its key when the adopter *runs*, which is what `userKey()` does
    // and the whole reason this window exists.
    let activeUid = ALICE;
    const wrote: string[] = [];
    const rebindingStore = (): void => {
      registerSyncAdopter('review', async (fold) => {
        const key = `luvani.u.${activeUid}.review`;
        const raw = phone.map.get(key);
        const next = fold(raw === undefined ? null : (JSON.parse(raw) as unknown));
        wrote.push(key);
        await phone.setItem(key, JSON.stringify(next));
        return 'adopted';
      });
    };
    rebindingStore();

    const { engine } = engineFor(rest, phone, ALICE, 'alice-jwt');
    rest.control.holdWhen = (request) => request.method === 'GET';
    const inFlight = engine.reconcile('review');
    await until(() => rest.requests.some((request) => request.method === 'GET'), "alice's pull to be on the wire");

    // Sign-out exactly as the app does it: stop the engine, drop the registry, swap the
    // user — and `setActiveUser`'s reset hooks re-register every adopter, now bound to bob.
    engine.stop();
    resetSyncRegistry();
    activeUid = BOB;
    rebindingStore();
    rest.control.release();
    const outcome = await inFlight;

    assert.equal(outcome.status, 'stopped', "alice's cycle carried on adopting past a sign-out");
    assert.deepEqual(wrote, [], "alice's merge went through an adopter that had already rebound to bob");
    assert.deepEqual(
      JSON.parse(phone.map.get(bobKey)!) as unknown,
      [{ id: 'bob', reps: 1 }],
      "one account's data reached the next account's key",
    );

    // ── The narrower window: the adopter was already inside its chain when the learner
    // signed out. The fold hands the store its own state straight back, so the write that
    // does land is the one the store already held.
    resetSyncRegistry();
    const late = createRest();
    late.tokens.set('alice-jwt', ALICE);
    const latePhone = createStorage({ [aliceKey]: JSON.stringify([{ id: 'alice', reps: 1 }]) });
    late.rows.set(late.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'alice-tablet', reps: 1 }], 'device-tablet', 1),
      revision: 0,
    });
    let releaseChain = (): void => {};
    const busy = new Promise<void>((resolve) => {
      releaseChain = resolve;
    });
    let entered = false;
    const foldedTo: unknown[] = [];
    registerSyncAdopter('review', async (fold) => {
      entered = true;
      await busy;
      const raw = latePhone.map.get(aliceKey);
      const next = fold(raw === undefined ? null : (JSON.parse(raw) as unknown));
      foldedTo.push(next);
      await latePhone.setItem(aliceKey, JSON.stringify(next));
      return 'adopted';
    });
    const third = engineFor(late, latePhone, ALICE, 'alice-jwt');
    const adopting = third.engine.reconcile('review');
    await until(() => entered, "alice's store to be inside its write chain");
    third.engine.stop();
    releaseChain();
    await adopting;
    assert.deepEqual(foldedTo, [[{ id: 'alice', reps: 1 }]], 'a stopped engine still folded the account in');
    assert.deepEqual(
      JSON.parse(latePhone.map.get(aliceKey)!) as unknown,
      [{ id: 'alice', reps: 1 }],
      'a merge from a stopped engine reached a store anyway',
    );

    // ── And the flag. `resetSyncRegistry()` puts the stamp counter back to zero, so a
    // straggler still holding stamp 1 from the account that left would clear the very
    // first write the next account makes, and that write would never be pushed.
    resetSyncRegistry();
    const quiet = createRest();
    quiet.tokens.set('alice-jwt', ALICE);
    const quietPhone = createStorage({ [aliceKey]: JSON.stringify([{ id: 'alice', reps: 1 }]) });
    quiet.rows.set(quiet.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'alice', reps: 1 }], 'device-tablet', 1),
      revision: 0,
    });
    const fourth = engineFor(quiet, quietPhone, ALICE, 'alice-jwt');
    markDirty('review');
    const aliceStamp = dirtyStamp('review');
    quiet.control.holdWhen = (request) => request.method === 'GET';
    const straggler = fourth.engine.reconcile('review');
    await until(() => quiet.requests.some((request) => request.method === 'GET'), "alice's last pull to be on the wire");

    fourth.engine.stop();
    resetSyncRegistry();
    markDirty('review');
    const bobStamp = dirtyStamp('review');
    assert.equal(bobStamp, aliceStamp, 'this only means something while the two stamps collide');
    quiet.control.release();
    await straggler;
    await dirtySettled();

    assert.equal(dirtyStamp('review'), bobStamp, "a straggler from the last account cleared bob's first write");
    assert.deepEqual(dirtyNamespaces(), ['review'], "bob's first write lost its place in the queue");
  });

  test("the revision migration's operator note does not claim a drift the evidence record has withdrawn", () => {
    // The comment said `revision` was found live "although no migration in this repo
    // creates it" and that the project had "drifted from this history somehow". It had
    // not: this file had been pasted into that project an hour before the probe. The
    // evidence record was corrected; an operator reading only the SQL would still be
    // told to distrust a history that is intact.
    assert.doesNotMatch(
      MIGRATION,
      /no migration in this repo creates it/i,
      'the migration still tells an operator that nothing in this repo creates `revision`',
    );
    assert.doesNotMatch(
      MIGRATION,
      /drifted from this history/i,
      'the migration still tells an operator the live project drifted',
    );
    assert.match(
      MIGRATION,
      /pasted into that project from this repo on 2026-08-26/i,
      'the migration does not say how `revision` came to be live, so the next reader guesses again',
    );

    // The two records have to say the same thing, or correcting one of them again leaves
    // the other one lying.
    const evidence = readFileSync(
      new URL('../../../../docs/IMPLEMENTATION_EVIDENCE.md', import.meta.url),
      'utf8',
    );
    assert.match(
      evidence,
      /202608260001_learner_state_revision\.sql` was pasted from this repo/,
      'the evidence record no longer says the migration was applied by hand',
    );
    assert.doesNotMatch(evidence, /drifted from this history/i);
  });

  test('a namespace whose payload a newer app wrote goes quiet instead of clobbering it', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const future = sealEnvelope({ version: 99, fields: 'this build has never heard of' }, 'device-new', 1);
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: future,
      revision: 3,
    });
    const storage = createStorage({ [`luvani.u.${ALICE}.review`]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    const { engine, events } = engineFor(rest, storage, ALICE, 'alice-jwt', { policy: shyPolicy });

    const outcome = await engine.reconcile('review');
    assert.equal(outcome.status, 'quiet');
    assert.equal(outcome.pushed, false);
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 3, 'an older app overwrote a newer payload');
    assert.equal(events.some((event) => event.code === 'newer-schema'), true);
  });

  test('a local write that lands mid-push keeps its place in the queue', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt');

    markDirty('review');
    rest.control.holdWhen = (request) => request.method === 'POST';
    const inFlight = engine.reconcile('review');
    await until(() => rest.requests.some((request) => request.method === 'POST'), 'the first push to be on the wire');

    // The learner grades another card while the push is in the air.
    await storage.setItem(key, JSON.stringify([{ id: 'a', reps: 1 }, { id: 'b', reps: 1 }]));
    markDirty('review');
    rest.control.release();
    await inFlight;
    await dirtySettled();

    assert.deepEqual(
      dirtyNamespaces(),
      ['review'],
      'the write that landed during the push was cleared along with the one before it',
    );
    const caughtUp = await engine.reconcile('review');
    assert.equal(caughtUp.status, 'pushed');
    assert.deepEqual(payloadOf(rest, ALICE, 'review'), [{ id: 'a', reps: 1 }, { id: 'b', reps: 1 }]);
    await dirtySettled();
    assert.deepEqual(dirtyNamespaces(), [], 'a namespace that is fully pushed stayed dirty');
  });

  test('two devices editing the same namespace both keep their work, and each write counts once', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;

    const phone = createStorage({ [key]: JSON.stringify([{ id: 'phone', reps: 1 }]) });
    const tablet = createStorage({ [key]: JSON.stringify([{ id: 'tablet', reps: 1 }]) });
    const phoneEngine = engineFor(rest, phone, ALICE, 'alice-jwt');
    const tabletEngine = engineFor(rest, tablet, ALICE, 'alice-jwt');

    const first = await phoneEngine.engine.reconcile('review');
    assert.equal(first.revision, 0);

    // The tablet has been offline and knows nothing about the phone's row.
    const second = await tabletEngine.engine.reconcile('review');
    assert.equal(second.status, 'pushed');
    assert.equal(second.revision, 1, 'the second device advanced the revision by exactly one');
    assert.deepEqual(payloadOf(rest, ALICE, 'review'), [{ id: 'phone', reps: 1 }, { id: 'tablet', reps: 1 }]);

    // The phone comes back and ends up with everything, without pushing again.
    const third = await phoneEngine.engine.reconcile('review');
    assert.equal(third.pushed, false, 'a device that had nothing new to say still wrote');
    assert.equal(rest.rows.get(rest.rowKey(ALICE, 'review'))!.revision, 1);
  });

  test('losing the swap repeatedly gives up for this cycle rather than spinning', async () => {
    const rest = createRest();
    rest.tokens.set('alice-jwt', ALICE);
    const key = `luvani.u.${ALICE}.review`;
    const storage = createStorage({ [key]: JSON.stringify([{ id: 'a', reps: 1 }]) });
    rest.rows.set(rest.rowKey(ALICE, 'review'), {
      user_id: ALICE,
      namespace: 'review',
      payload: sealEnvelope([{ id: 'b', reps: 1 }], 'device-b', 1),
      revision: 0,
    });

    // A busy sibling device that wins every single swap.
    const busy = createRest();
    let intercepted = 0;
    const contended: SyncFetch = async (url, init) => {
      if (init.method === 'PATCH') {
        intercepted += 1;
        const row = rest.rows.get(rest.rowKey(ALICE, 'review'))!;
        row.revision += 1;
      }
      return rest.fetch(url, init);
    };
    busy.tokens.set('alice-jwt', ALICE);

    const { engine } = engineFor(rest, storage, ALICE, 'alice-jwt', { fetch: contended, conflictBudget: 2 });
    const outcome = await engine.reconcile('review');
    assert.equal(outcome.status, 'conflict');
    assert.equal(outcome.attempts, 2, 'the retry budget was not respected');
    assert.equal(intercepted, 3, 'the engine did not try exactly budget-plus-one times');
    assert.equal(engine.backoff().attempts(), 1, 'a cycle that gave up did not enter the backoff ladder');
  });
});
