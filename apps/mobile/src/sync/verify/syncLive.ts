/**
 * Two devices, two accounts, one real database.
 *
 *   node --experimental-strip-types apps/mobile/src/sync/verify/syncLive.ts
 *
 * Everything else about this engine is proved with an injected `fetch` and a Map standing
 * in for a phone. That is worth having and it is not the thing anybody is actually
 * worried about. The worry is the part no fake can answer: that row level security really
 * does stop one learner reaching another's rows, that a compare-and-swap on a real
 * PostgreSQL row really does refuse a stale write, and that two devices left to argue
 * settle in the same place. So this runs the **real engine** — `startSync` from
 * `engine.ts`, `createSyncPolicy` from `policy.ts`, the same registry the stores use —
 * twice over, as two devices belonging to two disposable accounts on a live project.
 *
 * **The sync path runs on the learners' own JWTs.** Two accounts are created with the
 * service role, because creating a user is an admin operation and there is no other way,
 * and then the service role is put down. Every request the engines make afterwards
 * carries the anon key and that learner's own bearer, exactly as the app does. An
 * isolation proof made with a service-role key proves nothing about isolation: the
 * service role is *supposed* to see everything.
 *
 * Six proofs, listed in SYNC_PROOFS. Three rules, the same three supabaseLive.ts keeps:
 *
 *   1. It never claims a proof it did not run. A skipped proof, a missing result, or a
 *      result for a proof nobody declared all fail the run — see summarise().
 *   2. With no credentials it prints `BLOCKED:` naming the exact variables that are
 *      missing and exits non-zero. It does not pass and it does not pretend.
 *   3. It never prints a key, a password or an access token. Every line leaves through
 *      the redactor, by identity for the values it was handed and by shape for anything
 *      JWT-like it meets in an error body it did not compose.
 *
 * It cannot apply migrations. DDL does not travel over PostgREST and this machine has no
 * CLI, Docker or psql, so when `revision` or its trigger is absent it says so in one line
 * and points at the migration to paste rather than failing six proofs for one missing
 * column.
 *
 * ## The one thing simulated, and why
 *
 * The network. `offline` on a device makes its `fetch` throw, which is what a phone in a
 * tunnel looks like from inside the engine. Everything else is real: real accounts, real
 * tokens, real rows, real revisions, real RLS.
 *
 * ## Two devices in one process
 *
 * `registry.ts` is a module singleton, because a phone runs exactly one engine. So the
 * two devices here take turns: `launch()` resets the registry, registers that device's
 * adopters, and starts a fresh engine bound to that device's storage. That is not a
 * workaround dressed up — it is precisely what an app launch does, which is why the
 * offline-replay proof can use it as its restart.
 *
 * No import here reaches react-native. The engine, the policy and the registry all load
 * under plain node, which is the property that lets this file exist at all.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startSync, type SyncEngine, type SyncFetch, type SyncOutcome, type SyncStorage } from '../engine.ts';
import { sameData } from '../envelope.ts';
import { createSyncPolicy } from '../policy.ts';
import {
  markDirty,
  dirtySettled,
  registerSyncAdopter,
  resetSyncRegistry,
  type SyncAdoption,
  type SyncFold,
} from '../registry.ts';

export interface SyncProof {
  readonly id: string;
  /** What the check proves, in the words the report prints. */
  readonly title: string;
  /** Why it is in the inventory: the thing that goes wrong when it is not true. */
  readonly why: string;
}

/**
 * The inventory. A proof leaves this list when the risk it covers is gone, never because
 * it was inconvenient to run.
 */
