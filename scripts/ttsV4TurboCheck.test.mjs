import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SENTENCES } from './measureTtsFirstAudio.mjs';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS, BEGINNER_SPEED, OUTPUT_ENCODING } from '../services/tutor-agent/src/voiceConfiguration.ts';
import {
  V4_MODEL, FLASH_MODEL, STORAGE_KEY, VOICE, buildListen, buildSchedule, checkSpend, dialogueInit, dialogueUrl,
  frenchVerified, fromState, httpBody, parseArgs, pendingRuns, plannedChars, runErrorOutcome, settled, toState, speedVerdict, summarise, usageByModel, worstCaseCredits,
} from './ttsV4TurboCheck.mjs';

test('parseArgs reads positionals and flags, and rejects bad ones', () => {
  const a = parseArgs(['.env', 'out.json', '--run', '--state', 'S', '--listen', 'L', '--key-dir', 'K', '--max-chars', '9500']);
  assert.deepEqual(a, { envFile: '.env', reportFile: 'out.json', run: true, state: 'S', listen: 'L', keyDir: 'K', maxChars: 9500, score: undefined, help: false });
  assert.throws(() => parseArgs(['.env', 'out.json', '--run']), /--state/);
  assert.equal(parseArgs(['.env', 'out.json']).state, undefined);
  const d = parseArgs(['.env', 'out.json']);
  assert.deepEqual([d.run, d.listen, d.maxChars], [false, undefined, 9000]);
  assert.deepEqual([parseArgs(['--score', 'r.json', '--key-dir', 'K']).score, parseArgs(['--help']).help], ['r.json', true]);
  assert.throws(() => parseArgs(['a', 'b', '--nope']), /Unknown flag/);
  assert.throws(() => parseArgs(['a', 'b', '--listen', 'L']), /together/);
  assert.throws(() => parseArgs(['a', 'b', '--key-dir', 'K']), /together/);
  assert.throws(() => parseArgs(['--score', 'r.json']), /--key-dir/);
  assert.throws(() => parseArgs(['a', 'b', '--max-chars', '0']), /--max-chars/);
});

test('the schedule is five runs, the untested socket first so a refusal costs least; the main three have 14 connections, 14 cold and 22 warm samples', () => {
  const runs = buildSchedule();
  assert.deepEqual(runs.map((r) => r.name), ['v4turbo', 'v2', 'flash', 'v4turbo-speed', 'v4turbo-today-speed']);
  assert.deepEqual(runs.map((r) => [r.model, r.transport]), [
    [V4_MODEL, 'dialogue'], [MODEL, 'http'], [FLASH_MODEL, 'http'], [V4_MODEL, 'dialogue'], [V4_MODEL, 'dialogue'],
  ]);
  for (const r of runs.slice(0, 3)) {
    assert.equal(r.connections.length, 14);
    assert.equal(r.connections.filter((c) => c.length === 1).length, 12);
    assert.deepEqual(r.connections[12], SENTENCES.map((_, i) => i));
    assert.equal(r.connections.reduce((n, c) => n + c.length - 1, 0), 22);
  }
  assert.deepEqual(runs[3].connections, [SENTENCES.map((_, i) => i)]);
  assert.equal(runs[0].voiceSettings, undefined);
  assert.deepEqual(runs[1].voiceSettings, VOICE_SETTINGS);
  assert.deepEqual(runs[3].voiceSettings, { speed: BEGINNER_SPEED });
  assert.deepEqual(runs[4].voiceSettings, { ...VOICE_SETTINGS, speed: BEGINNER_SPEED });
});

test('planned characters and worst-case credits are pinned, and the cap refuses before anything else', () => {
  const runs = buildSchedule();
  assert.equal(plannedChars(runs), 8954);
  assert.equal(worstCaseCredits(runs), 2442 + 1221 + 4070);
  assert.equal(checkSpend(runs, 9000), 8954);
  assert.throws(() => checkSpend(runs, 8953), /8954.*--max-chars 8953/);
  assert.equal(plannedChars([{ connections: [[0]] }], ['é😀']), 2);
});

