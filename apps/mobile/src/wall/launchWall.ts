/**
 * When the wall opens on its own (D24, 2026-10-20, the Headspace model).
 *
 * D13 said the wall is never shown again on its own. D24 replaces that: the
 * free-trial offer shows on each open of the app, at the wall's `launch` door,
 * to a learner who holds no plan and no trial. The D13 offer after a kept guest
 * practice stays, at its `path-complete` door, and it is the same pending flag:
 * a launch that just onboarded shows that one offer, never two.
 *
 * Pending on every cold launch, and again on a return to the foreground after
 * at least LAUNCH_WALL_AWAY_MS in the background. It opens only when all of
 * these are true at once, and is held, not dropped, while any is not:
 *
 * - the navigator is ready and the visible route is a tab root, so never on top
 *   of a lesson, a conversation, a drill, a review, a daily phrase, a sound
 *   check, a conversation's practice, the first scene, or the wall itself;
 * - no celebration holds the queue, and Home's arrival is allowed (the
 *   navigator is not hidden under the account hand-off);
 * - the app is in the foreground.
 *
 * Then it is taken (once) and two reads decide: the server says no plan or
 * trial (`plan === 'trial' || lapsed`; a store trial answers as the plan) and
 * the store has plans to sell. An unread answer, a failure, an account change
 * or leaving the tab root before the answer lands shows nothing. A launch flag
 * still pending when the app goes to the background is dropped.
 *
 * Nothing here touches the disk. Pure apart from what `env` hands in, so
 * `launchWall.test.ts` runs the whole controller; `useLaunchWall.ts` wires it.
 */

import type { BillingStatus } from '../purchases/billingStatus.ts';

/** Time in the background after which coming back is an open of the app again. */
export const LAUNCH_WALL_AWAY_MS = 30 * 60 * 1000;

/** The tabs inside 'Tabs'. The wall opens over one of these and nothing else. */
export const TAB_ROOTS: readonly string[] = ['Home', 'Explore', 'Tutor', 'Practice', 'MyFrench'];

export type WallDoor = 'launch' | 'path-complete';

/** The nested focused route is a tab root, never the Tabs shell or a pushed screen. */
export function tabRootVisible(route: { name: string } | undefined): boolean {
  return route !== undefined && TAB_ROOTS.includes(route.name);
}

/** Whether a stint away of `awayMs` makes coming back an open of the app. A clock that ran backwards does not. */
export function rearmsOnReturn(awayMs: number | null, thresholdMs: number = LAUNCH_WALL_AWAY_MS): boolean {
  return awayMs !== null && Number.isFinite(awayMs) && awayMs >= thresholdMs;
}

/** No plan or trial, read from the server, and something to sell. Unread is never a yes. */
export function launchWallDue(status: BillingStatus | null, storeHasPlans: boolean): boolean {
  if (status === null || !storeHasPlans) return false;
  return status.plan === 'trial' || status.lapsed;
}

/** What the screen is doing right now. */
export interface WallMoment {
  ready: boolean;
  route: { name: string } | undefined;
  celebrationsHeld: boolean;
  arrivalAllowed: boolean;
  /** Not 'background' and not 'inactive'. */
  active: boolean;
}

export function launchWallShowable(m: WallMoment): boolean {
  return m.ready && tabRootVisible(m.route) && !m.celebrationsHeld && m.arrivalAllowed && m.active;
}

export interface LaunchWallEnv {
  moment: () => WallMoment;
  /** The account scope generation; a change means another account. */
  owner: () => number;
  status: () => Promise<BillingStatus | null>;
  storeHasPlans: () => Promise<boolean>;
  open: (door: WallDoor) => void;
  frame: (run: () => void) => number;
  cancelFrame: (id: number) => void;
  now: () => number;
  /** The return threshold; LAUNCH_WALL_AWAY_MS unless a local-development build overrides it. */
  awayMs?: number;
}

export interface LaunchWall {
  /** Try to open what is pending. Called on every navigation change and every hold released. */
  flush: () => void;
  /** AppState changed. */
  appState: (state: string) => void;
  /** A kept guest practice asks for the D13 offer; it replaces the launch flag. */
  pendFirstRun: () => void;
  /** Onboarding just finished: this launch shows only the path-complete offer, if any. */
  onboarded: () => void;
  /** Retire whatever is in flight (an account change or unmount). */
  dispose: () => void;
  pending: () => WallDoor | null;
  /** The last decision's promise, for tests. */
  settled: () => Promise<boolean>;
}

export function launchWallController(env: LaunchWallEnv): LaunchWall {
  let pending: WallDoor | null = 'launch';
  let request = 0;
  let frame: number | null = null;
  let backgroundAt: number | null = null;
  let last: Promise<boolean> = Promise.resolve(false);

  const invalidate = () => {
    request++;
    if (frame !== null) env.cancelFrame(frame);
    frame = null;
  };
  const stillHere = (req: number, owner: number) => req === request && owner === env.owner() && launchWallShowable(env.moment());

  async function decide(req: number, owner: number): Promise<boolean> {
    // Taken before anything is read, so a failure or a "no" drops it.
    const door = pending;
    pending = null;
    if (door === null) return false;
    let status: BillingStatus | null;
    let plans: boolean;
    try {
      [status, plans] = await Promise.all([env.status(), env.storeHasPlans()]);
    } catch {
      return false;
    }
    if (!launchWallDue(status, plans) || !stillHere(req, owner)) return false;
    env.open(door);
    return true;
  }

  const flush = () => {
    // Leaving a tab root retires the old request even once its flag is taken:
    // a current Home is not proof that the original Home stayed visible.
    if (!launchWallShowable(env.moment())) { invalidate(); return; }
    if (pending === null) return;
    const owner = env.owner();
    const req = ++request;
    if (frame !== null) env.cancelFrame(frame);
    // Two committed frames let the tab appear before this separate decision reads.
    frame = env.frame(() => {
      frame = env.frame(() => {
        frame = null;
        if (!stillHere(req, owner)) return;
        last = decide(req, owner);
      });
    });
  };

  return {
    flush,
    appState: (state) => {
      if (state === 'active') {
        if (backgroundAt !== null && rearmsOnReturn(env.now() - backgroundAt, env.awayMs ?? LAUNCH_WALL_AWAY_MS) && pending === null) pending = 'launch';
        backgroundAt = null;
        flush();
        return;
      }
      invalidate();
      if (state === 'background') {
        if (backgroundAt === null) backgroundAt = env.now();
        if (pending === 'launch') pending = null;
      }
    },
    pendFirstRun: () => { pending = 'path-complete'; },
    onboarded: () => { if (pending === 'launch') pending = null; },
    dispose: () => { invalidate(); pending = null; },
    pending: () => pending,
    settled: () => last,
  };
}
