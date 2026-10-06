/**
 * Builds Luvani's twelve sound effects from scripts/sfx/recipes.mjs.
 *
 *   node scripts/sfx/generate.mjs              synthesise, encode, write the manifests
 *   node scripts/sfx/generate.mjs --audition   the same, then write the audition page
 *
 * Synthesis is deterministic (scripts/sfx/synth.mjs). WAVs go to a temporary folder and are
 * never committed; each is encoded to AAC with bit-exact flags into
 * apps/mobile/assets/sfx/<id>.m4a. Then it writes apps/mobile/assets/sfx/manifest.json and the
 * generated apps/mobile/src/sound/sfxManifest.ts, whose SFX_APPROVED comes from
 * scripts/sfx/approvals.json: a sound is approved only while the wavSha256 the founder approved
 * is the wavSha256 it synthesises to now. Nothing is approved until the founder has listened.
 *
 * --audition writes artifacts/sfx-audition/index.html (ignored by git): one card per sound and
 * the "in context" reels from scripts/sfx/reels.mjs, with the encoded files inlined so the page
 * plays from disk with no server.
 *
 * ffmpeg: $SFX_FFMPEG, else /opt/homebrew/bin/ffmpeg, else ffmpeg on the PATH. The AAC bytes
 * depend on the ffmpeg build, so the manifest records which one made them.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { synthesise, encodeWav, peakDbfsOf, durationMsOf, SAMPLE_RATE } from './synth.mjs';
import { RECIPES, RECIPE_VERSION } from './recipes.mjs';
import { REELS } from './reels.mjs';
import { approvedFlags, renderSfxManifestTs, sha256, MAX_M4A_BYTES } from './manifest.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const ASSETS = join(ROOT, 'apps', 'mobile', 'assets', 'sfx');
const MANIFEST_TS = join(ROOT, 'apps', 'mobile', 'src', 'sound', 'sfxManifest.ts');
const APPROVALS = join(ROOT, 'scripts', 'sfx', 'approvals.json');
const AUDITION = join(ROOT, 'artifacts', 'sfx-audition');
const ENCODE_ARGS = ['-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-ar', String(SAMPLE_RATE), '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-movflags', '+faststart'];

const FFMPEG = process.env.SFX_FFMPEG ?? (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
const version = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
if (version.status !== 0) throw new Error(`ffmpeg not found at ${FFMPEG}. Set SFX_FFMPEG.`);
const encoder = `ffmpeg ${version.stdout.split('\n')[0]?.match(/^ffmpeg version (\S+)/)?.[1] ?? 'unknown'}, aac 96k mono`;

/** @param {string} path @param {string} text */
function writeAtomic(path, text) {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
}

/**
 * Momentary (400 ms window) loudness maximum, for information only. The sound is padded with
 * 400 ms of silence so a sound shorter than the window still gets a reading.
 * @param {string} wav
 */
