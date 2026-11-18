import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS } from '../services/tutor-agent/src/voice.ts';
import { CAP, EXPERIMENTS, LINES, MODELS, buildDesign, buildHtml, buildPlan, estimateTotal, modelIdOf, requestBody, scoreResults, settingsOf, speakingRates } from './ttsBlindCheck.mjs';
import { wavFromPcm } from './quietSpeechHelpers.mjs';
import * as blind from './ttsBlindCheck.mjs';
import * as speed from './measureVoiceSpeed.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  const wav = wavFromPcm(pcm, 22050);
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

const STYLE0 = `${MODEL}+style0`;
const style0Models = EXPERIMENTS.style0.models;
const style0Design = rng => buildDesign(buildPlan(ELEVEN_VOICES, style0Models), rng ? { rng } : {});

test('tts blind check default plan is unchanged by the experiments', () => {
  const plan = buildPlan();
  assert.deepEqual([...new Set(plan.map(p => p.model.id))], [MODEL, FLASH]);
  assert.equal(estimateTotal(plan), 3498);
  assert.equal(EXPERIMENTS.default.models, MODELS);
  assert.equal(EXPERIMENTS.default.storageKey, 'tts-blind-check-2026-10-22');
  assert.ok(MODELS.every(m => settingsOf(m) === VOICE_SETTINGS && modelIdOf(m) === m.id));
});

test('tts blind check style0 plan pairs today with style 0 on the same model', () => {
  const plan = buildPlan(ELEVEN_VOICES, style0Models);
  assert.equal(plan.length, 72);
  for (const voice of Object.keys(ELEVEN_VOICES)) for (let line = 0; line < LINES.length; line++) {
    const pair = plan.filter(p => p.voice === voice && p.line === line);
    assert.deepEqual(pair.map(p => p.model.id), [MODEL, STYLE0]);
    assert.deepEqual(pair.map(p => p.model.label), ['current', 'style0']);
    assert.deepEqual(pair.map(p => modelIdOf(p.model)), [MODEL, MODEL]);
    assert.deepEqual(settingsOf(pair[0].model), VOICE_SETTINGS);
    assert.deepEqual(settingsOf(pair[1].model), { ...VOICE_SETTINGS, style: 0 });
    assert.equal(pair[0].estimate, pair[1].estimate);
  }
  assert.equal(estimateTotal(plan), 4656);
  assert.ok(estimateTotal(plan) <= EXPERIMENTS.style0.cap);
  assert.equal(EXPERIMENTS.default.cap, CAP);
  assert.match(EXPERIMENTS.style0.destination, /artifacts\/tts-blind-check-2026-11-07-style0$/);
  assert.equal(EXPERIMENTS.style0.storageKey, 'tts-blind-check-2026-11-07-style0');
});

test('tts blind check style0 page names no variant', () => {
  const d = style0Design();
  assert.ok(!/eleven|style0|current/i.test(JSON.stringify(manifestOf(d))));
  const html = buildHtml(manifestOf(d), LINES, EXPERIMENTS.style0.storageKey);
  assert.equal((html.match(/class="pair"/g) ?? []).length, 36);
  // The storage key is script data the listener never sees; everything else must be clean.
  const visible = html.split(EXPERIMENTS.style0.storageKey).join('');
  assert.ok(!/eleven|style0|current|flash|key\.json|manifest/i.test(visible));
  assert.ok(html.includes(JSON.stringify(EXPERIMENTS.style0.storageKey)));
});

test('tts blind check style0 scoring maps picks to current and style0', () => {
  const d = style0Design();
  const results = {};
  Object.entries(d.key.pairs).forEach(([id, pair], i) => {
    if (i % 3 === 0) results[id] = { choice: pair.A === MODEL ? 'A' : 'B' };
    if (i % 3 === 1) results[id] = { choice: pair.A === STYLE0 ? 'A' : 'B' };
  });
  const { overall } = scoreResults(d.key, results, { second: 'style0' });
  assert.deepEqual(overall, { current: 12, style0: 12, cantTell: 0, unanswered: 12 });
  assert.equal(scoreResults(d.key, {}, { second: 'style0' }).overall.style0, 0);
});

test('the billed request body carries each variant\'s own settings and the real model id', () => {
  const [current, style0] = EXPERIMENTS.style0.models;
  const a = JSON.parse(requestBody(current, 'Bonjour.'));
  const b = JSON.parse(requestBody(style0, 'Bonjour.'));
  assert.equal(a.model_id, MODEL); assert.equal(b.model_id, MODEL);
  assert.deepEqual(a.voice_settings, VOICE_SETTINGS);
  assert.equal(b.voice_settings.style, 0);
  assert.equal(a.text, 'Bonjour.'); assert.equal(b.text, 'Bonjour.');
});

