import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

/** Public errors contain a fixed message, never a failed body or vendor response. */
export class HttpInputError extends Error {
  readonly status: 400 | 403 | 408 | 413;
  constructor(status: 400 | 403 | 408 | 413, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpInputError';
  }
}

/** Only origin-form requests are accepted; the Host header never determines routing. */
export function requestUrl(req: Pick<IncomingMessage, 'url' | 'headers'>): URL {
  const target = req.url ?? '/';
  const host = req.headers.host;
  if (host !== undefined) {
    if (typeof host !== 'string' || !/^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:.]+\])(?::[0-9]{1,5})?$/.test(host)) {
      throw new HttpInputError(400, 'invalid request authority');
    }
    try { new URL(`http://${host}`); }
    catch { throw new HttpInputError(400, 'invalid request authority'); }
  }
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\x00-\x20\x7f]/.test(target)) {
    throw new HttpInputError(400, 'invalid request target');
  }
  try {
    decodeURI(target);
    return new URL(target, 'http://luvani.invalid');
  } catch { throw new HttpInputError(400, 'invalid request target'); }
}

/** Bounded event-based reading avoids async-iterator socket destruction before a 413. */
export async function readRequestBytes(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = req.headers['content-length'];
  if (declared !== undefined && (typeof declared !== 'string' || !/^\d+$/.test(declared))) {
    throw new HttpInputError(400, 'invalid content length');
  }
  if (declared !== undefined && Number(declared) > limit) {
    req.pause();
    throw new HttpInputError(413, 'payload too large');
  }
  if (req.aborted || req.destroyed) throw new HttpInputError(400, 'request interrupted');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const clean = () => {
      req.off('data', data);
      req.off('end', end);
      req.off('aborted', interrupted);
      req.off('close', closed);
    };
    const fail = (error: HttpInputError) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      clean();
      reject(error);
    };
    const data = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > limit) {
        req.pause();
        fail(new HttpInputError(413, 'payload too large'));
        return;
      }
      chunks.push(buffer);
    };
    const end = () => {
      if (settled) return;
      settled = true;
      clean();
      resolve(Buffer.concat(chunks, bytes));
    };
    const interrupted = () => fail(new HttpInputError(400, 'request interrupted'));
    const closed = () => { if (!req.complete) interrupted(); };
    req.on('data', data);
    req.once('end', end);
    req.once('aborted', interrupted);
    req.once('close', closed);
    // Remains attached for a late aborted-stream error until this request is collected.
    req.on('error', interrupted);
  });
}

export async function readRequestJson(req: IncomingMessage, limit = 64 * 1024): Promise<Record<string, unknown>> {
  const bytes = await readRequestBytes(req, limit);
  if (bytes.length === 0) return {};
  let value: unknown;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch { throw new HttpInputError(400, 'invalid JSON body'); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpInputError(400, 'JSON object required');
  }
  return value as Record<string, unknown>;
}

/** A disconnected caller cannot keep a paid operation alive; deadline covers hung adapters. */
export async function withRequestSignal<T>(req: IncomingMessage, res: ServerResponse, work: (signal: AbortSignal) => Promise<T>, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  let rejectStop: (reason: unknown) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const stop = () => { controller.abort(); rejectStop(new HttpInputError(408, 'request interrupted or timed out')); };
  const closed = () => { if (!res.writableFinished) stop(); };
  const timer = setTimeout(stop, timeoutMs);
  try {
    req.once('aborted', stop);
    res.once('close', closed);
    if (req.aborted || res.destroyed) stop();
    if (controller.signal.aborted) return await stopped;
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), stopped]);
  } finally {
    clearTimeout(timer);
    req.off('aborted', stop);
    res.off('close', closed);
  }
}

export function answerRequestError(req: IncomingMessage, res: ServerResponse, error: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) { res.destroy(); return; }
  const input = error instanceof HttpInputError;
  const status = input ? error.status : 500;
  const payload = JSON.stringify({ error: input ? error.message : 'internal error' });
  if (!input) console.error('[luvani] request failed', { category: 'internal', status });
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'connection': 'close',
  });
  // An over-limit upload is never drained indefinitely after refusal.
  if (!req.complete && status === 413) res.once('finish', () => req.destroy());
  res.end(payload);
}

/** Node does not observe a promise returned by its HTTP event listener. We do. */
export function protectHttpHandler(handler: (req: IncomingMessage, res: ServerResponse) => Promise<unknown>): RequestListener {
  return (req, res) => {
    void Promise.resolve().then(() => handler(req, res)).catch((error: unknown) => {
      try { answerRequestError(req, res, error); }
      catch { res.destroy(); }
    });
  };
}
