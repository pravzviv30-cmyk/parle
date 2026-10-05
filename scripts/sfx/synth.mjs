/**
 * Luvani's sound-effect synthesiser. Pure: no I/O, no clock, no Math.random.
 *
 * A recipe (scripts/sfx/recipes.mjs) is a list of voices laid on one mono buffer:
 *   - tone voices: additive sine and triangle partials on one fundamental, with an optional
 *     glide, detuned copies or vibrato, shaped by an exponential-decay or ADSR envelope;
 *   - noise voices: seeded white noise through an RBJ biquad low-pass or band-pass, with an
 *     optional exponential frequency sweep.
 * Each voice is peak-normalised to its own `gain` so a recipe's mix reads as written, then the
 * mix gets a 3 ms raised-cosine fade in and an 8 ms fade out, is peak-normalised to the
 * recipe's dBFS target, and is quantised to 16-bit with seeded TPDF dither.
 *
 * Determinism: the only randomness is mulberry32 seeded by FNV-1a of `${id}:${version}`,
 * drawn in recipe order (noise voices first, then dither). The arithmetic is Float64 and the
 * output is hashed after 16-bit quantisation, so the same recipe on the same Node gives the
 * same bytes, and sfxAssets.test.ts holds the committed manifest to that.
 */

export const SAMPLE_RATE = 44100;
export const FADE_IN_MS = 3;
export const FADE_OUT_MS = 8;
/** Triangle harmonics above this are left out, so nothing aliases and AAC has nothing to smear. */
const HARMONIC_CEILING_HZ = 16000;
const FULL_SCALE = 32767;
/** Level of each detuned copy against the note itself. */
const DETUNE_LEVEL = 0.3;
const TWO_PI = 2 * Math.PI;

/** @param {string} text @returns {number} 32-bit FNV-1a of the UTF-16 code units' low bytes. */
export function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** @param {number} seed @returns {() => number} uniform in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} ms */
const samplesFor = (ms) => Math.round((ms * SAMPLE_RATE) / 1000);

/**
 * @typedef {{ attack: number, tau: number }} DecayEnvelope
 *   Linear rise over `attack` ms, then e^(-t/tau) from the peak.
 * @typedef {{ attack: number, decay: number, sustain: number, release: number }} AdsrEnvelope
 *   Linear rise, linear fall to `sustain` over `decay` ms, held, then a raised-cosine release
 *   over the voice's last `release` ms.
 * @typedef {{ attack: number, release: number }} SwellEnvelope
 *   Raised-cosine rise over `attack` ms, then raised-cosine fall over `release` ms.
 * @typedef {DecayEnvelope | AdsrEnvelope | SwellEnvelope} Envelope
 * @typedef {{ ratio: number, gain: number, wave?: 'sine' | 'triangle', tauScale?: number }} Partial
 * @typedef {{ kind: 'tone', at: number, hz: number, glide?: { to: number, overMs: number },
 *   partials: Partial[], env: Envelope, gain: number, durMs?: number,
 *   detuneCents?: number, vibrato?: { rate: number, cents: number } }} ToneVoice
 * @typedef {{ kind: 'noise', at: number, durMs: number, gain: number, env: Envelope,
 *   filter: { type: 'lowpass' | 'bandpass', hz: number, toHz?: number, sweepMs?: number, q: number } }} NoiseVoice
 * @typedef {ToneVoice | NoiseVoice} Voice
 * @typedef {{ id: string, lengthMs: number, peakDbfs: number, plays: string, voices: Voice[] }} Recipe
 */

/**
 * Envelope gain at `t` ms into a voice that lasts `length` ms.
 * @param {Envelope} env @param {number} t @param {number} length @param {number} [tauScale]
 */
export function envelopeAt(env, t, length, tauScale = 1) {
  if (t < 0 || t > length) return 0;
  const rise = env.attack > 0 ? Math.min(1, t / env.attack) : 1;
  if ('tau' in env) {
    if (t < env.attack) return rise;
    return Math.exp(-(t - env.attack) / (env.tau * tauScale));
  }
  if ('sustain' in env) {
    let level;
    if (t < env.attack) level = rise;
    else if (t < env.attack + env.decay) level = 1 - ((1 - env.sustain) * (t - env.attack)) / env.decay;
    else level = env.sustain;
    const releaseStart = length - env.release;
    if (t > releaseStart) level *= 0.5 * (1 + Math.cos((Math.PI * (t - releaseStart)) / env.release));
    return level;
  }
  if (t < env.attack) return 0.5 * (1 - Math.cos((Math.PI * t) / env.attack));
  const fall = Math.min(1, (t - env.attack) / env.release);
  return 0.5 * (1 + Math.cos(Math.PI * fall));
}

