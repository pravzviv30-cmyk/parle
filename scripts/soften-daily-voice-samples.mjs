/** Local-only attenuation of the approved Flash listening samples.
 * No speech generation or network calls. Originals remain unchanged.
 * Run from the repository root: node scripts/soften-daily-voice-samples.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const folder = resolve('artifacts/voice-comparison-2026-09-19');
const manifest = JSON.parse(readFileSync(resolve(folder, 'manifest.json'), 'utf8'));
const gainDb = -4;
const gain = 10 ** (gainDb / 20);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const flash = manifest.clips.filter(c => c.model === 'eleven_flash_v2_5');
assert.equal(flash.length, 12, 'Expected one word and one phrase per tutor.');
const records = [];
for (const clip of flash) {
  assert.match(clip.file, /^[a-z]+-flash-(word|phrase)\.m4a$/);
  const stem = clip.file.replace(/\.m4a$/, '');
  const original = readFileSync(resolve(folder, `${stem}.pcm`));
  assert.equal(original.length % 2, 0);
  const adjusted = Buffer.alloc(original.length);
  let beforeSquares = 0;
  let afterSquares = 0;
  for (let i = 0; i < original.length; i += 2) {
    const before = original.readInt16LE(i);
    const after = Math.round(before * gain);
    assert.ok(Math.abs(after) <= Math.abs(before));
    adjusted.writeInt16LE(after, i);
    beforeSquares += before * before;
    afterSquares += after * after;
  }
  const measuredGainDb = 10 * Math.log10(afterSquares / beforeSquares);
  assert.ok(Math.abs(measuredGainDb - gainDb) < 0.01, 'Attenuation must be within 0.01 dB of the requested gain.');
  // Standard mono PCM WAV wrapper. Identical sample count/rate, no resampling.
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + adjusted.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(22050, 24); header.writeUInt32LE(44100, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36);
  header.writeUInt32LE(adjusted.length, 40);
  const output = `${stem}-moderate.wav`;
  const bytes = Buffer.concat([header, adjusted]);
  const path = resolve(folder, output);
  if (existsSync(path)) assert.equal(sha256(readFileSync(path)), sha256(bytes), 'Never replace a different review take.');
  else writeFileSync(path, bytes, { flag: 'wx' });
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,duration', '-of', 'json', path], { encoding: 'utf8' });
  assert.equal(probe.status, 0);
  const stream = JSON.parse(probe.stdout).streams[0];
  assert.equal(stream.sample_rate, '22050'); assert.equal(stream.channels, 1);
  assert.ok(Math.abs(Number(stream.duration) - original.length / 44100) < 0.00001);
  records.push({ voice: clip.voice, kind: clip.kind, source: `${stem}.pcm`, output, sourceSha256: sha256(original), outputSha256: sha256(bytes), gainDb, measuredGainDb });
}
writeFileSync(resolve(folder, 'moderate-levels.json'), JSON.stringify({
  purpose: 'User-requested quieter Flash samples. Original and current-model clips are unchanged.',
  apiCreditsUsed: 0, gainDb, sampleRate: 22050, records,
}, null, 2) + '\n');
console.log(JSON.stringify({ verifiedClips: records.length, gainDb, apiCreditsUsed: 0, originalsPreserved: true }));
