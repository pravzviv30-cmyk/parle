import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { tutorDigest, TutorRpcError } from '../../shared/tutorLifecycle.ts';
import { claimSessionLifecycle, legacyRuntimeFixture, SessionLifecycleError, tutorSupervisorHeartbeat, type LifecycleOptions } from './sessionLifecycle.ts';

const identity = { userId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222',
  roomName: 'luvani-22222222-2222-4222-8222-222222222222', mode: 'lesson-text' as const };
const nonce = '33333333-3333-4333-8333-333333333333';
const epoch = Date.parse('2026-10-04T12:00:00Z');
type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
function fixture(overrides: { call?: LifecycleOptions['call']; mode?: 'convo-text'; delay?: number } = {}) {
  let time = 0, revision = 0; let committed: Row | undefined;
  const calls: { operation: string; payload: Row }[] = [];
  const dates = () => ({ serverNow: new Date(epoch + time).toISOString(), leaseUntil: new Date(epoch + Math.min(120_000, time + 30_000)).toISOString(),
    hardDeadline: new Date(epoch + 120_000).toISOString() });
  const receipt = (payload: Row = committed ?? { seconds: 0, learnerTurns: 0, serviceFailure: null }) => ({ kind: 'completed', sessionId: identity.sessionId,
    receipt: { version: 1, sessionId: identity.sessionId, state: 'settled', chargedSeconds: payload.serviceFailure || !payload.learnerTurns ? 0 : payload.seconds,
      releasedReservedSeconds: 120, checkpointRevision: Number(payload.revision ?? revision), baselineStatus: payload.baseline ? 'saved' : 'none',
      completedAt: new Date(epoch + time).toISOString(), settlement: { kind: payload.serviceFailure || !payload.learnerTurns ? 'not-charged' : 'charged',
        refundedSeconds: 0, secondsRemaining: 200, plan: 'trial' } } });
  const normal: NonNullable<LifecycleOptions['call']> = async (operation, payload) => {
    if (operation === 'claim') {
      const result = { kind: 'claimed', version: 1, sessionId: identity.sessionId, fence: nonce,
        startedAt: new Date(epoch).toISOString(), maxSeconds: 120, checkpointRevision: 0, ...dates() };
      time += overrides.delay ?? 0; return result;
    }
    if (operation === 'checkpoint') {
      const { userId: _u, sessionId: _s, fence: _f, digest, ...content } = payload;
      assert.equal(digest, tutorDigest(content));
      assert.equal(content.serviceFailure === null || typeof content.serviceFailure === 'string', true);
      assert.ok(Object.hasOwn(content, 'baseline'));
      revision = Number(payload.revision); committed = clone(payload);
      return { kind: 'checkpointed', sessionId: identity.sessionId, revision, ...dates() };
    }
    if (operation === 'complete') { committed = clone(payload); return receipt(payload); }
    return { kind: 'pending', sessionId: identity.sessionId, revision, state: 'active' };
  };
  const call: NonNullable<LifecycleOptions['call']> = async (operation, payload, signal) => {
    calls.push({ operation, payload: clone(payload) });
    return overrides.call ? overrides.call(operation, payload, signal) : normal(operation, payload, signal);
  };
  return { calls, normal, receipt, advance: (ms: number) => { time += ms; }, options: { call, now: () => time, nonce, automaticTimers: false },
    claim: () => claimSessionLifecycle({ ...identity, ...(overrides.mode ? { mode: overrides.mode } : {}) }, { call, now: () => time, nonce, automaticTimers: false }) };
}

