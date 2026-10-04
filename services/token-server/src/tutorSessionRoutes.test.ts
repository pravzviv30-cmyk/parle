import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tutorSessionOperation } from './tutorSessionRoutes.ts';
import type { TutorSessionRepository } from './tutorSessions.ts';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';

const id = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
test('session route refuses mismatched digests, unknown fields and malformed controls before SQL', async () => {
  let calls = 0;
  const repository = { rpc: async () => { calls++; return {}; } } as unknown as TutorSessionRepository;
  const payload = { revision: 1, seconds: 2, learnerTurns: 1, serviceFailure: null, baseline: null };
  const body = { userId: id, sessionId, fence: id, ...payload, digest: tutorDigest(payload) };
  for (const corrupt of [{ digest: 'a'.repeat(64) }, { seconds: 901 }, { learnerTurns: 1.5 }, { fence: 'invalid' }, { surprise: 'private' }, { baseline: {} }]) {
    await assert.rejects(tutorSessionOperation(repository, 'complete', { ...body, ...corrupt }), error => (error as { status: number }).status === 400);
  }
  await assert.rejects(tutorSessionOperation(repository, 'claim', { userId: id, sessionId, roomName: 'luvani-test', claimNonce: id, mode: { toString: 42 } }));
  assert.equal(calls, 0);
  await tutorSessionOperation(repository, 'complete', body);
  assert.equal(calls, 1);
});
test('completion maps the immutable canonical report to the fixed SQL operation', async () => {
  const payload = { revision: 2, seconds: 0, learnerTurns: 0, serviceFailure: 'llm_error', baseline: null };
  const repository = { rpc: async (name: string, args: Record<string, unknown>) => {
    assert.equal(name, 'complete_tutor_session_v1');
    assert.equal(args.p_user_id, id); assert.equal(args.p_session_id, sessionId);
    assert.equal(args.p_digest, tutorDigest(payload)); assert.equal(args.p_baseline, null);
    return { kind: 'completed', receipt: { opaque: true } };
  } } as unknown as TutorSessionRepository;
  assert.deepEqual(await tutorSessionOperation(repository, 'complete', { userId: id, sessionId, fence: id, ...payload, digest: tutorDigest(payload) }), { kind: 'completed', receipt: { opaque: true } });
  assert.equal(tutorDigest({ b: 1, a: 2 }), tutorDigest({ a: 2, b: 1 }));
  assert.throws(() => tutorDigest([undefined]));
});
