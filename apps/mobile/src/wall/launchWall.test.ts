/**
 * The wall on its own (D24, replacing D13's "never shown again on its own";
 * the D13 first-run offer after a kept guest practice stays, as one flag).
 *
 * The whole controller runs here with fakes for the server, the store, the
 * frame clock and the navigator. The locked-route guard runs the same way.
 * App wiring is read as source, because there is no renderer in this suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../test/evidence.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { lockedRouteDecision, lockedRouteFeature, lockedRouteGuard, LOCKED_ROUTES } from '../purchases/featureLocks.ts';
import {
  LAUNCH_WALL_AWAY_MS, TAB_ROOTS, exitIsEarly, guestPracticeCompletes, launchWallController, recapCompletesConversation, removalIsEarlyExit, watchRemoval, type RemovalAction, launchWallDue, launchWallShowable, rearmsOnReturn, tabRootVisible,
  type WallDoor, type WallMoment,
} from './launchWall.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
const CORE: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };
const STORE_TRIAL: BillingStatus = { plan: 'regular', secondsRemaining: 42 * 60, periodEnd: '2026-10-27T00:00:00.000Z', lapsed: false, canStart: true, reason: null };
const LAPSED: BillingStatus = { ...CORE, plan: 'trial', lapsed: true, periodEnd: null, secondsRemaining: 300 };

const BLOCKED = ['Lesson', 'Convo', 'Drill', 'Review', 'DailyPractice', 'SoundCheck', 'ConversationPractice', 'FirstScene', 'Wall'];

function rig(opts: { status?: BillingStatus | null | Error; plans?: boolean; awayMs?: number; reload?: boolean; conversationDone?: boolean; shownDay?: string | null } = {}) {
  const world = {
    ready: true, route: 'Home', held: false, arrival: true, active: true, owner: 1, now: 1_000_000,
    today: '2026-10-29',
    seen: { shownDay: opts.shownDay ?? null, conversationDone: opts.conversationDone ?? true },
    marked: [] as string[],
    status: (opts.status === undefined ? FREE : opts.status) as BillingStatus | null | Error,
    plans: opts.plans ?? true,
    opened: [] as WallDoor[], asked: 0,
  };
  const frames = new Map<number, () => void>();
  let id = 0;
  let answer: ((value: BillingStatus | null) => void) | null = null;
  let deferred = false;
  const wall = launchWallController({
    moment: (): WallMoment => ({ ready: world.ready, route: { name: world.route }, celebrationsHeld: world.held, arrivalAllowed: world.arrival, active: world.active }),
    owner: () => world.owner,
    status: () => {
      world.asked++;
      if (deferred) return new Promise((resolve) => { answer = resolve; });
      if (world.status instanceof Error) return Promise.reject(world.status);
      return Promise.resolve(world.status);
    },
    storeHasPlans: async () => world.plans,
    open: (door) => { world.opened.push(door); },
    frame: (run) => { frames.set(++id, run); return id; },
    cancelFrame: (frame) => { frames.delete(frame); },
    now: () => world.now,
    today: () => world.today,
    seen: async () => ({ ...world.seen }),
    markShown: (day: string) => { world.marked.push(day); world.seen.shownDay = day; },
    reload: opts.reload ?? false,
    ...(opts.awayMs === undefined ? {} : { awayMs: opts.awayMs }),
  });
  const frame = () => { const next = frames.entries().next().value as [number, () => void] | undefined; if (next) { frames.delete(next[0]); next[1](); } return next !== undefined; };
  /** Flush and let two frames commit, then the reads settle. */
  const show = async () => { wall.flush(); frame(); frame(); await wall.settled(); await Promise.resolve(); };
  return { world, wall, frame, show, defer: () => { deferred = true; }, answer: (value: BillingStatus | null) => answer?.(value) };
}

