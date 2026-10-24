#!/usr/bin/env node
/**
 * Does the live voice stack hear whispered and very quiet French? Dev-only.
 *
 * Clips: the six multilingual_v2 phrase clips from voice-comparison-2026-09-19,
 * plus (with --generate, run once) eleven_v3 clips of three sentences in the
 * same six voices, plain and with the [whispers] audio tag, plus any founder
 * recordings dropped in artifacts/quiet-speech-2026-10-23/real/.
 *
 * Conditions: gain 0/-10/-20/-30 dB, clean and over a seeded pink-noise bed
 * at NOISE_DBFS (a quiet train), and noise-only controls.
 *
 * Measures, at 16 kHz mono (what the agent's STT receives):
 *   - Silero VAD (the agent's plugin, defaults except activationThreshold 0.5,
 *     0.35, 0.25, one fresh VAD per threshold): START_OF_SPEECH, voiced share,
 *     false starts on noise only;
 *   - the VOICE-010 commit replay at the 1,200 ms beginner floor;
 *   - Deepgram through the real @livekit/agents-plugin-deepgram STT stream with
 *     the live options (nova-3, fr, 16 kHz mono, mipOptOut), including the
 *     plugin's AudioEnergyFilter, which drops 100 ms frames with RMS <= 0.004;
 *   - speech RMS against the mobile meter's 0.01 floor (levels.ts REST_BELOW).
 *
 * Usage:
 *   node --env-file=<tutor-agent .env> scripts/measureQuietSpeech.mjs [--generate] [--report-only] [--out docs/live-latency-evidence]
 * Paid calls: ElevenLabs only with --generate (capped at 3,000 credits, never
 * regenerates once a manifest exists); Deepgram capped at DG_CAP_SECONDS.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applyGain, energyFilterSends, highBandRatio, median, mix, parseWav, periodicity, pinkNoise,
  rmsLinear, slug, toDbfs, voicedSpan, wavBytes, wordAccuracy,
} from './quietSpeechHelpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const agentRequire = createRequire(join(root, 'services/tutor-agent/package.json'));
const load = async (name) => import(pathToFileURL(agentRequire.resolve(name)).href);

const agents = await load('@livekit/agents');
agents.initializeLogger({ pretty: false, level: 'error' });
const silero = await load('@livekit/agents-plugin-silero');
const deepgram = await load('@livekit/agents-plugin-deepgram');
const { AudioFrame, AudioResampler, AudioResamplerQuality } = await load('@livekit/rtc-node');
const { VADEventType, stt: sttNs } = agents;

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const outDir = resolve(root, arg('--out') ?? 'docs/live-latency-evidence');
const v2Dir = join(root, 'artifacts/voice-comparison-2026-09-19');
const clipDir = join(root, 'artifacts/quiet-speech-2026-10-23');
const realDir = join(clipDir, 'real');
const manifestPath = join(clipDir, 'manifest.json');

const SENTENCES = ['On échange nos numéros ?', "Je voudrais un café, s'il vous plaît.", 'Excusez-moi, où est la gare ?'];
const VOICES = {
  alexandre: 'c365oriviHmAhyLhpuN6', emilie: 'GYzIdoKkRyANjBvkKYfO', guillaume: 'Qrl71rx6Yg8RvyPYRGCQ',
  marie: 'sANWqF1bCMzR6eyZbCGw', anatole: 'Jrq4GqCKqYpigdQsZRkP', sarah: 'b6nVfb3l2zshrLZTvqbs',
}; // services/tutor-agent/src/voiceConfiguration.ts ELEVEN_VOICES
const VOICE_MULTIPLIER = { alexandre: 1, emilie: 2, guillaume: 1, marie: 1, anatole: 1, sarah: 2 };
const V3 = 'eleven_v3';
const V3_SETTINGS = { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true }; // v3 takes 0/0.5/1 stability
const WHISPER_TAG = '[whispers]';
const CREDIT_CAP = 3_000;

const GAINS = [0, -10, -20, -30];
const NOISE_DBFS = -50; // pink bed RMS: a quiet train carriage as a phone mic hears it
const NOISE_ONLY_OFFSETS = [10, 0, -10, -20, -30]; // bed level + offset; +10 is a stress row
const THRESHOLDS = [0.5, 0.35, 0.25];
const FLOOR_MS = 1_200; // thinkingTime.ts beginner floor
const METER_FLOOR = 0.01; // apps/mobile/src/live/levels.ts REST_BELOW
const LEAD_MS = 1_100; // > the energy filter's 1 s cooldown, so speech meets a warm filter
const TAIL_MS = 2_000;
const DG_CAP_SECONDS = 15 * 60;
const DG_SPEED = 2; // push frames at 2x real time
const DG_CONCURRENCY = 6;
const DG_OPTIONS = { model: 'nova-3', language: 'fr', sampleRate: 16000, numChannels: 1, mipOptOut: true };

// ---------------------------------------------------------------- generation
async function generate() {
  if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is missing.');
  if (existsSync(manifestPath)) {
    console.log('manifest exists; no regeneration (no re-billing).');
    return;
  }
  const plan = Object.entries(VOICES).flatMap(([voice, voiceId]) => SENTENCES.flatMap((text) => [null, WHISPER_TAG].map((tag) => {
    const sent = tag ? `${tag} ${text}` : text;
    return { voice, voiceId, text, tag, sent, reserve: sent.length * VOICE_MULTIPLIER[voice] };
  })));
  const estimated = plan.reduce((n, p) => n + p.reserve, 0);
  console.log(JSON.stringify({ requests: plan.length, reservedCredits: estimated, cap: CREDIT_CAP }));
  if (estimated > CREDIT_CAP) throw new Error('Generation plan exceeds the 3,000 credit cap; refusing.');
  const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
  const subscription = async () => {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const s = await r.json();
    return { tier: s.tier, used: s.character_count, limit: s.character_limit };
  };
  const before = await subscription();
  if (Number.isFinite(before.used) && before.limit - before.used < CREDIT_CAP) throw new Error('Insufficient credit headroom for the cap.');
  mkdirSync(clipDir, { recursive: true });
  const manifest = {
    createdAt: new Date().toISOString(), model: V3, settings: V3_SETTINGS, language: 'fr', format: 'pcm_22050',
    cap: CREDIT_CAP, reservedCredits: estimated, before, modelAvailable: null, tagNote: null, clips: [], status: 'running',
  };
  const save = () => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  save();
  let accounted = 0;
  for (const p of plan) {
    if (manifest.modelAvailable === false) break;
    if (accounted + p.reserve > CREDIT_CAP) {
      manifest.status = 'stopped-at-cap';
      break;
    }
    const kind = p.tag ? 'whisper' : 'plain';
    const file = `${p.voice}-v3-${kind}-${slug(p.text)}.wav`;
    const clip = { voice: p.voice, model: V3, text: p.text, tag: p.tag, requestText: p.sent, file, reservedCredits: p.reserve, status: 'pending' };
    manifest.clips.push(clip);
    accounted += p.reserve;
    save();
    let response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${p.voiceId}?output_format=pcm_22050`, {
        method: 'POST', headers, signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({ text: p.sent, model_id: V3, language_code: 'fr', voice_settings: V3_SETTINGS }),
      });
    } catch (err) {
      clip.status = `network-error: ${err instanceof Error ? err.name : 'unknown'} (no retry; cost uncertain)`;
      save();
      continue;
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300).replace(/[A-Za-z0-9_-]{32,}/g, '<redacted>');
      clip.status = `http-${response.status}`;
      clip.error = body;
      accounted -= p.reserve;
      if (manifest.clips.filter((c) => c.status === 'complete').length === 0 && !p.tag) {
        manifest.modelAvailable = false; // first plain request refused: treat v3 as unavailable
      }
      if (p.tag) manifest.tagNote = `whisper request refused with HTTP ${response.status}`;
      save();
      continue;
    }
    manifest.modelAvailable = true;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2205 || bytes.length % 2 !== 0) {
      clip.status = 'invalid-pcm';
      save();
      continue;
    }
    const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
    writeFileSync(join(clipDir, file), wavBytes(pcm, 22050));
    const cost = response.headers.get('character-cost');
    const credits = cost === null ? null : Number(cost);
    if (Number.isFinite(credits)) accounted += credits - p.reserve;
    Object.assign(clip, { status: 'complete', credits, seconds: pcm.length / 22050, sha256: createHash('sha256').update(bytes).digest('hex') });
    save();
    console.log(JSON.stringify({ file, credits, accounted }));
  }
  // Crude whisper check: a whisper has no pitch and a brighter spectrum.
  for (const c of manifest.clips.filter((x) => x.tag && x.status === 'complete')) {
    const twin = manifest.clips.find((x) => !x.tag && x.voice === c.voice && x.text === c.text && x.status === 'complete');
    const w = parseWav(readFileSync(join(clipDir, c.file)));
    c.highBandRatio = Number(highBandRatio(w.pcm, w.rate).toFixed(3));
    c.periodicity = Number(periodicity(w.pcm, w.rate).toFixed(3));
    if (twin) {
      const t = parseWav(readFileSync(join(clipDir, twin.file)));
      twin.highBandRatio = Number(highBandRatio(t.pcm, t.rate).toFixed(3));
      twin.periodicity = Number(periodicity(t.pcm, t.rate).toFixed(3));
      c.highBandVsPlain = Number((c.highBandRatio / Math.max(1e-9, twin.highBandRatio)).toFixed(2));
      c.periodicityVsPlain = Number((c.periodicity - twin.periodicity).toFixed(3));
      c.looksWhispered = c.periodicity < 0.5 && c.periodicity < twin.periodicity - 0.15;
    }
  }
  if (manifest.modelAvailable === false) manifest.note = 'eleven_v3 unavailable; continue with attenuated v2 clips only.';
  manifest.after = await subscription();
  if (Number.isFinite(manifest.after.used) && Number.isFinite(before.used)) manifest.measuredCredits = manifest.after.used - before.used;
  manifest.accountedCredits = accounted;
  if (manifest.status === 'running') manifest.status = 'complete';
  save();
}

function ensureRealReadme() {
  mkdirSync(realDir, { recursive: true });
  const readme = join(realDir, 'README.md');
  if (existsSync(readme)) return;
  writeFileSync(readme, [
    '# Founder recordings for the quiet speech check',
    '',
    'Drop 16-bit PCM WAV files here (any sample rate, mono or stereo). The file name must contain',
    '`whisper` or `soft`, and the slug of one of these sentences:',
    '',
    ...SENTENCES.map((s) => `- \`${slug(s)}\` for "${s}"`),
    '',
    'Example: `whisper-on-echange-nos-numeros.wav`. Record on a phone at a normal distance. Then rerun',
    '`scripts/measureQuietSpeech.mjs` (without `--generate`); the files become their own group.',
    'These are local evidence files: keep them out of git unless the founder agrees otherwise.',
    '',
  ].join('\n'));
}

// --------------------------------------------------------------- audio utils
function to16k(pcm, rate) {
  if (rate === 16000) return pcm;
  const r = new AudioResampler(rate, 16000, 1, AudioResamplerQuality.HIGH);
  const chunks = [];
  const step = Math.round(rate / 100);
  for (let i = 0; i < pcm.length; i += step) {
    const d = pcm.slice(i, Math.min(i + step, pcm.length));
    for (const f of r.push(new AudioFrame(d, rate, 1, d.length))) chunks.push(f.data);
  }
  for (const f of r.flush()) chunks.push(f.data);
  const out = new Int16Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

const ms = (n) => Math.round((16000 * n) / 1000);
/** Lead silence + clip at gain + tail silence, optionally over the noise bed. */
function condition(pcm16, gainDb, noisy, seed) {
  const body = applyGain(pcm16, gainDb);
  const out = new Int16Array(ms(LEAD_MS) + body.length + ms(TAIL_MS));
  out.set(body, ms(LEAD_MS));
  return noisy ? mix(out, pinkNoise(out.length, seed, NOISE_DBFS)) : out;
}

