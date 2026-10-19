import assert from 'node:assert/strict';
import { test } from 'node:test';
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