describe('the launch wall rules', () => {
  test('only a tab root inside Tabs is somewhere the wall may open over', () => {
    // 2026-10-20, lock seam wiring: direction B's Explore tab is a root the wall opens over.
    assert.deepEqual([...TAB_ROOTS], ['Home', 'Explore', 'Tutor', 'Practice', 'MyFrench']);
    for (const name of TAB_ROOTS) assert.equal(tabRootVisible({ name }), true);
    for (const name of [...BLOCKED, 'Tabs', 'Settings', '']) assert.equal(tabRootVisible({ name }), false, `${name || 'unnamed'} counted as a tab root`);
    assert.equal(tabRootVisible(undefined), false);
  });

  // Founder decision 4 (2026-10-28): a return after 30 minutes still re-arms, but the once-a-day rule decides.
  test('coming back after 30 minutes is an open of the app; 29 minutes, or a clock that ran backwards, is not', () => {
    assert.equal(LAUNCH_WALL_AWAY_MS, 30 * 60 * 1000);
    assert.equal(rearmsOnReturn(29 * 60 * 1000), false);
    assert.equal(rearmsOnReturn(30 * 60 * 1000), true);
    assert.equal(rearmsOnReturn(-5), false);
    assert.equal(rearmsOnReturn(null), false);
    assert.equal(rearmsOnReturn(Number.NaN), false);
  });

  test('due only for a learner with no plan or trial, read from the server, and something to sell', () => {
    assert.equal(launchWallDue(FREE, true), true);
    assert.equal(launchWallDue(LAPSED, true), true, 'a lapsed plan holds nothing');
    assert.equal(launchWallDue({ ...CORE, lapsed: true }, true), true);
    assert.equal(launchWallDue(CORE, true), false, 'a paying learner was sold to');
    assert.equal(launchWallDue(STORE_TRIAL, true), false, 'a store trial answers as its plan and is not sold to');
    assert.equal(launchWallDue(null, true), false, 'an unread status was taken as a no');
    assert.equal(launchWallDue(FREE, false), false, 'the wall opened with nothing to sell');
  });

  test('showable needs every condition at once', () => {
    const ok: WallMoment = { ready: true, route: { name: 'Home' }, celebrationsHeld: false, arrivalAllowed: true, active: true };
    assert.equal(launchWallShowable(ok), true);
    assert.equal(launchWallShowable({ ...ok, ready: false }), false);
    assert.equal(launchWallShowable({ ...ok, celebrationsHeld: true }), false);
    assert.equal(launchWallShowable({ ...ok, arrivalAllowed: false }), false);
    assert.equal(launchWallShowable({ ...ok, active: false }), false);
  });
});

