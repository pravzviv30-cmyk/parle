import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TUTOR_VOICES } from '@luvani/core';
import { selectedTutorSynthesisConfiguration, ELEVEN_VOICES, MODEL, VOICE_SETTINGS, OUTPUT_ENCODING, LANGUAGE_CODE } from './voiceConfiguration.ts';
test('saved-phrase configuration uses the exact live pins and distinct chosen voice without constructing TTS or accessing a key', () => {
  const fingerprints = new Set<string>();
  for (const key of Object.keys(TUTOR_VOICES)) {
    const config = selectedTutorSynthesisConfiguration(key, {});
    assert.ok(config); assert.equal(config.voiceId, ELEVEN_VOICES[key as keyof typeof ELEVEN_VOICES]);
    assert.equal(config.model, MODEL); assert.equal(config.encoding, OUTPUT_ENCODING); assert.equal(config.languageCode, LANGUAGE_CODE);
    assert.deepEqual(config.settings, VOICE_SETTINGS); assert.equal(config.streamingLatency, 3);
    assert.match(config.fingerprint, /^[0-9a-f]{64}$/); assert.ok(!fingerprints.has(config.fingerprint)); fingerprints.add(config.fingerprint);
    assert.equal(selectedTutorSynthesisConfiguration(key, {})?.fingerprint, config.fingerprint);
    assert.equal(Object.isFrozen(config), true); assert.equal(Object.isFrozen(config.settings), true);
  }
});
test('approved live language detection invalidates French-pinned saved audio while recording batches stay French', () => {
  assert.equal(LANGUAGE_CODE, undefined);
  const config = selectedTutorSynthesisConfiguration('alexandre', {});
  assert.ok(config);
  const { fingerprint, ...parameters } = config;
  const oldFingerprint = createHash('sha256').update(JSON.stringify({ ...parameters, languageCode: 'fr' })).digest('hex');
  assert.notEqual(fingerprint, oldFingerprint);
  const plan = readFileSync(new URL('../../../scripts/daily-tutor-plan.mjs', import.meta.url), 'utf8');
  assert.match(plan, /export const RECORDING_LANGUAGE = 'fr'/);
  for (const name of ['build-daily-tutor-audio', 'compare-daily-voices', 'build-onboarding-audio']) {
    const source = readFileSync(new URL(`../../../scripts/${name}.mjs`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bLANGUAGE_CODE\b/);
    assert.match(source, /language: RECORDING_LANGUAGE/);
    assert.match(source, /language_code: RECORDING_LANGUAGE/);
  }
});
test('an invalid catalogue voice or Fish cannot claim selected-tutor saved audio', () => {
  for (const key of [null, undefined, '', 'legacy-voice', '__proto__', 'https://vendor.invalid']) assert.equal(selectedTutorSynthesisConfiguration(key, {}), null);
  assert.equal(selectedTutorSynthesisConfiguration('alexandre', { LUVANI_TTS_VENDOR: 'fish' }), null);
  assert.ok(selectedTutorSynthesisConfiguration('alexandre', { LUVANI_TTS_VENDOR: 'elevenlabs' }));
});
