/**
 * The launch that waits, and the launch that must not.
 *
 * F89: a returning learner on a fresh device gets their account, not
 * onboarding. The failure this defends against is quiet and expensive — a
 * learner reinstalls, answers three questions they answered a year ago, and
 * hands the reconciler a beginner profile to merge against everything they
 * actually did.
 *
 * The other half matters just as much and is easier to get wrong: the wait is
 * bounded. A learner with no signal reaches onboarding, because a screen that
 * never resolves is a learner stranded before they have even started.
 *
 * `App.tsx` cannot be tested here — apps/mobile has no renderer and nothing in
 * this suite imports react-native. So the rule lives in a plain module over
 * injected seams and the component keeps only the wiring, the same arrangement
 * as live/thinking.ts and live/journalRules.ts.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FRESH_DEVICE_BUDGET_MS, adoptBeforeReady, adoptedAnything } from './freshDevice.ts';
import * as freshDevice from './freshDevice.ts';
import type { SyncOutcome, SyncRunSummary } from '../sync/engine.ts';

function outcome(namespace: string, adopted: boolean): SyncOutcome {
  return {
    namespace,
    status: adopted ? 'adopted' : 'unchanged',
    revision: adopted ? 4 : null,
    adopted,
    pushed: false,
    attempts: 0,
  };
}

function summary(...outcomes: SyncOutcome[]): SyncRunSummary {
  return { outcomes, settled: true };
}

/** A time box that never fires, so only the pull can win the race. */
const neverExpires = () => new Promise<void>(() => {});

/** A time box that fires immediately, so only the box can win. */
const expiresAtOnce = () => Promise.resolve();

describe('the fresh device pull — waiting for an account, but never for long', () => {
  test('only a confirmed empty account or no sync engine may adopt the device draft', () => {
    assert.equal(typeof freshDevice.mayAdoptPreAccountDraft, 'function');
    const cases = {
      'has-local': false,
      adopted: false,
      empty: true,
      'no-sync': true,
      'timed-out': false,
      unavailable: false,
    } satisfies Record<freshDevice.FreshStartKind, boolean>;
    for (const kind of Object.keys(cases) as freshDevice.FreshStartKind[]) {
      for (const waited of [true, false]) {
        assert.equal(freshDevice.mayAdoptPreAccountDraft({ kind, waited }), cases[kind], kind);
      }
    }
  });
  test("a fresh sign-in on a new device adopts the account's synced state instead of onboarding again", async () => {
    // The whole scenario in three facts: nothing on disk, an account with a
    // profile and a deck, and a pull that answers inside the budget.
    let pulls = 0;
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () => {
        pulls += 1;
        return Promise.resolve(summary(outcome('profile', true), outcome('review', true), outcome('topics', false)));
      },
      expire: neverExpires,
    });

    assert.equal(start.kind, 'adopted');
    assert.equal(start.waited, true);
    assert.equal(pulls, 1, 'the account is reconciled exactly once before the first screen reads the disk');
  });

  test('a device that already holds a profile never waits for the account', async () => {
    // Every ordinary launch, on every device anybody already owns. It must cost
    // nothing at all: no request, and no time added to first paint.
    let pulls = 0;
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(true),
      pull: () => {
        pulls += 1;
        return Promise.resolve(summary(outcome('profile', true)));
      },
      expire: expiresAtOnce,
    });

    assert.equal(start.kind, 'has-local');
    assert.equal(start.waited, false);
    assert.equal(pulls, 0, 'an ordinary launch must not pay for the fresh device case');
  });

  test('an offline start falls through to onboarding rather than hanging on the pull', async () => {
    // The time box is the whole point of the feature. A pull that never answers
    // is exactly what an aeroplane or a tunnel looks like.
    let expired: number | null = null;
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () => new Promise<SyncRunSummary>(() => {}),
      budgetMs: 250,
      expire: (ms) => {
        expired = ms;
        return Promise.resolve();
      },
    });

    assert.equal(start.kind, 'timed-out');
    assert.equal(expired, 250, 'the budget passed in is the budget waited');
  });

  test('a pull that fails leaves the learner a way forward instead of a spinner', async () => {
    const rejected = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () => Promise.reject(new Error('no network')),
      expire: neverExpires,
    });
    assert.equal(rejected.kind, 'unavailable');

    const threw = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () => {
        throw new Error('the engine was never built');
      },
      expire: neverExpires,
    });
    assert.equal(threw.kind, 'unavailable');
  });

  test('a launch with no sync engine at all opens the app instead of stalling', async () => {
    // Mock auth, and any build with no project configured. The promise that the
    // app runs with no keys is older than sync and outranks it.
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: null,
    });
    assert.equal(start.kind, 'no-sync');
    assert.equal(start.waited, false);
  });

  test('an account with nothing stored is an empty start, not an adoption', async () => {
    // A genuinely new learner. Onboarding is the right answer here and the log
    // line must not claim something was restored.
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () => Promise.resolve(summary(outcome('profile', false), outcome('review', false))),
      expire: neverExpires,
    });
    assert.equal(start.kind, 'empty');
  });

  test('a storage read that throws opens the app rather than adding a wait', async () => {
    let pulls = 0;
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.reject(new Error('storage unavailable')),
      pull: () => {
        pulls += 1;
        return Promise.resolve(summary(outcome('profile', true)));
      },
      expire: expiresAtOnce,
    });

    assert.equal(start.kind, 'has-local');
    assert.equal(pulls, 0);
  });

  test('a pull that loses the race is never an unhandled rejection', async () => {
    // The box wins, and the pull rejects afterwards. Without the settle-rather-
    // than-reject wrapper this crashes the process a second later, nowhere near
    // the code that caused it.
    let reject: ((reason: Error) => void) | null = null;
    const start = await adoptBeforeReady({
      hasLocalProfile: () => Promise.resolve(false),
      pull: () =>
        new Promise<SyncRunSummary>((_resolve, rejectLater) => {
          reject = rejectLater;
        }),
      budgetMs: 1,
      expire: expiresAtOnce,
    });
    assert.equal(start.kind, 'timed-out');

    assert.notEqual(reject, null);
    reject!(new Error('answered far too late'));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  test('the default budget is a wait a person will sit through, not a timeout', () => {
    assert.ok(FRESH_DEVICE_BUDGET_MS >= 3_000, 'too short to reach a slow connection at all');
    assert.ok(FRESH_DEVICE_BUDGET_MS <= 10_000, 'longer than this and a signal-less launch reads as broken');
  });

  test('only a store that actually took something counts as an adoption', () => {
    assert.equal(adoptedAnything(summary()), false);
    assert.equal(adoptedAnything(summary(outcome('profile', false))), false);
    assert.equal(adoptedAnything(summary(outcome('profile', false), outcome('drills', true))), true);
  });
});
