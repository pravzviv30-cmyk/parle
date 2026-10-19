/**
 * The first-run offer's trigger (come alive, README Part 5.C row 12; Part 6
 * "Wall entry": `path-complete` with a `pendingWall` trigger).
 *
 * Run with fakes for the server, the store and the navigator: the offer opens
 * once after onboarding reaches Home, or after an existing account keeps guest
 * practice. The server must say this account holds no paid plan, the store must
 * have plans, and the learner must still be on Home in the foreground. The App
 * wiring is read as source, because there is no renderer in this suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../test/evidence.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { firstRunHomeVisible, firstRunWallDue, flushFirstRunWall, type FirstRunWallDeps } from './firstRunWall.ts';

const FREE: BillingStatus = { plan: 'trial', secondsRemaining: 1500, periodEnd: null, lapsed: false, canStart: true, reason: null };
const PAID: BillingStatus = { plan: 'starter', secondsRemaining: 10800, periodEnd: '2026-11-05T00:00:00.000Z', lapsed: false, canStart: true, reason: null };

/** A pending flag, the answers, and a record of what opened. */
function harness(pending: boolean, status: BillingStatus | null | Error, plans: boolean | Error, here = true) {
  const state = { pending, opened: 0, asked: 0 };
  const deps: FirstRunWallDeps = {
    take: () => {
      const due = state.pending;
      state.pending = false;
      return due;
    },
    status: async () => {
      state.asked += 1;
      if (status instanceof Error) throw status;
      return status;
    },
    storeHasPlans: async () => {
      if (plans instanceof Error) throw plans;
      return plans;
    },
    stillHere: () => here,
    open: () => {
      state.opened += 1;
    },
  };
  return { state, deps };
}

