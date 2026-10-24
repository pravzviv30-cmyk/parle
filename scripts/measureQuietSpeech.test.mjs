import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyGain, dbToGain, energyFilterSends, normaliseWords, pinkNoise, rmsLinear, slug, toDbfs, wordAccuracy, wordErrorRate,
} from './quietSpeechHelpers.mjs';

test('gain in dB: -20 dB is a tenth, and applyGain clips to int16', () => {
  assert.equal(dbToGain(0), 1);
  assert.ok(Math.abs(dbToGain(-20) - 0.1) < 1e-12);
  assert.ok(Math.abs(dbToGain(-6) - 0.501187) < 1e-6);
  assert.deepEqual([...applyGain(Int16Array.from([10000, -10000, 0]), -20)], [1000, -1000, 0]);
  assert.deepEqual([...applyGain(Int16Array.from([30000, -30000]), 6)], [32767, -32768]);
});

test('word normalisation treats accents, apostrophes and punctuation the same on both sides', () => {
  assert.deepEqual(normaliseWords("Je voudrais un café, s’il vous plaît."), ['je', 'voudrais', 'un', 'cafe', 's', 'il', 'vous', 'plait']);
  assert.equal(wordAccuracy('On échange nos numéros ?', 'on echange nos numeros'), 1);
  assert.equal(wordAccuracy("Excusez-moi, où est la gare ?", 'Excusez moi ou est la gare.'), 1);
  assert.equal(slug('Excusez-moi, où est la gare ?'), 'excusez-moi-ou-est-la-gare');
});

test('WER counts substitutions, deletions and insertions; accuracy floors at 0', () => {
  assert.equal(wordErrorRate('on échange nos numéros', 'on change nos numéros'), 0.25);
  assert.equal(wordErrorRate('on échange nos numéros', 'on nos numéros'), 0.25);
  assert.equal(wordErrorRate('on échange nos numéros', ''), 1);
  assert.equal(wordAccuracy('un café', 'un deux trois quatre cinq six'), 0);
  assert.equal(wordErrorRate('', ''), 0);
});

test('pink noise is deterministic per seed and lands on the asked RMS', () => {
  const a = pinkNoise(16000, 42, -50);
  const b = pinkNoise(16000, 42, -50);
  const c = pinkNoise(16000, 43, -50);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(Math.abs(toDbfs(rmsLinear(a)) - -50) < 0.2);
});

test('energy filter replay drops quiet frames once the 1 s cooldown is spent', () => {
  const quiet = new Int16Array(16000 * 3).fill(64); // RMS 0.002, under 0.004
  const cold = energyFilterSends(quiet, { warm: false });
  assert.equal(cold.filter(Boolean).length, 10); // the first second (float drift keeps frame 10 too, as in the SDK)
  assert.equal(energyFilterSends(quiet, { warm: true }).filter(Boolean).length, 0);
  const loud = new Int16Array(16000).fill(1000); // RMS 0.03
  assert.ok(energyFilterSends(loud).every(Boolean));
});