describe('the launch wall controller', () => {
  test('a cold launch opens the launch door once, after two committed frames', async () => {
    const r = rig();
    assert.equal(r.wall.pending(), 'launch');
    r.wall.flush();
    assert.equal(r.world.asked, 0, 'read before the tab committed');
    r.frame();
    assert.equal(r.world.asked, 0, 'one frame was enough');
    r.frame();
    await r.wall.settled();
    assert.deepEqual(r.world.opened, ['launch']);
    await r.show();
    assert.deepEqual(r.world.opened, ['launch'], 'the wall opened twice in one stint');
  });

  test('never over a blocked route, a celebration or the hand-off; held, then shown on the next tab-root visit', async () => {
    for (const block of [...BLOCKED.map((name) => ({ route: name })), { held: true }, { arrival: false }, { ready: false }]) {
      const r = rig();
      Object.assign(r.world, block);
      await r.show();
      assert.deepEqual(r.world.opened, [], `opened over ${JSON.stringify(block)}`);
      assert.equal(r.world.asked, 0);
      assert.equal(r.wall.pending(), 'launch', `the pending wall was dropped by ${JSON.stringify(block)}`);
      Object.assign(r.world, { route: 'Practice', held: false, arrival: true, ready: true });
      await r.show();
      assert.deepEqual(r.world.opened, ['launch'], `not shown once ${JSON.stringify(block)} cleared`);
    }
  });

  test('entitled, store trial, unread, failed or no store: nothing opens, and the flag is spent', async () => {
    for (const [why, opts] of [
      ['Core', { status: CORE }], ['a store trial', { status: STORE_TRIAL }], ['an unread status', { status: null }],
      ['a failed read', { status: new Error('offline') }], ['a store without plans', { plans: false }],
    ] as const) {
      const r = rig(opts);
      await r.show();
      assert.deepEqual(r.world.opened, [], `opened with ${why}`);
      assert.equal(r.wall.pending(), null);
    }
    const lapsed = rig({ status: LAPSED });
    await lapsed.show();
    assert.deepEqual(lapsed.world.opened, ['launch'], 'a lapsed plan was not offered the trial');
  });

  test('29 minutes away does not re-arm; 30 does; a quick away drops a pending launch', async () => {
    const r = rig();
    r.world.route = 'Lesson';
    await r.show();
    r.wall.appState('background');
    assert.equal(r.wall.pending(), null, 'a pending launch survived the background');
    r.world.now += 29 * 60 * 1000;
    r.wall.appState('active');
    r.world.route = 'Home';
    await r.show();
    assert.deepEqual(r.world.opened, [], '29 minutes away counted as an open');
    r.wall.appState('background');
    r.world.now += 30 * 60 * 1000;
    r.wall.appState('active');
    assert.equal(r.wall.pending(), 'launch');
    await r.show();
    assert.deepEqual(r.world.opened, ['launch']);
    // A clock that ran backwards re-arms nothing.
    r.wall.appState('background');
    r.world.now -= 60 * 60 * 1000;
    r.wall.appState('active');
    assert.equal(r.wall.pending(), null);
  });

  test('an injected away threshold replaces the 30 minutes, at its own boundary', async () => {
    assert.equal(rearmsOnReturn(19_999, 20_000), false);
    assert.equal(rearmsOnReturn(20_000, 20_000), true);
    assert.equal(rearmsOnReturn(-1, 20_000), false);
    const r = rig({ awayMs: 20_000 });
    await r.show();
    assert.deepEqual(r.world.opened, ['launch'], 'cold launch did not open');
    r.wall.appState('background');
    r.world.now += 19_999;
    r.wall.appState('active');
    assert.equal(r.wall.pending(), null, 'just under the override re-armed');
    r.wall.appState('background');
    r.world.now += 20_000;
    // Founder decision 4: a second showing needs another day, so this return is on the next one.
    r.world.today = '2026-10-30';
    r.wall.appState('active');
    assert.equal(r.wall.pending(), 'launch');
    await r.show();
    assert.deepEqual(r.world.opened, ['launch', 'launch']);
  });

  test('backgrounded, an account switch, or leaving the tab root before the read returns: nothing opens', async () => {
    for (const change of ['background', 'account', 'route', 'roundtrip'] as const) {
      const r = rig();
      r.defer();
      r.wall.flush(); r.frame(); r.frame();
      assert.equal(r.world.asked, 1);
      assert.equal(r.wall.pending(), null, 'the flag was not taken before the read');
      if (change === 'background') { r.world.active = false; r.wall.appState('background'); }
      else if (change === 'account') r.world.owner++;
      else if (change === 'route') { r.world.route = 'Convo'; r.wall.flush(); }
      else { r.world.route = 'Convo'; r.wall.flush(); r.world.route = 'Home'; r.wall.flush(); }
      r.answer(FREE);
      assert.equal(await r.wall.settled(), false, `opened after ${change}`);
      assert.deepEqual(r.world.opened, []);
      assert.equal(r.world.asked, 1, `${change} started a second read`);
    }
  });

  test('one flag, not two: a just-onboarded launch shows only the first-run offer', async () => {
    const onboarded = rig();
    onboarded.wall.onboarded();
    await onboarded.show();
    assert.deepEqual(onboarded.world.opened, [], 'a just-onboarded launch was shown the launch wall');
    const kept = rig();
    kept.wall.onboarded();
    kept.wall.pendFirstRun();
    await kept.show();
    assert.deepEqual(kept.world.opened, ['path-complete']);
    await kept.show();
    assert.deepEqual(kept.world.opened, ['path-complete'], 'two walls in one launch');
    const handoff = rig();
    handoff.wall.pendFirstRun();
    await handoff.show();
    assert.deepEqual(handoff.world.opened, ['path-complete'], 'the kept-practice offer and the launch wall both opened');
  });

  test('a web refresh is not an app open for the launch wall', async () => {
    const r = rig({ reload: true });
    assert.equal(r.wall.pending(), null, 'a reload armed the launch wall');
    await r.show();
    assert.deepEqual(r.world.opened, [], 'a reload opened the launch wall');
    // A reload on the plans page, then leaving it for Home: still nothing.
    r.world.route = 'Wall'; r.wall.flush(); r.world.route = 'Home';
    await r.show();
    assert.deepEqual(r.world.opened, [], 'leaving a reloaded plans page opened a second wall');
    // Limit and lock doors are other entries and are unaffected; a fresh open still arms.
    const fresh = rig({ reload: false });
    await fresh.show();
    assert.deepEqual(fresh.world.opened, ['launch']);
  });

  test('the launch wall shows at most once a day and never before a completed conversation', async () => {
    const first = rig({ conversationDone: false });
    await first.show();
    assert.deepEqual(first.world.opened, [], 'the launch wall opened before any finished conversation');
    const today = rig({ shownDay: '2026-10-29' });
    await today.show();
    assert.deepEqual(today.world.opened, [], 'the launch wall opened twice in one day');
    const r = rig({ awayMs: 1000 });
    await r.show();
    assert.deepEqual(r.world.opened, ['launch']);
    assert.deepEqual(r.world.marked, ['2026-10-29'], 'the showing was not remembered for the day');
    // Back after the threshold, same day: re-armed, but not shown.
    r.wall.appState('background'); r.world.now += 5000; r.wall.appState('active');
    await r.show();
    assert.deepEqual(r.world.opened, ['launch'], 'a same-day return showed the wall again');
    // The next day it may show again.
    r.world.today = '2026-10-30';
    r.wall.appState('background'); r.world.now += 5000; r.wall.appState('active');
    await r.show();
    assert.deepEqual(r.world.opened, ['launch', 'launch']);
    // The sign-up day's first-run offer counts as that day's showing.
    const signup = rig({ conversationDone: false });
    signup.wall.pendFirstRun();
    await signup.show();
    assert.deepEqual(signup.world.opened, ['path-complete']);
    assert.deepEqual(signup.world.marked, ['2026-10-29']);
  });

  test('leaving a scene early never opens the launch wall', async () => {
    for (const door of ['launch', 'path-complete'] as const) {
      const r = rig();
      if (door === 'path-complete') r.wall.pendFirstRun();
      r.world.route = 'Convo';
      r.wall.flush();
      r.wall.leftEarly();
      r.world.route = 'Home';
      await r.show();
      assert.deepEqual(r.world.opened, [], `an early exit opened the ${door} door`);
    }
    // Left early while the frames were already counting: still nothing.
    const racing = rig();
    racing.wall.flush(); racing.frame();
    racing.wall.leftEarly();
    racing.frame(); await racing.wall.settled();
    assert.deepEqual(racing.world.opened, []);
  });

  test('an account change retires the controller', async () => {
    const r = rig();
    r.wall.dispose();
    await r.show();
    assert.deepEqual(r.world.opened, []);
  });
});

