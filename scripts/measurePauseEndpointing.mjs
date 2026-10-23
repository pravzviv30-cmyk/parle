#!/usr/bin/env node
/**
 * Measures what a mid-sentence pause does to the end of a learner's turn
 * (VOICE-009). Dev-only, offline, no paid calls.
 *
 * For each French phrase recorded in artifacts/voice-comparison-2026-09-19/
 * it cuts the sentence at the quietest point near its middle, splices in a
 * silence of 0.5, 1.0, 1.5 or 2.0 s, and runs the clip through:
 *
 *   - the real Silero VAD the tutor agent loads (plugin defaults, the same
 *     `silero.VAD.load()` call as agent.ts), fed at the file's 22.05 kHz so
 *     the plugin resamples exactly as it does in a room;
 *   - the real local `turn-detector-v1-mini` through @livekit/local-inference,
 *     called the way the SDK's LocalTransport calls it: once the VAD has seen
 *     200 ms of silence while speaking, on the last 1.2 s of 16 kHz audio.
 *
 * It then replays SDK 1.9's commit rule (voice/audio_recognition.js,
 * bounceEOUTask): on END_OF_SPEECH the wait is maxDelay when the EOT
 * probability is under the language threshold, else minDelay, measured from
 * the last voiced frame; the turn commits at max(END_OF_SPEECH, last voiced +
 * wait) unless START_OF_SPEECH arrives first. It assumes Deepgram's final has
 * landed by then (endpointing 25 ms), which is the case the plan cares about.
 *
 * Usage: node scripts/measurePauseEndpointing.mjs [--out docs/live-latency-evidence]
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const agentRequire = createRequire(join(root, 'services/tutor-agent/package.json'));
const load = async (name) => import(pathToFileURL(agentRequire.resolve(name)).href);

const agents = await load('@livekit/agents');
agents.initializeLogger({ pretty: false, level: 'error' });
const silero = await load('@livekit/agents-plugin-silero');
const { AudioFrame, AudioResampler, AudioResamplerQuality } = await load('@livekit/rtc-node');
const { VADEventType } = agents;

const outIdx = process.argv.indexOf('--out');
const outDir = resolve(root, outIdx > 0 ? process.argv[outIdx + 1] : 'docs/live-latency-evidence');
const clipsDir = join(root, 'artifacts/voice-comparison-2026-09-19');

const FR_THRESHOLD = 0.285; // inference/eot/languages.js, fr
const MAX_DELAY = 2_500; // streaming default the SDK applies with a detector
const EOT_SILENCE_MS = 200; // inference/eot/base.js MIN_SILENCE_DURATION_MS
const EOT_WINDOW = 19_200; // 1.2 s at 16 kHz, transports.js CLIENT_BUFFER_SECONDS
const PAUSES_MS = [500, 1000, 1500, 2000];
const LEAD_MS = 300;
const TAIL_MS = 3_000;

const CONFIGS = [
  { name: 'today', minDelay: 400 },
  { name: 'v009-beginner', minDelay: 1200 },
  { name: 'v009-1-cutoff', minDelay: 1600 },
  { name: 'v009-cap', minDelay: 2000 },
  { name: 'v009-moment-hold', minDelay: 2500 },
];

// ---- local EOT model --------------------------------------------------------
let eot = null;
let eotError = null;
try {
  const require = createRequire(import.meta.url);
  eot = require(join(root, 'node_modules/@livekit/local-inference'));
  eot.initEot();
} catch (err) {
  eotError = err instanceof Error ? err.message : String(err);
  eot = null;
}

// ---- audio helpers ----------------------------------------------------------
function readWav(path) {
  const buf = readFileSync(path);
  let off = 12;
  let rate = 0;
  let data = null;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
    if (id === 'data') data = new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size));
    off += 8 + size + (size % 2);
  }
  return { rate, pcm: data };
}

/** Cut point: quietest 20 ms window in the middle 35-65 % of the voiced span. */
function cutPoint(pcm, rate) {
  const win = Math.round(rate * 0.02);
  const rms = [];
  for (let i = 0; i + win <= pcm.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += pcm[j] * pcm[j];
    rms.push(Math.sqrt(s / win));
  }
  const peak = Math.max(...rms);
  const voiced = rms.map((r, i) => (r > peak * 0.05 ? i : -1)).filter((i) => i >= 0);
  const first = voiced[0];
  const last = voiced[voiced.length - 1];
  const lo = Math.round(first + (last - first) * 0.35);
  const hi = Math.round(first + (last - first) * 0.65);
  let best = lo;
  for (let i = lo; i <= hi; i++) if (rms[i] < rms[best]) best = i;
  return { at: best * win + Math.round(win / 2), fraction: (best - first) / (last - first) };
}

