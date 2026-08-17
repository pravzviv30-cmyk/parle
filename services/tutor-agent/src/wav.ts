/**
 * Minimal WAV read/write for the TTS cache.
 *
 * 16-bit PCM only, because that is what every TTS plugin in this pipeline emits.
 * A cached line is a plain .wav on disk, so it can be auditioned in any player
 * when someone wants to check what the tutor actually sounds like.
 */

export interface WavData {
  sampleRate: number;
  channels: number;
  /** Interleaved 16-bit PCM. */
  samples: Int16Array;
}

export function encodeWav(data: WavData): Buffer {
  const byteLength = data.samples.length * 2;
  const buf = Buffer.alloc(44 + byteLength);
  const blockAlign = data.channels * 2;

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + byteLength, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); //          fmt chunk size
  buf.writeUInt16LE(1, 20); //           PCM
  buf.writeUInt16LE(data.channels, 22);
  buf.writeUInt32LE(data.sampleRate, 24);
  buf.writeUInt32LE(data.sampleRate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); //          bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(byteLength, 40);

  for (let i = 0; i < data.samples.length; i++) {
    buf.writeInt16LE(data.samples[i]!, 44 + i * 2);
  }
  return buf;
}

/** Throws on anything that is not the 16-bit PCM WAV this module writes. */
export function decodeWav(buf: Buffer): WavData {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a WAV file');
  }
  if (buf.readUInt16LE(20) !== 1 || buf.readUInt16LE(34) !== 16) {
    throw new Error('only 16-bit PCM is supported');
  }
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);

  // Walk chunks to find `data`; some writers insert extras before it.
  let offset = 36;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') {
      const end = Math.min(offset + 8 + size, buf.length);
      const bytes = buf.subarray(offset + 8, end);
      const samples = new Int16Array(bytes.length >> 1);
      for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(i * 2);
      return { sampleRate, channels, samples };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}
