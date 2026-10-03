import { sniffAudio } from './toneperfect.ts';

/** One ephemeral French take, no callback, account identity, storage or log. */
export async function transcribeFrenchTake(audio: Uint8Array, options: {
  key?: string; request?: typeof fetch; timeoutMs?: number;
} = {}): Promise<string | null> {
  const key = options.key ?? process.env.DEEPGRAM_API_KEY;
  const mime = sniffAudio(audio).mime;
  if (!key || audio.length === 0 || audio.length > 2 * 1024 * 1024 || mime === 'application/octet-stream') return null;
  try {
    const response = await (options.request ?? fetch)('https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true', {
      method: 'POST', headers: { authorization: `Token ${key}`, 'content-type': mime },
      body: audio as BodyInit, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    if (!response.ok) return null;
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 64 * 1024) { await reader.cancel(); return null; }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { results?: { channels?: { alternatives?: { transcript?: unknown }[] }[] } };
    const text = body?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    return typeof text === 'string' && text.trim().length > 0 && text.trim().length <= 600 ? text.trim() : null;
  } catch { return null; }
}
