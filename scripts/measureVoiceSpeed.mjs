/** One approved, capped measurement: what does the ElevenLabs `speed` setting do to the tutor's
 * pace, to the credits billed, and to how well Deepgram can still read the audio back?
 * Dev-only. Never imported by the app.
 *
 * Voice alexandre, two lines (a café lesson tutor line and a conversation-length line), four
 * conditions: eleven_multilingual_v2 at speed 1.0, 0.9 and 0.85, and eleven_flash_v2_5 at 0.9.
 * Speed 1.0 is sent explicitly so the only variable between rows is the value.
 *
 * Dry run (prints the plan, no network):
 *   node --experimental-strip-types scripts/measureVoiceSpeed.mjs
 * Spend (8 ElevenLabs requests, 8 Deepgram prerecorded requests):
 *   node --experimental-strip-types --env-file=services/tutor-agent/.env scripts/measureVoiceSpeed.mjs --generate
 * Continue a stopped run (never re-bills a saved clip; an uncertain request is never retried):
 *   ... --generate --resume
 * Reprint the summary from the saved JSON, no network:
 *   node --experimental-strip-types scripts/measureVoiceSpeed.mjs --report-only
 *
 * Keys come from process.env (ELEVEN_API_KEY, DEEPGRAM_API_KEY). Nothing but the cost header of
 * a response is ever written down.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS, STREAMING_LATENCY, OUTPUT_ENCODING } from '../services/tutor-agent/src/voiceConfiguration.ts';
import { CAFE_LESSON } from '../packages/core/src/lessons/cafe.ts';
import { wordAccuracy, median } from './quietSpeechHelpers.mjs';

export const CAP = 1000;
export const HEADROOM = 500;
export const SAMPLE_RATE = 22050;
export const VOICE = 'alexandre';
export const FLASH = 'eleven_flash_v2_5';
export const DESTINATION = resolve('/Users/pravz_07/Developer/StartUps/listening/voice-speed-2026-10-25');
export const EVIDENCE = resolve('docs/cogs-evidence/voice-speed-2026-10-25.json');
export const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&mip_opt_out=true';

/** The tutor's own longest scripted café line, imported from the lesson rather than retyped. */
const cafeTurn = CAFE_LESSON.turns.find(t => t.id === 't4-repeat');
if (!cafeTurn) throw new Error('Café lesson turn t4-repeat is gone; pick another tutor line.');
export const LINES = [
  { key: 'cafe', text: cafeTurn.tutor },
  { key: 'conversation', text: "D'accord, alors vous prenez un café et un croissant. Vous voulez autre chose avec ça ?" },
];
export const CONDITIONS = [
  { model: MODEL, speed: 1.0 },
  { model: MODEL, speed: 0.9 },
  { model: MODEL, speed: 0.85 },
  { model: FLASH, speed: 0.9 },
];
/** Flash is billed at half a credit per character; alexandre carries no voice multiplier. */
export const RATE = { [MODEL]: 1, [FLASH]: 0.5 };

const chars = text => [...text].length;
const speedTag = s => String(s).replace('.', 'p');
export const clipName = (line, c) => `${line.key}-${c.model === FLASH ? 'flash' : 'v2'}-speed-${speedTag(c.speed)}`;

/** Every request in order: line, then condition. */
export function buildPlan() {
  return LINES.flatMap(line => CONDITIONS.map(c => ({
    name: clipName(line, c), line: line.key, text: line.text, model: c.model, speed: c.speed,
    chars: chars(line.text), estimate: Math.ceil(chars(line.text) * RATE[c.model]), file: `${clipName(line, c)}.wav`,
  })));
}
export const estimateTotal = plan => plan.reduce((n, p) => n + p.estimate, 0);

/** 44-byte RIFF header plus 16-bit mono PCM. */
export function wavFromPcm(pcm, sampleRate = SAMPLE_RATE) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Derived numbers for one clip, from PCM bytes and the billed credits. */
export function clipStats({ bytes, chars: n, credits }) {
  const seconds = bytes / 2 / SAMPLE_RATE;
  return {
    bytes, seconds: Number(seconds.toFixed(3)), charsPerSecond: Number((n / seconds).toFixed(2)),
    creditsPerChar: Number.isFinite(credits) ? Number((credits / n).toFixed(3)) : null,
  };
}

