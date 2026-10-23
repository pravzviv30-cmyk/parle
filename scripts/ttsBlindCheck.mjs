/** One approved, capped, blind listening experiment. Never imported by the app.
 * Does flash (eleven_flash_v2_5) sound as good as the current model on tutor
 * CONVERSATION replies, in all six voices? The founder listens without knowing
 * which clip is which.
 *
 * Dry run:   node --experimental-strip-types scripts/ttsBlindCheck.mjs
 * Generate:  add --generate with ELEVEN_API_KEY loaded by Node's --env-file.
 * Resume:    add --generate --resume (never re-bills a saved clip).
 * Rebuild the page from the manifest, no network: add --html
 * Score:     node --experimental-strip-types scripts/ttsBlindCheck.mjs --score results.json
 *
 * Files are named by random ids, never by model. The model of every clip lives only in
 * key.json, which index.html never loads. An uncertain request is never retried.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS, STREAMING_LATENCY, LANGUAGE_CODE, OUTPUT_ENCODING } from '../services/tutor-agent/src/voice.ts';

export const CAP = 3600;
export const HEADROOM = 500;
export const SAMPLE_RATE = 22050;
export const DESTINATION = resolve('artifacts/tts-blind-check-2026-10-22');
export const STORAGE_KEY = 'tts-blind-check-2026-10-22';

/** Real gpt-6-luna mission replies measured 2026-10-22. Keep exactly. */
export const LINES = [
  "Bonjour ! Qu'est-ce que je vous sers ?",
  'Bien sûr. Vous le prenez sur place ou à emporter ?',
  'D’accord. Le café et le croissant, ça fait trois euros.',
  'Ça marche. C’est un euro cinquante, s’il vous plaît.',
  'Merci, bonne journée à vous aussi !',
  'You’re asking for milk; say « s’il vous plaît » for “please.”', // bilingual coach line
];
export const EXPECTED_MULTIPLIERS = { alexandre: 1, emilie: 2, guillaume: 1, marie: 1, anatole: 1, sarah: 2 };
export const MODELS = [{ label: 'current', id: MODEL, rate: 1 }, { label: 'flash', id: 'eleven_flash_v2_5', rate: 0.5 }];

const chars = text => [...text].length;
export const estimateFor = (text, voice, model) => Math.ceil(chars(text) * EXPECTED_MULTIPLIERS[voice] * model.rate);

/** Every request, in listening order: voice, then line, then both models. */
export function buildPlan(voices = ELEVEN_VOICES) {
  return Object.entries(voices).flatMap(([voice, voiceId]) => LINES.flatMap((text, line) => MODELS.map(model => ({
    voice, voiceId, line, text, model, chars: chars(text), estimate: estimateFor(text, voice, model),
  }))));
}
export const estimateTotal = plan => plan.reduce((n, p) => n + p.estimate, 0);

const randomId = () => randomUUID().replace(/-/g, '').slice(0, 12);

/**
 * Assigns random ids and a random A/B order to each (voice, line) pair. `rng` and `newId` are
 * injectable for tests. Returns the public design (no models) and the sealed key.
 */
