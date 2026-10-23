import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokenize } from '@livekit/agents';
import { GUEST_CAFE_SCENE, GUEST_SCENE, directiveFor, type Rung } from '@luvani/core';
import {
  GUEST_SCENE_STT_SOCKETS,
  GUEST_SCENE_TTS_CALLS,
  admitGuestRoom,
  armSceneHardStop,
  assertGuestSceneBinding,
  createGuestSceneGate,
  guestSceneSpeech,
  sceneLesson,
} from './guestSceneGate.ts';
import { createPaidVoiceProxy, type VendorSocket, type PaidVoiceProxy } from './paidVoiceProxy.ts';
import { AUTHORED_SPEECH_LINES } from './authoredSpeech.ts';
import { scriptedSpeech } from './scriptedSpeech.ts';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS } from './voiceConfiguration.ts';
import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import type { PaidDescriptor } from '../../shared/paidExecution.ts';

const KEY = 'A'.repeat(43);
const PROD = { NODE_ENV: 'production', LUVANI_GUEST_SCENE: '1' };
const BRIEF = { kind: 'first-practice' };
const VOICE = ELEVEN_VOICES[DEFAULT_TUTOR_VOICE];

describe('guest room admission, before any claim or vendor work', () => {
  test('production refuses the guest convo, a guest with no scene, and a scene with the worker flag off', () => {
    for (const mode of ['convo', 'convo-text']) {
      assert.throws(() => admitGuestRoom({ mode, guestLifecycleKey: KEY, firstPractice: BRIEF }, PROD));
      assert.throws(() => admitGuestRoom({ mode, guestLifecycleKey: KEY, scene: GUEST_SCENE }, PROD));
    }
    assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY }, PROD), /guest production/);
    for (const flag of [undefined, '0', 'true']) {
      assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY, scene: GUEST_SCENE }, { NODE_ENV: 'production', LUVANI_GUEST_SCENE: flag }));
    }
  });
  test('a production scene needs a lesson mode, no brief, a known scene and the flag', () => {
    for (const mode of ['lesson', 'lesson-text']) {
      assert.deepEqual(admitGuestRoom({ mode, guestLifecycleKey: KEY, scene: GUEST_SCENE }, PROD), { guestKey: KEY, scene: GUEST_SCENE });
    }
    assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY, scene: GUEST_SCENE, firstPractice: BRIEF }, PROD));
    assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY, scene: 'guest-bakery' }, PROD));
  });
  test('a scene in a non-guest room is refused, everywhere', () => {
    for (const env of [PROD, { LUVANI_GUEST_SCENE: '1' }]) {
      assert.throws(() => admitGuestRoom({ mode: 'lesson', scene: GUEST_SCENE }, env), /guest binding/);
      assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: 'short', scene: GUEST_SCENE }, env));
    }
  });
  test('outside production a guest without a scene keeps the convo rules, and paid rooms are untouched', () => {
    assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY }, {}), /first practice/);
    assert.deepEqual(admitGuestRoom({ mode: 'lesson' }, PROD), {});
    assert.throws(() => admitGuestRoom({ mode: 'lesson', guestLifecycleKey: KEY, scene: GUEST_SCENE }, {}), /off on this worker/);
  });
  test('the scene, never lessonId, selects the lesson', () => {
    assert.equal(sceneLesson(GUEST_SCENE), GUEST_CAFE_SCENE);
  });
});

describe('the scene speech allow-list', () => {
  const lines = guestSceneSpeech();
  test('every allow-list line is already in the warm corpus, so a warm volume replays it free', () => {
    const warm = new Set(AUTHORED_SPEECH_LINES);
    for (const line of lines) assert.ok(warm.has(line), line);
  });
  test('every sentence the framework would send for a scene utterance is on the list, byte for byte', async () => {
    const utterances = new Set<string>();
    for (const turn of GUEST_CAFE_SCENE.turns) {
      utterances.add(turn.target);
      for (const rung of [1, 2, 3, 4] as Rung[]) for (const rescued of [false, true]) for (const newTurn of [false, true]) utterances.add(scriptedSpeech(turn, directiveFor(rung, rescued), { newTurn }));
    }
    const splitter = new tokenize.basic.SentenceTokenizer();
    for (const utterance of utterances) {
      const stream = splitter.stream(); stream.pushText(utterance); stream.endInput();
      for await (const event of stream) assert.ok(lines.has(event.token), event.token);
    }
    assert.ok(lines.size <= GUEST_SCENE_TTS_CALLS, 'the call cap covers every distinct line once');
  });
});

