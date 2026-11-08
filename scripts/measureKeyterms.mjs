/** Do Deepgram keyterms help it hear a beginner say the café lesson lines? Dev-only, never imported by
 * the app.
 *
 * Clips: every café lesson `target`, said once by an ENGLISH-native ElevenLabs voice reading French
 * (a synthetic stand-in for an English accent: NOT real beginners), at normal level and at -20 dB;
 * plus any founder recordings in artifacts/quiet-speech-2026-10-23/real/ whose sentence is known.
 * Each clip goes through Deepgram nova-3 fr twice, without and with `lessonKeyterms(CAFE_LESSON)`.
 * Per clip and condition: transcript, word accuracy, exact target match.
 *
 * Dry run (prints the plan, no network):
 *   node --experimental-strip-types scripts/measureKeyterms.mjs
 * Synthesise the accented clips (ElevenLabs, capped, once; never re-bills a saved clip):
 *   node --experimental-strip-types --env-file=services/tutor-agent/.env scripts/measureKeyterms.mjs --generate
 * Run Deepgram over every clip (billed seconds, capped at 15 minutes):
 *   node --experimental-strip-types --env-file=services/tutor-agent/.env scripts/measureKeyterms.mjs --run
 * Does nova-3 `multi` (code-switching, endpointing 100) hear learner French as well as `fr`, and English
 * answers as English? Add `--conditions fr,multi` to any command above: lesson lines run fr, multi (both
 * with keyterms) and multi without keyterms; café scene replies and English answers run fr and multi
 * without keyterms. Evidence goes to docs/live-latency-evidence/<run date>-multi-stt.{json,md}.
 * Reprint the summary from the saved JSON, no network:
 *   node --experimental-strip-types scripts/measureKeyterms.mjs --report-only
 *
 * Keys come from process.env (ELEVEN_API_KEY, DEEPGRAM_API_KEY). The Deepgram call uses the real
 * @livekit/agents-plugin-deepgram stream with the live options, falling back to prerecorded REST.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS, STREAMING_LATENCY, OUTPUT_ENCODING } from '../services/tutor-agent/src/voiceConfiguration.ts';
import { recognitionPlan } from '../services/tutor-agent/src/recognitionPlan.ts';
import { CAFE_LESSON } from '../packages/core/src/lessons/cafe.ts';
import {
  applyGain, energyFilterSends, median, normaliseWords, parseWav, slug, wavBytes, wordAccuracy,
} from './quietSpeechHelpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CREDIT_CAP = 600;
export const HEADROOM = 500;
export const SAMPLE_RATE = 22050;
export const QUIET_DB = -20;
/** ElevenLabs premade voice "Chris" (en, American accent, conversational). Rachel's old id now names another voice. Verified by name at --generate. */
export const ENGLISH_VOICE = { id: 'iP95p4xoKVk53GoZ742B', expectedName: 'Chris' };
export const DG_CAP_SECONDS = 15 * 60;
export const DG_SPEED = 2; // push frames at 2x real time
export const DG_CONCURRENCY = 6;
export const DG_OPTIONS = { model: 'nova-3', language: 'fr', sampleRate: 16000, numChannels: 1, mipOptOut: true };
export const LEAD_MS = 1_100; // longer than the plugin's 1 s energy-filter cooldown, so speech meets a warm filter
export const TAIL_MS = 2_000;
export const SENTENCES = ['On échange nos numéros ?', "Je voudrais un café, s'il vous plaît.", 'Excusez-moi, où est la gare ?'];
/** A0-A1 café mission replies and stuck-beginner English answers, said by the same English voice. */
export const SCENE_REPLIES = [
  "Bonjour, je voudrais un café, s'il vous plaît.", 'Un croissant aussi.', "C'est combien ?", 'Sur place, merci.',
  "Non, c'est tout.", 'Je prends un thé.', "L'addition, s'il vous plaît.", 'Merci, bonne journée.',
];
export const ENGLISH_ANSWERS = [
  'A coffee please.', "I don't know how to say it.", 'How much is it?', 'Can I have a croissant too?',
  'I want to sit outside.', "No thanks, that's all.", 'What does that mean?', "Sorry, I didn't understand.",
];
export const LESSON = 'lesson line';
/** plain/keyterms: the 2026-10-25 comparison. fr/multi: the live lesson keeps keyterms on lesson lines only. */
export const CONDITIONS = {
  plain: { language: 'fr', keyterms: false },
  keyterms: { language: 'fr', keyterms: true },
  fr: { language: 'fr', keyterms: 'lesson' },
  multi: { language: 'multi', endpointing: 100, keyterms: 'lesson' },
  'multi-plain': { language: 'multi', endpointing: 100, keyterms: false },
  'multi-ep25': { language: 'multi', keyterms: 'lesson' },
  flux: { flux: true, keyterms: 'lesson' },
};
export const FLUX_OPTIONS = { ...recognitionPlan('lesson', 'fr', {}).options, mipOptOut: true };
const LEGACY = ['plain', 'keyterms'];