export function buildDesign(plan = buildPlan(), { rng = Math.random, newId = randomId } = {}) {
  const used = new Set();
  const fresh = () => { let id; do { id = newId(); } while (used.has(id)); used.add(id); return id; };
  const groups = new Map();
  for (const entry of plan) {
    const k = `${entry.voice}:${entry.line}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(entry);
  }
  const clips = {}, pairs = [], key = { pairs: {}, clips: {} };
  for (const members of groups.values()) {
    const ordered = rng() < 0.5 ? members : [...members].reverse();
    const ids = ordered.map(entry => {
      const id = fresh();
      clips[id] = { voice: entry.voice, line: entry.line, chars: entry.chars, estimatedCredits: entry.estimate, file: `${id}.wav`, status: 'pending' };
      key.clips[id] = entry.model.id;
      return id;
    });
    const pairId = fresh();
    pairs.push({ pairId, voice: ordered[0].voice, line: ordered[0].line, A: ids[0], B: ids[1] });
    key.pairs[pairId] = { voice: ordered[0].voice, line: ordered[0].line, A: ordered[0].model.id, B: ordered[1].model.id, clipA: ids[0], clipB: ids[1] };
  }
  return { pairs, clips, key };
}

/** 44-byte RIFF header plus 16-bit mono PCM. */
export function wavFromPcm(pcm, sampleRate = SAMPLE_RATE) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);

/** The listening page. Built only from the manifest, so it always matches the clips. */
export function buildHtml(manifest, lines = LINES) {
  const byVoice = new Map();
  for (const pair of manifest.pairs) {
    if (!byVoice.has(pair.voice)) byVoice.set(pair.voice, []);
    byVoice.get(pair.voice).push(pair);
  }
  const sections = [...byVoice.entries()].map(([voice, pairs]) => `<section>
<h2>${esc(titleCase(voice))}</h2>
${pairs.map(pair => `<div class="pair" data-pair="${esc(pair.pairId)}">
<p class="line" lang="${pair.line === lines.length - 1 ? 'en' : 'fr'}">${esc(lines[pair.line])}</p>
<div class="players">
<div><span class="tag">A</span><audio controls preload="none" src="${esc(manifest.clips[pair.A].file)}"></audio></div>
<div><span class="tag">B</span><audio controls preload="none" src="${esc(manifest.clips[pair.B].file)}"></audio></div>
</div>
<div class="choices">
<button type="button" data-choice="A">A sounds better</button>
<button type="button" data-choice="B">B sounds better</button>
<button type="button" data-choice="cant-tell">Can't tell</button>
</div>
<input type="text" class="note" placeholder="Note (optional)" aria-label="Note for this pair">
</div>`).join('\n')}
</section>`).join('\n');
  const total = manifest.pairs.length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Tutor voice listening check</title>
<style>
:root { color-scheme: light dark; --bg: #faf8f5; --fg: #1f1b16; --card: #ffffff; --line: #d9d2c8; --accent: #2f6f5e; --accent-fg: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --bg: #17140f; --fg: #f2ede6; --card: #221e18; --line: #3a342b; --accent: #7cc4ae; --accent-fg: #10211c; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; max-width: 760px; margin-inline: auto; }
header { position: sticky; top: 0; background: var(--bg); padding: 8px 0; border-bottom: 1px solid var(--line); }
h1 { font-size: 1.25rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 28px 0 8px; }
.pair { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin: 10px 0; }
.line { font-size: 1.05rem; margin: 0 0 8px; }
.players { display: grid; gap: 6px; }
.players > div { display: flex; align-items: center; gap: 8px; }
.tag { font-weight: 700; width: 1.5em; }
audio { flex: 1; min-width: 0; }
.choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 8px; }
button { font: inherit; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
button[aria-pressed="true"] { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.note { width: 100%; box-sizing: border-box; font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
#progress { font-weight: 600; }
</style>
</head>
<body>
<header>
<h1>Tutor voice listening check</h1>
<p>Each pair is the same tutor saying the same line two ways. Pick the one a beginner should hear, or Can't tell.</p>
<p><span id="progress">0 of ${total}</span> <button type="button" id="copy">Copy results</button> <span id="copied" role="status"></span></p>
</header>
${sections}
<script>
(function () {
  var KEY = ${JSON.stringify(STORAGE_KEY)};
  var TOTAL = ${total};
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }
  function answered() { return Object.keys(state).filter(function (id) { return state[id] && state[id].choice; }).length; }
  function paint(el) {
    var id = el.getAttribute('data-pair'), s = state[id] || {};
    el.querySelectorAll('button[data-choice]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-choice') === s.choice)); });
    el.querySelector('.note').value = s.note || '';
  }
  function progress() { document.getElementById('progress').textContent = answered() + ' of ' + TOTAL; }
  document.querySelectorAll('.pair').forEach(function (el) {
    var id = el.getAttribute('data-pair');
    paint(el);
    el.querySelectorAll('button[data-choice]').forEach(function (b) {
      b.addEventListener('click', function () {
        state[id] = { choice: b.getAttribute('data-choice'), note: (state[id] && state[id].note) || '' };
        save(); paint(el); progress();
      });
    });
    el.querySelector('.note').addEventListener('input', function (e) {
      state[id] = { choice: (state[id] && state[id].choice) || '', note: e.target.value };
      save(); progress();
    });
  });
  progress();
  document.getElementById('copy').addEventListener('click', function () {
    var text = JSON.stringify(state, null, 2), done = document.getElementById('copied');
    function ok() { done.textContent = 'Copied.'; }
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text; document.body.appendChild(area); area.select();
      try { document.execCommand('copy'); ok(); } catch (e) { done.textContent = 'Could not copy.'; }
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  });
})();
</script>
</body>
</html>
`;
}

/** Maps the founder's A/B picks back to models. Never needs the manifest. */
export function scoreResults(key, results, { current = MODEL } = {}) {
  const blank = () => ({ current: 0, flash: 0, cantTell: 0, unanswered: 0 });
  const perVoice = {}, overall = blank();
  for (const [pairId, pair] of Object.entries(key.pairs)) {
    const bucket = (perVoice[pair.voice] ??= blank());
    const entry = results[pairId];
    const choice = entry?.choice;
    let field;
    if (!choice) field = 'unanswered';
    else if (choice === 'cant-tell') field = 'cantTell';
    else if (choice === 'A' || choice === 'B') field = pair[choice] === current ? 'current' : 'flash';
    else throw new Error(`Unknown choice "${choice}" for pair ${pairId}.`);
    bucket[field] += 1; overall[field] += 1;
  }
  for (const id of Object.keys(results)) if (!key.pairs[id]) throw new Error(`Results name an unknown pair: ${id}`);
  return { perVoice, overall };
}

/** Seconds of speech per character, per model, per voice and per voice and model. */
export function speakingRates(manifest, key) {
  const add = (map, k, c) => { const v = (map[k] ??= { chars: 0, seconds: 0 }); v.chars += c.chars; v.seconds += c.seconds; };
  const byModel = {}, byVoice = {}, byVoiceModel = {};
  for (const [id, clip] of Object.entries(manifest.clips)) {
    if (clip.status !== 'complete') continue;
    const model = key.clips[id];
    add(byModel, model, clip); add(byVoice, clip.voice, clip); add(byVoiceModel, `${clip.voice}/${model}`, clip);
  }
  const rate = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number((v.seconds / v.chars).toFixed(4))]));
  return { secondsPerCharByModel: rate(byModel), secondsPerCharByVoice: rate(byVoice), secondsPerCharByVoiceAndModel: rate(byVoiceModel) };
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
function writeJson(path, value) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

