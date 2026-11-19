import assert from 'node:assert/strict';
import { test } from 'node:test';

import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { STOP_SIGNALS, UNSET_NAMES, buildTokenEnv, buildWebEnv, mainCheckoutRoot, printable, redact, removeFile, secretValues } from './canvasFree.mjs';

const ENV_TEXT = [
  '# token server',
  'LIVEKIT_URL=ws://127.0.0.1:7880',
  'LIVEKIT_API_KEY=devkey',
  'LIVEKIT_API_SECRET="livekit-secret-value-123"',
  'SUPABASE_URL=https://example.supabase.co',
  'SUPABASE_SERVICE_ROLE_KEY=service-role-secret',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-secret',
  'LUVANI_DEV_UNLIMITED_MINUTES=1',
  'UPSTASH_REDIS_REST_URL=https://redis.example',
  'UPSTASH_REDIS_REST_TOKEN=redis-secret',
  'OPENAI_API_KEY=sk-openai-secret',
  'TONEPERFECT_API_KEY=tone-secret',
  'TYPESAFE_API_KEY=typesafe-secret',
  'DEEPGRAM_API_KEY=deepgram-secret-key',
  'SPEECHACE_API_KEY=speechace-secret-key',
  'ANTHROPIC_API_KEY=anthropic-secret-key',
].join('\n');

const build = (extra = {}) =>
  buildTokenEnv({ envText: ENV_TEXT, port: 8094, agentSecret: 'agent-secret-abc', storePath: '/tmp/x/entitlements.json', base: { PATH: '/bin', ...extra } });

test('keeps the LiveKit values and the local-development flag', () => {
  const env = build();
  assert.equal(env.LIVEKIT_URL, 'ws://127.0.0.1:7880');
  assert.equal(env.LIVEKIT_API_KEY, 'devkey');
  assert.equal(env.LIVEKIT_API_SECRET, 'livekit-secret-value-123');
  assert.equal(env.LUVANI_LOCAL_DEVELOPMENT, '1');
  assert.equal(env.PATH, '/bin');
});

test('the token env is an allow-list: no paid or remote key gets through, from the file or the shell', () => {
  const shell = { OPENAI_API_KEY: 'from-shell', SUPABASE_URL: 'https://shell.example', DEEPGRAM_API_KEY: 'd', FUTURE_VENDOR_KEY: 'f', HOME: '/home/me', LC_ALL: 'en_US.UTF-8', NODE_OPTIONS: '--no-warnings' };
  const env = build(shell);
  for (const name of [...UNSET_NAMES, 'DEEPGRAM_API_KEY', 'SPEECHACE_API_KEY', 'ANTHROPIC_API_KEY', 'FUTURE_VENDOR_KEY']) {
    assert.equal(name in env, false, name);
  }
  assert.equal(env.HOME, '/home/me');
  assert.equal(env.LC_ALL, 'en_US.UTF-8');
  assert.equal(env.NODE_OPTIONS, '--no-warnings');
  assert.deepEqual(Object.keys(env).sort(), [
    'DOTENV_CONFIG_PATH', 'ENTITLEMENT_STORE_PATH', 'HOME', 'LC_ALL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL',
    'LUVANI_AGENT_SECRET', 'LUVANI_ALLOWED_ORIGINS', 'LUVANI_LOCAL_DEVELOPMENT', 'NODE_OPTIONS', 'PATH',
  ]);
  assert.deepEqual([...UNSET_NAMES].sort(), [
    'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'LUVANI_DEV_UNLIMITED_MINUTES', 'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_URL', 'TONEPERFECT_API_KEY', 'TYPESAFE_API_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REDIS_REST_URL',
  ]);
});

test('sets the agent secret, the allowed origin for the port, the file ledger, and stops dotenv reading a file', () => {
  const env = build();
  assert.equal(env.LUVANI_AGENT_SECRET, 'agent-secret-abc');
  assert.equal(env.LUVANI_ALLOWED_ORIGINS, 'http://localhost:8094');
  assert.equal(env.ENTITLEMENT_STORE_PATH, '/tmp/x/entitlements.json');
  assert.equal(env.DOTENV_CONFIG_PATH, '/dev/null');
  const other = buildTokenEnv({ envText: ENV_TEXT, port: 9001, agentSecret: 'a', storePath: '/tmp/y', base: {} });
  assert.equal(other.LUVANI_ALLOWED_ORIGINS, 'http://localhost:9001');
});

test('the web env blanks Supabase and sets the canvas flags, and carries no token-server secret', () => {
  const env = buildWebEnv({ base: { PATH: '/bin', OPENAI_API_KEY: 'x', SUPABASE_URL: 'https://shell.example' } });
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, '');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_ANON_KEY, '');
  assert.equal(env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT, '1');
  assert.equal(env.EXPO_PUBLIC_LUVANI_CANVAS_LEARNER, '1');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.SUPABASE_URL, undefined);
  assert.equal(env.LIVEKIT_API_SECRET, undefined);
});

test('the printed text never carries a secret value', () => {
  const env = build();
  const text = printable({ port: 8094 });
  for (const value of [env.LIVEKIT_API_SECRET, env.LUVANI_AGENT_SECRET, 'service-role-secret', 'sk-openai-secret']) {
    assert.equal(text.includes(value), false, value);
  }
  assert.match(text, /Create an account with any test email on the web build; the canvas learner seeds itself\./);
  assert.match(text, /http:\/\/localhost:8094/);
  assert.equal(text.includes('—'), false);
});

test('redact hides secret values in forwarded child output', () => {
  assert.equal(redact('boot with livekit-secret-value-123 ok', ['livekit-secret-value-123', '']), 'boot with [hidden] ok');
  assert.equal(redact('nothing here', ['abc']), 'nothing here');
  assert.equal(redact('keep devkey', ['key']), 'keep devkey', 'values shorter than 8 characters are not redacted');
});

test('every value in the .env, and the agent secret, is redacted from forwarded output', () => {
  const secrets = secretValues({ envText: ENV_TEXT, agentSecret: 'agent-secret-abc' });
  const values = ENV_TEXT.split('\n').filter((l) => l.includes('=')).map((l) => l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, ''));
  for (const value of [...values, 'agent-secret-abc'].filter((v) => v.length >= 8)) {
    assert.equal(redact(`log ${value} end`, secrets), 'log [hidden] end', value);
  }
});

test('stops on hang-up as well as interrupt and terminate', () => {
  assert.deepEqual([...STOP_SIGNALS].sort(), ['SIGHUP', 'SIGINT', 'SIGTERM']);
});

test('removeFile deletes the ledger and tolerates a missing one', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'canvas-free-test-')), 'entitlements.json');
  writeFileSync(file, '{}');
  removeFile(file);
  assert.equal(existsSync(file), false);
  removeFile(file);
});

test('mainCheckoutRoot reads the first worktree from git porcelain output', () => {
  const text = 'worktree /home/me/Luvani\nHEAD abc\nbranch refs/heads/main\n\nworktree /home/me/Luvani-worktrees/x\nHEAD def\nbranch refs/heads/y\n';
  assert.equal(mainCheckoutRoot(text), '/home/me/Luvani');
  assert.equal(mainCheckoutRoot(''), null);
});