/** Per condition: median chars/second, pace relative to speed 1.0 on v2, credits, and Deepgram accuracy. */
export function summarise(clips) {
  const done = clips.filter(c => c.status === 'complete');
  const by = new Map();
  for (const c of done) {
    const k = `${c.model}@${c.speed}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(c);
  }
  const rows = [...by.entries()].map(([condition, cs]) => ({
    condition, model: cs[0].model, speed: cs[0].speed, clips: cs.length,
    totalChars: cs.reduce((n, c) => n + c.chars, 0), totalSeconds: Number(cs.reduce((n, c) => n + c.seconds, 0).toFixed(2)),
    credits: cs.some(c => !Number.isFinite(c.credits)) ? null : cs.reduce((n, c) => n + c.credits, 0),
    medianCharsPerSecond: median(cs.map(c => c.charsPerSecond)),
    medianWordAccuracy: median(cs.map(c => c.deepgram?.wordAccuracy)),
  }));
  const base = rows.find(r => r.model === MODEL && r.speed === 1);
  for (const r of rows) {
    r.paceVsNormal = base && r.totalChars && base.totalChars
      ? Number(((r.totalChars / r.totalSeconds) / (base.totalChars / base.totalSeconds)).toFixed(3)) : null;
    r.creditsPerChar = r.credits === null ? null : Number((r.credits / r.totalChars).toFixed(3));
  }
  return rows;
}

export function formatSummary(rows) {
  const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d));
  const out = ['condition                          clips  chars/s  pace vs 1.0  credits/char  Deepgram word accuracy (median)'];
  for (const r of rows) out.push(`${r.condition.padEnd(34)} ${String(r.clips).padStart(5)}  ${f(r.medianCharsPerSecond).padStart(7)}  ${f(r.paceVsNormal, 3).padStart(11)}  ${f(r.creditsPerChar, 3).padStart(12)}  ${f(r.medianWordAccuracy, 3)}`);
  return out.join('\n');
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A tiny listening page, built from the manifest, grouped by condition. */
export function buildHtml(clips) {
  const groups = new Map();
  for (const c of clips.filter(x => x.status === 'complete')) {
    const k = `${c.model} at speed ${c.speed}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const sections = [...groups.entries()].map(([k, cs]) => `<section><h2>${esc(k)}</h2>\n${cs.map(c => `<p lang="fr">${esc(c.text)} <small>(${c.seconds.toFixed(1)} s)</small></p><audio controls preload="none" src="${esc(c.file)}"></audio>`).join('\n')}</section>`);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Voice speed check, ${esc(VOICE)}</title>\n<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:16px auto;padding:0 16px}audio{display:block;width:100%;margin:4px 0 12px}</style></head>\n<body><h1>Voice speed check (${esc(VOICE)})</h1>\n${sections.join('\n')}\n</body></html>\n`;
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
function writeJson(path, value) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

async function main(argv) {
  if (argv.includes('--report-only')) {
    if (!existsSync(EVIDENCE)) throw new Error(`No evidence at ${EVIDENCE}.`);
    const saved = readJson(EVIDENCE);
    console.log(formatSummary(summarise(saved.clips)));
    console.log(JSON.stringify({ status: saved.status, creditsFromHeaders: saved.creditsFromHeaders, measuredCreditsFromBalance: saved.measuredCredits, before: saved.before, after: saved.after ?? null }));
    return;
  }

  const plan = buildPlan();
  const estimatedCredits = estimateTotal(plan);
  if (estimatedCredits > CAP) throw new Error(`Plan estimate ${estimatedCredits} exceeds the approved cap of ${CAP}.`);
  console.log(JSON.stringify({
    requests: plan.length, elevenlabs: plan.length, deepgramPrerecorded: plan.length, estimatedCredits, cap: CAP,
    headroomRequired: estimatedCredits + HEADROOM, voice: VOICE, voiceId: ELEVEN_VOICES[VOICE], settings: VOICE_SETTINGS,
    conditions: CONDITIONS, lines: LINES, destination: DESTINATION, evidence: EVIDENCE,
    clips: plan.map(p => ({ name: p.name, model: p.model, speed: p.speed, chars: p.chars, estimate: p.estimate })),
  }, null, 2));
  if (!argv.includes('--generate')) { console.log('Dry run: nothing sent. Add --generate to spend.'); return; }

  const resume = argv.includes('--resume');
  const manifestPath = resolve(DESTINATION, 'manifest.json');
  if (existsSync(manifestPath) && !resume) throw new Error('Manifest already exists. No automatic retry or regeneration is allowed; use --resume to continue.');
  if (resume && !existsSync(manifestPath)) throw new Error('No experiment to resume.');
  if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is missing.');
  if (!process.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY is missing.');

  const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
  const subscription = async () => {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Subscription HTTP ${response.status}; generation stopped.`);
    const s = await response.json();
    if (![s.character_count, s.character_limit].every(Number.isFinite)) throw new Error('Credit balance unavailable.');
    return { tier: s.tier, used: s.character_count, limit: s.character_limit };
  };

  mkdirSync(DESTINATION, { recursive: true });
  mkdirSync(resolve(EVIDENCE, '..'), { recursive: true });
  let manifest;
  if (resume) {
    manifest = readJson(manifestPath);
    if (manifest.cap !== CAP || JSON.stringify(manifest.settings) !== JSON.stringify(VOICE_SETTINGS)
      || JSON.stringify(manifest.clips.map(c => [c.name, c.text, c.model, c.speed])) !== JSON.stringify(plan.map(c => [c.name, c.text, c.model, c.speed]))) {
      throw new Error('Experiment settings changed.');
    }
    manifest.status = 'running'; delete manifest.reason;
  } else {
    const before = await subscription();
    if (before.limit - before.used < estimatedCredits + HEADROOM) throw new Error(`Insufficient credit headroom: ${before.limit - before.used} left, need ${estimatedCredits + HEADROOM}.`);
    manifest = {
      createdAt: new Date().toISOString(), cap: CAP, estimatedCredits, before, voice: VOICE, voiceId: ELEVEN_VOICES[VOICE],
      settings: VOICE_SETTINGS, format: OUTPUT_ENCODING, streamingLatency: STREAMING_LATENCY,
      note: 'speed is sent explicitly on every request, 1.0 included. Deepgram: nova-3 fr smart_format, prerecorded REST.',
      clips: plan.map(p => ({ ...p, status: 'pending' })), status: 'running',
    };
  }
  const checkpoint = () => { writeJson(manifestPath, manifest); writeJson(EVIDENCE, evidenceOf(manifest)); };
  checkpoint();

  const accountedOf = () => manifest.clips.reduce((n, c) => n + (c.status === 'complete' ? (Number.isFinite(c.credits) ? c.credits : c.estimate) : c.status === 'pending' ? c.estimate : 0), 0);
  try {
    for (const clip of manifest.clips) {
      if (clip.status === 'complete') {
        if (!existsSync(resolve(DESTINATION, clip.file))) throw new Error(`Saved clip ${clip.name} is missing its file; do not regenerate automatically.`);
        continue;
      }
      if (clip.sent) throw new Error(`Uncertain earlier request for ${clip.name}; do not regenerate automatically.`);
      if (accountedOf() > CAP) throw new Error('Credit guard reached; no further request sent.');
      clip.sent = true;
      checkpoint(); // Recorded before the billed request, including timeout and crash cases.
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICES[VOICE]}?output_format=${OUTPUT_ENCODING}&optimize_streaming_latency=${STREAMING_LATENCY}`, {
        method: 'POST', headers, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ text: clip.text, model_id: clip.model, voice_settings: { ...VOICE_SETTINGS, speed: clip.speed } }),
      });
      if (!response.ok) throw new Error(`Synthesis HTTP ${response.status} for ${clip.name}; no retry.`);
      const pcm = Buffer.from(await response.arrayBuffer());
      if (pcm.length < 2205 || pcm.length % 2 !== 0) throw new Error(`Invalid PCM result for ${clip.name}; no retry.`);
      writeFileSync(resolve(DESTINATION, clip.file), wavFromPcm(pcm));
      const costName = ['character-cost', 'x-character-count'].find(name => response.headers.get(name) !== null) ?? null;
      const cost = costName ? Number(response.headers.get(costName)) : null;
      const credits = Number.isFinite(cost) && cost >= 0 ? cost : null;
      Object.assign(clip, { status: 'complete', credits, costHeader: costName, ...clipStats({ bytes: pcm.length, chars: clip.chars, credits }) });
      checkpoint();
      console.log(JSON.stringify({ clip: clip.name, costHeader: costName, credits, estimated: clip.estimate, seconds: clip.seconds, charsPerSecond: clip.charsPerSecond }));
    }
    manifest.after = await subscription();
    manifest.measuredCredits = manifest.after.used - manifest.before.used;
    checkpoint();

    // Deepgram: one prerecorded request per clip, never retried. Cheap, and independent of the TTS spend.
    for (const clip of manifest.clips) {
      if (clip.deepgram) continue;
      const response = await fetch(DEEPGRAM_URL, {
        method: 'POST', headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'audio/wav' },
        body: readFileSync(resolve(DESTINATION, clip.file)), signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`Deepgram HTTP ${response.status} for ${clip.name}; no retry (resume to continue).`);
      const alt = (await response.json()).results?.channels?.[0]?.alternatives?.[0];
      const transcript = alt?.transcript ?? '';
      clip.deepgram = { transcript, confidence: alt?.confidence ?? null, wordAccuracy: Number(wordAccuracy(clip.text, transcript).toFixed(3)) };
      checkpoint();
    }
    manifest.status = 'complete';
    checkpoint();
    writeFileSync(resolve(DESTINATION, 'index.html'), buildHtml(manifest.clips));
    console.log(formatSummary(summarise(manifest.clips)));
    console.log(JSON.stringify({ status: manifest.status, creditsFromHeaders: creditsFromHeaders(manifest), headersMissing: manifest.clips.filter(c => c.credits === null).length, estimatedCredits, measuredCreditsFromBalance: manifest.measuredCredits, evidence: EVIDENCE }));
  } catch (error) {
    manifest.status = 'stopped';
    manifest.reason = error.message;
    checkpoint();
    throw error;
  }
}

const creditsFromHeaders = m => m.clips.reduce((n, c) => n + (c.credits ?? 0), 0);

/** The committed evidence: the manifest plus the summary. No keys, no headers beyond the cost one. */
function evidenceOf(manifest) {
  return { ...manifest, creditsFromHeaders: creditsFromHeaders(manifest), summary: summarise(manifest.clips) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
