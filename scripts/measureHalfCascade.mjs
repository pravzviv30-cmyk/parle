/** Spike: does a "half-cascade" brain (OpenAI Realtime hearing the learner's AUDIO, answering
 * in TEXT, ElevenLabs still speaking) reach the spoken reply sooner than the tuned text cascade?
 * Makes real API calls on synthetic clips. A latency measurement, not a quality proof.
 * node --experimental-strip-types scripts/measureHalfCascade.mjs <tutor .env file> <report.json>
 *   [--reps 1] [--clips name,name] [--max-usd 1] [--model gpt-realtime-2.1]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { summarise } from './liveTurnMilestones.mjs';
import { parseWav } from './quietSpeechHelpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS_DIR = join(ROOT, 'artifacts/multi-stt-2026-11-06');
const MISSION = 'mission:premier-cafe';
export const IN_RATE = 22_050;
export const OUT_RATE = 24_000;
export const CHUNK_MS = 100;
export const CLIP_TIMEOUT_MS = 30_000;
/** Approximate list prices (USD per million tokens), used only for the --max-usd spend cap. */
export const PRICE_PER_M = { audioIn: 32, textIn: 4, textOut: 16 };
export const SPIKE_PARAGRAPH = "You hear the learner's audio directly. Answer with ONLY the JSON object the contract describes; write `sceneReply` first.";
export const REFERENCE = 'Tuned cascade reference (2026-11-07): Flux end of turn p50 699 ms + brain spoken fields p50 937 ms on priority ≈ 1,636 ms from end of speech.';

const USAGE = `Usage: node --experimental-strip-types scripts/measureHalfCascade.mjs <tutor .env file> <report.json>
  [--reps 1] [--clips name,name] [--max-usd 1] [--model gpt-realtime-2.1]`;
const VALUE_FLAGS = new Set(['reps', 'clips', 'max-usd', 'model']);

/** Linear-interpolation resample of PCM16 samples. */
export function resample(pcm, from, to) {
  const length = Math.round((pcm.length * to) / from);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const x = (i * from) / to;
    const j = Math.floor(x);
    const a = pcm[Math.min(j, pcm.length - 1)], b = pcm[Math.min(j + 1, pcm.length - 1)];
    out[i] = Math.round(a + (b - a) * (x - j));
  }
  return out;
}

/** The `sceneReply.fr` string once it has closed in the streamed text, else null. */
export function closedSceneReplyFr(text) {
  const m = /"sceneReply"\s*:\s*\{[^}]*?"fr"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (!m) return null;
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
}

/** Approximate USD for a Realtime `response.usage`; audio input tokens are priced as audio. */
export function usdFor(usage) {
  if (!usage) return 0;
  const input = usage.input_tokens ?? 0, output = usage.output_tokens ?? 0;
  const audio = usage.input_token_details?.audio_tokens ?? 0;
  return (audio * PRICE_PER_M.audioIn + Math.max(0, input - audio) * PRICE_PER_M.textIn + output * PRICE_PER_M.textOut) / 1e6;
}

/** Which café beat a clip's line belongs to. */
export function beatFor(text) {
  if (/sur place|outside/i.test(text)) return 'say-where';
  if (/combien|addition|how much/i.test(text)) return 'pay';
  return 'greet-and-order';
}

export function readWav(path) {
  return parseWav(readFileSync(path));
}

function parseArgs(argv) {
  const positional = [], flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (VALUE_FLAGS.has(name) && argv[i + 1] !== undefined) { flags[name] = argv[i + 1]; i += 1; }
    else { console.error(`Unknown or incomplete flag: ${arg}\n${USAGE}`); process.exit(2); }
  }
  return { positional, flags };
}

