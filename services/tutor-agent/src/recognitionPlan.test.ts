import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { recognitionPlan } from './recognitionPlan.ts';

const FLUX = { flux: true, options: { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, numerals: false } };
const KINDS = ['convo', 'lesson', 'scene'] as const;

test('every session kind defaults to Flux with French and English hints, whatever the unset or unknown knob', () => {
  for (const kind of KINDS) for (const language of ['fr', 'multi'] as const) {
    for (const knob of [undefined, '', '0', 'nothing']) {
      assert.deepEqual(recognitionPlan(kind, language, { LUVANI_STT_NOVA_KINDS: knob }), FLUX);
    }
  }
});

test('LUVANI_STT_NOVA_KINDS puts only the named kinds back on Nova-3 with the given language', () => {
  for (const language of ['fr', 'multi'] as const) {
    const nova = { flux: false, options: { model: 'nova-3', language } };
    const env = { LUVANI_STT_NOVA_KINDS: 'lesson, scene' };
    assert.deepEqual(recognitionPlan('lesson', language, env), nova);
    assert.deepEqual(recognitionPlan('scene', language, env), nova);
    assert.deepEqual(recognitionPlan('convo', language, env), FLUX);
    const convoOnly = { LUVANI_STT_NOVA_KINDS: 'convo' };
    assert.deepEqual(recognitionPlan('convo', language, convoOnly), nova);
    assert.deepEqual(recognitionPlan('lesson', language, convoOnly), FLUX);
    assert.deepEqual(recognitionPlan('scene', language, convoOnly), FLUX);
  }
});

test('Flux recognition stays inside lazy session audio and phase updates skip it, keeping its bilingual hints', () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  assert.match(source, /const recognition = recognitionPlan\(isConvo \? 'convo' : scene \? 'scene' : 'lesson', sttLanguageFor\(isConvo \? 'convo' : 'lesson', 'choosing'\), process.env\)/);
  assert.match(source, /sessionAudio\(voiceless, \{[\s\S]*?stt: \(\) => recognition.flux\s*\? new deepgram.STTv2\(\{ \.\.\.recognition.options, \.\.\.\(keyterm.length \? \{ keyterms: keyterm \} : \{\}\), \.\.\.\(proxy \? \{ endpointUrl: proxy.deepgramBaseURL \+ \'\/v2\/listen\', apiKey: \'proxy-only\', mipOptOut: true \} : \{\}\) \}\)\s*: new deepgram.STT\(\{ \.\.\.recognition.options, \.\.\.\(keyterm.length \? \{ keyterm \} : \{\}\), \.\.\.\(proxy \? \{ baseUrl: proxy.deepgramBaseURL, apiKey: \'proxy-only\', sampleRate: 16000, numChannels: 1, mipOptOut: true \} : \{\}\) \}\)/);
  assert.match(source, /setSttLanguage: \(language\) => \{\s*if \(recognition.flux \|\| !stt\) return;/);
});

test('phase language changes restart active recognition through the public agent API and contain failures', () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  const start = source.indexOf('setSttLanguage: (language) => {');
  const end = source.indexOf('setSttPhrases:', start);
  const callback = source.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(callback, /if \(recognition.flux \|\| !stt\) return;/);
  assert.match(callback, /stt.updateOptions\(\{ language \}\)/);
  assert.ok(callback.indexOf('stt.updateOptions({ language })') < callback.indexOf('tutor.updateOptions({ stt })'));
  assert.match(callback, /void tutor.updateOptions\(\{ stt \}\)\.catch\(\(error: unknown\) =>/);
  assert.match(callback, /tutor.publishError\(/);
});

test('current scene keyterms update the active session without changing paid or Flux recognition', () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  assert.match(source, /setSttPhrases: \(keyterms\) => \{\s*if \(!recognition.flux && !proxy\) session.updateOptions\(\{ keyterms \}\);\s*\}/);
  assert.doesNotMatch(source, /stt\?\.updateOptions\(\{ keyterms? \}\)/);
});

test('scripted lessons and scenes build recognition with one fixed keyterm list, on and off the proxy; convo gets none; Flux carries the same list as keyterms', () => {
  const source = readFileSync(new URL('./agent.ts', import.meta.url), 'utf8');
  assert.match(source, /const lesson = scene \? sceneLesson\(scene\) : CAFE_LESSON;/);
  assert.match(source, /const keyterm = isConvo \? \[\] : lessonKeyterms\(lesson\);/);
  // Construction only: the keyterms sit before the proxy options, so both paths carry them.
  assert.match(source, /recognition.flux\s*\? new deepgram.STTv2\(\{ \.\.\.recognition.options, \.\.\.\(keyterm.length \? \{ keyterms: keyterm \} : \{\}\), \.\.\.\(proxy \?[\s\S]*?: new deepgram.STT\(\{ \.\.\.recognition.options, \.\.\.\(keyterm.length \? \{ keyterm \} : \{\}\), \.\.\.\(proxy \?/);
  assert.equal(source.match(/lessonKeyterms\(/g)?.length, 1);
});
