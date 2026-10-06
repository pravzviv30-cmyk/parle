import { sniffAudio } from './toneperfect.ts';

interface TakeOptions {
  key?: string; request?: typeof fetch; timeoutMs?: number; signal?: AbortSignal;
}

/**
 * One take, and what it cost. `dispatched` is true once the audio was handed to
 * the vendor, whatever happened next; `seconds` is the duration the vendor
 * reported for it, or null when it reported none. A caller that books speech
 * time needs both: an undispatched take used nothing, and a dispatched one with
 * no report used an unknown amount.
 */
export interface MeasuredTake {
  transcript: string | null;
  seconds: number | null;
  dispatched: boolean;
}

/** One ephemeral French take, no callback, account identity, storage or log. */
export async function transcribeFrenchTake(audio: Uint8Array, options: TakeOptions = {}): Promise<string | null> {
  return (await transcribeFrenchTakeMeasured(audio, options)).transcript;
}

/** The same request as `transcribeFrenchTake`, reporting dispatch and the vendor's measured duration. */
export async function transcribeFrenchTakeMeasured(audio: Uint8Array, options: TakeOptions = {}): Promise<MeasuredTake> {
  const key = options.key ?? process.env.DEEPGRAM_API_KEY;
  const mime = sniffAudio(audio).mime;
  const untouched: MeasuredTake = { transcript: null, seconds: null, dispatched: false };
  if (options.signal?.aborted || !key || audio.length === 0 || audio.length > 2 * 1024 * 1024 || mime === 'application/octet-stream') return untouched;
  const deadline = AbortSignal.timeout(Math.max(1, Math.min(10_000, options.timeoutMs ?? 10_000)));
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const sent: MeasuredTake = { transcript: null, seconds: null, dispatched: true };
  try {
    const response = await (options.request ?? fetch)('https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&mip_opt_out=true', {
      method: 'POST', headers: { authorization: `Token ${key}`, 'content-type': mime },
      body: audio as BodyInit, signal,
    });
    if (!response.ok) return sent;
    if (!response.body) return sent;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 64 * 1024) { await reader.cancel(); return sent; }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      metadata?: { duration?: unknown };
      results?: { channels?: { alternatives?: { transcript?: unknown }[] }[] };
    };
    const duration = body?.metadata?.duration;
    const seconds = typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 3600 ? duration : null;
    const text = body?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    const transcript = typeof text === 'string' && text.trim().length > 0 && text.trim().length <= 600 ? text.trim() : null;
    return { transcript, seconds, dispatched: true };
  } catch { return sent; }
}