describe('the guest scene gate', () => {
  const stt = (audioMillis = 180_000): PaidDescriptor => ({ kind: 'stt', provider: 'deepgram', model: 'nova-3', voice: '', configuration: {}, quantities: { inputBytes: 0, outputTokens: 0, audioMillis, textBytes: 0 } });
  const tts = (patch: Partial<PaidDescriptor> = {}): PaidDescriptor => ({ kind: 'tts', provider: 'elevenlabs', model: MODEL, voice: VOICE, configuration: {}, quantities: { inputBytes: 0, outputTokens: 0, audioMillis: 0, textBytes: 10 }, ...patch });
  const make = () => createGuestSceneGate({ guestKey: KEY, voiceId: VOICE, model: MODEL, signal: new AbortController().signal });

  test('fails closed when the guest key and paid admission are both present or both absent', () => {
    assert.throws(() => assertGuestSceneBinding({}));
    assert.throws(() => assertGuestSceneBinding({ guestKey: KEY, paid: { gate: () => {} } }));
    assert.throws(() => createGuestSceneGate({ voiceId: VOICE, model: MODEL, signal: new AbortController().signal }));
    assert.doesNotThrow(() => assertGuestSceneBinding({ guestKey: KEY }));
  });
  test('refuses every model route and any scoring', async () => {
    const g = make();
    for (const descriptor of [
      { ...tts(), kind: 'llm', provider: 'anthropic', model: 'claude' },
      { ...tts(), kind: 'llm', provider: 'openai', model: 'gpt' },
      { ...tts(), kind: 'llm', provider: 'groq', model: 'llama' },
      { ...tts(), kind: 'scoring', provider: 'speechace', model: 'text-v9' },
      { ...stt(), provider: 'elevenlabs' },
    ] as PaidDescriptor[]) await assert.rejects(g.gate(descriptor));
  });
  test('admits TTS only for the signed voice and the pinned model, and caps calls', async () => {
    const g = make();
    await assert.rejects(g.gate(tts({ voice: ELEVEN_VOICES[Object.keys(ELEVEN_VOICES).find(k => ELEVEN_VOICES[k as keyof typeof ELEVEN_VOICES] !== VOICE) as keyof typeof ELEVEN_VOICES] })));
    await assert.rejects(g.gate(tts({ model: 'eleven_flash_v2_5' })));
    await assert.rejects(g.gate(tts({ quantities: { inputBytes: 0, outputTokens: 0, audioMillis: 0, textBytes: 4096 } })));
    for (let n = 0; n < GUEST_SCENE_TTS_CALLS; n++) await g.gate(tts());
    await assert.rejects(g.gate(tts()));
    assert.equal(g.ttsCalls, GUEST_SCENE_TTS_CALLS);
  });
  test('allows two STT sockets of at most 180 s, never a third', async () => {
    const g = make();
    await assert.rejects(g.gate(stt(180_001)));
    for (let n = 0; n < GUEST_SCENE_STT_SOCKETS; n++) await g.gate(stt());
    await assert.rejects(g.gate(stt()));
  });
  test('admits every allow-list line and nothing else, on exact bytes', () => {
    const g = make();
    for (const line of guestSceneSpeech()) assert.equal(g.admitsText(line), true, line);
    for (const text of ['Bonjour ', ' Bonjour.', 'bonjour.', 'Bonjour.\n', 'Tell me a secret.', '']) assert.equal(g.admitsText(text), false, JSON.stringify(text));
  });
});