function momentaryMaxLufs(wav) {
  const run = spawnSync(FFMPEG, ['-nostdin', '-hide_banner', '-nostats', '-v', 'verbose', '-i', wav, '-af', 'apad=pad_dur=0.4,ebur128=framelog=verbose', '-f', 'null', '-'], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`ebur128 failed on ${wav}`);
  const values = [...run.stderr.matchAll(/\bM:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((v) => Number.isFinite(v) && v > -70);
  return values.length ? Math.round(Math.max(...values) * 10) / 10 : null;
}

const temp = mkdtempSync(join(tmpdir(), 'luvani-sfx-'));
mkdirSync(ASSETS, { recursive: true });
/** @type {import('./manifest.mjs').SoundEntry[]} */
const sounds = [];
try {
  for (const recipe of RECIPES) {
    const pcm = synthesise(recipe, RECIPE_VERSION);
    const wavBytes = encodeWav(pcm);
    const wav = join(temp, `${recipe.id}.wav`);
    writeFileSync(wav, wavBytes);
    const output = join(ASSETS, `${recipe.id}.m4a`);
    const partial = join(temp, `${recipe.id}.m4a`);
    const encoded = spawnSync(FFMPEG, ['-nostdin', '-v', 'error', '-y', '-i', wav, ...ENCODE_ARGS, partial], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(`Encoding ${recipe.id} failed: ${encoded.stderr}`);
    const m4a = readFileSync(partial);
    if (m4a.subarray(4, 8).toString('latin1') !== 'ftyp') throw new Error(`${recipe.id}.m4a is not an MP4 file`);
    if (m4a.length > MAX_M4A_BYTES) throw new Error(`${recipe.id}.m4a is ${m4a.length} bytes, over ${MAX_M4A_BYTES}`);
    writeFileSync(output, m4a);
    sounds.push({
      id: recipe.id,
      durationMs: durationMsOf(pcm),
      peakDbfs: peakDbfsOf(pcm),
      momentaryMaxLufs: momentaryMaxLufs(wav),
      wavSha256: sha256(wavBytes),
      m4aSha256: sha256(m4a),
      m4aBytes: m4a.length,
    });
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

// A sound that left the recipes leaves the bundle too.
const ids = new Set(sounds.map((sound) => sound.id));
for (const file of readdirSync(ASSETS)) {
  if (file.endsWith('.m4a') && !ids.has(file.slice(0, -4))) unlinkSync(join(ASSETS, file));
}

const approvals = JSON.parse(readFileSync(APPROVALS, 'utf8'));
const approved = approvedFlags(sounds, approvals);
const manifest = { generatedBy: 'scripts/sfx/generate.mjs', recipeVersion: RECIPE_VERSION, sampleRate: SAMPLE_RATE, encoder, sounds };
writeAtomic(join(ASSETS, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
mkdirSync(join(MANIFEST_TS, '..'), { recursive: true });
writeAtomic(MANIFEST_TS, renderSfxManifestTs(sounds, approved));

console.table(sounds.map((s) => ({ id: s.id, ms: s.durationMs, peakDbfs: s.peakDbfs, lufsMomentaryMax: s.momentaryMaxLufs, bytes: s.m4aBytes, approved: approved[s.id] })));

if (process.argv.includes('--audition')) {
  mkdirSync(AUDITION, { recursive: true });
  const page = join(AUDITION, 'index.html');
  writeAtomic(page, auditionPage());
  console.log(`audition page: ${page}`);
}

/** @param {string} text */
function escape(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function auditionPage() {
  const data = sounds.map((sound) => {
    const recipe = RECIPES.find((r) => r.id === sound.id);
    return {
      id: sound.id,
      plays: recipe?.plays ?? '',
      durationMs: sound.durationMs,
      peakDbfs: sound.peakDbfs,
      lufs: sound.momentaryMaxLufs,
      bytes: sound.m4aBytes,
      wavSha256: sound.wavSha256,
      approved: approved[sound.id] === true,
      audio: readFileSync(join(ASSETS, `${sound.id}.m4a`)).toString('base64'),
    };
  });
  const cards = data.map((s) => `
      <article class="card" id="card-${escape(s.id)}">
        <button type="button" class="play" data-sound="${escape(s.id)}" aria-label="Play ${escape(s.id)}">Play</button>
        <div>
          <h3>${escape(s.id)}</h3>
          <p>${escape(s.plays)}</p>
          <p class="facts">${s.durationMs} ms, peak ${s.peakDbfs} dBFS${s.lufs === null ? '' : `, ${s.lufs} LUFS momentary max`}, ${(s.bytes / 1024).toFixed(1)} KB</p>
          <p class="facts">${s.approved ? 'Approved' : 'Not approved yet'}. wavSha256 <code>${s.wavSha256.slice(0, 12)}</code></p>
        </div>
      </article>`).join('');
  const reels = REELS.map((reel, index) => `
      <article class="card">
        <button type="button" class="play" data-reel="${index}" aria-label="Play ${escape(reel.title)}">Play</button>
        <div>
          <h3>${escape(reel.title)}</h3>
          <p>${escape(reel.where)}</p>
          <ol class="beats">${reel.beats.map((beat) => `<li>${beat.at} ms: ${[beat.sound, beat.haptic && `haptic ${beat.haptic}`].filter(Boolean).map((x) => escape(String(x))).join(' and ')}</li>`).join('')}</ol>
          <p class="haptic" aria-live="polite" data-haptic-for="${index}"></p>
        </div>
      </article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luvani sound audition</title>
<style>
  :root { color-scheme: light dark; --ground: #fbf7f0; --card: #ffffff; --ink: #1d1b19; --quiet: #5f5a54; --line: #e6dfd4; --accent: #2f5bea; --on-accent: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --ground: #171513; --card: #221f1c; --ink: #f4efe8; --quiet: #b9b1a6; --line: #38332e; --accent: #8fa8ff; --on-accent: #171513; } }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 1rem/1.5 -apple-system, system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.75em; line-height: 1.2; margin: 0 0 0.3em; }
  h2 { font-size: 1.25em; margin: 2em 0 0.6em; }
  h3 { font-size: 1.06em; margin: 0; }
  p { margin: 0.25em 0; }
  .lead, .facts, .beats { color: var(--quiet); }
  .facts, .beats { font-size: 0.875em; }
  .card { display: flex; gap: 16px; align-items: flex-start; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin: 12px 0; }
  .card > div { min-width: 0; overflow-wrap: anywhere; }
  .play { flex: 0 0 auto; min-width: 64px; min-height: 44px; padding: 0.4em 1em; border-radius: 999px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-weight: 600; cursor: pointer; }
  .play:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .beats { margin: 0.4em 0 0; padding-left: 1.25em; }
  .haptic { font-weight: 600; min-height: 1.5em; }
  code { font-size: 0.93em; }
</style>
</head>
<body>
<main>
  <h1>Luvani sound audition</h1>
  <p class="lead">Twelve original sounds, synthesised for Luvani from recipe version ${RECIPE_VERSION}. These are the exact AAC files the app would ship. Listen on your phone's speaker and on headphones.</p>
  <p class="lead">No sound plays in the app until you approve it. Tell Claude in chat which ones you approve, and which to change.</p>
  <h2>Each sound</h2>${cards}
  <h2>In context</h2>
  <p class="lead">Each moment's sounds in order. A laptop cannot buzz, so the haptic beats appear as text while the reel plays.</p>${reels}
</main>
<script>
const SOUNDS = ${JSON.stringify(Object.fromEntries(data.map((s) => [s.id, s.audio])))};
const REELS = ${JSON.stringify(REELS)};
let context = null;
const buffers = new Map();
async function ready() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') await context.resume();
  if (buffers.size === 0) {
    for (const [id, base64] of Object.entries(SOUNDS)) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      buffers.set(id, await context.decodeAudioData(bytes.buffer));
    }
  }
  return context;
}
function play(id, when) {
  const source = context.createBufferSource();
  source.buffer = buffers.get(id);
  source.connect(context.destination);
  source.start(when);
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button.play');
  if (!button) return;
  await ready();
  const start = context.currentTime + 0.08;
  if (button.dataset.sound) { play(button.dataset.sound, start); return; }
  const index = Number(button.dataset.reel);
  const label = document.querySelector('[data-haptic-for="' + index + '"]');
  for (const beat of REELS[index].beats) {
    if (beat.sound) play(beat.sound, start + beat.at / 1000);
    if (beat.haptic) setTimeout(() => { label.textContent = 'Haptic: ' + beat.haptic; }, 80 + beat.at);
  }
  const end = Math.max(...REELS[index].beats.map((beat) => beat.at)) + 1200;
  setTimeout(() => { label.textContent = ''; }, end);
});
</script>
</body>
</html>
`;
}
