import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatFor, closedSceneReplyFr, resample, usdFor } from './measureHalfCascade.mjs';

test('resample scales length by 24000/22050 and keeps a constant signal constant', () => {
  const out = resample(new Int16Array(22050).fill(1234), 22050, 24000);
  assert.equal(out.length, 24000);
  assert.ok(out.every(v => v === 1234));
});

test('the sceneReply.fr detector waits for the string to close', () => {
  const partial = '{"sceneReply":{"speaker":"Karim","fr":"Bonjour, un caf';
  assert.equal(closedSceneReplyFr(partial), null);
  assert.equal(closedSceneReplyFr(`${partial}é \\"noir\\" ?","en":"Hi`), 'Bonjour, un café "noir" ?');
});

test('spend prices audio input, text input and text output separately', () => {
  const usd = usdFor({ input_tokens: 3000, output_tokens: 200, input_token_details: { audio_tokens: 1000 } });
  assert.equal(usd, (1000 * 32 + 2000 * 4 + 200 * 16) / 1e6);
  assert.equal(usdFor(null), 0);
});

test('clips map to café beats', () => {
  assert.equal(beatFor('Sur place, merci.'), 'say-where');
  assert.equal(beatFor('How much is it?'), 'pay');
  assert.equal(beatFor('Un croissant aussi.'), 'greet-and-order');
});
