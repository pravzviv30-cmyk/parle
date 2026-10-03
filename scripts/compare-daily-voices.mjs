/** One approved, capped listening experiment. Never imported by the app.
 * Dry run: node --experimental-strip-types scripts/compare-daily-voices.mjs
 * Generate: add --generate with ELEVEN_API_KEY loaded by Node's --env-file.
 * An existing manifest prevents re-billing; uncertain attempts are never retried.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DAILY_WORDS, DAILY_PHRASES } from '../packages/core/src/daily/index.ts';
import { RECORDING_LANGUAGE } from './daily-tutor-plan.mjs';
import { ELEVEN_VOICES, MODEL, VOICE_SETTINGS } from '../services/tutor-agent/src/voice.ts';

const CAP = 500;
const destination = resolve('artifacts/voice-comparison-2026-09-19');
const manifestPath = resolve(destination, 'manifest.json');
const texts = [
  { kind: 'word', ...DAILY_WORDS.find(w => w.id === 'word:un-pourboire') },
  { kind: 'phrase', ...DAILY_PHRASES.find(p => p.id === 'phrase:situation:friends-phone-number:0') },
];
if (texts.some(t => !t.fr)) throw new Error('The sample must come from both authored daily collections.');
const expectedMultipliers = { alexandre: 1, emilie: 2, guillaume: 1, marie: 1, anatole: 1, sarah: 2 };
const models = [{ label: 'flash', id: 'eleven_flash_v2_5', rate: 0.5 }, { label: 'current', id: MODEL, rate: 1 }];
const plan = Object.entries(ELEVEN_VOICES).flatMap(([voice, voiceId]) => models.flatMap(model => texts.map(text => ({
  voice, voiceId, model, text,
  estimate: Math.ceil(text.fr.length * expectedMultipliers[voice] * model.rate),
  reserve: Math.ceil(text.fr.length * expectedMultipliers[voice]),
}))));
const estimatedCredits = plan.reduce((n, p) => n + p.estimate, 0);
if (estimatedCredits > CAP) throw new Error('Sample plan exceeds the approved cap.');
console.log(JSON.stringify({ requests: plan.length, estimatedCredits, cap: CAP, texts: texts.map(t => t.fr), destination }));
if (!process.argv.includes('--generate')) process.exit(0);
const resume = process.argv.includes('--resume');
if (existsSync(manifestPath) && !resume) throw new Error('Manifest already exists. No automatic retry or regeneration is allowed.');
if (resume && !existsSync(manifestPath)) throw new Error('No experiment to resume.');
if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY is missing.');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('ffmpeg is required before spending credits.');
const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
async function json(path) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Metadata HTTP ${response.status}; generation stopped.`);
  return response.json();
}
async function subscription() {
  const s = await json('/v1/user/subscription');
  if (![s.character_count, s.character_limit].every(Number.isFinite)) throw new Error('Credit balance unavailable.');
  return { tier: s.tier, used: s.character_count, limit: s.character_limit };
}
// Metadata is read-only. Stop if the six-voice price or language assumptions moved.
for (const [voice, id] of (resume ? [] : Object.entries(ELEVEN_VOICES))) {
  const metadata = await json(`/v1/voices/${id}`);
  if (Number(metadata.sharing?.rate ?? 1) !== expectedMultipliers[voice]) throw new Error(`Rate changed for ${voice}.`);
  for (const model of models) {
    if (!metadata.verified_languages?.some(l => l.language === 'fr' && l.model_id === model.id)) throw new Error(`French verification missing: ${voice}/${model.label}`);
  }
}
const saved = resume ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
if (saved && (saved.cap !== CAP || JSON.stringify(saved.settings) !== JSON.stringify(VOICE_SETTINGS) || saved.language !== RECORDING_LANGUAGE)) throw new Error('Experiment settings changed.');
const current = await subscription();
const before = saved?.before ?? current;
if (current.limit - current.used < CAP) throw new Error('Insufficient credit headroom.');
mkdirSync(destination, { recursive: true });
const manifest = saved ?? { createdAt: new Date().toISOString(), cap: CAP, estimatedCredits, before, settings: VOICE_SETTINGS, language: RECORDING_LANGUAGE, format: 'pcm_22050', clips: [], status: 'running' };
const checkpoint = () => writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
checkpoint();
let accounted = manifest.clips.reduce((n, clip) => n + (Number.isFinite(clip.responseCredits) ? clip.responseCredits : clip.reservedCredits), 0);
try {
  for (const entry of plan) {
    const file = `${entry.voice}-${entry.model.label}-${entry.text.kind}`;
    const prior = manifest.clips.find(c => c.file === `${file}.m4a`);
    if (prior) {
      if (prior.text !== entry.text.fr || prior.model !== entry.model.id) throw new Error('Sample content changed.');
      if (!existsSync(resolve(destination, prior.file))) throw new Error('Uncertain earlier request; do not regenerate automatically.');
      // A saved clip is never synthesized again, even when a later balance read failed.
      if (prior.status !== 'complete') prior.status = 'saved-cost-unconfirmed';
      continue;
    }
    const used = accounted;
    if (used + entry.reserve > CAP) throw new Error('Conservative credit guard reached; no further request sent.');
    const clip = { voice: entry.voice, model: entry.model.id, kind: entry.text.kind, text: entry.text.fr, contentId: entry.text.id, file: `${file}.m4a`, reservedCredits: entry.reserve, status: 'pending' };
    manifest.clips.push(clip);
    accounted = used + entry.reserve;
    checkpoint(); // Record before the billed request, including timeout/crash cases.
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${entry.voiceId}?output_format=pcm_22050&optimize_streaming_latency=3`, {
      method: 'POST', headers, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ text: entry.text.fr, model_id: entry.model.id, language_code: RECORDING_LANGUAGE, voice_settings: VOICE_SETTINGS }),
    });
    if (!response.ok) throw new Error(`Synthesis HTTP ${response.status}; no retry.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2205 || bytes.length % 2 !== 0) throw new Error('Invalid PCM result; no retry.');
    const pcm = resolve(destination, `${file}.pcm`);
    writeFileSync(pcm, bytes);
    // Identical production-quality encoding for both models. No model-specific EQ.
    const encoded = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-n', '-f', 's16le', '-ar', '22050', '-ac', '1', '-i', pcm, '-c:a', 'aac', '-b:a', '64000', resolve(destination, clip.file)], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error('Audio encoding failed; original PCM preserved.');
    const costHeader = response.headers.get('character-cost');
    const cost = costHeader === null ? null : Number(costHeader);
    const confirmed = Number.isFinite(cost) && cost >= 0 ? cost : entry.reserve;
    accounted = used + confirmed;
    Object.assign(clip, { status: 'complete', responseCredits: cost, seconds: bytes.length / 2 / 22050, sha256: createHash('sha256').update(bytes).digest('hex') });
    checkpoint();
    console.log(JSON.stringify({ voice: entry.voice, model: entry.model.label, kind: entry.text.kind, responseCredits: cost, accounted }));
  }
  manifest.after = await subscription();
  manifest.measuredCredits = manifest.after.used - before.used;
  manifest.accountedCredits = accounted;
  manifest.status = 'complete';
  checkpoint();
  console.log(JSON.stringify({ status: manifest.status, measuredCredits: manifest.measuredCredits, destination }));
} catch (error) {
  manifest.status = 'stopped';
  manifest.reason = error.message;
  checkpoint();
  throw error;
}
