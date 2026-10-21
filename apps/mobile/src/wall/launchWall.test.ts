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
  LAUNCH_WALL_AWAY_MS, TAB_ROOTS, launchWallController, launchWallDue, launchWallShowable, rearmsOnReturn, tabRootVisible,
  type WallDoor, type WallMoment,
} from './launchWall.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null };
const CORE: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };
const STORE_TRIAL: BillingStatus = { plan: 'regular', secondsRemaining: 42 * 60, periodEnd: '2026-10-27T00:00:00.000Z', lapsed: false, canStart: true, reason: null };
const LAPSED: BillingStatus = { ...CORE, plan: 'trial', lapsed: true, periodEnd: null, secondsRemaining: 300 };

const BLOCKED = ['Lesson', 'Convo', 'Drill', 'Review', 'DailyPractice', 'SoundCheck', 'ConversationPractice', 'FirstScene', 'Wall'];

function rig(opts: { status?: BillingStatus | null | Error; plans?: boolean; awayMs?: number } = {}) {
  const world = {
    ready: true, route: 'Home', held: false, arrival: true, active: true, owner: 1, now: 1_000_000,
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
      TutorMemory: 'tutorMemory', SoundJourney: 'sounds', SoundCheck: 'sounds', Lesson: 'sounds', ConversationPractice: 'conversationPractice',
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

describe('the App wiring', () => {
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
    assert.doesNotMatch(hook, /AsyncStorage|setItem\(/);
    const guard = evidence('apps/mobile/src/purchases/useFeatureLocks.ts');
    assert.match(guard, /navigationRef\.dispatch\(StackActions\.replace\('Wall', \{ entry: 'locked' \}\)\)/);
    assert.match(guard, /onBillingChange\(/);
    // The hand-off still says whether the practice was kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /onDone: \(kept: boolean, showFirstRunOffer\?: boolean\) => void;/);
    assert.match(handoff, /setGuest\(null\); onDone\(saved, !newlyCreated && !resumeAdoption\);/);
  });
});
