/**
 * When the wall opens on its own.
 *
 * D24 (2026-10-20) showed the free-trial offer on each open of the app.
 * Founder decision 4 (2026-10-28) supersedes D24's cadence: the launch door
 * opens at most once a local day, never before the learner's first completed
 * conversation, never on a web refresh, and never on the return from a
 * conversation or first scene left before its recap. The D13 offer after a
 * kept guest practice stays, at its `path-complete` door, and it is the same
 * pending flag: a launch that just onboarded shows that one offer, never two,
 * and it counts as that day's showing. The limit and lock doors are other
 * entries and are not decided here.
 *
 * Pending on a cold launch that is not a web reload, and again on a return to
 * the foreground after at least LAUNCH_WALL_AWAY_MS in the background. It
 * opens only when all of these are true at once, and is held, not dropped,
 * while any is not:
 *
 * - the navigator is ready and the visible route is a tab root, so never on top
 *   of a lesson, a conversation, a drill, a review, a daily phrase, a sound
 *   check, a conversation's practice, the first scene, or the wall itself;
 * - no celebration holds the queue, and Home's arrival is allowed (the
 *   navigator is not hidden under the account hand-off);
 * - the app is in the foreground.
 *
 * Then it is taken (once) and the reads decide: the server says no plan or
 * trial (`plan === 'trial' || lapsed`; a store trial answers as the plan), the
 * store has plans to sell, and, for the launch door, this phone's record says a
 * conversation was finished and the wall has not opened today. An unread
 * answer, a failure, an account change or leaving the tab root before the
 * answer lands shows nothing. A launch flag still pending when the app goes to
 * the background, or when the learner leaves a scene early, is dropped.
 *
 * The rules are pure apart from what `env` hands in, so `launchWall.test.ts`
 * runs the whole controller. The record on the disk is `launchWallSeen.ts`,
 * read and written only through `env.seen` and `env.markShown`;
 * `useLaunchWall.ts` wires both.
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

/** A web page load that the browser reports as a reload. False on native and anywhere the API is missing. */
export function isWebReload(perf: { getEntriesByType?: (type: string) => ReadonlyArray<{ type?: string }> } | undefined): boolean {
  try {
    return perf?.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
  } catch {
    return false;
  }
}

/** What this phone remembers for the launch door (`launchWallSeen.ts`). */
export interface LaunchSeen {
  shownDay: string | null;
  conversationDone: boolean;
}

/** The launch door also needs a finished conversation and no showing today; the first-run offer needs neither. */
export function launchDoorAllowed(door: WallDoor, seen: LaunchSeen, today: string): boolean {
  if (door === 'path-complete') return true;
  return seen.conversationDone && seen.shownDay !== today;
}

/** How a conversation's recap was reached, for the launch wall's two facts. */
export interface RecapReached {
  /** Leave asked for this recap (F905), so the scene was not finished. */
  leaveRequested: boolean;
  /** The typed part of a scene switched to voice (F903): the scene goes on. */
  switching: boolean;
  learnerReplies: number;
}

/** Only Finish or the scene's own end, with a learner reply, is a completed conversation. */
export function recapCompletesConversation(r: RecapReached): boolean {
  return !r.leaveRequested && !r.switching && r.learnerReplies > 0;
}

/** Leaving before a recap settled, or out of the end card a Leave asked for, is an early exit. */
export function exitIsEarly(r: { recapSettled: boolean; leaveRequested: boolean }): boolean {
  return !r.recapSettled || r.leaveRequested;
}

/**
 * Whether the route being removed is an early exit, whatever removed it: a
 * Leave, a swipe back, Android's back or the browser's. The first scene
 * replacing itself with its conversation is the way in, not out. A
 * conversation is judged by `exitIsEarly`.
 */
export function removalIsEarlyExit(
  screen: 'Convo' | 'FirstScene',
  actionType: string,
  convo: { recapSettled: boolean; leaveRequested: boolean } = { recapSettled: false, leaveRequested: false },
): boolean {
  if (screen === 'FirstScene') return actionType !== 'REPLACE';
  return exitIsEarly(convo);
}

/** The navigation shape `watchRemoval` needs: React Navigation's `addListener('beforeRemove')`. */
export interface RemovalSource {
  addListener: (type: 'beforeRemove', listener: (event: { data: { action: { type: string } } }) => void) => () => void;
}

/** Signal an early exit when the route is removed and `isEarly` says so. Returns the unsubscribe. A second signal is harmless. */
export function watchRemoval(nav: RemovalSource, isEarly: (actionType: string) => boolean, signal: () => void): () => void {
  return nav.addListener('beforeRemove', (event) => { if (isEarly(event.data.action.type)) signal(); });
}

/** A kept guest practice that ran to its end is the learner's first completed conversation. One left early is not. */
export function guestPracticeCompletes(guest: { live?: { outcome?: string } | null } | null | undefined): boolean {
  return guest?.live?.outcome === 'completed';
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
  /** The local day, as `localDayKey` writes it. */
  today: () => string;
  /** This phone's record for the account. */
  seen: () => Promise<LaunchSeen>;
  /** Remember that the wall opened on `day`. */
  markShown: (day: string) => void;
  /** This JS load is a web reload, which is not an open of the app. */
  reload?: boolean;
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
  /** The learner left a conversation or the first scene before its recap: this return opens nothing. */
  leftEarly: () => void;
  /** Retire whatever is in flight (an account change or unmount). */
  dispose: () => void;
  pending: () => WallDoor | null;
  /** The last decision's promise, for tests. */
  settled: () => Promise<boolean>;
}

export function launchWallController(env: LaunchWallEnv): LaunchWall {
  let pending: WallDoor | null = env.reload === true ? null : 'launch';
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
    let seen: LaunchSeen;
    try {
      [status, plans, seen] = await Promise.all([env.status(), env.storeHasPlans(), env.seen()]);
    } catch {
      return false;
    }
    const today = env.today();
    if (!launchWallDue(status, plans) || !launchDoorAllowed(door, seen, today) || !stillHere(req, owner)) return false;
    env.markShown(today);
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
    leftEarly: () => { invalidate(); pending = null; },
    dispose: () => { invalidate(); pending = null; },
    pending: () => pending,
    settled: () => last,
  };
}