export function parseConditions(argv) {
  const i = argv.findIndex(a => a === '--conditions' || a.startsWith('--conditions='));
  if (i < 0) return [...LEGACY];
  const raw = argv[i].includes('=') ? argv[i].slice('--conditions='.length) : argv[i + 1];
  if (!raw || raw.startsWith('--')) throw new Error('--conditions needs a list, e.g. fr,multi');
  const list = [...new Set(raw.split(',').map(x => x.trim()).filter(Boolean))];
  const bad = list.filter(c => !CONDITIONS[c]);
  if (bad.length) throw new Error(`Unknown condition(s): ${bad.join(', ')}. Known: ${Object.keys(CONDITIONS).join(', ')}.`);
  if (list.some(c => LEGACY.includes(c)) && list.some(c => !LEGACY.includes(c))) throw new Error('Do not mix plain/keyterms with fr/multi conditions.');
  return list;
}
export const isMultiRun = conditions => !conditions.every(c => LEGACY.includes(c));

/** Plugin options for one condition and clip kind. Missions run no keyterms, so only lesson lines get them. */
export function conditionOptions(name, kind, keyterms) {
  const c = CONDITIONS[name];
  const useKeyterms = c.keyterms === true || (c.keyterms === 'lesson' && kind === LESSON);
  if (c.flux) return { ...FLUX_OPTIONS, ...(useKeyterms ? { keyterms: keyterms } : {}) };
  return { ...DG_OPTIONS, language: c.language, ...(c.endpointing ? { endpointing: c.endpointing } : {}), ...(useKeyterms ? { keyterm: keyterms } : {}) };
}
/** Lesson lines also get multi without keyterms, to separate the language change from the keyterms. */
export const conditionsFor = (kind, conditions) => (kind === LESSON && conditions.includes('multi') ? [...new Set([...conditions, 'multi-plain'])] : conditions);

export const CLIP_DIR = resolve(root, 'artifacts/keyterms-2026-10-25');
export const ACCENTED_DIR = join(CLIP_DIR, 'accented');
export const REAL_DIR = resolve(root, 'artifacts/quiet-speech-2026-10-23/real');
export const EVIDENCE = resolve(root, 'docs/live-latency-evidence/keyterms-2026-10-25.json');
export const MULTI_DIR = resolve(root, 'artifacts/multi-stt-2026-11-06');
const EVIDENCE_DIR = resolve(root, 'docs/live-latency-evidence');
export const RUN_DATE = new Date().toISOString().slice(0, 10);
export const MULTI_EVIDENCE = join(EVIDENCE_DIR, `${RUN_DATE}-multi-stt.json`);
/** The newest saved multi run, for --report-only. */
const latestMultiEvidence = () => join(EVIDENCE_DIR, readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('-multi-stt.json')).sort().at(-1) ?? `${RUN_DATE}-multi-stt.json`);
export const SYNTHETIC_NOTE = 'The accent is SYNTHETIC: an English-native ElevenLabs voice reading French text. It is a stand-in for an English accent, not real beginners, and says nothing about how real learners sound.';

const chars = text => [...text].length;

/** The lines under test: every café turn's `target`, in lesson order. */
export const targetsOf = lesson => lesson.turns.map(t => ({ id: t.id, text: t.target }));

/** Generation plan: one synthesis per target. Voice multiplier and model rate are both 1. */
export function buildPlan(lesson = CAFE_LESSON) {
  return targetsOf(lesson).map((t, i) => {
    const name = `t${String(i + 1).padStart(2, '0')}-${slug(t.text)}`;
    return { name, turn: t.id, text: t.text, chars: chars(t.text), estimate: chars(t.text), file: `${name}.wav`, quietFile: `${name}-m20db.wav` };
  });
}
/** The scene-reply and English-answer clips, saved apart so the lesson manifest never changes. */
export function buildExtraPlan() {
  const set = (kind, prefix, texts) => texts.map((text, i) => {
    const name = `${prefix}${String(i + 1).padStart(2, '0')}-${slug(text)}`;
    return { name, kind, text, chars: chars(text), estimate: chars(text), file: `${name}.wav`, quietFile: `${name}-m20db.wav` };
  });
  return [...set('scene reply', 's', SCENE_REPLIES), ...set('English answer', 'e', ENGLISH_ANSWERS)];
}
export const estimateTotal = plan => plan.reduce((n, p) => n + p.estimate, 0);

