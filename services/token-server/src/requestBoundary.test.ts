import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleDrillScore, SCORE_AUDIO_LIMIT_BYTES } from './drillScore.ts';
import { HttpInputError, protectHttpHandler, readRequestBytes, readRequestJson, requestUrl, withRequestSignal } from './requestBoundary.ts';

function request(url = '/health', host = 'localhost'): IncomingMessage & PassThrough {
  const req = new PassThrough() as unknown as IncomingMessage & PassThrough;
  req.url = url;
  req.headers = { host };
  return req;
}
function response() {
  const emitter = new EventEmitter();
  let status = 0;
  let body = '';
  const finished = new Promise<void>(resolve => emitter.once('finish', resolve));
  const res = Object.assign(emitter, {
    destroyed: false, writableEnded: false, headersSent: false,
    writeHead(code: number) { status = code; this.headersSent = true; return this; },
    end(value = '') { body = value; this.writableEnded = true; emitter.emit('finish'); return this; },
    destroy() { this.destroyed = true; emitter.emit('finish'); return this; },
  }) as unknown as ServerResponse;
  return { res, finished, status: () => status, body: () => body };
}

test('hostile authorities and request targets fail inside a protected boundary', async () => {
  for (const [target, host] of [['/health', '%'], ['/health', 'example.com:99999'], ['//elsewhere.invalid/', 'localhost'], ['http://elsewhere.invalid/', 'localhost'], ['/%zz', 'localhost'], ['/\\elsewhere', 'localhost']]) {
    const req = request(target, host);
    const out = response();
    protectHttpHandler(async input => { requestUrl(input); })(req, out.res);
    await out.finished;
    assert.equal(out.status(), 400);
    assert.ok(!out.body().includes(host === '%' ? 'ERR_INVALID_URL' : 'elsewhere.invalid'));
    req.destroy();
  }
  assert.equal(requestUrl(request('/health?q=ok', 'localhost:8787')).pathname, '/health');
  assert.equal(requestUrl(request('/health', '[::1]:8787')).hostname, 'luvani.invalid');
});

test('unobserved asynchronous HTTP rejection is contained without disclosing raw content', async () => {
  const out = response();
  const logs: unknown[][] = [];
  const previous = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    protectHttpHandler(async () => { await Promise.resolve(); throw Object.assign(new Error('PRIVATE_SYNTHETIC_BODY'), { raw: 'PRIVATE_SYNTHETIC_BODY' }); })(request(), out.res);
    await out.finished;
    assert.equal(out.status(), 500);
    assert.ok(!JSON.stringify(logs).includes('PRIVATE_SYNTHETIC_BODY'));
    assert.deepEqual(JSON.parse(out.body()), { error: 'internal error' });
  } finally { console.error = previous; }
});

test('null arrays scalars and malformed JSON are 400 rather than internal failures', async () => {
  for (const text of ['null', '[]', '42', '"hello"', '{']) {
    const req = request('/session/start');
    const reading = readRequestJson(req);
    req.end(text);
    await assert.rejects(reading, error => error instanceof HttpInputError && error.status === 400);
  }
  const req = request();
  const reading = readRequestJson(req);
  req.end('{"mode":"convo-text"}');
  assert.deepEqual(await reading, { mode: 'convo-text' });
});

test('both declared and chunked oversized bodies refuse before vendor work', async () => {
  for (const declared of [true, false]) {
    const req = request('/drill/score');
    req.headers['x-luvani-reference'] = 'bonjour';
    if (declared) req.headers['content-length'] = String(SCORE_AUDIO_LIMIT_BYTES + 1);
    let calls = 0;
    const out = response();
    protectHttpHandler(async (input, res) => handleDrillScore(input, res, {
      users: { resolve: async () => ({ ok: true, userId: 'synthetic-user' }) },
      limits: async () => true,
      score: async () => { calls++; return []; },
    }))(req, out.res);
    if (!declared) req.end(Buffer.alloc(SCORE_AUDIO_LIMIT_BYTES + 1));
    await out.finished;
    assert.equal(out.status(), 413);
    assert.equal(calls, 0);
    assert.ok(req.destroyed);
  }
});

test('aborted uploads discard retained chunks and settle their reader', async () => {
  const req = request();
  const reading = readRequestBytes(req, 100);
  req.write(Buffer.alloc(50));
  req.emit('aborted');
  await assert.rejects(reading, error => error instanceof HttpInputError && error.status === 400);
  req.destroy();
});

test('disconnect and deadline abort paid work even when an adapter never resolves', async () => {
  for (const disconnect of [true, false]) {
    const req = request();
    const out = response();
    let providerSignal: AbortSignal | undefined;
    const work = withRequestSignal(req, out.res, signal => {
      providerSignal = signal;
      return new Promise<never>(() => {});
    }, 10);
    await Promise.resolve();
    if (disconnect) out.res.emit('close');
    await assert.rejects(work, error => error instanceof HttpInputError && error.status === 408);
    assert.equal(providerSignal?.aborted, true);
    assert.equal(req.listenerCount('aborted'), 0);
    assert.equal(out.res.listenerCount('close'), 0);
    req.destroy();
  }
});
