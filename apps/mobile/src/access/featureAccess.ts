/**
 * The one access seam for lock badges (Phase B, B0, 2026-10-20).
 *
 * It lists the D24 features that the trial will lock, and answers whether one
 * is locked. A surface draws `<LockBadge>` only when this says 'locked', so the
 * badge never decides anything and D5 changes this one file.
 *
 * Today it answers 'unlocked' for everyone: gating does not exist yet, so
 * nothing may show as locked. D5 (revenue-engineer) wires it to entitlement
 * and the paywall. Until then this file must not import from `purchases/` or
 * `wall/`; featureAccess.test.ts holds that.
 */

export const LOCKED_FEATURES = [
  /** Your fixes. */
  'fixes',
  /** Then and now. */
  'thenAndNow',
  /** Review and drills of conversation phrases. */
  'conversationPractice',
  /** Your sounds. */
  'sounds',
  /** Prepare for something real. */
  'realMoment',
  /** Continue an arc, and the same-scene replay. */
  'continueArc',
  /** The full Journey. */
  'fullJourney',
  /** What the tutor remembers. */
  'tutorMemory',
] as const;

export type LockedFeature = (typeof LOCKED_FEATURES)[number];

export type FeatureAccess = 'unlocked' | 'locked';

export function featureAccess(_feature: LockedFeature): FeatureAccess {
  // 2026-10-20 (B0): unlocked for everyone until D5 wires entitlement.
  return 'unlocked';
}