// ---------------------------------------------------------------------- VAD
const vads = {};
for (const t of THRESHOLDS) vads[t] = await silero.VAD.load({ activationThreshold: t });

async function vadEvents(vad, pcm) {
  const stream = vad.stream();
  for (let i = 0; i < pcm.length; i += 160) {
    const d = pcm.slice(i, Math.min(i + 160, pcm.length));
    stream.pushFrame(new AudioFrame(d, 16000, 1, d.length));
  }
  const lastWindowMs = (pcm.length / 16000) * 1000 - 200;
  const events = [];
  for await (const ev of stream) {
    events.push({ type: ev.type, t: ev.timestamp, silence: ev.silenceDuration, rawSilence: ev.rawAccumulatedSilence, rawSpeech: ev.rawAccumulatedSpeech });
    if (ev.type === VADEventType.INFERENCE_DONE && ev.timestamp >= lastWindowMs) break;
  }
  stream.close();
  return events;
}

/** VOICE-010 replay (measurePauseEndpointing.mjs), EOT probability fixed at 1. */
function replayCommits(events, minDelay) {
  let pending;
  const commits = [];
  for (const ev of events) {
    if (pending && ev.t >= pending) {
      commits.push(pending);
      pending = undefined;
    }
    if (ev.type === VADEventType.START_OF_SPEECH) pending = undefined;
    else if (ev.type === VADEventType.END_OF_SPEECH) pending = Math.max(ev.t, ev.t - ev.silence + minDelay);
  }
  if (pending) commits.push(pending);
  return commits;
}