/**
 * A triangle partial expands into its odd harmonics, (8/pi^2)(-1)^k / n^2, up to the ceiling.
 * @param {Partial[]} partials @param {number} topHz
 * @returns {{ ratio: number, gain: number, tauScale: number }[]}
 */
function expandPartials(partials, topHz) {
  /** @type {{ ratio: number, gain: number, tauScale: number }[]} */
  const out = [];
  for (const p of partials) {
    const tauScale = p.tauScale ?? 1;
    if (p.wave === 'triangle') {
      for (let n = 1, k = 0; n * p.ratio * topHz < HARMONIC_CEILING_HZ; n += 2, k++) {
        out.push({ ratio: p.ratio * n, gain: (p.gain * 8 * (k % 2 === 0 ? 1 : -1)) / (Math.PI * Math.PI * n * n), tauScale });
      }
    } else if (p.ratio * topHz < HARMONIC_CEILING_HZ) {
      out.push({ ratio: p.ratio, gain: p.gain, tauScale });
    }
  }
  return out;
}

/** @param {ToneVoice} voice @param {number} length samples */
function renderTone(voice, length) {
  const out = new Float64Array(length);
  const lengthMs = (length * 1000) / SAMPLE_RATE;
  const topHz = Math.max(voice.hz, voice.glide?.to ?? 0);
  const partials = expandPartials(voice.partials, topHz);
  // A detuned voice is the note plus two quieter copies `detuneCents` either side, the second a
  // quarter-turn out of phase, so the copies shimmer without beating the chord down to silence.
  const spreads = voice.detuneCents
    ? [{ cents: 0, level: 1, phase: 0 }, { cents: -voice.detuneCents, level: DETUNE_LEVEL, phase: 0 }, { cents: voice.detuneCents, level: DETUNE_LEVEL, phase: Math.PI / 2 }]
    : [{ cents: 0, level: 1, phase: 0 }];
  for (const { cents, level, phase } of spreads) {
    const detune = Math.pow(2, cents / 1200);
    const phases = new Float64Array(partials.length).fill(phase);
    for (let n = 0; n < length; n++) {
      const t = (n * 1000) / SAMPLE_RATE;
      let hz = voice.hz;
      if (voice.glide) {
        const progress = Math.min(1, t / voice.glide.overMs);
        hz = voice.hz * Math.pow(voice.glide.to / voice.hz, progress);
      }
      if (voice.vibrato) hz *= Math.pow(2, (voice.vibrato.cents * Math.sin((TWO_PI * voice.vibrato.rate * t) / 1000)) / 1200);
      hz *= detune;
      let sample = 0;
      for (let k = 0; k < partials.length; k++) {
        const partial = /** @type {{ ratio: number, gain: number, tauScale: number }} */ (partials[k]);
        sample += partial.gain * envelopeAt(voice.env, t, lengthMs, partial.tauScale) * Math.sin(/** @type {number} */ (phases[k]));
        let next = /** @type {number} */ (phases[k]) + (TWO_PI * partial.ratio * hz) / SAMPLE_RATE;
        if (next >= TWO_PI) next -= TWO_PI;
        phases[k] = next;
      }
      out[n] = /** @type {number} */ (out[n]) + level * sample;
    }
  }
  return out;
}

/**
 * RBJ cookbook biquad coefficients, normalised by a0.
 * @param {'lowpass' | 'bandpass'} type @param {number} hz @param {number} q
 */
