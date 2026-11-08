#!/usr/bin/env node
/**
 * How does Deepgram Flux end a learner's turn when they pause mid-sentence (F695's held end-of-turn
 * check)? Dev-only, never imported by the app. REAL Deepgram calls (cents): one real-time stream per run.
 *
 * Each French clip in artifacts/voice-comparison-2026-09-19/ (*-current-phrase.wav) is cut at its quietest
 * point near the middle, a silence of 0.5/1.0/1.5/2.0 s is spliced in, and the result streams through the
 * live STTv2 plugin (Flux). Per run: END_OF_SPEECH count (the plugin's EndOfTurn), whether one fired while
 * the pause was still playing (split), and the delay from the last voiced sample to the last one.
 *
 *   node --experimental-strip-types scripts/measureFluxEot.mjs [--pauses ms,ms] [--clips N] [--eot-threshold 0.7] [--out dir] [--dry-run]
 *
 * Needs DEEPGRAM_API_KEY: from the environment, else read from services/tutor-agent/.env. More than 48 runs
 * needs --force. Writes <out>/YYYY-MM-DD-flux-eot.json and .md (default out docs/live-latency-evidence).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clipsDir = join(root, 'artifacts/voice-comparison-2026-09-19');
export const FLUX_OPTIONS = { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, mipOptOut: true, numerals: false };
export const PAUSES_MS = [500, 1000, 1500, 2000];
export const LEAD_MS = 300;
export const TAIL_MS = 3_000;
export const MAX_RUNS = 48;
const SLACK_MS = 100;

export function parseArgs(argv) {
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const pauses = val('--pauses') ? val('--pauses').split(',').map(Number) : PAUSES_MS;
  if (pauses.some((p) => !(p > 0))) throw new Error('--pauses needs milliseconds, e.g. 1000,1500');
  return {
    pauses, clips: val('--clips') ? Number(val('--clips')) : undefined, eotThreshold: val('--eot-threshold'),
    out: val('--out') ?? 'docs/live-latency-evidence', dryRun: argv.includes('--dry-run'), force: argv.includes('--force'),
  };
}

export function readWav(path) {
  const buf = readFileSync(path);
  let off = 12, rate = 0, data = null;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
    if (id === 'data') data = new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size));
    off += 8 + size + (size % 2);
  }
  return { rate, pcm: data };
}

/** Quietest 20 ms window in the middle 35-65 % of the voiced span (as measurePauseEndpointing), plus where voice ends. */
export function cutPoint(pcm, rate) {
  const win = Math.round(rate * 0.02);
  const rms = [];
  for (let i = 0; i + win <= pcm.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += pcm[j] * pcm[j];
    rms.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...rms);
  const voiced = rms.map((r, i) => (r > peak * 0.05 ? i : -1)).filter((i) => i >= 0);
  const first = voiced[0], last = voiced[voiced.length - 1];
  let best = Math.round(first + (last - first) * 0.35);
  for (let i = best; i <= Math.round(first + (last - first) * 0.65); i++) if (rms[i] < rms[best]) best = i;
  return { at: best * win + Math.round(win / 2), voiceEnd: (last + 1) * win };
}

/** lead + first half + pause + second half + tail. layout marks (in samples) where the pause ends and the last voiced sample sits. */
export function splice(pcm, rate, cut, pauseMs) {
  const z = (ms) => new Int16Array(Math.round((rate * ms) / 1000));
  const parts = [z(LEAD_MS), pcm.subarray(0, cut.at), z(pauseMs), pcm.subarray(cut.at), z(TAIL_MS)];
  const out = new Int16Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  const resume = parts[0].length + cut.at + parts[2].length;
  return { pcm: out, resume, lastVoiced: resume + (cut.voiceEnd - cut.at) };
}

