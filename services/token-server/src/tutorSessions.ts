import { tutorSessionRpc, tutorDigest } from '../../shared/tutorLifecycle.ts';
import type { SessionMode } from './tokens.ts';
import { PLANS } from '@luvani/core';

export interface ReservedTutorSession {
  kind: 'reserved'; version: 1; userId: string; sessionId: string; roomName: string; mode: SessionMode;
  plan: keyof typeof PLANS; reservedSeconds: number; secondsRemaining: number; joinDeadline: string;
}
export class TutorSessionRepository {
  readonly rpc: ReturnType<typeof tutorSessionRpc>;
  constructor(baseUrl: string, serviceKey: string, request: typeof fetch = fetch) { this.rpc = tutorSessionRpc(baseUrl, serviceKey, request); }
  async reserve(input: { userId: string; authSessionId: string; sessionId: string; roomName: string; mode: SessionMode; request: unknown }): Promise<ReservedTutorSession | { kind: 'refused'; reason: string }> {
    const row = await this.rpc('reserve_tutor_session_v1', { p_user_id: input.userId, p_session_id: input.sessionId,
      p_room_name: input.roomName, p_mode: input.mode, p_request_digest: tutorDigest(input.request), p_auth_session_id: input.authSessionId });
    if (row.kind === 'refused' && typeof row.reason === 'string') return { kind: 'refused', reason: row.reason };
    if (row.kind !== 'reserved' || row.version !== 1 || row.userId !== input.userId || row.sessionId !== input.sessionId
      || row.roomName !== input.roomName || row.mode !== input.mode || typeof row.plan !== 'string' || !Object.hasOwn(PLANS, row.plan)
      || !Number.isInteger(row.reservedSeconds) || Number(row.reservedSeconds) < 120 || Number(row.reservedSeconds) > 900
      || !Number.isInteger(row.secondsRemaining) || Number(row.secondsRemaining) < Number(row.reservedSeconds)
      || Number(row.secondsRemaining) > PLANS[row.plan as keyof typeof PLANS].secondsPerPeriod
      || typeof row.joinDeadline !== 'string' || !Number.isFinite(Date.parse(row.joinDeadline))) throw new Error('invalid-session-reservation');
    return row as unknown as ReservedTutorSession;
  }
  abandon(userId: string, sessionId: string) { return this.rpc('abandon_tutor_session_v1', { p_user_id: userId, p_session_id: sessionId }); }
  receipt(userId: string, sessionId: string) { return this.rpc('receipt_tutor_session_v1', { p_user_id: userId, p_session_id: sessionId }); }
  fenceAccount(userId: string) { return this.rpc('fence_tutor_account_v1', { p_user_id: userId }); }
}