// Same seeds as measureLiveTurn.mjs for the café beats.
const SEEDS = {
  'greet-and-order': [],
  'say-where': [['user', 'Bonjour, je voudrais un café, s’il vous plaît.'], ['assistant', 'Karim: Sur place ou à emporter ?']],
  pay: [['user', 'Sur place, merci.'], ['assistant', 'Karim: Ça fait deux euros. Par carte ou en espèces ?']],
};
const LEARNER = { cefr: 'A1', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null };

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const [envFile, reportFile] = positional;
  if (!envFile || !reportFile) { console.error(USAGE); process.exit(2); }
  const reps = Number(flags.reps ?? 1), maxUsd = Number(flags['max-usd'] ?? 1), model = flags.model ?? 'gpt-realtime-2.1';
  if (!Number.isInteger(reps) || reps < 1 || !Number.isFinite(maxUsd) || maxUsd <= 0) { console.error('--reps must be a whole number of 1 or more and --max-usd a positive number.'); process.exit(2); }
  const apiKey = parseEnv(readFileSync(envFile, 'utf8')).OPENAI_API_KEY;
  if (!apiKey) throw new Error('The environment file has no OPENAI_API_KEY.');

  const manifest = JSON.parse(readFileSync(join(CLIPS_DIR, 'manifest.json'), 'utf8'));
  const wanted = flags.clips ? flags.clips.split(',') : null;
  const unknown = (wanted ?? []).filter(n => !manifest.clips.some(c => c.name === n));
  if (unknown.length) { console.error(`Unknown clips: ${unknown.join(', ')}`); process.exit(2); }
  const clips = manifest.clips.filter(c => !wanted || wanted.includes(c.name));

  const { tutorSessionBrief } = await import('@luvani/core');
  const { createConversation, prepareTurn } = await import('../packages/brain/src/engine/conversation.ts');
  const { missionFrame } = await import('../packages/brain/src/missions/frames.ts');
  const WebSocket = createRequire(join(ROOT, 'services/tutor-agent/package.json'))('ws');

  function requestFor(clip) {
    const beat = beatFor(clip.text);
    const frame = missionFrame(MISSION);
    let state = createConversation(frame, LEARNER, { strictness: 'balanced', maxTurns: 24, mission: true, missionId: MISSION });
    const index = frame.beats.findIndex(b => b.id === beat);
    if (index > 0 || SEEDS[beat].length) {
      state = { ...state, currentBeat: beat, beatStatus: Object.fromEntries(frame.beats.map((b, i) => [b.id, i < index ? 'done' : 'pending'])),
        history: SEEDS[beat].map(([role, text]) => ({ role, text })) };
    }
    const prepared = prepareTurn(state, { type: 'spoke', text: clip.text });
    // The learner's words arrive as audio, so the text learner message (second to last) is dropped.
    const messages = prepared.messages.filter((_, i) => i !== prepared.messages.length - 2);
    const brief = tutorSessionBrief({ missionId: MISSION, seeded: false });
    return { beat, instructions: [prepared.system.persona, prepared.system.pack, prepared.system.contract, SPIKE_PARAGRAPH].join('\n\n'),
      messages: [...messages, { role: 'system', text: brief }] };
  }

  function runClip(clip) {
    const { instructions, messages } = requestFor(clip);
    const { rate, pcm } = readWav(join(CLIPS_DIR, 'accented', clip.file));
    const audio = resample(pcm, rate || IN_RATE, OUT_RATE);
    return new Promise((resolve) => {
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const row = { firstTextMs: null, spokenMs: null, doneMs: null, text: '', usage: null, error: null };
      let start = null, settled = false;
      const finish = (error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) row.error = error; try { ws.close(); } catch {} resolve(row); };
      const timer = setTimeout(() => finish('timeout'), CLIP_TIMEOUT_MS);
      const send = (event) => ws.send(JSON.stringify(event));
      ws.on('error', (e) => finish(`socket: ${String(e?.message).slice(0, 200)}`));
      ws.on('close', () => finish(row.doneMs === null ? 'closed early' : null));
      ws.on('message', (data) => {
        let event; try { event = JSON.parse(String(data)); } catch { return; }
        const now = () => Math.round(performance.now() - start);
        if (event.type === 'session.created') {
          send({ type: 'session.update', session: { type: 'realtime', output_modalities: ['text'], instructions,
            audio: { input: { format: { type: 'audio/pcm', rate: OUT_RATE }, turn_detection: null } } } });
        } else if (event.type === 'session.updated' && start === null) {
          for (const m of messages) {
            const role = m.role;
            const type = role === 'assistant' ? 'output_text' : 'input_text';
            send({ type: 'conversation.item.create', item: { type: 'message', role, content: [{ type, text: m.text }] } });
          }
          const step = (OUT_RATE * CHUNK_MS) / 1000;
          for (let i = 0; i < audio.length; i += step) {
            const part = audio.subarray(i, i + step);
            send({ type: 'input_audio_buffer.append', audio: Buffer.from(part.buffer, part.byteOffset, part.byteLength).toString('base64') });
          }
          send({ type: 'input_audio_buffer.commit' });
          start = performance.now();
          send({ type: 'response.create', response: { output_modalities: ['text'] } });
        } else if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          row.firstTextMs ??= now();
          row.text += event.delta;
          if (row.spokenMs === null && closedSceneReplyFr(row.text) !== null) row.spokenMs = now();
        } else if (event.type === 'response.done') {
          row.doneMs = now();
          row.usage = event.response?.usage ?? null;
          const status = event.response?.status;
          finish(status && status !== 'completed' ? `response ${status}` : null);
        } else if (event.type === 'error') {
          finish(`api: ${String(event.error?.message ?? event.error?.code).slice(0, 200)}`);
        }
      });
    });
  }

  const rows = []; let totalUsd = 0, stopped = null;
  const fmt = v => (v === null || v === undefined ? '  n/a' : String(v).padStart(5));
  const report = () => {
    const ok = rows.filter(r => !r.error);
    const summary = Object.fromEntries(['scene reply', 'English answer'].map(kind => {
      const s = summarise(ok.filter(r => r.kind === kind).map(r => r.spokenMs));
      return [kind, { n: s.n, spokenP50: s.p50, spokenP95: s.p95 }];
    }));
    return { generatedAt: new Date().toISOString(), model, syntheticOnly: true, stopped, clips: rows, summary,
      totalUsd: Number(totalUsd.toFixed(5)), priceNote: 'Approximate list prices, for the spend cap only.', reference: REFERENCE };
  };
  console.log(`${clips.length} clips x ${reps} reps on ${model}, spend cap $${maxUsd}`);
  outer: for (let rep = 1; rep <= reps; rep += 1) {
    for (const clip of clips) {
      const r = await runClip(clip);
      const usd = usdFor(r.usage);
      totalUsd += usd;
      let parsed = null; try { parsed = JSON.parse(r.text); } catch {}
      const fr = parsed?.sceneReply?.fr ?? closedSceneReplyFr(r.text);
      const row = { name: clip.name, rep, kind: clip.kind, truth: clip.text, firstTextMs: r.firstTextMs, spokenMs: r.spokenMs, doneMs: r.doneMs,
        text: r.text, usage: r.usage, usd: Number(usd.toFixed(6)), ...(r.error ? { error: r.error } : {}) };
      if (clip.kind === 'English answer') row.handedBackInFrench = Boolean(parsed?.sceneReply?.fr) && Boolean(parsed?.coachLine);
      rows.push(row);
      console.log(`${clip.name.slice(0, 34).padEnd(34)} ${clip.kind.padEnd(14)} first=${fmt(r.firstTextMs)} spoken=${fmt(r.spokenMs)} done=${fmt(r.doneMs)} ${r.error ? `ERROR ${r.error}` : (fr ?? '').slice(0, 60)}`);
      writeFileSync(reportFile, JSON.stringify(report(), null, 2));
      if (totalUsd >= maxUsd) { stopped = `Stopped: estimated spend $${totalUsd.toFixed(4)} reached --max-usd ${maxUsd}.`; break outer; }
    }
  }
  const final = report();
  writeFileSync(reportFile, JSON.stringify(final, null, 2));
  if (stopped) console.log(stopped);
  console.log(`\nspoken ms (sceneReply.fr closed, from commit)   n    p50    p95`);
  for (const [kind, s] of Object.entries(final.summary)) console.log(`${kind.padEnd(46)}${String(s.n).padStart(3)} ${fmt(s.spokenP50)}  ${fmt(s.spokenP95)}`);
  console.log(`est. spend $${final.totalUsd}`);
  console.log(REFERENCE);
  if (stopped || rows.some(r => r.error)) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