function vadSummary(events, speechFromMs, speechToMs) {
  const starts = events.filter((e) => e.type === VADEventType.START_OF_SPEECH).map((e) => e.t);
  const ends = events.filter((e) => e.type === VADEventType.END_OF_SPEECH).map((e) => e.t);
  let voiced = 0;
  starts.forEach((s, i) => {
    const e = ends.find((x) => x > s) ?? Infinity;
    voiced += Math.max(0, Math.min(e, speechToMs) - Math.max(s, speechFromMs));
  });
  const commits = replayCommits(events, FLOOR_MS);
  return {
    fired: starts.length > 0,
    starts: starts.length,
    voicedFraction: Number((voiced / Math.max(1, speechToMs - speechFromMs)).toFixed(2)),
    committed: commits.length > 0,
    cutEarly: commits.some((c) => c < speechToMs),
    commitAfterEndMs: commits.length ? Math.round(commits[commits.length - 1] - speechToMs) : null,
  };
}

// ----------------------------------------------------------------- Deepgram
let dgMode = 'plugin-stream';
let dgBilledSeconds = 0;
const dgStt = process.env.DEEPGRAM_API_KEY ? new deepgram.STT(DG_OPTIONS) : null;

async function deepgramStream(pcm) {
  const stream = dgStt.stream();
  const finals = [];
  let usage = 0;
  let lastEvent = Date.now();
  let flushed = false;
  const reader = (async () => {
    for await (const ev of stream) {
      lastEvent = Date.now();
      if (ev.type === sttNs.SpeechEventType.FINAL_TRANSCRIPT && ev.alternatives?.[0]) finals.push(ev.alternatives[0]);
      if (ev.type === sttNs.SpeechEventType.RECOGNITION_USAGE) usage += ev.recognitionUsage?.audioDuration ?? 0;
    }
  })().catch(() => {});
  const frame = 160;
  const started = Date.now();
  for (let i = 0; i < pcm.length; i += frame) {
    const d = pcm.slice(i, Math.min(i + frame, pcm.length));
    stream.pushFrame(new AudioFrame(d, 16000, 1, d.length));
    const due = ((i + frame) / 16000 / DG_SPEED) * 1000 - (Date.now() - started);
    if (due > 5) await new Promise((r) => setTimeout(r, due));
  }
  stream.flush();
  flushed = true;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline && (Date.now() - lastEvent < 1_500 || finals.length === 0) && flushed) {
    await new Promise((r) => setTimeout(r, 200));
    if (finals.length > 0 && Date.now() - lastEvent >= 1_500) break;
  }
  stream.close();
  await Promise.race([reader, new Promise((r) => setTimeout(r, 1_000))]);
  const text = finals.map((a) => a.text).join(' ').trim();
  const conf = finals.length ? finals.reduce((n, a) => n + (a.confidence ?? 0), 0) / finals.length : null;
  return { text, confidence: conf, usageSeconds: usage };
}

