/**
 * Self-tests for the secret scanner.
 *
 * Every planted credential is GENERATED AT RUNTIME. That is not decoration: a
 * scanner whose own tests carry literal credential shapes would flag its own
 * test file on the next run, and the usual cure for that — an exemption for the
 * test file — is the blind spot an attacker would aim for. Nothing here is a
 * credential when the file is at rest.
 */

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  ALLOW_MARKER,
  BUNDLE_DIRECTORIES,
  bundleFiles,
  formatFinding,
  patternIds,
  report,
  runScan,
  scanDiffStream,
  scanLine,
  scanText,
} from './secretScan.ts';

/** A high-variety token of the requested length. Never the same twice. */
function token(length: number, alphabet: 'base64url' | 'hex' | 'upper' = 'base64url'): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const raw = randomBytes(length * 2);
    const candidate =
      alphabet === 'hex'
        ? raw.toString('hex').slice(0, length)
        : alphabet === 'upper'
          ? raw.toString('base64').replace(/[^A-Z0-9]/g, '').slice(0, length)
          : raw.toString('base64url').replace(/[-_]/g, 'A').slice(0, length);
    if (candidate.length === length && new Set(candidate).size >= 8) return candidate;
  }
  throw new Error('could not build a high-variety sample token');
}

function jwt(role: string): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ role, iss: 'supabase', exp: 2000000000 })}.${token(43)}`;
}

/**
 * One planted line per pattern in the library. The coverage assertion below
 * makes a new pattern without a sample a failing test rather than a quiet gap.
 */
function plantedSamples(): { id: string; line: string; value: string }[] {
  const samples: { id: string; line: string; value: string }[] = [];
  /** `value` is the credential; `line` is the file line it was planted in. */
  const plant = (id: string, value: string, line = value) => {
    // Without this the leak assertion below would be checking nothing.
    assert.ok(line.includes(value), `${id}: the planted value must appear in the planted line`);
    samples.push({ id, line, value });
  };

  const pemBody = token(48);
  const serviceRole = jwt('service_role');
  const learnerSession = jwt('authenticated');
  const livekit = token(32);
  const deepgram = token(40, 'hex');
  const upstash = token(48);
  const agentSecret = token(40);
  const redisPassword = token(32, 'hex');
  const bearer = token(40);

  // Assembled at runtime: a literal PEM header in this file would make the
  // scanner flag its own test corpus on the next tracked-file run.
  const pemHeader = ['-----BEGIN', 'RSA', 'PRIVATE', `KEY${'-'.repeat(5)}`].join(' ');
  plant('private-key-block', pemBody, `${pemHeader}${pemBody}`);
  plant('supabase-service-role-jwt', serviceRole, `SUPABASE_SERVICE_ROLE_KEY=${serviceRole}`);
  plant('signed-jwt', learnerSession, `const session = "${learnerSession}";`);
  plant('supabase-secret-key', `sb_secret_${token(28)}`);
  plant('anthropic-key', `sk-ant-api03-${token(48)}`);
  plant('openai-key', `sk-${token(48)}`);
  plant('elevenlabs-key', `sk_${token(48, 'hex')}`);
  plant('groq-key', `gsk_${token(52)}`);
  plant('stripe-key', `sk_live_${token(24)}`);
  plant('aws-access-key-id', `AKIA${token(16, 'upper')}`);
  plant('google-api-key', `AIza${token(35)}`);
  plant('github-token', `ghp_${token(36)}`);
  plant('slack-token', `xoxb-${token(24)}`);
  plant('livekit-credential', livekit, `LIVEKIT_API_SECRET=${livekit}`);
  plant('deepgram-key', deepgram, `DEEPGRAM_API_KEY=${deepgram}`);
  plant('upstash-token', upstash, `UPSTASH_REDIS_REST_TOKEN=${upstash}`);
  plant('assigned-server-secret', agentSecret, `PARLE_AGENT_SECRET=${agentSecret}`);
  plant('url-embedded-credential', redisPassword, `redis://default:${redisPassword}@eu2-parle.upstash.io:6379`);
  plant('hardcoded-bearer', bearer, `  authorization: 'Bearer ${bearer}',`);

  return samples;
}

