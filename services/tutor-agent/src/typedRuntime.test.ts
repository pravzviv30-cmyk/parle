import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionAudio, supportedSessionModes, supportsSessionMode, typedOnly } from '../../shared/sessionCapabilities.ts';
import { bootPlan, envGaps } from '../../shared/devPlan.ts';
import { missingRequired, preflight, verifyVendors } from './preflight.ts';
import { reportUsage } from './usage.ts';

const typed = {
  LUVANI_TYPED_ONLY: '1', LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'synthetic', LIVEKIT_API_SECRET: 'synthetic', ANTHROPIC_API_KEY: 'synthetic',
};

test('a worker with no usable voice can still serve the typed modes', async () => {
  assert.deepEqual(missingRequired(typed), []);
  assert.deepEqual(envGaps(typed, typed), []);
  const asked: string[] = [];
  const checks = await verifyVendors({ ...typed, ELEVEN_API_KEY: 'rejected', DEEPGRAM_API_KEY: 'rejected' }, '', async (url) => {
    asked.push(url);
    // A synthetic speech-vendor refusal would be fatal if it were requested.
    const ok = url.startsWith('https://api.anthropic.com/');
    return { ok, status: ok ? 200 : 401, json: async () => ({}) };
  });
  assert.deepEqual(checks, []);
  assert.deepEqual(asked, ['https://api.anthropic.com/v1/models']);
  assert.deepEqual(supportedSessionModes(typed), ['lesson-text', 'convo-text']);
  for (const mode of ['lesson-text', 'convo-text']) assert.equal(supportsSessionMode(mode, typed), true);
  for (const mode of ['lesson', 'convo', undefined, 'nonsense']) assert.equal(supportsSessionMode(mode, typed), false);
  const never = () => { throw new Error('typed sessions must not construct speech clients'); };
  assert.deepEqual(sessionAudio(true, { vad: never, stt: never, tts: never }), { vad: null, stt: undefined, tts: undefined });
});

