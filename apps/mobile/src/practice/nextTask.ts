import type { Recommendation } from './recommendation.ts';
import type { HomeBilling } from '../home/nextAction.ts';
/** Resume/owned practice first. Purchase and live scene gates never strand local work. */
export function nextTaskKind(rec: Recommendation, live: boolean, billing: HomeBilling | null, reviewReady = false): 'practice' | 'review' | 'local' | 'plans' | 'scene' {
  if (rec.kind !== 'none') return 'practice';
  if (reviewReady) return 'review';
  if (!live) return 'local';
  if (billing?.plan === 'trial' && (billing.reason === 'exhausted' || billing.reason === 'insufficient-for-session')) return 'plans';
  return 'scene';
}

/**
 * Today's lead (F936, F651, F924): the one rule HomeTab's scene stop follows.
 * Billing first: a trial that cannot start a session leads with plans, ahead
 * of a starter continuation too, so no card offers a live scene the server
 * will refuse. Then the starter card (it works offline), then offline, then
 * the scene. Same order as `nextTaskKind`, which it calls.
 */
export type TodayLead = 'plans' | 'outOfTime' | 'starter' | 'local' | 'scene';
export function todayLead(input: { live: boolean; billing: HomeBilling | null; starter: boolean }): TodayLead {
  const kind = nextTaskKind({ kind: 'none', fallback: 'first' }, true, input.billing);
  if (kind === 'plans') return 'plans';
  // A paid plan out of minutes (fix-verifier, 2026-10-29): the out-of-time
  // words with the refill day, never a plans pitch to someone who pays.
  if (input.billing !== null && input.billing.plan !== 'trial' && (input.billing.reason === 'exhausted' || input.billing.reason === 'insufficient-for-session')) return 'outOfTime';
  if (input.starter) return 'starter';
  return nextTaskKind({ kind: 'none', fallback: 'first' }, input.live, input.billing) === 'local' ? 'local' : 'scene';
}

/** Home's "See plans" door is for the free plan only (F935). An unknown plan is offered no purchase door. */
export function offersPlans(billing: HomeBilling | null): boolean {
  return billing?.plan === 'trial';
}

/** A scene lead with no next scene (an empty progress read) is not offline: it points to Explore. */
export function sceneOrExplore(lead: TodayLead, hasHero: boolean): TodayLead | 'explore' {
  return lead === 'scene' && !hasHero ? 'explore' : lead;
}

/**
 * The starter card's "Speak with my tutor": only once billing has answered,
 * live, and able to start. While billing loads it is held, so a trial with no
 * time never sees it flash (fix-verifier, 2026-10-29).
 */
export function starterTutorOpen(input: { live: boolean; billing: HomeBilling | null; answered: boolean }): boolean {
  if (!input.live || !input.answered) return false;
  return todayLead({ live: true, billing: input.billing, starter: true }) === 'starter';
}
