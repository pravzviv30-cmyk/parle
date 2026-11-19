import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UNSET_NAMES, buildTokenEnv, buildWebEnv, mainCheckoutRoot, printable, redact } from './canvasFree.mjs';

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

test('removes every paid or remote name, from the file and from the shell', () => {
  const env = build({ OPENAI_API_KEY: 'from-shell', SUPABASE_URL: 'https://shell.example' });
  for (const name of UNSET_NAMES) assert.equal(name in env, false, name);
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

test('mainCheckoutRoot reads the first worktree from git porcelain output', () => {
  const text = 'worktree /home/me/Luvani\nHEAD abc\nbranch refs/heads/main\n\nworktree /home/me/Luvani-worktrees/x\nHEAD def\nbranch refs/heads/y\n';
  assert.equal(mainCheckoutRoot(text), '/home/me/Luvani');
  assert.equal(mainCheckoutRoot(''), null);
});