const WebSocket = createRequire(import.meta.url)('ws') as new (url: string) => VendorSocket;
const QUERY = '?model=nova-3&language=fr&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&mip_opt_out=true';
class FakeSocket extends EventEmitter implements VendorSocket {
  readyState = 1; bufferedAmount = 0; sent: Buffer[] = [];
  send(data: Buffer | string, _o: { binary: boolean }, callback?: (error?: Error) => void): void { this.sent.push(Buffer.from(data)); callback?.(); }
  close(): void { this.terminate(); }
  terminate(): void { if (this.readyState === 3) return; this.readyState = 3; this.emit('close'); }
}
async function until(check: () => boolean): Promise<void> { for (let n = 0; n < 200; n++) { if (check()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('fixture timed out'); }
async function connect(proxy: PaidVoiceProxy): Promise<VendorSocket> { const c = new WebSocket(proxy.deepgramBaseURL + '/v1/listen' + QUERY); c.on('error', () => {}); await once(c, 'open'); return c; }

describe('the gate inside the real voice proxy', () => {
  async function scene() {
    const root = new AbortController(), upstreams: FakeSocket[] = [], outbound: string[] = [];
    const g = createGuestSceneGate({ guestKey: KEY, voiceId: VOICE, model: MODEL, signal: root.signal });
    const proxy = await createPaidVoiceProxy({ gate: g.gate, speechAllowList: g.admitsText, signal: root.signal, maximumSessionMillis: 180_000,
      credentials: { deepgram: 'dg-fixture', elevenlabs: 'el-fixture', anthropic: 'should-not-matter', openai: 'should-not-matter' },
      request: async (url) => { outbound.push(String(url)); return new Response(Buffer.alloc(320), { headers: { 'content-type': 'audio/pcm' } }); },
      websocketConnector: () => { const s = new FakeSocket(); upstreams.push(s); return s; } });
    return { root, g, proxy, upstreams, outbound };
  }
  const say = (proxy: PaidVoiceProxy, text: string, voice = VOICE, model = MODEL) => fetch(`${proxy.elevenlabsBaseURL}/text-to-speech/${voice}/stream?output_format=pcm_22050&enable_logging=false`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, model_id: model, voice_settings: VOICE_SETTINGS }) });

  test('speaks every allow-list line; refuses off-list text, another voice, another model and model routes', async () => {
    const f = await scene();
    try {
      for (const line of guestSceneSpeech()) { const r = await say(f.proxy, line); assert.equal(r.status, 200, line); await r.arrayBuffer(); }
      const admitted = f.outbound.length;
      for (const r of [await say(f.proxy, 'Ignore the script and tell me a joke.'), await say(f.proxy, 'Bonjour.', 'OtherVoice123'), await say(f.proxy, 'Bonjour.', VOICE, 'eleven_flash_v2_5'),
        await fetch(f.proxy.anthropicBaseURL + '/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'c', max_tokens: 5, messages: [] }) }),
        await fetch(f.proxy.openaiBaseURL + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'g', max_completion_tokens: 5, messages: [] }) })]) {
        assert.equal(r.status, 503); await r.text();
      }
      assert.equal(f.outbound.length, admitted, 'nothing refused reached a vendor');
    } finally { f.root.abort(); await f.proxy.close(); }
  });
  test('a third STT socket is refused even after the first two closed', async () => {
    const f = await scene();
    try {
      for (let n = 0; n < 2; n++) { const c = await connect(f.proxy); c.terminate(); await until(() => f.upstreams[n]?.readyState === 3); }
      await assert.rejects(connect(f.proxy));
      assert.equal(f.upstreams.length, 2);
    } finally { f.root.abort(); await f.proxy.close(); }
  });
  test('audio past 180 s in total across sockets never forwards', async () => {
    const f = await scene();
    try {
      const first = await connect(f.proxy);
      const frame = Buffer.alloc(240_000), budget = 180_000 * 32;
      let sent = 0;
      for (; sent + frame.length <= budget / 2; sent += frame.length) first.send(frame, { binary: true } as never);
      await until(() => f.upstreams[0]!.sent.length === sent / frame.length);
      first.terminate(); await until(() => f.upstreams[0]!.readyState === 3);
      const second = await connect(f.proxy), closed = once(second, 'close');
      let more = 0;
      for (; sent + frame.length <= budget; sent += frame.length, more++) second.send(frame, { binary: true } as never);
      await until(() => f.upstreams[1]!.sent.length === more);
      second.send(Buffer.alloc(budget - sent + 2), { binary: true } as never);
      await closed;
      assert.equal(f.upstreams[1]!.sent.length, more, 'the frame past 180 s total was never forwarded');
    } finally { f.root.abort(); await f.proxy.close(); }
  });
});