/** events: [{type, t (ms since first push), pushed (samples pushed at that moment)}]; resume in samples at `rate`; lastVoicedT in ms. */
export function analyse(events, { resume, rate, lastVoicedT }) {
  const ends = events.filter((e) => e.type === 'END_OF_SPEECH');
  const limit = resume + (rate * SLACK_MS) / 1000;
  // The delay is measured on the end of turn after the resume point; a split with no second one reports null.
  const last = ends.filter((e) => e.pushed >= limit).pop();
  return {
    endOfTurns: ends.length,
    splitInPause: ends.some((e) => e.pushed < limit),
    eotDelayMs: last ? Math.round(last.t - lastVoicedT) : null,
  };
}

export const nearestRank = (values, p) => {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.max(0, Math.ceil((p / 100) * v.length) - 1)] : null;
};

export function summarise(runs) {
  const row = (label, rs) => {
    const d = rs.map((r) => r.eotDelayMs);
    const splits = rs.filter((r) => r.splitInPause).length;
    return { pauseMs: label, runs: rs.length, splits, splitShare: rs.length ? Number((splits / rs.length).toFixed(2)) : 0, eotP50: nearestRank(d, 50), eotP95: nearestRank(d, 95) };
  };
  const pauses = [...new Set(runs.map((r) => r.pauseMs))].sort((a, b) => a - b);
  return [...pauses.map((p) => row(p, runs.filter((r) => r.pauseMs === p))), row('all', runs)];
}

export function plan(clips, pauses) {
  const runs = clips.length * pauses.length;
  const billedSeconds = clips.reduce((n, c) => n + pauses.reduce((m, p) => m + (LEAD_MS + p + TAIL_MS) / 1000 + c.seconds, 0), 0);
  return { clips: clips.map((c) => c.file), pauses, runs, billedSeconds: Number(billedSeconds.toFixed(1)) };
}