function splice(pcm, rate, cut, pauseMs) {
  const z = (ms) => new Int16Array(Math.round((rate * ms) / 1000));
  const parts = [z(LEAD_MS), pcm.subarray(0, cut), z(pauseMs), pcm.subarray(cut), z(TAIL_MS)];
  const out = new Int16Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function to16k(pcm, rate) {
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

// ---- VAD run ----------------------------------------------------------------
const vad = await silero.VAD.load();

async function vadEvents(pcm, rate) {
  const stream = vad.stream();
  const step = Math.round(rate / 100); // 10 ms frames, like a room track
  for (let i = 0; i < pcm.length; i += step) {
    const d = pcm.slice(i, Math.min(i + step, pcm.length));
    stream.pushFrame(new AudioFrame(d, rate, 1, d.length));
  }
  // endInput() throws in 1.9 (the writer is still locked), so stop once the
  // window near the end has been scored instead. The resampler holds a few ms
  // back, and the 3 s silent tail makes the last 200 ms irrelevant.
  const lastWindowMs = (pcm.length / rate) * 1000 - 200;
  const events = [];
  for await (const ev of stream) {
    events.push({
      type: ev.type,
      t: ev.timestamp,
      silence: ev.silenceDuration,
      rawSilence: ev.rawAccumulatedSilence,
      rawSpeech: ev.rawAccumulatedSpeech,
    });
    if (ev.type === VADEventType.INFERENCE_DONE && ev.timestamp >= lastWindowMs) break;
  }
  stream.close();
  return events;
}

/**
 * Replays the SDK's commit rule on one clip. Returns the first commit (if any)
 * and whether it landed inside the spliced pause, i.e. cut the sentence.
 */
function replay(events, eotAt, minDelay) {
  let speaking = false;
  let lastSpeaking;
  let pendingProb;
  let pending; // { commitAt }
  const commits = [];
  for (const ev of events) {
    if (pending && ev.t >= pending.commitAt) {
      commits.push(pending.commitAt);
      pending = undefined;
    }
    if (ev.type === VADEventType.START_OF_SPEECH) {
      speaking = true;
      pending = undefined; // bounceEOUTask cancelled
      pendingProb = undefined;
    } else if (ev.type === VADEventType.INFERENCE_DONE) {
      if (ev.rawSpeech > 0) {
        lastSpeaking = ev.t;
        pendingProb = undefined;
      }
      if (ev.rawSilence >= EOT_SILENCE_MS && speaking && pendingProb === undefined) {
        pendingProb = eotAt(ev.t);
      }
    } else if (ev.type === VADEventType.END_OF_SPEECH) {
      speaking = false;
      lastSpeaking = ev.t - ev.silence;
      const prob = pendingProb ?? 1;
      const wait = prob < FR_THRESHOLD ? MAX_DELAY : minDelay;
      pending = { commitAt: Math.max(ev.t, lastSpeaking + wait), prob, lastSpeaking };
      commits.lastPending = pending;
    }
  }
  if (pending) commits.push(pending.commitAt);
  return commits;
}

// ---- run --------------------------------------------------------------------
const files = readdirSync(clipsDir).filter((f) => f.endsWith('-current-phrase.wav')).sort();
const manifest = JSON.parse(readFileSync(join(clipsDir, 'manifest.json'), 'utf8'));
const textFor = (f) => manifest.clips.find((c) => c.file === f.replace('.wav', '.m4a'))?.text ?? '?';

const rows = [];
for (const file of files) {
  const { rate, pcm } = readWav(join(clipsDir, file));
  const cut = cutPoint(pcm, rate);
  for (const pauseMs of PAUSES_MS) {
    const clip = splice(pcm, rate, cut.at, pauseMs);
    const pcm16 = to16k(clip, rate);
    const events = await vadEvents(clip, rate);
    const pauseStart = LEAD_MS + (cut.at / rate) * 1000;
    const pauseEnd = pauseStart + pauseMs;
    const speechEnd = (clip.length / rate) * 1000 - TAIL_MS;

    // First pass: find the moments the SDK would ask the model, and ask it.
    const probs = [];
    replay(events, (t) => {
      const end = Math.min(pcm16.length, Math.round((t / 1000) * 16000));
      const window = pcm16.slice(Math.max(0, end - EOT_WINDOW), end);
      probs.push({ t, p: eot ? eot.predict(window) : Promise.resolve(1) });
      return 1;
    }, 400);
    for (const r of probs) r.p = await r.p;
    const probAt = (t) => probs.find((r) => r.t === t)?.p ?? 1;

    const ends = events.filter((e) => e.type === VADEventType.END_OF_SPEECH).map((e) => e.t);
    const midEnd = ends.find((t) => t > pauseStart && t < pauseEnd + 200);
    const midProbRec = probs.find((r) => r.t > pauseStart && r.t < pauseEnd);
    const finalProbRec = probs.find((r) => r.t > speechEnd);

    const outcome = {};
    for (const cfg of CONFIGS) {
      for (const detector of ['eot', 'fallback-1.0']) {
        const commits = replay(events, (t) => (detector === 'eot' ? probAt(t) : 1), cfg.minDelay);
        const cutOff = commits.some((c) => c > pauseStart && c < pauseEnd + 100);
        const finalCommit = commits.find((c) => c >= speechEnd);
        outcome[`${cfg.name}/${detector}`] = {
          cutOff,
          commitsMs: commits.map((c) => Math.round(c)),
          finalLatencyMs: finalCommit === undefined ? null : Math.round(finalCommit - speechEnd),
        };
      }
    }
    rows.push({
      file,
      text: textFor(file),
      cutFraction: Number(cut.fraction.toFixed(2)),
      pauseMs,
      pauseStartMs: Math.round(pauseStart),
      vadEndOfSpeechInPauseMs: midEnd === undefined ? null : Math.round(midEnd - pauseStart),
      eotProbInPause: midProbRec ? Number(midProbRec.p.toFixed(3)) : null,
      eotProbAtEnd: finalProbRec ? Number(finalProbRec.p.toFixed(3)) : null,
      outcome,
    });
    process.stdout.write('.');
  }
}
process.stdout.write('\n');

// ---- summary ----------------------------------------------------------------
const keys = Object.keys(rows[0].outcome);
const summary = {};
for (const pauseMs of PAUSES_MS) {
  const rs = rows.filter((r) => r.pauseMs === pauseMs);
  summary[pauseMs] = {
    clips: rs.length,
    vadEndedInPause: rs.filter((r) => r.vadEndOfSpeechInPauseMs !== null).length,
    vadEndAfterPauseStartMs: rs.map((r) => r.vadEndOfSpeechInPauseMs),
    eotProbInPause: rs.map((r) => r.eotProbInPause),
    eotBelowThresholdInPause: rs.filter((r) => r.eotProbInPause !== null && r.eotProbInPause < FR_THRESHOLD).length,
    cutOffs: Object.fromEntries(keys.map((k) => [k, rs.filter((r) => r.outcome[k].cutOff).length])),
  };
}
const latency = {};
for (const k of keys) {
  const v = rows.map((r) => r.outcome[k].finalLatencyMs).filter((x) => x !== null).sort((a, b) => a - b);
  latency[k] = { p50: v[Math.floor(v.length / 2)], max: v[v.length - 1], n: v.length };
}

const result = {
  createdAt: new Date().toISOString(),
  sdk: '@livekit/agents 1.9.0, agents-plugin-silero 1.9.0 defaults, @livekit/local-inference turn-detector-v1-mini',
  eotModel: eot ? 'loaded' : `unavailable: ${eotError}`,
  frThreshold: FR_THRESHOLD,
  maxDelayMs: MAX_DELAY,
  pausesMs: PAUSES_MS,
  summary,
  finalTurnLatencyMs: latency,
  rows,
};

mkdirSync(outDir, { recursive: true });
const stamp = result.createdAt.slice(0, 10);
writeFileSync(join(outDir, `${stamp}-pause-endpointing.json`), JSON.stringify(result, null, 2) + '\n');

const lines = [];
lines.push(`# Mid-sentence pause endpointing (${stamp})`, '');
lines.push(`Generated by \`node scripts/measurePauseEndpointing.mjs\`. ${result.sdk}. EOT model: ${result.eotModel}.`);
lines.push(`${files.length} French phrases (ElevenLabs multilingual_v2 clips), cut at the quietest point in the middle third.`, '');
lines.push('Cut-offs: clips whose turn committed inside the pause (out of ' + files.length + ').', '');
lines.push('| Pause | VAD ended in pause | EOT p in pause (fr 0.285) | ' + keys.join(' | ') + ' |');
lines.push('|---|---|---|' + keys.map(() => '---').join('|') + '|');
for (const p of PAUSES_MS) {
  const s = summary[p];
  lines.push(
    `| ${p} ms | ${s.vadEndedInPause}/${s.clips} | ${s.eotProbInPause.map((x) => (x === null ? '-' : x.toFixed(2))).join(', ')} | ` +
      keys.map((k) => s.cutOffs[k]).join(' | ') +
      ' |',
  );
}
lines.push('', 'Commit latency after the sentence really ends (ms after the last voiced audio, all clips):', '');
lines.push('| Config | p50 | max |', '|---|---|---|');
for (const k of keys) lines.push(`| ${k} | ${latency[k].p50} | ${latency[k].max} |`);
lines.push('', '## Reading it', '');
lines.push('- "today" is minDelay 400 with Silero defaults (minSilenceDuration 550), so the turn commits at the VAD end of speech, not 400 ms after it.');
lines.push('- "eot" uses the real local model; "fallback-1.0" is what a worker without the native binding or a job inference executor does (every prediction scores 1.0).');
lines.push('- Every clip is the same sentence in six ElevenLabs voices, not learners. Hesitant, accented beginner speech is likely to score differently, so treat the model columns as indicative and the fallback columns as the floor that has to hold on its own.');
lines.push('- Latency is measured from the end of the audio samples; Silero stops calling a frame voiced slightly before that, which is why today reads about 470 ms rather than 550.');
lines.push('');
writeFileSync(join(outDir, `${stamp}-pause-endpointing.md`), lines.join('\n'));
console.log(lines.join('\n'));
// The Silero session keeps handles open; nothing else is pending here.
process.exit(0);
