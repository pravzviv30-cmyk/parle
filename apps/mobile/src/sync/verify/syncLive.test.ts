/**
 * What the gate can honestly check about a live-credential harness is the harness.
 *
 * The six device-to-device proofs live in SYNC_PROOFS and only a run against a real
 * project can close them, so nothing here should ever be read as "sync verified" — see
 * docs/IMPLEMENTATION_EVIDENCE.md for what is measured and what is not. These tests hold
 * the harness to the three promises in its header instead: the inventory is complete, a
 * proof that did not pass cannot be reported as passing, and no key, password or access
 * token it was handed ever reaches an output line.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  REQUIRED_ENV,
  SYNC_PROOFS,
  blockedReport,
  makeRedactor,
  missingEnvironment,
  readEnvFile,
  runSyncVerification,
  schemaMissingReport,
  summarise,
  type CheckResult,
} from './syncLive.ts';

const HARNESS = fileURLToPath(new URL('./syncLive.ts', import.meta.url));
const NO_ENV_FILE = path.join(tmpdir(), `parle-no-env-${randomUUID()}`);

/** Every proof passing — the baseline the honesty tests deform one field at a time. */
const allPassing = (): CheckResult[] =>
  SYNC_PROOFS.map((proof) => ({ id: proof.id, outcome: 'passed' as const, detail: 'ok', ms: 1 }));

