/**
 * What the gate can honestly check about a live-credential harness is the harness, not
 * the database. So these tests hold it to the three promises in its header: the
 * inventory is complete, a proof that did not pass cannot be reported as passing, and no
 * key it was handed ever reaches an output line.
 *
 * The database proofs themselves are in SUPABASE_PROOFS and only a live run against a
 * disposable project can close them. Nothing here should ever be read as "Supabase
 * verified" — see docs/IMPLEMENTATION_EVIDENCE.md for what is measured and what is not.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  REQUIRED_ENV,
  currentInventoryProblems,
  registerLegacySessions,
  SUPABASE_PROOFS,
  blockedReport,
  codeOf,
  makeRedactor,
  messageOf,
  missingEnvironment,
  runSupabaseVerification,
  schemaMissingReport,
  summarise,
  type CheckResult,
} from './supabaseLive.ts';

const HARNESS = fileURLToPath(new URL('./supabaseLive.ts', import.meta.url));
const NO_ENV_FILE = path.join(tmpdir(), `luvani-no-env-${randomUUID()}`);

/** Every proof passing — the baseline the honesty tests deform one field at a time. */
const allPassing = (): CheckResult[] =>
  SUPABASE_PROOFS.map((proof) => ({ id: proof.id, outcome: 'passed' as const, detail: 'ok', ms: 1 }));

