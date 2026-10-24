/**
 * Pure helpers for scripts/measureQuietSpeech.mjs. No I/O, no network, no
 * models, so scripts/measureQuietSpeech.test.mjs can import them freely.
 */

/** Linear amplitude factor for a gain in dB. */
export function dbToGain(db) {
  return 10 ** (db / 20);
}

/** Int16 PCM scaled by `db`, rounded and clipped to the int16 range. */
export function applyGain(pcm, db) {
  const g = dbToGain(db);
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.round(pcm[i] * g);
    out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
  return out;
}

/** RMS of int16 PCM as a linear value in [0, 1] (full scale = 32768). */
export function rmsLinear(pcm, from = 0, to = pcm.length) {
  if (to <= from) return 0;
  let s = 0;
  for (let i = from; i < to; i++) s += (pcm[i] / 32768) ** 2;
  return Math.sqrt(s / (to - from));
}

/** dBFS of a linear RMS; -Infinity for digital silence. */
export function toDbfs(linear) {
  return linear > 0 ? 20 * Math.log10(linear) : -Infinity;
}

/** Seeded PRNG (mulberry32): same seed, same sequence, on every machine. */
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

/**
 * Deterministic pink noise (Paul Kellet's refined filter on seeded white
 * noise), scaled so its RMS is exactly `dbfs` before int16 rounding.
 */
export function pinkNoise(length, seed, dbfs) {
  const rnd = mulberry32(seed);
  const raw = new Float64Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
  let s = 0;
  for (const v of raw) s += v * v;
  const rms = Math.sqrt(s / Math.max(1, length));
  const scale = rms > 0 ? (dbToGain(dbfs) * 32768) / rms : 0;
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const v = Math.round(raw[i] * scale);
    out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
  return out;
}

/** Sample-wise sum of two int16 signals (b may be shorter), clipped. */
export function mix(a, b) {
  const out = new Int16Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const v = a[i] + (i < b.length ? b[i] : 0);
    out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
  return out;
}

/**
 * French text to comparable words: lowercase, curly apostrophes to straight,
 * accents stripped, apostrophes and punctuation split words ("s'il" -> "s il").
 * Applied to reference and hypothesis alike, so accent or elision spelling
 * never counts as an error; only the words do.
 */
export function normaliseWords(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Word error rate: word-level Levenshtein distance / reference length. */
export function wordErrorRate(reference, hypothesis) {
  const r = normaliseWords(reference);
  const h = normaliseWords(hypothesis);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[h.length] / r.length;
}

/** 1 - WER, floored at 0 so an insertion-heavy guess cannot go negative. */
export function wordAccuracy(reference, hypothesis) {
  return Math.max(0, 1 - wordErrorRate(reference, hypothesis));
}

/**
 * Replays @livekit/agents 1.9 AudioEnergyFilter (utils.js), which the Deepgram
 * plugin applies to every 100 ms frame before sending it: a frame goes out if
 * its RMS is above 0.004, or while a 1 s cooldown since the last loud frame
 * lasts. `warm` = false models a stream that has been open for a while (the
 * start-of-stream cooldown already spent), which is the live case mid-session.
 * Returns one boolean per 100 ms frame.
 */
export function energyFilterSends(pcm16k, { warm = true, threshold = 4e-3, cooldownS = 1 } = {}) {
  const frame = 1600;
  let cooldown = warm ? 0 : cooldownS;
  const sent = [];
  for (let i = 0; i < pcm16k.length; i += frame) {
    const end = Math.min(i + frame, pcm16k.length);
    if (rmsLinear(pcm16k, i, end) > threshold) {
      cooldown = cooldownS;
      sent.push(true);
      continue;
    }
    cooldown -= (end - i) / 16000;
    sent.push(cooldown > 0);
  }
  return sent;
}

/** Voiced span of int16 PCM: 20 ms windows above 5 % of the loudest window. */
export function voicedSpan(pcm, rate) {
  const win = Math.max(1, Math.round(rate * 0.02));
  const rms = [];
  for (let i = 0; i + win <= pcm.length; i += win) rms.push(rmsLinear(pcm, i, i + win));
  const peak = Math.max(0, ...rms);
  if (peak === 0) return { from: 0, to: 0 };
  const idx = rms.map((r, i) => (r > peak * 0.05 ? i : -1)).filter((i) => i >= 0);
  return { from: idx[0] * win, to: (idx[idx.length - 1] + 1) * win };
}

/** In-place radix-2 FFT on real/imag arrays whose length is a power of two. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2];
        const ai = im[i + k + len / 2];
        const xr = ar * wr - ai * wi;
        const xi = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

/**
 * Share of spectral energy above `splitHz` across the voiced span (Hann
 * windows of 1024). Whispering removes the voiced low harmonics, so a real
 * whisper should show a clearly larger share than its plain twin.
 */
export function highBandRatio(pcm, rate, splitHz = 3000) {
  const n = 1024;
  const { from, to } = voicedSpan(pcm, rate);
  let hi = 0;
  let all = 0;
  const bin = Math.round((splitHz / rate) * n);
  for (let s = from; s + n <= to; s += n / 2) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = (pcm[s + i] / 32768) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
    fft(re, im);
    for (let k = 1; k < n / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      all += p;
      if (k >= bin) hi += p;
    }
  }
  return all > 0 ? hi / all : 0;
}

/**
 * Median periodicity over the voiced span: the highest normalised
 * autocorrelation at a 70-400 Hz pitch lag, per 40 ms window. Voiced speech
 * sits high (around 0.7 and up); a true whisper has no pitch and sits low.
 */
export function periodicity(pcm, rate) {
  const win = Math.round(rate * 0.04);
  const minLag = Math.floor(rate / 400);
  const maxLag = Math.ceil(rate / 70);
  const { from, to } = voicedSpan(pcm, rate);
  const vals = [];
  for (let s = from; s + win + maxLag <= to; s += win) {
    let e0 = 0;
    for (let i = 0; i < win; i++) e0 += pcm[s + i] * pcm[s + i];
    if (e0 === 0) continue;
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      let e1 = 0;
      for (let i = 0; i < win; i++) {
        c += pcm[s + i] * pcm[s + i + lag];
        e1 += pcm[s + i + lag] * pcm[s + i + lag];
      }
      const r = e1 > 0 ? c / Math.sqrt(e0 * e1) : 0;
      if (r > best) best = r;
    }
    vals.push(best);
  }
  return median(vals);
}

export function median(values) {
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** "Excusez-moi, où est la gare ?" -> "excusez-moi-ou-est-la-gare". */
export function slug(text) {
  return normaliseWords(text).join('-');
}

/** 16-bit mono PCM WAV bytes. */
export function wavBytes(pcm, rate) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Reads a 16-bit PCM WAV (first channel if stereo). */
export function parseWav(buf) {
  let off = 12;
  let rate = 0;
  let channels = 1;
  let bits = 16;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(off + 10);
      rate = buf.readUInt32LE(off + 12);
      bits = buf.readUInt16LE(off + 22);
    }
    if (id === 'data') {
      const end = Math.min(buf.length, off + 8 + size);
      const bytes = buf.subarray(off + 8, end);
      data = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + (bytes.length - (bytes.length % 2))));
    }
    off += 8 + size + (size % 2);
  }
  if (bits !== 16 || !data) throw new Error('Only 16-bit PCM WAV is supported.');
  if (channels > 1) {
    const mono = new Int16Array(Math.floor(data.length / channels));
    for (let i = 0; i < mono.length; i++) mono[i] = data[i * channels];
    data = mono;
  }
  return { rate, pcm: data };
}
