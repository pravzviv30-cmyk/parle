import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before
// any plugin TTS is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';
import {
  OUTPUT_ENCODING,
  BEGINNER_SPEED,
  ELEVEN_VOICES,
  MODEL,
  buildTTS,
  LANGUAGE_CODE,
  VOICE_KEY,
  VOICE_SETTINGS,
  resolveTutorVoice,
  selectedVoiceVendor,
  synthesisProbeRequest,
  tutorSpeedFor,
} from './voice.ts';
import { FISH_SETTINGS } from './voiceFish.ts';

/**
 * buildTTS reads the environment, so these tests own it for their duration:
 * a fake API key (the constructor refuses to build without one; nothing here
 * makes a network call), no configured voice, and a throwaway cache dir so a
 * test run never touches the real warmed cache.
 *
 * The four vendor variables are cleared as well as saved. Without that, a
 * developer who has LUVANI_TTS_VENDOR=fish in their own shell would silently
 * run every assertion below against the wrong vendor, and their real FISH_API_KEY
 * would be read by a test process — neither of which should ever be possible.
 */
const ENV_KEYS = [
  'ELEVEN_API_KEY',
  'ELEVEN_VOICE_ID',
  'TTS_CACHE_DIR',
  'LUVANI_TTS_VENDOR',
  'FISH_API_KEY',
  'FISH_VOICE_ID',
  'FISH_MODEL',
  'LUVANI_CONVERSATION_TTS_MODEL',
] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ELEVEN_API_KEY = 'test-key-never-sent';
  delete process.env.ELEVEN_VOICE_ID;
  delete process.env.LUVANI_TTS_VENDOR;
  delete process.env.FISH_API_KEY;
  delete process.env.FISH_VOICE_ID;
  delete process.env.FISH_MODEL;
  delete process.env.LUVANI_CONVERSATION_TTS_MODEL;
  process.env.TTS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'luvani-voice-'));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('the voice configuration', () => {
  test('the output encoding is pinned, not left to the plugin default', () => {
    // F506. This file pins the model, the settings and the language so a plugin
    // upgrade cannot move the sound on its own, and for months it forgot this
    // knob, so the format was whatever the plugin happened to default to.
    //
    // 22050 is not a preference, it is the ceiling: pcm_44100 is refused on this
    // account with a 403 naming the Pro tier. Pinning what the plugin was already
    // producing re-keys nothing, because the rate has always been in the cache
    // hash via inner.sampleRate. Widening it is a subscription, not an edit.
    assert.equal(OUTPUT_ENCODING, 'pcm_22050', 'the output format is no longer the one F506 measured as the ceiling');
    assert.equal(buildTTS().sampleRate, 22050, 'the built TTS does not produce the rate this file pins');

    // And it is actually handed to the plugin, rather than pinned in a constant
    // nothing reads — which is the shape the old bug had.
    const source = readFileSync(new URL('./voice.ts', import.meta.url), 'utf8');
    assert.match(source, /encoding: OUTPUT_ENCODING/, 'the pinned encoding never reaches the vendor request');
  });

  test('the model is pinned, not left to the plugin default', () => {
    assert.equal(buildTTS().model, 'eleven_multilingual_v2');
  });

  test('the cache key fingerprints voice, model and delivery settings', () => {
    // Full-string equality on purpose: any settings change must change this key,
    // so audio synthesized under old settings is never replayed under new ones.
    //
    // The `default` segment used to be the literal word, because the voice came
    // from an env var that was usually unset. It is now Luc's VENDOR id, which
    // is the same discipline one level stricter: two learners on two different
    // catalogue voices cannot collide, and a voice re-cloned under the same
    // catalogue key gets a new id and therefore a new cache.
    assert.equal(
      buildTTS().opts.voiceKey,
      'elevenlabs:c365oriviHmAhyLhpuN6:eleven_multilingual_v2:sl3:lang=auto:similarity_boost=80,stability=40,style=30,use_speaker_boost=true',
    );
  });

  test('live synthesis preflight omits the old French-only language request', () => {
    const request = JSON.parse(synthesisProbeRequest(ELEVEN_VOICES.alexandre).body);
    assert.equal(Object.hasOwn(request, 'language_code'), false);
    assert.equal(request.model_id, 'eleven_multilingual_v2');
    assert.deepEqual(request.voice_settings, VOICE_SETTINGS);
  });

  test('every delivery knob that is sent is in the cache key, so none can drift', () => {
    // The bug this replaces: the fingerprint was hand-listed and covered
    // stability and similarity boost only. Adding style, speaker boost or a
    // language code changed what the vendor was asked for while the cache went
    // on replaying audio made under the old answer, which is the one failure
    // this whole file exists to prevent. The fingerprint is derived from the
    // settings object now, and this holds it to that.
    const key = buildTTS().opts.voiceKey;
    for (const knob of Object.keys(VOICE_SETTINGS)) {
      assert.ok(key.includes(knob), `${knob} is sent to the vendor but is not in the cache key`);
    }
  });

  test('the language the vendor is told to expect is in the cache key too', () => {
    // Not cosmetic: the plugin appends language_code to every request and the
    // vendor uses it to enforce the language for text normalization as well as
    // the model. Two different answers must never share cached audio.
    assert.match(buildTTS().opts.voiceKey, new RegExp(`lang=${LANGUAGE_CODE ?? 'auto'}`));
  });

  // Re-pointed from 'a configured voice id lands in the cache key'. The fact
  // that test guarded — the voice the tutor will actually speak with is in the
  // cache key — is unchanged; what supplies it moved from an env var to the
  // learner's chosen catalogue key, so the assertion follows it there.
  test("the chosen voice's vendor id lands in the cache key, so two voices never share a WAV", () => {
    const keys = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
    const seen = new Map<string, TutorVoiceKey>();

    for (const key of keys) {
      const cacheKey = buildTTS({ voice: key }).opts.voiceKey;
      assert.ok(
        cacheKey.startsWith(`elevenlabs:${ELEVEN_VOICES[key]}:`),
        `${key} must be cached under its own vendor id, got ${cacheKey}`,
      );
      const collision = seen.get(cacheKey);
      assert.equal(
        collision,
        undefined,
        `${key} and ${collision} share a cache key, so one would replay the other's audio`,
      );
      seen.set(cacheKey, key);
    }

    assert.equal(seen.size, keys.length, 'eight voices must produce eight distinct caches');
  });

  test('buildTTS speaks the default voice when nothing is chosen', () => {
    // Two callers build this bare: the warm-cache script and any code path that
    // has not learned about the chooser yet. Neither may silently get the
    // vendor's own default voice, which is how the tutor spent months sounding
    // like an American woman.
    assert.equal(buildTTS().opts.voiceKey, buildTTS({ voice: DEFAULT_TUTOR_VOICE }).opts.voiceKey);
    assert.ok(buildTTS().opts.voiceKey.includes(ELEVEN_VOICES[DEFAULT_TUTOR_VOICE]));
  });

  test('ELEVEN_VOICE_ID is read by nothing any more', () => {
    // Retired by the catalogue. It is left in place here as a live check rather
    // than deleted, because a stale value in somebody's .env must not be able to
    // quietly reappear in the cache key or at the vendor: the learner's choice
    // is the only thing that decides the voice now. preflight names it when set.
    process.env.ELEVEN_VOICE_ID = 'voix-test';
    assert.ok(!buildTTS().opts.voiceKey.includes('voix-test'), 'a retired variable must not reach the cache key');
    assert.equal(
      buildTTS().opts.voiceKey,
      buildTTS({ voice: DEFAULT_TUTOR_VOICE }).opts.voiceKey,
      'and must not change which voice is spoken',
    );

    // And nothing in the module reads it. Source-level, because an env var read
    // on a branch no test happens to take is exactly how one survives a retirement.
    const source = readFileSync(new URL('./voice.ts', import.meta.url), 'utf8');
    assert.ok(!source.includes('ELEVEN_VOICE_ID'), 'voice.ts still reads the retired variable');

    // Nor is it still handed out. A tracked example that assigns a dead
    // variable is how a retirement gets undone: the next person regenerates
    // their .env from it and puts the line back. Prose about the retirement is
    // welcome; an assignment is not.
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    assert.ok(
      !example.split('\n').some((line) => /^#?\s*ELEVEN_VOICE_ID\s*=/.test(line)),
      '.env.example still assigns ELEVEN_VOICE_ID, commented or not',
    );
    assert.match(example, /voices\.ts/, 'and it has to say where the voices actually are');
  });

  test('ELEVEN_VOICES names a non-empty vendor id for every catalogue voice', () => {
    // `Record<TutorVoiceKey, string>` already makes a MISSING key a compile
    // error. What it cannot catch is an empty or duplicated id, and both reach a
    // learner the same way: a room that opens and a tutor that never speaks, or
    // worse, a tutor speaking in somebody else's voice.
    const ids = Object.entries(ELEVEN_VOICES);
    assert.equal(ids.length, Object.keys(TUTOR_VOICES).length, 'every catalogue voice needs an id and no id is spare');
    for (const [key, id] of ids) {
      assert.ok(key in TUTOR_VOICES, `${key} has a vendor id and is not in the catalogue`);
      assert.match(id, /^[A-Za-z0-9]{16,}$/, `${key}'s vendor id does not look like one: ${JSON.stringify(id)}`);
    }
    assert.equal(new Set(ids.map(([, id]) => id)).size, ids.length, 'two catalogue keys point at one vendor voice');
  });
});

/**
 * The guard between anything the app can send and the billed vendor URL.
 *
 * The agent is the only process holding the ElevenLabs key, so this is the last
 * hop: whatever `resolveTutorVoice` returns becomes a path segment in a request
 * somebody pays for. It therefore returns a catalogue key or the default, and
 * never throws — a learner whose profile carries a voice we have since retired
 * gets Luc and a lesson, not a stack trace in a room that already opened.
 */
describe('resolving the voice the app asked for', () => {
  test('a key in the catalogue resolves to itself', () => {
    for (const key of Object.keys(TUTOR_VOICES) as TutorVoiceKey[]) {
      assert.equal(resolveTutorVoice(key), key);
    }
  });

  test('anything else resolves to the default, and never throws', () => {
    const hostile: unknown[] = [
      undefined,
      null,
      '',
      '   ',
      'LUC',
      'luc ',
      'retired-voice',
      '../../etc/passwd',
      'IPgYtHTNLjC7Bq7IPHrm', // a vendor id, which is never an app-level key
      'toString', // reachable through the prototype chain if the guard used `in`
      'constructor',
      42,
      true,
      { key: 'luc' },
      ['luc'],
    ];
    for (const value of hostile) {
      assert.equal(resolveTutorVoice(value), DEFAULT_TUTOR_VOICE, `${JSON.stringify(value)} must fall back, not pass`);
    }
  });
});

describe('which voice vendor the env selects', () => {
  test('LUVANI_TTS_VENDOR empty, blank or unknown selects ElevenLabs, case and whitespace insensitively', () => {
    // The same trap TUTOR_LLM fell into, and the reason this is parsed rather
    // than read: `??` does not fall back on the empty string, so a
    // `LUVANI_TTS_VENDOR=` line would select a vendor while reading to a human
    // as "unset, take the default". ElevenLabs is the default and hundreds of
    // warmed WAVs on disk depend on it staying so.
    assert.equal(selectedVoiceVendor({}), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: '' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: '   ' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: 'nonsense' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: 'ELEVENLABS' }), 'elevenlabs');

    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: 'fish' }), 'fish');
    assert.equal(selectedVoiceVendor({ LUVANI_TTS_VENDOR: ' FISH ' }), 'fish');

    // And each vendor names the one credential it cannot speak without.
    assert.deepEqual(VOICE_KEY, { elevenlabs: 'ELEVEN_API_KEY', fish: 'FISH_API_KEY' });
  });

  test('LUVANI_TTS_VENDOR=fish builds a fish TTS pinned to s2.1-pro-free, and FISH_MODEL overrides it into the cache key', () => {
    // The pin is a bill, not a preference. fish sends the model as an HTTP
    // header and falls back to the PAID s2.1-pro when it is omitted or
    // unrecognised — which is also the plugin's own default — so an unpinned
    // model bills at about $15 per million bytes without saying so.
    process.env.LUVANI_TTS_VENDOR = 'fish';
    process.env.FISH_API_KEY = 'test-key-never-sent';

    const free = buildTTS();
    assert.equal(free.model, 's2.1-pro-free');
    assert.ok(free.opts.voiceKey.includes(':s2.1-pro-free:'), 'the model has to be in the cache key');

    // The escape for the day fish's free window closes. It must re-key the
    // cache, or the paid model would replay audio made by the free one.
    process.env.FISH_MODEL = 's2-pro';
    const paid = buildTTS();
    assert.equal(paid.model, 's2-pro');
    assert.ok(paid.opts.voiceKey.includes(':s2-pro:'));
    assert.notEqual(paid.opts.voiceKey, free.opts.voiceKey);
  });

  test('the fish cache key fingerprints vendor, voice, model and every delivery knob, so none can drift', () => {
    process.env.LUVANI_TTS_VENDOR = 'fish';
    process.env.FISH_API_KEY = 'test-key-never-sent';

    const unset = buildTTS().opts.voiceKey;
    assert.ok(unset.startsWith('fish:default:s2.1-pro-free:'), `got ${unset}`);

    process.env.FISH_VOICE_ID = 'voix-fr';
    const key = buildTTS().opts.voiceKey;
    assert.ok(key.startsWith('fish:voix-fr:s2.1-pro-free:'), `got ${key}`);
    assert.notEqual(key, unset, 'a different voice must never share cached audio');

    // Derived from the settings object, exactly as the ElevenLabs fingerprint
    // is, so a knob added to FISH_SETTINGS cannot escape the cache key and
    // leave the cache replaying audio made under the old answer.
    for (const knob of Object.keys(FISH_SETTINGS)) {
      assert.ok(key.includes(knob), `${knob} is sent to fish but is not in the cache key`);
    }

    // And it never collides with the ElevenLabs namespace, whatever is set.
    delete process.env.LUVANI_TTS_VENDOR;
    assert.ok(buildTTS().opts.voiceKey.startsWith('elevenlabs:'));
  });

  test('.env.example documents LUVANI_TTS_VENDOR and every FISH_ variable the worker reads', () => {
    // Derived from the source rather than listed here: a variable read by the
    // worker and absent from the example is a setting nobody can discover, and
    // for FISH_MODEL that means discovering it on an invoice.
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./voiceFish.ts', import.meta.url), 'utf8');
    const read = new Set([VOICE_KEY.fish, ...[...source.matchAll(/env\.(FISH_[A-Z_]+)/g)].map((m) => m[1]!)]);

    assert.ok(read.size >= 3, 'the worker reads more FISH_ variables than this found');
    for (const name of read) {
      assert.match(example, new RegExp(`\\b${name}\\b`), `${name} is read by the worker and undocumented`);
    }
    assert.match(example, /LUVANI_TTS_VENDOR/);
    assert.match(example, /s2\.1-pro-free/, 'the pinned model, and why it is pinned, belong in the example');
    assert.match(example, /FISH_AUDIO_API_KEY/, 'the near-miss preflight warns about belongs here too');

    // Never shipped blank. That was the TUTOR_LLM lesson: an empty assignment
    // reads as "unset" to a person and as "set" to `??`.
    assert.ok(
      !example.split('\n').some((line) => /^\s*LUVANI_TTS_VENDOR\s*=\s*$/.test(line)),
      'LUVANI_TTS_VENDOR must be commented out, not shipped as a blank assignment',
    );
  });

  test('.env.example carries the names to fill in and never a key', () => {
    // Caught for real while writing this file: a live-looking fish key was
    // pasted into the example next to the variable it documents. The example is
    // tracked, so the next commit publishes it — and a commented-out line is
    // still a committed secret. Its own first line says "never commit the
    // filled version", which until now nothing enforced.
    //
    // LIVEKIT_API_KEY is the documented exception: `devkey`/`secret` are the
    // published credentials of `livekit-server --dev` and are not anybody's.
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    for (const [i, line] of example.split('\n').entries()) {
      const match = /^#?\s*([A-Z][A-Z0-9_]*(?:API_KEY|_SECRET|_TOKEN))\s*=\s*(.*)$/.exec(line);
      if (match === null) continue;
      const [, name, value] = match;
      if (name === 'LIVEKIT_API_KEY' || name === 'LIVEKIT_API_SECRET') continue;
      assert.equal(value, '', `line ${i + 1}: ${name} carries a value in a tracked file. Rotate it, then empty it.`);
    }
  });
});

