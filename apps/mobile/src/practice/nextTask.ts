import type { Recommendation } from './recommendation.ts';
import type { HomeBilling } from '../home/nextAction.ts';
import { OUT_OF_TIME_WORDS, PERIOD_LINES, outOfTimeWords } from '../purchases/outOfTime.ts';
import { pathStep } from '../home/todayView.ts';
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
export type TodayLead = 'loading' | 'plans' | 'lapsed' | 'outOfTime' | 'starter' | 'local' | 'scene';
/**
 * `answered` is whether the billing read has answered (fix-verifier round 2):
 * live and unanswered holds the lead on the loading frame, so an out-of-time
 * learner never sees the scene flash first. A failed read answers with null,
 * which is the scene, as before. Omitted, it counts as answered.
 */
export function todayLead(input: { live: boolean; billing: HomeBilling | null; starter: boolean; answered?: boolean }): TodayLead {
  if (input.live && input.answered === false) return 'loading';
  // A lapsed subscription can start nothing; it holds no plan, so may see plans.
  if (input.billing?.reason === 'subscription-lapsed') return 'lapsed';
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

/** Under the out-of-time or lapsed words: the practice that needs no minutes, with its own button. */
export function afterHeld(starter: boolean): 'starter' | 'local' {
  return starter ? 'starter' : 'local';
}

/** The words of a lead that cannot start a scene, and whether it may offer plans. */
export function heldWords(billing: HomeBilling, now: number): { title: string; message: string; plans: boolean } {
  if (billing.reason === 'subscription-lapsed') return { title: PERIOD_LINES.lapsed, message: OUT_OF_TIME_WORDS.offlineUntimed, plans: true };
  const words = outOfTimeWords({ plan: billing.plan, reason: billing.reason, refillsAt: billing.periodEnd ?? null, now });
  return { title: words.title, message: words.message, plans: false };
}

/** The path stop's words for each lead: the scene's own minutes, or what the lead honestly is. */
export function leadStop(lead: TodayLead | 'explore', minutes: number | null): { title: string; line: string } {
  if (lead === 'scene' && minutes !== null) return pathStep('scene', minutes);
  if (lead === 'plans') return { title: 'The next scene', line: 'Needs more speaking time' };
  if (lead === 'outOfTime') return { title: 'The next scene', line: 'When your minutes come back' };
  if (lead === 'lapsed') return { title: 'The next scene', line: 'When you choose a plan' };
  if (lead === 'explore') return { title: 'Something new', line: 'Pick a scene or a topic' };
  if (lead === 'starter') return { title: 'Continue your practice', line: 'Typed, no connection needed' };
  // Offline or the tutor out of reach: true in both (fix-verifier round 2).
  if (lead === 'local') return { title: 'Something you can do now', line: 'No connection needed' };
  return { title: 'The next scene', line: 'Finding your next task' };
}
