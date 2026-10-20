/**
 * Which D24 features are locked for this learner, said in one place
 * (2026-10-20, the Headspace model).
 *
 * Pure, in the `exploreAccess.ts` style: predicates over the server's billing
 * answer, a route map, and one module-level standing that a synchronous caller
 * can read. The hook that keeps the standing fresh and opens the wall is
 * `useFeatureLocks.ts`; the locked-route guard lives in App.tsx's navigator.
 *
 * These are presentation locks. The server meters every live minute whatever
 * this file says, so a lock that fails open (an unreadable plan) costs nothing
 * the token server would not already refuse. That is why the synchronous read
 * opens on unknown: a learner is never stranded behind a lock nobody could
 * check. The reactive read says 'unknown' so a surface can choose to wait.
 */

import type { BillingStatus } from './billingStatus.ts';
import { LOCKED_FEATURES, capabilitiesFor, type LockedFeature } from './capabilities.ts';

export { LOCKED_FEATURES, type LockedFeature };

export type FeatureLockState = 'unlocked' | 'locked' | 'unknown';

/** What the server's answer opens. Null (unread) is 'unknown', never 'locked'. */
export function featureLockState(feature: LockedFeature, status: BillingStatus | null): FeatureLockState {
  if (status === null) return 'unknown';
  return capabilitiesFor(status.plan, status.lapsed).unlocks[feature] ? 'unlocked' : 'locked';
}

/**
 * The routes that are a locked feature whatever their params. Direction B's
 * 'Fixes' and 'ThenNow' are named ahead of their screens so a rebase needs no
 * edit here. Review and SoundCheck notes are in `lockedRouteFeature`.
 */
export const LOCKED_ROUTES: Readonly<Record<string, LockedFeature>> = {
  TutorMemory: 'tutorMemory',
  SoundJourney: 'sounds',
  SoundCheck: 'sounds',
  // The café pronunciation lesson is sound practice (founder, 2026-10-20,
  // after D24): locked in spoken and typed mode alike.
  Lesson: 'sounds',
  ConversationPractice: 'conversationPractice',
  RealMoment: 'realMoment',
  Fixes: 'fixes',
  ThenNow: 'thenAndNow',
};

/**
 * The feature a focused route belongs to, or null when it is free.
 *
 * Drill is locked only when its params say it is a sitting on one saved
 * conversation (`practice: 'pack'` with a packId): that is review of
 * conversation phrases. The recommended sitting, a resumed one, a node of the
 * path, a made phrase and the ordinary deck stay free. Review takes no params,
 * so it cannot say what it reviews, and it stays free. Convo, DailyPractice
 * and FirstScene are free. Lesson (the café pronunciation lesson) is locked
 * as 'sounds' whatever its params, typed mode included.
 */
export function lockedRouteFeature(name: string, params?: unknown): LockedFeature | null {
  const direct = Object.prototype.hasOwnProperty.call(LOCKED_ROUTES, name) ? LOCKED_ROUTES[name]! : null;
  if (direct !== null) return direct;
  if (name === 'Drill' && typeof params === 'object' && params !== null) {
    const p = params as Record<string, unknown>;
    if (p.practice === 'pack' && typeof p.packId === 'string' && p.packId.length > 0) return 'conversationPractice';
  }
  return null;
}

// The last answer read for the signed-in account, so a synchronous caller
// (direction B's featureAccess) can ask without a fetch.
let standing: { userId: string; status: BillingStatus | null } | null = null;
// Bumped on every invalidation, so a read begun before a purchase cannot land
// its old answer after it.
let version = 0;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) {
    try { listener(); } catch { /* a view cannot change the standing */ }
  }
}

/** Record the server's answer for this account. A null status is "could not read". */
export function setStanding(userId: string, status: BillingStatus | null): void {
  standing = { userId, status };
  changed();
}

/** The invalidation count; a read records its answer only if this is unchanged. */
export function standingVersion(): number {
  return version;
}

/**
 * A billing change: drop this account's answer to unread at once, before the
 * fresh read returns. Without it a resume after a purchase (afterPurchase)
 * meets the old 'locked' answer and the guard swaps the lesson for the wall;
 * unread makes the guard read again instead.
 */
export function invalidateStanding(userId: string): void {
  version++;
  if (standing === null || standing.userId !== userId) return;
  standing = { userId, status: null };
  changed();
}

/** Forget the standing: on sign-out and on every account change. */
export function clearStanding(): void {
  version++;
  if (standing === null) return;
  standing = null;
  changed();
}

/** The cached answer, only for this account; anything else is unread. */
export function standingFor(userId: string | null | undefined): BillingStatus | null {
  if (!userId || standing === null || standing.userId !== userId) return null;
  return standing.status;
}

/** The cached lock state for whoever's standing is held. */
export function featureLockStateNow(feature: LockedFeature): FeatureLockState {
  return featureLockState(feature, standing?.status ?? null);
}

/** Synchronous, and open when unknown: a lock nobody could check never strands anyone. */
export function featureLockedNow(feature: LockedFeature): boolean {
  return featureLockStateNow(feature) === 'locked';
}

/** Hear every standing change, for the reactive hook. */
export function onStandingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * The locked-route guard's decision. 'wall' replaces the screen with the wall,
 * 'stay' leaves it, 'read' asks for one fenced status read and decides again
 * with its answer (an unreadable answer then stays: fail open).
 */
export function lockedRouteDecision(name: string, params: unknown, status: BillingStatus | null, readDone: boolean): 'wall' | 'stay' | 'read' {
  const feature = lockedRouteFeature(name, params);
  if (feature === null) return 'stay';
  const state = featureLockState(feature, status);
  if (state === 'locked') return 'wall';
  if (state === 'unlocked') return 'stay';
  return readDone ? 'stay' : 'read';
}

export interface LockedRouteEnv {
  /** The focused route, nested, or undefined before the navigator is ready. */
  route: () => { key: string; name: string; params?: unknown } | undefined;
  /** The cached standing for this account, or null when unread. */
  standing: () => BillingStatus | null;
  /** One fresh status read. */
  read: () => Promise<BillingStatus | null>;
  owner: () => number;
  /** Replace the focused screen with the wall at its `locked` door. */
  toWall: () => void;
}

/**
 * The navigator's guard, called on every state change. Locked: the wall
 * replaces the screen, so leaving the wall goes back to where the learner was.
 * Unlocked or free: nothing. Unknown: one read, fenced to the same request,
 * account and focused route; an unreadable answer leaves the screen open.
 */
export function lockedRouteGuard(env: LockedRouteEnv): () => Promise<void> {
  let request = 0;
  let reading: string | null = null;
  return async () => {
    const route = env.route();
    if (route === undefined) return;
    const decision = lockedRouteDecision(route.name, route.params, env.standing(), false);
    if (decision !== 'read') {
      request++;
      reading = null;
      if (decision === 'wall') env.toWall();
      return;
    }
    if (reading === route.key) return;
    const req = ++request;
    const owner = env.owner();
    reading = route.key;
    let status: BillingStatus | null;
    try { status = await env.read(); } catch { status = null; }
    if (req !== request || owner !== env.owner() || env.route()?.key !== route.key) return;
    reading = null;
    if (lockedRouteDecision(route.name, route.params, status, true) === 'wall') env.toWall();
  };
}