test('typing-only recovery still requires transport and the selected brain', async () => {
  assert.deepEqual(missingRequired({ LUVANI_TYPED_ONLY: '1' }).sort(), ['ANTHROPIC_API_KEY', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL']);
  const checks = await verifyVendors(typed, '', async () => ({ ok: false, status: 401, json: async () => ({}) }));
  assert.equal(checks.length, 1);
  assert.ok(checks[0]);
  assert.equal(checks[0].vendor, 'Anthropic');
  assert.equal(checks[0].fatal, true);
  assert.ok(envGaps({ ...typed, ANTHROPIC_API_KEY: '' }, typed).some((gap) => gap.name === 'ANTHROPIC_API_KEY'));
});

test('both CLI options require their real SDK lesson dependency and a binary on direct worker startup', async () => {
  for (const brain of ['claude-cli', 'claude-cli-all']) {
    const incomplete = { ...typed, TUTOR_LLM: brain, ANTHROPIC_API_KEY: '' };
    assert.deepEqual(missingRequired(incomplete), ['GROQ_API_KEY']);
    const env = { ...incomplete, GROQ_API_KEY: 'synthetic' };
    assert.deepEqual(missingRequired(env), []);
    const exit = (code: number): never => { throw new Error(`refused ${code}`); };
    assert.throws(() => preflight(env, exit, () => false), /refused 1/);
    assert.doesNotThrow(() => preflight(env, exit, () => true));
    const asked: string[] = [];
    const checks = await verifyVendors(env, 'synthetic-model', async (url) => {
      asked.push(url);
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });
    assert.deepEqual(asked, ['https://api.groq.com/openai/v1/models']);
    assert.ok(checks[0]);
    assert.equal(checks[0].fatal, true, 'a missing SDK lesson model must refuse startup');
  }
});

test('ordinary spoken workers retain speech requirements and construct all audio clients', () => {
  for (const flag of [undefined, '', '0', 'true', ' 1 ']) assert.equal(typedOnly({ LUVANI_TYPED_ONLY: flag }), false);
  assert.deepEqual(missingRequired({ ...typed, LUVANI_TYPED_ONLY: '0' }).sort(), ['DEEPGRAM_API_KEY', 'ELEVEN_API_KEY']);
  const calls: string[] = [];
  const factory = (name: string) => () => { calls.push(name); return name; };
  assert.deepEqual(sessionAudio(false, { vad: factory('vad'), stt: factory('stt'), tts: factory('tts') }), { vad: 'vad', stt: 'stt', tts: 'tts' });
  assert.deepEqual(calls, ['vad', 'stt', 'tts']);
});

test('the supervisor refuses mismatched flags and reuses only matching server capabilities', () => {
  assert.ok(envGaps(typed, { ...typed, LUVANI_TYPED_ONLY: '0' }).some((gap) => gap.name === 'LUVANI_TYPED_ONLY'));
  const token = bootPlan(typed).find((step) => step.id === 'token')!;
  const probe = (body: unknown) => ({ reachable: true as const, status: 200, body: JSON.stringify(body) });
  assert.equal(token.identify(probe({ ok: true, supportedModes: supportedSessionModes(typed) })), true);
  assert.equal(token.identify(probe({ ok: true, supportedModes: supportedSessionModes({}) })), false);
  assert.equal(token.identify(probe({ ok: true })), false);
  assert.equal(token.identify(probe({ ok: true, supportedModes: ['convo-text', 'convo-text'] })), false);
  const full = bootPlan({}).find((step) => step.id === 'token')!;
  assert.equal(full.identify(probe({ ok: true, supportedModes: supportedSessionModes(typed) })), false);
  assert.equal(full.identify(probe({ ok: true })), true);
});

test('the shipped start route refuses speech before any grant or trial, and advertises the typed door', () => {
  const server = readFileSync(new URL('../../token-server/src/server.ts', import.meta.url), 'utf8');
  const guard = server.match(/if \(!supportsSessionMode\(mode\)\) return json\(res, 503, [^\n]+;/)?.[0];
  assert.ok(guard);
  const run = new Function('mode', 'supportsSessionMode', 'supportedSessionModes', 'json', 'res', `${guard}\nreturn 'grant';`);
  const json = (_res: unknown, status: number, body: unknown) => ({ status, body });
  const denied = run('convo', (mode: unknown) => supportsSessionMode(mode, typed), () => supportedSessionModes(typed), json, {});
  assert.deepEqual(denied, { status: 503, body: { error: 'voice-unavailable', message: 'Voice is unavailable here. You can start a typed conversation.', supportedModes: ['lesson-text', 'convo-text'] } });
  assert.equal(run('convo-text', (mode: unknown) => supportsSessionMode(mode, typed), () => supportedSessionModes(typed), json, {}), 'grant');
  const route = server.slice(server.indexOf(guard));
  assert.ok(route.indexOf('claimTrial') > 0);
  const agent = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  assert.ok(agent.indexOf('if (!supportsSessionMode(meta.mode') < agent.indexOf('sessionAudio(voiceless'));
  assert.match(agent, /voiceless \? \{ inputOptions: \{ audioEnabled: false \}, outputOptions: \{ audioEnabled: false \} \}/);
  assert.match(agent, /if \(!typedOnly\(\)\) proc.userData.vad = await silero.VAD.load\(\)/);
});

test('a mismatched signed spoken job reports zero use before rejecting, without constructing audio', async () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  const guard = source.match(/if \(!supportsSessionMode\(meta.mode \?\? 'lesson'\)\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(guard);
  const run = new Function('meta', 'participant', 'supportsSessionMode', 'reportUsage', `return (async () => { ${guard} })();`);
  const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sent: unknown[] = [];
  const report = (value: Parameters<typeof reportUsage>[0]) => reportUsage(value, {
    tokenServer: 'https://synthetic.example', agentSecret: 'synthetic',
    request: (async (_url: unknown, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ secondsRemaining: 120 }) };
    }) as typeof fetch,
  });
  await assert.rejects(run({ mode: 'convo', sessionId }, { identity: userId }, (mode: unknown) => supportsSessionMode(mode, typed), report), /typed sessions only/);
  assert.deepEqual(sent, [{ userId, sessionId, seconds: 0, utterancesScored: 0 }]);
  assert.ok(source.indexOf(guard) < source.indexOf('sessionAudio(voiceless'));
});