describe('the locked-route guard', () => {
  test('the route map', () => {
    assert.deepEqual({ ...LOCKED_ROUTES }, {
      TutorMemory: 'tutorMemory', SoundJourney: 'sounds', SoundCheck: 'sounds', SoundDrill: 'sounds', Lesson: 'sounds', ConversationPractice: 'conversationPractice',
      RealMoment: 'realMoment', Fixes: 'fixes', ThenNow: 'thenAndNow',
    });
    assert.equal(lockedRouteFeature('Drill', { practice: 'pack', packId: 'p1' }), 'conversationPractice');
    for (const params of [undefined, { practice: 'recommended' }, { practice: 'resume' }, { mix: true }, { node: { id: 'n' } }, { practice: 'pack' }]) {
      assert.equal(lockedRouteFeature('Drill', params), null, `a free drill was locked: ${JSON.stringify(params)}`);
    }
    assert.equal(lockedRouteFeature('Lesson'), 'sounds');
    assert.equal(lockedRouteFeature('Lesson', { textMode: true }), 'sounds', 'the typed lesson was free');
    assert.equal(lockedRouteDecision('Lesson', { textMode: true }, FREE, false), 'wall');
    assert.equal(lockedRouteDecision('Lesson', undefined, CORE, false), 'stay');
    for (const free of ['Review', 'DailyPractice', 'FirstScene', 'Home', 'Convo', 'Wall', 'toString', 'constructor']) assert.equal(lockedRouteFeature(free), null, `${free} was locked`);
  });

  test('locked goes to the wall, unlocked stays, unknown reads once, unreadable stays', async () => {
    assert.equal(lockedRouteDecision('TutorMemory', undefined, FREE, false), 'wall');
    assert.equal(lockedRouteDecision('TutorMemory', undefined, CORE, false), 'stay');
    assert.equal(lockedRouteDecision('RealMoment', undefined, CORE, false), 'wall', 'Core opened a Max door');
    assert.equal(lockedRouteDecision('RealMoment', undefined, STORE_TRIAL, false), 'stay');
    assert.equal(lockedRouteDecision('TutorMemory', undefined, null, false), 'read');
    assert.equal(lockedRouteDecision('TutorMemory', undefined, null, true), 'stay', 'an unreadable plan locked the screen');

    const run = (standing: BillingStatus | null, read: BillingStatus | null | Error, route = { key: 'k1', name: 'SoundJourney' }) => {
      const world = { walls: 0, reads: 0, route, owner: 1 };
      const guard = lockedRouteGuard({
        route: () => world.route, standing: () => standing, owner: () => world.owner,
        read: async () => { world.reads++; if (read instanceof Error) throw read; return read; },
        toWall: () => { world.walls++; },
      });
      return { world, guard };
    };
    const locked = run(FREE, FREE); await locked.guard();
    assert.deepEqual([locked.world.walls, locked.world.reads], [1, 0]);
    const open = run(CORE, CORE); await open.guard();
    assert.deepEqual([open.world.walls, open.world.reads], [0, 0]);
    const unknownLocked = run(null, FREE); await unknownLocked.guard();
    assert.deepEqual([unknownLocked.world.walls, unknownLocked.world.reads], [1, 1]);
    const unknownOpen = run(null, CORE); await unknownOpen.guard();
    assert.deepEqual([unknownOpen.world.walls, unknownOpen.world.reads], [0, 1]);
    for (const unreadable of [null, new Error('offline')]) {
      const r = run(null, unreadable); await r.guard();
      assert.deepEqual([r.world.walls, r.world.reads], [0, 1], 'an unreadable plan closed the screen');
    }
    const free = run(FREE, FREE, { key: 'h', name: 'Home' }); await free.guard();
    assert.deepEqual([free.world.walls, free.world.reads], [0, 0]);
    // An answer that lands after the learner moved on, or after an account change, does nothing.
    const moved = run(null, FREE); const pending = moved.guard(); moved.world.route = { key: 'k2', name: 'Home' }; await pending;
    assert.equal(moved.world.walls, 0);
    const switched = run(null, FREE); const p2 = switched.guard(); switched.world.owner++; await p2;
    assert.equal(switched.world.walls, 0);
  });
});

