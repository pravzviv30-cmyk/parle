/** Offline only: decode every completed recording, check hashes, duration and
 * measured energy gain against the saved paid PCM. Never synthesizes speech.
 */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hash } from './daily-tutor-plan.mjs';
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'artifacts/daily-tutor-batch-1');
const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
if (manifest.status !== 'complete') throw new Error('Pack is not complete.');
if (existsSync(resolve(dir, 'generation.lock'))) throw new Error('Generation is still running.');
const level = process.argv.includes('--level');
const results = [];
let adjusted = 0;
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
for (const clip of Object.values(manifest.clips)) {
  const raw = readFileSync(resolve(dir, clip.raw));
  const path = resolve(root, 'apps/mobile/assets/daily-tutors', clip.file);
  if (hash(raw) !== clip.rawSha256 || hash(readFileSync(path)) !== clip.sha256) throw new Error(`Integrity: ${clip.file}`);
  let measurements = measure(path, raw);
  // Short AAC clips can deviate from the PCM attenuation. Correct only the
  // encoding gain locally, retaining pitch/timing and the paid source unchanged.
  // Never normalize voices to a common loudness or make another speech request.
  if (level && Number.isFinite(measurements.gain) && Math.abs(measurements.gain + 4) > 0.25) {
    let encodingGain = clip.encodingGainDb ?? -4;
    const temp = `${path}.level.m4a`;
    for (let attempt = 0; attempt < 16 && Math.abs(measurements.gain + 4) > 0.25; attempt++) {
      // Damp updates because AAC's quantizer can change discontinuously near a
      // coding threshold, especially on sub-second words. The decoder is truth.
      encodingGain += (-4 - measurements.gain) * 0.5;
      const encoded = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', '22050', '-ac', '1', '-i', resolve(dir, clip.raw), '-af', `volume=${encodingGain}dB`, '-c:a', 'aac', '-b:a', '64000', '-movflags', '+faststart', temp]);
      if (encoded.status !== 0) throw new Error('Local level correction failed; original preserved.');
      measurements = measure(temp, raw);
    }
    if (!Number.isFinite(measurements.gain) || Math.abs(measurements.gain + 4) > 0.25) throw new Error(`Level correction did not converge: ${clip.file}`);
    const bytes = readFileSync(temp);
    clip.beforeLevelSha256 ??= clip.sha256;
    clip.sha256 = hash(bytes); clip.bytes = bytes.length; clip.encodingGainDb = encodingGain;
    renameSync(temp, path);
    writeFileSync(resolve(dir, 'manifest.json.tmp'), JSON.stringify(manifest, null, 2) + '\n');
    renameSync(resolve(dir, 'manifest.json.tmp'), resolve(dir, 'manifest.json'));
    adjusted++;
  }
  const { gain, seconds, peak } = measurements;
  if (!Number.isFinite(gain) || Math.abs(gain - manifest.config.gainDb) > 0.25) throw new Error(`Gain ${gain}: ${clip.file}`);
  if (Math.abs(seconds - clip.seconds) > 0.12 || peak >= 1 || seconds < 0.15 || seconds > 30) throw new Error(`Duration/peak: ${clip.file}`);
  results.push({ file: clip.file, sha256: clip.sha256, gainDb: gain, seconds, peak });
  if (results.length % 200 === 0) console.log(`Decoded and measured ${results.length}/2400`);
}
const result = { verifiedAt: new Date().toISOString(), fingerprint: manifest.fingerprint, count: results.length, adjusted, maxGainErrorDb: Math.max(...results.map(r => Math.abs(r.gainDb + 4))), maxPeak: Math.max(...results.map(r => r.peak)), clips: results };
writeFileSync(resolve(dir, 'audio-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ count: result.count, maxGainErrorDb: result.maxGainErrorDb, maxPeak: result.maxPeak }));
