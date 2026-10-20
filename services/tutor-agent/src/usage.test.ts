import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { reportUsage } from './usage.ts';

const report = {
  userId: 'learner-1',
  sessionId: '123e4567-e89b-42d3-a456-426614174000',
  seconds: 0,
  utterancesScored: 0,
};

describe('usage reporting', () => {
  test('a failed refund request stays pending until an explicit settlement acknowledgement', async () => {
    const refund = { ...report, seconds: 100, serviceFailure: 'tts_error' as const };
    const base = { tokenServer: 'https://api.luvani.test', agentSecret: 'agent-secret', attempts: 1 };
    assert.deepEqual(await reportUsage(refund, { ...base, request: async () => new Response('{}', { status: 503 }) }), { kind: 'pending' });
    assert.deepEqual(await reportUsage(refund, { ...base, request: async () => new Response(JSON.stringify({ secondsRemaining: 200 }), { status: 200 }) }), { kind: 'pending' });
    assert.deepEqual(await reportUsage(refund, { ...base, request: async () => new Response('{}', { status: 409 }) }), { kind: 'reconciliation' });
    const ack = { kind: 'restored-current-period', refundedSeconds: 100, secondsRemaining: 200, plan: 'trial' };
    let sent: Record<string, unknown> = {};
    const confirmed = await reportUsage(refund, { ...base, request: async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      assert.ok(options?.signal, 'the request itself is bounded, not just the retry count');
      return new Response(JSON.stringify(ack), { status: 200 });
    } });
    assert.equal(sent.serviceFailure, 'tts_error');
    assert.deepEqual(confirmed, ack);
  });
  test('reports zero seconds so an unusable session is released without being charged', async () => {
    const bodies: string[] = [];
    const request = async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ secondsRemaining: 200 }), { status: 200 });
    };

    await reportUsage(report, {
      request: request as typeof fetch,
      tokenServer: 'https://api.luvani.test',
      agentSecret: 'agent-secret',
      attempts: 1,
    });

    assert.equal(bodies.length, 1);
    assert.deepEqual(JSON.parse(bodies[0]!), {
      userId: report.userId,
      sessionId: report.sessionId,
      seconds: 0,
      utterancesScored: 0,
    });
  });

  test('retries a transient failure with the same session id', async () => {
    const sessionIds: string[] = [];
    let calls = 0;
    const request = async (_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      sessionIds.push((JSON.parse(String(init?.body)) as { sessionId: string }).sessionId);
      return calls === 1
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ secondsRemaining: 1600 }), { status: 200 });
    };

    await reportUsage({ ...report, seconds: 200 }, {
      request: request as typeof fetch,
      tokenServer: 'https://api.luvani.test',
      attempts: 2,
      sleep: async () => {},
    });

    assert.equal(calls, 2);
    assert.deepEqual(sessionIds, [report.sessionId, report.sessionId]);
  });
});
