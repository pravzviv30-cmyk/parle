import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_CLIP_SINK, mayCapture, speechDatasetEnabled } from './speechClips.ts';

test('the speech dataset flag is on only for exactly 1', () => {
  assert.equal(speechDatasetEnabled({ LUVANI_SPEECH_DATASET: '1' }), true);
  for (const value of ['true', 'yes', 'on', '', '0', ' 1', undefined]) {
    assert.equal(speechDatasetEnabled({ LUVANI_SPEECH_DATASET: value }), false, `"${value}" is off`);
  }
  assert.equal(speechDatasetEnabled({}), false);
});

test('capture needs both the flag and consent', () => {
  assert.equal(mayCapture({ enabled: true, consent: true }), true);
  assert.equal(mayCapture({ enabled: true, consent: false }), false);
  assert.equal(mayCapture({ enabled: false, consent: true }), false);
  assert.equal(mayCapture({ enabled: false, consent: false }), false);
});

test('the only sink does nothing and touches no network', (t) => {
  const real = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error('no network from the clip sink'); }) as typeof fetch;
  t.after(() => { globalThis.fetch = real; });
  const result = NO_CLIP_SINK.offer({ reference: 'Bonjour', lessonId: 'l', turnId: 't', wav: new Uint8Array(4), durationSec: 1, observations: [] });
  assert.equal(result, undefined);
  assert.equal(requests, 0);
});