/** Run the harness as the command it actually is, and read what it printed. */
function runCli(env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', HARNESS], {
      encoding: 'utf8',
      // An env file that does not exist, so this machine's real credentials cannot
      // wander into a test through services/token-server/.env.
      env: { PATH: process.env.PATH ?? '', LUVANI_ENV_FILE: NO_ENV_FILE, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

describe('the supabase live harness is honest about what it proved', () => {
  test('the supabase harness enumerates every required proof and reports blocked without credentials', async () => {
    const required = [
      'rls-two-user-isolation',
      'forged-user-id-refused',
      'anon-key-refused',
      'rpc-privilege',
      'period-roll',
      'debit-concurrency',
      'session-replay',
      'cross-user-session-refused',
      'trial-refused-second-installation',
      'trial-race',
      'product-event-trigger',
      'deletion-cascade',
    ];
    const ids = SUPABASE_PROOFS.map((proof) => proof.id);
    assert.deepEqual([...ids].sort(), [...required].sort(), 'the inventory is not the twelve proofs the phase requires');
    assert.equal(new Set(ids).size, 12, 'a proof id is duplicated, so one risk is counted twice');
    for (const proof of SUPABASE_PROOFS) {
      assert.ok(proof.title.trim().length > 0, `${proof.id} has no title`);
      assert.ok(proof.why.trim().length > 0, `${proof.id} does not say what goes wrong without it`);
    }

    assert.deepEqual(missingEnvironment({}), [...REQUIRED_ENV]);
    assert.deepEqual(missingEnvironment({ SUPABASE_URL: '   ' }), [...REQUIRED_ENV], 'a blank value is not a credential');
    assert.deepEqual(
      missingEnvironment({
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SUPABASE_ANON_KEY: 'anon',
      }),
      [],
      'the anon key is accepted under either of its two names',
    );

    const report = blockedReport(missingEnvironment({}));
    assert.match(report, /^BLOCKED:/);
    for (const name of REQUIRED_ENV) assert.match(report, new RegExp(name));
    for (const proof of SUPABASE_PROOFS) assert.match(report, new RegExp(proof.id));

    // The run function refuses rather than claiming anything, without touching a network.
    const lines: string[] = [];
    const blocked = await runSupabaseVerification({ env: {}, log: (line) => lines.push(line) });
    assert.equal(blocked.ok, false, 'a run with no credentials must not be ok');
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.results.length, 0, 'a blocked run must not invent results');
    assert.match(lines.join('\n'), /^BLOCKED:/);

    // And the command exits non-zero, naming what is missing.
    const cli = runCli({});
    assert.equal(cli.code, 1, 'the harness exited zero with no credentials');
    assert.match(cli.out, /BLOCKED:/);
    for (const name of REQUIRED_ENV) assert.match(cli.out, new RegExp(name));
  });

  test('the supabase harness never prints a key or token it was given', async () => {
    // Assembled rather than written out: these are invented values, but a repository
    // secret scanner cannot tell an invented service-role key from a real one, and a
    // planted string in a committed file is exactly what it is built to shout about.
    const serviceRoleKey = ['sb', 'secret', 'ZmFrZS1zZXJ2aWNlLXJvbGUta2V5LWZvci10aGUtdGVzdA'].join('_');
    const anonKey = ['sb', 'publishable', 'ZmFrZS1hbm9uLWtleS1mb3ItdGhlLXRlc3Q'].join('_');
    const accessToken = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJmYWtlLWxlYXJuZXIifQ', 'c2lnbmF0dXJlLWZha2U'].join('.');
    const legacyKey = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', 'bm90LWEtcmVhbC1rZXk'].join('.');

    // A blocked run that was handed a key must still print no key.
    const lines: string[] = [];
    await runSupabaseVerification({
      env: { SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey, EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey },
      log: (line) => lines.push(line),
    });
    const printed = lines.join('\n');
    assert.match(printed, /SUPABASE_URL/, 'the blocked report must name what is missing');
    for (const secret of [serviceRoleKey, anonKey]) {
      assert.ok(!printed.includes(secret), 'the blocked report printed a credential it was given');
    }

    // Vendors echo request context into error bodies, so redaction has to survive a key
    // arriving inside a message the harness never composed.
    const redact = makeRedactor([serviceRoleKey, anonKey]);
    const echoed = redact(
      new Error(`PostgREST refused: apikey=${serviceRoleKey} authorization=Bearer ${accessToken} anon=${anonKey}`),
    );
    for (const secret of [serviceRoleKey, anonKey, accessToken]) {
      assert.ok(!echoed.includes(secret), 'a credential survived redaction inside an error message');
    }
    assert.match(echoed, /\[redacted\]/);
    assert.match(echoed, /\[redacted-jwt\]/);

    // Shapes it was never given are still removed: an access token minted at runtime is
    // never in the secrets list, and a legacy JWT service key looks exactly like one.
    const unseen = redact(`{"hint":"${legacyKey}","token":"${accessToken}"}`);
    for (const secret of [legacyKey, accessToken]) {
      assert.ok(!unseen.includes(secret), 'a credential-shaped value the harness never saw was printed in full');
    }
    assert.ok(!schemaMissingReport(redact(`missing table, apikey=${serviceRoleKey}`)).includes(serviceRoleKey));

    // End to end: the real command, handed real-looking keys, prints none of them.
    const cli = runCli({ SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey, EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey });
    assert.equal(cli.code, 1);
    for (const secret of [serviceRoleKey, anonKey]) {
      assert.ok(!cli.out.includes(secret), 'the command printed a credential from its environment');
    }
  });

  test('a skipped or missing supabase proof fails the run instead of passing quietly', () => {
    assert.equal(summarise(allPassing()).ok, true, 'a complete pass must be reportable');

    const skipped = allPassing();
    skipped[3] = { id: skipped[3]!.id, outcome: 'skipped', detail: 'no credentials for this one', ms: 0 };
    const skippedSummary = summarise(skipped);
    assert.equal(skippedSummary.ok, false, 'a skipped proof passed the run');
    assert.match(skippedSummary.lines.join('\n'), /SKIP rpc-privilege/);

    const dropped = allPassing().filter((result) => result.id !== 'trial-refused-second-installation');
    const droppedSummary = summarise(dropped);
    assert.equal(droppedSummary.ok, false, 'a proof that never ran passed the run');
    assert.match(droppedSummary.lines.join('\n'), /MISS trial-refused-second-installation: never ran/);

    const failed = allPassing();
    failed[0] = { id: failed[0]!.id, outcome: 'failed', detail: 'isolation broken', ms: 4 };
    assert.equal(summarise(failed).ok, false, 'a failed proof passed the run');

    const invented = [...allPassing(), { id: 'something-else', outcome: 'passed' as const, detail: 'ok', ms: 1 }];
    const inventedSummary = summarise(invented);
    assert.equal(inventedSummary.ok, false, 'a result for an undeclared proof was accepted');
    assert.match(inventedSummary.lines.join('\n'), /UNKNOWN something-else/);
  });

  test('a project with no schema is reported as one clear line, not twelve confusing failures', () => {
    const report = schemaMissingReport('PGRST205 could not find the table');
    assert.match(report, /^BLOCKED:/);
    assert.match(report, /supabase\/README\.md/);
    assert.match(report, /PGRST205/);
  });

  test('the anon proof is made with a client that was never signed in', async () => {
    const source = await import('node:fs').then(({ readFileSync }) => readFileSync(HARNESS, 'utf8'));

    // The bug this test exists to stop: learner() used to call signInWithPassword on the
    // shared `anon` client. `persistSession: false` only chooses memory over
    // localStorage — GoTrue still keeps the session — so every later anon request went
    // out as that learner's `authenticated` JWT. anon-key-refused then read the
    // learner's own row and reported a security failure that was not there, and the
    // `anon` leg of rpc-privilege silently tested `authenticated` twice.
    assert.doesNotMatch(source, /anon\.auth\.signInWithPassword/, 'the shared anon client is being signed in');
    assert.equal(
      (source.match(/signInWithPassword/g) ?? []).length,
      1,
      'there should be exactly one sign-in, on the throwaway per-learner client',
    );
    assert.match(source, /const gate = createClient\(url, anonKey/, 'learner() does not use a throwaway client');
    assert.match(source, /gate\.auth\.signInWithPassword/);
    assert.doesNotMatch(source, /anon\.auth\.signOut/, 'signing out would paper over a session that must never exist');

    // And the proof checks its own premise before asserting anything about the role.
    assert.match(source, /const session = await anon\.auth\.getSession\(\);/);
    assert.match(source, /this proof would be measuring the authenticated role/);

    // Every refusal is read by its SQLSTATE. A truthiness check would have stayed green
    // against the product_events trigger that raised 42883 on every row it ever saw.
    assert.equal(
      (source.match(/codeOf\((?:write|event|usage)\) === '42501'/g) ?? []).length,
      3,
      'an anon refusal is still being asserted by truthiness rather than by SQLSTATE',
    );

    // The refusal readers themselves, which is what those assertions rest on.
    assert.equal(codeOf(null), 'no-error');
    assert.equal(codeOf({ error: null }), 'no-error');
    assert.equal(codeOf({ error: { code: '42501' } }), '42501');
    assert.equal(codeOf({ error: { message: 'boom' } }), 'unknown', 'an error with no code must not read as a refusal');
    assert.equal(messageOf({ error: null }), '');
    assert.equal(messageOf({ error: { message: 'session id already belongs to another account' } }).includes('another account'), true);
  });

  test('legacy debit fixtures register all grants before any concurrent debit', async () => {
    const sequence: string[] = [];
    const expected = { secondsUsed: 0 };
    const store = {
      async get(userId: string) { sequence.push(`get:${userId}`); return expected; },
      async recordSessionGrant(userId: string, sessionId: string, snapshot: typeof expected) {
        assert.equal(snapshot, expected); sequence.push(`grant:${userId}:${sessionId}`); return true;
      },
    };
    await registerLegacySessions(store, 'learner', ['first', 'second']);
    assert.deepEqual(sequence, ['get:learner', 'grant:learner:first', 'grant:learner:second']);
    await assert.rejects(registerLegacySessions(store, 'learner', ['same', 'same']), /invalid legacy fixture/);
    await assert.rejects(registerLegacySessions({ ...store, async recordSessionGrant() { return false; } }, 'learner', ['refused']), /session grant refused/);
  });

  test('current REST preflight detects missing objects, unsafe ACLs and source drift', () => {
    const expected = {
      tables: [{ schema: 'public', name: 'new_current_table', rls: true, privileges: { anon: { select: false }, authenticated: { select: false } } }],
      policies: [],
      routines: [{ schema: 'public', name: 'current_rpc_v1', arguments: '', securityDefiner: true,
        configuration: ['search_path=""'], definitionMd5: 'fixture-md5', execute: { anon: false, authenticated: false } }],
    };
    const actual = { tables: expected.tables.map(table => ({ ...table, anonSelect: table.privileges.anon.select, authenticatedSelect: table.privileges.authenticated.select })), policies: [], routines: expected.routines.map(routine => ({ ...routine,
      anonExecute: routine.execute.anon, authenticatedExecute: routine.execute.authenticated })) };
    assert.deepEqual(currentInventoryProblems(expected, actual), []);
    assert.ok(currentInventoryProblems(expected, { tables: [], routines: [], policies: [] }).length > 0);
    const drift = structuredClone(actual); drift.routines[0]!.authenticatedExecute = true;
    assert.ok(currentInventoryProblems(expected, drift).some(problem => problem.includes('routine/ACL')));
    const changed = structuredClone(actual); changed.routines[0]!.definitionMd5 = 'changed-version';
    assert.ok(currentInventoryProblems(expected, changed).length > 0);
    const tableAcl = structuredClone(actual); tableAcl.tables[0]!.anonSelect = true;
    assert.ok(currentInventoryProblems(expected, tableAcl).some(problem => problem.includes('client ACL')));
    assert.ok(currentInventoryProblems(expected, { ...actual, policies: [{ policyname: 'unreviewed' }] }).some(problem => problem.includes('policy source drift')));
    assert.ok(currentInventoryProblems(expected, { tables: [null], routines: [], policies: [] }).length > 0);
    assert.ok(currentInventoryProblems(expected, null).length > 0);
  });

  test('legacy live harness refuses an unconfirmed destructive target before loading SDK/network', async () => {
    const report = await runSupabaseVerification({ env: { SUPABASE_URL: 'https://fixture.test', SUPABASE_SERVICE_ROLE_KEY: 'offline-fixture', SUPABASE_ANON_KEY: 'offline-fixture' } });
    assert.equal(report.ok, false); assert.equal(report.blocked, true); assert.equal(report.results.length, 0);
    assert.match(report.lines.join('\n'), /LUVANI_SUPABASE_VERIFY_DISPOSABLE/);
  });

  test('every line the supabase harness prints leaves through its log sink', async () => {
    const source = await import('node:fs').then(({ readFileSync }) => readFileSync(HARNESS, 'utf8'));
    const consoleCalls = source.match(/console\.(log|error|warn|info)/g) ?? [];
    assert.equal(
      consoleCalls.length,
      1,
      'output must flow through the injected log sink, which is the only thing the redactor wraps',
    );
    assert.match(source, /log: \(line\) => console\.log\(line\)/);
    assert.doesNotMatch(source, /console\.log\([^)]*(SERVICE_ROLE|ANON_KEY|access_token)/i);
  });
});
