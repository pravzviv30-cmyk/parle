/**
 * A real trip through a disposable Supabase project.
 *
 *   node --experimental-strip-types services/token-server/src/verify/supabaseLive.ts
 *
 * Twelve proofs, listed in SUPABASE_PROOFS below, run against a live project with two
 * genuinely signed-in accounts. Nothing here is simulated: the two learners are created
 * through the admin API, signed in for real JWTs, and every isolation claim is made by
 * PostgREST acting as the `authenticated` role, because a fake PostgREST would only ever
 * prove the fake.
 *
 * Three rules this file exists to keep:
 *
 *   1. It never claims a proof it did not run. A check that is skipped, or a proof with
 *      no result at all, fails the run exactly as a failing check does — see summarise().
 *   2. With no credentials it prints `BLOCKED:` naming the exact environment variables
 *      that are missing and exits non-zero. It does not pass, and it does not pretend.
 *   3. It never prints a key, a token or a service-role header. Every line leaves through
 *      the redactor, which strips the values it was handed and any JWT or Supabase key
 *      shape it happens to meet in an error message from the service.
 *
 * It cannot apply migrations: this harness uses PostgREST, which does not carry DDL.
 * When the schema is absent it says so in one clear line and
 * points at supabase/README.md rather than reporting twelve confusing failures.
 *
 * The module body has no imports beyond node's own. The Supabase SDK, the entitlement
 * store and the server's hashing are pulled in only when a live run actually starts,
 * which is what keeps supabaseLive.test.ts instant and free of network-shaped risk.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface SupabaseProof {
  readonly id: string;
  /** What the check proves, in the words the report prints. */
  readonly title: string;
  /** Why it is in the inventory — the thing that goes wrong when it is not true. */
  readonly why: string;
}

/**
 * The inventory. A proof leaves this list only when the risk it covers is gone, never
 * because it was inconvenient to run.
 */
export const SUPABASE_PROOFS: readonly SupabaseProof[] = [
  {
    id: 'rls-two-user-isolation',
    title: 'neither signed-in learner can read the other account rows',
    why: 'row level security is the only wall between two learners on one shared database',
  },
  {
    id: 'forged-user-id-refused',
    title: 'a genuine token cannot insert, update or delete under another user id',
    why: 'a modified client that sends someone else id must be refused by the database, not by the app',
  },
  {
    id: 'anon-key-refused',
    title: 'the publishable anon key alone reads nothing and writes nothing',
    why: 'the anon key ships inside the mobile bundle and is therefore public',
  },
  {
    id: 'rpc-privilege',
    title: 'anon and authenticated cannot execute claim_trial or consume_entitlement, the service role can',
    why: 'a client that can call the debit can grant itself a plan or put seconds back',
  },
  {
    // The id is unchanged on purpose. It names the risk — what this database does with a
    // paid period that has ended — and a recorded run in docs/IMPLEMENTATION_EVIDENCE.md
    // is history that a rename would quietly rewrite. What it proves has changed, twice
    // over: F245 turned the roll into a lapse.
    id: 'period-roll',
    title: 'an expired paid period lapses to an exhausted trial, and a recently ended one is left alone',
    why: 'a database that renews a paid period the billing system did not sell is forging paid status',
  },
  {
    id: 'debit-concurrency',
    title: 'concurrent debits all land, with no lost update',
    why: 'a read-modify-write race is how metered minutes quietly become free',
  },
  {
    id: 'session-replay',
    title: 'a repeated session id debits exactly once',
    why: 'the agent retries its end report after a timeout, and a retry must not bill twice',
  },
  {
    id: 'cross-user-session-refused',
    title: 'a session id owned by another account is refused rather than merged',
    why: 'a shared session id would let one account push its minutes onto another',
  },
  {
    id: 'trial-refused-second-installation',
    title: 'the trial claim refuses a second installation rather than falling through on a null',
    why: 'F73: the NULL-unsafe guard granted every farmed trial, at real vendor cost each time',
  },
  {
    id: 'trial-race',
    title: 'two simultaneous first claims on one installation grant exactly one trial',
    why: 'the boundary has to hold under the double tap it will actually meet',
  },
  {
    id: 'product-event-trigger',
    title: 'the database rejects an unsupported or malformed product event',
    why: 'the client can insert events under RLS, so the same content-free schema must be enforced in SQL',
  },
  {
    id: 'deletion-cascade',
    title: 'deleting a disposable account removes the seeded legacy learner rows and keeps the pseudonymous antifraud hash',
    why: 'deletion has to be real, and the antifraud evidence has to survive it without identifying anyone',
  },
];

/**
 * The credentials a live run needs. The anon key is read from the mobile app's public
 * name first because that is where it already lives in this repo.
 */
export const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

export type Environment = Record<string, string | undefined>;

const anonKeyOf = (env: Environment): string | undefined =>
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;

/** Which of REQUIRED_ENV is absent or blank. Never returns a value, only names. */
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
    '  node --experimental-strip-types services/token-server/src/verify/supabaseLive.ts',
    `Unproven until then (${SUPABASE_PROOFS.length}):`,
  ];
  for (const proof of SUPABASE_PROOFS) lines.push(`  - ${proof.id}: ${proof.title}`);
  return lines.join('\n');
}