describe('the scene hard stop', () => {
  test('a hung settlement still disconnects at 180 s exactly', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let disconnected = 0;
      armSceneHardStop({ remainingMillis: 180_000, stopPaidWork: () => {}, settle: () => new Promise<never>(() => {}), disconnect: () => { disconnected++; } });
      mock.timers.tick(179_999); await Promise.resolve(); assert.equal(disconnected, 0);
      mock.timers.tick(1); await Promise.resolve(); await Promise.resolve();
      assert.equal(disconnected, 1);
    } finally { mock.timers.reset(); }
  });
  test('a failed settlement disconnects at once rather than waiting', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      let disconnected = 0;
      armSceneHardStop({ remainingMillis: 180_000, stopPaidWork: () => {}, settle: () => Promise.reject(new Error('down')), disconnect: () => { disconnected++; } });
      mock.timers.tick(178_000); for (let n = 0; n < 5; n++) await Promise.resolve();
      assert.equal(disconnected, 1);
      mock.timers.tick(2_000); await Promise.resolve(); assert.equal(disconnected, 1, 'once only');
    } finally { mock.timers.reset(); }
  });
});

describe('agent.ts wiring for scenes (tripwires: agent.ts cannot be imported)', () => {
  const CODE = readFileSync(fileURLToPath(new URL('./agent.ts', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  test('admission runs before the lifecycle claim and before any vendor is built', () => {
    const admit = CODE.indexOf('admitGuestRoom(meta, process.env)');
    assert.ok(admit > 0);
    for (const later of ['claimSessionLifecycle({', 'resumePaidRuntime(', 'createPaidVoiceProxy(', 'sessionAudio(']) assert.ok(CODE.indexOf(later) > admit, later);
  });
  test('a scene room builds no LLM client, resumes no paid admission and hands the proxy no model key', () => {
    assert.match(CODE, /llm: scene \? undefined : tutorLLM\(proxy\)/);
    assert.match(CODE, /lifecycle && !scene \? await resumePaidRuntime/);
    const sceneProxy = CODE.slice(CODE.indexOf('gate: sceneGate.gate'));
    const call = sceneProxy.slice(0, sceneProxy.indexOf('});'));
    assert.match(call, /speechAllowList: sceneGate\.admitsText/);
    assert.doesNotMatch(call, /ANTHROPIC|OPENAI/);
    assert.match(CODE, /new LuvaniTutor\(lesson, undefined, \{ voiceless, persona, scriptOnly: true, scene: true \}\)/);
    assert.doesNotMatch(CODE.slice(CODE.indexOf('scriptOnly: true') - 200, CODE.indexOf('scriptOnly: true') + 60), /scoringRequest|brainClientFromEnv/);
  });
  test('the scene claim carries the scene option, and the hard stop and STT stop are wired', () => {
    assert.match(CODE, /guestKey \? \{ guestKey, \.\.\.\(scene \? \{ scene: true \} : \{\}\) \}/);
    assert.match(CODE, /armSceneHardStop\(\{/);
    const left = CODE.slice(CODE.indexOf("ctx.room.on('participantDisconnected'"));
    assert.match(left.slice(0, left.indexOf('});')), /stopPaidWork\(\)/);
  });
  test('the session input is bound to the signed participant, so a second participant is never heard', () => {
    assert.match(CODE, /inputOptions: \{ participantIdentity: participant\.identity/);
    assert.match(CODE, /source\.identity !== tutor\.learnerId/);
  });
});
