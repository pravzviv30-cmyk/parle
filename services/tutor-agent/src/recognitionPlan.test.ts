import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { recognitionPlan } from './recognitionPlan.ts';

test('ordinary recognition retains Nova-3 and its explicit phase language', () => {
  for (const language of ['fr', 'multi'] as const) {
    for (const flag of [undefined, '', '0', 'true', 'flux', ' 1 ']) {
      assert.deepEqual(recognitionPlan('convo', language, { LUVANI_CONVO_ASR_EXPERIMENT: flag }), {
        experimental: false, options: { model: 'nova-3', language },
      });
    }
  }
});

test('only an explicit conversation review uses Flux French and English hints', () => {
  for (const language of ['fr', 'multi'] as const) {
    assert.deepEqual(recognitionPlan('convo', language, { LUVANI_CONVO_ASR_EXPERIMENT: '1' }), {
      experimental: true,
      options: { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, numerals: false },
    });
    assert.deepEqual(recognitionPlan('lesson', language, { LUVANI_CONVO_ASR_EXPERIMENT: '1' }), {
      experimental: false, options: { model: 'nova-3', language },
    });
  }
});

test('the review recognizer stays inside lazy session audio and phase updates preserve its bilingual hints', () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  assert.match(source, /const recognition = recognitionPlan\(isConvo \? 'convo' : 'lesson', sttLanguageFor\(isConvo \? 'convo' : 'lesson', 'choosing'\), process.env\)/);
  assert.match(source, /sessionAudio\(voiceless, \{[\s\S]*?stt: \(\) => recognition.experimental\s*\? new deepgram.STTv2\(recognition.options\)\s*: new deepgram.STT\(\{ \.\.\.recognition.options, \.\.\.\(proxy \? \{ baseUrl: proxy.deepgramBaseURL, apiKey: \'proxy-only\', sampleRate: 16000, numChannels: 1, mipOptOut: true \} : \{\}\) \}\)/);
  assert.match(source, /setSttLanguage: \(language\) => \{\s*if \(!recognition.experimental\) stt\?\.updateOptions\(\{ language \}\);\s*\}/);
});
