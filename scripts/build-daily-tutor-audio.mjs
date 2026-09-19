/** Approved batch 1 only. Dry-run by default; --generate spends at most 25,000
 * credits. --resume skips saved speech and refuses uncertain requests. No runtime
 * import. Credentials belong in the build environment, never in the app.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DAILY_WORDS, DAILY_PHRASES } from '../packages/core/src/daily/index.ts';
import { ELEVEN_VOICES, VOICE_SETTINGS, LANGUAGE_CODE } from '../services/tutor-agent/src/voice.ts';
import { CAP, MODEL, GAIN_DB, MULTIPLIERS, hash, selectBatch, reserveRequest, estimateCredits } from './daily-tutor-plan.mjs';

const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'artifacts/daily-tutor-batch-1');
const assets = resolve(root, 'apps/mobile/assets/daily-tutors');
const checkpointPath = resolve(dir, 'manifest.json');
const words = selectBatch(DAILY_WORDS), phrases = selectBatch(DAILY_PHRASES);
const config = { model: MODEL, gainDb: GAIN_DB, settings: VOICE_SETTINGS, language: LANGUAGE_CODE, voices: ELEVEN_VOICES, format: 'pcm_22050', encoding: 'aac_64000', cap: CAP };
const entries = [...words, ...phrases].map(({ id, fr, tier }) => ({ id, text: fr, tier }));
const fingerprint = hash(JSON.stringify({ config, entries }));
const jobs = entries.flatMap(item => Object.entries(ELEVEN_VOICES).map(([voice, voiceId]) => ({
  ...item, voice, voiceId,
  key: `${voice}:${item.id}`,
  file: `${voice}/${hash(JSON.stringify({ config, voice, text: item.text })).slice(0, 24)}.m4a`,
  estimate: estimateCredits(item.text, voice),
  reserve: Math.ceil(item.text.length * MULTIPLIERS[voice]),
})));
const estimatedCredits = jobs.reduce((sum, job) => sum + job.estimate, 0);
if (estimatedCredits > CAP) throw new Error('Plan exceeds approved cap.');
console.log(JSON.stringify({ words: words.length, phrases: phrases.length, clips: jobs.length, estimatedCredits, cap: CAP, fingerprint }));
if (!process.argv.includes('--generate')) process.exit(0);
if (!process.env.ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY missing.');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('ffmpeg required before spending.');
mkdirSync(dir, { recursive: true });
// Exclusive process lock. A crash leaves the lock for explicit operator review.
const lockPath = resolve(dir, 'generation.lock');
const lock = openSync(lockPath, 'wx');
closeSync(lock);
let manifest;
const checkpoint = () => {
  writeFileSync(`${checkpointPath}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
  renameSync(`${checkpointPath}.tmp`, checkpointPath);
};
const headers = { 'xi-api-key': process.env.ELEVEN_API_KEY, 'Content-Type': 'application/json' };
async function metadata(path) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Metadata HTTP ${response.status}; no paid retry.`);
  return response.json();
}
function encode(job, clip) {
  const raw = resolve(dir, clip.raw);
  const bytes = readFileSync(raw);
  if (hash(bytes) !== clip.rawSha256 || bytes.length < 2205 || bytes.length % 2) throw new Error('Saved PCM integrity failed.');
  const output = resolve(assets, job.file);
  mkdirSync(resolve(assets, job.voice), { recursive: true });
  if (existsSync(output)) {
    if (!clip.sha256 || hash(readFileSync(output)) !== clip.sha256) throw new Error('Unverified output exists; refusing overwrite.');
  } else {
    const temp = `${output}.tmp.m4a`;
    // Temporary encoder output may be retried locally; synthesis never is.
    const encoded = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', '22050', '-ac', '1', '-i', raw, '-af', `volume=${GAIN_DB}dB`, '-c:a', 'aac', '-b:a', '64000', '-movflags', '+faststart', temp], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error('Local encoding failed; paid PCM is preserved.');
    const data = readFileSync(temp);
    if (data.length < 1000 || data.subarray(4, 8).toString() !== 'ftyp') throw new Error('Invalid encoded audio.');
    clip.sha256 = hash(data); clip.bytes = data.length;
    checkpoint(); // A crash after rename can verify output on resume.
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
  for (const [voice, id] of Object.entries(ELEVEN_VOICES)) {
    const meta = await metadata(`/v1/voices/${id}`);
    if (Number(meta.sharing?.rate ?? 1) !== MULTIPLIERS[voice] || !meta.verified_languages?.some(l => l.language === 'fr' && l.model_id === MODEL)) throw new Error(`Voice pricing/verification changed: ${voice}`);
  }
  manifest.estimatedCredits = estimatedCredits;
  manifest.status = 'running'; delete manifest.reason; checkpoint();
  const sampleDir = resolve(root, 'artifacts/voice-comparison-2026-09-19');
  const samples = JSON.parse(readFileSync(resolve(sampleDir, 'manifest.json'), 'utf8'));
  if (JSON.stringify(samples.settings) !== JSON.stringify(VOICE_SETTINGS) || samples.language !== LANGUAGE_CODE) throw new Error('Approved sample settings mismatch.');
  let cursor = 0, completed = 0, halted = false;
  async function worker() {
    while (!halted && cursor < jobs.length) {
      const job = jobs[cursor++];
      let clip = manifest.clips[job.key];
      if (clip) {
        if (!clip.rawSha256 || !existsSync(resolve(dir, clip.raw))) throw new Error(`Uncertain prior request ${job.key}; never automatically regenerate.`);
        encode(job, clip);
      } else {
        const sample = samples.clips.find(s => s.voice === job.voice && s.model === MODEL && s.contentId === job.id && s.text === job.text);
        clip = { id: job.id, text: job.text, voice: job.voice, file: job.file, raw: `${hash(job.key).slice(0, 24)}.pcm`, reserve: job.reserve, status: 'pending' };
        let bytes;
        if (sample) {
          bytes = readFileSync(resolve(sampleDir, sample.file.replace('.m4a', '.pcm')));
          if (hash(bytes) !== sample.sha256) throw new Error('Approved sample integrity mismatch.');
          clip.cost = 0; clip.reusedSample = sample.file;
          manifest.clips[job.key] = clip; checkpoint();
        } else {
          accounted = reserveRequest(accounted, job.reserve);
          manifest.clips[job.key] = clip; checkpoint(); // Durable reservation before spending.
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${job.voiceId}?output_format=pcm_22050&optimize_streaming_latency=3`, {
            method: 'POST', headers, signal: AbortSignal.timeout(45000),
            body: JSON.stringify({ text: job.text, model_id: MODEL, language_code: LANGUAGE_CODE, voice_settings: VOICE_SETTINGS }),
          });
          if (!response.ok) { clip.httpStatus = response.status; checkpoint(); throw new Error(`Synthesis HTTP ${response.status}; no automatic retry.`); }
          const costHeader = response.headers.get('character-cost');
          const cost = costHeader === null ? NaN : Number(costHeader);
          if (Number.isFinite(cost) && cost >= 0) { clip.cost = cost; accounted += cost - job.reserve; }
          checkpoint(); // Save confirmed billing before decoding/encoding/metadata.
          bytes = Buffer.from(await response.arrayBuffer());
          if (!Number.isFinite(cost) || cost > job.estimate) { halted = true; manifest.reason = 'Observed cost differs from approved estimate; saved speech only, stop for review.'; }
        }
        if (bytes.length < 2205 || bytes.length % 2) throw new Error('Invalid PCM; no paid retry.');
        writeFileSync(resolve(dir, clip.raw), bytes);
        clip.rawSha256 = hash(bytes); clip.seconds = bytes.length / 44100; clip.status = 'synthesized'; checkpoint();
        encode(job, clip);
      }
      completed++;
      if (completed % 24 === 0) console.log(JSON.stringify({ completed, total: jobs.length, accountedCredits: accounted }));
    }
  }
  // Two independent requests, both reserved synchronously before their await.
  const results = await Promise.allSettled([0, 1].map(async () => { try { await worker(); } catch (error) { halted = true; throw error; } }));
  manifest.accountedCredits = accounted;
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  if (halted || jobs.some(job => manifest.clips[job.key]?.status !== 'complete')) throw new Error(manifest.reason ?? 'Incomplete pack; app manifest unchanged.');
  // Only a complete all-six-voice pack becomes reachable by the app.
  const sourceDir = resolve(root, 'apps/mobile/src/daily');
  writeFileSync(resolve(sourceDir, 'voicedSelection.ts'), `// Frozen batch 1. Add future batches; never replace existing IDs.\nexport const VOICED_WORD_IDS: readonly string[] = ${JSON.stringify(words.map(w => w.id), null, 2)};\nexport const VOICED_PHRASE_IDS: readonly string[] = ${JSON.stringify(phrases.map(p => p.id), null, 2)};\n`);
  writeFileSync(resolve(sourceDir, 'tutorAudioManifest.ts'), `// Generated by scripts/build-daily-tutor-audio.mjs. Flash v2.5, -4 dB.\nimport type { TutorVoiceKey } from '@luvani/core';\nexport const TUTOR_DAILY_AUDIO: Readonly<Record<TutorVoiceKey, Readonly<Record<string, number>>>> = {\n${Object.keys(ELEVEN_VOICES).map(voice => `  ${voice}: {\n${jobs.filter(j => j.voice === voice).map(j => `    ${JSON.stringify(j.id)}: require('../../assets/daily-tutors/${j.file}'),`).join('\n')}\n  },`).join('\n')}\n};\n`);
  manifest.status = 'complete'; manifest.completedAt = new Date().toISOString(); checkpoint();
  console.log(JSON.stringify({ status: 'complete', clips: jobs.length, accountedCredits: accounted, reused: Object.values(manifest.clips).filter(c => c.reusedSample).length, bytes: Object.values(manifest.clips).reduce((sum, c) => sum + c.bytes, 0) }));
} catch (error) {
  if (manifest) { manifest.status = 'stopped'; manifest.reason = error.message; checkpoint(); }
  throw error;
} finally { unlinkSync(lockPath); }
