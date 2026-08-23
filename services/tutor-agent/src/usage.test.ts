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
  test('reports zero seconds so an unusable session is released without being charged', async () => {
    const bodies: string[] = [];
    const request = async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ secondsRemaining: 1800 }), { status: 200 });
    };

    await reportUsage(report, {
      request: request as typeof fetch,
      tokenServer: 'https://api.parle.test',
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
      tokenServer: 'https://api.parle.test',
      attempts: 2,
      sleep: async () => {},
    });

    assert.equal(calls, 2);
    assert.deepEqual(sessionIds, [report.sessionId, report.sessionId]);
  });
});
