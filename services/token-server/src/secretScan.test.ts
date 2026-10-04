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
import { execFileSync } from 'node:child_process';
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
  scanHistory,
  scanText,
  SECRET_PATTERNS,
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

/**
 * A credential built only from letters — the shape the scanner was once blind
 * to, because a value with no digit in it reads like a variable name.
 *
 * Consonants only, and never a vowel, so the sample can never be mistaken for
 * the English words a real identifier is built from. That is what makes this a
 * *deterministic* probe of the blind spot: the content is random every run, but
 * the property under test is fixed, so the case is exercised on every run
 * rather than whenever a random base64 draw happens to come out all letters.
 *
 * `token()` above is deliberately left free to draw anything, including a draw
 * that reads as words. Measured over ten million draws against the shipped
 * scanner, a 32-character sample now goes unreported once in 312,500 runs,
 * down from once in 475 before F215 was fixed. That remainder is the scanner
 * making a defensible call on a genuinely word-shaped value, not a blind spot,
 * and narrowing the generator to dodge it would test less than this does.
 */
const CONSONANTS = 'bcdfghjklmnpqrstvwxz';
function letters(length: number): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const raw = randomBytes(length * 2);
    let candidate = '';
    for (let index = 0; index < length; index += 1) {
      const letter = CONSONANTS[(raw[index * 2] ?? 0) % CONSONANTS.length] ?? 'b';
      // The first character stays lower case: that is the half of the shape a
      // scanner is most tempted to forgive.
      candidate += index > 0 && (raw[index * 2 + 1] ?? 0) % 2 === 0 ? letter.toUpperCase() : letter;
    }
    if (new Set(candidate).size >= 8) return candidate;
  }
  throw new Error('could not build a letters-only sample credential');
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
  plant('assigned-server-secret', agentSecret, `LUVANI_AGENT_SECRET=${agentSecret}`);
  plant('url-embedded-credential', redisPassword, `redis://default:${redisPassword}@eu2-luvani.upstash.io:6379`);
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
    assert.deepEqual(scanLine('LUVANI_AGENT_SECRET=changeme-changeme-changeme'), []);
    assert.deepEqual(scanLine('const secret = process.env.LIVEKIT_API_SECRET;'), []);

    // Code that wires a credential up is not a credential. These three shapes
    // are all live in this repo's own harnesses.
    assert.deepEqual(scanLine("        LUVANI_RATE_LIMIT_SALT: randomBytes(36).toString('base64url'),"), []);
    assert.deepEqual(scanLine('        LUVANI_AGENT_SECRET: agentSecretForThisRun,'), []);
    assert.deepEqual(scanLine('        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,'), []);
    // But the same variable name holding an actual value still is one.
    assert.deepEqual(scanLine(`LUVANI_AGENT_SECRET=${token(40)}`), ['assigned-server-secret']);
    assert.deepEqual(scanLine(`OPENAI_API_KEY=sk-${'x'.repeat(40)}`), []);

    // A Supabase anon key is designed to ship inside a client build.
    assert.deepEqual(scanLine(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt('anon')}`), []);
    // The service-role key in the same shape is the whole treasury.
    assert.deepEqual(scanLine(`SUPABASE_URL=x SERVICE=${jwt('service_role')}`), ['supabase-service-role-jwt']);

    // The documented escape hatch, so a real false positive never forces a
    // weaker pattern.
    assert.deepEqual(scanLine(`AKIA${token(16, 'upper')} // ${ALLOW_MARKER}`), []);
  });

  test('an inline FISH_API_KEY assignment is caught as a server-only credential', () => {
    // fish.audio is a live TTS vendor now, so this key spends real vendor money
    // the moment anyone else is holding it.
    assert.deepEqual(scanLine(`FISH_API_KEY=${token(40)}`), ['assigned-server-secret']);
    assert.deepEqual(scanLine(`        FISH_API_KEY: '${token(32)}',`), ['assigned-server-secret']);
    assert.ok(
      scanLine(`FISH_API_KEY=${letters(32)}`).includes('assigned-server-secret'),
      'a fish key of only letters must not be forgiven as a variable name',
    );

    // Wiring the key up is not leaking it, and neither is the stand-in an
    // example file carries.
    assert.deepEqual(scanLine('const fishKey = process.env.FISH_API_KEY;'), []);
    assert.deepEqual(scanLine('        FISH_API_KEY: process.env.FISH_API_KEY,'), []);
    assert.deepEqual(scanLine('FISH_API_KEY=<your fish.audio key here>'), []);

    // Name-anchored only, deliberately. Fish's key format is unverified, so
    // there is no fish shape rule and a value with no name in front of it stays
    // quiet: a guessed shape cries wolf, and a scanner that cries wolf is off.
    assert.deepEqual(patternIds().filter((id) => /fish/i.test(id)), []);
    assert.deepEqual(scanLine(`const referenceAudio = '${token(48, 'hex')}';`), []);
  });

  test('an inline FISH_AUDIO_API_KEY assignment is caught even under the misspelled name', () => {
    // The plugin reads FISH_API_KEY, but a live .env in this repo holds the same
    // credential under FISH_AUDIO_API_KEY. A scanner that only knows the correct
    // spelling is blind to the file people actually have in front of them.
    assert.deepEqual(scanLine(`FISH_AUDIO_API_KEY=${token(40)}`), ['assigned-server-secret']);
    assert.deepEqual(
      scanLine(`        FISH_AUDIO_API_KEY: '${token(32)}',`),
      ['assigned-server-secret'],
    );
    assert.ok(
      scanLine(`FISH_AUDIO_API_KEY=${letters(32)}`).includes('assigned-server-secret'),
      'the misspelling must be read as carefully as the right name, or it is not covered',
    );

    // The shorter name is a prefix of the longer one, so the alternation has to
    // capture the whole credential rather than a tail of it. Compared, never
    // printed, so a failure here still says nothing about the value.
    const misnamed = token(40);
    const assigned = SECRET_PATTERNS.find((pattern) => pattern.id === 'assigned-server-secret');
    assert.ok(assigned, 'the assigned-server-secret pattern must exist for this check to mean anything');
    assert.ok(
      assigned.pattern.exec(`FISH_AUDIO_API_KEY=${misnamed}`)?.groups?.value === misnamed,
      'the misspelled name must capture the whole credential, not a fragment of it',
    );

    assert.deepEqual(scanLine('FISH_AUDIO_API_KEY=process.env.FISH_API_KEY'), []);
    assert.deepEqual(scanLine('FISH_AUDIO_API_KEY=your-fish-audio-key-here'), []);
  });

  test('an inline TONEPERFECT_API_KEY assignment is caught as a server-only credential', () => {
    // TonePerfect scores drills and sound checks, and it bills a credit per
    // fifteen seconds of audio, so a leaked key spends real money on somebody
    // else's voice. It lives in the servers' .env files and nowhere else.
    assert.deepEqual(scanLine(`TONEPERFECT_API_KEY=${token(40)}`), ['assigned-server-secret']);
    assert.deepEqual(scanLine(`        TONEPERFECT_API_KEY: '${token(32)}',`), ['assigned-server-secret']);
    assert.ok(
      scanLine(`TONEPERFECT_API_KEY=${letters(32)}`).includes('assigned-server-secret'),
      'a key of only letters must not be forgiven as a variable name',
    );

    // Wiring it up is not leaking it, and neither is the stand-in an example file carries.
    assert.deepEqual(scanLine('const key = env.TONEPERFECT_API_KEY?.trim();'), []);
    assert.deepEqual(scanLine('        TONEPERFECT_API_KEY: process.env.TONEPERFECT_API_KEY,'), []);
    assert.deepEqual(scanLine('# TONEPERFECT_API_KEY='), []);
    assert.deepEqual(scanLine('TONEPERFECT_API_KEY=<your toneperfect key here>'), []);

    // Name-anchored only, like fish: TonePerfect's key format is unverified, and a
    // guessed shape cries wolf until somebody switches the scanner off.
    assert.deepEqual(patternIds().filter((id) => /toneperfect/i.test(id)), []);
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


  test('full history streaming finds a credential older than two thousand commits and never prints it', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'luvani-history-stream-'));
    const leaked = `gsk_${token(52)}`;
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      const commands: string[] = [];
      for (let n = 0; n < 2005; n++) {
        const content = n === 0 ? `GROQ_API_KEY=${leaked}\n` : `fixture ${n}\n`;
        const message = `fixture ${n}`;
        commands.push(`commit refs/heads/main\ncommitter Fixture <fixture@example.com> ${1700000000+n} +0000\ndata ${Buffer.byteLength(message)}\n${message}\nM 100644 inline history.txt\ndata ${Buffer.byteLength(content)}\n${content}\n`);
      }
      execFileSync('git', ['fast-import', '--quiet'], { cwd: root, input: commands.join('') });
      const findings = await scanHistory(root);
      assert.ok(findings.some(f => f.patternId === 'groq-key' && f.path === 'history.txt' && f.line === 1));
      assert.ok(!report(findings, 'history').join('\n').includes(leaked));
      assert.equal((await runScan(['--history'], root)).code, 1);
      const clone = path.join(root, 'shallow');
      execFileSync('git', ['clone', '-q', '--depth=1', '--branch=main', `file://${root}`, clone]);
      const blocked = await runScan(['--history'], clone);
      assert.equal(blocked.code, 1);assert.match(blocked.lines[0] ?? '', /^BLOCKED:/);assert.ok(!blocked.lines.join('\n').includes('clean'));
      const noGit = await runScan(['--history'], path.join(root, 'missing'));
      assert.equal(noGit.code, 1);assert.match(noGit.lines[0] ?? '', /^BLOCKED:/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('only the exact historical impossible-signature fixture keeps its approved pre-rename annotation', () => {
    const commit='9317ec2cbab2ecededb3ac2cad8d74dc55e242ba',file='services/tutor-agent/src/verify/voiceLifecycle.test.ts';
    const source=execFileSync('git',['show',`${commit}:${file}`],{cwd:path.resolve(import.meta.dirname,'../../..'),encoding:'utf8'});
    const line=source.split('\n').find(value=>value.includes('parle-secret-scan: allow'));
    assert.ok(line);
    const historic=(content: string, hash=commit, target=file)=>`commit ${hash}\n+++ b/${target}\n@@ -0,0 +322 @@\n+${content}`;
    assert.deepEqual(scanDiffStream(historic(line)),[]);
    assert.ok(scanDiffStream(historic(line,'0123456789abcdef0123456789abcdef01234567')).some(f=>f.patternId==='signed-jwt'));
    assert.ok(scanDiffStream(historic(line,commit,'other.test.ts')).some(f=>f.patternId==='signed-jwt'));
    const realShape=jwt('authenticated');
    assert.equal(Buffer.from(realShape.split('.')[2]!, 'base64url').length,32);
    const marked=`const credential="${realShape}"; // parle-secret-scan: allow`;
    assert.ok(scanDiffStream(historic(marked)).some(f=>f.patternId==='signed-jwt'));
    assert.ok(scanText(line,file).some(f=>f.patternId==='signed-jwt'),'new tree cannot reuse historical legacy annotation');
  });

  test('an oversized single history line is blocked without echoing its content', async () => {
    const root=mkdtempSync(path.join(tmpdir(),'luvani-history-line-'));
    try {
      execFileSync('git',['init','-q'],{cwd:root});
      const content='SYNTHETIC_HISTORY_BODY_'+ 'x'.repeat(8*1024*1024+1);
      execFileSync('git',['fast-import','--quiet'],{cwd:root,input:`commit refs/heads/main\ncommitter Fixture <fixture@example.com> 1700000000 +0000\ndata 7\nfixture\nM 100644 inline history.txt\ndata ${Buffer.byteLength(content)}\n${content}\n`});
      const result=await runScan(['--history'],root);
      assert.equal(result.code,1);assert.match(result.lines[0] ?? '',/^BLOCKED:/);
      assert.ok(!result.lines.join('\n').includes('SYNTHETIC_HISTORY_BODY_'));
    } finally {rmSync(root,{recursive:true,force:true});}
  });

  test('a bundle scan with no build output reports blocked rather than clean', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'luvani-secret-scan-'));
    try {
      assert.deepEqual(bundleFiles(empty), []);
      const outcome = await runScan(['--bundles'], empty);
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

describe('the secret scanner — a credential that reads like a name', () => {
  /**
   * The six shapes recognised by their variable name rather than by a vendor
   * prefix, each with the line that plants a credential in that position. These
   * are the only patterns that consult `isCodeReference`, so these are the only
   * ones an identifier-shaped value can hide behind.
   */
  const anchoredPlants = (value: string): { id: string; line: string }[] => [
    { id: 'livekit-credential', line: `LIVEKIT_API_SECRET=${value}` },
    { id: 'deepgram-key', line: `DEEPGRAM_API_KEY=${value}` },
    { id: 'upstash-token', line: `UPSTASH_REDIS_REST_TOKEN=${value}` },
    { id: 'assigned-server-secret', line: `LUVANI_AGENT_SECRET=${value}` },
    { id: 'url-embedded-credential', line: `redis://default:${value}@eu2-luvani.upstash.io:6379` },
    { id: 'hardcoded-bearer', line: `  authorization: 'Bearer ${value}',` },
  ];

  test('a credential of only letters is still found behind its variable name', () => {
    // A new context-anchored pattern without a sample here would be a silent
    // reopening of the blind spot, so the corpus and the library check each other.
    assert.deepEqual(
      anchoredPlants('unused').map((plant) => plant.id).sort(),
      SECRET_PATTERNS.filter((pattern) => pattern.contextAnchored).map((pattern) => pattern.id).sort(),
      'every pattern that trusts isCodeReference needs an all-letters sample',
    );

    // The value measured as missed: thirty-two letters, not one digit, first
    // character lower case. Built from the alphabet so this file carries no
    // credential-shaped literal of its own.
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const asMeasured = `${alphabet}${alphabet.slice(0, 6).toUpperCase()}`;

    for (const value of [asMeasured, letters(32), letters(48)]) {
      assert.match(
        value,
        /^[a-z][A-Za-z]*$/,
        'the sample has to be the letters-only shape, or this test is checking nothing',
      );
      for (const { id, line } of anchoredPlants(value)) {
        assert.ok(
          scanLine(line).includes(id),
          `${id}: a credential of only letters must not be read as a variable name`,
        );
      }
    }
  });

  test('a dotted code reference is still not a finding', () => {
    // Each entry is a real wiring shape from this repo's own harnesses. The
    // same position is then given an actual credential, so the quiet above is a
    // judgement about the value and never a pattern that simply does not fire.
    const wiredUp: { id: string; reference: string; line: (value: string) => string }[] = [
      {
        id: 'assigned-server-secret',
        reference: 'config.secrets.agentSecret',
        line: (value) => `        LUVANI_AGENT_SECRET: ${value},`,
      },
      {
        id: 'assigned-server-secret',
        reference: 'config?.secrets?.agentSecret',
        line: (value) => `        LUVANI_AGENT_SECRET: ${value},`,
      },
      {
        id: 'assigned-server-secret',
        reference: 'agentSecretForThisRun',
        line: (value) => `        LUVANI_AGENT_SECRET: ${value},`,
      },
      {
        id: 'assigned-server-secret',
        reference: "randomBytes(36).toString('base64url')",
        line: (value) => `        LUVANI_RATE_LIMIT_SALT: ${value},`,
      },
      {
        id: 'livekit-credential',
        reference: 'livekitSecretForTheHarness',
        line: (value) => `        LIVEKIT_API_SECRET: ${value},`,
      },
    ];

    for (const { id, reference, line } of wiredUp) {
      assert.deepEqual(
        scanLine(line(reference)),
        [],
        `${id}: code that names a credential is not a credential, and a scanner that says otherwise gets switched off`,
      );
      assert.ok(
        scanLine(line(letters(32))).includes(id),
        `${id}: the same position must still report a real credential, or the quiet above is a blind spot`,
      );
    }
  });
});