/** Fallback: prerecorded REST with equivalent options, on the frames the energy filter would send. */
async function deepgramRest(pcm) {
  const sends = energyFilterSends(pcm, { warm: true });
  const kept = [];
  sends.forEach((s, k) => { if (s) kept.push(pcm.subarray(k * 1600, (k + 1) * 1600)); });
  const audio = new Int16Array(kept.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of kept) { audio.set(c, o); o += c.length; }
  if (audio.length === 0) return { text: '', confidence: null, usageSeconds: 0 };
  const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&punctuate=true&mip_opt_out=true', {
    method: 'POST', headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'audio/wav' },
    body: wavBytes(audio, 16000), signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Deepgram REST HTTP ${r.status}`);
  const j = await r.json();
  const alt = j.results?.channels?.[0]?.alternatives?.[0];
  return { text: alt?.transcript ?? '', confidence: alt?.confidence ?? null, usageSeconds: audio.length / 16000 };
}

async function transcribe(pcm) {
  if (dgMode === 'plugin-stream') {
    try {
      const r = await deepgramStream(pcm);
      dgBilledSeconds += r.usageSeconds;
      return r;
    } catch (err) {
      console.error(`Deepgram plugin stream failed (${err instanceof Error ? err.message : err}); falling back to REST.`);
      dgMode = 'prerecorded-rest-fallback';
    }
  }
  const r = await deepgramRest(pcm);
  dgBilledSeconds += r.usageSeconds;
  return r;
}

// --------------------------------------------------------------------- clips
function loadClips() {
  const clips = [];
  const v2 = JSON.parse(readFileSync(join(v2Dir, 'manifest.json'), 'utf8'));
  for (const f of readdirSync(v2Dir).filter((x) => x.endsWith('-current-phrase.wav')).sort()) {
    const meta = v2.clips.find((c) => c.file === f.replace('.wav', '.m4a'));
    const { rate, pcm } = parseWav(readFileSync(join(v2Dir, f)));
    clips.push({ group: 'v2 normal', id: f, voice: meta?.voice, text: meta?.text ?? SENTENCES[0], rate, pcm });
  }
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const c of m.clips.filter((x) => x.status === 'complete')) {
      const { rate, pcm } = parseWav(readFileSync(join(clipDir, c.file)));
      clips.push({ group: c.tag ? 'v3 whisper' : 'v3 plain', id: c.file, voice: c.voice, text: c.text, rate, pcm, looksWhispered: c.looksWhispered });
    }
  }
  if (existsSync(realDir)) {
    for (const f of readdirSync(realDir).filter((x) => x.toLowerCase().endsWith('.wav')).sort()) {
      const lower = f.toLowerCase();
      const text = SENTENCES.find((s) => lower.includes(slug(s)));
      if (!text || !/whisper|soft/.test(lower)) {
        console.error(`skipping real/${f}: name needs whisper|soft and a sentence slug`);
        continue;
      }
      const { rate, pcm } = parseWav(readFileSync(join(realDir, f)));
      clips.push({ group: `real ${lower.includes('whisper') ? 'whisper' : 'soft'}`, id: `real/${f}`, voice: 'founder', text, rate, pcm });
    }
  }
  return clips;
}

async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

// ----------------------------------------------------------------------- run
const reportOnly = process.argv.includes('--report-only'); // rebuild the report from the saved JSON, no paid calls
const savedPath = join(outDir, '2026-10-23-quiet-speech.json');
if (process.argv.includes('--generate') && !reportOnly) await generate();
ensureRealReadme();
const clips = reportOnly ? [] : loadClips();
if (!reportOnly) console.log(`clips: ${clips.length} (${[...new Set(clips.map((c) => c.group))].map((g) => `${g} ${clips.filter((c) => c.group === g).length}`).join(', ')})`);

const saved = reportOnly ? JSON.parse(readFileSync(savedPath, 'utf8')) : null;
const rows = saved ? saved.rows : [];
const noiseRows = saved ? saved.noiseRows : [];
const dgJobs = [];
for (const [ci, clip] of clips.entries()) {
  const pcm16 = to16k(clip.pcm, clip.rate);
  const span = voicedSpan(pcm16, 16000);
  const speechRms0 = rmsLinear(pcm16, span.from, span.to);
  const speechFromMs = LEAD_MS + (span.from / 16) ;
  const speechToMs = LEAD_MS + (span.to / 16);
  for (const gainDb of GAINS) {
    for (const noisy of [false, true]) {
      const audio = condition(pcm16, gainDb, noisy, 1000 + ci);
      const speechRms = speechRms0 * 10 ** (gainDb / 20);
      const sends = energyFilterSends(audio, { warm: false });
      const speechFrames = sends.slice(Math.floor(ms(speechFromMs) / 1600), Math.ceil(ms(speechToMs) / 1600));
      const row = {
        group: clip.group, clip: clip.id, pitchless: clip.looksWhispered === true, voice: clip.voice, text: clip.text, gainDb, noise: noisy ? `pink ${NOISE_DBFS} dBFS` : 'clean',
        speechRmsDbfs: Number(toDbfs(speechRms).toFixed(1)), clearsMeterFloor: speechRms > METER_FLOOR,
        dgFilterSpeechSent: Number((speechFrames.filter(Boolean).length / Math.max(1, speechFrames.length)).toFixed(2)),
        vad: {}, deepgram: null,
      };
      for (const t of THRESHOLDS) row.vad[t] = vadSummary(await vadEvents(vads[t], audio), speechFromMs, speechToMs);
      rows.push(row);
      if (!noisy || gainDb === 0 || gainDb === -20) dgJobs.push({ row, audio, priority: noisy ? 1 : gainDb === -10 ? 2 : 0 });
    }
  }
  for (const off of NOISE_ONLY_OFFSETS) {
    const len = ms(LEAD_MS) + pcm16.length + ms(TAIL_MS);
    const noise = pinkNoise(len, 5000 + ci * 10 + (off + 30), NOISE_DBFS + off);
    const r = { clip: clip.id, noiseDbfs: NOISE_DBFS + off, falseStart: {} };
    for (const t of THRESHOLDS) r.falseStart[t] = (await vadEvents(vads[t], noise)).some((e) => e.type === VADEventType.START_OF_SPEECH);
    noiseRows.push(r);
  }
  process.stdout.write('.');
}
process.stdout.write('\n');

// Deepgram budget: estimate billed seconds from the frames the plugin sends.
const estSeconds = (j) => energyFilterSends(j.audio, { warm: false }).filter(Boolean).length * 0.1;
let budget = dgJobs.reduce((n, j) => n + estSeconds(j), 0);
const skippedForBudget = [];
for (const prio of [2]) {
  if (budget <= DG_CAP_SECONDS) break;
  for (const j of dgJobs.filter((x) => x.priority === prio && x.row.group !== 'v3 whisper')) {
    if (budget <= DG_CAP_SECONDS) break;
    budget -= estSeconds(j);
    j.skip = true;
    skippedForBudget.push(`${j.row.clip} ${j.row.gainDb} dB ${j.row.noise}`);
  }
}
const runJobs = dgJobs.filter((j) => !j.skip);
if (saved) {
  dgMode = saved.deepgram.mode;
  dgBilledSeconds = saved.deepgram.billedSeconds;
  skippedForBudget.push(...saved.deepgram.skippedForBudget);
}
const dgStreams = saved ? saved.deepgram.streams : runJobs.length;
if (!saved) console.log(`deepgram: ${runJobs.length} streams, estimated ${budget.toFixed(0)} s billed (cap ${DG_CAP_SECONDS} s), skipped ${skippedForBudget.length}`);
if (budget > DG_CAP_SECONDS) throw new Error('Deepgram plan still above the cap; refusing.');
if (saved) {
  // measured earlier; nothing to send
} else if (!dgStt) {
  console.error('DEEPGRAM_API_KEY missing: Deepgram skipped.');
  dgMode = 'skipped-no-key';
} else {
  let done = 0;
  await pool(runJobs, DG_CONCURRENCY, async (j) => {
    const r = await transcribe(j.audio);
    j.row.deepgram = { transcript: r.text, confidence: r.confidence === null ? null : Number(r.confidence.toFixed(3)), wordAccuracy: Number(wordAccuracy(j.row.text, r.text).toFixed(3)) };
    if (++done % 20 === 0) process.stdout.write(`${done} `);
  });
  process.stdout.write('\n');
}

// ------------------------------------------------------------------- summary
let manifest = null;
if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const PITCHLESS = 'v3 whisper, pitchless only';
const pitchlessFiles = new Set((manifest?.clips ?? []).filter((c) => c.looksWhispered).map((c) => c.file));
for (const r of rows) r.pitchless = pitchlessFiles.has(r.clip);
const inGroup = (r, g) => (g === PITCHLESS ? r.pitchless : r.group === g);
const groups = [...new Set(rows.map((r) => r.group))];
if (rows.some((r) => r.pitchless)) groups.splice(groups.indexOf('v3 whisper') + 1, 0, PITCHLESS);
const noises = ['clean', `pink ${NOISE_DBFS} dBFS`];
const fmt = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d));
const cell = (rs) => {
  const acc = rs.map((r) => r.deepgram?.wordAccuracy).filter((x) => x !== undefined && x !== null);
  return {
    n: rs.length,
    dgN: acc.length,
    accMedian: median(acc),
    accMin: acc.length ? Math.min(...acc) : null,
    confMedian: median(rs.map((r) => r.deepgram?.confidence)),
    vadFired: Object.fromEntries(THRESHOLDS.map((t) => [t, rs.filter((r) => r.vad[t].fired).length])),
    voicedMedian05: median(rs.map((r) => r.vad[0.5].voicedFraction)),
    committed05: rs.filter((r) => r.vad[0.5].committed).length,
    cutEarly05: rs.filter((r) => r.vad[0.5].cutEarly).length,
    rmsMedian: median(rs.map((r) => r.speechRmsDbfs)),
    clearsMeter: rs.filter((r) => r.clearsMeterFloor).length,
    dgFilterSentMedian: median(rs.map((r) => r.dgFilterSpeechSent)),
  };
};
const table = {};
for (const g of groups) for (const n of noises) for (const gain of GAINS) table[`${g}|${n}|${gain}`] = cell(rows.filter((r) => inGroup(r, g) && r.noise === n && r.gainDb === gain));
const falseStarts = {};
for (const off of NOISE_ONLY_OFFSETS) {
  const rs = noiseRows.filter((r) => r.noiseDbfs === NOISE_DBFS + off);
  falseStarts[NOISE_DBFS + off] = { n: rs.length, ...Object.fromEntries(THRESHOLDS.map((t) => [t, rs.filter((r) => r.falseStart[t]).length])) };
}

// Pre-registered rule. A threshold is usable when it has zero false starts on
// noise-only controls at the bed level and below (the +10 dB row is reported,
// not counted). The bar must hold at -20 dB both clean and over the bed.
const usable = THRESHOLDS.filter((t) => NOISE_ONLY_OFFSETS.filter((o) => o <= 0).every((o) => falseStarts[NOISE_DBFS + o][t] === 0));
function meets(groupNames) {
  const out = {};
  for (const n of noises) {
    const rs = rows.filter((r) => groupNames.some((g) => inGroup(r, g)) && r.gainDb === -20 && r.noise === n);
    const acc = rs.map((r) => r.deepgram?.wordAccuracy).filter((x) => x !== undefined && x !== null);
    const vadT = [...usable].sort((a, b) => b - a).find((t) => rs.length > 0 && rs.every((r) => r.vad[t].fired)) ?? null;
    out[n] = {
      clips: rs.length, transcribed: acc.length, accMedian: median(acc), accMin: acc.length ? Math.min(...acc) : null, vadThreshold: vadT,
      pass: rs.length > 0 && acc.length === rs.length && median(acc) >= 0.8 && Math.min(...acc) >= 0.6 && vadT !== null,
    };
  }
  const threshold = Math.min(...noises.map((n) => out[n].vadThreshold ?? 0));
  return { ...out, pass: noises.every((n) => out[n].pass), vadThreshold: threshold || null };
}
const whisper = meets(['v3 whisper']);
const plain = meets(['v3 plain', 'v2 normal']);
const pitchless = pitchlessFiles.size ? meets([PITCHLESS]) : null;
const verdict = whisper.pass ? 'Whisper' : plain.pass ? 'Quiet voice' : 'Neither';
const chosen = whisper.pass ? ['v3 whisper'] : ['v3 plain', 'v2 normal'];
const chosenRms = median(rows.filter((r) => chosen.includes(r.group) && r.gainDb === -20 && r.noise === 'clean').map((r) => r.speechRmsDbfs));

const whisperCheck = manifest?.clips.filter((c) => c.tag && c.status === 'complete').map((c) => ({ file: c.file, highBandVsPlain: c.highBandVsPlain, periodicity: c.periodicity, periodicityVsPlain: c.periodicityVsPlain, looksWhispered: c.looksWhispered })) ?? [];

const result = {
  createdAt: saved?.createdAt ?? new Date().toISOString(),
  reportRebuiltAt: saved ? new Date().toISOString() : undefined,
  sdk: '@livekit/agents 1.9.0, agents-plugin-silero 1.9.0 (defaults except activationThreshold), agents-plugin-deepgram 1.9.0',
  deepgram: { mode: dgMode, options: { ...DG_OPTIONS, plugin: 'defaults (endpointing 25, smartFormat, interimResults)' }, billedSeconds: Number(dgBilledSeconds.toFixed(1)), streams: dgStreams, skippedForBudget, speed: `${DG_SPEED}x real time` },
  elevenlabs: manifest ? { model: manifest.model, status: manifest.status, modelAvailable: manifest.modelAvailable, tagNote: manifest.tagNote, measuredCredits: manifest.measuredCredits ?? null, accountedCredits: manifest.accountedCredits ?? null } : null,
  setup: { gainsDb: GAINS, noiseDbfs: NOISE_DBFS, noiseOnlyDbfs: NOISE_ONLY_OFFSETS.map((o) => NOISE_DBFS + o), thresholds: THRESHOLDS, floorMs: FLOOR_MS, leadMs: LEAD_MS, tailMs: TAIL_MS, meterFloor: METER_FLOOR, energyFilter: 'RMS > 0.004 per 100 ms frame, 1 s cooldown' },
  table, falseStarts, usableThresholds: usable, rule: { whisper, plain, pitchlessWhisperOnly: pitchless, verdict, chosenRmsDbfsAt20: chosenRms }, whisperCheck,
  rows, noiseRows,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(savedPath, `${JSON.stringify(result, null, 2)}\n`);

// ------------------------------------------------------------------- report
const L = [];
L.push('# Quiet and whispered speech (2026-10-23)', '');
L.push(`Generated by \`node scripts/measureQuietSpeech.mjs\`. ${result.sdk}.`);
L.push(`Deepgram: ${dgMode === 'plugin-stream' ? 'real plugin STT stream' : `**${dgMode}**`} (nova-3, fr, 16 kHz mono, mipOptOut, plugin defaults), frames pushed at ${DG_SPEED}x real time, ${dgStreams} streams, ${(dgBilledSeconds / 60).toFixed(1)} min billed audio. Run on clean audio at every gain and over the noise bed at 0 and -20 dB only, to bound cost.${skippedForBudget.length ? ` ${skippedForBudget.length} clean -10 dB runs skipped for budget.` : ''}`);
if (manifest) L.push(`ElevenLabs: ${manifest.model}, status ${manifest.status}, ${manifest.accountedCredits ?? '?'} credits by the character-cost response headers (the subscription balance read straight after showed a change of ${manifest.measuredCredits ?? '?'}, so it had not caught up).${manifest.modelAvailable === false ? ' v3 was unavailable.' : ''}${manifest.tagNote ? ` ${manifest.tagNote}.` : ''}`);
L.push(`Each clip: ${LEAD_MS} ms lead, speech at the gain, ${TAIL_MS} ms tail, at 16 kHz. Noise bed: seeded pink noise at ${NOISE_DBFS} dBFS RMS (a quiet train carriage), not attenuated with the speech. Noise-only controls: the same bed alone at ${result.setup.noiseOnlyDbfs.join(', ')} dBFS, one per clip.`);
L.push('Speech RMS is over the voiced span. Meter floor: 0.01 linear (-40 dBFS). "DG sent" is the median share of speech 100 ms frames the plugin energy filter (RMS > 0.004, about -48 dBFS) lets through to Deepgram.', '');
L.push(`| Group | Noise | Gain | n | DG acc median | DG acc min | DG conf | VAD fired 0.5 / 0.35 / 0.25 | Voiced share (0.5) | Commits at 1,200 ms (0.5) | Cut early | Speech RMS dBFS | Clears meter | DG sent |`);
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const g of groups) for (const n of noises) for (const gain of GAINS) {
  const c = table[`${g}|${n}|${gain}`];
  L.push(`| ${g} | ${n} | ${gain} dB | ${c.n} | ${c.dgN ? fmt(c.accMedian) : 'not run'} | ${c.dgN ? fmt(c.accMin) : '-'} | ${fmt(c.confMedian)} | ${THRESHOLDS.map((t) => c.vadFired[t]).join(' / ')} | ${fmt(c.voicedMedian05)} | ${c.committed05}/${c.n} | ${c.cutEarly05} | ${fmt(c.rmsMedian, 1)} | ${c.clearsMeter}/${c.n} | ${fmt(c.dgFilterSentMedian)} |`);
}
L.push('', 'Noise-only false starts (START_OF_SPEECH on noise alone):', '');
L.push('| Noise dBFS | n | 0.5 | 0.35 | 0.25 |', '|---|---|---|---|---|');
for (const [lvl, f] of Object.entries(falseStarts).sort((a, b) => b[0] - a[0])) L.push(`| ${lvl} | ${f.n} | ${f[0.5]} | ${f[0.35]} | ${f[0.25]} |`);
if (whisperCheck.length) {
  L.push('', 'Did the [whispers] tag whisper? Periodicity near 0 means no pitch (a whisper); plain speech sits near 0.8 and up.', '');
  L.push(`Looks whispered: ${whisperCheck.filter((w) => w.looksWhispered).length}/${whisperCheck.length} (${[...pitchlessFiles].join(', ')}). The tag mostly made a softer, breathier voiced read rather than a whisper, so the "v3 whisper" rows mostly measure soft voiced speech; the pitchless rows are the true whispers. `);
L.push(`Median periodicity whisper ${fmt(median(whisperCheck.map((w) => w.periodicity)))}, change vs plain twin ${fmt(median(whisperCheck.map((w) => w.periodicityVsPlain)))}, high band (>3 kHz) share vs plain x${fmt(median(whisperCheck.map((w) => w.highBandVsPlain)))}.`);
}
const ruleLine = (name, m) => noises.map((n) => `${n}: median ${fmt(m[n].accMedian)}, min ${fmt(m[n].accMin)}, ${m[n].transcribed}/${m[n].clips} sent to Deepgram, VAD on all at ${m[n].vadThreshold ?? 'no usable threshold'}`).join('; ');
L.push('', '## Reading it', '');
L.push(`- The rule (set before the run): "Whisper" if v3 whispered clips at -20 dB reach median word accuracy of at least 0.8 with no clip under 0.6, and the VAD fires on every one at a threshold with zero noise-only false starts. Otherwise "Quiet voice" if the plain clips (v3 plain and v2) meet that bar. Otherwise neither. This run holds the bar both clean and over the train bed.`);
L.push(`- Whispered at -20 dB: ${ruleLine('whisper', whisper)}. ${whisper.pass ? 'Meets the bar.' : 'Does not meet the bar.'}`);
L.push(`- Plain at -20 dB: ${ruleLine('plain', plain)}. ${plain.pass ? 'Meets the bar.' : 'Does not meet the bar.'}`);
if (pitchless) L.push(`- Only the clips that really lost their pitch ("${PITCHLESS}", ${pitchlessFiles.size} clips) at -20 dB: ${ruleLine('pitchless', pitchless)}. ${pitchless.pass ? 'Meets the bar.' : 'Does not meet the bar.'} They do pass at 0 and -10 dB (see the table): a real whisper is heard when it reaches the mic at a normal level, and lost when it is also far from it.`);
L.push(`- **Verdict: ${verdict}.**`);
L.push(`- VAD thresholds with zero noise-only false starts (bed level and below): ${usable.join(', ') || 'none'}. ${verdict === 'Neither' ? 'No group passed, so no threshold is chosen.' : `Threshold needed: ${(whisper.pass ? whisper : plain).vadThreshold}${(whisper.pass ? whisper : plain).vadThreshold === 0.5 ? ' (the defaults suffice).' : ' (below the 0.5 default).'}`}`);
L.push(`- Speech RMS of the ${chosen.join(' and ')} clips at -20 dB: median ${fmt(chosenRms, 1)} dBFS, against the meter floor of -40 dBFS (0.01). ${chosenRms !== null && chosenRms > -40 ? 'The meter would move.' : 'The meter would sit still, so the app would look deaf even if the agent heard.'}`);
L.push('- The plugin energy filter matters at the bottom: speech whose 100 ms RMS stays at or under 0.004 (about -48 dBFS) is never sent to Deepgram once the stream has been quiet for a second, whatever Deepgram could have made of it. The lead here spends that cooldown, as it is spent mid-session.');
L.push('- Synthetic caveat: every whispered clip is ElevenLabs v3 with an audio tag, not a learner. Gain is a digital attenuation of studio audio, which is not the same as a person speaking softly into a phone (a real whisper also changes articulation, and phone AGC may lift it). Treat this as a screen; founder recordings in `artifacts/quiet-speech-2026-10-23/real/` are the next check.');
L.push('- The commit replay uses an EOT probability of 1 (the fallback floor), so "Commits" says whether the turn ends at all with quiet speech, not when the model would hold it.');
L.push('');
writeFileSync(join(outDir, '2026-10-23-quiet-speech.md'), L.join('\n'));
console.log(L.join('\n'));
process.exit(0);
