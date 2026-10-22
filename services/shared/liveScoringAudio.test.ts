import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCORING_MAX_SAMPLES, toSpeechaceWav } from './liveScoringAudio.ts';
import { pcmAudioMillis } from './paidExecution.ts';

/** A 16-bit PCM WAV the way the utterance tap writes one. */
function tapWav(rate: number, channels: number, seconds: number, sample: (frame: number, channel: number) => number): Buffer {
  const frames = Math.round(rate * seconds);
  const bytes = frames * channels * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(bytes, 40);
  for (let f = 0; f < frames; f += 1) for (let c = 0; c < channels; c += 1) buf.writeInt16LE(sample(f, c), 44 + (f * channels + c) * 2);
  return buf;
}

test('a 48 kHz stereo tap becomes the gate\'s exact 16 kHz mono WAV, at the same length', () => {
  const out = toSpeechaceWav(tapWav(48_000, 2, 1.5, (f) => Math.round(8000 * Math.sin(f / 20))));
  assert.equal(pcmAudioMillis(out), 1500, 'the paid gate accepts it and reads the right duration');
});

test('channels are averaged, not summed', () => {
  const out = Buffer.from(toSpeechaceWav(tapWav(16_000, 2, 0.1, (_f, c) => (c === 0 ? 20_000 : 10_000))));
  assert.equal(out.readInt16LE(44), 15_000);
});

test('a tap longer than the gate allows is cut to 30 s rather than refused', () => {
  const out = toSpeechaceWav(tapWav(16_000, 1, 31, () => 0));
  assert.equal(out.length, 44 + SCORING_MAX_SAMPLES * 2);
  assert.equal(pcmAudioMillis(out), 30_000);
});

test('anything that is not 16-bit PCM WAV is refused, never forwarded', () => {
  assert.throws(() => toSpeechaceWav(Buffer.from('not audio at all, just some bytes padded out to length....')), /live-audio-not-wav/);
  const float = tapWav(16_000, 1, 0.1, () => 0); float.writeUInt16LE(3, 20);
  assert.throws(() => toSpeechaceWav(float), /live-audio-not-pcm16/);
  assert.throws(() => toSpeechaceWav(tapWav(16_000, 1, 0, () => 0)), /live-audio-empty|live-audio-unsupported/);
});

/** Root-mean-square of the PCM in a 16 kHz mono WAV, skipping the filter's edges. */
function rms(wav: Uint8Array): number {
  const buf = Buffer.from(wav);
  const samples = (buf.length - 44) / 2;
  let sum = 0, n = 0;
  for (let i = 200; i < samples - 200; i += 1) { const v = buf.readInt16LE(44 + i * 2); sum += v * v; n += 1; }
  return Math.sqrt(sum / n);
}

test('energy above the new 8 kHz limit is filtered out instead of folding back into the scored band', () => {
  const tone = (hz: number) => tapWav(48_000, 1, 0.5, (f) => Math.round(10_000 * Math.sin((2 * Math.PI * hz * f) / 48_000)));
  const kept = rms(toSpeechaceWav(tone(1_000)));
  const aliased = rms(toSpeechaceWav(tone(20_000)));
  assert.ok(kept > 6_000, `speech-band audio survives (rms ${Math.round(kept)})`);
  assert.ok(aliased < 300, `a 20 kHz tone does not reappear at 4 kHz (rms ${Math.round(aliased)})`);
});