/** Run the harness as the command it actually is, and read what it printed. */
function runCli(env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', HARNESS], {
      encoding: 'utf8',
      // An env file that does not exist, so this machine's real credentials cannot wander
      // into a test through services/token-server/.env.
      // NODE_ENV is required rather than optional here: expo augments ProcessEnv, so a
      // minimal environment has to name it even though this harness never reads it.
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', PARLE_ENV_FILE: NO_ENV_FILE, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    const failure = err as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

describe('the sync live harness is honest about what it proved', () => {
  test('the sync harness enumerates every required proof and reports blocked without credentials', async () => {
    const required = [
      'own-rows-only',
      'forged-user-filter',
      'offline-replay',
      'duplicate-converges',
      'conflict-converges',
      'corrupt-quarantined',
    ];
    const ids = SYNC_PROOFS.map((proof) => proof.id);
    assert.deepEqual([...ids].sort(), [...required].sort(), 'the inventory is not the six proofs the phase requires');
    assert.equal(new Set(ids).size, 6, 'a proof id is duplicated, so one risk is counted twice');
    for (const proof of SYNC_PROOFS) {
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
    for (const proof of SYNC_PROOFS) assert.match(report, new RegExp(proof.id));

    // The run function refuses rather than claiming anything, and touches no network.
    const lines: string[] = [];
    const blocked = await runSyncVerification({ env: {}, log: (line) => lines.push(line) });
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

  test('the sync harness never prints a key or token it was given', async () => {
    // Assembled rather than written out: these are invented values, but a repository
    // secret scanner cannot tell an invented service-role key from a real one, and a
    // planted string in a committed file is exactly what it is built to shout about.
    const serviceRoleKey = ['sb', 'secret', 'ZmFrZS1zZXJ2aWNlLXJvbGUta2V5LWZvci10aGUtdGVzdA'].join('_');
    const anonKey = ['sb', 'publishable', 'ZmFrZS1hbm9uLWtleS1mb3ItdGhlLXRlc3Q'].join('_');
    const accessToken = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJmYWtlLWxlYXJuZXIifQ', 'c2lnbmF0dXJlLWZha2U'].join('.');
    const legacyKey = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', 'bm90LWEtcmVhbC1rZXk'].join('.');

    // A blocked run that was handed a key must still print no key.
    const lines: string[] = [];
    await runSyncVerification({
      env: { SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey, EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey },
      log: (line) => lines.push(line),
    });
    const printed = lines.join('\n');
    assert.match(printed, /SUPABASE_URL/, 'the blocked report must name what is missing');
    for (const secret of [serviceRoleKey, anonKey]) {
      assert.ok(!printed.includes(secret), 'the blocked report printed a credential it was given');
    }

    // Vendors echo request context into error bodies, so redaction has to survive a key
    // or a learner's bearer arriving inside a message the harness never composed.
    const redact = makeRedactor([serviceRoleKey, anonKey, accessToken]);
    const echoed = redact(
      new Error(`PostgREST refused: apikey=${serviceRoleKey} authorization=Bearer ${accessToken} anon=${anonKey}`),
    );
    for (const secret of [serviceRoleKey, anonKey, accessToken]) {
      assert.ok(!echoed.includes(secret), 'a credential survived redaction inside an error message');
    }
    assert.match(echoed, /\[redacted\]/, 'the values handed in are removed by identity');

    // And by shape, for a token this harness was never told about — the legacy JWT-shaped
    // service key is the case that matters, because nothing hands it to the redactor.
    const byShape = makeRedactor([]);
    assert.ok(!byShape(`leaked ${legacyKey}`).includes(legacyKey), 'a JWT-shaped key was printed in full');
    assert.ok(!byShape(`leaked ${anonKey}`).includes(anonKey), 'a Supabase-shaped key was printed in full');

    // The password minted for a disposable account is a credential too. It is a bare hex
    // string with no shape to match on, so it has to be redacted by identity or not at all.
    const password = randomUUID().replace(/-/g, '');
    assert.ok(!makeRedactor([password])(`sign-in failed for ${password}`).includes(password));
  });

  test('a skipped or missing sync proof fails the run instead of passing quietly', () => {
    assert.equal(summarise(allPassing()).ok, true, 'a full pass must be reported as a pass');

    const skipped = allPassing();
    skipped[0] = { ...(skipped[0] as CheckResult), outcome: 'skipped', detail: 'no time today' };
    assert.equal(summarise(skipped).ok, false, 'a skipped proof was reported as an ok run');

    const short = allPassing().slice(1);
    const missing = summarise(short);
    assert.equal(missing.ok, false, 'a proof that never ran was reported as an ok run');
    assert.match(missing.lines.join('\n'), /MISS /);

    const invented = [...allPassing(), { id: 'not-a-proof', outcome: 'passed' as const, detail: 'ok', ms: 1 }];
    const unknown = summarise(invented);
    assert.equal(unknown.ok, false, 'a result no proof declares was counted as evidence');
    assert.match(unknown.lines.join('\n'), /UNKNOWN not-a-proof/);
  });

  test('a project without the revision column is reported as one clear line, not six confusing failures', () => {
    const report = schemaMissingReport('learner_state has no revision column');
    assert.match(report, /^BLOCKED:/);
    assert.match(report, /202608260001_learner_state_revision\.sql/, 'the report must name the migration to paste');
    assert.match(report, /supabase\/README\.md/, 'the report must point at the order to paste it in');
    assert.equal(report.split('\n').length, 3, 'the no-schema report grew into a wall of text');
  });

  test('every line the sync harness prints leaves through its log sink', async () => {
    const printed: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]): void => {
      printed.push(args.map(String).join(' '));
    };
    try {
      const report = await runSyncVerification({ env: {}, log: () => {} });
      assert.equal(report.blocked, true);
    } finally {
      console.log = realLog;
    }
    assert.deepEqual(printed, [], 'the harness wrote to the console behind its own log sink');
  });

  test('the env file reader takes names and values without needing a dependency', () => {
    assert.deepEqual(readEnvFile(NO_ENV_FILE), {}, 'a missing env file must be empty, not a throw');

    const file = path.join(tmpdir(), `parle-env-${randomUUID()}`);
    writeFileSync(
      file,
      ['# a comment', 'SUPABASE_URL=https://project.supabase.co', "QUOTED='kept'", 'DOUBLE="also kept"', 'BLANK=', 'not a line'].join('\n'),
    );
    try {
      assert.deepEqual(readEnvFile(file), {
        SUPABASE_URL: 'https://project.supabase.co',
        QUOTED: 'kept',
        DOUBLE: 'also kept',
        BLANK: '',
      });
    } finally {
      rmSync(file, { force: true });
    }
  });
});