/** Same normalisation the accuracy helper uses, so accent and punctuation never count. */
export const exactMatch = (reference, hypothesis) => normaliseWords(reference).join(' ') === normaliseWords(hypothesis).join(' ');

/** Median accuracy, exact-match count and the keyterm gain, per group, level and condition. */
export function summarise(rows) {
  const keys = [...new Set(rows.map(r => `${r.group}|${r.level}`))];
  const out = keys.map(key => {
    const [group, level] = key.split('|');
    const mine = rows.filter(r => r.group === group && r.level === level);
    const cond = name => {
      const rs = mine.filter(r => r.condition === name);
      return {
        clips: rs.length,
        medianWordAccuracy: median(rs.map(r => r.wordAccuracy)),
        exactMatches: rs.filter(r => r.exact).length,
      };
    };
    const plain = cond('plain');
    const keyterms = cond('keyterms');
    return {
      group, level, plain, keyterms,
      medianAccuracyGain: plain.medianWordAccuracy === null || keyterms.medianWordAccuracy === null ? null : Number((keyterms.medianWordAccuracy - plain.medianWordAccuracy).toFixed(3)),
      exactGain: keyterms.exactMatches - plain.exactMatches,
    };
  });
  return out;
}

/** Mean word accuracy and exact matches per clip kind and condition, in first-seen order. */
export function summariseByKind(rows) {
  const keys = [...new Set(rows.map(r => `${r.kind}|${r.condition}`))];
  return keys.map(key => {
    const [kind, condition] = key.split('|');
    const rs = rows.filter(r => r.kind === kind && r.condition === condition);
    return { kind, condition, clips: rs.length, meanWordAccuracy: Number((rs.reduce((n, r) => n + r.wordAccuracy, 0) / rs.length).toFixed(3)), exactMatches: rs.filter(r => r.exact).length };
  });
}
export function formatByKind(summary) {
  return ['kind              condition    clips  mean acc  exact', ...summary.map(s => `${s.kind.padEnd(17)} ${s.condition.padEnd(11)} ${String(s.clips).padStart(6)}  ${s.meanWordAccuracy.toFixed(3).padStart(8)}  ${s.exactMatches}`)].join('\n');
}

export function formatSummary(summary) {
  const f = x => (x === null || x === undefined ? '-' : Number(x).toFixed(3));
  const lines = ['group / level                        condition  clips  median acc  exact'];
  for (const s of summary) {
    for (const c of ['plain', 'keyterms']) {
      lines.push(`${`${s.group} / ${s.level}`.padEnd(36)} ${c.padEnd(9)} ${String(s[c].clips).padStart(5)}  ${f(s[c].medianWordAccuracy).padStart(10)}  ${s[c].exactMatches}`);
    }
    lines.push(`${''.padEnd(36)} gain: median accuracy ${s.medianAccuracyGain === null ? '-' : (s.medianAccuracyGain >= 0 ? '+' : '') + s.medianAccuracyGain}, exact matches ${s.exactGain >= 0 ? '+' : ''}${s.exactGain}`);
  }
  return lines.join('\n');
}

/** Repeated, URL-encoded `keyterm` query parameters for Deepgram REST. */
export const keytermQuery = terms => terms.map(t => `&keyterm=${encodeURIComponent(t)}`).join('');

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Imported lazily: the module is added by another change, and only --run needs it. */
async function loadKeyterms() {
  let mod;
  try { mod = await import('../packages/core/src/lessons/keyterms.ts'); }
  catch (error) { throw new Error(`packages/core/src/lessons/keyterms.ts is not importable (${error.message}).`); }
  const terms = mod.lessonKeyterms(CAFE_LESSON);
  if (!Array.isArray(terms) || terms.length === 0 || !terms.every(t => typeof t === 'string' && t)) throw new Error('lessonKeyterms(CAFE_LESSON) did not return a non-empty string array.');
  return terms;
}

