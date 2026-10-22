/**
 * Live lesson audio, made into the exact WAV the paid scoring gate accepts.
 *
 * The utterance tap already holds raw 16-bit PCM at whatever rate and channel
 * count the room delivers. The paid Speechace route only takes 16 kHz mono
 * 16-bit PCM with an exact header (`pcmAudioMillis` in paidExecution.ts), and
 * the only path that produced it was the ffmpeg decoder, which has no reviewed
 * binary under its 128 MiB bound (F805). There is nothing here to decode: the
 * samples are already PCM, so downmixing and resampling them in place is all
 * the live path needs, with no child process and no decoder slot.
 *
 * Compressed uploads (drills) still go through `decodeAudio`; this is for PCM
 * the worker captured itself.
 */

import { pcmWav } from './audioDecode.ts';

export const SCORING_SAMPLE_RATE = 16_000;
/** The gate's ceiling: 960,044 bytes is a 44-byte header and 30 s of 16 kHz mono. */
export const SCORING_MAX_SAMPLES = 30 * SCORING_SAMPLE_RATE;

/** Below the 8 kHz Nyquist of the output, with room for the filter's roll-off. */
const CUTOFF_HZ = 7_000;
const TAPS = 63;

/** Blackman-windowed sinc low-pass, normalised to unity gain. `cutoff` is a fraction of the input rate. */
function lowPass(input: Float32Array, cutoff: number): Float32Array {
  const half = (TAPS - 1) / 2;
  const kernel = new Float32Array(TAPS);
  let sum = 0;
  for (let i = 0; i < TAPS; i += 1) {
    const n = i - half;
    const sinc = n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n);
    const window = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (TAPS - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (TAPS - 1));
    kernel[i] = sinc * window;
    sum += kernel[i]!;
  }
  for (let i = 0; i < TAPS; i += 1) kernel[i] = kernel[i]! / sum;
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    let acc = 0;
    for (let k = 0; k < TAPS; k += 1) {
      const j = Math.min(input.length - 1, Math.max(0, i + k - half));
      acc += input[j]! * kernel[k]!;
    }
    output[i] = acc;
  }
  return output;
}

/** 16-bit PCM WAV in, the gate's exact 16 kHz mono WAV out. Throws on anything else. */
export function toSpeechaceWav(wav: Uint8Array): Uint8Array {
  const buf = Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength);
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('live-audio-not-wav');
  let rate = 0, channels = 0, data: Buffer | null = null;
  for (let offset = 12; offset + 8 <= buf.length;) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, Math.min(offset + 8 + size, buf.length));
    if (id === 'fmt ') {
      if (body.length < 16 || body.readUInt16LE(0) !== 1 || body.readUInt16LE(14) !== 16) throw new Error('live-audio-not-pcm16');
      channels = body.readUInt16LE(2);
      rate = body.readUInt32LE(4);
    } else if (id === 'data') {
      data = body;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (data === null || rate < 8_000 || rate > 192_000 || channels < 1 || channels > 8) throw new Error('live-audio-unsupported');

  const frames = Math.floor(data.length / (2 * channels));
  if (frames === 0) throw new Error('live-audio-empty');
  // Downmix to mono, as floats so the average cannot overflow.
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) sum += data.readInt16LE((frame * channels + channel) * 2);
    mono[frame] = sum / channels;
  }
  // Above 16 kHz, low-pass first: decimating without it folds everything above
  // 8 kHz back into the band where fricatives (s, ʃ, f) are scored. A short
  // windowed-sinc filter, cut off below the new Nyquist, is enough for an
  // assessment input. Then linear interpolation between filtered samples.
  const filtered = rate > SCORING_SAMPLE_RATE ? lowPass(mono, CUTOFF_HZ / rate) : mono;
  const outLength = Math.min(SCORING_MAX_SAMPLES, Math.max(1, Math.floor(frames * SCORING_SAMPLE_RATE / rate)));
  const pcm = Buffer.alloc(outLength * 2);
  const step = rate / SCORING_SAMPLE_RATE;
  for (let i = 0; i < outLength; i += 1) {
    const position = i * step;
    const left = Math.min(frames - 1, Math.floor(position));
    const right = Math.min(frames - 1, left + 1);
    const fraction = position - left;
    const value = filtered[left]! + (filtered[right]! - filtered[left]!) * fraction;
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value))), i * 2);
  }
  return pcmWav(pcm);
}
