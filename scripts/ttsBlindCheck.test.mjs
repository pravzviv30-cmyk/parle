import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAP, LINES, MODELS, buildDesign, buildHtml, buildPlan, estimateTotal, scoreResults, speakingRates, wavFromPcm } from './ttsBlindCheck.mjs';

const FLASH = 'eleven_flash_v2_5';
const CURRENT = MODELS.find(m => m.label === 'current').id;
const design = (rng) => buildDesign(buildPlan(), rng ? { rng } : {});
const manifestOf = d => ({ pairs: d.pairs, clips: d.clips });

test('tts blind check plan is 72 requests and its credit estimate is under the cap', () => {
  const plan = buildPlan();
  assert.equal(plan.length, 72);
  assert.equal(LINES.length, 6);
  const total = estimateTotal(plan);
  assert.ok(total > 0 && total <= CAP, `estimate ${total} must be within ${CAP}`);
  const sample = plan.find(p => p.voice === 'emilie' && p.line === 0);
  assert.equal(plan.find(p => p.voice === 'emilie' && p.line === 0 && p.model.label === 'flash').estimate, Math.ceil(sample.chars * 2 * 0.5));
});

test('tts blind check never puts a model name in clip ids, files or the manifest', () => {
  const d = design();
  assert.equal(Object.keys(d.clips).length, 72);
  assert.equal(d.pairs.length, 36);
  const text = JSON.stringify(manifestOf(d));
  assert.ok(!text.includes(FLASH) && !text.includes(CURRENT) && !/flash|current|eleven/i.test(text));
  for (const id of Object.keys(d.clips)) assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(new Set([...Object.keys(d.clips), ...d.pairs.map(p => p.pairId)]).size, 108);
});

test('tts blind check randomises which model is A and keeps one of each per pair', () => {
  const d = design();
  const firsts = Object.values(d.key.pairs).map(p => p.A);
  assert.ok(firsts.includes(CURRENT) && firsts.includes(FLASH), 'both orders appear across 36 pairs');
  for (const p of Object.values(d.key.pairs)) assert.deepEqual([p.A, p.B].sort(), [CURRENT, FLASH].sort());
  for (const pair of d.pairs) {
    assert.equal(d.key.clips[pair.A], d.key.pairs[pair.pairId].A);
    assert.equal(d.key.clips[pair.B], d.key.pairs[pair.pairId].B);
  }
  assert.ok(Object.values(design(() => 0.1).key.pairs).every(p => p.A === CURRENT));
  assert.ok(Object.values(design(() => 0.9).key.pairs).every(p => p.A === FLASH));
});

test('tts blind check page lists 36 pairs and names no model', () => {
  const html = buildHtml(manifestOf(design()));
  assert.equal((html.match(/class="pair"/g) ?? []).length, 36);
  assert.equal((html.match(/<audio /g) ?? []).length, 72);
  for (const label of ['A sounds better', 'B sounds better', "Can't tell", 'Copy results']) assert.ok(html.includes(label), label);
  assert.ok(!/eleven|flash|current|key\.json|manifest/i.test(html));
  assert.ok(!html.includes('—'));
  assert.ok(!/<script[^>]*src=/.test(html));
  assert.ok(html.includes('Each pair is the same tutor saying the same line two ways. Pick the one a beginner should hear, or Can&#39;t tell.') || html.includes("Pick the one a beginner should hear, or Can't tell."));
});

test('tts blind check scoring maps A and B back to the right model', () => {
  const d = design();
  const ids = Object.keys(d.key.pairs);
  const results = {};
  ids.forEach((id, i) => {
    const pair = d.key.pairs[id];
    // 0: picks current, 1: picks flash, 2: cannot tell, 3: no answer
    if (i % 4 === 0) results[id] = { choice: pair.A === CURRENT ? 'A' : 'B', note: '' };
    if (i % 4 === 1) results[id] = { choice: pair.A === FLASH ? 'A' : 'B', note: 'warmer' };
    if (i % 4 === 2) results[id] = { choice: 'cant-tell', note: '' };
  });
  const { overall, perVoice } = scoreResults(d.key, results);
  assert.deepEqual(overall, { current: 9, flash: 9, cantTell: 9, unanswered: 9 });
  assert.equal(Object.keys(perVoice).length, 6);
  assert.equal(Object.values(perVoice).reduce((n, v) => n + v.current + v.flash + v.cantTell + v.unanswered, 0), 36);
  assert.throws(() => scoreResults(d.key, { [ids[0]]: { choice: 'C' } }), /Unknown choice/);
  assert.throws(() => scoreResults(d.key, { nope: { choice: 'A' } }), /unknown pair/);
});

test('tts blind check writes a valid wav and reports speaking rate per model', () => {
  const pcm = Buffer.alloc(44100);
  const wav = wavFromPcm(pcm);
  assert.equal(wav.length, 44 + pcm.length);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt32LE(24), 22050);
  const clips = { a: { voice: 'marie', chars: 10, seconds: 1, status: 'complete' }, b: { voice: 'marie', chars: 10, seconds: 0.5, status: 'complete' } };
  const rates = speakingRates({ clips }, { clips: { a: CURRENT, b: FLASH } });
  assert.equal(rates.secondsPerCharByModel[CURRENT], 0.1);
  assert.equal(rates.secondsPerCharByModel[FLASH], 0.05);
  assert.equal(rates.secondsPerCharByVoice.marie, 0.075);
});
