import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger } from '@livekit/agents';

// The worker CLI does this in production; tests must do it themselves before
// any plugin TTS is constructed.
initializeLogger({ pretty: false, level: 'silent' });

import { buildTTS } from './voice.ts';

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
    assert.equal(buildTTS().model, 'eleven_turbo_v2_5');
  });

  test('the cache key fingerprints voice, model and delivery settings', () => {
    // Full-string equality on purpose: any settings change must change this key,
    // so audio synthesized under old settings is never replayed under new ones.
    assert.equal(buildTTS().opts.voiceKey, 'elevenlabs:default:eleven_turbo_v2_5:sl3:st50-sb75');
  });

  test('a configured voice id lands in the cache key', () => {
    process.env.ELEVEN_VOICE_ID = 'voix-test';
    assert.ok(buildTTS().opts.voiceKey.startsWith('elevenlabs:voix-test:'));
  });
});