/** The one line to print when the credentials work but the schema was never applied. */
export function schemaMissingReport(detail: string): string {
  return [
    `BLOCKED: the Supabase project answers but the Luvani schema is not applied (missing: ${detail}).`,
    'Apply all migrations using the reviewed release procedure in supabase/README.md, then run this again.',
  ].join('\n');
}

/**
 * What the schema has to contain before any proof means anything, and one readable
 * column from each historical table these twelve proofs exercise. This is not the
 * current full catalog; the separate catalog preflight below checks its inventory.
 */
const SCHEMA_OBJECTS: readonly (readonly [string, string])[] = [
  ['learner_state', 'user_id'],
  ['product_events', 'id'],
  ['entitlements', 'user_id'],
  ['session_usage', 'session_id'],
  ['trial_installations', 'installation_hash'],
  ['billing_events', 'event_id'],
  ['conversation_packs', 'session_id'],
];

/**
 * Historical RPCs, probed with arguments they must reject. A missing function answers PGRST202;
 * a known validation exception proves the function is there. Permission/network or
 * unexpected success cannot establish this precondition. No probe writes a row.
 */
const ROUTINE_PROBES: readonly (readonly [string, Record<string, unknown>])[] = [
  ['consume_entitlement', { p_user_id: '00000000-0000-0000-0000-000000000000', p_seconds: -1, p_session_id: null }],
  ['claim_trial', { p_user_id: '00000000-0000-0000-0000-000000000000', p_installation_hash: '', p_user_hash: '' }],
  ['record_billing_event', { p_event_id: '', p_user_id: '00000000-0000-0000-0000-000000000000' }],
];

const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g;
const SUPABASE_KEY_SHAPE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g;

/**
 * Redaction is not cosmetic here. PostgREST and GoTrue echo request context into error
 * bodies, so an unredacted failure report is a plausible way to leak a service-role key
 * into a terminal, a CI log or a pasted bug report. Values handed in are removed by
 * identity; anything else with the shape of a JWT or a Supabase key is removed by shape.
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
 * Without this, a harness that quietly stopped running half its checks still exits 0.
 */
export function summarise(results: readonly CheckResult[]): Summary {
  const byId = new Map(results.map((result) => [result.id, result]));
  const lines: string[] = [];
  let ok = true;

  for (const proof of SUPABASE_PROOFS) {
    const result = byId.get(proof.id);
    if (!result) {
      ok = false;
      lines.push(`MISS ${proof.id}: never ran — ${proof.title}`);
      continue;
    }
    if (result.outcome !== 'passed') ok = false;
    lines.push(`${MARK[result.outcome]} ${proof.id} (${Math.round(result.ms)} ms): ${result.detail}`);
  }

  const declared = new Set(SUPABASE_PROOFS.map((proof) => proof.id));
  for (const result of results) {
    if (declared.has(result.id)) continue;
    ok = false;
    lines.push(`UNKNOWN ${result.id}: a result no proof in the inventory declares`);
  }

  const failed = SUPABASE_PROOFS.length - results.filter((r) => r.outcome === 'passed' && declared.has(r.id)).length;
  lines.push(
    ok
      ? `all ${SUPABASE_PROOFS.length} Supabase proofs passed`
      : `${failed} of ${SUPABASE_PROOFS.length} Supabase proofs did not pass`,
  );
  return { ok, lines };
}

/** Thrown by a check that did not hold. The message is redacted before it is printed. */
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * The SQLSTATE of a refusal, or `no-error` when the call was allowed.
 *
 * A refusal read by truthiness is barely a refusal: 42501 (row level security, or
 * permission denied) and P0001 (a RAISE in one of our own functions) mean the boundary
 * held, while 42883 or 23503 mean something else went wrong first and the boundary was
 * never reached. Every negative assertion in this file names the code it expects.
 */
export function codeOf(outcome: { error?: unknown } | null | undefined): string {
  const error = outcome?.error as { code?: unknown } | null | undefined;
  if (!error) return 'no-error';
  return typeof error.code === 'string' ? error.code : 'unknown';
}

/** The message of a refusal, so a check can prove which rule refused it. */
export function messageOf(outcome: { error?: unknown } | null | undefined): string {
  const error = outcome?.error as { message?: unknown } | null | undefined;
  if (!error) return '';
  return typeof error.message === 'string' ? error.message : String(error);
}

interface Recorder {
  readonly results: CheckResult[];
  check(id: string, body: () => Promise<string>): Promise<void>;
  skip(id: string, why: string): void;
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
    skip(id: string, why: string): void {
      results.push({ id, outcome: 'skipped', detail: redact(why), ms: 0 });
      log(`SKIP ${id}: ${redact(why)}`);
    },
  };
}

/** Minimal type-only grant seam. Fixtures must bind a session before its debit. */
interface LegacyGrantStore<E> {
  get(userId: string): Promise<E>;
  recordSessionGrant(userId: string, sessionId: string, expected: E): Promise<boolean>;
}
export async function registerLegacySessions<E>(store: LegacyGrantStore<E>, userId: string, sessionIds: readonly string[]): Promise<void> {
  if (sessionIds.length === 0 || new Set(sessionIds).size !== sessionIds.length) throw new Error('invalid legacy fixture session ids');
  const expected = await store.get(userId);
  for (const sessionId of sessionIds) {
    if (await store.recordSessionGrant(userId, sessionId, expected) !== true) throw new Error('legacy verification session grant refused');
  }
}

