import { PLANS, type Plan } from './metering/meter.ts';

const MAX_PLAN_SECONDS = Math.max(...Object.values(PLANS).map((p) => p.secondsPerPeriod));

export const SERVICE_FAILURES = ['stt_error', 'tts_error', 'llm_error', 'realtime_model_error', 'interruption_detection_error'] as const;
export type ServiceFailure = typeof SERVICE_FAILURES[number];
export function isServiceFailure(value: unknown): value is ServiceFailure {
  return typeof value === 'string' && (SERVICE_FAILURES as readonly string[]).includes(value);
}

export interface SessionSettlement {
  kind: 'charged' | 'not-charged' | 'restored-current-period' | 'historical-reversal';
  refundedSeconds: number;
  secondsRemaining: number;
  plan: Plan;
}
export type SettlementResult = SessionSettlement | { kind: 'pending' | 'reconciliation' };
export function readSettlementResult(value: unknown): SettlementResult | null {
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if ((row.kind === 'pending' || row.kind === 'reconciliation') && Object.keys(row).length === 1) return { kind: row.kind };
  }
  return readSessionSettlement(value);
}

export function readSessionSettlement(value: unknown): SessionSettlement | null {
  if (value === null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (!['charged','not-charged','restored-current-period','historical-reversal'].includes(String(row.kind))
    || !['trial','starter','regular'].includes(String(row.plan))
    || !Number.isInteger(row.refundedSeconds) || Number(row.refundedSeconds) < 0 || Number(row.refundedSeconds) > 900
    || !Number.isInteger(row.secondsRemaining) || Number(row.secondsRemaining) < 0 || Number(row.secondsRemaining) > MAX_PLAN_SECONDS
    || (['trial','starter','regular'].includes(String(row.plan)) && Number(row.secondsRemaining) > PLANS[row.plan as Plan].secondsPerPeriod)
    || ((row.kind === 'restored-current-period' || row.kind === 'historical-reversal') && Number(row.refundedSeconds) === 0)
    || ((row.kind === 'charged' || row.kind === 'not-charged') && row.refundedSeconds !== 0)) return null;
  return { kind: row.kind as SessionSettlement['kind'], refundedSeconds: Number(row.refundedSeconds),
    secondsRemaining: Number(row.secondsRemaining), plan: row.plan as Plan };
}

export function sessionSettlementCopy(result: SettlementResult): string | null {
  switch (result.kind) {
    case 'charged': return null;
    case 'not-charged': return 'The minutes from this session did not count against your allowance.';
    case 'restored-current-period': return 'The minutes charged for this session are back in your allowance.';
    case 'historical-reversal': return 'The charge for this session was reversed in its earlier allowance period.';
    case 'pending': return 'The session stopped because of a Luvani problem. Its minutes are still being checked.';
    case 'reconciliation': return 'The session stopped because of a Luvani problem. Its earlier charge needs checking.';
  }
}
