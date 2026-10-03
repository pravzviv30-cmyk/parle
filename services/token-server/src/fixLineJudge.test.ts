import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleFixLineJudge } from './fixLineJudge.ts';
import { JUDGE_BODY_LIMIT_BYTES, type DrillJudgeDeps } from './drillJudge.ts';

const correction = { userId: 'learner', original: 'Je suis vingt ans.', better: 'J’ai vingt ans.', why: 'Use avoir for age.', attempt: 'J’ai vingt ans.' };
const usage = { inputTokens: 30, outputTokens: 12, cacheReadTokens: 0, cacheWriteTokens: 0 };
function req(body: unknown): IncomingMessage {
  const request = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]) as unknown as IncomingMessage;
  request.headers = { authorization: 'Bearer valid' }; return request;
}
function response() {
  const res = new EventEmitter() as ServerResponse;
  let status = 0; let value = '';
  res.writeHead = ((code: number) => { status = code; return res; }) as typeof res.writeHead;
  res.end = ((body: string) => { value = body; return res; }) as typeof res.end;
  return { res, status: () => status, body: () => value ? JSON.parse(value) : null };
}
function setup(overrides: Partial<DrillJudgeDeps> = {}) {
  const seen = { calls: [] as unknown[], limits: [] as (string | null)[], usage: [] as unknown[] };
  const deps: DrillJudgeDeps = {
    users: { resolve: async () => ({ ok: true, userId: 'learner' }) },
    limits: async (_req, _res, owner) => { seen.limits.push(owner); return true; },
    client: { judge: async request => { seen.calls.push(request); return { verdict: { fixed: true, hint: null }, usage }; } },
    usage: value => seen.usage.push(value), ...overrides,
  };
  return { seen, deps };
}
test('correction endpoint authenticates and bounds a distinct retry before spending the brain', async () => {
  for (const body of [{ ...correction, userId: 'old-owner' }, { ...correction, attempt: 'a'.repeat(601) }, { ...correction, original: correction.better },
    { ...correction, better: 'a'.repeat(401) }, 'x'.repeat(JUDGE_BODY_LIMIT_BYTES + 1), []]) {
    const d = setup(); const r = response(); await handleFixLineJudge(req(body), r.res, d.deps);
    assert.ok([400, 403].includes(r.status())); assert.equal(d.seen.calls.length, 0); assert.deepEqual(d.seen.usage, []);
  }
  const d = setup({ users: { resolve: async () => ({ ok: false, status: 401, message: 'sign in' }) } });
  const r = response(); await handleFixLineJudge(req(correction), r.res, d.deps);
  assert.equal(r.status(), 401); assert.equal(d.seen.calls.length, 0);
});
test('correction endpoint shares both limit passes and sends no raw sentence to its usage meter', async () => {
  const d = setup(); const r = response(); await handleFixLineJudge(req(correction), r.res, d.deps);
  assert.equal(r.status(), 200); assert.deepEqual(r.body(), { verdict: { fixed: true, hint: null } });
  assert.deepEqual(d.seen.limits, [null, 'learner']); assert.deepEqual(d.seen.usage, [usage]);
  const request = d.seen.calls[0] as { judgeType: string; input?: unknown };
  assert.equal(request.judgeType, 'fix-line'); assert.equal(request.input, undefined);
  const limited = setup({ limits: async (_req, res) => { res.writeHead(429); res.end('{}'); return false; } });
  const l = response(); await handleFixLineJudge(req(correction), l.res, limited.deps);
  assert.equal(l.status(), 429); assert.equal(limited.seen.calls.length, 0);
});
test('uncertain repairs are unjudged; a malformed or unavailable brain never invents success', async () => {
  for (const verdict of [{ fixed: null, hint: null }, { fixed: 'yes', hint: null }, { fixed: true }, { fixed: true, hint: null, extra: 'ignored?' }]) {
    const d = setup({ client: { judge: async () => ({ verdict, usage }) } }); const r = response();
    await handleFixLineJudge(req(correction), r.res, d.deps);
    if (verdict.fixed === null) { assert.equal(r.status(), 200); assert.deepEqual(r.body(), { verdict: null }); }
    else { assert.equal(r.status(), 503); assert.deepEqual(r.body(), { error: 'judge-unavailable' }); }
  }
});
test('hint guard does not whitelist French appearing only in a retry or reason', async () => {
  const d = setup({ client: { judge: async () => ({ verdict: { fixed: false, hint: 'Try « école » once more.' }, usage }) } });
  const r = response(); await handleFixLineJudge(req({ ...correction, attempt: 'école', why: 'école' }), r.res, d.deps);
  assert.deepEqual(r.body(), { verdict: { fixed: false, hint: 'Try the corrected part once more.' } });
});
test('timeout and disconnect abort a held correction check and release its response', async () => {
  for (const exit of ['timeout', 'disconnect'] as const) {
    let signal: AbortSignal | undefined; let release: ((value: { verdict: unknown; usage: typeof usage }) => void) | undefined;
    const d = setup({ timeoutMs: 5, client: { judge: request => { signal = request.signal; return new Promise(resolve => { release = resolve; }); } } });
    const r = response(); const task = handleFixLineJudge(req(correction), r.res, d.deps);
    for (let i = 0; !signal && i < 30; i++) await new Promise(resolve => setImmediate(resolve));
    if (exit === 'disconnect') { r.res.destroyed = true; r.res.emit('close'); }
    await task; assert.equal(signal?.aborted, true); assert.equal(r.res.listenerCount('close'), 0);
    assert.equal(r.status(), exit === 'timeout' ? 503 : 0);
    release!({ verdict: { fixed: true, hint: null }, usage }); await Promise.resolve();
    assert.deepEqual(d.seen.usage, [usage], 'late billed usage is still counted without publishing a verdict');
    assert.equal(r.status(), exit === 'timeout' ? 503 : 0);
  }
});