test('claim validates the owner fence and rejects a reused or oversized reservation', async () => {
  for (const patch of [{ fence: identity.userId }, { maxSeconds: 901 }, { checkpointRevision: 1 }, { version: 0 }]) {
    const base = fixture();
    await assert.rejects(claimSessionLifecycle(identity, { ...base.options, call: async (op, payload, signal) => ({ ...await base.normal(op, payload, signal), ...patch }) }), SessionLifecycleError);
  }
});
test('monotonic request-start deadlines conservatively subtract response latency and stop exactly at the lease bound', async () => {
  const f = fixture({ delay: 8_000 }); const life = await f.claim();
  assert.equal(life.maxSeconds, 120); assert.equal(life.elapsedSeconds(), 0);
  let stopped = 0; life.onStop(() => { stopped++; });
  f.advance(20_999); life.assertActive(); f.advance(1);
  assert.throws(() => life.assertActive(), SessionLifecycleError);
  assert.equal(life.signal.aborted, true); assert.equal(stopped, 1);
  assert.throws(() => life.assertActive()); assert.equal(stopped, 1);
  await life.complete({ learnerTurns: 100 });
});
test('a zero-revision heartbeat never invents turns or usage; a turn advances once and heartbeats repeat the exact digest', async () => {
  const f = fixture(); const life = await f.claim(); f.advance(5_000);
  await life.heartbeat(); await life.checkpoint({ learnerTurns: 1 }); f.advance(5_000); await life.heartbeat();
  const writes = f.calls.filter(c => c.operation === 'checkpoint').map(c => c.payload);
  assert.equal(writes[0]!.revision, 0); assert.equal(writes[0]!.seconds, 0);
  assert.equal(writes[1]!.revision, 1); assert.equal(writes[1]!.seconds, 5);
  assert.deepEqual(writes[1], writes[2]); await life.complete({ learnerTurns: 1 });
});
test('checkpoint retries are immutable even when an injected transport mutates its input', async () => {
  const f = fixture(); let attempts = 0; const writes: Row[] = [];
  const life = await claimSessionLifecycle(identity, { ...f.options, call: async (op, payload, signal) => {
    if (op === 'checkpoint') {
      writes.push(clone(payload)); attempts++;
      if (attempts === 1) { payload.learnerTurns = 900; throw new TutorRpcError(503); }
    }
    return f.normal(op, payload, signal);
  } });
  await life.checkpoint({ learnerTurns: 1 }); assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]);
  await life.complete({ learnerTurns: 1 });
});
test('queued reports are cloned before another caller mutates them and checkpoint calls are serialized', async () => {
  const f = fixture(); let inFlight = 0, maximum = 0;
  const life = await claimSessionLifecycle(identity, { ...f.options, call: async (op, payload, signal) => {
    if (op !== 'checkpoint') return f.normal(op, payload, signal);
    maximum = Math.max(maximum, ++inFlight); await Promise.resolve(); const result = await f.normal(op, payload, signal); inFlight--; return result;
  } });
  const report = { learnerTurns: 1 }; const first = life.checkpoint(report); report.learnerTurns = 99;
  const second = life.checkpoint({ learnerTurns: 2 }); await Promise.all([first, second]); assert.equal(maximum, 1);
  await life.complete({ learnerTurns: 2 });
});
test('an uncertain checkpoint stops paid work and resolves its committed revision before immutable completion', async () => {
  const f = fixture(); let lost = false, acknowledged = 0; const completionWrites: Row[] = [];
  const life = await claimSessionLifecycle(identity, { ...f.options, call: async (op, payload, signal) => {
    if (op === 'checkpoint') { await f.normal(op, payload, signal); lost = true; throw new TutorRpcError(503); }
    if (op === 'complete') completionWrites.push(clone(payload));
    return f.normal(op, payload, signal);
  } });
  await assert.rejects(life.checkpoint({ learnerTurns: 1 }, () => { acknowledged++; }));
  assert.equal(acknowledged, 0); assert.ok(lost); assert.equal(life.signal.aborted, true);
  const result = await life.complete({ learnerTurns: 99 }); assert.equal(result.kind, 'charged');
  assert.equal(completionWrites[0]!.revision, 2); assert.equal(completionWrites[0]!.learnerTurns, 1);
  assert.equal(acknowledged, 1, 'receipt confirmation acknowledges the exact committed state once');
});
test('completion is one joined promise; terminal infrastructure failure never reports an ordinary charge', async () => {
  const f = fixture(); const life = await f.claim(); await life.checkpoint({ learnerTurns: 1 }); f.advance(8_000);
  const first = life.complete({ learnerTurns: 1, serviceFailure: 'llm_error' });
  const second = life.complete({ learnerTurns: 100 }); assert.equal(first, second);
  assert.equal((await first).kind, 'not-charged'); const writes = f.calls.filter(c => c.operation === 'complete');
  assert.equal(writes.length, 1); assert.equal(writes[0]!.payload.revision, 2); assert.equal(writes[0]!.payload.serviceFailure, 'llm_error');
});
test('lost completion responses retry one immutable payload and recover the committed receipt', async () => {
  const f = fixture(); const writes: Row[] = []; let committed: Row | undefined;
  const life = await claimSessionLifecycle(identity, { ...f.options, call: async (op, payload, signal) => {
    if (op === 'complete') { writes.push(clone(payload)); committed = clone(payload); throw new TutorRpcError(503); }
    if (op === 'receipt' && committed) return f.receipt(committed);
    return f.normal(op, payload, signal);
  } });
  await life.checkpoint({ learnerTurns: 1 }); f.advance(8_000);
  assert.equal((await life.complete({ learnerTurns: 1 })).kind, 'charged'); assert.equal(writes.length, 3);
  assert.deepEqual(writes[0], writes[1]); assert.deepEqual(writes[1], writes[2]);
});
test('a failed terminal write without an authoritative receipt reports pending, never a fabricated refund', async () => {
  const f = fixture();
  const life = await claimSessionLifecycle(identity, { ...f.options, call: (op, payload, signal) => {
    if (op === 'complete') return Promise.reject(new TutorRpcError(503));
    return f.normal(op, payload, signal);
  } });
  await life.checkpoint({ learnerTurns: 1 }); assert.deepEqual(await life.complete({ learnerTurns: 1, serviceFailure: 'llm_error' }), { kind: 'pending' });
});
test('a charged receipt contradicting a terminal provider failure requires reconciliation', async () => {
  const f = fixture();
  const life = await claimSessionLifecycle(identity, { ...f.options, call: async (op, payload, signal) => {
    if (op === 'complete') return f.receipt({ ...payload, serviceFailure: null });
    return f.normal(op, payload, signal);
  } });
  await life.checkpoint({ learnerTurns: 1 }); assert.deepEqual(await life.complete({ learnerTurns: 1, serviceFailure: 'llm_error' }), { kind: 'reconciliation' });
});
test('permanent checkpoint refusal is not retried and a throwing cleanup callback remains contained', async () => {
  const f = fixture(); let writes = 0;
  const life = await claimSessionLifecycle(identity, { ...f.options, call: (op, payload, signal) => {
    if (op === 'checkpoint') { writes++; return Promise.reject(new TutorRpcError(403)); }
    return f.normal(op, payload, signal);
  } });
  life.onStop(() => { throw new Error('synthetic cleanup error'); });
  await assert.rejects(life.checkpoint({ learnerTurns: 1 })); assert.equal(writes, 1); assert.equal(life.signal.aborted, true);
  await life.complete({ learnerTurns: 1 });
});
test('positive conversation turns require a ready, owner-bound baseline; finish preserves only the acknowledged clean pack', async () => {
  const f = fixture({ mode: 'convo-text' }); const life = await f.claim();
  const pack = buildConversationPack({ id: identity.sessionId, sessionId: identity.sessionId, learnerId: identity.userId,
    createdAt: new Date(epoch).toISOString(), title: { fr: 'Au café', en: 'At the cafe' }, summary: 'You ordered coffee.', keyPhrases: [] });
  await life.checkpoint({ learnerTurns: 1, baseline: pack });
  pack.summary = 'unacknowledged mutation';
  await life.complete({ learnerTurns: 99, baseline: pack });
  const final = f.calls.find(c => c.operation === 'complete')!.payload;
  assert.equal(final.learnerTurns, 1); assert.equal((final.baseline as Row).summary, 'You ordered coffee.');
  const missing = fixture({ mode: 'convo-text' }); const bad = await missing.claim();
  await assert.rejects(bad.checkpoint({ learnerTurns: 1 })); assert.equal(missing.calls.some(c => c.operation === 'checkpoint'), false);
  await bad.complete({ learnerTurns: 0 });
});
test('a hung transport is bounded locally even if it ignores AbortSignal', async () => {
  const f = fixture(); const life = await claimSessionLifecycle(identity, { ...f.options, timeoutMs: 10,
    call: (op, payload, signal) => op === 'checkpoint' ? new Promise(() => {}) : f.normal(op, payload, signal) });
  await assert.rejects(life.checkpoint({ learnerTurns: 1 })); assert.equal(life.signal.aborted, true);
  await life.complete({ learnerTurns: 1 });
});
test('legacy execution requires an explicit local nonproduction fixture', () => {
  assert.equal(legacyRuntimeFixture({ NODE_ENV: 'production', LUVANI_LOCAL_DEVELOPMENT: '1' }), false);
  assert.equal(legacyRuntimeFixture({ NODE_ENV: 'test' }), false);
  assert.equal(legacyRuntimeFixture({ NODE_ENV: 'test', LUVANI_LOCAL_DEVELOPMENT: '1' }), true);
});

