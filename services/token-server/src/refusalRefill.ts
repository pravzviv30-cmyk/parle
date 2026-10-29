import { canStartSession, type Entitlement } from '@luvani/core';

/**
 * When a Free learner's next free conversation is ready, as ISO, for a refused
 * reservation's 402. The database decided the reason; core knows the instant.
 * Core names it for a spent window; a thin window ("insufficient-for-session")
 * refills at the same `periodEnd`, by the same rule core uses: trial plan only,
 * and only once the window exists. No `periodEnd` means no time is sent, and a
 * paid plan sends none, matching paid out-of-time.
 */
export function refusalRefillsAt(reason: string, entitlement: Entitlement): string | undefined {
  const decision = canStartSession(entitlement);
  if (!decision.allowed && decision.refillsAt) return decision.refillsAt.toISOString();
  if (reason === 'insufficient-for-session' && entitlement.plan === 'trial' && entitlement.periodEnd) {
    return entitlement.periodEnd.toISOString();
  }
  return undefined;
}