export const SYNC_PROOFS: readonly SyncProof[] = [
  {
    id: 'own-rows-only',
    title: 'one learner token cannot read, update or delete another account state rows',
    why: 'the learner own JWT is the entire wall between two accounts, because sync deliberately does not route through the service role',
  },
  {
    id: 'forged-user-filter',
    title: 'a request that pins another account user id comes back empty rather than full',
    why: 'a modified client asking for someone else rows must be refused by the database, not by the app',
  },
  {
    id: 'offline-replay',
    title: 'an edit made offline survives a restart and is pushed when the network returns',
    why: 'a learner who studies on a plane and then closes the app must not lose the session',
  },
  {
    id: 'duplicate-converges',
    title: 'the same envelope pushed twice advances the revision exactly once',
    why: 'retries and reconnects replay pushes, and a second apply is how a merge doubles a learner record',
  },
  {
    id: 'conflict-converges',
    title: 'two devices that edited the same namespace offline settle on the same state on both sides',
    why: 'divergence that nobody notices is how one device quietly becomes the wrong answer',
  },
  {
    id: 'corrupt-quarantined',
    title: 'an unreadable payload planted with the service role is quarantined and never overwrites local data',
    why: 'a bad write from anywhere must cost one namespace one cycle, never a learner months of work',
  },
];

/** The credentials a live run needs. The anon key is read from the mobile public name first. */
export const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

export type Environment = Record<string, string | undefined>;

const anonKeyOf = (env: Environment): string | undefined =>
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