// ------------------------------------------------------------------ generate
async function generate(plan, dir = CLIP_DIR) {
  const accentedDir = join(dir, 'accented');
  const estimated = estimateTotal(plan);
  if (estimated > CREDIT_CAP) throw new Error(`Plan estimate ${estimated} exceeds the cap of ${CREDIT_CAP}.`);
  if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is missing.');
  const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
  const get = async path => {
    const r = await fetch(`https://api.elevenlabs.io${path}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Metadata HTTP ${r.status}; generation stopped.`);
    return r.json();
  };
  const subscription = async () => {
    const s = await get('/v1/user/subscription');
    if (![s.character_count, s.character_limit].every(Number.isFinite)) throw new Error('Credit balance unavailable.');
    return { tier: s.tier, used: s.character_count, limit: s.character_limit };
  };
  const manifestPath = join(dir, 'manifest.json');
  mkdirSync(accentedDir, { recursive: true });
  let manifest;
  if (existsSync(manifestPath)) {
    manifest = readJson(manifestPath);
    if (JSON.stringify(manifest.clips.map(c => [c.name, c.text])) !== JSON.stringify(plan.map(c => [c.name, c.text]))) throw new Error('Clip texts changed since the manifest was written.');
    manifest.status = 'running'; delete manifest.reason;
  } else {
    const voice = await get(`/v1/voices/${ENGLISH_VOICE.id}`);
    if (Number(voice.sharing?.rate ?? 1) !== 1) throw new Error(`Voice multiplier is ${voice.sharing.rate}, not 1; estimate would be wrong.`);
    if (!String(voice.name ?? '').includes(ENGLISH_VOICE.expectedName)) throw new Error(`Voice ${ENGLISH_VOICE.id} is named "${voice.name}", not ${ENGLISH_VOICE.expectedName}; pick another.`);
    const before = await subscription();
    if (before.limit - before.used < estimated + HEADROOM) throw new Error(`Insufficient credit headroom: ${before.limit - before.used} left, need ${estimated + HEADROOM}.`);
    manifest = {
      createdAt: new Date().toISOString(), cap: CREDIT_CAP, estimatedCredits: estimated, before, synthetic: true, syntheticNote: SYNTHETIC_NOTE,
      voice: { id: ENGLISH_VOICE.id, name: voice.name, labels: voice.labels ?? null, category: voice.category ?? null },
      model: MODEL, settings: VOICE_SETTINGS, languageCode: null, format: OUTPUT_ENCODING, streamingLatency: STREAMING_LATENCY,
      clips: plan.map(p => ({ ...p, status: 'pending' })), status: 'running',
    };
  }
  const checkpoint = () => writeJson(manifestPath, manifest);
  checkpoint();
  const accounted = () => manifest.clips.reduce((n, c) => n + (c.status === 'complete' ? (Number.isFinite(c.credits) ? c.credits : c.estimate) : c.status === 'pending' ? c.estimate : 0), 0);
  try {
    for (const clip of manifest.clips) {
      if (clip.status === 'complete') {
        if (!existsSync(join(accentedDir, clip.file))) throw new Error(`Saved clip ${clip.name} is missing its file; do not regenerate automatically.`);
        continue;
      }
      if (clip.sent) throw new Error(`Uncertain earlier request for ${clip.name}; do not regenerate automatically.`);
      if (accounted() > CREDIT_CAP) throw new Error('Credit guard reached; no further request sent.');
      clip.sent = true;
      checkpoint(); // Recorded before the billed request, including timeout and crash cases.
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ENGLISH_VOICE.id}?output_format=${OUTPUT_ENCODING}&optimize_streaming_latency=${STREAMING_LATENCY}`, {
        method: 'POST', headers, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ text: clip.text, model_id: MODEL, voice_settings: VOICE_SETTINGS }),
      });
      if (!r.ok) throw new Error(`Synthesis HTTP ${r.status} for ${clip.name}; no retry.`);
      const pcm = Buffer.from(await r.arrayBuffer());
      if (pcm.length < 2205 || pcm.length % 2 !== 0) throw new Error(`Invalid PCM result for ${clip.name}; no retry.`);
      writeFileSync(join(accentedDir, clip.file), wavBytes(new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2), SAMPLE_RATE));
      const costName = ['character-cost', 'x-character-count'].find(n => r.headers.get(n) !== null) ?? null;
      const cost = costName ? Number(r.headers.get(costName)) : null;
      Object.assign(clip, { status: 'complete', credits: Number.isFinite(cost) && cost >= 0 ? cost : null, costHeader: costName, seconds: Number((pcm.length / 2 / SAMPLE_RATE).toFixed(3)) });
      checkpoint();
      console.log(JSON.stringify({ clip: clip.name, costHeader: costName, credits: clip.credits, estimated: clip.estimate }));
    }
    manifest.after = await subscription();
    manifest.measuredCredits = manifest.after.used - manifest.before.used;
    manifest.status = 'complete';
    checkpoint();
  } catch (error) {
    manifest.status = 'stopped'; manifest.reason = error.message; checkpoint();
    throw error;
  }
  // The -20 dB copies are local and free; always (re)made from the saved WAVs.
  for (const clip of manifest.clips) {
    const { rate, pcm } = parseWav(readFileSync(join(accentedDir, clip.file)));
    writeFileSync(join(accentedDir, clip.quietFile), wavBytes(applyGain(pcm, QUIET_DB), rate));
  }
  console.log(JSON.stringify({ status: manifest.status, clips: manifest.clips.length, creditsFromHeaders: manifest.clips.reduce((n, c) => n + (c.credits ?? 0), 0), estimated, measuredCreditsFromBalance: manifest.measuredCredits, destination: accentedDir }));
}

// ----------------------------------------------------------------- clip list
/** Accented synthetic clips (normal and -20 dB) plus founder recordings with a known sentence. */
export function loadClips() {
  const clips = [];
  const manifestPath = join(CLIP_DIR, 'manifest.json');
  if (existsSync(manifestPath)) {
    for (const c of readJson(manifestPath).clips.filter(x => x.status === 'complete')) {
      for (const [level, file] of [['normal', c.file], [`${QUIET_DB} dB`, c.quietFile]]) {
        if (!existsSync(join(ACCENTED_DIR, file))) { console.error(`skipping accented/${file}: not on disk`); continue; }
        const { rate, pcm } = parseWav(readFileSync(join(ACCENTED_DIR, file)));
        clips.push({ id: `accented/${file}`, kind: LESSON, group: 'synthetic accent (English voice reading French)', level, text: c.text, rate, pcm });
      }
    }
  }
  if (existsSync(REAL_DIR)) {
    for (const f of readdirSync(REAL_DIR).filter(x => x.toLowerCase().endsWith('.wav')).sort()) {
      const lower = f.toLowerCase();
      const text = SENTENCES.find(s => lower.includes(slug(s)));
      if (!text) { console.error(`skipping real/${f}: no known sentence slug in the name`); continue; }
      const { rate, pcm } = parseWav(readFileSync(join(REAL_DIR, f)));
      clips.push({ id: `real/${f}`, kind: LESSON, group: 'real founder recordings', level: 'as recorded', text, rate, pcm });
    }
  }
  return clips;
}

/** The multi comparison: lesson lines at normal level, plus the scene replies and English answers. */
export function loadMultiClips() {
  const clips = loadClips().filter(c => c.id.startsWith('accented/') && c.level === 'normal');
  const manifestPath = join(MULTI_DIR, 'manifest.json');
  if (existsSync(manifestPath)) {
    for (const c of readJson(manifestPath).clips.filter(x => x.status === 'complete')) {
      const path = join(MULTI_DIR, 'accented', c.file);
      if (!existsSync(path)) { console.error(`skipping multi/${c.file}: not on disk`); continue; }
      const { rate, pcm } = parseWav(readFileSync(path));
      clips.push({ id: `multi/${c.file}`, kind: c.kind, group: 'synthetic accent (English voice)', level: 'normal', text: c.text, rate, pcm });
    }
  }
  return clips;
}

export function multiMarkdown(result) {
  const lines = [`# Deepgram STT on learner speech: ${result.conditions.join(', ')} (${result.date})`, '', `> ${result.syntheticNote}`, '',
    `Mode ${result.deepgram.mode}, ${result.deepgram.streams} streams, ${result.deepgram.billedSeconds} s billed. multi = language 'multi', endpointing 100; multi-ep25 = multi at the default endpointing; flux = flux-general-multi with language hints fr, en. Keyterms on lesson lines only (except multi-plain).`, '',
    '| kind | condition | clips | mean word accuracy | exact |', '|---|---|---|---|---|',
    ...result.summary.map(s => `| ${s.kind} | ${s.condition} | ${s.clips} | ${s.meanWordAccuracy.toFixed(3)} | ${s.exactMatches} |`), '',
    '| clip | kind | condition | reference | transcript | accuracy |', '|---|---|---|---|---|---|',
    ...result.rows.map(r => `| ${r.clip} | ${r.kind} | ${r.condition} | ${r.reference} | ${r.transcript.replaceAll('|', '/')} | ${r.wordAccuracy} |`), ''];
  return lines.join('\n');
}

