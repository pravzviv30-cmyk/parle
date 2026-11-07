import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SENTENCES, assertNotAuthored, buildReport, checkSpend, parseArgs, percentile, plannedChars, timeSynthesis,
} from './measureTtsFirstAudio.mjs';

const norm = (t) => t.replace(/\s+/g, ' ').trim();

test('percentile is nearest-rank and ignores nulls', () => {
  const v = [50, 10, 40, 20, 30];
  assert.equal(percentile(v, 50), 30);
  assert.equal(percentile(v, 95), 50);
  assert.equal(percentile([null, 7], 50), 7);
  assert.equal(percentile([], 50), null);
});

test('the fixed sentences are 12 lines of 40 to 90 characters', () => {
  assert.equal(SENTENCES.length, 12);
  for (const s of SENTENCES) assert.ok(s.length >= 40 && s.length <= 90, `${s.length}: ${s}`);
});

test('an authored sentence is rejected, a free one passes', () => {
  assert.throws(() => assertNotAuthored(['Bonjour  !', 'Autre'], ['Bonjour !'], norm), /authored line/);
  assert.doesNotThrow(() => assertNotAuthored(['Autre'], ['Bonjour !'], norm));
});

test('none of the real test sentences is an authored line', async () => {
  const { AUTHORED_SPEECH_LINES } = await import('../services/tutor-agent/src/authoredSpeech.ts');
  const { normaliseLine } = await import('../services/tutor-agent/src/ttsCache.ts');
  assert.doesNotThrow(() => assertNotAuthored(SENTENCES, AUTHORED_SPEECH_LINES, normaliseLine));
});

test('spend cap counts every sentence on every transport and rep', () => {
  const s = ['abcd', 'ef'];
  assert.equal(plannedChars(s, ['http', 'ws'], 3), 36);
  assert.equal(checkSpend(s, ['http', 'ws'], 3, 36), 36);
  assert.throws(() => checkSpend(s, ['http', 'ws'], 3, 35), /over --max-chars 35/);
  assert.ok(plannedChars(SENTENCES, ['http', 'ws'], 1) <= 3000);
});

test('parseArgs reads positionals and flags, and rejects bad ones', () => {
  const a = parseArgs(['.env', 'out.json', '--transports', 'ws', '--reps', '2', '--max-chars', '500', '--voice', 'marie']);
  assert.deepEqual(a, { envFile: '.env', reportFile: 'out.json', transports: ['ws'], reps: 2, maxChars: 500, voice: 'marie', help: false });
  const d = parseArgs(['.env', 'out.json']);
  assert.deepEqual([d.transports, d.reps, d.maxChars, d.voice], [['http', 'ws'], 1, 3000, 'alexandre']);
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['a', 'b', '--transports', 'grpc']), /--transports/);
  assert.throws(() => parseArgs(['a', 'b', '--reps', '0']), /--reps/);
  assert.throws(() => parseArgs(['a', 'b', '--nope']), /Unknown flag/);
});

test('report shape: cold is the first sentence, p50/p95 are over the warm ones', () => {
  const mk = (first) => ({ chars: 50, firstFrameMs: first, lastFrameMs: first + 1000 });
  const report = buildReport({
    generatedAt: '2026-11-07T00:00:00.000Z', model: 'm', voice: 'alexandre',
    byTransport: { http: [mk(400), mk(300), mk(200), mk(100)], ws: [mk(900), mk(100), mk(120)] },
  });
  assert.deepEqual(Object.keys(report), ['generatedAt', 'model', 'voice', 'transports']);
  assert.deepEqual(report.transports.http.samples[0], { textLength: 50, firstFrameMs: 400, lastFrameMs: 1400 });
  assert.equal(report.transports.http.cold, 400);
  assert.equal(report.transports.http.p50, 200);
  assert.equal(report.transports.http.p95, 300);
  assert.equal(report.transports.ws.cold, 900);
  assert.equal(report.transports.ws.p50, 100);
  assert.equal(report.transports.ws.lastFrameP50, 1100);
});

test('timeSynthesis times the first and last packet of a stream', async () => {
  let t = 0;
  const times = [0, 120, 300, 450];
  const now = () => times[t++];
  const cached = { synthesize: () => (async function* () { yield 1; yield 2; yield 3; })() };
  assert.deepEqual(await timeSynthesis(cached, 'abcde', now), { chars: 5, firstFrameMs: 120, lastFrameMs: 450 });
  await assert.rejects(timeSynthesis({ synthesize: () => (async function* () {})() }, 'x', () => 0), /No audio/);
});