/** Which of REQUIRED_ENV is absent or blank. Returns names, never values. */
export function missingEnvironment(env: Environment): string[] {
  const present: Environment = { ...env, EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKeyOf(env) };
  return REQUIRED_ENV.filter((name) => {
    const value = present[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

/** The honest no-credentials report: what is missing, what stays unproven, and no claim. */
export function blockedReport(missing: readonly string[]): string {
  const lines = [
    `BLOCKED: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set, so nothing below has been proven.`,
    'Point them at a disposable Supabase project and run this again:',
    '  npm run verify:sync',
    `Unproven until then (${SYNC_PROOFS.length}):`,
  ];
  for (const proof of SYNC_PROOFS) lines.push(`  - ${proof.id}: ${proof.title}`);
  return lines.join('\n');
}

/** The one line to print when the credentials work but the ordering primitive is absent. */
export function schemaMissingReport(detail: string): string {
  return [
    `BLOCKED: the Supabase project answers but learner_state cannot order writes (${detail}).`,
    'Paste supabase/migrations/202608260001_learner_state_revision.sql into the SQL editor,',
    'in the order supabase/README.md gives, then run this again.',
  ].join('\n');
}

const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g;
const SUPABASE_KEY_SHAPE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g;

/**
 * Redaction is not cosmetic. PostgREST and GoTrue echo request context into error bodies,
 * so an unredacted failure report is a plausible way to put a service-role key or a
 * learner's access token into a terminal, a CI log or a pasted bug report. Values handed
 * in go by identity; anything else shaped like a JWT or a Supabase key goes by shape.
 *
 * A near-copy of the redactor in services/token-server/src/verify/supabaseLive.ts, and
 * deliberately not an import of it: apps/mobile must not gain a dependency on a service
 * for fifteen lines, and the two files have to keep working if either workspace moves.
 */
export function makeRedactor(secrets: readonly (string | undefined)[]): (value: unknown) => string {
  const known = secrets
    .filter((secret): secret is string => typeof secret === 'string' && secret.length >= 8)
    .sort((a, b) => b.length - a.length);
  return (value: unknown): string => {
    let text = typeof value === 'string' ? value : stringify(value);
    for (const secret of known) text = text.split(secret).join('[redacted]');
    text = text.replace(JWT_SHAPE, '[redacted-jwt]');
    text = text.replace(SUPABASE_KEY_SHAPE, '[redacted-key]');
    return text;
  };
}

function stringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export type CheckOutcome = 'passed' | 'failed' | 'skipped';

export interface CheckResult {
  readonly id: string;
  readonly outcome: CheckOutcome;
  readonly detail: string;
  readonly ms: number;
}

export interface Summary {
  readonly ok: boolean;
  readonly lines: readonly string[];
}

const MARK: Record<CheckOutcome, string> = { passed: 'PASS', failed: 'FAIL', skipped: 'SKIP' };

/**
 * The honesty check. A run is ok only when every declared proof produced a `passed`
 * result: a skip, a missing result, or a result for a proof nobody declared all fail it.
 * Without this a harness that quietly stopped running half its checks still exits 0.
 */
export function summarise(results: readonly CheckResult[]): Summary {
  const byId = new Map(results.map((result) => [result.id, result]));
  const lines: string[] = [];
  let ok = true;

  for (const proof of SYNC_PROOFS) {
    const result = byId.get(proof.id);
    if (!result) {
      ok = false;
      lines.push(`MISS ${proof.id}: never ran, so ${proof.title} is unproven`);
      continue;
    }
    if (result.outcome !== 'passed') ok = false;
    lines.push(`${MARK[result.outcome]} ${proof.id} (${Math.round(result.ms)} ms): ${result.detail}`);
  }

  const declared = new Set(SYNC_PROOFS.map((proof) => proof.id));
  for (const result of results) {
    if (declared.has(result.id)) continue;
    ok = false;
    lines.push(`UNKNOWN ${result.id}: a result no proof in the inventory declares`);
  }

  const passing = results.filter((result) => result.outcome === 'passed' && declared.has(result.id)).length;
  lines.push(
    ok ? `all ${SYNC_PROOFS.length} sync proofs passed` : `${SYNC_PROOFS.length - passing} of ${SYNC_PROOFS.length} sync proofs did not pass`,
  );
  return { ok, lines };
}

/** Thrown by a check that did not hold. The message is redacted before it is printed. */
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

interface Recorder {
  readonly results: CheckResult[];
  check(id: string, body: () => Promise<string>): Promise<void>;
}

function recorder(redact: (value: unknown) => string, log: (line: string) => void): Recorder {
  const results: CheckResult[] = [];
  return {
    results,
    async check(id: string, body: () => Promise<string>): Promise<void> {
      const started = performance.now();
      try {
        const detail = await body();
        results.push({ id, outcome: 'passed', detail: redact(detail), ms: performance.now() - started });
        log(`PASS ${id}`);
      } catch (err) {
        results.push({ id, outcome: 'failed', detail: redact(err), ms: performance.now() - started });
        log(`FAIL ${id}: ${redact(err)}`);
      }
    },
  };
}

export interface RunOptions {
  readonly env: Environment;
  readonly log?: (line: string) => void;
}

export interface RunReport {
  readonly ok: boolean;
  readonly blocked: boolean;
  readonly results: readonly CheckResult[];
  readonly lines: readonly string[];
}

// ─────────────────────────────────────────────────────────── a device, faked

/** The AsyncStorage slice the engine uses, backed by a Map. This is the whole phone. */
function deviceStorage(cells: Map<string, string>): SyncStorage {
  return {
    getItem: (key: string) => Promise.resolve(cells.get(key) ?? null),
    setItem: (key: string, value: string) => {
      cells.set(key, value);
      return Promise.resolve();
    },
  };
}

interface Learner {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly token: string;
}

interface Device {
  readonly name: string;
  readonly learner: Learner;
  readonly cells: Map<string, string>;
  /** A phone in a tunnel: its fetch throws, which is what the engine actually sees. */
  offline: boolean;
}

// ──────────────────────────────────────────────────────────────── the run

/**
 * Run every proof against the live project.
 *
 * Returns rather than exits, so the CLI at the bottom and any future caller see the same
 * report.
 */
export async function runSyncVerification(options: RunOptions): Promise<RunReport> {
  const log = options.log ?? ((): void => {});
  const env = options.env;
  const missing = missingEnvironment(env);
  const anonKey = anonKeyOf(env);
  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const secrets: string[] = [];
  if (typeof serviceRoleKey === 'string') secrets.push(serviceRoleKey);
  if (typeof anonKey === 'string') secrets.push(anonKey);
  let redact = makeRedactor(secrets);

  if (missing.length > 0 || !url || !serviceRoleKey || !anonKey) {
    const report = blockedReport(missing.length > 0 ? missing : [...REQUIRED_ENV]);
    for (const line of report.split('\n')) log(redact(line));
    return { ok: false, blocked: true, results: [], lines: report.split('\n') };
  }

  const rest = `${url}/rest/v1/learner_state`;
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  interface Answer {
    readonly status: number;
    readonly ok: boolean;
    readonly rows: Record<string, unknown>[];
    readonly body: string;
  }

  async function ask(target: string, init: RequestInit): Promise<Answer> {
    const response = await fetch(target, init);
    const body = await response.text();
    let rows: Record<string, unknown>[] = [];
    try {
      const parsed: unknown = body.length === 0 ? [] : JSON.parse(body);
      if (Array.isArray(parsed)) {
        rows = parsed.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
      }
    } catch {
      rows = [];
    }
    return { status: response.status, ok: response.ok, rows, body };
  }

  /** As the service role: setup, planting corruption, and reading the truth afterwards. */
  const asAdmin = (path: string, init: RequestInit = {}): Promise<Answer> =>
    ask(`${rest}${path}`, { ...init, headers: { ...adminHeaders, ...(init.headers ?? {}) } });

  /** As a learner: anon key plus their own bearer. Exactly what the app sends. */
  const asLearner = (who: Learner, path: string, init: RequestInit = {}): Promise<Answer> =>
    ask(`${rest}${path}`, {
      ...init,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${who.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });

  // Preflight. Six failures that all mean "no revision column" is a worse report than one
  // line that says so, and this machine cannot apply the migration itself.
  const probe = await asAdmin('?select=user_id,namespace,payload,revision&limit=1');
  if (!probe.ok) {
    const detail = /revision/.test(probe.body)
      ? 'learner_state has no revision column'
      : `learner_state could not be read: ${redact(probe.body).slice(0, 160)}`;
    const report = schemaMissingReport(detail);
    const results = SYNC_PROOFS.map((proof) => ({
      id: proof.id,
      outcome: 'skipped' as const,
      detail: 'revision not applied',
      ms: 0,
    }));
    const lines = [...report.split('\n'), ...summarise(results).lines];
    for (const line of lines) log(line);
    return { ok: false, blocked: true, results, lines };
  }

  const created: string[] = [];
  const run = recorder((value) => redact(value), log);

  /** Create an account and sign it in, so PostgREST sees the real authenticated role. */
  const learner = async (): Promise<Learner> => {
    const email = `luvani-sync-${randomUUID()}@example.com`;
    const password = randomUUID().replace(/-/g, '');
    const account = await ask(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const id = (JSON.parse(account.body) as { id?: unknown }).id;
    expect(typeof id === 'string', `could not create a verification account: ${redact(account.body)}`);
    created.push(id as string);
    const session = await ask(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const token = (JSON.parse(session.body) as { access_token?: unknown }).access_token;
    expect(typeof token === 'string', `could not sign in a verification account: ${redact(session.body)}`);
    // From here the two learners' own bearers are secrets too. Rebuild the redactor
    // before any line that could carry one is composed.
    secrets.push(token as string, password);
    redact = makeRedactor(secrets);
    return { id: id as string, email, password, token: token as string };
  };

  const policy = createSyncPolicy();
  const keyOf = (device: Device, namespace: string): string => `luvani.u.${device.learner.id}.${namespace}`;

  /**
   * Start this device's app.
   *
   * Resets the registry, registers an adopter per namespace that folds the account's
   * state into this device's cells, and binds a fresh engine. Calling it twice on one
   * device is a restart, and the dirty set it reads back off disk is the whole of the
   * offline queue.
   *
   * The adopter reads, folds and writes in one synchronous stretch, which is what a real
   * store gets from its promise chain: nothing can land between the read and the write.
   */
  const launch = (device: Device): SyncEngine => {
    resetSyncRegistry();
    for (const namespace of policy.namespaces) {
      registerSyncAdopter(namespace, (fold: SyncFold): Promise<SyncAdoption> => {
        const key = keyOf(device, namespace);
        const raw = device.cells.get(key);
        let current: unknown = null;
        if (raw !== undefined) {
          try {
            current = JSON.parse(raw) as unknown;
          } catch {
            // A cell this harness cannot read is a cell it has no business folding into.
            return Promise.resolve('declined');
          }
        }
        const next = fold(current);
        if (next === null) device.cells.delete(key);
        else device.cells.set(key, JSON.stringify(next));
        return Promise.resolve('adopted');
      });
    }
    const transport: SyncFetch = async (target, init) => {
      if (device.offline) throw new Error('the network is not reachable');
      const response = await fetch(target, init as RequestInit);
      return { ok: response.ok, status: response.status, text: () => response.text() };
    };
    return startSync({
      uid: device.learner.id,
      deviceId: `verify-${device.name}`,
      url,
      anonKey,
      getAccessToken: () => Promise.resolve(device.learner.token),
      fetch: transport,
      storage: deviceStorage(device.cells),
      keyFor: (suffix: string) => keyOf(device, suffix),
      policy,
      // The harness drives every cycle itself, so nothing here may schedule its own.
      schedule: () => {},
      debounceMs: 1_000_000,
    });
  };

  /** A local write, the way a store makes one: to disk first, then raise the flag. */
  async function writeLocal(device: Device, namespace: string, blob: unknown): Promise<void> {
    device.cells.set(keyOf(device, namespace), JSON.stringify(blob));
    markDirty(namespace);
    await dirtySettled();
  }

  function readLocal(device: Device, namespace: string): unknown {
    const raw = device.cells.get(keyOf(device, namespace));
    return raw === undefined ? null : (JSON.parse(raw) as unknown);
  }

  /**
   * One run of this device's app, from launch to close.
   *
   * Every local write has to happen inside one of these. `markDirty` writes to whichever
   * device the registry is currently bound to, exactly as it does on a phone where there
   * is only ever one — so a harness that edited between two apps would file one device's
   * queue under the other's key. This harness did, the offline-replay proof caught it on
   * the first live run, and this function is the shape that makes it unsayable.
   */
  async function withApp<T>(device: Device, body: (engine: SyncEngine) => Promise<T>): Promise<T> {
    const engine = launch(device);
    try {
      return await body(engine);
    } finally {
      engine.stop();
    }
  }

  /** One namespace, one cycle, no local edit. */
  const sync = (device: Device, namespace: string): Promise<SyncOutcome> =>
    withApp(device, (engine) => engine.reconcile(namespace));

  /** A local edit and the cycle that follows it, in one app run, the way a session goes. */
  const editAndSync = (device: Device, namespace: string, blob: unknown): Promise<SyncOutcome> =>
    withApp(device, async (engine) => {
      await writeLocal(device, namespace, blob);
      return engine.reconcile(namespace);
    });

  const card = (id: string, reps: number, interval: number): Record<string, unknown> => ({
    id,
    kind: 'vocab',
    front: id,
    back: 'something',
    context: '',
    ipa: '',
    addedAt: 1,
    due: 2,
    intervalDays: interval,
    ease: 2.5,
    reps,
    lapses: 0,
  });

  try {
    const alice = await learner();
    const bob = await learner();
    const phone: Device = { name: 'phone', learner: alice, cells: new Map(), offline: false };
    const tablet: Device = { name: 'tablet', learner: bob, cells: new Map(), offline: false };

    // Both accounts need a row of their own before isolation means anything, and both
    // rows are written by the engine under the learner's own token rather than planted.
    const seeded = await editAndSync(phone, 'topics', {
      version: 1,
      topics: [{ id: 'topic:cafe', title: { fr: 'le cafe', en: 'the cafe' }, discussed: ['2026-08-01'], phraseKeys: [] }],
    });
    expect(seeded.pushed, `the first push did not land: ${seeded.status}`);

    const seededB = await editAndSync(tablet, 'topics', {
      version: 1,
      topics: [{ id: 'topic:train', title: { fr: 'le train', en: 'the train' }, discussed: ['2026-08-02'], phraseKeys: [] }],
    });
    expect(seededB.pushed, `the second account first push did not land: ${seededB.status}`);

    await run.check('own-rows-only', async () => {
      // Everything Bob's token can see, with no filter at all.
      const mine = await asLearner(bob, '?select=user_id,namespace');
      expect(mine.ok, `a learner could not read their own state: ${redact(mine.body)}`);
      expect(mine.rows.length > 0, 'a learner cannot read their own state at all');
      expect(
        mine.rows.every((row) => row.user_id === bob.id),
        'an unfiltered read returned another account row',
      );

      // And every way of writing into Alice's row, from Bob's token.
      const forgedInsert = await asLearner(bob, '?select=user_id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify([{ user_id: alice.id, namespace: 'review', payload: { v: 1, forged: true } }]),
      });
      expect(!forgedInsert.ok, 'a learner inserted a row under another account id');

      const forgedUpdate = await asLearner(bob, `?user_id=eq.${alice.id}&namespace=eq.topics&select=user_id`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ payload: { v: 1, forged: true } }),
      });
      expect(forgedUpdate.rows.length === 0, 'a learner updated another account row');

      const forgedDelete = await asLearner(bob, `?user_id=eq.${alice.id}&select=user_id`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
        body: undefined,
      });
      expect(forgedDelete.rows.length === 0, 'a learner deleted another account row');

      const survivor = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.topics&select=payload,revision`);
      expect(survivor.rows.length === 1, 'another account row did not survive a forged write');
      const payload = survivor.rows[0]?.payload as { data?: { topics?: { id?: string }[] } } | undefined;
      expect(payload?.data?.topics?.[0]?.id === 'topic:cafe', 'another account payload was altered');
      return 'unfiltered read is own rows only; insert, update and delete under another id all changed nothing';
    });

    await run.check('forged-user-filter', async () => {
      // The row is really there — proved with the service role first, so an empty answer
      // below cannot be an empty table wearing a security proof's clothes.
      const truth = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.topics&select=user_id`);
      expect(truth.rows.length === 1, 'the row this proof is about does not exist');

      const forged = await asLearner(bob, `?user_id=eq.${alice.id}&select=user_id,namespace,payload`);
      expect(forged.ok, `the forged read errored instead of returning nothing: ${redact(forged.body)}`);
      expect(forged.rows.length === 0, 'asking for another account rows by user id returned them');

      // The `or` filter is the obvious way round a plain equality, so it is tried too.
      const smuggled = await asLearner(bob, `?or=(user_id.eq.${alice.id},user_id.eq.${bob.id})&select=user_id`);
      expect(
        smuggled.rows.every((row) => row.user_id === bob.id),
        'an or-filter smuggled another account rows past row level security',
      );
      return 'a filter naming another account returns zero rows, and an or-filter returns only own rows';
    });

    await run.check('offline-replay', async () => {
      const namespace = 'missions';
      try {
        phone.offline = true;
        const grounded = await editAndSync(phone, namespace, {
          version: 1,
          completions: [{ id: 'mission:cafe', at: 1_700_000_000_000, rung: 4 }],
        });
        expect(grounded.status === 'offline', `an unreachable network reported ${grounded.status}`);
        expect(!grounded.pushed, 'a push landed while the device was offline');

        const empty = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=revision`);
        expect(empty.rows.length === 0, 'a row appeared for a device that never reached the network');
      } finally {
        // A failed proof must not leave the device in a tunnel for the rest of the run.
        phone.offline = false;
      }

      // The restart. Nothing survives but what reached this device's disk, and the queue
      // is on that disk under the syncState key or it is nowhere: `launch` below clears
      // the registry's memory before it reads anything back.
      const queued = phone.cells.get(keyOf(phone, 'syncState'));
      expect(typeof queued === 'string' && queued.includes(namespace), 'the offline edit left no queue on disk');

      const landed = await withApp(phone, async (engine) => {
        const summary = await engine.flushDirty();
        return summary.outcomes.find((outcome) => outcome.namespace === namespace);
      });
      expect(landed?.pushed === true, `the queued edit did not push after the restart: ${landed?.status ?? 'never ran'}`);

      const stored = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=payload,revision`);
      const payload = stored.rows[0]?.payload as { data?: { completions?: { id?: string }[] } } | undefined;
      expect(payload?.data?.completions?.[0]?.id === 'mission:cafe', 'the replayed edit is not what the learner did');
      return `queued while offline, read back off disk after a restart, pushed at revision ${String(stored.rows[0]?.revision)}`;
    });

    await run.check('duplicate-converges', async () => {
      const namespace = 'activity';
      const first = await editAndSync(phone, namespace, {
        version: 1,
        entries: [{ at: 1_700_000_000_000, kind: 'convo', xp: 12 }],
        backfilled: false,
      });
      expect(first.pushed, `the first push did not land: ${first.status}`);
      const startedAt = first.revision;
      expect(typeof startedAt === 'number', 'the push came back without a revision');

      // A cycle with nothing new to say must not touch the row. Idempotence at the
      // engine's level, which is what makes a launch reconcile free.
      const again = await sync(phone, namespace);
      expect(!again.pushed, `a second cycle with no local change pushed anyway: ${again.status}`);

      const row = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=payload,revision`);
      const envelope = row.rows[0]?.payload;
      expect(row.rows[0]?.revision === startedAt, 'an idle cycle advanced the revision');

      // Now the wire-level duplicate: the same compare-and-swap, sent twice, on the
      // learner's own token. The first wins; the second matches no row at all.
      const swap = (revision: number): Promise<Answer> =>
        asLearner(alice, `?user_id=eq.${alice.id}&namespace=eq.${namespace}&revision=eq.${revision}&select=revision`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ payload: envelope, revision: revision + 1 }),
        });
      const won = await swap(startedAt as number);
      expect(won.rows.length === 1, 'a current compare-and-swap changed no rows');
      expect(won.rows[0]?.revision === (startedAt as number) + 1, 'the database did not advance the revision by one');
      const replayed = await swap(startedAt as number);
      expect(replayed.rows.length === 0, 'the same push applied twice, so a retry can double a write');

      const after = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=payload,revision`);
      expect(after.rows[0]?.revision === (startedAt as number) + 1, 'the duplicate moved the revision a second time');
      expect(sameData(after.rows[0]?.payload, envelope), 'the duplicate changed the payload');
      return `an idle cycle pushed nothing, and a replayed swap advanced ${String(startedAt)} to ${String((startedAt as number) + 1)} exactly once`;
    });

    await run.check('conflict-converges', async () => {
      // One account, two devices. This is the case the whole engine exists for, so both
      // devices belong to Alice and both edit while neither can see the other.
      const namespace = 'review';
      const second: Device = { name: 'second', learner: alice, cells: new Map(), offline: false };

      const pushed = await editAndSync(phone, namespace, [card('phrase:bonjour', 4, 21)]);
      expect(pushed.pushed, `the shared starting deck did not push: ${pushed.status}`);

      // The second device catches up, and then both go offline and study.
      const caught = await sync(second, namespace);
      expect(caught.adopted, `the second device did not adopt the account deck: ${caught.status}`);
      expect(sameData(readLocal(second, namespace), readLocal(phone, namespace)), 'the two devices started apart');

      // Both study with no way to reach the network, so neither can see the other's work.
      try {
        phone.offline = true;
        second.offline = true;
        await editAndSync(phone, namespace, [card('phrase:bonjour', 5, 34), card('phrase:un cafe', 1, 1)]);
        await editAndSync(second, namespace, [card('phrase:bonjour', 4, 21), card('phrase:l addition', 2, 6)]);
      } finally {
        phone.offline = false;
        second.offline = false;
      }

      // They reconnect one after the other, which is what actually happens, and then the
      // first one syncs again to pick up what the second added.
      const phoneFirst = await sync(phone, namespace);
      expect(phoneFirst.pushed, `the first device could not push its offline work: ${phoneFirst.status}`);
      const secondNext = await sync(second, namespace);
      expect(secondNext.pushed, `the second device could not push its offline work: ${secondNext.status}`);
      const phoneAgain = await sync(phone, namespace);
      expect(phoneAgain.adopted, `the first device never learned what the second did: ${phoneAgain.status}`);

      const onPhone = readLocal(phone, namespace) as Record<string, unknown>[];
      const onSecond = readLocal(second, namespace) as Record<string, unknown>[];
      expect(sameData(onPhone, onSecond), 'two devices settled on different decks');

      const server = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=payload,revision`);
      const stored = (server.rows[0]?.payload as { data?: unknown } | undefined)?.data;
      expect(sameData(stored, onPhone), 'the devices agree with each other but not with the account');

      const ids = onPhone.map((row) => row.id).sort();
      expect(
        sameData(ids, ['phrase:bonjour', 'phrase:l addition', 'phrase:un cafe']),
        `a card was lost in the merge: ${JSON.stringify(ids)}`,
      );
      const bonjour = onPhone.find((row) => row.id === 'phrase:bonjour');
      expect(bonjour?.reps === 5 && bonjour?.intervalDays === 34, 'the scheduling a card earned was not carried');
      return `three cards from two offline devices, identical on both sides at revision ${String(server.rows[0]?.revision)}`;
    });

    await run.check('corrupt-quarantined', async () => {
      const namespace = 'coachMarks';
      const pushed = await editAndSync(phone, namespace, ['mic', 'hint']);
      expect(pushed.pushed, `the good value did not push: ${pushed.status}`);

      // An operator with a service-role key and a bad afternoon. Not an envelope this
      // app has ever written, and not something any merge can read.
      const planted = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=revision`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ payload: { wrote: 'by hand', v: 99 } }),
      });
      expect(planted.rows.length === 1, 'the corrupt payload could not be planted, so nothing was tested');

      const before = readLocal(phone, namespace);
      const outcome = await sync(phone, namespace);
      expect(outcome.status === 'quarantined', `an unreadable payload reported ${outcome.status}`);
      const after = readLocal(phone, namespace);
      expect(sameData(before, after), 'an unreadable payload reached the device and overwrote good local data');

      const repaired = await asAdmin(`?user_id=eq.${alice.id}&namespace=eq.${namespace}&select=payload,revision`);
      const data = (repaired.rows[0]?.payload as { data?: unknown } | undefined)?.data;
      expect(sameData(data, before), 'the device did not put its own good value back over the corrupt row');

      // The other half of the rule: a device with nothing of its own leaves the row
      // exactly as it is, so an operator still has whatever it holds.
      const bystander: Device = { name: 'bystander', learner: bob, cells: new Map(), offline: false };
      const bobRow = await asAdmin(`?user_id=eq.${bob.id}&namespace=eq.${namespace}&select=user_id`);
      if (bobRow.rows.length === 0) {
        await asAdmin('', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify([{ user_id: bob.id, namespace, payload: { wrote: 'by hand', v: 99 } }]),
        });
      }
      const untouched = await sync(bystander, namespace);
      expect(untouched.status === 'quarantined', `an empty device reported ${untouched.status} on a corrupt row`);
      expect(!untouched.pushed, 'a device with nothing of its own overwrote a corrupt row it could not read');
      expect(bystander.cells.get(keyOf(bystander, namespace)) === undefined, 'a corrupt payload was adopted');
      const survived = await asAdmin(`?user_id=eq.${bob.id}&namespace=eq.${namespace}&select=payload`);
      expect(
        (survived.rows[0]?.payload as { wrote?: string } | undefined)?.wrote === 'by hand',
        'the corrupt row was destroyed rather than left for an operator',
      );
      return 'local data survived, the good value was pushed back over the corrupt row, and an empty device left it alone';
    });
  } catch (err) {
    // A proof that never ran stays visibly unrun, which summarise() turns into a failure.
    log(`ERROR before the run finished: ${redact(err)}`);
  } finally {
    resetSyncRegistry();
    for (const id of created) {
      await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders }).catch(() => {});
    }
  }

  const summary = summarise(run.results);
  for (const line of summary.lines) log(redact(line));
  return { ok: summary.ok, blocked: false, results: run.results, lines: summary.lines };
}

// ────────────────────────────────────────────────────────────────── the CLI

/**
 * A `.env` reader in ten lines rather than a dependency.
 *
 * `dotenv` lives in the token server's workspace and apps/mobile has no reason to grow a
 * dependency for a harness. Values already in the environment win, so a caller can point
 * this at a different project without editing a file.
 */
export function readEnvFile(path: string): Record<string, string> {
  const found: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return found;
  }
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = (match[2] ?? '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    found[match[1] as string] = value;
  }
  return found;
}

/** Entry point. Blocked, failed and errored all exit non-zero; only a full pass exits 0. */
async function main(): Promise<void> {
  // The token server's own env file, not the caller's cwd: this runs from the repo root
  // and the credentials live beside the service that already uses them. LUVANI_ENV_FILE
  // points somewhere else, which is how the self-test proves the blocked path without
  // borrowing this machine's real credentials.
  const envFile =
    process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../../../../services/token-server/.env', import.meta.url));
  const fromFile = readEnvFile(envFile);
  const env: Environment = { ...fromFile, ...process.env };
  const report = await runSyncVerification({ env, log: (line) => console.log(line) });
  process.exitCode = report.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