// ------------------------------------------------------------------ Deepgram
async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

async function run(keyterms, conditions = LEGACY) {
  const multi = isMultiRun(conditions);
  const evidence = multi ? MULTI_EVIDENCE : EVIDENCE;
  if (!process.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY is missing.');
  if (existsSync(evidence) && !process.argv.includes('--force')) throw new Error(`${evidence} already exists; pass --force to overwrite.`);
  const clips = multi ? loadMultiClips() : loadClips();
  if (clips.length === 0) throw new Error('No clips found. Run --generate first.');
  const agentRequire = createRequire(join(root, 'services/tutor-agent/package.json'));
  const load = async name => import(pathToFileURL(agentRequire.resolve(name)).href);
  const agents = await load('@livekit/agents');
  agents.initializeLogger({ pretty: false, level: 'error' });
  const deepgram = await load('@livekit/agents-plugin-deepgram');
  const { AudioFrame, AudioResampler, AudioResamplerQuality } = await load('@livekit/rtc-node');
  const sttNs = agents.stt;

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
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  const ms = n => Math.round((16000 * n) / 1000);
  const padded = pcm16 => {
    const out = new Int16Array(ms(LEAD_MS) + pcm16.length + ms(TAIL_MS));
    out.set(pcm16, ms(LEAD_MS));
    return out;
  };

  let mode = 'plugin-stream';
  let billedSeconds = 0;
  const stts = new Map();
  const sttFor = options => {
    const key = JSON.stringify(options);
    if (!stts.has(key)) stts.set(key, options.model?.startsWith('flux') ? new deepgram.STTv2(options) : new deepgram.STT(options));
    return stts.get(key);
  };

  async function stream(options, pcm) {
    const s = sttFor(options).stream();
    const finals = [];
    let usage = 0;
    let lastEvent = Date.now();
    const reader = (async () => {
      for await (const ev of s) {
        lastEvent = Date.now();
        if (ev.type === sttNs.SpeechEventType.FINAL_TRANSCRIPT && ev.alternatives?.[0]) finals.push(ev.alternatives[0]);
        if (ev.type === sttNs.SpeechEventType.RECOGNITION_USAGE) usage += ev.recognitionUsage?.audioDuration ?? 0;
      }
    })().catch(() => {});
    const frame = 160;
    const started = Date.now();
    for (let i = 0; i < pcm.length; i += frame) {
      const d = pcm.slice(i, Math.min(i + frame, pcm.length));
      s.pushFrame(new AudioFrame(d, 16000, 1, d.length));
      const due = ((i + frame) / 16000 / DG_SPEED) * 1000 - (Date.now() - started);
      if (due > 5) await new Promise(r => setTimeout(r, due));
    }
    s.flush();
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
      if (finals.length > 0 && Date.now() - lastEvent >= 1_500) break;
    }
    s.close();
    await Promise.race([reader, new Promise(r => setTimeout(r, 1_000))]);
    return { text: finals.map(a => a.text).join(' ').trim(), usageSeconds: usage };
  }

  /** Fallback: prerecorded REST with equivalent options, on the frames the energy filter would send. */
  async function rest(options, pcm) {
    const sends = energyFilterSends(pcm, { warm: true });
    const kept = [];
    sends.forEach((send, k) => { if (send) kept.push(pcm.subarray(k * 1600, (k + 1) * 1600)); });
    const audio = new Int16Array(kept.reduce((a, c) => a + c.length, 0));
    let o = 0;
    for (const c of kept) { audio.set(c, o); o += c.length; }
    if (audio.length === 0) return { text: '', usageSeconds: 0 };
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&language=${options.language}&smart_format=true&mip_opt_out=true${options.keyterm ? keytermQuery(options.keyterm) : ''}`;
    const r = await fetch(url, {
      method: 'POST', headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'audio/wav' },
      body: wavBytes(audio, 16000), signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Deepgram REST HTTP ${r.status}`);
    const alt = (await r.json()).results?.channels?.[0]?.alternatives?.[0];
    return { text: alt?.transcript ?? '', usageSeconds: audio.length / 16000 };
  }

  async function transcribe(options, pcm) {
    const flux = options.model?.startsWith('flux');
    if (flux || mode === 'plugin-stream') {
      try { const r = await stream(options, pcm); billedSeconds += r.usageSeconds; return { ...r, mode: 'plugin-stream' }; }
      catch (error) { if (flux) throw error; console.error(`Deepgram plugin stream failed (${error instanceof Error ? error.message : error}); falling back to REST.`); mode = 'prerecorded-rest-fallback'; }
    }
    const r = await rest(options, pcm);
    billedSeconds += r.usageSeconds;
    return { ...r, mode };
  }

  const jobs = clips.flatMap(clip => {
    const audio = padded(to16k(clip.pcm, clip.rate));
    return conditionsFor(clip.kind, conditions).map(condition => ({ clip, condition, audio, options: conditionOptions(condition, clip.kind, keyterms) }));
  });
  const estSeconds = jobs.reduce((n, j) => n + energyFilterSends(j.audio, { warm: false }).filter(Boolean).length * 0.1, 0);
  console.log(`deepgram: ${jobs.length} streams over ${clips.length} clips, estimated ${estSeconds.toFixed(0)} s billed (cap ${DG_CAP_SECONDS} s)`);
  if (estSeconds > DG_CAP_SECONDS) throw new Error('Deepgram estimate is above the cap; refusing.');

  const rows = [];
  await pool(jobs, DG_CONCURRENCY, async j => {
    const r = await transcribe(j.options, j.audio);
    rows.push({
      clip: j.clip.id, kind: j.clip.kind, group: j.clip.group, level: j.clip.level, condition: j.condition, reference: j.clip.text, transcript: r.text,
      wordAccuracy: Number(wordAccuracy(j.clip.text, r.text).toFixed(3)), exact: exactMatch(j.clip.text, r.text), mode: r.mode,
    });
  });
  rows.sort((a, b) => a.clip.localeCompare(b.clip) || a.condition.localeCompare(b.condition));

  const manifestPath = join(CLIP_DIR, 'manifest.json');
  const gen = existsSync(manifestPath) ? readJson(manifestPath) : null;
  if (multi) {
    const extra = existsSync(join(MULTI_DIR, 'manifest.json')) ? readJson(join(MULTI_DIR, 'manifest.json')) : null;
    const result = {
      date: RUN_DATE, synthetic: true, syntheticNote: SYNTHETIC_NOTE, voice: gen?.voice ?? null, model: gen?.model ?? null, keyterms, conditions,
      options: Object.fromEntries([LESSON, 'scene reply', 'English answer'].map(k => [k, Object.fromEntries(conditionsFor(k, conditions).map(c => [c, conditionOptions(c, k, keyterms)]))])),
      creditsFromHeaders: [gen, extra].reduce((n, m) => n + (m ? m.clips.reduce((a, c) => a + (c.credits ?? 0), 0) : 0), 0),
      deepgram: { mode, plugin: 'defaults otherwise (smartFormat, interimResults); REST fallback has no endpointing', billedSeconds: Number(billedSeconds.toFixed(1)), streams: jobs.length, speed: `${DG_SPEED}x real time` },
      lead: { ms: LEAD_MS }, tail: { ms: TAIL_MS },
      rows, summary: summariseByKind(rows),
    };
    writeJson(evidence, result);
    writeFileSync(evidence.replace(/\.json$/, '.md'), multiMarkdown(result));
    console.log(formatByKind(result.summary));
    console.log(`\n${SYNTHETIC_NOTE}\nEvidence: ${evidence}`);
    return;
  }
  const result = {
    date: '2026-10-25',
    synthetic: true,
    syntheticNote: SYNTHETIC_NOTE,
    realRecordings: clips.filter(c => c.group === 'real founder recordings').length,
    voice: gen?.voice ?? null, model: gen?.model ?? null, voiceSettings: gen?.settings ?? null,
    creditsFromHeaders: gen ? gen.clips.reduce((n, c) => n + (c.credits ?? 0), 0) : null,
    keyterms,
    deepgram: { mode, options: { ...DG_OPTIONS, plugin: 'defaults (endpointing 25, smartFormat, interimResults)', withKeyterms: 'keyterm option on the plugin; repeated &keyterm= on REST fallback' }, billedSeconds: Number(billedSeconds.toFixed(1)), streams: jobs.length, speed: `${DG_SPEED}x real time` },
    lead: { ms: LEAD_MS }, tail: { ms: TAIL_MS },
    rows, summary: summarise(rows),
  };
  writeJson(EVIDENCE, result);
  console.log(formatSummary(result.summary));
  console.log(`\n${SYNTHETIC_NOTE}\nEvidence: ${EVIDENCE}`);
}