test('supervisor heartbeat reports readiness only after bounded SDK health and revokes it on drain', async () => {
  let healthy = false; const reports: Row[] = [], urls: string[] = [];
  const heartbeat = tutorSupervisorHeartbeat({ port: 8081, tokenServer: 'https://token.example', agentSecret: 'synthetic', workerId: nonce, automaticTimers: false,
    request: async (url, init) => {
      urls.push(String(url)); assert.equal(init?.redirect, 'error');
      if (String(url).startsWith('http:')) return new Response('SDK health', { status: healthy ? 200 : 503 });
      reports.push(JSON.parse(String(init?.body))); return new Response('{}');
    } });
  assert.equal(await heartbeat.poll(), false); healthy = true; assert.equal(await heartbeat.poll(), true);
  assert.equal(await heartbeat.drain(), false); assert.equal(await heartbeat.poll(), false);
  assert.deepEqual(reports.map(report => report.ready), [false, true, false, false]);
  assert.ok(urls.includes('http://127.0.0.1:8081/')); assert.equal(reports[0]!.role, 'tutor');
});
test('hung SDK health cannot hang the supervisor or claim readiness', async () => {
  const reports: Row[] = [];
  const heartbeat = tutorSupervisorHeartbeat({ port: 8081, tokenServer: 'https://token.example', agentSecret: 'synthetic', workerId: nonce,
    automaticTimers: false, timeoutMs: 10, request: (url, init) => {
      if (String(url).startsWith('http:')) return new Promise(() => {});
      reports.push(JSON.parse(String(init?.body))); return Promise.resolve(new Response('{}'));
    } });
  assert.equal(await heartbeat.poll(), false); assert.equal(reports[0]!.ready, false);
});

test('finish billing cutoff excludes analysts while paid lease remains live and later ACKs preserve cutoff',async()=>{
 const f=fixture(),life=await f.claim();f.advance(8000);await life.checkpoint({learnerTurns:1});
 life.freezeBillingCutoff();f.advance(5000);life.assertActive();assert.equal(life.signal.aborted,false);assert.equal(life.elapsedSeconds(),8);
 await life.checkpoint({learnerTurns:1});await life.complete({learnerTurns:1});
 const after=f.calls.filter(c=>c.operation==='checkpoint'||c.operation==='complete');assert.ok(after.length>=3);assert.ok(after.every(c=>c.payload.seconds===8));
});