async function main(argv) {
  const manifestPath = resolve(DESTINATION, 'manifest.json');
  const keyPath = resolve(DESTINATION, 'key.json');
  const htmlPath = resolve(DESTINATION, 'index.html');

  const scoreAt = argv.indexOf('--score');
  if (scoreAt !== -1) {
    const file = argv[scoreAt + 1];
    if (!file) throw new Error('Usage: --score <results.json>');
    const summary = scoreResults(readJson(keyPath), readJson(resolve(file)));
    writeJson(resolve(DESTINATION, 'summary.json'), summary);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (argv.includes('--html')) {
    writeFileSync(htmlPath, buildHtml(readJson(manifestPath)));
    console.log(JSON.stringify({ wrote: htmlPath }));
    return;
  }

  const plan = buildPlan();
  const estimatedCredits = estimateTotal(plan);
  if (estimatedCredits > CAP) throw new Error(`Plan estimate ${estimatedCredits} exceeds the approved cap of ${CAP}.`);
  console.log(JSON.stringify({ requests: plan.length, pairs: plan.length / 2, estimatedCredits, cap: CAP, headroomRequired: estimatedCredits + HEADROOM, lines: LINES, models: MODELS.map(m => m.id), destination: DESTINATION }));
  if (!argv.includes('--generate')) return;

  const resume = argv.includes('--resume');
  if (existsSync(manifestPath) && !resume) throw new Error('Manifest already exists. No automatic retry or regeneration is allowed.');
  if (resume && !(existsSync(manifestPath) && existsSync(keyPath))) throw new Error('No experiment to resume.');
  if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is missing.');
  const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
  const json = async path => {
    const response = await fetch(`https://api.elevenlabs.io${path}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Metadata HTTP ${response.status}; generation stopped.`);
    return response.json();
  };
  const subscription = async () => {
    const s = await json('/v1/user/subscription');
    if (![s.character_count, s.character_limit].every(Number.isFinite)) throw new Error('Credit balance unavailable.');
    return { tier: s.tier, used: s.character_count, limit: s.character_limit };
  };

  const verifiedFrench = {};
  if (!resume) {
    // Read-only. Stop if a voice price moved; note (do not stop on) missing French verification.
    for (const [voice, id] of Object.entries(ELEVEN_VOICES)) {
      const metadata = await json(`/v1/voices/${id}`);
      if (Number(metadata.sharing?.rate ?? 1) !== EXPECTED_MULTIPLIERS[voice]) throw new Error(`Rate changed for ${voice}.`);
      for (const model of MODELS) {
        const ok = Boolean(metadata.verified_languages?.some(l => l.language === 'fr' && l.model_id === model.id));
        verifiedFrench[`${voice}/${model.label}`] = ok;
        if (!ok) console.warn(`Warning: French not verified for ${voice} on ${model.label}.`);
      }
    }
  }
  const current = await subscription();
  if (current.limit - current.used < estimatedCredits + HEADROOM) throw new Error(`Insufficient credit headroom: ${current.limit - current.used} left, need ${estimatedCredits + HEADROOM}.`);

  mkdirSync(DESTINATION, { recursive: true });
  let manifest, key;
  if (resume) {
    manifest = readJson(manifestPath); key = readJson(keyPath);
    if (manifest.cap !== CAP || JSON.stringify(manifest.settings) !== JSON.stringify(VOICE_SETTINGS) || JSON.stringify(manifest.lines) !== JSON.stringify(LINES)) throw new Error('Experiment settings changed.');
  } else {
    const design = buildDesign(plan);
    key = design.key;
    manifest = {
      createdAt: new Date().toISOString(), cap: CAP, estimatedCredits, before: current, settings: VOICE_SETTINGS, lines: LINES,
      format: OUTPUT_ENCODING, streamingLatency: STREAMING_LATENCY, languageCode: LANGUAGE_CODE ?? null, verifiedFrench,
      pairs: design.pairs, clips: design.clips, status: 'running',
    };
    writeJson(keyPath, key); // The sealed answer exists before the first billed request.
  }
  const checkpoint = () => writeJson(manifestPath, manifest);
  checkpoint();

  const modelOf = id => key.clips[id];
  const rateOf = id => MODELS.find(m => m.id === modelOf(id));
  const voiceIds = ELEVEN_VOICES;
  const accountedOf = () => Object.values(manifest.clips).reduce((n, c) => n + (c.status === 'complete' ? (Number.isFinite(c.credits) ? c.credits : c.estimatedCredits) : c.status === 'pending' ? c.estimatedCredits : 0), 0);
  let accounted = accountedOf();
  // Pending clips from an earlier run are uncertain: the request may have been billed.
  try {
    const order = manifest.pairs.flatMap(p => [p.A, p.B]);
    for (const id of order) {
      const clip = manifest.clips[id];
      if (clip.status === 'complete') {
        if (!existsSync(resolve(DESTINATION, clip.file))) throw new Error(`Saved clip ${id} is missing its file; do not regenerate automatically.`);
        continue;
      }
      if (clip.sent) throw new Error(`Uncertain earlier request for ${id}; do not regenerate automatically.`);
      if (accounted > CAP) throw new Error('Credit guard reached; no further request sent.');
      const text = LINES[clip.line];
      if (chars(text) !== clip.chars || !rateOf(id)) throw new Error('Sample content changed.');
      clip.sent = true;
      checkpoint(); // Recorded before the billed request, including timeout and crash cases.
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIds[clip.voice]}?output_format=${OUTPUT_ENCODING}&optimize_streaming_latency=${STREAMING_LATENCY}`, {
        method: 'POST', headers, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ text, model_id: modelOf(id), voice_settings: VOICE_SETTINGS, ...(LANGUAGE_CODE ? { language_code: LANGUAGE_CODE } : {}) }),
      });
      if (!response.ok) throw new Error(`Synthesis HTTP ${response.status}; no retry.`);
      const pcm = Buffer.from(await response.arrayBuffer());
      if (pcm.length < 2205 || pcm.length % 2 !== 0) throw new Error('Invalid PCM result; no retry.');
      writeFileSync(resolve(DESTINATION, clip.file), wavFromPcm(pcm));
      const costName = ['character-cost', 'x-character-count'].find(name => response.headers.get(name) !== null) ?? null;
      const cost = costName ? Number(response.headers.get(costName)) : null;
      Object.assign(clip, {
        status: 'complete', credits: Number.isFinite(cost) && cost >= 0 ? cost : null, costHeader: costName,
        bytes: pcm.length, seconds: pcm.length / 2 / SAMPLE_RATE,
      });
      accounted = accountedOf();
      checkpoint();
      console.log(JSON.stringify({ clip: id, voice: clip.voice, line: clip.line, costHeader: costName, credits: clip.credits, estimated: clip.estimatedCredits, seconds: Number(clip.seconds.toFixed(2)), accounted }));
    }
    manifest.after = await subscription();
    manifest.measuredCredits = manifest.after.used - manifest.before.used;
    manifest.status = 'complete';
    checkpoint();
    writeFileSync(htmlPath, buildHtml(manifest));
    const clips = Object.values(manifest.clips);
    const fromHeaders = clips.reduce((n, c) => n + (c.credits ?? 0), 0);
    console.log(JSON.stringify({
      status: manifest.status, destination: DESTINATION,
      creditsFromHeaders: fromHeaders, headersMissing: clips.filter(c => c.credits === null).length,
      estimatedCredits, measuredCreditsFromBalance: manifest.measuredCredits,
      ...speakingRates(manifest, key),
    }, null, 2));
  } catch (error) {
    manifest.status = 'stopped';
    manifest.reason = error.message;
    checkpoint();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
