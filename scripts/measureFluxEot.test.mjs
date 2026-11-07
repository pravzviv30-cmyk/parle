import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, nearestRank, parseArgs, plan, splice, summarise, LEAD_MS, TAIL_MS } from './measureFluxEot.mjs';

// 16 kHz layout: the pause ends at sample 32000 (2 s); the last voiced sample is pushed at t = 3500 ms.
const base = { resume: 32000, rate: 16000, lastVoicedT: 3500 };
const eos = (t, pushed) => ({ type: 'END_OF_SPEECH', t, pushed });

test('an END_OF_SPEECH while the pause is still playing is a split', () => {
  const r = analyse([{ type: 'START_OF_SPEECH', t: 300, pushed: 4800 }, eos(1400, 22400), eos(4100, 65600)], base);
  assert.equal(r.splitInPause, true);
  assert.equal(r.endOfTurns, 2);
  assert.equal(r.eotDelayMs, 600);
});

test('an END_OF_SPEECH after the pause (plus 100 ms slack) is not a split', () => {
  assert.equal(analyse([eos(2150, 33700)], base).splitInPause, false);
  assert.equal(analyse([eos(2050, 33000)], base).splitInPause, true); // inside the 100 ms slack
  const r = analyse([eos(4000, 64000)], base);
  assert.deepEqual(r, { endOfTurns: 1, splitInPause: false, eotDelayMs: 500 });
});

test('no END_OF_SPEECH gives a null delay', () => {
  assert.deepEqual(analyse([], base), { endOfTurns: 0, splitInPause: false, eotDelayMs: null });
});

test('splice lays out lead, pause and tail and marks resume and last voiced', () => {
  const pcm = new Int16Array(1000).fill(5);
  const sp = splice(pcm, 1000, { at: 400, voiceEnd: 900 }, 500);
  assert.equal(sp.pcm.length, LEAD_MS + 1000 + 500 + TAIL_MS);
  assert.equal(sp.resume, 300 + 400 + 500);
  assert.equal(sp.lastVoiced, sp.resume + 500);
  assert.equal(sp.pcm[299], 0);
  assert.equal(sp.pcm[300], 5);
  assert.equal(sp.pcm[sp.resume], 5);
  assert.equal(sp.pcm[700 + 10], 0);
});

test('nearest rank p50 and p95', () => {
  const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(nearestRank(v, 50), 50);
  assert.equal(nearestRank(v, 95), 100);
  assert.equal(nearestRank([5], 95), 5);
  assert.equal(nearestRank([null], 50), null);
});

test('summary groups per pause and overall', () => {
  const runs = [
    { pauseMs: 500, splitInPause: false, eotDelayMs: 400 }, { pauseMs: 500, splitInPause: false, eotDelayMs: 600 },
    { pauseMs: 1500, splitInPause: true, eotDelayMs: 100 }, { pauseMs: 1500, splitInPause: false, eotDelayMs: 900 },
  ];
  const s = summarise(runs);
  assert.deepEqual(s.map((x) => x.pauseMs), [500, 1500, 'all']);
  assert.deepEqual(s[1], { pauseMs: 1500, runs: 2, splits: 1, splitShare: 0.5, eotP50: 100, eotP95: 900 });
  assert.equal(s[2].runs, 4);
  assert.equal(s[2].splits, 1);
  assert.equal(s[2].eotP50, 400);
});

test('argument parsing and the dry-run plan', () => {
  const a = parseArgs(['--dry-run', '--pauses', '1000,1500', '--clips', '2', '--eot-threshold', '0.7']);
  assert.deepEqual([a.dryRun, a.pauses, a.clips, a.eotThreshold, a.out], [true, [1000, 1500], 2, '0.7', 'docs/live-latency-evidence']);
  assert.deepEqual(parseArgs([]).pauses, [500, 1000, 1500, 2000]);
  assert.throws(() => parseArgs(['--pauses', 'x']));
  const p = plan([{ file: 'a.wav', seconds: 2 }, { file: 'b.wav', seconds: 3 }], [1000]);
  assert.equal(p.runs, 2);
  assert.equal(p.billedSeconds, (0.3 + 1 + 3 + 2) + (0.3 + 1 + 3 + 3));
});
