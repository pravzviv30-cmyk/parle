#!/usr/bin/env node
/**
 * Is ElevenLabs `eleven_v4_turbo` faster to first audio than today's voice? Opt-in, dev-only, never imported
 * by the app. Five runs of the same twelve French tutor sentences, one at a time: today's model and Flash over
 * the HTTP stream (what voice.ts does), and v4 Turbo over the Text to Dialogue websocket (the only place it is
 * served), plus two v4 runs that ask the socket for `speed` and for today's voice settings. Every run is timed
 * from a cold connection (the first sentence of each connection) and from a warm one (the rest).
 *
 * What it measures: vendor first audio, called straight at api.elevenlabs.io with the real key from a developer
 * machine, OFF the paid proxy. Not phone-audible latency, not a quality claim. With --listen it also writes a
 * blind A/B page (today's model vs v4 Turbo) from the very audio it timed, sealed key in --key-dir.
 *
 * What it BILLS: ElevenLabs characters. The plan is 8954 characters; --max-chars (default 9000) caps it, and
 * the worst-case credits are checked against the account balance first. v4 Turbo is listed at Flash's price but
 * unmeasured, so the guard assumes it bills like today's model; the report keeps the per-model usage reads
 * (the balance counter lags, so no per-run balance delta is kept).
 * Without --run nothing is read and no request is made: it prints the plan and stops. With --run, --state <dir>
 * (outside the repo) keeps one file per finished run, so a failure loses at most the run in progress: re-run the same
 * command and finished runs load from there instead of billing again.
 *
 *   node --experimental-strip-types scripts/ttsV4TurboCheck.mjs <tutor .env file> <report.json> \
 *     [--run --state <dir>] [--listen <dir> --key-dir <dir>] [--max-chars 9000]
 *   node --experimental-strip-types scripts/ttsV4TurboCheck.mjs --score <results.json> --key-dir <dir>
 *
 * Needs ELEVEN_API_KEY in the env file. The key is never printed.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as https from 'node:https';
import { SENTENCES, percentile } from './measureTtsFirstAudio.mjs';
import { buildDesign, buildHtml, wavFromPcm, scoreResults } from './ttsBlindCheck.mjs';
import {
  ELEVEN_VOICES, MODEL, VOICE_SETTINGS, BEGINNER_SPEED, OUTPUT_ENCODING, STREAMING_LATENCY, LANGUAGE_CODE,
} from '../services/tutor-agent/src/voiceConfiguration.ts';

export const VOICE = 'alexandre'; // the catalogue's DEFAULT_TUTOR_VOICE
export const FLASH_MODEL = 'eleven_flash_v2_5';
export const V4_MODEL = 'eleven_v4_turbo';
export const STORAGE_KEY = 'tts-v4turbo-2026-11-08';
export const DEFAULT_MAX_CHARS = 9000;
const SETTLE_MS = 1500; // a dialogue sentence with no turn-final message ends this long after its last chunk
const HEADROOM = 500;
// v4 Turbo is listed at Flash's price but unmeasured, so the guard assumes the worst.
const RATES = { [MODEL]: 1, [FLASH_MODEL]: 0.5, [V4_MODEL]: 1 };
const SAMPLE_RATE = Number(OUTPUT_ENCODING.split('_')[1]);
const API = 'https://api.elevenlabs.io';

export function parseArgs(argv) {
  const f = { run: false, state: undefined, listen: undefined, keyDir: undefined, maxChars: DEFAULT_MAX_CHARS, score: undefined, help: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') f.help = true;
    else if (a === '--run') f.run = true;
    else if (a === '--state') f.state = argv[++i];
    else if (a === '--listen') f.listen = argv[++i];
    else if (a === '--key-dir') f.keyDir = argv[++i];
    else if (a === '--score') f.score = argv[++i];
    else if (a === '--max-chars') f.maxChars = Number(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`Unknown flag ${a}.`);
    else positional.push(a);
  }
  if (!(f.maxChars > 0)) throw new Error('--max-chars needs a positive number.');
  if (f.run && !f.state) throw new Error('--run needs --state <dir>, outside the repo, so a failure loses at most the run in progress.');
  if (f.score !== undefined) { if (!f.score || !f.keyDir) throw new Error('--score needs a results file and --key-dir.'); }
  else if (!f.listen !== !f.keyDir) throw new Error('--listen and --key-dir go together.');
  return { envFile: positional[0], reportFile: positional[1], ...f };
}

const ALL = SENTENCES.map((_, i) => i);
const MAIN = [...ALL.map((i) => [i]), ALL, ALL]; // 12 fresh single-sentence connections, then two full ones

/**
 * The runs, in order. A connection is a list of sentence indices; its first sentence is cold, the rest warm.
 * The socket path has no test against the vendor, so it goes first: if it is refused, little has been billed.
 */
