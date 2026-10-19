import type { BillingStatus } from './billingStatus.ts';
import { capabilitiesFor } from './capabilities.ts';

export type ExploreAccessRef = { kind: 'scenario' | 'daily' | 'mission'; id: string };

/** Permanent editorial samples, one per theme and authored pitch. Never a daily reset. */
const FREE_SCENARIOS = [
  'situation:cafe-terrace', 'situation:cafe-menu-question', 'situation:friends-splitting-the-bill',
  'situation:market-apples', 'situation:market-cheese', 'situation:market-change',
  'situation:street-platform', 'situation:street-metro-ticket', 'situation:street-bag-on-the-train',
  'situation:home-bin-night', 'situation:home-neighbour', 'situation:home-water-leak',
  'situation:friends-first-meeting', 'situation:friends-catch-up', 'situation:friends-cancelling-on-the-day',
  'situation:work-first-day-hello', 'situation:friends-what-you-do', 'situation:home-phone-call',
  'situation:pharmacy-headache', 'situation:market-pharmacy', 'situation:health-refund-never-arrived',
  'situation:hotel-check-in', 'situation:hotel-quieter-room', 'situation:hotel-late-arrival',
  'situation:bar-a-beer', 'situation:cafe-evening-drink', 'situation:cinema-sound-cut-out',
  'situation:museum-one-ticket', 'situation:street-museum', 'situation:friends-film-talk',
] as const;
const samples = new Set<string>(FREE_SCENARIOS);

export function freeExploreScenarioIds(): readonly string[] { return FREE_SCENARIOS; }
export function isFreeExploreContent(ref: ExploreAccessRef): boolean {
  // Existing local learning and personal practice keep their free promise.
  return ref.kind !== 'scenario' || samples.has(ref.id);
}

/** A server answer, never a client purchase result, opens the curated library. */
export function hasExplorePlan(status: BillingStatus | null): boolean {
  // periodEnd is the allowance-window end on annual plans, not paid-through.
  // Only the server's lapsed standing decides subscription access.
  return capabilitiesFor(status?.plan ?? 'unknown', status?.lapsed ?? true).liveMinutes !== 'trial';
}

export function exploreAccessLabel(ref: ExploreAccessRef, status: BillingStatus | null): string | null {
  if (ref.kind !== 'scenario') return null;
  if (isFreeExploreContent(ref)) return 'Free sample';
  return hasExplorePlan(status) ? null : 'Included with a plan';
}

/** Request-fenced gate; the caller's owner check also rejects blur/unmount/account changes. */
export async function openExploreContent(input: {
  ref: ExploreAccessRef;
  read: () => Promise<BillingStatus | null>;
  current: () => boolean;
  open: () => void;
  plans: () => void;
  unavailable: () => void;
}): Promise<void> {
  if (!input.current()) return;
  if (isFreeExploreContent(input.ref)) { input.open(); return; }
  let status: BillingStatus | null;
  try { status = await input.read(); } catch { status = null; }
  if (!input.current()) return;
  if (status === null) { input.unavailable(); return; }
  if (hasExplorePlan(status)) input.open();
  else input.plans();
}
