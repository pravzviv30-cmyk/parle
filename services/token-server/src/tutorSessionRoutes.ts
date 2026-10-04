import { isServiceFailure } from '@luvani/core';
import { validConversationPackFor } from './conversationPacks.ts';
import { HttpInputError } from './requestBoundary.ts';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';
import type { TutorSessionRepository } from './tutorSessions.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TUTOR_OPERATIONS = ['claim', 'checkpoint', 'complete', 'receipt'] as const;
export type TutorOperation = typeof TUTOR_OPERATIONS[number];
const invalid = (): never => { throw new HttpInputError(400, 'invalid tutor operation'); };
function keys(body: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid();
}
/** Validate the service protocol before any database call; SQL validates again. */
export async function tutorSessionOperation(repository: TutorSessionRepository, operation: TutorOperation, body: Record<string, unknown>) {
  const { userId, sessionId } = body;
  if (typeof userId !== 'string' || !uuid.test(userId) || typeof sessionId !== 'string' || !uuid.test(sessionId)) invalid();
  if (operation === 'receipt') {
    keys(body, ['userId', 'sessionId']);
    return repository.receipt(userId as string, sessionId as string);
  }
  if (operation === 'claim') {
    keys(body, ['userId', 'sessionId', 'roomName', 'mode', 'claimNonce']);
    if (typeof body.roomName !== 'string' || !/^luvani-[a-zA-Z0-9_-]{1,100}$/.test(body.roomName)
      || typeof body.mode !== 'string' || !['lesson', 'lesson-text', 'convo', 'convo-text'].includes(body.mode)
      || typeof body.claimNonce !== 'string' || !uuid.test(body.claimNonce)) invalid();
    return repository.rpc('claim_tutor_session_v1', { p_user_id: userId, p_session_id: sessionId,
      p_room_name: body.roomName, p_mode: body.mode, p_claim_nonce: body.claimNonce });
  }
  keys(body, ['userId', 'sessionId', 'fence', 'revision', 'digest', 'seconds', 'learnerTurns', 'serviceFailure', 'baseline']);
  if (typeof body.fence !== 'string' || !uuid.test(body.fence) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0
    || !Number.isSafeInteger(body.seconds) || Number(body.seconds) < 0 || Number(body.seconds) > 900
    || !Number.isSafeInteger(body.learnerTurns) || Number(body.learnerTurns) < 0 || Number(body.learnerTurns) > 1000
    || (body.serviceFailure != null && !isServiceFailure(body.serviceFailure))
    || (body.baseline != null && !validConversationPackFor(body.baseline, userId as string, sessionId as string))) invalid();
  const payload = { revision: body.revision, seconds: body.seconds, learnerTurns: body.learnerTurns,
    serviceFailure: body.serviceFailure ?? null, baseline: body.baseline ?? null };
  if (typeof body.digest !== 'string' || body.digest !== tutorDigest(payload)) invalid();
  return repository.rpc(operation === 'checkpoint' ? 'checkpoint_tutor_session_v1' : 'complete_tutor_session_v1', {
    p_user_id: userId, p_session_id: sessionId, p_fence: body.fence, p_revision: payload.revision,
    p_digest: body.digest, p_seconds: payload.seconds, p_learner_turns: payload.learnerTurns,
    p_service_failure: payload.serviceFailure, p_baseline: payload.baseline,
  });
}