export function toMarkdown(date, summary, runs, options) {
  const cell = (v) => (v == null ? 'n/a' : v);
  const lines = [`# Flux end-of-turn on spliced pauses, ${date}`, '', `Options: ${JSON.stringify(options)}`, '',
    '| pause | runs | split | eot p50 | eot p95 |', '| --- | --- | --- | --- | --- |',
    ...summary.map((s) => `| ${s.pauseMs} | ${s.runs} | ${s.splits} (${Math.round(s.splitShare * 100)}%) | ${cell(s.eotP50)} | ${cell(s.eotP95)} |`),
    '', '| clip | pause | END_OF_SPEECH | split | eot ms | heard | said |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...runs.map((r) => `| ${r.file} | ${r.pauseMs} | ${r.endOfTurns} | ${r.splitInPause} | ${cell(r.eotDelayMs)} | ${r.heard} | ${r.text} |`)];
  return lines.join('\n') + '\n';
}

function loadClips(count) {
  const manifest = JSON.parse(readFileSync(join(clipsDir, 'manifest.json'), 'utf8'));
  const files = readdirSync(clipsDir).filter((f) => f.endsWith('-current-phrase.wav')).sort().slice(0, count);
  return files.map((file) => {
    const { rate, pcm } = readWav(join(clipsDir, file));
    return { file, rate, pcm, seconds: pcm.length / rate, text: manifest.clips.find((c) => c.file === file.replace('.wav', '.m4a'))?.text ?? '?' };
  });
}

function apiKey() {
  if (process.env.DEEPGRAM_API_KEY) return process.env.DEEPGRAM_API_KEY;
  const envFile = join(root, 'services/tutor-agent/.env');
  const m = existsSync(envFile) && readFileSync(envFile, 'utf8').match(/^DEEPGRAM_API_KEY=(.*)$/m);
  if (!m) throw new Error('DEEPGRAM_API_KEY is missing (env or services/tutor-agent/.env).');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function main(argv) {
  const flags = parseArgs(argv);
  const clips = loadClips(flags.clips);
  const p = plan(clips, flags.pauses);
  if (flags.dryRun) { console.log(JSON.stringify(p, null, 2)); return; }
  if (p.runs > MAX_RUNS && !flags.force) throw new Error(`${p.runs} runs is over ${MAX_RUNS}; pass --force.`);
  process.env.DEEPGRAM_API_KEY = apiKey();
  const agentRequire = createRequire(join(root, 'services/tutor-agent/package.json'));
  const load = async (name) => import(pathToFileURL(agentRequire.resolve(name)).href);
  const agents = await load('@livekit/agents');
  agents.initializeLogger({ pretty: false, level: 'error' });
  const deepgram = await load('@livekit/agents-plugin-deepgram');
  const { AudioFrame, AudioResampler, AudioResamplerQuality } = await load('@livekit/rtc-node');
  const Ev = agents.stt.SpeechEventType;
  const options = { ...FLUX_OPTIONS, ...(flags.eotThreshold ? { eotThreshold: Number(flags.eotThreshold) } : {}) };
  const stt = new deepgram.STTv2(options);

  const to16k = (pcm, rate) => {
    const r = new AudioResampler(rate, 16000, 1, AudioResamplerQuality.HIGH);
    const chunks = [];
    for (let i = 0; i < pcm.length; i += Math.round(rate / 100)) {
      const d = pcm.slice(i, i + Math.round(rate / 100));
      for (const f of r.push(new AudioFrame(d, rate, 1, d.length))) chunks.push(f.data);
    }
    for (const f of r.flush()) chunks.push(f.data);
    const out = new Int16Array(chunks.reduce((a, c) => a + c.length, 0));
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  };

  async function stream(pcm, lastVoiced) {
    const s = stt.stream();
    const events = [], finals = [];
    let pushed = 0, lastVoicedT = null, started = Date.now(), lastEvent = Date.now();
    const reader = (async () => {
      for await (const ev of s) {
        lastEvent = Date.now();
        const t = lastEvent - started;
        if (ev.type === Ev.START_OF_SPEECH || ev.type === Ev.END_OF_SPEECH) events.push({ type: Ev[ev.type], t, pushed });
        if (ev.type === Ev.FINAL_TRANSCRIPT && ev.alternatives?.[0]) finals.push(ev.alternatives[0].text);
      }
    })().catch(() => {});
    started = Date.now();
    for (let i = 0; i < pcm.length; i += 160) {
      const d = pcm.slice(i, i + 160);
      s.pushFrame(new AudioFrame(d, 16000, 1, d.length));
      pushed = i + d.length;
      if (lastVoicedT == null && pushed >= lastVoiced) lastVoicedT = Date.now() - started;
      const due = (pushed / 16000) * 1000 - (Date.now() - started);
      if (due > 5) await new Promise((r) => setTimeout(r, due));
    }
    s.flush();
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline && !(events.some((e) => e.type === 'END_OF_SPEECH') && Date.now() - lastEvent >= 1_000)) await new Promise((r) => setTimeout(r, 200));
    s.close();
    await Promise.race([reader, new Promise((r) => setTimeout(r, 1_000))]);
    return { events, finals, lastVoicedT };
  }

  const runs = [];
  for (const clip of clips) {
    const cut = cutPoint(clip.pcm, clip.rate);
    for (const pauseMs of flags.pauses) {
      const sp = splice(clip.pcm, clip.rate, cut, pauseMs);
      const k = 16000 / clip.rate;
      const { events, finals, lastVoicedT } = await stream(to16k(sp.pcm, clip.rate), Math.round(sp.lastVoiced * k));
      const a = analyse(events, { resume: Math.round(sp.resume * k), rate: 16000, lastVoicedT });
      runs.push({ file: clip.file, pauseMs, ...a, events, heard: finals.join(' ').trim(), text: clip.text });
      console.log(`${clip.file} ${pauseMs} ms: ${a.endOfTurns} EOS, split ${a.splitInPause}, eot ${a.eotDelayMs} ms, "${finals.join(' ').trim()}"`);
    }
  }
  const summary = summarise(runs);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = resolve(root, flags.out);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${date}-flux-eot.json`), JSON.stringify({ date, options, summary, runs }, null, 2));
  writeFileSync(join(outDir, `${date}-flux-eot.md`), toMarkdown(date, summary, runs, options));
  console.table(summary);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