describe('the secret scanner — shapes found, values never spoken', () => {
  test('the scanner finds each planted credential shape and never prints the matched value', () => {
    const samples = plantedSamples();

    // 1. The library and the corpus cover each other exactly.
    assert.deepEqual(
      [...new Set(samples.map((s) => s.id))].sort(),
      [...patternIds()].sort(),
      'every pattern needs a planted sample, and every sample needs a pattern',
    );

    // 2. Each shape is detected, on the right line, by the right pattern.
    const document = ['const config = {', ...samples.map((s) => s.line), '};'].join('\n');
    const findings = scanText(document, 'services/token-server/src/leak.ts');
    for (const [index, sample] of samples.entries()) {
      assert.ok(
        scanLine(sample.line).includes(sample.id),
        `${sample.id} was planted and not found`,
      );
      assert.ok(
        findings.some((finding) => finding.patternId === sample.id && finding.line === index + 2),
        `${sample.id} was found at the wrong line`,
      );
    }

    // 3. The report says path and line, and carries no part of any value.
    const printed = [
      ...report(findings, 'planted corpus'),
      ...findings.map(formatFinding),
      JSON.stringify(findings),
    ].join('\n');
    for (const sample of samples) {
      assert.ok(sample.value.length >= 12, `${sample.id} sample is too short to be a meaningful leak check`);
      assert.ok(!printed.includes(sample.value), `${sample.id}: the scanner printed the value it found`);
      for (const fragment of [sample.value.slice(0, 12), sample.value.slice(-12)]) {
        assert.ok(!printed.includes(fragment), `${sample.id}: the scanner printed a fragment of the value`);
      }
    }
    assert.match(printed, /services\/token-server\/src\/leak\.ts:2/);
    assert.equal(printed.includes('BEGIN RSA PRIVATE KEY'), false);

    // 4. Nothing in the module interpolates a match into what it prints.
    const source = readFileSync(path.join(import.meta.dirname, 'secretScan.ts'), 'utf8');
    assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^)]*\b(?:match|value|secret|token)\b/);
    assert.doesNotMatch(source, /\$\{(?:match|value)[^}]*\}/);
  });

  test('a placeholder, an allow marker and a public anon key are not findings', () => {
    // The repo's own examples must stay quiet, or the scanner gets switched off.
    for (const example of ['token-server', 'tutor-agent', 'brain-playground']) {
      const file = path.resolve(import.meta.dirname, '..', '..', example, '.env.example');
      assert.deepEqual(scanText(readFileSync(file, 'utf8'), `${example}/.env.example`), []);
    }
    assert.deepEqual(scanLine('LIVEKIT_API_SECRET=<your livekit secret here>'), []);
    assert.deepEqual(scanLine('PARLE_AGENT_SECRET=changeme-changeme-changeme'), []);
    assert.deepEqual(scanLine('const secret = process.env.LIVEKIT_API_SECRET;'), []);

    // Code that wires a credential up is not a credential. These three shapes
    // are all live in this repo's own harnesses.
    assert.deepEqual(scanLine("        PARLE_RATE_LIMIT_SALT: randomBytes(36).toString('base64url'),"), []);
    assert.deepEqual(scanLine('        PARLE_AGENT_SECRET: agentSecretForThisRun,'), []);
    assert.deepEqual(scanLine('        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,'), []);
    // But the same variable name holding an actual value still is one.
    assert.deepEqual(scanLine(`PARLE_AGENT_SECRET=${token(40)}`), ['assigned-server-secret']);
    assert.deepEqual(scanLine(`OPENAI_API_KEY=sk-${'x'.repeat(40)}`), []);

    // A Supabase anon key is designed to ship inside a client build.
    assert.deepEqual(scanLine(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt('anon')}`), []);
    // The service-role key in the same shape is the whole treasury.
    assert.deepEqual(scanLine(`SUPABASE_URL=x SERVICE=${jwt('service_role')}`), ['supabase-service-role-jwt']);

    // The documented escape hatch, so a real false positive never forces a
    // weaker pattern.
    assert.deepEqual(scanLine(`AKIA${token(16, 'upper')} // ${ALLOW_MARKER}`), []);
  });

  test('the history walker names the commit and line that introduced a secret', () => {
    const leaked = `gsk_${token(52)}`;
    const diff = [
      'commit 0123456789abcdef0123456789abcdef01234567',
      'Author: someone <someone@example.com>',
      '',
      '    WIP: pre-switch backup',
      '',
      'diff --git a/services/tutor-agent/.env.bak b/services/tutor-agent/.env.bak',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/services/tutor-agent/.env.bak',
      '@@ -0,0 +1,3 @@',
      '+# copied before the switch',
      `+GROQ_API_KEY=${leaked}`,
      '+TUTOR_LLM=groq',
    ].join('\n');

    const findings = scanDiffStream(diff);
    assert.ok(findings.length >= 1, 'a secret added in a commit must be found');
    const groq = findings.find((finding) => finding.patternId === 'groq-key');
    assert.ok(groq, 'the groq shape must be recognised in a diff');
    assert.equal(groq.path, 'services/tutor-agent/.env.bak');
    assert.equal(groq.line, 2);
    assert.equal(groq.origin, 'history 01234567');
    assert.ok(!report(findings, 'history').join('\n').includes(leaked));

    // A removed line is history being cleaned up, not a new leak.
    const removalOnly = diff.replace(`+GROQ_API_KEY=${leaked}`, `-GROQ_API_KEY=${leaked}`);
    assert.deepEqual(
      scanDiffStream(removalOnly).filter((finding) => finding.patternId === 'groq-key'),
      [],
    );
  });

  test('a bundle scan with no build output reports blocked rather than clean', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'parle-secret-scan-'));
    try {
      assert.deepEqual(bundleFiles(empty), []);
      const outcome = runScan(['--bundles'], empty);
      assert.equal(outcome.code, 1, 'nothing scanned must never exit clean');
      assert.match(outcome.lines[0] ?? '', /^BLOCKED: no build output found/);
      assert.ok(
        BUNDLE_DIRECTORIES.every((directory) => outcome.lines.join('\n').includes(directory)),
        'blocked output must name every place it looked',
      );
      assert.ok(!outcome.lines.join('\n').includes('clean'));
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
