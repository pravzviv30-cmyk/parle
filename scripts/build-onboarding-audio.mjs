/** The recorded first-run exchange: the three tutor lines in `apps/mobile/src/onboarding/tutorLines.ts`,
 * in the default tutor's voice. Approved 2026-09-27 with a hard cap of 300 credits.
 *
 * Dry run by default. --generate spends within the cap; --resume continues a stopped batch and never
 * re-requests saved speech; --verify decodes the bundled files offline and measures their level (add
 * --level to correct the encoding gain locally, never by synthesising again). Same model, settings,
 * -4 dB level and guards as scripts/build-daily-tutor-audio.mjs. Credentials belong in the build
 * environment, never in the app.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ELEVEN_VOICES, VOICE_SETTINGS, LANGUAGE_CODE } from '../services/tutor-agent/src/voice.ts';
import { MODEL, GAIN_DB, MULTIPLIERS, hash, reserveRequest, estimateCredits } from './daily-tutor-plan.mjs';
import { TUTOR_LINES, TUTOR_LINES_VOICE } from '../apps/mobile/src/onboarding/tutorLines.ts';

const CAP = 300;
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'artifacts/onboarding-audio');
const assets = resolve(root, 'apps/mobile/assets/onboarding');
const checkpointPath = resolve(dir, 'manifest.json');
const voice = TUTOR_LINES_VOICE;
const voiceId = ELEVEN_VOICES[voice];
if (!voiceId) throw new Error(`Unknown voice ${voice}.`);
const config = { model: MODEL, gainDb: GAIN_DB, settings: VOICE_SETTINGS, language: LANGUAGE_CODE, voice, voiceId, format: 'pcm_22050', encoding: 'aac_64000', cap: CAP };
const entries = Object.values(TUTOR_LINES).map(({ id, fr }) => ({ id, text: fr }));
const fingerprint = hash(JSON.stringify({ config, entries }));
const jobs = entries.map(item => ({
  ...item,
  key: `${voice}:${item.id}`,
  file: `${voice}/${hash(JSON.stringify({ config, voice, text: item.text })).slice(0, 24)}.m4a`,
  estimate: estimateCredits(item.text, voice),
  reserve: Math.ceil(item.text.length * MULTIPLIERS[voice]),
}));
const estimatedCredits = jobs.reduce((sum, job) => sum + job.estimate, 0);
if (jobs.reduce((sum, job) => sum + job.reserve, 0) > CAP) throw new Error('Plan exceeds approved cap.');

function measure(path, raw) {
  const decoded = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', path, '-f', 'f32le', '-ar', '22050', '-ac', '1', '-'], { maxBuffer: 8 * 1024 * 1024 });
  if (decoded.status !== 0) throw new Error(`Decode: ${path}`);
  let inputEnergy = 0, outputEnergy = 0, peak = 0;
  for (let i = 0; i < raw.length; i += 2) inputEnergy += (raw.readInt16LE(i) / 32768) ** 2;
  for (let i = 0; i < decoded.stdout.length; i += 4) {
    const value = decoded.stdout.readFloatLE(i);
    if (!Number.isFinite(value)) throw new Error(`Non-finite audio: ${path}`);
    outputEnergy += value ** 2; peak = Math.max(peak, Math.abs(value));
  }
  return { gain: inputEnergy > 0 ? 10 * Math.log10(outputEnergy / inputEnergy) : NaN, seconds: decoded.stdout.length / 4 / 22050, peak };
}

function encodeTo(rawPath, gainDb, output) {
  const encoded = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', '22050', '-ac', '1', '-i', rawPath, '-af', `volume=${gainDb}dB`, '-c:a', 'aac', '-b:a', '64000', '-movflags', '+faststart', output], { encoding: 'utf8' });
  if (encoded.status !== 0) throw new Error('Local encoding failed; paid PCM is preserved.');
}

const writeJson = (path, value) => {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${path}.tmp`, path);
};

if (process.argv.includes('--verify')) {
  const manifest = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (manifest.status !== 'complete') throw new Error('Batch is not complete.');
  const level = process.argv.includes('--level');
  const results = [];
  for (const clip of Object.values(manifest.clips)) {
    const rawPath = resolve(dir, clip.raw);
    const raw = readFileSync(rawPath);
    const path = resolve(assets, clip.file);
    if (hash(raw) !== clip.rawSha256 || hash(readFileSync(path)) !== clip.sha256) throw new Error(`Integrity: ${clip.file}`);
    let measured = measure(path, raw);
    // Short AAC clips can miss the PCM attenuation. Correct only the encoding gain, damped, as the
    // daily verifier does; the paid source is never changed or re-requested.
    if (level && Number.isFinite(measured.gain) && Math.abs(measured.gain - GAIN_DB) > 0.25) {
      let encodingGain = clip.encodingGainDb ?? GAIN_DB;
      const temp = `${path}.level.m4a`;
      for (let attempt = 0; attempt < 16 && Math.abs(measured.gain - GAIN_DB) > 0.25; attempt++) {
        encodingGain += (GAIN_DB - measured.gain) * 0.5;
        encodeTo(rawPath, encodingGain, temp);
        measured = measure(temp, raw);
      }
      if (!Number.isFinite(measured.gain) || Math.abs(measured.gain - GAIN_DB) > 0.25) throw new Error(`Level correction did not converge: ${clip.file}`);
      const bytes = readFileSync(temp);
      clip.beforeLevelSha256 ??= clip.sha256;
      clip.sha256 = hash(bytes); clip.bytes = bytes.length; clip.encodingGainDb = encodingGain;
      renameSync(temp, path);
      writeJson(checkpointPath, manifest);
    }
    const { gain, seconds, peak } = measured;
    if (!Number.isFinite(gain) || Math.abs(gain - GAIN_DB) > 0.25) throw new Error(`Gain ${gain}: ${clip.file}`);
    if (Math.abs(seconds - clip.seconds) > 0.12 || peak >= 1 || seconds < 0.15 || seconds > 30) throw new Error(`Duration/peak: ${clip.file}`);
    results.push({ id: clip.id, file: clip.file, sha256: clip.sha256, gainDb: gain, seconds, peak });
  }
  const result = { verifiedAt: new Date().toISOString(), fingerprint: manifest.fingerprint, count: results.length, maxGainErrorDb: Math.max(...results.map(r => Math.abs(r.gainDb - GAIN_DB))), maxPeak: Math.max(...results.map(r => r.peak)), clips: results };
  writeJson(resolve(dir, 'audio-verification.json'), result);
  console.log(JSON.stringify({ count: result.count, maxGainErrorDb: result.maxGainErrorDb, maxPeak: result.maxPeak, seconds: results.map(r => Number(r.seconds.toFixed(2))) }));
  process.exit(0);
}

console.log(JSON.stringify({ voice, clips: jobs.length, estimatedCredits, reserved: jobs.reduce((sum, job) => sum + job.reserve, 0), cap: CAP, fingerprint }));
if (!process.argv.includes('--generate')) process.exit(0);
if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY missing.');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('ffmpeg required before spending.');
mkdirSync(dir, { recursive: true });
// Exclusive process lock. A crash leaves the lock for explicit operator review.
const lockPath = resolve(dir, 'generation.lock');
closeSync(openSync(lockPath, 'wx'));
let manifest;
const checkpoint = () => writeJson(checkpointPath, manifest);
const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
async function metadata(path) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Metadata HTTP ${response.status}; no paid retry.`);
  return response.json();
}
function encode(job, clip) {
  const rawPath = resolve(dir, clip.raw);
  const bytes = readFileSync(rawPath);
  if (hash(bytes) !== clip.rawSha256 || bytes.length < 2205 || bytes.length % 2) throw new Error('Saved PCM integrity failed.');
  const output = resolve(assets, job.file);
  mkdirSync(resolve(assets, voice), { recursive: true });
  if (existsSync(output)) {
    if (!clip.sha256 || hash(readFileSync(output)) !== clip.sha256) throw new Error('Unverified output exists; refusing overwrite.');
  } else {
    const temp = `${output}.tmp.m4a`;
    encodeTo(rawPath, GAIN_DB, temp);
    const data = readFileSync(temp);
    if (data.length < 1000 || data.subarray(4, 8).toString() !== 'ftyp') throw new Error('Invalid encoded audio.');
    clip.sha256 = hash(data); clip.bytes = data.length;
    checkpoint();
    renameSync(temp, output);
  }
  clip.status = 'complete';
  checkpoint();
}
try {
  if (existsSync(checkpointPath) && !process.argv.includes('--resume')) throw new Error('Saved batch exists; explicit --resume required.');
  manifest = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : null;
  if (manifest && manifest.fingerprint !== fingerprint) throw new Error('Frozen batch/config changed.');
  const sub = await metadata('/v1/user/subscription');
  if (![sub.character_count, sub.character_limit].every(Number.isFinite)) throw new Error('Balance unavailable.');
  const current = { used: sub.character_count, limit: sub.character_limit, nextReset: sub.next_character_count_reset_unix };
  if (!manifest && current.limit - current.used < CAP) throw new Error('Insufficient balance for approved cap.');
  manifest ??= { version: 1, fingerprint, config, entries, estimatedCredits, before: current, createdAt: new Date().toISOString(), status: 'running', clips: {} };
  let accounted = Object.values(manifest.clips).reduce((sum, clip) => sum + (clip.cost ?? clip.reserve), 0);
  if (current.limit - current.used < CAP - accounted) throw new Error('Available balance changed; stop for review.');
  const meta = await metadata(`/v1/voices/${voiceId}`);
  if (Number(meta.sharing?.rate ?? 1) !== MULTIPLIERS[voice] || !meta.verified_languages?.some(l => l.language === 'fr' && l.model_id === MODEL)) throw new Error(`Voice pricing/verification changed: ${voice}`);
  const samples = JSON.parse(readFileSync(resolve(root, 'artifacts/voice-comparison-2026-09-19/manifest.json'), 'utf8'));
  if (JSON.stringify(samples.settings) !== JSON.stringify(VOICE_SETTINGS) || samples.language !== LANGUAGE_CODE) throw new Error('Approved sample settings mismatch.');
  manifest.status = 'running'; delete manifest.reason; checkpoint();
  for (const job of jobs) {
    let clip = manifest.clips[job.key];
    if (clip) {
      if (clip.status === 'complete') continue;
      if (!clip.rawSha256 || !existsSync(resolve(dir, clip.raw))) throw new Error(`Uncertain prior request ${job.key}; never automatically regenerate.`);
      encode(job, clip);
      continue;
    }
    clip = { id: job.id, text: job.text, voice, file: job.file, raw: `${hash(job.key).slice(0, 24)}.pcm`, reserve: job.reserve, status: 'pending' };
    accounted = reserveRequest(accounted, job.reserve, CAP);
    manifest.clips[job.key] = clip; checkpoint(); // Durable reservation before spending.
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_22050&optimize_streaming_latency=3`, {
      method: 'POST', headers, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ text: job.text, model_id: MODEL, language_code: LANGUAGE_CODE, voice_settings: VOICE_SETTINGS }),
    });
    if (!response.ok) { clip.httpStatus = response.status; checkpoint(); throw new Error(`Synthesis HTTP ${response.status}; no automatic retry.`); }
    const costHeader = response.headers.get('character-cost');
    const cost = costHeader === null ? NaN : Number(costHeader);
    if (Number.isFinite(cost) && cost >= 0) { clip.cost = cost; accounted += cost - job.reserve; }
    checkpoint(); // Save confirmed billing before decoding or encoding.
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2205 || bytes.length % 2) throw new Error('Invalid PCM; no paid retry.');
    writeFileSync(resolve(dir, clip.raw), bytes);
    clip.rawSha256 = hash(bytes); clip.seconds = bytes.length / 44100; clip.status = 'synthesized'; checkpoint();
    if (!Number.isFinite(cost) || cost > job.estimate) { manifest.reason = 'Observed cost differs from the approved estimate; saved speech kept, stop for review.'; throw new Error(manifest.reason); }
    encode(job, clip);
  }
  manifest.accountedCredits = accounted;
  if (jobs.some(job => manifest.clips[job.key]?.status !== 'complete')) throw new Error('Incomplete batch; app map unchanged.');
  // Only a complete batch becomes reachable by the app.
  writeFileSync(resolve(root, 'apps/mobile/src/onboarding/tutorLineAudio.ts'), `// Generated by scripts/build-onboarding-audio.mjs. Flash v2.5, -4 dB, ${voice} only.\nexport const TUTOR_LINE_AUDIO: Readonly<Record<string, number>> = {\n${jobs.map(job => `  ${JSON.stringify(job.id)}: require('../../assets/onboarding/${job.file}'),`).join('\n')}\n};\n`);
  manifest.status = 'complete'; manifest.completedAt = new Date().toISOString(); checkpoint();
  console.log(JSON.stringify({ status: 'complete', clips: jobs.length, accountedCredits: accounted, seconds: jobs.map(job => Number(manifest.clips[job.key].seconds.toFixed(2))) }));
} catch (error) {
  if (manifest) { manifest.status = 'stopped'; manifest.reason = error.message; checkpoint(); }
  throw error;
} finally { unlinkSync(lockPath); }