test('summarise splits cold from warm and reports the open time of dialogue runs', () => {
  const mk = (cold, firstMs, extra = {}) => ({ cold, firstMs, lastMs: firstMs + 1000, ...extra });
  const s = summarise([mk(true, 900, { openMs: 300 }), mk(false, 100), mk(false, 200), mk(false, 300), mk(true, 700, { openMs: 200 })]);
  assert.equal(s.n, 5);
  assert.deepEqual(s.cold, { n: 2, p50: 700, samples: [900, 700] });
  assert.deepEqual(s.warm, { n: 3, p50: 200, p95: 300 });
  assert.equal(s.warmLastP50, 1200);
  assert.equal(s.warmSpreadP50, 1000);
  assert.deepEqual(s.openMs, { p50: 200, samples: [300, 200] });
  assert.equal(summarise([mk(true, 5), mk(false, 6)]).openMs, undefined);
});

test('speedVerdict bands: honoured, ignored, inconclusive, rejected', () => {
  const base = Array(12).fill(10);
  const ratio = (r) => speedVerdict(base, base.map((b) => b * r));
  assert.equal(ratio(1.17).verdict, 'honoured');
  assert.equal(ratio(1.17).medianRatio, 1.17);
  assert.equal(ratio(1.0).verdict, 'ignored');
  assert.equal(ratio(1.07).verdict, 'inconclusive');
  assert.equal(ratio(1.1).verdict, 'honoured');
  assert.equal(ratio(1.05).verdict, 'ignored');
  assert.equal(speedVerdict([10, 10], [11.7, 11.7]).ratios.length, 2);
  assert.deepEqual(speedVerdict(null, null, 'boom'), { verdict: 'rejected', error: 'boom' });
});

test('httpBody mirrors the live request without previous_text', () => {
  assert.deepEqual(httpBody(MODEL, 'Salut', VOICE_SETTINGS), {
    text: 'Salut', model_id: MODEL, voice_settings: VOICE_SETTINGS, apply_text_normalization: 'auto',
  });
});

test('dialogueUrl and dialogueInit', () => {
  const url = new URL(dialogueUrl(V4_MODEL));
  assert.equal(url.protocol + url.host + url.pathname, 'wss:api.elevenlabs.io/v1/text-to-dialogue/stream-input');
  assert.deepEqual(Object.fromEntries(url.searchParams), { model_id: V4_MODEL, output_format: OUTPUT_ENCODING, enable_logging: 'false' });
  const bare = dialogueInit('vid', 'k');
  assert.deepEqual(bare, { voices: ['vid'], xi_api_key: 'k' });
  assert.ok(!('voice_settings' in bare));
  assert.deepEqual(dialogueInit('vid', 'k', { speed: 0.85 }).voice_settings, { speed: 0.85 });
  assert.ok(!('speed' in dialogueInit('vid', 'k', VOICE_SETTINGS).voice_settings));
});

test('frenchVerified reads verified_languages for each model', () => {
  const voice = { verified_languages: [{ language: 'fr', model_id: MODEL }, { language: 'en', model_id: V4_MODEL }, { language: 'fr', model_id: FLASH_MODEL }] };
  assert.deepEqual(frenchVerified(voice), { [MODEL]: true, [FLASH_MODEL]: true, [V4_MODEL]: false });
  assert.deepEqual(frenchVerified({}), { [MODEL]: false, [FLASH_MODEL]: false, [V4_MODEL]: false });
});

test('buildListen makes 12 blind pairs from the audio already collected', () => {
  const pcm = (n) => SENTENCES.map((_, i) => Buffer.alloc(100 + n + i * 2, n));
  let k = 0;
  const out = buildListen({ pcmV2: pcm(1), pcmV4: pcm(2), rng: () => (k++ % 2 ? 0.1 : 0.9), newId: () => `id${k++}` });
  assert.equal(out.manifest.pairs.length, 12);
  assert.equal(out.manifest.status, 'complete');
  assert.equal(out.manifest.storageKey, STORAGE_KEY);
  assert.equal(out.manifest.voice, VOICE);
  assert.equal(out.key.pairs && Object.keys(out.key.pairs).length, 12);
  for (const p of Object.values(out.key.pairs)) assert.deepEqual([p.A, p.B].sort(), [V4_MODEL, MODEL].sort());
  assert.ok(!/eleven_/.test(out.html) && !out.html.includes('key.json'));
  const lines = out.html.match(/<p class="line"[^>]*>/g);
  assert.equal(lines.length, 12);
  for (const l of lines) assert.match(l, /lang="fr"/);
  assert.equal(out.files.length, 24);
  const names = new Set(out.files.map((f) => f.name));
  for (const c of Object.values(out.manifest.clips)) {
    assert.ok(names.has(c.file));
    assert.equal(c.status, 'complete');
    assert.ok(c.bytes > 0 && c.seconds > 0);
  }
  assert.equal(out.files[0].wav.subarray(0, 4).toString(), 'RIFF');
  // each clip's audio is the one its key names
  for (const [id, model] of Object.entries(out.key.clips)) {
    const clip = out.manifest.clips[id];
    const wav = out.files.find((f) => f.name === clip.file).wav;
    assert.equal(wav[44], model === MODEL ? 1 : 2);
    assert.equal(clip.bytes, 100 + (model === MODEL ? 1 : 2) + clip.line * 2);
  }
  assert.equal(Object.keys(ELEVEN_VOICES).includes(VOICE), true);
});

