import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { MAX_STATE_BYTES, main, parseCli, parseEnvValue, toState } from './jev.mjs';

const ROOT = '/repo';
const TOKEN_ENV = `${ROOT}/services/token-server/.env`;
const TUTOR_ENV = `${ROOT}/services/tutor-agent/.env`;
const NOUL_OK = { type: 'noul', noul: 0.9 };

/** A fake System One. Records every request it receives. */
function fakeFetch(answers = { answer: NOUL_OK }, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, auth: init.headers.authorization, body: JSON.parse(init.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => ({
        model: 'jev-1.13.0',
        answers,
        usage: { input_tokens: 1000, output_tokens: 0 },
      }),
    };
  };
  fn.calls = calls;
  return fn;
}

/** Files by absolute path. Anything else is ENOENT. */
function files(map) {
  return (file) => {
    if (!(file in map)) throw new Error(`ENOENT ${file}`);
    return map[file];
  };
}

const stdinOf = (text) => Object.assign(Readable.from([Buffer.from(text)]), { isTTY: false });

function run(argv, io = {}) {
  const fetch = io.fetch ?? fakeFetch();
  return main(argv, {
    env: { TYPESAFE_API_KEY: 'env-key-AAAA' },
    root: ROOT,
    cwd: ROOT,
    readFile: files({}),
    realpath: (p) => p,
    stdin: stdinOf('some text'),
    ...io,
    fetch,
  }).then((result) => ({ ...result, fetch }));
}

function assertNoKey(result, ...keys) {
  for (const key of keys) {
    assert.ok(!result.stdout.includes(key), `stdout leaked ${key}`);
    assert.ok(!result.stderr.includes(key), `stderr leaked ${key}`);
  }
}

test('parseCli: exactly one of --ask or --questions', () => {
  assert.throws(() => parseCli([]), /exactly one/);
  assert.throws(() => parseCli(['--ask', 'x', '--questions', 'q.json']), /exactly one/);
  assert.throws(() => parseCli(['--ask', '  ']), /non-empty/);
  assert.throws(() => parseCli(['--ask', 'x', '--bogus']), /bogus/);
  assert.deepEqual(parseCli(['--ask', 'x']), { ask: 'x', questions: undefined, state: '-', pass: undefined });
  assert.equal(parseCli(['--questions', 'q.json', '--state', 's.md']).state, 's.md');
});

test('parseCli: --pass must be a number from 0 to 1', () => {
  for (const bad of ['', 'abc', '1.5', '-0.1']) {
    assert.throws(() => parseCli(['--ask', 'x', '--pass', bad]), /--pass/, bad);
  }
  assert.equal(parseCli(['--ask', 'x', '--pass', '0.7']).pass, 0.7);
  assert.equal(parseCli(['--ask', 'x', '--pass', '0']).pass, 0);
});

test('parseEnvValue: export, quotes, comments, empty values', () => {
  const text = [
    '# TYPESAFE_API_KEY=commented',
    'OTHER=1',
    'export TYPESAFE_API_KEY="quoted-key"  # note',
  ].join('\n');
  assert.equal(parseEnvValue(text, 'TYPESAFE_API_KEY'), 'quoted-key');
  assert.equal(parseEnvValue("TYPESAFE_API_KEY='single'", 'TYPESAFE_API_KEY'), 'single');
  assert.equal(parseEnvValue('TYPESAFE_API_KEY=plain # trailing', 'TYPESAFE_API_KEY'), 'plain');
  assert.equal(parseEnvValue('TYPESAFE_API_KEY=\r\n', 'TYPESAFE_API_KEY'), '');
  assert.equal(parseEnvValue('NOT_IT=abc', 'TYPESAFE_API_KEY'), '');
});

test('toState: JSON objects, arrays and strings pass through, text is wrapped', () => {
  assert.deepEqual(toState('{"a":1}'), { a: 1 });
  assert.deepEqual(toState('[1,2]'), [1, 2]);
  assert.equal(toState('"just a string"'), 'just a string');
  assert.deepEqual(toState('Hello there'), { text: 'Hello there' });
  assert.deepEqual(toState('42'), { text: '42' });
  assert.deepEqual(toState('null'), { text: 'null' });
});

