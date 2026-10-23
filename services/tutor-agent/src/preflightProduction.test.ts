import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preflight, verifyVendors } from './preflight.ts';

test('production never registers a CLI brain, missing report secret or insecure report API', () => {
  const env = { NODE_ENV: 'production', LUVANI_TYPED_ONLY: '1', LIVEKIT_URL: 'wss://example.livekit.cloud', LIVEKIT_API_KEY: 'example-key', LIVEKIT_API_SECRET: 'example-secret', ANTHROPIC_API_KEY: 'example-key', GROQ_API_KEY: 'example-key', OPENAI_API_KEY: 'example-key', TUTOR_LLM: 'openai', TOKEN_SERVER_URL: 'https://api.example.com', LUVANI_AGENT_SECRET: 'example-strong-secret-for-local-test-only' };
  const stop = () => { throw new Error('refused'); };
  for (const override of [{ TOKEN_SERVER_URL: 'http://localhost:8787' }, { LUVANI_AGENT_SECRET: '' }, { TUTOR_LLM: 'claude-cli-all' }, { TOKEN_SERVER_URL: 'https://user:example-password@api.example.com' }]) {
    assert.throws(() => preflight({ ...env, ...override }, stop, () => true), /refused/);
  }
  assert.doesNotThrow(() => preflight(env, stop, () => false));
});
test('production refuses a non-OpenAI tutor brain', () => {
  const env = { NODE_ENV: 'production', LUVANI_TYPED_ONLY: '1', LIVEKIT_URL: 'wss://example.livekit.cloud', LIVEKIT_API_KEY: 'example-key', LIVEKIT_API_SECRET: 'example-secret', ANTHROPIC_API_KEY: 'example-key', GROQ_API_KEY: 'example-key', OPENAI_API_KEY: 'example-key', TOKEN_SERVER_URL: 'https://api.example.com', LUVANI_AGENT_SECRET: 'example-strong-secret-for-local-test-only' };
  const stop = () => { throw new Error('refused'); };
  for (const brain of [undefined, '', 'anthropic', 'groq', 'claude-cli']) {
    assert.throws(() => preflight({ ...env, TUTOR_LLM: brain }, stop, () => true), /refused/);
  }
  assert.doesNotThrow(() => preflight({ ...env, TUTOR_LLM: 'openai' }, stop, () => false));
  assert.doesNotThrow(() => preflight({ ...env, NODE_ENV: 'development', TUTOR_LLM: 'anthropic' }, stop, () => false));
});
test('production vendor verification fails closed under network, header and body stalls', async () => {
  const env = { NODE_ENV: 'production', LUVANI_TYPED_ONLY: '1', TUTOR_LLM: 'openai', OPENAI_API_KEY: 'example-key' };
  for (const body of [false, true]) {
    let signal: AbortSignal | undefined;
    const checks = await verifyVendors(env, '', async (_url, init) => {
      signal = init?.signal;
      if (!body) return new Promise<never>(() => {});
      return { ok: true, status: 200, json: () => new Promise<never>(() => {}) };
    }, { timeoutMs: 10 });
    assert.equal(signal?.aborted, true);
    assert.ok(checks.length > 0);
    assert.ok(checks.every(check => check.fatal && check.unavailable));
  }
  const checks = await verifyVendors(env, '', async () => { throw new Error('PRIVATE_VENDOR_CONTENT'); });
  assert.ok(checks.every(check => check.fatal));
  assert.ok(!JSON.stringify(checks).includes('PRIVATE_VENDOR_CONTENT'));
});