async function main(argv) {
  const conditions = parseConditions(argv);
  const multi = isMultiRun(conditions);
  if (argv.includes('--report-only')) {
    const evidence = multi ? latestMultiEvidence() : EVIDENCE;
    if (!existsSync(evidence)) throw new Error(`No evidence at ${evidence}.`);
    const saved = readJson(evidence);
    console.log(multi ? formatByKind(saved.summary) : formatSummary(saved.summary));
    console.log(`\n${saved.syntheticNote}\nDeepgram: ${saved.deepgram.mode}, ${saved.deepgram.streams} streams, ${saved.deepgram.billedSeconds} s billed.`);
    return;
  }
  const plan = buildPlan();
  const estimated = estimateTotal(plan);
  let keyterms = null;
  let keytermsNote = null;
  try { keyterms = await loadKeyterms(); } catch (error) { keytermsNote = error.message; }
  const clips = existsSync(join(CLIP_DIR, 'manifest.json')) ? plan.length * 2 : 0;
  console.log(JSON.stringify({
    lines: plan.map(p => ({ name: p.name, text: p.text, chars: p.chars })),
    elevenlabs: { voiceId: ENGLISH_VOICE.id, expectedName: ENGLISH_VOICE.expectedName, model: MODEL, requests: plan.length, estimatedCredits: estimated, cap: CREDIT_CAP, headroomRequired: estimated + HEADROOM, destination: ACCENTED_DIR },
    quietCopies: `${plan.length} local copies at ${QUIET_DB} dB, no spend`,
    realClipsDir: REAL_DIR, realClipsFound: existsSync(REAL_DIR) ? readdirSync(REAL_DIR).filter(f => f.toLowerCase().endsWith('.wav')).length : 0,
    deepgram: { conditions: ['plain', 'keyterms'], clipsOnDiskAfterGenerate: clips || `${plan.length * 2} after --generate`, streams: `${plan.length * 4} (plus 2 per real clip)`, capSeconds: DG_CAP_SECONDS, options: DG_OPTIONS },
    keyterms: keyterms ?? `unavailable: ${keytermsNote}`,
    evidence: EVIDENCE, note: SYNTHETIC_NOTE,
  }, null, 2));
  const extra = buildExtraPlan();
  if (multi) {
    const lessonStreams = plan.length * conditionsFor(LESSON, conditions).length;
    const extraStreams = extra.reduce((n, p) => n + conditionsFor(p.kind, conditions).length, 0);
    const seconds = extra.reduce((n, p) => n + p.chars, 0) / 14 + (lessonStreams / plan.length) * plan.reduce((n, p) => n + p.chars, 0) / 14;
    console.log(JSON.stringify({
      multiComparison: {
        conditions: Object.fromEntries([LESSON, 'scene reply', 'English answer'].map(k => [k, Object.fromEntries(conditionsFor(k, conditions).map(c => [c, conditionOptions(c, k, keyterms ? ['<lessonKeyterms(CAFE_LESSON)>'] : ['<keyterms unavailable>'])]))])),
        newClips: extra.map(p => ({ name: p.name, kind: p.kind, text: p.text, chars: p.chars })),
        elevenlabs: { requests: extra.length, estimatedCredits: estimateTotal(extra), cap: CREDIT_CAP, headroomRequired: estimateTotal(extra) + HEADROOM, destination: join(MULTI_DIR, 'accented'), lessonClips: 'reused from ' + ACCENTED_DIR + ' (normal level only), never re-billed' },
        deepgram: { streams: lessonStreams + extraStreams, lessonStreams, extraStreams, roughSpeechSeconds: Math.round(seconds * 2) / 2, note: 'speech at ~14 chars/s, excluding pad; --run prints the energy-filter estimate and refuses above the cap', capSeconds: DG_CAP_SECONDS },
        evidence: [MULTI_EVIDENCE, MULTI_EVIDENCE.replace(/\.json$/, '.md')],
      },
    }, null, 2));
  }
  if (argv.includes('--generate')) { await generate(plan); if (multi) await generate(extra, MULTI_DIR); return; }
  if (argv.includes('--run')) {
    if (!keyterms) throw new Error(keytermsNote);
    await run(keyterms, conditions);
    return;
  }
  console.log('Dry run: nothing sent. Add --generate to synthesise, then --run to spend Deepgram.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(() => process.exit(0), error => { console.error(error.message); process.exit(1); });
}