test('--ask sends one noul question with id "answer" and prints JSON with cost', async () => {
  const result = await run(['--ask', 'Is this warm?']);
  assert.equal(result.code, 0, result.stderr);
  const [call] = result.fetch.calls;
  assert.equal(call.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(call.auth, 'Bearer env-key-AAAA');
  assert.equal(call.body.model, 'jev-1.13.0');
  assert.deepEqual(call.body.questions, { answer: { type: 'noul', instructions: 'Is this warm?' } });
  const out = JSON.parse(result.stdout);
  assert.equal(out.model, 'jev-1.13.0');
  assert.deepEqual(out.answers.answer, NOUL_OK);
  assert.equal(out.usage.inputTokens, 1000);
  assert.ok(Math.abs(out.costUsd - 0.000042) < 1e-12, String(out.costUsd));
  assert.equal(result.stderr, '');
  assertNoKey(result, 'env-key-AAAA');
});

test('plain text state from stdin is wrapped as { text }', async () => {
  const result = await run(['--ask', 'x'], { stdin: stdinOf('Bonjour tout le monde') });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.fetch.calls[0].body.state, { text: 'Bonjour tout le monde' });
});

test('JSON state from a file passes through untouched', async () => {
  const state = { ticket: { subject: 'x' }, list: [1, 2] };
  const result = await run(['--ask', 'x', '--state', 'state.json'], {
    readFile: files({ [`${ROOT}/state.json`]: JSON.stringify(state) }),
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.fetch.calls[0].body.state, state);
});

test('--questions sends the file as-is and --state - reads stdin', async () => {
  const questions = {
    tone: { type: 'score', instructions: 'How warm?', criteria: ['cold', 'neutral', 'warm'] },
    ok: { type: 'noul', instructions: 'Is it plain?' },
  };
  const answers = {
    tone: { type: 'score', score: 2, legend: { 0: 'cold' }, probabilities: { 2: 1 }, confidence: 0.9 },
    ok: NOUL_OK,
  };
  const result = await run(['--questions', 'q.json', '--state', '-'], {
    fetch: fakeFetch(answers),
    readFile: files({ [`${ROOT}/q.json`]: JSON.stringify(questions) }),
    stdin: stdinOf('Welcome back.'),
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.fetch.calls[0].body.questions, questions);
  assert.deepEqual(Object.keys(JSON.parse(result.stdout).answers), ['tone', 'ok']);
});

test('bad --questions files exit 1 before any request', async () => {
  for (const content of ['not json', '[]', '{}', '{"a":{"type":"maybe","instructions":"x"}}', '{"a":{"type":"noul"}}']) {
    const result = await run(['--questions', 'q.json'], { readFile: files({ [`${ROOT}/q.json`]: content }) });
    assert.equal(result.code, 1, content);
    assert.equal(result.fetch.calls.length, 0);
    assert.match(result.stderr, /^jev: /);
  }
  const missing = await run(['--questions', 'nope.json']);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /Could not read/);
});

test('key lookup order: env, then token-server .env, then tutor-agent .env', async () => {
  const both = {
    [TOKEN_ENV]: 'export TYPESAFE_API_KEY="token-key-BBBB"\n',
    [TUTOR_ENV]: 'TYPESAFE_API_KEY=tutor-key-CCCC\n',
  };
  const sent = async (env, map) => {
    const result = await run(['--ask', 'x'], { env, readFile: files(map) });
    assert.equal(result.code, 0, result.stderr);
    assertNoKey(result, 'env-key-AAAA', 'token-key-BBBB', 'tutor-key-CCCC');
    return result.fetch.calls[0].auth;
  };
  assert.equal(await sent({ TYPESAFE_API_KEY: 'env-key-AAAA' }, both), 'Bearer env-key-AAAA');
  assert.equal(await sent({ TYPESAFE_API_KEY: '  ' }, both), 'Bearer token-key-BBBB');
  assert.equal(await sent({}, both), 'Bearer token-key-BBBB');
  assert.equal(await sent({}, { ...both, [TOKEN_ENV]: 'TYPESAFE_API_KEY=\nOTHER=1\n' }), 'Bearer tutor-key-CCCC');
  assert.equal(await sent({}, { [TUTOR_ENV]: both[TUTOR_ENV] }), 'Bearer tutor-key-CCCC');
});

test('no key anywhere: exit 1 with a clear message and no request', async () => {
  const result = await run(['--ask', 'x'], { env: {}, readFile: files({ [TOKEN_ENV]: 'OTHER=1\n' }) });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No TypeSafe key/);
  assert.equal(result.fetch.calls.length, 0);
});