test('the bound lesson and convo quotes both carry a scoring component whenever live scoring is on', () => {
  const quote = { quoteId: '11111111-1111-4111-8111-111111111111', configurationSha256: '123456789abcdef0'.repeat(4) };
  const scored = ['llm', 'scoring', 'stt', 'tts'], unscored = ['llm', 'stt', 'tts'];
  const binding = (kinds?: string[]) => kinds ? { ...quote, kinds } : quote;
  const bindings = (lesson?: string[], convo?: string[]) => JSON.stringify({ lesson: binding(lesson), convo: binding(convo) });
  const cases: Array<{ flag: string | undefined; lesson?: string[]; convo?: string[]; missing: string[] }> = [
    { flag: '1', missing: ['lesson', 'convo'] },
    { flag: '1', lesson: unscored, convo: unscored, missing: ['lesson', 'convo'] },
    { flag: '1', lesson: scored, missing: ['convo'] },
    { flag: '1', lesson: scored, convo: unscored, missing: ['convo'] },
    { flag: '1', convo: scored, missing: ['lesson'] },
    { flag: '1', lesson: scored, convo: scored, missing: [] },
    { flag: undefined, missing: [] },
    { flag: undefined, lesson: unscored, convo: unscored, missing: [] },
    { flag: undefined, lesson: scored, missing: [] },
  ];
  // Tutor preflight (F863).
  const base = { NODE_ENV: 'production', LUVANI_TYPED_ONLY: '1', LIVEKIT_URL: 'wss://example.livekit.cloud', LIVEKIT_API_KEY: 'example-key', LIVEKIT_API_SECRET: 'example-secret', OPENAI_API_KEY: 'example-key', TUTOR_LLM: 'openai', TOKEN_SERVER_URL: 'https://api.example.com', LUVANI_AGENT_SECRET: 'example-strong-secret-for-local-test-only', LUVANI_SCORING_VENDOR: 'speechace', SPEECHACE_API_KEY: 'synthetic' };
  const stop = () => { throw new Error('refused'); };
  const errors: unknown[][] = [], error = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    for (const { flag, lesson, convo, missing } of cases) {
      const env = { ...base, LUVANI_PAID_QUOTE_BINDINGS: bindings(lesson, convo), ...(flag ? { LUVANI_AUDIO_SCORING: flag } : {}) }, label = JSON.stringify({ flag, lesson, convo });
      errors.length = 0;
      if (!missing.length) assert.doesNotThrow(() => preflight(env, stop, () => false), label);
      else {
        assert.throws(() => preflight(env, stop, () => false), /refused/, label);
        assert.match(String(errors.at(-1)?.[0]), new RegExp(`live scoring needs the ${missing.join(' and ')} quote binding`), label);
      }
    }
  } finally { console.error = error; }
  assert.throws(() => preflight({ ...base, LUVANI_AUDIO_SCORING: '1', LUVANI_PAID_QUOTE_BINDINGS: '{not json' }, stop, () => false), /refused/);
  // Container admission: deployment/validateEnvironment.mjs tutor.
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const contract = JSON.parse(readFileSync(new URL('../../../deployment/environment-contract.json', import.meta.url), 'utf8'));
  const fixture: Record<string, string> = { PATH: process.env.PATH ?? '', NODE_ENV: 'production', LUVANI_DURABLE_PRACTICE: '1', TUTOR_LLM: 'openai', OPENAI_API_KEY: 'offline-openai-fixture', LUVANI_SCORING_VENDOR: 'speechace', SPEECHACE_API_KEY: 'synthetic' };
  for (const name of contract.roles.tutor.secrets) fixture[name] = `offline-fixture-${name}`.padEnd(48, 'x');
  for (const name of contract.roles.tutor.configuration) if (name.endsWith('_URL')) fixture[name] = `${name === 'LIVEKIT_URL' ? 'wss' : 'https'}://fixture.test`;
  for (const { flag, lesson, convo, missing } of cases) {
    const env = { ...fixture, LUVANI_PAID_QUOTE_BINDINGS: bindings(lesson, convo), ...(flag ? { LUVANI_AUDIO_SCORING: flag } : {}) };
    const r = spawnSync(process.execPath, ['deployment/validateEnvironment.mjs', 'tutor'], { cwd: root, env, encoding: 'utf8' });
    if (!missing.length) { assert.equal(r.status, 0, r.stderr); continue; }
    assert.notEqual(r.status, 0);
    for (const activity of ['lesson', 'convo']) {
      const named = r.stderr.includes(`live scoring requires a ${activity} quote binding with a scoring component`);
      assert.equal(named, missing.includes(activity), `${activity} in ${r.stderr}`);
    }
  }
});