export function biquad(type, hz, q) {
  const w0 = (TWO_PI * hz) / SAMPLE_RATE;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  if (type === 'lowpass') {
    return { b0: (1 - cos) / 2 / a0, b1: (1 - cos) / a0, b2: (1 - cos) / 2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
  }
  // Band-pass with a constant 0 dB peak.
  return { b0: alpha / a0, b1: 0, b2: -alpha / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** @param {NoiseVoice} voice @param {number} length samples @param {() => number} random */
function renderNoise(voice, length, random) {
  const out = new Float64Array(length);
  const { filter } = voice;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let c = biquad(filter.type, filter.hz, filter.q);
  for (let n = 0; n < length; n++) {
    const t = (n * 1000) / SAMPLE_RATE;
    if (filter.toHz !== undefined) {
      const progress = Math.min(1, t / (filter.sweepMs ?? voice.durMs));
      c = biquad(filter.type, filter.hz * Math.pow(filter.toHz / filter.hz, progress), filter.q);
    }
    const x = random() * 2 - 1;
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[n] = y * envelopeAt(voice.env, t, voice.durMs);
  }
  return out;
}

/** @param {Float64Array} buffer */
function peakOf(buffer) {
  let peak = 0;
  for (let n = 0; n < buffer.length; n++) peak = Math.max(peak, Math.abs(/** @type {number} */ (buffer[n])));
  return peak;
}

/**
 * Renders a recipe to 16-bit mono PCM at 44.1 kHz.
 * @param {Recipe} recipe @param {number | string} version the recipe-table version
 * @returns {Int16Array}
 */
export function synthesise(recipe, version) {
  const random = mulberry32(fnv1a(`${recipe.id}:${version}`));
  const total = samplesFor(recipe.lengthMs);
  const mix = new Float64Array(total);
  for (const voice of recipe.voices) {
    const offset = samplesFor(voice.at);
    if (offset >= total) throw new Error(`${recipe.id}: a voice starts after the sound ends`);
    const length = Math.min(total - offset, voice.durMs === undefined ? total - offset : samplesFor(voice.durMs));
    const rendered = voice.kind === 'tone' ? renderTone(voice, length) : renderNoise(voice, length, random);
    const peak = peakOf(rendered);
    if (peak === 0) throw new Error(`${recipe.id}: a voice is silent`);
    const scale = voice.gain / peak;
    for (let n = 0; n < length; n++) mix[offset + n] = /** @type {number} */ (mix[offset + n]) + /** @type {number} */ (rendered[n]) * scale;
  }
  const fadeIn = samplesFor(FADE_IN_MS);
  const fadeOut = samplesFor(FADE_OUT_MS);
  for (let n = 0; n < fadeIn; n++) mix[n] = /** @type {number} */ (mix[n]) * 0.5 * (1 - Math.cos((Math.PI * n) / fadeIn));
  for (let n = 0; n < fadeOut; n++) {
    const index = total - 1 - n;
    mix[index] = /** @type {number} */ (mix[index]) * 0.5 * (1 - Math.cos((Math.PI * n) / fadeOut));
  }
  const scale = Math.pow(10, recipe.peakDbfs / 20) / peakOf(mix);
  const pcm = new Int16Array(total);
  for (let n = 0; n < total; n++) {
    // TPDF dither: the difference of two uniforms is triangular on (-1, 1) LSB.
    const dither = random() - random();
    pcm[n] = Math.max(-32768, Math.min(FULL_SCALE, Math.round(/** @type {number} */ (mix[n]) * scale * FULL_SCALE + dither)));
  }
  return pcm;
}

/** @param {Int16Array} pcm @returns {number} peak in dBFS, two decimals */
export function peakDbfsOf(pcm) {
  let peak = 0;
  for (let n = 0; n < pcm.length; n++) peak = Math.max(peak, Math.abs(/** @type {number} */ (pcm[n])));
  return Math.round(2000 * Math.log10(peak / FULL_SCALE)) / 100;
}

/** @param {Int16Array} pcm @returns {number} whole milliseconds */
export const durationMsOf = (pcm) => Math.round((pcm.length * 1000) / SAMPLE_RATE);

/**
 * A canonical 44-byte-header PCM WAV, little-endian, mono, 16-bit.
 * @param {Int16Array} pcm @returns {Uint8Array}
 */
export function encodeWav(pcm) {
  const dataBytes = pcm.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (/** @type {number} */ at, /** @type {string} */ text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let n = 0; n < pcm.length; n++) view.setInt16(44 + n * 2, /** @type {number} */ (pcm[n]), true);
  return bytes;
}