test('the key never appears in stdout or stderr, even when errors quote it', async () => {
  const key = 'env-key-LEAKY';
  const env = { TYPESAFE_API_KEY: key };
  const http = await run(['--ask', 'x'], { env, fetch: fakeFetch({}, 401) });
  assert.equal(http.code, 1);
  assert.match(http.stderr, /status 401/);
  assertNoKey(http, key);

  const throwing = async () => {
    throw new Error(`connect failed with Authorization: Bearer ${key}`);
  };
  const network = await run(['--ask', 'x'], { env, fetch: throwing });
  assert.equal(network.code, 1);
  assert.match(network.stderr, /\[redacted\]/);
  assertNoKey(network, key);

  const missingAnswer = await run(['--ask', 'x'], { env, fetch: fakeFetch({}) });
  assert.equal(missingAnswer.code, 1);
  assertNoKey(missingAnswer, key);
});

test('.env state paths are refused, including through a symlink, before any key is read', async () => {
  let reads = 0;
  const readFile = (file) => {
    reads += 1;
    throw new Error(`should not read ${file}`);
  };
  for (const state of ['services/token-server/.env', '.env.local', '/abs/.env', '.env.example']) {
    const result = await run(['--ask', 'x', '--state', state], { readFile });
    assert.equal(result.code, 1, state);
    assert.match(result.stderr, /Refusing/);
    assert.equal(result.fetch.calls.length, 0);
    assertNoKey(result, 'env-key-AAAA');
  }
  const link = await run(['--ask', 'x', '--state', 'notes.txt'], {
    readFile,
    realpath: () => `${ROOT}/services/token-server/.env`,
  });
  assert.equal(link.code, 1);
  assert.match(link.stderr, /Refusing/);
  const questions = await run(['--questions', '.env'], { readFile });
  assert.equal(questions.code, 1);
  assert.equal(reads, 0);
});

test('state over 200 KB is refused from a file and from stdin', async () => {
  const big = 'a'.repeat(MAX_STATE_BYTES + 1);
  const file = await run(['--ask', 'x', '--state', 'big.txt'], { readFile: files({ [`${ROOT}/big.txt`]: big }) });
  assert.equal(file.code, 1);
  assert.match(file.stderr, /200 KB/);
  const piped = await run(['--ask', 'x'], { stdin: stdinOf(big) });
  assert.equal(piped.code, 1);
  assert.match(piped.stderr, /200 KB/);
  assert.equal(file.fetch.calls.length + piped.fetch.calls.length, 0);

  const exact = await run(['--ask', 'x'], { stdin: stdinOf('a'.repeat(MAX_STATE_BYTES)) });
  assert.equal(exact.code, 0, exact.stderr);
});

test('empty state and a terminal stdin are refused', async () => {
  const empty = await run(['--ask', 'x'], { stdin: stdinOf('  \n') });
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /empty/);
  const tty = await run(['--ask', 'x'], { stdin: Object.assign(Readable.from([]), { isTTY: true }) });
  assert.equal(tty.code, 1);
  assert.match(tty.stderr, /No state/);
});

test('--pass exits 0 at or above the threshold and 2 below, still printing the answer', async () => {
  const at = await run(['--ask', 'x', '--pass', '0.9']);
  assert.equal(at.code, 0);
  const below = await run(['--ask', 'x', '--pass', '0.95']);
  assert.equal(below.code, 2);
  assert.equal(below.stderr, '');
  assert.equal(JSON.parse(below.stdout).answers.answer.noul, 0.9);
});

test('--pass needs a single noul question', async () => {
  const two = { a: { type: 'noul', instructions: 'x' }, b: { type: 'noul', instructions: 'y' } };
  const score = { a: { type: 'score', instructions: 'x', criteria: ['lo', 'hi'] } };
  for (const questions of [two, score]) {
    const result = await run(['--questions', 'q.json', '--pass', '0.5'], {
      readFile: files({ [`${ROOT}/q.json`]: JSON.stringify(questions) }),
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /single noul/);
    assert.equal(result.fetch.calls.length, 0);
  }
});

test('an unpriced model leaves costUsd out instead of guessing', async () => {
  const fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ model: 'jev-9.9.9', answers: { answer: NOUL_OK }, usage: { input_tokens: 5, output_tokens: 0 } }),
  });
  const result = await run(['--ask', 'x'], { fetch });
  assert.equal(result.code, 0, result.stderr);
  assert.equal('costUsd' in JSON.parse(result.stdout), false);
});

test('--help prints usage and exits 0 without a key', async () => {
  const result = await run(['--help'], { env: {} });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage:/);
});
