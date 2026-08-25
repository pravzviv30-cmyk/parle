/**
 * Self-tests for the Upstash harness.
 *
 * These prove the harness's honesty, not the database. Nothing here touches
 * Upstash: the live proofs are what `npm run verify:upstash` runs, and their
 * result belongs in the evidence matrix rather than in a green tick here.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { RATE_LIMITS, privateSignal } from '../rateLimit.ts';
import {
  REQUIRED_ENV,
  UPSTASH_CHECKS,
  blockedReport,
  isHashedSegment,
  keyShapeProblem,
  missingCredentials,
  redact,
  summarise,
  type CheckResult,
} from './upstashLive.ts';

const passing = (id: string): CheckResult => ({ id, status: 'passed', detail: 'proved', ms: 1 });

describe('the upstash harness — honest about what it did and did not prove', () => {
  test('the upstash harness enumerates every required proof and reports blocked without credentials', () => {
    // 1. The inventory is the whole inventory, and each entry says something.
    assert.deepEqual(
      UPSTASH_CHECKS.map((check) => check.id),
      [
        'cross-instance-rate-limit',
        'cross-instance-session-lease',
        'matched-release-only',
        'lease-expiry',
        'key-hygiene-scan',
      ],
    );
    for (const check of UPSTASH_CHECKS) {
      assert.ok(check.what.length > 20, `${check.id} does not say what it proves`);
    }

    // 2. With nothing configured, every credential is named — not "some env".
    assert.deepEqual(missingCredentials({}), [...REQUIRED_ENV]);
    assert.deepEqual(missingCredentials({ UPSTASH_REDIS_REST_URL: '   ' }), [...REQUIRED_ENV]);
    assert.ok(REQUIRED_ENV.includes('UPSTASH_REDIS_REST_URL'));
    assert.ok(REQUIRED_ENV.includes('UPSTASH_REDIS_REST_TOKEN'));

    // 3. The blocked report names the variables and claims nothing.
    const blocked = blockedReport(missingCredentials({}));
    const printed = blocked.join('\n');
    assert.match(printed, /^BLOCKED:/);
    for (const name of REQUIRED_ENV) assert.ok(printed.includes(name), `${name} is not named in the blocked report`);
    for (const check of UPSTASH_CHECKS) assert.ok(printed.includes(`[blocked] ${check.id}`));
    assert.ok(!/\bpassed\b|\bverified\b|\bproved\b/.test(printed), 'a blocked run must not claim any proof');
    assert.match(printed, /services\/token-server\/\.env/);

    // 4. A blocked run exits non-zero, because nothing ran.
    assert.equal(summarise([]).exitCode, 1);
    assert.equal(summarise([]).ok, false);
  });

  test('a skipped upstash proof fails the run rather than passing quietly', () => {
    const all = UPSTASH_CHECKS.map((check) => passing(check.id));
    const complete = summarise(all);
    assert.equal(complete.ok, true);
    assert.equal(complete.exitCode, 0);
    assert.match(complete.lines.join('\n'), /5 of 5 proofs passed/);

    for (const check of UPSTASH_CHECKS) {
      const missingOne = all.filter((result) => result.id !== check.id);
      const partial = summarise(missingOne);
      assert.equal(partial.exitCode, 1, `${check.id} could be skipped without failing the run`);
      assert.match(partial.lines.join('\n'), new RegExp(`\\[skipped\\] ${check.id}`));
      assert.match(partial.lines.join('\n'), /FAILED/);
    }

    const first = UPSTASH_CHECKS[0] as { id: string };
    const failedOne = [...all.slice(1), { id: first.id, status: 'failed' as const, detail: 'no', ms: 1 }];
    assert.equal(summarise(failedOne).exitCode, 1);
  });

  test('the harness describes a bad redis key without ever quoting it', () => {
    const hashed = privateSignal('a'.repeat(48), 'user', 'learner@example.com');
    assert.ok(isHashedSegment(hashed));
    assert.equal(keyShapeProblem(`parle:active-session:${hashed}`), null);
    assert.equal(keyShapeProblem(`parle:limit:${RATE_LIMITS.sessionIp.name}:${hashed}`), null);
    for (const rule of Object.values(RATE_LIMITS)) {
      assert.equal(keyShapeProblem(`parle:limit:${rule.name}:${hashed}`), null, `${rule.name} is not accepted`);
    }

    // The shapes that would mean an identity is sitting in a shared database.
    const raw = [
      'parle:limit:session-ip:203.0.113.42',
      'parle:limit:session-user:learner@example.com',
      'parle:active-session:9f1c2b7e-1111-4222-8333-444455556666',
      'parle:active-session:learner@example.com',
      'parle:limit:not-a-rule:' + hashed,
      'parle:something-else:' + hashed,
      'other:limit:session-ip:' + hashed,
    ];
    for (const key of raw) {
      const problem = keyShapeProblem(key);
      assert.ok(problem, `${key.split(':').slice(0, 2).join(':')} was accepted and should not be`);
      // The complaint describes the shape. Quoting the key would republish the
      // identity the check just caught.
      const identity = key.split(':').at(-1) as string;
      assert.ok(!problem.includes(identity), 'the problem message quoted the raw key');
    }
  });

  test('the harness never prints an upstash credential it was given', () => {
    const source = readFileSync(path.join(import.meta.dirname, 'upstashLive.ts'), 'utf8');

    // Anything printed that could carry runtime data goes through redact().
    // Prose inside a literal is not runtime data, so only the interpolations and
    // the bare expressions are audited.
    const dynamicPartsOf = (argument: string): string => {
      const interpolated = [...argument.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1] ?? '').join(' ');
      const withoutLiterals = argument
        .replace(/`[^`]*`/g, ' ')
        .replace(/'[^']*'/g, ' ')
        .replace(/"[^"]*"/g, ' ');
      return `${interpolated} ${withoutLiterals}`;
    };
    const carriesRuntimeData = /\b(?:restToken|url|tokens?|secrets?|agentSecret|runSalt|output|message|keys?|line)\b/i;
    let audited = 0;
    for (const match of source.matchAll(/console\.(?:log|error)\(([^\n]*)\)/g)) {
      const printed = match[1] ?? '';
      if (!carriesRuntimeData.test(dynamicPartsOf(printed))) continue;
      audited += 1;
      assert.match(printed, /redact\(/, `an unredacted console line: ${printed.slice(0, 60)}`);
    }
    assert.ok(audited >= 2, 'the console audit matched nothing, so it proved nothing');
    assert.match(source, /child\.stdout\?\.on\('data', collect\)/);
    assert.match(source, /output\.push\(redact\(/, 'child output must be redacted before it is kept');

    const token = 'AX4kASQgY2NkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eg';
    const url = 'https://eu2-parle-12345.upstash.io';
    const safe = redact(`connecting to ${url} with ${token} and ${token} again`, [token, url]);
    assert.ok(!safe.includes(token));
    assert.ok(!safe.includes(url));
    assert.match(safe, /<redacted>/);
    // A short value is not redacted into oblivion — that would blank the report.
    assert.equal(redact('port 8787 is fine', ['']), 'port 8787 is fine');
  });
});