export function buildSchedule() {
  const dialogue = { model: V4_MODEL, transport: 'dialogue' };
  return [
    { name: 'v4turbo', ...dialogue, voiceSettings: undefined, connections: MAIN },
    { name: 'v2', model: MODEL, transport: 'http', voiceSettings: VOICE_SETTINGS, connections: MAIN },
    { name: 'flash', model: FLASH_MODEL, transport: 'http', voiceSettings: VOICE_SETTINGS, connections: MAIN },
    { name: 'v4turbo-speed', ...dialogue, voiceSettings: { speed: BEGINNER_SPEED }, connections: [ALL], finding: true },
    { name: 'v4turbo-today-speed', ...dialogue, voiceSettings: { ...VOICE_SETTINGS, speed: BEGINNER_SPEED }, connections: [ALL], finding: true },
  ];
}

const runChars = (run, sentences) => run.connections.flat().reduce((n, i) => n + [...sentences[i]].length, 0);
export const plannedChars = (runs, sentences = SENTENCES) => runs.reduce((n, r) => n + runChars(r, sentences), 0);
export const worstCaseCredits = (runs, sentences = SENTENCES) => runs.reduce((n, r) => n + runChars(r, sentences) * RATES[r.model], 0);

export function checkSpend(runs, maxChars) {
  const chars = plannedChars(runs);
  if (chars > maxChars) throw new Error(`This run would bill ${chars} characters, over --max-chars ${maxChars}.`);
  return chars;
}

const LISTEN_RUNS = ['v2', 'v4turbo']; // the two runs whose audio feeds the blind page
export const pendingRuns = (runs, doneNames) => runs.filter((r) => !doneNames.includes(r.name));

/** What one finished run keeps on disk: samples without audio, plus the listen pass of v2 and v4turbo as base64. */
export function toState(run, result) {
  if (result.rejected) return { name: run.name, rejected: result.rejected };
  const N = SENTENCES.length;
  return {
    name: run.name, samples: result.samples.map(({ pcm, ...s }) => s),
    ...(LISTEN_RUNS.includes(run.name) ? { listenPcm: result.samples.slice(N, 2 * N).map((s) => s.pcm.toString('base64')) } : {}),
  };
}

export function fromState(json) {
  if (json.rejected) return { rejected: json.rejected };
  const N = SENTENCES.length, samples = json.samples.map((s) => ({ ...s }));
  (json.listenPcm ?? []).forEach((b, i) => { samples[N + i].pcm = Buffer.from(b, 'base64'); });
  return { samples };
}

/** A vendor refusal in a finding run is the finding; a network error is not, and stops the script. */
export function runErrorOutcome(run, err) {
  if (run.finding && err.vendor) return { rejected: clip(err.message) };
  throw err;
}

/** n, then cold (first sentence of each connection) apart from warm; dialogue samples carry openMs. */
export function summarise(samples) {
  const cold = samples.filter((s) => s.cold), warm = samples.filter((s) => !s.cold);
  const opens = cold.map((s) => s.openMs).filter((x) => x != null);
  const first = warm.map((s) => s.firstMs);
  return {
    n: samples.length,
    cold: { n: cold.length, p50: percentile(cold.map((s) => s.firstMs), 50), samples: cold.map((s) => s.firstMs) },
    warm: { n: warm.length, p50: percentile(first, 50), p95: percentile(first, 95) },
    warmLastP50: percentile(warm.map((s) => s.lastMs), 50),
    warmSpreadP50: percentile(warm.map((s) => s.lastMs - s.firstMs), 50),
    ...(opens.length ? { openMs: { p50: percentile(opens, 50), samples: opens } } : {}),
  };
}