test('a correction-specific Noul may remove one brain call but never change its fallback request', async () => {
  const { createFixLineObserver } = await import('./fixLineObserver.ts');
  const calibration = { revision:'invented-unit-fixture-only',model:'jev-1.13.0',threshold:0.9,task:'fix-line',humanApproved:true } as const;
  for (const probability of [0.9,0.899,0]) {
    const d = setup();const r = response();
    const fixLineObserver = createFixLineObserver({async systemOne() {return {model:'jev-1.13.0',answers:{fixed:{type:'noul',noul:probability}},usage};}},calibration);
    await handleFixLineJudge(req(correction),r.res,{...d.deps,fixLineObserver});
    assert.equal(r.status(),200);assert.deepEqual(r.body(),{verdict:{fixed:true,hint:null}});
    assert.equal(d.seen.calls.length,probability>=0.9?0:1);assert.equal(d.seen.usage.length,probability>=0.9?1:2);
    if (probability<0.9) {
      const plain = setup();const baseline = response();await handleFixLineJudge(req(correction),baseline.res,plain.deps);
      const omitSignal = (value: unknown) => {const {signal,...fields} = value as {signal:unknown};return fields;};
      assert.deepEqual(omitSignal(d.seen.calls[0]),omitSignal(plain.seen.calls[0]));
    }
    assert.deepEqual(d.seen.limits,[null,'learner']);
  }
});

test('a slow or failed correction observer falls back inside the same overall budget; departure starts no brain', async () => {
  const { createFixLineObserver } = await import('./fixLineObserver.ts');
  const calibration = {revision:'invented-unit-fixture-only',model:'jev-1.13.0',threshold:0.9,task:'fix-line',humanApproved:true} as const;
  for (const kind of ['failure','timeout','departure']) {
    const d = setup();const r = response();let signal: AbortSignal | undefined;
    const fixLineObserver = createFixLineObserver({systemOne(_state,_questions,abort) {
      signal=abort;if (kind==='failure') return Promise.reject(new Error('offline'));
      return new Promise((_resolve,reject)=>abort?.addEventListener('abort',()=>reject(new Error('abort')),{once:true}));
    }},calibration,5);
    const task = handleFixLineJudge(req(correction),r.res,{...d.deps,fixLineObserver});
    for (let i=0;!signal&&i<30;i++) await new Promise(resolve=>setImmediate(resolve));
    if (kind==='departure') {r.res.destroyed=true;r.res.emit('close');}
    await task;assert.equal(d.seen.calls.length,kind==='departure'?0:1);
    assert.equal(r.status(),kind==='departure'?0:200);
  }
});
