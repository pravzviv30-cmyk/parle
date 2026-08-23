import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before
// any plugin TTS is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { buildTTS, LANGUAGE_CODE, VOICE_SETTINGS } from './voice.ts';

/**
 * buildTTS reads the environment, so these tests own it for their duration:
 * a fake API key (the constructor refuses to build without one; nothing here
 * makes a network call), no configured voice, and a throwaway cache dir so a
 * test run never touches the real warmed cache.
 */
const ENV_KEYS = ['ELEVEN_API_KEY', 'ELEVEN_VOICE_ID', 'TTS_CACHE_DIR'] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.ELEVEN_API_KEY = 'test-key-never-sent';
  delete process.env.ELEVEN_VOICE_ID;
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