/** Did the speed setting lengthen the audio? Ratios are variant seconds over base seconds, sentence by sentence. */
export function speedVerdict(baseSeconds, variantSeconds, error) {
  if (error) return { verdict: 'rejected', error };
  const round = (x) => Math.round(x * 1000) / 1000;
  const ratios = variantSeconds.map((v, i) => round(v / baseSeconds[i]));
  const s = [...ratios].sort((a, b) => a - b), m = s.length >> 1;
  const medianRatio = round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
  const verdict = medianRatio >= 1.1 ? 'honoured' : medianRatio >= 0.95 && medianRatio <= 1.05 ? 'ignored' : 'inconclusive';
  return { verdict, medianRatio, ratios };
}

/** The HTTP stream body voice.ts sends (elevenStitchedRequest), without previous_text. */
export const httpBody = (model, text, voiceSettings) => ({
  text, model_id: model, voice_settings: voiceSettings, apply_text_normalization: 'auto',
  ...(LANGUAGE_CODE ? { language_code: LANGUAGE_CODE } : {}),
});

export const dialogueUrl = (model) => `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=${model}&output_format=${OUTPUT_ENCODING}&enable_logging=false`;
export const dialogueInit = (voiceId, apiKey, voiceSettings) => ({
  voices: [voiceId], xi_api_key: apiKey, ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
});

export const frenchVerified = (voice, models = [MODEL, FLASH_MODEL, V4_MODEL]) => Object.fromEntries(
  models.map((m) => [m, (voice.verified_languages ?? []).some((l) => l.language === 'fr' && l.model_id === m)]));

/** One total per model over the saved usage reads (each value is an array; cumulative gives one element). */
export const sumUsage = (reads) => reads.reduce((total, r) => {
  for (const [model, values] of Object.entries(r.usage ?? {})) total[model] = (total[model] ?? 0) + [values].flat().reduce((n, v) => n + v, 0);
  return total;
}, {});

/** Per-model usage from /v1/usage/character-stats, or { error } when the answer is not the expected shape. */
export const usageByModel = (response) => response && typeof response.usage === 'object' && response.usage && !Array.isArray(response.usage)
  ? response.usage : { error: 'unexpected response shape' };

/** buildDesign flips a coin per pair; this hands it exactly half "v2 first" (below 0.5) and half not, in a random order. */
function balancedRng(pairs = SENTENCES.length) {
  const draws = Array.from({ length: pairs }, (_, i) => (i < pairs / 2 ? 0.25 : 0.75));
  for (let i = draws.length - 1; i > 0; i--) { const j = randomInt(i + 1); [draws[i], draws[j]] = [draws[j], draws[i]]; }
  return () => draws.pop();
}

/** The blind page and its sealed key, from the 12 per-sentence clips of each model already collected. */
export function buildListen({ pcmV2, pcmV4, rng = balancedRng(), newId }) {
  const plan = SENTENCES.flatMap((text, line) => [MODEL, V4_MODEL].map((id) => ({
    voice: VOICE, voiceId: ELEVEN_VOICES[VOICE], line, text, model: { id }, chars: [...text].length, estimate: 0,
  })));
  const { pairs, clips, key } = buildDesign(plan, { rng, newId });
  const files = [];
  for (const [id, clip] of Object.entries(clips)) {
    const pcm = (key.clips[id] === MODEL ? pcmV2 : pcmV4)[clip.line];
    Object.assign(clip, { status: 'complete', bytes: pcm.length, seconds: pcm.length / 2 / SAMPLE_RATE });
    files.push({ name: clip.file, wav: wavFromPcm(pcm, SAMPLE_RATE) });
  }
  const manifest = {
    createdAt: new Date().toISOString(), experiment: 'v4turbo', storageKey: STORAGE_KEY, voice: VOICE, lines: SENTENCES, pairs, clips,
    status: 'complete', note: 'Clips reuse the timed run (v2 over HTTP, v4 Turbo over the dialogue socket, both at normal speed); not loudness-matched.',
  };
  // buildHtml tags the last entry of `lines` as English; all 12 are French, so a blank one goes last.
  return { manifest, key, html: buildHtml(manifest, [...SENTENCES, ''], STORAGE_KEY), files };
}