// No test here may spend: nothing passes --generate, and every spawn runs without vendor keys.
const ROOT = resolve(import.meta.dirname, '..');

test('a paid generator refuses when its committed manifest exists', () => {
  assert.equal(typeof blind.refuseRerun, 'function', 'the blind check needs a guard that can be tested without spending');
  assert.equal(typeof speed.refuseRerun, 'function', 'the voice speed check needs a guard that can be tested without spending');
  for (const [name, experiment] of Object.entries(EXPERIMENTS)) {
    const paths = { manifestPath: join(experiment.destination, 'manifest.json'), keyPath: join(experiment.destination, 'key.json'), evidence: experiment.evidence };
    for (const resume of [false, true]) {
      assert.throws(() => blind.refuseRerun(paths, resume), /committed/, `${name} is finished; its committed manifest alone must stop --generate${resume ? ' --resume' : ''}`);
    }
  }
  assert.throws(() => speed.refuseRerun({ manifestPath: join(speed.DESTINATION, 'manifest.json'), evidence: speed.EVIDENCE }, false), /committed/,
    'the voice speed evidence is committed; a fresh run on a machine without the local clips must still be refused');

  const empty = mkdtempSync(join(tmpdir(), 'paid-guard-'));
  const fresh = { manifestPath: join(empty, 'manifest.json'), keyPath: join(empty, 'key.json'), evidence: join(empty, 'evidence.json') };
  assert.doesNotThrow(() => blind.refuseRerun(fresh, false), 'a new experiment with no evidence anywhere may run');
  assert.doesNotThrow(() => speed.refuseRerun(fresh, false), 'a new measurement with no evidence anywhere may run');
  writeFileSync(fresh.evidence, '{}');
  assert.throws(() => blind.refuseRerun(fresh, false), /committed/, 'evidence alone, with no local manifest, must refuse');
  assert.throws(() => speed.refuseRerun(fresh, false), /committed/, 'evidence alone, with no local manifest, must refuse');
});

test('a finished voice speed measurement refuses a resume too', () => {
  const dir = mkdtempSync(join(tmpdir(), 'speed-resume-'));
  const paths = { manifestPath: join(dir, 'manifest.json'), evidence: join(dir, 'evidence.json') };
  writeFileSync(paths.manifestPath, '{}');
  writeFileSync(paths.evidence, JSON.stringify({ status: 'complete' }));
  assert.throws(() => speed.refuseRerun(paths, true), /committed/, 'a complete measurement must not be resumed');
  writeFileSync(paths.evidence, JSON.stringify({ status: 'stopped' }));
  assert.doesNotThrow(() => speed.refuseRerun(paths, true), 'a stopped measurement may still be resumed');
  assert.throws(() => speed.refuseRerun({ manifestPath: join(speed.DESTINATION, 'manifest.json'), evidence: speed.EVIDENCE }, true), /committed/);
});

test('paid generator paths do not depend on the working directory or one home folder', () => {
  const elsewhere = mkdtempSync(join(tmpdir(), 'paid-cwd-'));
  const home = mkdtempSync(join(tmpdir(), 'paid-home-'));
  const dryRun = (script, args = []) => {
    assert.ok(!args.includes('--generate'), 'a test must never ask a paid script to spend');
    const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', resolve(ROOT, 'scripts', script), ...args],
      { cwd: elsewhere, env: { PATH: process.env.PATH, HOME: home }, encoding: 'utf8' });
    assert.equal(run.status, 0, `${script} dry run failed: ${run.stderr}`);
    return JSON.parse(run.stdout.slice(0, run.stdout.lastIndexOf('}') + 1));
  };
  assert.equal(dryRun('ttsBlindCheck.mjs').destination, resolve(ROOT, 'artifacts/tts-blind-check-2026-10-22'), 'the blind check writes into the repo wherever it is run from');
  assert.equal(dryRun('ttsBlindCheck.mjs', ['--experiment', 'style0']).destination, resolve(ROOT, 'artifacts/tts-blind-check-2026-11-07-style0'));
  assert.equal(dryRun('compare-daily-voices.mjs').destination, resolve(ROOT, 'artifacts/voice-comparison-2026-09-19'), 'the voice comparison finds its committed manifest wherever it is run from');
  const voiceSpeed = dryRun('measureVoiceSpeed.mjs');
  assert.equal(voiceSpeed.destination, join(home, 'Developer/StartUps/listening/voice-speed-2026-10-25'), 'the listening folder follows whoever runs it, not one hard-coded home');
  assert.equal(voiceSpeed.evidence, resolve(ROOT, 'docs/cogs-evidence/voice-speed-2026-10-25.json'), 'the evidence path is the committed file, wherever the script is run from');
});