test('the balance has settled when the last two reads agree and differ from before', () => {
  assert.equal(settled([], 100), false);
  assert.equal(settled([100], 100), false);
  assert.equal(settled([100, 100], 100), false); // lagging: nothing moved yet
  assert.equal(settled([100, 150], 100), false);
  assert.equal(settled([100, 150, 150], 100), true);
});

test('usageByModel keeps the usage object and reports any other shape as an error', () => {
  assert.deepEqual(usageByModel({ usage: { [MODEL]: [814] } }), { [MODEL]: [814] });
  for (const bad of [null, {}, { usage: [1] }, { usage: null }]) assert.deepEqual(usageByModel(bad), { error: 'unexpected response shape' });
});

test('toState and fromState round-trip samples, credits, rejection and the listen audio', () => {
  const N = SENTENCES.length;
  const samples = Array.from({ length: 3 * N }, (_, i) => ({ sentence: i % N, cold: i < N, firstMs: i, lastMs: i + 5, bytes: 4, seconds: 0.1, pcm: Buffer.from([i, 1, 2, 3]) }));
  const credits = { before: 1, after: 9, delta: 8, perChar: 0.5, settled: true };
  const [v4, , , speed] = buildSchedule();
  const st = JSON.parse(JSON.stringify(toState(v4, { samples, credits })));
  assert.equal(st.name, 'v4turbo');
  assert.ok(st.samples.every((x) => !('pcm' in x)));
  assert.equal(st.listenPcm.length, N);
  assert.deepEqual(st.listenPcm.map((b) => Buffer.from(b, 'base64')), samples.slice(N, 2 * N).map((x) => x.pcm));
  const back = fromState(st);
  assert.deepEqual(back.credits, credits);
  assert.deepEqual(back.samples.slice(N, 2 * N).map((x) => x.pcm), samples.slice(N, 2 * N).map((x) => x.pcm));
  assert.deepEqual(back.samples.map(({ pcm, ...x }) => x), samples.map(({ pcm, ...x }) => x));
  assert.equal(toState(speed, { samples, credits }).listenPcm, undefined);
  const rej = JSON.parse(JSON.stringify(toState(speed, { rejected: 'no' })));
  assert.deepEqual(fromState(rej), { rejected: 'no' });
});

test('pendingRuns drops finished runs, and the spend check counts only the pending ones', () => {
  const runs = buildSchedule();
  const pending = pendingRuns(runs, ['v4turbo', 'v2']);
  assert.deepEqual(pending.map((r) => r.name), ['flash', 'v4turbo-speed', 'v4turbo-today-speed']);
  assert.equal(plannedChars(pending), 2442 + 1628);
  assert.deepEqual(pendingRuns(runs, runs.map((r) => r.name)), []);
});

test('only a vendor refusal in a finding run is recorded; everything else throws', () => {
  const [v4, , , speed] = buildSchedule();
  const vendor = Object.assign(new Error('x'.repeat(400)), { vendor: true });
  assert.equal(runErrorOutcome(speed, vendor).rejected.length, 300);
  assert.throws(() => runErrorOutcome(speed, new Error('read ETIMEDOUT')), /ETIMEDOUT/);
  assert.throws(() => runErrorOutcome(v4, vendor), /xxx/);
});

test('buildListen with no rng puts each model first in exactly 6 of the 12 pairs, every time', () => {
  const pcm = SENTENCES.map(() => Buffer.alloc(10));
  const seen = new Set();
  for (let n = 0; n < 20; n++) {
    const { key } = buildListen({ pcmV2: pcm, pcmV4: pcm });
    const pairs = Object.values(key.pairs);
    assert.equal(pairs.length, 12);
    assert.equal(pairs.filter((p) => p.A === MODEL).length, 6);
    seen.add(pairs.map((p) => p.A).join());
  }
  assert.ok(seen.size > 1, 'the order is shuffled, not fixed');
});