// ---- paid path: everything below makes network calls and is never run by the tests ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (s, n = 300) => String(s).slice(0, n);
const ms = (t0) => Math.round(performance.now() - t0);
const sampleOf = (sentence, cold, r) => ({
  sentence, cold, firstMs: r.firstMs, lastMs: r.lastMs, bytes: r.pcm.length, seconds: Math.round((r.pcm.length / 2 / SAMPLE_RATE) * 1000) / 1000,
  ...(r.endedBy ? { endedBy: r.endedBy } : {}), ...(r.costHeader != null ? { costHeader: r.costHeader } : {}), ...(r.openMs != null ? { openMs: r.openMs } : {}),
});

async function getJson(apiKey, path) {
  const res = await fetch(API + path, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path.split('?')[0]} ${res.status}: ${clip(text)}`);
  return JSON.parse(text);
}

async function readUsed(apiKey) {
  const s = await getJson(apiKey, '/v1/user/subscription');
  if (![s.character_count, s.character_limit].every(Number.isFinite)) throw new Error('Credit balance unavailable.');
  return { used: s.character_count, limit: s.character_limit };
}

function httpSample({ apiKey, voiceId, model, text, voiceSettings, agent }) {
  const body = JSON.stringify(httpBody(model, text, voiceSettings));
  const url = `${API}/v1/text-to-speech/${voiceId}/stream?output_format=${OUTPUT_ENCODING}&enable_logging=false&optimize_streaming_latency=${STREAMING_LATENCY}`;
  return new Promise((resolve, reject) => {
    const t0 = performance.now(); // a cold sample includes TCP and TLS
    const req = https.request(url, {
      method: 'POST', agent, headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const type = res.headers['content-type'] ?? '', ok = res.statusCode === 200 && type.startsWith('audio/');
      const chunks = []; let firstMs = null;
      res.on('data', (c) => { if (ok) firstMs ??= ms(t0); chunks.push(c); });
      res.on('error', reject);
      res.on('end', () => {
        const pcm = Buffer.concat(chunks);
        if (!ok) return reject(Object.assign(new Error(`TTS request answered ${res.statusCode} ${type}: ${clip(pcm.toString('utf8', 0, 300))}`), { vendor: true }));
        resolve({ firstMs, lastMs: ms(t0), pcm, costHeader: res.headers['character-cost'] ?? null });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('TTS request timed out after 30 s')));
    req.end(body);
  });
}

/** One dialogue socket carrying `indices` one sentence at a time. The first sentence is timed from `new WebSocket`. */
async function dialogueConnection({ apiKey, voiceId, model, voiceSettings, indices }) {
  const t0 = performance.now();
  const ws = new WebSocket(dialogueUrl(model));
  let turn = null, fail, end, openMs = null;
  const dead = new Promise((_, rej) => { fail = rej; });
  dead.catch(() => {});
  const ended = new Promise((r) => { end = r; });
  const opened = new Promise((r) => { ws.onopen = r; });
  ws.onerror = () => fail(new Error('dialogue socket error'));
  ws.onclose = () => { fail(new Error('dialogue socket closed')); end(); };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return fail(e); }
    if (m.error) return fail(Object.assign(new Error(clip(`${m.error}: ${m.message}`)), { vendor: true }));
    if (m.is_final) end();
    turn?.onMessage(m);
  };
  // One sentence's audio: ends at the turn-final message after a chunk, or SETTLE_MS after the last chunk.
  const listen = (start) => {
    const chunks = []; let firstMs = null, lastMs = null, timer;
    const arm = (wait, f) => { clearTimeout(timer); timer = setTimeout(f, wait); };
    const done = new Promise((resolve, reject) => {
      arm(20000, () => reject(new Error('no audio within 20 s')));
      turn = {
        onMessage(m) {
          if (m.audio) {
            const b = Buffer.from(m.audio, 'base64');
            if (b.length) { firstMs ??= ms(start); lastMs = ms(start); chunks.push(b); arm(SETTLE_MS, () => resolve({ firstMs, lastMs, pcm: Buffer.concat(chunks), endedBy: 'settle' })); }
          }
          if (m.is_final_audio_for_turn === true && chunks.length) resolve({ firstMs, lastMs, pcm: Buffer.concat(chunks), endedBy: 'turn-final' });
        },
      };
    });
    return { done, stop: () => { clearTimeout(timer); turn = null; } };
  };
  const samples = [];
  try {
    for (const [k, i] of indices.entries()) {
      const cold = k === 0, t = listen(cold ? t0 : performance.now());
      try {
        if (cold) {
          await Promise.race([opened, dead]);
          openMs = ms(t0);
          ws.send(JSON.stringify(dialogueInit(voiceId, apiKey, voiceSettings)));
        }
        ws.send(JSON.stringify({ inputs: [{ text: SENTENCES[i], voice_id: voiceId, new_turn: true }] }));
        ws.send(JSON.stringify({ flush: true }));
        const r = await Promise.race([t.done, dead]);
        samples.push({ ...sampleOf(i, cold, { ...r, ...(cold ? { openMs } : {}) }), pcm: r.pcm });
      } finally { t.stop(); }
    }
  } finally {
    try { ws.send(JSON.stringify({ close_socket: true })); await Promise.race([ended, sleep(5000)]); } catch { /* already closed */ }
    ws.close();
  }
  return samples;
}

/** Runs every connection of one run in order. Audio stays on `pcm` of each sample until the report strips it. */
async function executeRun(run, { apiKey, voiceId }) {
  const samples = [];
  for (const indices of run.connections) {
    if (run.transport === 'dialogue') {
      samples.push(...await dialogueConnection({ apiKey, voiceId, model: run.model, voiceSettings: run.voiceSettings, indices }));
      continue;
    }
    const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      for (const [k, i] of indices.entries()) {
        const r = await httpSample({ apiKey, voiceId, model: run.model, text: SENTENCES[i], voiceSettings: run.voiceSettings, agent });
        samples.push({ ...sampleOf(i, k === 0, r), pcm: r.pcm });
      }
    } finally { agent.destroy(); }
  }
  return { samples };
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));
const usage = 'usage: node --experimental-strip-types scripts/ttsV4TurboCheck.mjs <tutor .env file> <report.json> [--run --state <dir>] [--listen <dir> --key-dir <dir>] [--max-chars 9000]\n       node --experimental-strip-types scripts/ttsV4TurboCheck.mjs --score <results.json> --key-dir <dir>';

async function main(argv) {
  let a;
  try { a = parseArgs(argv); } catch (e) { console.error(`${e.message}\n${usage}`); process.exit(2); }
  if (a.help) { console.error(usage); process.exit(2); }
  if (a.score) {
    const summary = scoreResults(readJson(join(a.keyDir, 'key.json')), readJson(a.score), { current: MODEL, second: 'v4turbo' });
    writeJson(join(a.keyDir, 'summary.json'), summary);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const runs = buildSchedule();
  if (!a.run) {
    try { checkSpend(runs, a.maxChars); } catch (e) { console.error(e.message); process.exit(2); }
    console.log(JSON.stringify({
      runs: runs.map((r) => ({ name: r.name, model: r.model, transport: r.transport, connections: r.connections.length, chars: runChars(r, SENTENCES) })),
      totalChars: plannedChars(runs), worstCaseCredits: worstCaseCredits(runs), maxChars: a.maxChars,
    }));
    return;
  }
  if (!a.envFile || !a.reportFile) { console.error(usage); process.exit(2); }
  const stateFile = (run) => join(a.state, `${run.name}.json`);
  const pending = pendingRuns(runs, runs.filter((r) => existsSync(stateFile(r))).map((r) => r.name));
  try { checkSpend(pending, a.maxChars); } catch (e) { console.error(e.message); process.exit(2); }
  if (a.keyDir && existsSync(join(a.keyDir, 'key.json'))) { console.error(`${join(a.keyDir, 'key.json')} already exists; a sealed key is never overwritten.`); process.exit(2); }

  const apiKey = parseEnv(readFileSync(a.envFile, 'utf8')).ELEVEN_API_KEY;
  if (!apiKey) throw new Error('ELEVEN_API_KEY is missing from the env file.');
  const verifiedFrench = {};
  for (const [voice, id] of Object.entries(ELEVEN_VOICES)) verifiedFrench[voice] = frenchVerified(await getJson(apiKey, `/v1/voices/${id}`));
  const { used, limit } = await readUsed(apiKey), worst = worstCaseCredits(pending);
  if (limit - used < worst + HEADROOM) throw new Error(`Only ${limit - used} credits left; this run needs ${worst} plus ${HEADROOM} headroom.`);

  const startedAt = Date.now(), results = {};
  mkdirSync(a.state, { recursive: true });
  for (const run of runs) {
    if (!pending.includes(run)) { results[run.name] = fromState(readJson(stateFile(run))); console.log(`${run.name}: loaded from state`); continue; }
    try { results[run.name] = await executeRun(run, { apiKey, voiceId: ELEVEN_VOICES[VOICE] }); }
    catch (e) { results[run.name] = runErrorOutcome(run, e); }
    writeJson(stateFile(run), toState(run, results[run.name]));
    console.log(`${run.name}: ${results[run.name].rejected ? 'rejected' : 'done'}`);
  }
  // Billing evidence: each invocation that ran something reads usage for its own window and keeps it beside the run files.
  const usageFile = join(a.state, 'usage.json');
  const usageReads = existsSync(usageFile) ? readJson(usageFile) : [];
  if (pending.length) {
    const window = { start: startedAt, end: Date.now() };
    let got;
    try { got = usageByModel(await getJson(apiKey, `/v1/usage/character-stats?start_unix=${window.start}&end_unix=${window.end}&breakdown_type=model&aggregation_interval=cumulative`)); }
    catch (e) { got = { error: clip(e.message, 200) }; }
    usageReads.push(got.error ? { window, error: got.error } : { window, usage: got });
    writeJson(usageFile, usageReads);
  }

  const passSeconds = (r) => r.samples.map((s) => s.seconds);
  const base = results.v4turbo.samples.slice(SENTENCES.length, 2 * SENTENCES.length);
  const reportRuns = {}, speed = {};
  for (const run of runs) {
    const r = results[run.name], chars = runChars(run, SENTENCES);
    reportRuns[run.name] = { model: run.model, transport: run.transport, voiceSettings: run.voiceSettings ?? null, chars };
    if (r.rejected) { Object.assign(reportRuns[run.name], { status: 'rejected', error: r.rejected }); }
    else Object.assign(reportRuns[run.name], { summary: summarise(r.samples), samples: r.samples.map(({ pcm, ...s }) => s) });
    if (run.finding) speed[run.name] = { sent: run.voiceSettings, ...(r.rejected ? speedVerdict(null, null, r.rejected) : speedVerdict(base.map((s) => s.seconds), passSeconds(r))), ...(r.rejected ? { error: r.rejected } : {}) };
  }
  writeJson(a.reportFile, {
    generatedAt: new Date().toISOString(), network: 'developer Mac, direct to api.elevenlabs.io, off the paid proxy', voice: VOICE,
    outputFormat: OUTPUT_ENCODING, sentences: SENTENCES.length, charsPerPass: plannedChars([{ connections: [ALL] }]),
    httpSettings: { voiceSettings: VOICE_SETTINGS, streamingLatency: STREAMING_LATENCY, languageCode: LANGUAGE_CODE ?? null },
    runs: reportRuns, speed, usageReads, usageByModel: sumUsage(usageReads), verifiedFrench,
  });
  console.table(runs.map((run) => {
    const r = reportRuns[run.name], s = r.summary;
    return { run: run.name, model: run.model, 'cold p50': s?.cold.p50, 'warm p50': s?.warm.p50, 'warm p95': s?.warm.p95, 'open p50': s?.openMs?.p50, status: r.status ?? 'ok' };
  }));
  console.log(JSON.stringify(speed));

  if (a.listen) {
    const pass = (name) => results[name].samples.slice(SENTENCES.length, 2 * SENTENCES.length).map((s) => s.pcm);
    const out = buildListen({ pcmV2: pass('v2'), pcmV4: pass('v4turbo') });
    mkdirSync(a.listen, { recursive: true }); mkdirSync(a.keyDir, { recursive: true });
    for (const f of out.files) writeFileSync(join(a.listen, f.name), f.wav);
    writeFileSync(join(a.listen, 'index.html'), out.html);
    writeJson(join(a.keyDir, 'key.json'), out.key);
    writeJson(join(a.keyDir, 'manifest.json'), out.manifest);
    console.log(JSON.stringify({ listen: a.listen, keyDir: a.keyDir, pairs: out.manifest.pairs.length }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