describe('the slower beginner voice (VOICE-016)', () => {
  const NORMAL_KEY = 'elevenlabs:c365oriviHmAhyLhpuN6:eleven_multilingual_v2:sl3:lang=auto:similarity_boost=80,stability=40,style=30,use_speaker_boost=true';

  test('tutorSpeedFor: scripted content is slower, convo is slower below A2, the switch wins', () => {
    assert.equal(tutorSpeedFor({ kind: 'lesson' }), BEGINNER_SPEED);
    assert.equal(tutorSpeedFor({ kind: 'scene' }), BEGINNER_SPEED);
    assert.equal(tutorSpeedFor({ kind: 'lesson', cefr: 'B2' }), BEGINNER_SPEED);
    for (const cefr of ['A0', 'A1', undefined, '', 'unknown']) assert.equal(tutorSpeedFor({ kind: 'convo', cefr }), BEGINNER_SPEED, String(cefr));
    for (const cefr of ['A2', 'B1', 'B2', 'C1', 'C2']) assert.equal(tutorSpeedFor({ kind: 'convo', cefr }), undefined, cefr);
    assert.equal(tutorSpeedFor({ kind: 'convo', cefr: 'B1', choice: 'slower' }), BEGINNER_SPEED);
    assert.equal(tutorSpeedFor({ kind: 'lesson', choice: 'normal' }), undefined);
    assert.equal(tutorSpeedFor({ kind: 'convo', cefr: 'A0', choice: 'normal' }), undefined);
  });

  test('a speed is its own cache: it enters the voiceKey, and no speed keeps the key byte-identical', () => {
    assert.equal(buildTTS().opts.voiceKey, NORMAL_KEY);
    assert.equal(buildTTS({ speed: undefined }).opts.voiceKey, NORMAL_KEY);
    const slower = buildTTS({ speed: BEGINNER_SPEED }).opts.voiceKey;
    assert.equal(slower, NORMAL_KEY.replace('similarity_boost=80,', `similarity_boost=80,speed=${Math.round(BEGINNER_SPEED * 100)},`));
    // Pinned for the measured 0.85; update with BEGINNER_SPEED.
    assert.equal(BEGINNER_SPEED, 0.85);
    assert.equal(slower, NORMAL_KEY.replace('similarity_boost=80,', 'similarity_boost=80,speed=85,'));
    assert.deepEqual(VOICE_SETTINGS, { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }, 'the global settings never carry a speed');
  });

  test('the speed reaches the vendor request on both models, and only when asked for', async () => {
    process.env.LUVANI_CONVERSATION_TTS_MODEL = 'eleven_flash_v2_5';
    const bodies: Record<string, unknown>[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return new Response(new Uint8Array(0), { headers: { 'content-type': 'audio/pcm' } }); }) as typeof fetch;
    try {
      const slower = buildTTS({ speed: BEGINNER_SPEED, conversationTier: true });
      assert.equal(slower.opts.conversation!.voiceKey, slower.opts.voiceKey.replace(`:${MODEL}:`, ':eleven_flash_v2_5:'));
      for (const inner of [slower.inner, slower.opts.conversation!.inner, buildTTS().inner]) { inner.on('error', () => {}); await inner.synthesize('Bonjour.').collect().catch(() => {}); }
      const sent = bodies.map((body) => body.voice_settings as Record<string, unknown>);
      assert.equal(sent.length, 3);
      assert.ok(sent.some((settings) => settings.speed === BEGINNER_SPEED));
      assert.deepEqual(bodies.filter((b) => b.model_id === 'eleven_flash_v2_5').map((b) => (b.voice_settings as Record<string, unknown>).speed), bodies.filter((b) => b.model_id === 'eleven_flash_v2_5').map(() => BEGINNER_SPEED));
      assert.ok(sent.some((settings) => !Object.hasOwn(settings, 'speed')), 'normal speed sends no speed key');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('a speed outside what the paid proxy admits is refused before any vendor work', () => {
    for (const speed of [0.6, 1.3, Number.NaN, Number.POSITIVE_INFINITY, '0.9' as unknown as number]) assert.throws(() => buildTTS({ speed }), /voice speed/);
  });
});

describe('the free-conversation voice model switch (LUVANI_CONVERSATION_TTS_MODEL)', () => {
  test('off by default: no second voice is built and every line uses MODEL', async () => {
    const built = buildTTS({ conversationTier: true });
    assert.equal(built.opts.conversation, undefined);
    assert.equal(built.charsBilledConversation, undefined);
    assert.equal(built.inner.model, MODEL);
    assert.equal(built.route('Tu aimes le jazz ?').inner, built.inner);
    await built.close();
  });

  test('on: free conversation gets eleven_flash_v2_5 with the same voice, settings and format', async () => {
    process.env.LUVANI_CONVERSATION_TTS_MODEL = 'eleven_flash_v2_5';
    const built = buildTTS({ conversationTier: true, voice: 'marie' });
    const conversation = built.opts.conversation!;
    assert.equal(built.inner.model, MODEL);
    assert.equal(conversation.inner.model, 'eleven_flash_v2_5');
    assert.equal(conversation.inner.sampleRate, built.inner.sampleRate);
    assert.equal(conversation.voiceKey, built.opts.voiceKey.replace(`:${MODEL}:`, ':eleven_flash_v2_5:'));
    assert.ok(conversation.voiceKey.startsWith(`elevenlabs:${ELEVEN_VOICES.marie}:`));
    assert.equal(built.charsBilledConversation, 0);
    await built.close();
  });

  test('the warm-cache and sample scripts never get the conversation voice', async () => {
    process.env.LUVANI_CONVERSATION_TTS_MODEL = 'eleven_flash_v2_5';
    const built = buildTTS({ missTransport: 'http' });
    assert.equal(built.opts.conversation, undefined);
    await built.close();
  });

  test('an unknown model is refused, naming the variable', () => {
    process.env.LUVANI_CONVERSATION_TTS_MODEL = 'eleven_turbo_v2_5';
    assert.throws(() => buildTTS({ conversationTier: true }), /LUVANI_CONVERSATION_TTS_MODEL/);
  });

  test('the fish vendor ignores the switch', async () => {
    process.env.LUVANI_CONVERSATION_TTS_MODEL = 'eleven_flash_v2_5';
    process.env.LUVANI_TTS_VENDOR = 'fish';
    process.env.FISH_API_KEY = 'test-key-never-sent';
    process.env.FISH_VOICE_ID = 'fish-voice';
    const built = buildTTS({ conversationTier: true });
    assert.equal(built.opts.conversation, undefined);
    await built.close();
  });
});