describe('the first-run offer', () => {
  test('the first-run offer requires the active Home route, never the Tabs shell or another destination', () => {
    assert.equal(firstRunHomeVisible({ name: 'Home' }), true);
    for (const name of ['Tabs', 'Explore', 'Speak', 'Tutor', 'Practice', 'MyFrench', 'Progress', 'Profile', 'Settings', 'Wall', 'FirstScene', 'home', '']) {
      assert.equal(firstRunHomeVisible({ name }), false, `${name || 'an unnamed route'} was treated as visible Home`);
    }
    assert.equal(firstRunHomeVisible(undefined), false, 'an unresolved active route was treated as Home');
  });

  test('a delayed billing answer cannot open the first-run offer after the account, request, Home or foreground changes', async () => {
    for (const status of [FREE, PAID]) {
      for (const change of ['account', 'request', 'route', 'foreground'] as const) {
        let resolveStatus!: (value: BillingStatus) => void;
        const answer = new Promise<BillingStatus>(resolve => { resolveStatus = resolve; });
        const state = { pending: true, owner: 1, request: 1, route: 'Home', foreground: true, opened: 0, asked: 0 };
        const deps: FirstRunWallDeps = {
          take: () => { const due = state.pending; state.pending = false; return due; },
          status: () => { state.asked++; return answer; },
          storeHasPlans: async () => true,
          stillHere: () => state.owner === 1 && state.request === 1 && firstRunHomeVisible({ name: state.route }) && state.foreground,
          open: () => { state.opened++; },
        };
        const pending = flushFirstRunWall(deps);
        assert.equal(state.asked, 1, 'the billing read never started, so this does not exercise a delayed reply');
        assert.equal(state.pending, false, 'the pending offer must be consumed before external reads finish');
        if (change === 'account') state.owner++;
        else if (change === 'request') state.request++;
        else if (change === 'route') state.route = 'Explore';
        else state.foreground = false;
        resolveStatus(status);
        assert.equal(await pending, false, `${status.plan} billing reply opened an offer after ${change} changed`);
        assert.equal(state.opened, 0);
        // Returning Home, foreground or the old context must not revive a
        // consumed offer or initiate a second billing read.
        Object.assign(state, { owner: 1, request: 1, route: 'Home', foreground: true });
        assert.equal(await flushFirstRunWall(deps), false);
        assert.equal(state.asked, 1);
        assert.equal(state.opened, 0);
      }
    }
  });

  test('the first-run Home request cannot revive after a quick Explore and Home roundtrip', async () => {
    // Execute App's actual callback with a controllable frame clock and delayed
    // billing. The pure Home predicate alone cannot protect this interleaving:
    // by the time billing answers the route is Home again.
    const app = evidence('apps/mobile/App.tsx');
    const begin = app.indexOf('const openPendingWall = useCallback(');
    const closing = '}, [navigationRef, user.id]);';
    const end = app.indexOf(closing, begin);
    assert.ok(begin !== -1 && end > begin, 'the callback boundary moved; this test executes nothing');
    const body = app.slice(begin, end + closing.length);
    const pendingWall = { current: true };
    const wallFrame = { current: null as number | null };
    const wallRequest = { current: 0 };
    let route = 'Home'; let opened = 0; let frameId = 0;
    let resolveStatus!: (value: BillingStatus) => void;
    const response = new Promise<BillingStatus>(resolve => { resolveStatus = resolve; });
    const frames = new Map<number, () => void>();
    const requests: Promise<boolean>[] = [];
    const navigationRef = { isReady: () => true, getCurrentRoute: () => ({ name: route }), navigate: () => { opened++; } };
    const callback = new Function('useCallback', 'pendingWall', 'navigationRef', 'firstRunHomeVisible', 'AppState', 'scopeGeneration', 'wallRequest', 'wallFrame', 'cancelAnimationFrame', 'requestAnimationFrame', 'flushFirstRunWall', 'fetchBillingStatus', 'purchases', 'paywallSurface', 'user', `${body}; return openPendingWall;`)(
      (value: unknown) => value, pendingWall, navigationRef, firstRunHomeVisible, { currentState: 'active' }, () => 1, wallRequest, wallFrame,
      (id: number) => { frames.delete(id); }, (frame: () => void) => { frames.set(++frameId, frame); return frameId; },
      (deps: FirstRunWallDeps) => { const result = flushFirstRunWall(deps); requests.push(result); return result; },
      () => response, { offering: async () => ({ available: true }) }, () => ({}), { id: 'learner' },
    ) as () => void;
    const nextFrame = () => {
      const entry = frames.entries().next().value as [number, () => void] | undefined;
      assert.ok(entry, 'a committed Home frame was not scheduled');
      frames.delete(entry[0]); entry[1]();
    };
    callback();
    assert.equal(requests.length, 0, 'the offer read began before Home had committed');
    nextFrame();
    assert.equal(requests.length, 0, 'one frame was incorrectly enough for Home to appear');
    nextFrame();
    assert.equal(requests.length, 1);
    assert.equal(pendingWall.current, false);
    route = 'Explore'; callback();
    route = 'Home'; callback();
    resolveStatus(FREE);
    assert.equal(await requests[0], false, 'the stale request revived when the learner returned Home');
    assert.equal(opened, 0);
    assert.equal(wallRequest.current, 2, 'leaving Home failed to retire the in-flight request');
    assert.equal(requests.length, 1, 'returning Home started a second billing read for a consumed offer');
    assert.equal(pendingWall.current, false);
  });

  test('the first-run offer opens once, only after the server says no paid plan is held and the store has plans', async () => {
    // The rule.
    assert.equal(firstRunWallDue(FREE, true), true);
    assert.equal(firstRunWallDue({ ...PAID, lapsed: true }, true), true, 'a lapsed plan holds nothing paid');
    assert.equal(firstRunWallDue(PAID, true), false, 'a paying learner is sold to');
    assert.equal(firstRunWallDue({ ...PAID, plan: 'regular' }, true), false);
    assert.equal(firstRunWallDue(null, true), false, 'an unread status was taken as a no');
    assert.equal(firstRunWallDue(FREE, false), false, 'the offer opens with nothing to sell');

    // Pending and due: it opens, once.
    const due = harness(true, FREE, true);
    assert.equal(await flushFirstRunWall(due.deps), true);
    assert.equal(due.state.opened, 1);
    assert.equal(await flushFirstRunWall(due.deps), false, 'the offer opened a second time');
    assert.equal(due.state.opened, 1);

    // Not pending (Start fresh, or no hand-off at all): nothing is even asked.
    const none = harness(false, FREE, true);
    assert.equal(await flushFirstRunWall(none.deps), false);
    assert.deepEqual([none.state.opened, none.state.asked], [0, 0]);

    // Every reason not to: a paid plan, an unread status, no store, a failure,
    // or an account or navigator that changed meanwhile. Each drops the
    // pending offer for good rather than waiting to show it later.
    for (const [why, run] of [
      ['a paid plan', harness(true, PAID, true)],
      ['an unread status', harness(true, null, true)],
      ['no plans in the store', harness(true, FREE, false)],
      ['a status read that threw', harness(true, new Error('offline'), true)],
      ['a store read that threw', harness(true, FREE, new Error('store'))],
      ['an account that changed', harness(true, FREE, true, false)],
    ] as const) {
      assert.equal(await flushFirstRunWall(run.deps), false, `the offer opened with ${why}`);
      assert.equal(run.state.opened, 0, `the offer opened with ${why}`);
      assert.equal(run.state.pending, false, `the offer waits to open later after ${why}`);
    }

    // The wiring: onboarding reaches visible Home first; retained guest
    // practice is the other existing entry. Neither creates a durable upsell.
    const app = evidence('apps/mobile/App.tsx');
    assert.match(app, /onDone=\{\(kept, showFirstRunOffer\) => \{ if \(kept && showFirstRunOffer\) pendingWall\.current = true; onPreAccountDraftConsumed\(\); \}\}/, 'the retained-guest entry no longer requires kept practice and an explicit eligible handoff');
    assert.equal((app.match(/pendingWall\.current = true/g) ?? []).length, 2, 'only completed onboarding and a retained eligible guest handoff may request the first-run offer');
    assert.match(app, /const newlyCreated = newAccountUserId === user\.id;/, 'automatic signup adoption must be bound to the verified new account');
    assert.match(app, /newlyCreated=\{newlyCreated\}/);
    assert.match(app, /onReady=\{\(\) => \{ openFirstRun\(\); openPendingInvite\(\); \}\}/, 'the navigator no longer settles before the first-run navigation');
    const firstRun = app.slice(app.indexOf('const openFirstRun = useCallback('), app.indexOf('}, [justOnboarded, navigationRef, openPendingWall]);'));
    assert.ok(firstRun.length > 0, 'openFirstRun moved; this check reads nothing');
    assert.match(firstRun, /if \(justOnboarded\) \{ pendingWall\.current = true; navigationRef\.resetRoot\(\{ index: 0, routes: \[\{ name: 'Tabs', state: \{ index: 0, routes: \[\{ name: 'Home' \}\] \} \}\],? \}\); setJustOnboarded\(false\); \}/, 'completed onboarding must request its optional offer once and land on Home');
    assert.ok(firstRun.indexOf('navigationRef.resetRoot(') < firstRun.indexOf('openPendingWall();'), 'the offer opens before the first-run reset, which would wipe it');
    assert.match(firstRun, /if \(!navigationRef\.isReady\(\)\) return;/);
    assert.equal((app.match(/openPendingWall\(\);/g) ?? []).length, 1, 'the ready flow invokes the pending offer more than once');
    assert.match(app, /onStateChange=\{\(\) => openPendingWall\(\)\}/, 'a nested Home arrival after reset cannot flush its pending offer');
    const start = app.indexOf('const openPendingWall = useCallback(');
    const end = app.indexOf('}, [navigationRef, user.id]);', start);
    assert.ok(start !== -1 && end > start, 'the pending callback boundary moved; this check reads nothing');
    const pending = app.slice(start, end);
    assert.match(pending, /if \(!navigationRef\.isReady\(\) \|\| !firstRunHomeVisible\(navigationRef\.getCurrentRoute\(\)\)\) \{ wallRequest\.current\+\+; if \(wallFrame\.current !== null\) cancelAnimationFrame\(wallFrame\.current\); wallFrame\.current = null; return; \} if \(!pendingWall\.current \|\| AppState\.currentState === 'background' \|\| AppState\.currentState === 'inactive'\) return;/, 'leaving Home must retire the old request even after its pending flag has already been consumed');
    assert.equal((pending.match(/requestAnimationFrame\(/g) ?? []).length, 2, 'Home must commit two frames before the separate offer decision starts');
    assert.match(pending, /const request = \+\+wallRequest\.current;/, 'a new request does not supersede the old callback');
    assert.match(pending, /if \(request !== wallRequest\.current \|\| owner !== scopeGeneration\(\) \|\| !firstRunHomeVisible\(navigationRef\.getCurrentRoute\(\)\)\) return;/, 'the committed frame can outlive its request, account or Home route');
    assert.match(pending, /take: \(\) => \{ const due = pendingWall\.current; pendingWall\.current = false; return due; \}/, 'the pending offer is not consumed before external reads');
    assert.match(app, /const invalidate = \(\) => \{ wallRequest\.current\+\+; if \(wallFrame\.current !== null\) cancelAnimationFrame\(wallFrame\.current\); wallFrame\.current = null; \}/, 'invalidation must retire both pending frames and in-flight request ownership');
    assert.match(app, /AppState\.addEventListener\('change', state => \{ if \(state !== 'active'\) invalidate\(\); \}\)/, 'backgrounding cannot invalidate a pending first-run offer');
    assert.match(app, /return \(\) => \{ invalidate\(\); foreground\.remove\(\); \}; \}, \[user.id\]\)/, 'account replacement or unmount must retire the old request and foreground listener');
    assert.match(app, /status: \(\) => fetchBillingStatus\(user\.id\)/, 'the offer does not wait for the server\'s answer');
    assert.match(app, /storeHasPlans: async \(\) => paywallSurface\(await purchases\.offering\(user\.id\)\) !== null/, 'the offer reads the store some other way than the wall does');
    assert.match(pending, /stillHere: \(\) => request === wallRequest\.current && owner === scopeGeneration\(\) && navigationRef\.isReady\(\) && firstRunHomeVisible\(navigationRef\.getCurrentRoute\(\)\) && AppState\.currentState !== 'background' && AppState\.currentState !== 'inactive'/, 'the final async reply needs the current request, original account, foreground and visible Home');
    assert.match(app, /open: \(\) => navigationRef\.navigate\('Wall', \{ entry: 'path-complete' \}\)/);
    assert.equal((app.match(/navigate\('Wall'/g) ?? []).length, 1, 'App opens the wall from somewhere else');
    assert.doesNotMatch(app, /pendingWall[^;]*(AsyncStorage|setItem|userKey)/, 'the offer is remembered on the disk and could show again');
    // The hand-off says whether the practice was kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /onDone: \(kept: boolean, showFirstRunOffer\?: boolean\) => void;/);
    assert.match(handoff, /setGuest\(null\); onDone\(saved, !newlyCreated && !resumeAdoption\);/);
  });
});