interface CatalogShape {
  tables: readonly { schema: string; name: string; rls: boolean; privileges: { anon: { select: boolean }; authenticated: { select: boolean } } }[];
  policies: readonly Record<string, unknown>[];
  routines: readonly { schema: string; name: string; arguments: string; securityDefiner: boolean; configuration: readonly string[] | null;
    definitionMd5: string; execute: { anon: boolean; authenticated: boolean } }[];
}
/** Narrow REST inventory/client ACL/policy preflight. Full columns/service/default ACLs require the SQL CLI. */
export function currentInventoryProblems(expected: CatalogShape, actual: unknown): string[] {
  if (!actual || typeof actual !== 'object') return ['backend_catalog_v1 returned no catalog'];
  const catalog = actual as { tables?: readonly { schema: string; name: string; rls: boolean; anonSelect: boolean; authenticatedSelect: boolean }[];
    routines?: readonly Record<string, unknown>[]; policies?: readonly Record<string, unknown>[] };
  if (!Array.isArray(catalog.tables) || !Array.isArray(catalog.routines) || !Array.isArray(catalog.policies)
    || [...catalog.tables, ...catalog.routines, ...catalog.policies].some(row => !row || typeof row !== 'object')) return ['backend_catalog_v1 returned malformed catalog'];
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  const problems: string[] = [];
  const key = (row: { schema: string; name: string; arguments?: string }) => `${row.schema}.${row.name}${row.arguments === undefined ? '' : '(' + row.arguments + ')'}`;
  for (const table of expected.tables) {
    const observed = catalog.tables.find(t => key(t) === key(table));
    if (!observed || observed.rls !== table.rls || observed.anonSelect !== table.privileges.anon.select
      || observed.authenticatedSelect !== table.privileges.authenticated.select) problems.push(`table/RLS/client ACL ${key(table)}`);
  }
  for (const table of catalog.tables) if (!expected.tables.some(t => key(t) === key(table))) problems.push(`unexpected table ${key(table)}`);
  if (JSON.stringify(stable(expected.policies)) !== JSON.stringify(stable(catalog.policies))) problems.push('RLS policy source drift');
  for (const routine of expected.routines) {
    const observed = catalog.routines.find(r => r.schema === routine.schema && r.name === routine.name && r.arguments === routine.arguments);
    if (!observed || observed.securityDefiner !== routine.securityDefiner || observed.definitionMd5 !== routine.definitionMd5
      || JSON.stringify(observed.configuration) !== JSON.stringify(routine.configuration)
      || observed.anonExecute !== routine.execute.anon || observed.authenticatedExecute !== routine.execute.authenticated) problems.push(`routine/ACL ${key(routine)}`);
  }
  for (const routine of catalog.routines) if (!expected.routines.some(r => r.schema === routine.schema && r.name === routine.name && r.arguments === routine.arguments)) problems.push('unexpected routine in current inventory');
  return problems;
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

/** A learner created for this run: real account, real password, real access token. */
interface Learner {
  readonly id: string;
  readonly email: string;
  readonly token: string;
}

const PASSWORD_LENGTH = 24;
const newPassword = (): string => randomUUID().replace(/-/g, '').slice(0, PASSWORD_LENGTH);
const newEmail = (): string => `luvani-verify-${randomUUID()}@example.com`;

/** A 43-character base64url signal, the same shape the token server sends. */
const signal = (kind: string, value: string): string =>
  createHmac('sha256', 'luvani-supabase-verify').update(`${kind}\0${value}`).digest('base64url');

/**
 * Run every proof against the live project.
 *
 * Returns rather than exits, so the CLI at the bottom of this file and a future caller
 * see the same report.
 */
export async function runSupabaseVerification(options: RunOptions): Promise<RunReport> {
  const log = options.log ?? (() => {});
  const env = options.env;
  const missing = missingEnvironment(env);
  const anonKey = anonKeyOf(env);
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const redact = makeRedactor([serviceRoleKey, anonKey]);

  if (missing.length > 0 || !url || !serviceRoleKey || !anonKey) {
    const report = blockedReport(missing.length > 0 ? missing : [...REQUIRED_ENV]);
    for (const line of report.split('\n')) log(line);
    return { ok: false, blocked: true, results: [], lines: report.split('\n') };
  }

  if (env.LUVANI_SUPABASE_VERIFY_DISPOSABLE !== '1') {
    const lines = ['BLOCKED: this harness creates/deletes accounts and requires LUVANI_SUPABASE_VERIFY_DISPOSABLE=1 on an isolated disposable project.',
      'The separate scripts/verifyCurrentHostedSchema.mjs workflow is read-only and does not run these twelve historical proofs.'];
    for (const line of lines) log(line);
    return { ok: false, blocked: true, results: [], lines };
  }

  const { createClient } = await import('@supabase/supabase-js');
  const { SupabaseEntitlementStore } = await import('../store.ts');

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The one client that stays anonymous for the whole run. Nothing may ever sign in on
  // this instance: `persistSession: false` chooses memory over localStorage, it does not
  // stop GoTrue keeping a session, and a stored session makes every later request travel
  // as that learner's `authenticated` JWT instead of the bare anon key. See learner().
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = new SupabaseEntitlementStore(url, serviceRoleKey);

  // Preflight. Twelve failures that all mean "no tables" is a worse report than one line
  // that says so. This harness never applies migrations or changes launch config.
  //
  // The read is deliberately a one-row select rather than a HEAD count: PostgREST answers
  // a HEAD request for a table it cannot find with 204 and no error at all, which would
  // let this walk straight past a project that has no schema.
  const absent: string[] = [];
  const preflightErrors: string[] = [];
  for (const [table, column] of SCHEMA_OBJECTS) {
    const probe = await admin.from(table).select(column).limit(1);
    if (probe.error?.code === 'PGRST205' || probe.error?.code === '42P01') absent.push(`table ${table}`);
    else if (probe.error) preflightErrors.push(`table ${table}: ${codeOf(probe)}`);
  }
  for (const [routine, args] of ROUTINE_PROBES) {
    const probe = await admin.rpc(routine, args);
    if (probe.error?.code === 'PGRST202' || probe.error?.code === '42883') absent.push(`function ${routine}`);
    else if (!probe.error || !['P0001', '22023', 'PT400'].includes(codeOf(probe))) preflightErrors.push(`function ${routine}: expected validation refusal, received ${codeOf(probe)}`);
  }
  if (absent.length > 0 || preflightErrors.length > 0) {
    const report = absent.length ? schemaMissingReport(absent.join(', ')) : `BLOCKED: historical schema preflight unresolved: ${preflightErrors.join(', ')}`;
    const results = SUPABASE_PROOFS.map((proof) => ({
      id: proof.id,
      outcome: 'skipped' as const,
      detail: 'schema not applied',
      ms: 0,
    }));
    const lines = [...report.split('\n'), ...summarise(results).lines];
    for (const line of lines) log(line);
    return { ok: false, blocked: true, results, lines };
  }

  // Read-only narrow REST inventory. Do not label it a full catalog/security proof.
  const { buildSchemaManifest } = await import(new URL('../../../../scripts/releaseSchemaManifest.mjs', import.meta.url).href);
  const expectedSchema = await buildSchemaManifest(undefined, { catalogContext: 'rest' }) as { catalog: CatalogShape; migrationCount: number };
  const observedCatalog = await admin.rpc('backend_catalog_v1');
  const inventoryProblems = observedCatalog.error ? [`backend_catalog_v1 ${codeOf(observedCatalog)}`] : currentInventoryProblems(expectedSchema.catalog, observedCatalog.data);
  const admission = await admin.rpc('tutor_session_schema_v1');
  if (admission.error || admission.data?.enabled !== false) inventoryProblems.push('legacy proof fixtures require tutor admission OFF; harness never changes admission');
  if (inventoryProblems.length) {
    const results = SUPABASE_PROOFS.map(proof => ({ id: proof.id, outcome: 'skipped' as const, detail: 'current inventory/preconditions unresolved', ms: 0 }));
    const lines = [`BLOCKED: current ${expectedSchema.migrationCount}-migration inventory/preconditions unresolved: ${inventoryProblems.slice(0,30).join(', ')}`,
      'Function-definition drift may include PostgreSQL formatting/version differences; review rather than ignore it. Use verifyCurrentHostedSchema.mjs for full SQL catalog evidence.', ...summarise(results).lines];
    for (const line of lines) log(redact(line));
    return { ok: false, blocked: true, results, lines };
  }
  log(`Current ${expectedSchema.migrationCount}-migration REST inventory/client ACL/policy preflight matched; full SQL catalog and v1 lifecycle hosted acceptance remain separate.`);

  const created: string[] = [];
  const installations: string[] = [];
  const run = recorder(redact, log);

  /** Create an account and sign it in, so PostgREST sees the real authenticated role. */
  const learner = async (): Promise<Learner> => {
    const email = newEmail();
    const password = newPassword();
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(!account.error, `could not create a verification account: ${redact(account.error)}`);
    const id = account.data.user?.id;
    expect(typeof id === 'string', 'the created account has no id');
    created.push(id as string);
    // A throwaway client per learner, deliberately not the shared `anon` one. Signing in
    // on `anon` would leave a session on it, and anon-key-refused and the anon leg of
    // rpc-privilege would then both be measuring the authenticated role while claiming to
    // measure anon — a proof that passes for the wrong reason, which is worse than none.
    const gate = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await gate.auth.signInWithPassword({ email, password });
    expect(!signedIn.error, `could not sign in a verification account: ${redact(signedIn.error)}`);
    const token = signedIn.data.session?.access_token;
    expect(typeof token === 'string', 'sign-in returned no access token');
    return { id: id as string, email, token: token as string };
  };

  /** A PostgREST client that is the learner: anon key plus their own bearer. */
  const asLearner = (who: Learner): SupabaseClientLike =>
    createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${who.token}` } },
    }) as unknown as SupabaseClientLike;

  try {
    const alice = await learner();
    const bob = await learner();
    const aliceDb = asLearner(alice);
    const bobDb = asLearner(bob);
    const adminDb = admin as unknown as SupabaseClientLike;

    // Both learners need rows of their own before isolation means anything, and an
    // entitlement has to be claimed rather than conjured: consume_entitlement raises for
    // a user who was never provisioned, which is the same order the server uses.
    for (const [who, client] of [
      [alice, aliceDb],
      [bob, bobDb],
    ] as const) {
      const written = await client
        .from('learner_state')
        .upsert({ user_id: who.id, namespace: 'profile', payload: { level: 'a1' } });
      expect(!written.error, `a learner could not write their own state: ${redact(written.error)}`);
      const device = signal('installation', randomUUID());
      installations.push(device);
      const claimed = await store.claimTrial(who.id, device, signal('user', who.id));
      expect(claimed === true, 'a fresh account on a fresh installation was refused its trial');
    }

    await run.check('rls-two-user-isolation', async () => {
      const mine = await aliceDb.from('learner_state').select('user_id, namespace');
      expect(!mine.error, `own state read failed: ${redact(mine.error)}`);
      expect((mine.data ?? []).length > 0, 'a learner cannot read their own state');
      expect(
        (mine.data ?? []).every((row) => row.user_id === alice.id),
        'a learner state read returned another account row',
      );
      const theirs = await aliceDb.from('learner_state').select('user_id').eq('user_id', bob.id);
      expect((theirs.data ?? []).length === 0, 'a learner read another account state by asking for it directly');
      const theirEntitlement = await aliceDb.from('entitlements').select('user_id').eq('user_id', bob.id);
      expect((theirEntitlement.data ?? []).length === 0, 'a learner read another account entitlement');
      return 'own rows only, in both learner_state and entitlements';
    });

    await run.check('forged-user-id-refused', async () => {
      const forgedInsert = await aliceDb
        .from('learner_state')
        .insert({ user_id: bob.id, namespace: 'journal', payload: { forged: true } });
      expect(forgedInsert.error, 'a learner inserted a row under another account id');
      const forgedUpdate = await aliceDb
        .from('learner_state')
        .update({ payload: { forged: true } })
        .eq('user_id', bob.id);
      const forgedDelete = await aliceDb.from('learner_state').delete().eq('user_id', bob.id);
      const survivor = await adminDb
        .from('learner_state')
        .select('user_id, payload')
        .eq('user_id', bob.id)
        .eq('namespace', 'profile');
      expect((survivor.data ?? []).length === 1, 'another account row did not survive a forged update or delete');
      const payload = (survivor.data ?? [])[0]?.payload as { forged?: boolean; level?: string } | undefined;
      expect(payload?.forged !== true, 'a forged update rewrote another account payload');
      expect(payload?.level === 'a1', 'another account payload was altered');
      return `insert refused, update and delete changed nothing (${forgedUpdate.error ? 'error' : 'zero rows'}, ${
        forgedDelete.error ? 'error' : 'zero rows'
      })`;
    });

    await run.check('anon-key-refused', async () => {
      // First prove the client is what the proof says it is. This check once measured a
      // signed-in learner, read that learner's own row, and reported a security failure
      // that was not there. An anon proof made with an authenticated token proves nothing
      // in either direction, so the role comes before the assertions about it.
      const session = await anon.auth.getSession();
      expect(
        !session.data.session,
        'the anon client carries a session, so this proof would be measuring the authenticated role',
      );

      const read = await anon.from('learner_state').select('user_id');
      expect((read.data ?? []).length === 0, 'the anon key read learner state');
      const entitlements = await anon.from('entitlements').select('user_id');
      expect((entitlements.data ?? []).length === 0, 'the anon key read entitlements');

      // Every refusal is read by its SQLSTATE, not by truthiness. 42501 is the database
      // saying no — row level security on a table the anon role may reach, permission
      // denied on one it may not. Any other code means something else refused the write
      // and the boundary this proof is about was never exercised.
      const write = await anon
        .from('learner_state')
        .insert({ user_id: alice.id, namespace: 'journal', payload: {} });
      expect(
        codeOf(write) === '42501',
        `an anon learner_state insert was refused by ${codeOf(write)} rather than row level security`,
      );
      const event = await anon
        .from('product_events')
        .insert({ user_id: alice.id, name: 'my_french_opened', properties: { situationsDone: 1, linesKept: 1 } });
      expect(
        codeOf(event) === '42501',
        `an anon product_events insert was refused by ${codeOf(event)} rather than row level security`,
      );
      const usage = await anon.from('session_usage').select('session_id');
      expect(
        codeOf(usage) === '42501',
        `the anon key reached the billing ledger: ${codeOf(usage)} instead of permission denied`,
      );
      return 'no session on the anon client, anon reads are empty, anon writes refused with 42501';
    });

    await run.check('rpc-privilege', async () => {
      // `anon` here is the never-signed-in client, which is the only reason this loop
      // covers two roles rather than running the authenticated leg twice under two names.
      for (const [name, client] of [
        ['anon', anon as unknown as SupabaseClientLike],
        ['authenticated', aliceDb],
      ] as const) {
        const debit = await client.rpc('consume_entitlement', {
          p_user_id: alice.id,
          p_seconds: 600,
          p_session_id: null,
        });
        expect(codeOf(debit) === '42501', `${name} consume_entitlement refusal was ${codeOf(debit)}, expected permission denied`);
        const claim = await client.rpc('claim_trial', {
          p_user_id: alice.id,
          p_installation_hash: signal('installation', randomUUID()),
          p_user_hash: signal('user', alice.id),
        });
        expect(codeOf(claim) === '42501', `${name} claim_trial refusal was ${codeOf(claim)}, expected permission denied`);
      }
      const allowed = await adminDb.rpc('consume_entitlement', {
        p_user_id: alice.id,
        p_seconds: 0,
        p_session_id: null,
      });
      expect(!allowed.error, `the service role could not execute the debit: ${redact(allowed.error)}`);
      return 'both RPCs refuse anon and authenticated, and answer the service role';
    });

    await run.check('period-roll', async () => {
      // F245. This check used to seed a period that ended 24 hours ago and assert that
      // the database cleared the counter and granted thirty more days — the defect,
      // written down as the expected result. 202608300002 makes the database refuse to
      // grant paid time at all, so both sides of the 24 hour slack are proved here: a
      // period that ended an hour ago is left exactly as it is, because a webhook is
      // allowed to be late, and one that ended two days ago lapses.
      const withinSlack = new Date(Date.now() - 60 * 60 * 1000);
      const seededRecent = await adminDb
        .from('entitlements')
        .update({ plan: 'starter', seconds_used: 9000, period_end: withinSlack.toISOString() })
        .eq('user_id', bob.id);
      expect(!seededRecent.error, `could not seed a recently ended period: ${redact(seededRecent.error)}`);
      const held = await store.get(bob.id);
      expect(held.plan === 'starter', `a period one hour past its end lost its plan: ${held.plan}`);
      expect(held.secondsUsed === 9000, `a period one hour past its end moved the counter to ${held.secondsUsed}`);
      expect(
        held.periodEnd !== undefined && held.periodEnd.getTime() === withinSlack.getTime(),
        `a period one hour past its end was rewritten to ${held.periodEnd?.toISOString()}`,
      );

      const expired = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const seeded = await adminDb
        .from('entitlements')
        .update({ plan: 'starter', seconds_used: 9000, period_end: expired })
        .eq('user_id', bob.id);
      expect(!seeded.error, `could not seed an expired period: ${redact(seeded.error)}`);
      const lapsed = await store.get(bob.id);
      expect(lapsed.plan === 'trial', `an expired paid period kept its paid plan: ${lapsed.plan}`);
      expect(lapsed.secondsUsed === 1800, `an expired paid period left ${lapsed.secondsUsed} seconds used, expected 1800`);
      expect(lapsed.periodEnd === undefined, `an expired paid period was granted one ending ${lapsed.periodEnd?.toISOString()}`);
      return 'a period one hour past its end held; one 48 hours past it lapsed to an exhausted trial';
    });

    await run.check('debit-concurrency', async () => {
      const reset = await adminDb
        .from('entitlements')
        .update({ plan: 'regular', seconds_used: 0, period_end: new Date(Date.now() + 86_400_000).toISOString() })
        .eq('user_id', bob.id);
      expect(!reset.error, `could not reset the allowance: ${redact(reset.error)}`);
      const sessionIds = Array.from({ length: 10 }, () => randomUUID());
      await registerLegacySessions(store, bob.id, sessionIds);
      const debits = sessionIds.map(sessionId => store.consume(bob.id, 60, sessionId));
      await Promise.all(debits);
      const after = await store.get(bob.id);
      expect(after.secondsUsed === 600, `ten concurrent 60s debits left ${after.secondsUsed}s used, expected 600`);
      return 'ten concurrent debits of 60s all landed';
    });

    // These next two are F74. 202608230001 wrote the idempotency guard as
    // `insert ... on conflict do nothing returning true into recorded; if not recorded`,
    // the same RETURNING-INTO-NULL shape F73 closed in claim_trial, so both arms of the
    // boundary were dead: a replay billed again and a foreign session id was merged.
    // supabase/migrations/202608250001_consume_entitlement_null_fix.sql is the fix. The
    // checks are written to the promise the 202608230001 header makes, and they fail on
    // any database that has not had the fix applied.
    await run.check('session-replay', async () => {
      const before = await store.get(bob.id);
      const sessionId = randomUUID();
      await registerLegacySessions(store, bob.id, [sessionId]);
      await store.consume(bob.id, 120, sessionId);
      const once = await store.get(bob.id);
      await store.consume(bob.id, 120, sessionId);
      const twice = await store.get(bob.id);
      expect(
        once.secondsUsed === before.secondsUsed + 120,
        `the first report billed ${once.secondsUsed - before.secondsUsed}s, expected 120`,
      );
      expect(twice.secondsUsed === once.secondsUsed, `a replayed session id billed a second time`);

      // The ledger and the balance have to tell the same story. Before the fix they did
      // not: one row in session_usage, two debits on the entitlement, and nothing in the
      // stack that could ever notice the disagreement.
      const ledger = await adminDb.from('session_usage').select('session_id, seconds').eq('session_id', sessionId);
      expect((ledger.data ?? []).length === 1, `the replayed session left ${(ledger.data ?? []).length} ledger rows`);
      expect((ledger.data ?? [])[0]?.seconds === 120, 'the ledger row does not carry the seconds that were billed');
      return `120s billed once across two identical reports (${before.secondsUsed} -> ${twice.secondsUsed}), one ledger row`;
    });

    await run.check('cross-user-session-refused', async () => {
      const sessionId = randomUUID();
      await registerLegacySessions(store, alice.id, [sessionId]);
      await store.consume(alice.id, 30, sessionId);
      const before = await store.get(bob.id);
      let refused = false;
      try {
        await store.consume(bob.id, 30, sessionId);
      } catch {
        refused = true;
      }
      expect(refused, 'another account session id was accepted');

      // The production path throws away the reason — store.consume raises
      // `entitlement debit failed (400)` and nothing more — so the same call is made
      // once more straight at the RPC, to read which rule actually refused it. Without
      // this the check would stay green on any failure at all, including one that
      // refused for a reason with nothing to do with ownership.
      const direct = await adminDb.rpc('consume_entitlement', {
        p_user_id: bob.id,
        p_seconds: 30,
        p_session_id: sessionId,
      });
      expect(
        messageOf(direct).includes('already belongs to another account'),
        `a foreign session id was refused by ${codeOf(direct)} "${messageOf(direct)}", not by the ownership guard`,
      );

      const after = await store.get(bob.id);
      expect(after.secondsUsed === before.secondsUsed, 'a foreign session id changed the balance before refusing');
      const owner = await adminDb.from('session_usage').select('user_id').eq('session_id', sessionId);
      expect((owner.data ?? [])[0]?.user_id === alice.id, 'a refused report rewrote the ledger owner');
      return 'a session id owned by another account is refused by name and bills nothing';
    });

    // F73. The whole point of the forward migration, proved by behaviour rather than by
    // reading the file: a second account on one device must be refused.
    await run.check('trial-refused-second-installation', async () => {
      const device = signal('installation', randomUUID());
      installations.push(device);
      const first = await learner();
      const second = await learner();
      const granted = await store.claimTrial(first.id, device, signal('user', first.id));
      expect(granted === true, 'a genuine first claim on a fresh installation was refused');
      const refused = await store.claimTrial(second.id, device, signal('user', second.id));
      expect(
        refused === false,
        'a second account on the same installation was granted a trial — the NULL-unsafe guard is live (F73)',
      );
      const rows = await adminDb.from('trial_installations').select('installation_hash').eq('installation_hash', device);
      expect((rows.data ?? []).length === 1, 'the refused claim still wrote an installation row');
      const entitlement = await adminDb.from('entitlements').select('user_id').eq('user_id', second.id);
      expect((entitlement.data ?? []).length === 0, 'the refused account was provisioned an entitlement anyway');
      const otherDevice = signal('installation', randomUUID());
      installations.push(otherDevice);
      const acrossDevices = await store.claimTrial(second.id, otherDevice, signal('user', first.id));
      expect(acrossDevices === false, 'one account signal claimed a trial on a second device');
      return 'second account on one device refused, and one account signal refused across devices';
    });

    await run.check('trial-race', async () => {
      // Six accounts, not two, and every account created before the first claim is sent,
      // so the six requests are genuinely in flight together rather than separated by the
      // round trips that create them. Two sequential-ish calls proved nothing this check
      // did not already get from trial-refused-second-installation.
      const device = signal('installation', randomUUID());
      installations.push(device);
      const racers = [];
      for (let i = 0; i < 6; i += 1) racers.push(await learner());

      const outcomes = await Promise.all(
        racers.map((who) => store.claimTrial(who.id, device, signal('user', who.id)).catch(() => 'threw' as const)),
      );
      const grants = outcomes.filter((outcome) => outcome === true).length;
      expect(grants === 1, `six simultaneous first claims granted ${grants} trials, expected exactly 1`);
      const rows = await adminDb.from('trial_installations').select('installation_hash').eq('installation_hash', device);
      expect((rows.data ?? []).length === 1, 'a race wrote more than one installation row');

      // The boolean is what the server reads, but the entitlement row is what costs
      // money. Count them: a race that answered false and provisioned anyway would be
      // the same P0 wearing a different coat.
      let provisioned = 0;
      for (const who of racers) {
        const owned = await adminDb.from('entitlements').select('user_id').eq('user_id', who.id);
        provisioned += (owned.data ?? []).length;
      }
      expect(provisioned === 1, `six racing claims provisioned ${provisioned} entitlements, expected exactly 1`);
      return 'exactly one of six simultaneous claims was granted, and exactly one entitlement exists';
    });

    await run.check('product-event-trigger', async () => {
      const valid = await aliceDb
        .from('product_events')
        .insert({ user_id: alice.id, name: 'mission_started', properties: { missionId: 'cafe-01', entry: 'home' } });
      expect(!valid.error, `a valid product event was refused: ${redact(valid.error)}`);
      // Each refusal is read by its message, not by truthiness. A trigger that cannot
      // even load raises too, and for a while every one of these lines was green against
      // a trigger that rejected all five events including the valid one.
      const unsupported = await aliceDb
        .from('product_events')
        .insert({ user_id: alice.id, name: 'transcript_captured', properties: { text: 'bonjour' } });
      expect(
        messageOf(unsupported).includes('unsupported product event'),
        `an unsupported event was refused by ${codeOf(unsupported)} "${messageOf(unsupported)}"`,
      );
      const malformed = await aliceDb
        .from('product_events')
        .insert({ user_id: alice.id, name: 'mission_started', properties: { missionId: 'cafe-01', entry: 'nowhere' } });
      expect(
        messageOf(malformed).includes('invalid mission_started event'),
        `a malformed mission_started was refused by ${codeOf(malformed)} "${messageOf(malformed)}"`,
      );
      const extra = await aliceDb.from('product_events').insert({
        user_id: alice.id,
        name: 'my_french_opened',
        properties: { situationsDone: 1, linesKept: 1, transcript: 'bonjour' },
      });
      expect(
        messageOf(extra).includes('invalid my_french_opened event'),
        `an event carrying an extra property was refused by ${codeOf(extra)} "${messageOf(extra)}"`,
      );

      // The valid insert above did land, so this read has something to be refused. It
      // used to be made against an empty table, which made it prove nothing at all.
      const written = await adminDb.from('product_events').select('name').eq('user_id', alice.id);
      expect((written.data ?? []).length === 1, `the valid event left ${(written.data ?? []).length} rows, expected 1`);
      const history = await aliceDb.from('product_events').select('id');
      expect((history.data ?? []).length === 0, 'a learner read their own product event history');
      return 'valid events land, unsupported and malformed events are refused by name, history is not readable';
    });

    await run.check('deletion-cascade', async () => {
      const doomed = await learner();
      const doomedDb = asLearner(doomed);
      const device = signal('installation', randomUUID());
      installations.push(device);
      await store.claimTrial(doomed.id, device, signal('user', doomed.id));
      const state = await doomedDb.from('learner_state').upsert({ user_id: doomed.id, namespace: 'profile', payload: { a: 1 } });
      expect(!state.error, `could not seed learner state to cascade: ${redact(state.error)}`);
      // Checked, not fired and forgotten. An unwritten event cascades to empty for free,
      // which would make the product_events assertion below vacuous.
      const seeded = await doomedDb
        .from('product_events')
        .insert({ user_id: doomed.id, name: 'my_french_opened', properties: { situationsDone: 1, linesKept: 2 } });
      expect(!seeded.error, `could not seed a product event to cascade: ${redact(seeded.error)}`);
      const pack = await adminDb.from('conversation_packs').insert({
        id: randomUUID(),
        session_id: randomUUID(),
        user_id: doomed.id,
        state: 'ready',
        payload: {},
      });
      expect(!pack.error, `could not seed a Conversation Pack to cascade: ${redact(pack.error)}`);
      const sessionId = randomUUID();
      await registerLegacySessions(store, doomed.id, [sessionId]);
      await store.consume(doomed.id, 45, sessionId);

      const removed = await admin.auth.admin.deleteUser(doomed.id);
      expect(!removed.error, `account deletion failed: ${redact(removed.error)}`);
      const alreadyGone = created.indexOf(doomed.id);
      if (alreadyGone >= 0) created.splice(alreadyGone, 1);

      for (const table of ['learner_state', 'product_events', 'entitlements', 'session_usage', 'session_grants', 'conversation_packs'] as const) {
        const left = await adminDb.from(table).select('user_id').eq('user_id', doomed.id);
        expect((left.data ?? []).length === 0, `${table} kept rows for a deleted account`);
      }
      const antifraud = await adminDb
        .from('trial_installations')
        .select('installation_hash')
        .eq('installation_hash', device);
      expect((antifraud.data ?? []).length === 1, 'the pseudonymous antifraud row did not survive account deletion');
      return 'six seeded legacy learner tables cascaded to empty, the antifraud hash survived; v1/privacy workflows remain separate acceptance';
    });
  } catch (err) {
    // A failure in the fixtures themselves is not a proof of anything. Everything that
    // did not run stays visibly unrun, which summarise() turns into a failing exit.
    log(`ERROR before the run finished: ${redact(err)}`);
  } finally {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    for (const hash of installations) {
      await admin.from('trial_installations').delete().eq('installation_hash', hash);
    }
  }

  const summary = summarise(run.results);
  for (const line of summary.lines) log(line);
  return { ok: summary.ok, blocked: false, results: run.results, lines: summary.lines };
}

/**
 * The narrow slice of the SDK this file uses.
 *
 * Written out rather than imported as SupabaseClient because the generated client type is
 * parameterised by a generated database schema this repo does not have, and a harness is
 * a poor place to argue with a type parameter.
 */
interface PostgrestOutcome {
  data: Record<string, unknown>[] | null;
  error: unknown;
}
interface PostgrestFilter extends PromiseLike<PostgrestOutcome> {
  eq(column: string, value: unknown): PostgrestFilter;
}
interface PostgrestTable {
  select(columns?: string, options?: { head?: boolean; count?: 'exact' }): PostgrestFilter;
  insert(rows: Record<string, unknown>): PostgrestFilter;
  upsert(rows: Record<string, unknown>): PostgrestFilter;
  update(patch: Record<string, unknown>): PostgrestFilter;
  delete(): PostgrestFilter;
}
interface SupabaseClientLike {
  from(table: string): PostgrestTable;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<PostgrestOutcome>;
}

/** Entry point. Blocked, failed and errored all exit non-zero; only a full pass exits 0. */
async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  // The token server's own env file, not the caller's cwd: this is run from the repo
  // root and the credentials live beside the service that uses them. LUVANI_ENV_FILE
  // points somewhere else, which is how the self-test proves the blocked path without
  // borrowing this machine's real credentials.
  const envFile = process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../.env', import.meta.url));
  dotenv.config({ path: envFile, override: false, quiet: true });
  const report = await runSupabaseVerification({ env: process.env, log: (line) => console.log(line) });
  process.exitCode = report.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