describe('every way out of a scene', () => {
  // A fake navigation that removes the route the way a swipe, a hardware back or the browser does: no leaveTo runs.
  const route = () => {
    const listeners = new Set<(event: { data: { action: RemovalAction } }) => void>();
    return {
      addListener: (_type: 'beforeRemove', listener: (event: { data: { action: RemovalAction } }) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      remove: (type: string, name?: string) => { for (const listener of [...listeners]) listener({ data: { action: { type, payload: name === undefined ? undefined : { name } } } }); },
    };
  };

  test('a system back out of a scene is an early exit, and a finished one is not', async () => {
    for (const back of ['POP', 'GO_BACK', 'NAVIGATE', 'RESET']) {
      // Swiped back while connecting: the launch wall armed by a return is disarmed.
      const r = rig();
      r.world.route = 'Convo';
      const nav = route();
      const stop = watchRemoval(nav, (action) => removalIsEarlyExit('Convo', action, { recapSettled: false, leaveRequested: false }), () => r.wall.leftEarly());
      nav.remove(back);
      nav.remove(back); // twice is harmless
      r.world.route = 'Home';
      await r.show();
      assert.deepEqual(r.world.opened, [], `a ${back} out of a conversation opened the launch wall`);
      stop();
      // Out of the end card a Leave asked for: early too.
      assert.equal(removalIsEarlyExit('Convo', { type: back }, { recapSettled: true, leaveRequested: true }), true);
      // On the first scene's primer.
      assert.equal(removalIsEarlyExit('FirstScene', { type: back }), true, `a ${back} out of the first scene was not early`);
    }
    // Finish, the end card, then Done: not early, and the wall may open.
    const done = rig();
    const nav = route();
    watchRemoval(nav, (action) => removalIsEarlyExit('Convo', action, { recapSettled: true, leaveRequested: false }), () => done.wall.leftEarly());
    nav.remove('POP');
    await done.show();
    assert.deepEqual(done.world.opened, ['launch']);
    // The first scene replacing itself with its conversation is the way in.
    assert.equal(removalIsEarlyExit('FirstScene', { type: 'REPLACE', payload: { name: 'Convo' } }), false);
  });

  // Round-2 verifier (2026-10-29): any REPLACE used to count as the way in, so
  // the locked-route guard replacing the primer with the wall left a pending
  // launch flag armed. Only a replace that goes to the conversation is.
  test('the first scene replaced by anything but its conversation is an early exit', () => {
    for (const name of ['Wall', 'Tabs', 'FirstScene', undefined]) {
      assert.equal(removalIsEarlyExit('FirstScene', { type: 'REPLACE', payload: name === undefined ? undefined : { name } }), true, `a replace to ${String(name)} was not early`);
    }
    // Through the real listener shape, as React Navigation 7 sends it.
    const r = rig();
    const nav = route();
    let signalled = 0;
    const stop = watchRemoval(nav, (action) => removalIsEarlyExit('FirstScene', action), () => { signalled++; r.wall.leftEarly(); });
    nav.remove('REPLACE', 'Convo');
    assert.equal(signalled, 0, 'Start into the conversation counted as leaving');
    nav.remove('REPLACE', 'Wall');
    assert.equal(signalled, 1, 'the wall replacing the primer did not disarm the launch flag');
    stop();
  });

  test('every way out of a scene is wired to the early-exit signal', () => {
    const convo = evidence('apps/mobile/src/ConvoScreen.tsx');
    assert.match(convo, /watchRemoval\(navigation, \(action\) => !removalHeldRef\.current && removalIsEarlyExit\('Convo', action, \{ recapSettled: recapSettledRef\.current, leaveRequested: leaveRequestedRef\.current \}\), noteLeftEarly\)/, 'a swipe or system back out of a conversation skips the early-exit signal');
    const first = evidence('apps/mobile/src/nav/RootNavigator.tsx');
    const firstRoute = first.slice(first.indexOf('function FirstSceneRoute('), first.indexOf('function LessonRoute('));
    assert.match(firstRoute, /watchRemoval\(nav as unknown as RemovalSource, \(action\) => removalIsEarlyExit\('FirstScene', action\), noteLeftEarly\)/, 'a swipe or system back out of the first scene skips the early-exit signal');
  });

  test('a kept guest practice that was completed counts as the first completed conversation', () => {
    assert.equal(guestPracticeCompletes({ live: { outcome: 'completed' } }), true);
    for (const outcome of ['active', 'left', 'abandoned', undefined]) assert.equal(guestPracticeCompletes({ live: { outcome } }), false, `${outcome} counted`);
    assert.equal(guestPracticeCompletes({ live: null }), false);
    assert.equal(guestPracticeCompletes(null), false);
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    const settled = handoff.indexOf("if ((await settleGuestHandoff(guest)).ack !== 'durable')");
    const marked = handoff.indexOf('if (guestPracticeCompletes(guest)) void markConversationDone();');
    assert.ok(settled > 0, 'the handoff save moved; this check reads nothing');
    assert.ok(marked > settled, 'a kept, completed guest practice is not remembered as a finished conversation once the account holds it');
  });
});

describe('the App wiring', () => {
  test('a recap reached by leaving early neither unlocks the launch wall nor opens it', () => {
    assert.equal(recapCompletesConversation({ leaveRequested: false, switching: false, learnerReplies: 2 }), true);
    assert.equal(recapCompletesConversation({ leaveRequested: true, switching: false, learnerReplies: 2 }), false, 'a Leave-requested recap counted as a finished conversation');
    assert.equal(recapCompletesConversation({ leaveRequested: false, switching: true, learnerReplies: 2 }), false, 'the switch-to-voice recap counted');
    assert.equal(recapCompletesConversation({ leaveRequested: false, switching: false, learnerReplies: 0 }), false);
    assert.equal(exitIsEarly({ recapSettled: false, leaveRequested: false }), true);
    assert.equal(exitIsEarly({ recapSettled: true, leaveRequested: true }), true, 'leaving the end card a Leave asked for was not an early exit');
    assert.equal(exitIsEarly({ recapSettled: true, leaveRequested: false }), false);

    const convo = evidence('apps/mobile/src/ConvoScreen.tsx');
    const settled = convo.slice(convo.indexOf("source: 'convo',"), convo.indexOf('One content-free beta event per finished conversation'));
    assert.match(settled, /if \(recapCompletesConversation\(\{ leaveRequested: leaveRequestedRef\.current, switching: switchingRef\.current, learnerReplies \}\)\) void markConversationDone\(\);/, 'the recap marks a finished conversation without asking how it was reached');
    assert.doesNotMatch(convo, /if \(learnerReplies > 0\) void markConversationDone/, 'the old unconditional mark is still there');
    assert.match(convo, /if \(exitIsEarly\(\{ recapSettled: recapSettledRef\.current, leaveRequested: leaveRequestedRef\.current \}\)\) noteLeftEarly\(\);/, 'leaving the end card a Leave asked for does not disarm the launch wall');
    // Every place a Leave asks for the recap marks it, ahead of the wait.
    const waits = convo.match(/setLeaveWaiting\(true\)/g) ?? [];
    const marked = convo.match(/leaveRequestedRef\.current = true; setLeaveWaiting\(true\)/g) ?? [];
    assert.ok(waits.length > 0);
    assert.equal(marked.length, waits.length, 'a Leave that waits for the recap is not remembered as a Leave');
  });

  test('App calls the hooks, keeps the first-run entry, and guards locked routes on every navigation change', () => {
    const app = evidence('apps/mobile/App.tsx');
    assert.match(app, /const launchWall = useLaunchWall\(navigationRef, user\.id\);/);
    assert.match(app, /useFeatureStanding\(user\.id\);/);
    assert.match(app, /const guardLockedRoute = useLockedRouteGuard\(navigationRef, user\.id\);/);
    assert.match(app, /onStateChange=\{\(\) => \{ launchWall\.flush\(\); void guardLockedRoute\(\); \}\}/);
    assert.match(app, /onReady=\{\(\) => \{ openFirstRun\(\); openPendingInvite\(\); void guardLockedRoute\(\); \}\}/);
    assert.match(app, /onDone=\{\(kept, showFirstRunOffer\) => \{ if \(kept && showFirstRunOffer\) launchWall\.pendFirstRun\(\); onPreAccountDraftConsumed\(\); \}\}/);
    assert.match(app, /useEffect\(\(\) => \{ if \(justOnboarded\) launchWall\.onboarded\(\); \}, \[justOnboarded, launchWall\]\);/);
    assert.match(app, /<LaunchWallArrival report=\{launchWall\.arrival\} \/>/);
    const firstRun = app.slice(app.indexOf('const openFirstRun = useCallback('), app.indexOf('}, [justOnboarded, navigationRef, launchWall]);'));
    assert.ok(firstRun.length > 0, 'openFirstRun moved; this check reads nothing');
    assert.ok(firstRun.indexOf('navigationRef.resetRoot(') < firstRun.indexOf('launchWall.flush();'), 'the wall flushes before the first-run reset, which would wipe it');
    assert.equal((app.match(/navigate\('Wall'/g) ?? []).length, 0, 'App opens the wall itself instead of through the controller');
    assert.doesNotMatch(app, /launchWall[^;]*(AsyncStorage|setItem|userKey)/, 'the pending wall is remembered on the disk');

    const hook = evidence('apps/mobile/src/wall/useLaunchWall.ts');
    // The same read and the same preview stand-in as WallScreen.tsx (`next.available ? next : (previewOffering() ?? next)`).
    assert.match(hook, /const offering = await purchases\.offering\(userId\);/, 'the wall reads the store some other way than the wall does');
    assert.match(hook, /paywallSurface\(offering\.available \? offering : \(previewOffering\(\) \?\? offering\)\) !== null/, 'the launch wall and the wall disagree about a store that answers nothing');
    assert.match(hook, /awayMs: launchWallAwayMs\(/, 'the return threshold is not read through the gated switch');
    assert.match(hook, /const status = await fetchBillingStatus\(userId\);/);
    assert.match(hook, /open: \(door\) => navigationRef\.navigate\('Wall', \{ entry: door \}\)/);
    assert.match(hook, /celebrationsHeld: celebrationsHeld\(\)/);
    assert.match(hook, /onCelebrationHoldChange\(\(\) => wall\.flush\(\)\)/);
    assert.doesNotMatch(hook, /AsyncStorage|setItem\(/, 'the hook writes the disk itself instead of through launchWallSeen.ts');
    // Founder decision 4: the record, the day, the reload and the early exit reach the controller through the hook.
    assert.match(hook, /seen: loadLaunchWallSeen,/);
    assert.match(hook, /markShown: \(day\) => \{ void markLaunchWallShown\(/);
    assert.match(hook, /today: \(\) => localDayKey\(Date\.now\(\)\)/);
    assert.match(hook, /reload: RELOADED,/);
    assert.match(hook, /const RELOADED = isWebReload\(/);
    assert.match(hook, /onLeftEarly\(\(\) => wall\.leftEarly\(\)\)/);
    const convo = evidence('apps/mobile/src/ConvoScreen.tsx');
    const settled = convo.slice(convo.indexOf("source: 'convo',"), convo.indexOf('One content-free beta event per finished conversation'));
    assert.match(settled, /void markConversationDone\(\);/, 'a finished conversation is not remembered for the launch wall');
    const local = convo.slice(convo.indexOf('const settleLocally = '), convo.indexOf('const leaveTimedOut = '));
    assert.ok(local.length > 0);
    assert.doesNotMatch(local, /markConversationDone/, 'an early Leave counted as a finished conversation');
    assert.match(convo, /leftRef\.current = true;\s*(?:\/\/[^\n]*\s*)?if \(exitIsEarly\(/, 'leaving before the recap does not disarm the launch wall');
    assert.match(convo, /removalHeldRef\.current = inRoom && !leaving;/, 'a removal the room guard holds counts as leaving');
    const guard = evidence('apps/mobile/src/purchases/useFeatureLocks.ts');
    assert.match(guard, /toWall: \(feature\) => navigationRef\.dispatch\(StackActions\.replace\('Wall', \{ entry: 'locked', feature \}\)\)/);
    assert.match(guard, /onBillingChange\(/);
    // The hand-off still says whether the practice was kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /onDone: \(kept: boolean, showFirstRunOffer\?: boolean\) => void;/);
    assert.match(handoff, /setGuest\(null\); onDone\(saved, !newlyCreated && !resumeAdoption\);/);
  });
});
