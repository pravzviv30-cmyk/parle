import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before
// any plugin TTS is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { buildTTS, LANGUAGE_CODE, VOICE_KEY, VOICE_SETTINGS, selectedVoiceVendor } from './voice.ts';
import { FISH_SETTINGS } from './voiceFish.ts';

/**
 * buildTTS reads the environment, so these tests own it for their duration:
 * a fake API key (the constructor refuses to build without one; nothing here
 * makes a network call), no configured voice, and a throwaway cache dir so a
 * test run never touches the real warmed cache.
 *
 * The four vendor variables are cleared as well as saved. Without that, a
 * developer who has PARLE_TTS_VENDOR=fish in their own shell would silently
 * run every assertion below against the wrong vendor, and their real FISH_API_KEY
 * would be read by a test process — neither of which should ever be possible.
 */
const ENV_KEYS = [
  'ELEVEN_API_KEY',
  'ELEVEN_VOICE_ID',
  'TTS_CACHE_DIR',
  'PARLE_TTS_VENDOR',
  'FISH_API_KEY',
  'FISH_VOICE_ID',
  'FISH_MODEL',
] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ELEVEN_API_KEY = 'test-key-never-sent';
  delete process.env.ELEVEN_VOICE_ID;
  delete process.env.PARLE_TTS_VENDOR;
  delete process.env.FISH_API_KEY;
  delete process.env.FISH_VOICE_ID;
  delete process.env.FISH_MODEL;
  process.env.TTS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'parle-voice-'));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('the voice configuration', () => {
  test('the model is pinned, not left to the plugin default', () => {
    assert.equal(buildTTS().model, 'eleven_multilingual_v2');
  });

  test('the cache key fingerprints voice, model and delivery settings', () => {
    // Full-string equality on purpose: any settings change must change this key,
    // so audio synthesized under old settings is never replayed under new ones.
    assert.equal(
      buildTTS().opts.voiceKey,
      'elevenlabs:default:eleven_multilingual_v2:sl3:lang=fr:similarity_boost=80,stability=40,style=30,use_speaker_boost=true',
    );
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

  test('a configured voice id lands in the cache key', () => {
    process.env.ELEVEN_VOICE_ID = 'voix-test';
    assert.ok(buildTTS().opts.voiceKey.startsWith('elevenlabs:voix-test:'));
  });
});

describe('which voice vendor the env selects', () => {
  test('PARLE_TTS_VENDOR empty, blank or unknown selects ElevenLabs, case and whitespace insensitively', () => {
    // The same trap TUTOR_LLM fell into, and the reason this is parsed rather
    // than read: `??` does not fall back on the empty string, so a
    // `PARLE_TTS_VENDOR=` line would select a vendor while reading to a human
    // as "unset, take the default". ElevenLabs is the default and hundreds of
    // warmed WAVs on disk depend on it staying so.
    assert.equal(selectedVoiceVendor({}), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: '' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: '   ' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: 'nonsense' }), 'elevenlabs');
    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: 'ELEVENLABS' }), 'elevenlabs');

    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: 'fish' }), 'fish');
    assert.equal(selectedVoiceVendor({ PARLE_TTS_VENDOR: ' FISH ' }), 'fish');

    // And each vendor names the one credential it cannot speak without.
    assert.deepEqual(VOICE_KEY, { elevenlabs: 'ELEVEN_API_KEY', fish: 'FISH_API_KEY' });
  });

  test('PARLE_TTS_VENDOR=fish builds a fish TTS pinned to s2.1-pro-free, and FISH_MODEL overrides it into the cache key', () => {
    // The pin is a bill, not a preference. fish sends the model as an HTTP
    // header and falls back to the PAID s2.1-pro when it is omitted or
    // unrecognised — which is also the plugin's own default — so an unpinned
    // model bills at about $15 per million bytes without saying so.
    process.env.PARLE_TTS_VENDOR = 'fish';
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
    process.env.PARLE_TTS_VENDOR = 'fish';
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
    delete process.env.PARLE_TTS_VENDOR;
    assert.ok(buildTTS().opts.voiceKey.startsWith('elevenlabs:'));
  });

  test('.env.example documents PARLE_TTS_VENDOR and every FISH_ variable the worker reads', () => {
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
    assert.match(example, /PARLE_TTS_VENDOR/);
    assert.match(example, /s2\.1-pro-free/, 'the pinned model, and why it is pinned, belong in the example');
    assert.match(example, /FISH_AUDIO_API_KEY/, 'the near-miss preflight warns about belongs here too');

    // Never shipped blank. That was the TUTOR_LLM lesson: an empty assignment
    // reads as "unset" to a person and as "set" to `??`.
    assert.ok(
      !example.split('\n').some((line) => /^\s*PARLE_TTS_VENDOR\s*=\s*$/.test(line)),
      'PARLE_TTS_VENDOR must be commented out, not shipped as a blank assignment',
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
