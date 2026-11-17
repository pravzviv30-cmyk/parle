import { canStartSession, type Entitlement } from '@luvani/core';

/**
 * When a Free learner's next free conversation is ready, as ISO, for a refused
 * reservation's 402. The database decided the reason; core knows the instant,
 * for a spent window and a thin one alike. A thin refusal is the database's
 * call, so core is asked with no session floor: whatever is left reads as thin,
 * even when this entitlement alone would have admitted the learner. No
 * `periodEnd` means no time is sent, and a paid plan sends none.
 */
export function refusalRefillsAt(reason: string, entitlement: Entitlement): string | undefined {
  const decision = canStartSession(entitlement, reason === 'insufficient-for-session' ? Infinity : undefined);
  return !decision.allowed && decision.refillsAt ? decision.refillsAt.toISOString() : undefined;
}
