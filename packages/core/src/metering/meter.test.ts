import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLANS,
  DEFAULT_COST_MODEL,
  ALLOWANCE_WINDOW_DAYS,
  LAPSE_GRACE_SEC,
  MIN_VIABLE_SESSION_SEC,
  STORE_FEE_RATES,
  STORE_TRIAL_DAYS,
  YEARLY_PLANS,
  allowanceWindowCount,
  allowanceWindowEnd,
  canStartSession,
  estimateSessionCost,
  planMargin,
  recordUsage,
  refillTaste,
  rollPeriod,
  secondsRemaining,
  TASTE_REFILL_HOURS,
  refillWhen,
  lapsedEntitlement,
  storeTrialCostUsd,
  storeTrialSeconds,
  yearlyPlanMargin,
  type Entitlement,
} from './meter.ts';

const fresh = (plan: Entitlement['plan'] = 'trial'): Entitlement => ({ plan, secondsUsed: 0 });

describe('entitlements', () => {
  test('the free plan is one ten-minute conversation every other day, shown as Free (REV-001)', () => {
    assert.equal(secondsRemaining(fresh()), 600);
    assert.equal(PLANS.trial.periodDays, 2, 'display only; the rule is TASTE_REFILL_HOURS');
    assert.equal(TASTE_REFILL_HOURS, 44);
    assert.equal(PLANS.trial.label, 'Free');
  });

  test('the first paid tier is shown as Core and the second as Max; the ids stay', () => {
    assert.equal(PLANS.starter.id, 'starter');
    assert.equal(PLANS.starter.label, 'Core');
    assert.equal(PLANS.regular.id, 'regular');
    assert.equal(PLANS.regular.label, 'Max');
  });

  test('an unclaimed trial never refills, however long it waits: the taste cannot be farmed', () => {
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod, periodEnd: new Date('2026-10-01') };
    assert.equal(refillTaste(spent, new Date('2027-01-01')), spent);
    assert.equal(rollPeriod(spent, new Date('2027-01-01')), spent);
  });

  test('a period that has not ended yet is left alone', () => {
    const e: Entitlement = { plan: 'starter', secondsUsed: 9000, periodEnd: new Date('2026-12-01') };
    assert.equal(rollPeriod(e, new Date('2026-06-01')).secondsUsed, 9000);
  });

  test('usage accumulates but can never exceed the allowance', () => {
    let e = fresh('starter');
    e = recordUsage(e, 600);
    assert.equal(e.secondsUsed, 600);
    e = recordUsage(e, 999_999);
    assert.equal(e.secondsUsed, PLANS.starter.secondsPerPeriod);
    assert.equal(secondsRemaining(e), 0);
  });

  test('negative usage is rejected rather than silently crediting minutes', () => {
    assert.throws(() => recordUsage(fresh(), -60), RangeError);
  });
});

describe('the free allowance refills 44 hours after first use (REV-001)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const first = new Date('2026-10-20T08:00:00Z');
  const claimed = (): Entitlement => ({ plan: 'trial', secondsUsed: 0, weeklyTaste: true });

  test('a claimed taste with nothing spent has no window yet', () => {
    const e = claimed();
    assert.equal(e.periodEnd, undefined);
    assert.equal(refillTaste(e, new Date('2030-01-01')), e);
  });

  test('the first debit starts the window; later debits do not move it', () => {
    const one = recordUsage(claimed(), 120, first);
    assert.equal(one.periodEnd?.getTime(), first.getTime() + TASTE_REFILL_HOURS * HOUR_MS);
    const two = recordUsage(one, 60, new Date(first.getTime() + DAY_MS));
    assert.equal(two.periodEnd?.getTime(), one.periodEnd?.getTime());
    assert.equal(two.secondsUsed, 180);
    // Zero seconds is not a debit and starts nothing.
    assert.equal(recordUsage(claimed(), 0, first).periodEnd, undefined);
    // An unclaimed trial and a paid plan never gain a window from a debit.
    assert.equal(recordUsage({ plan: 'trial', secondsUsed: 0 }, 60, first).periodEnd, undefined);
    assert.equal(recordUsage(fresh('starter'), 60, first).periodEnd, undefined);
  });

  test('it refills only once the window has passed, and the next window waits for the next debit', () => {
    const spent = recordUsage(claimed(), PLANS.trial.secondsPerPeriod, first);
    const end = spent.periodEnd!;
    assert.equal(refillTaste(spent, end.getTime() - 1), spent, 'a moment early refills nothing');
    const back = refillTaste(spent, end);
    assert.equal(back.secondsUsed, 0, 'at the refill instant the taste is whole');
    assert.equal(back.periodEnd, undefined);
    assert.equal(back.weeklyTaste, true);
    assert.equal(refillTaste(spent, new Date(end.getTime() + 60 * DAY_MS)).secondsUsed, 0, 'weeks idle refill once, not many times');
  });

  test('a clock that runs backwards refills nothing', () => {
    const spent = recordUsage(claimed(), 200, first);
    assert.equal(refillTaste(spent, new Date('2020-01-01')), spent);
    assert.equal(refillTaste(spent, Number.NaN), spent);
  });

  test('the refill lands exactly at +44 h, not at +43h59m and not at +48 h', () => {
    const spent = recordUsage(claimed(), PLANS.trial.secondsPerPeriod, first);
    assert.equal(spent.periodEnd?.getTime(), first.getTime() + 44 * HOUR_MS);
    assert.equal(refillTaste(spent, first.getTime() + 43 * HOUR_MS + 59 * 60 * 1000), spent, 'refilled a minute early');
    assert.equal(refillTaste(spent, first.getTime() + 44 * HOUR_MS).secondsUsed, 0, 'not refilled at +44 h');
  });

  test('only a claimed taste refills, and never a paid plan', () => {
    const unclaimed: Entitlement = { plan: 'trial', secondsUsed: 300, periodEnd: first };
    assert.equal(refillTaste(unclaimed, new Date(first.getTime() + DAY_MS)), unclaimed);
    for (const plan of ['starter', 'regular'] as const) {
      const paid: Entitlement = { plan, secondsUsed: 600, periodEnd: first, weeklyTaste: true };
      assert.equal(refillTaste(paid, new Date(first.getTime() + 30 * DAY_MS)), paid, `${plan} refilled through the taste`);
    }
  });

  test('a lapse is a fresh taste whose window starts at first use', () => {
    const e = lapsedEntitlement();
    assert.equal(canStartSession(e).allowed, true);
    assert.equal(recordUsage(e, 60, first).periodEnd?.getTime(), first.getTime() + TASTE_REFILL_HOURS * HOUR_MS);
  });
});

describe('a paid period that ends without renewing', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ended = new Date('2026-06-01T00:00:00.000Z');
  const expiredStarter = (): Entitlement => ({ plan: 'starter', secondsUsed: 9000, periodEnd: ended });

  test('rollPeriod never renews a paid period the billing system did not', () => {
    // The behaviour this replaces handed back a cleared counter and thirty fresh
    // days on every read of an expired paid row - free, forever, for anyone who
    // cancelled. Renewal is something a verified receipt does through save(); a
    // lazy read may take an expired plan away, and may never grant one.
    for (const plan of ['starter', 'regular'] as const) {
      for (const daysPast of [2, 30, 400]) {
        const e: Entitlement = { plan, secondsUsed: 60, periodEnd: ended };
        const after = rollPeriod(e, new Date(ended.getTime() + daysPast * DAY_MS));
        assert.notEqual(after.plan, plan, `${plan} still held its plan ${daysPast} days after the period ended`);
        // D24: the lapse lands on the free allowance, never on paid minutes.
        assert.equal(secondsRemaining(after), PLANS.trial.secondsPerPeriod, `${plan} was handed minutes nobody paid for, ${daysPast} days on`);
      }
    }
  });

  test('an expired paid period falls back to a fresh free allowance, not a fresh month (D24)', () => {
    const after = rollPeriod(expiredStarter(), new Date(ended.getTime() + 3 * DAY_MS));
    assert.deepEqual(after, lapsedEntitlement());
    assert.equal(after.plan, 'trial');
    assert.equal(after.secondsUsed, 0);
    assert.equal(secondsRemaining(after), PLANS.trial.secondsPerPeriod, 'a lapse grants the taste and nothing more');
    assert.equal(after.periodEnd, undefined, 'the taste window starts at first use, not at the lapse');
    assert.equal(after.lapsed, true, 'the lapsed state forgot that this learner previously paid');
    assert.equal(after.weeklyTaste, true);
  });

  test('a lapsed learner may spend the taste, and is told the plan ended only once it is spent', () => {
    const after = rollPeriod(expiredStarter(), new Date(ended.getTime() + 3 * DAY_MS));
    assert.equal(canStartSession(after).allowed, true);
    const at = new Date('2026-10-19T09:00:00Z'); // a Monday
    const spent = recordUsage(after, PLANS.trial.secondsPerPeriod, at);
    const decision = canStartSession(spent);
    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.reason, 'subscription-lapsed');
    assert.equal(decision.message, `Your subscription has ended. Your next free conversation is ready ${refillWhen(spent.periodEnd!)}.`);
    assert.equal(decision.refillsAt?.getTime(), spent.periodEnd?.getTime(), 'the app needs the instant to format it in the learner\'s zone');
    // A trial periodEnd is a refill time, never a paid period to lapse from.
    assert.equal(rollPeriod(spent, new Date(at.getTime() + 900 * DAY_MS)), spent);
  });

  test('a period a few hours past its end is left alone while the webhook catches up', () => {
    const e = expiredStarter();
    assert.equal(rollPeriod(e, new Date(ended.getTime() + 6 * 60 * 60 * 1000)), e);
  });

  test('the slack runs out twenty-four hours after the period ends, not a moment before', () => {
    // The same 24h the database uses. If these two ever disagree, a learner's
    // balance depends on which of them read the row, which is how a money bug hides.
    assert.equal(LAPSE_GRACE_SEC, 24 * 60 * 60);
    const e = expiredStarter();
    const deadline = new Date(ended.getTime() + LAPSE_GRACE_SEC * 1000);
    assert.equal(rollPeriod(e, deadline), e, 'exactly at the deadline the paid period still stands');
    assert.equal(rollPeriod(e, new Date(deadline.getTime() + 1000)).plan, 'trial');
  });

  test('a clock that runs backwards neither renews nor lapses', () => {
    const e: Entitlement = { plan: 'regular', secondsUsed: 12_000, periodEnd: new Date('2026-12-01') };
    assert.equal(rollPeriod(e, new Date('2020-01-01')), e);
  });

  test('a paid plan with no period on record is left as it is, not granted one', () => {
    // A missing period end is a malformed row, not evidence of expiry. Taking a
    // subscriber's plan away over a missing timestamp is the opposite mistake to
    // the one above, and just as expensive.
    const e: Entitlement = { plan: 'starter', secondsUsed: 600 };
    assert.equal(rollPeriod(e, new Date('2030-01-01')), e);
  });
});

describe('starting a session', () => {
  test('a fresh learner can start', () => {
    assert.equal(canStartSession(fresh()).allowed, true);
  });

  test('an exhausted learner is refused with a plan-appropriate message', () => {
    const trial = canStartSession({ plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod });
    assert.equal(trial.allowed, false);
    assert.equal(trial.allowed === false && trial.reason, 'exhausted');
    assert.equal(trial.allowed === false ? trial.message : '', 'Your free conversation is used.');
    assert.equal(trial.allowed === false ? trial.refillsAt : 'x', undefined);

    // With the refill time known, the learner hears the day it comes back.
    const refillsAt = new Date('2026-10-22T16:10:00Z'); // a Thursday
    const refilling: Entitlement = {
      plan: 'trial',
      secondsUsed: PLANS.trial.secondsPerPeriod,
      weeklyTaste: true,
      periodEnd: refillsAt,
    };
    const spent = canStartSession(refilling);
    assert.equal(spent.allowed === false ? spent.message : '', `Your next free conversation is ready ${refillWhen(refillsAt)}.`);
    assert.equal(spent.allowed === false ? spent.refillsAt?.getTime() : 0, refillsAt.getTime());
    assert.equal(refillWhen(refillsAt, 'UTC'), 'on Thursday at 4:10 pm');
    assert.equal(refillWhen(new Date('2026-10-22T00:05:00Z'), 'UTC'), 'on Thursday at 12:05 am');

    // 5 October 2026, F733 review: a paid allowance is now a month, a store
    // trial's week or a yearly window, so "this month" was untrue for two of
    // the three. The paid line names no period and never the free trial.
    const paid = canStartSession({ plan: 'starter', secondsUsed: PLANS.starter.secondsPerPeriod });
    assert.equal(paid.allowed === false ? paid.message : '', 'You have used all your minutes for now.');
    assert.doesNotMatch(paid.allowed === false ? paid.message : '', /trial|month/i);
  });

  test('a learner whose paid plan lapsed and taste is spent is not told their free trial ended', () => {
    const decision = canStartSession({
      plan: 'trial',
      secondsUsed: PLANS.trial.secondsPerPeriod,
      lapsed: true,
    });
    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.reason, 'subscription-lapsed');
    assert.match(decision.message, /subscription has ended/i);
    assert.doesNotMatch(decision.message, /free trial/i);
  });

  test('we refuse to start a session we cannot finish, rather than dying mid-sentence', () => {
    const nearlyOut: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 40 };
    const decision = canStartSession(nearlyOut);
    assert.equal(decision.allowed, false);
    assert.equal(decision.allowed === false && decision.reason, 'insufficient-for-session');
    assert.match(decision.allowed === false ? decision.message : '', /0 min 40s left/);
  });

  test('exactly the minimum viable session is allowed', () => {
    const e: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - MIN_VIABLE_SESSION_SEC };
    assert.equal(canStartSession(e).allowed, true);
  });
});

describe('cost model', () => {
  test('a five-minute session costs about a quarter', () => {
    // 2026-10-23 (VOICE-008, measured rates): $0.241. Ceiling tightened from
    // $0.35 to $0.30; the lower bound only catches a model that lost a line.
    const cost = estimateSessionCost({ wallClockSec: 300, utterancesScored: 15 });
    assert.ok(cost.total > 0.2 && cost.total < 0.3, `unexpected session cost $${cost.total.toFixed(3)}`);
  });

  test('the tutor voice is the dominant cost line', () => {
    // Re-baselined 2026-10-23 (VOICE-008, measured rates). This test used to say
    // the brain rivalled the voice, which held only while llmPerMin priced a
    // Claude talker ($0.025). On gpt-6-luna the brain is $0.006 a minute, and
    // TTS ($0.027 a minute at a 0.25 speaking share) is over half the bill.
    const c = estimateSessionCost({ wallClockSec: 300, utterancesScored: 15 });
    assert.ok(c.tts > c.llm && c.tts > c.stt && c.tts > c.assessment, 'TTS should be the largest single line; if not, the model is wrong');
    assert.ok(c.tts > 0.5 * c.total, 'voice should be over half of a minute; if not, re-read rates.md');
  });

  test('TTS is only charged while the tutor is actually speaking', () => {
    const cost = estimateSessionCost({ wallClockSec: 600, utterancesScored: 0 });
    const naive = 10 * DEFAULT_COST_MODEL.ttsPerMin;
    assert.ok(cost.tts < naive, 'charging TTS for the whole session would overstate cost');
    assert.equal(cost.tts, 10 * DEFAULT_COST_MODEL.tutorSpeakingShare * DEFAULT_COST_MODEL.ttsPerMin);
  });

  test('cost components sum to the total', () => {
    const c = estimateSessionCost({ wallClockSec: 420, utterancesScored: 21 });
    assert.ok(Math.abs(c.stt + c.llm + c.tts + c.assessment - c.total) < 1e-9);
  });

  test('a zero-length session costs nothing', () => {
    assert.equal(estimateSessionCost({ wallClockSec: 0, utterancesScored: 0 }).total, 0);
  });
});

describe('margins — the check that keeps us out of Issen’s trap', () => {
  test('both paid plans lose money on a learner who burns every minute, and the size is pinned (REV-001)', () => {
    // Before the store fee: Core $14.48 against $14.99 (+3.4%), Max $28.95 against $24.99 (-15.8%).
    const core = planMargin('starter', 1.0);
    const max = planMargin('regular', 1.0);
    assert.ok(core.worstCaseMargin > 0.03 && core.worstCaseMargin < 0.04, `Core at full use before the fee: $${core.worstCaseCostUsd.toFixed(2)} vs $${core.priceUsd}`);
    assert.ok(max.worstCaseMargin > -0.17 && max.worstCaseMargin < -0.15, `Max at full use before the fee: $${max.worstCaseCostUsd.toFixed(2)} vs $${max.priceUsd}`);
  });

  // The trap is subtler than "unlimited loses money". At Issen's $29 with a
  // cascaded pipeline it does not, quite — which is precisely why they built a
  // cascaded pipeline instead of using a realtime API, where the same usage would
  // cost $30–54 and sink the plan outright. The real problem is the shape of the
  // curve: under unlimited pricing your most engaged learners are your least
  // profitable, so the business quietly wants people to practise less. For an app
  // whose entire thesis is daily speaking practice, that is an inverted incentive.
  const unlimitedPriceUsd = 29;
  const monthlySecAt = (minPerDay: number) => minPerDay * 60 * 30;
  const monthlyCost = (minPerDay: number) => {
    const sec = monthlySecAt(minPerDay);
    return estimateSessionCost({ wallClockSec: sec, utterancesScored: sec / 20 }).total;
  };

  test('an unlimited plan leaves almost nothing on a committed daily learner', () => {
    const cost = monthlyCost(20);
    const margin = (unlimitedPriceUsd - cost) / unlimitedPriceUsd;
    assert.ok(margin < 0.2, `20 min/day costs $${cost.toFixed(2)} against $${unlimitedPriceUsd} — ${(margin * 100).toFixed(0)}% margin`);
  });

  test('an unlimited plan goes underwater on the learners it most wants', () => {
    const cost = monthlyCost(30);
    assert.ok(cost > unlimitedPriceUsd, `30 min/day costs $${cost.toFixed(2)} against $${unlimitedPriceUsd}`);
  });

  test('metering bounds that: the heaviest learner costs a known, finite amount', () => {
    // An unlimited plan's worst case has no ceiling. Max's is 600 minutes: $28.95.
    assert.ok(planMargin('regular', 1.0).worstCaseCostUsd < 29, 'Max at full use now costs more than $28.95');
  });

  test('the free allowance costs under $7.90 a month at full burn (REV-001)', () => {
    // 600 s at $0.04825 a minute is $0.4825 a window; a month holds 30 days / 44 h
    // = 16.36 windows, so $7.895. It refills forever, so this is a standing cost
    // per free learner, not a one-off acquisition cost.
    const window = estimateSessionCost({ wallClockSec: PLANS.trial.secondsPerPeriod, utterancesScored: PLANS.trial.secondsPerPeriod / 20 });
    const month = (window.total * 30 * 24) / TASTE_REFILL_HOURS;
    assert.ok(window.total < 0.49, `a free conversation now costs $${window.total.toFixed(4)} (was $0.4825)`);
    assert.ok(month < 7.9, `a free learner now costs $${month.toFixed(2)} a month at full burn (was $7.90)`);
  });
});

describe('margins after the store takes its cut', () => {
  // Measured from DEFAULT_COST_MODEL, not quoted from anyone: at full burn a
  // minute costs $0.04825 (2026-10-23, VOICE-008), so Core's 300 minutes
  // cost $14.48 against $14.99 and Max's 600 cost $28.95 against $24.99.
  //
  // Margin here is measured against what actually reaches us. The store's
  // percentage is a deduction from revenue, not a cost of goods, so it divides
  // as well as subtracts: at 15% Core leaves -13.6% and Max -36.3%; at 30%
  // Core leaves -37.9% and Max -65.5% (REV-001 accepts these on the gym model).
  //
  // Currency: a margin is a ratio, so it holds in any single currency provided
  // price and cost are quoted in the same one. Both are USD here. The store's
  // base currency is GBP and the real tier prices come back from App Store
  // Connect - when they do, convert them into USD before they replace priceUsd
  // rather than mixing the two, and re-run these floors, because FX moves them.
  const worstCase = (plan: 'starter' | 'regular', fee: number) => planMargin(plan, 1.0, DEFAULT_COST_MODEL, fee);

  // Bands, not floors: a vendor price move either way shows up here.
  const bands = {
    starter: { smallBusiness: [-0.15, -0.12, '-13.6%, $14.48 vs $12.74'], standard: [-0.39, -0.37, '-37.9%, $14.48 vs $10.49'] },
    regular: { smallBusiness: [-0.37, -0.35, '-36.3%, $28.95 vs $21.24'], standard: [-0.66, -0.645, '-65.5%, $28.95 vs $17.49'] },
  } as const;

  for (const plan of ['starter', 'regular'] as const) {
    for (const rate of ['smallBusiness', 'standard'] as const) {
      test(`${plan} worst-case margin at the ${rate} rate stays in its pinned band`, () => {
        const [lo, hi, was] = bands[plan][rate];
        const m = worstCase(plan, STORE_FEE_RATES[rate]);
        assert.ok(
          m.worstCaseMargin > lo && m.worstCaseMargin < hi,
          `${plan} at full use, ${rate}: ${(m.worstCaseMargin * 100).toFixed(1)}% ` +
            `($${m.worstCaseCostUsd.toFixed(2)} of cost against $${m.netRevenueUsd.toFixed(2)} received); pinned ${was}.`,
        );
      });
    }
  }

  test('at 40% utilisation and the Small Business rate Core clears 50% and Max 40%', () => {
    // Core $5.79 against $12.74 (54.6%); Max $11.58 against $21.24 (45.5%).
    const core = planMargin('starter', 0.4, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    const max = planMargin('regular', 0.4, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    assert.ok(core.expectedMargin > 0.5, `Core leaves ${(core.expectedMargin * 100).toFixed(1)}% ($${core.expectedCostUsd.toFixed(2)} vs $${core.netRevenueUsd.toFixed(2)}; was 54.6%)`);
    assert.ok(max.expectedMargin > 0.4, `Max leaves ${(max.expectedMargin * 100).toFixed(1)}% ($${max.expectedCostUsd.toFixed(2)} vs $${max.netRevenueUsd.toFixed(2)}; was 45.5%)`);
  });

  test('the modelled store rates are the ones the platforms actually charge', () => {
    // Lowering these would make every floor above pass for free.
    assert.equal(STORE_FEE_RATES.smallBusiness, 0.15);
    assert.equal(STORE_FEE_RATES.standard, 0.3);
  });

  test('the cut comes off revenue and is never added to cost', () => {
    const gross = planMargin('starter', 1.0);
    const net = worstCase('starter', STORE_FEE_RATES.smallBusiness);
    assert.equal(net.worstCaseCostUsd, gross.worstCaseCostUsd, 'vendor cost does not change because a store took a cut');
    assert.equal(net.storeFeeUsd, PLANS.starter.priceUsd * STORE_FEE_RATES.smallBusiness);
    assert.equal(net.netRevenueUsd, PLANS.starter.priceUsd - net.storeFeeUsd);
    assert.ok(Math.abs(net.worstCaseMargin - (net.netRevenueUsd - net.worstCaseCostUsd) / net.netRevenueUsd) < 1e-12);
    assert.ok(net.worstCaseMargin < gross.worstCaseMargin);
  });

  test('with no store in the path the margin is exactly the pre-store number', () => {
    const implicit = planMargin('regular', 1.0);
    assert.deepEqual(planMargin('regular', 1.0, DEFAULT_COST_MODEL, 0), implicit);
    assert.equal(implicit.storeFeeRate, 0);
    assert.equal(implicit.storeFeeUsd, 0);
    assert.equal(implicit.netRevenueUsd, PLANS.regular.priceUsd);
    // The pre-store band elsewhere in this file still means what it meant.
    assert.ok(implicit.worstCaseMargin < 0);
  });

  test('the free trial has no price for a store to take a cut of', () => {
    const m = planMargin('trial', 1.0, DEFAULT_COST_MODEL, STORE_FEE_RATES.standard);
    assert.equal(m.netRevenueUsd, 0);
    assert.equal(m.storeFeeUsd, 0);
    assert.equal(m.worstCaseMargin, 0, 'a zero price must report zero margin, not NaN or -Infinity');
    assert.equal(m.expectedMargin, 0);
  });

  test('a price change is a three-part change: this constant, these floors, and the store tier', () => {
    const note =
      'changing a price means changing three things together: PLANS.priceUsd, the margin floors in ' +
      'this file, and the tier in App Store Connect. Change one and the other two quietly lie.';
    assert.equal(PLANS.starter.priceUsd, 14.99, note);
    assert.equal(PLANS.regular.priceUsd, 24.99, note);
    assert.equal(PLANS.trial.priceUsd, 0, note);
  });

  test('an allowance change is a nine-file change, and this is the only line that says so', () => {
    // The price above is pinned in one place. The allowance is not: every
    // migration and rollback that defines the debit carries its own copy of
    // this table in SQL, and databaseContract.test.ts holds all of them equal
    // to PLANS. Repricing Max from 450 to 300 minutes moved seven SQL files
    // and needed an eighth to replace the function on a database that had
    // already run the old one. Nothing pinned the seconds before that change,
    // so the size of the job was discovered rather than known.
    const note =
      'changing an allowance means changing this constant, every allowance table in ' +
      'supabase/migrations and supabase/rollback, and a new forward migration replacing ' +
      'consume_entitlement. databaseContract.test.ts fails on any copy left behind.';
    assert.equal(PLANS.trial.secondsPerPeriod, 600, note);
    assert.equal(PLANS.starter.secondsPerPeriod, 300 * 60, note);
    assert.equal(PLANS.regular.secondsPerPeriod, 600 * 60, note);
  });
});

describe('a store free trial is a week of the plan, not a month of it (D16)', () => {
  test('a store trial is a week of the monthly allowance: Core 70 minutes, Max 140', () => {
    assert.equal(STORE_TRIAL_DAYS, 7);
    assert.equal(ALLOWANCE_WINDOW_DAYS, 30);
    assert.equal(storeTrialSeconds('starter'), 70 * 60);
    assert.equal(storeTrialSeconds('regular'), 140 * 60);
    for (const plan of ['starter', 'regular'] as const) {
      assert.ok(storeTrialSeconds(plan) < PLANS[plan].secondsPerPeriod, `${plan}'s trial grants the whole month`);
      assert.ok(storeTrialSeconds(plan) >= MIN_VIABLE_SESSION_SEC, `${plan}'s trial is too small to hold one session`);
      assert.equal(storeTrialSeconds(plan) % 60, 0, 'a trial in part-minutes would be said as a number the app has to round');
    }
  });

  test('a store trial used to the last second costs a few dollars, and the ceiling is pinned', () => {
    // Measured from DEFAULT_COST_MODEL at $0.04825 a minute (2026-10-23,
    // VOICE-008): $3.38 for Core's 70 minutes and $6.76 for Max's 140
    // (REV-001). That is acquisition cost for a learner who never pays, on top
    // of the free allowance they already had.
    const starter = storeTrialCostUsd('starter');
    const max = storeTrialCostUsd('regular');
    assert.ok(starter < 3.4, `a Core trial now costs $${starter.toFixed(2)} to give away (was $3.38)`);
    assert.ok(max < 6.8, `a Max trial now costs $${max.toFixed(2)} to give away (was $6.76)`);
    assert.ok(max > starter);
  });
});

describe('a yearly plan refills by the window, inside the paid year (D16)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = new Date('2026-10-05T09:00:00.000Z');
  const yearEnd = new Date(start.getTime() + 365 * DAY);

  test('a paid year holds exactly twelve allowance windows, the last absorbing the remainder', () => {
    assert.equal(allowanceWindowCount(start, yearEnd), 12, 'a 365-day year is twelve allowances, not twelve and a five-day thirteenth');
    assert.equal(allowanceWindowCount(start, new Date(start.getTime() + 366 * DAY)), 12, 'a leap year is still twelve');
    const ends = new Set<number>();
    for (let day = 0; day < 365; day += 1) ends.add(allowanceWindowEnd(start, yearEnd, new Date(start.getTime() + day * DAY + 1))!.getTime());
    assert.equal(ends.size, 12, 'every day of the year falls in one of twelve windows');
    const last = allowanceWindowEnd(start, yearEnd, new Date(start.getTime() + 340 * DAY));
    assert.equal(last?.toISOString(), yearEnd.toISOString(), 'the last window runs to the end of the paid year');
    assert.equal(
      allowanceWindowEnd(start, yearEnd, new Date(start.getTime() + 329 * DAY))?.toISOString(),
      new Date(start.getTime() + 330 * DAY).toISOString(),
      'the eleventh window is thirty days like the ten before it',
    );
  });

  test('every window is thirty days from the start of the paid year, and a refill begins the moment one ends', () => {
    const first = allowanceWindowEnd(start, yearEnd, start);
    assert.equal(first?.toISOString(), new Date(start.getTime() + 30 * DAY).toISOString());
    assert.equal(allowanceWindowEnd(start, yearEnd, new Date(start.getTime() + 30 * DAY - 1))?.getTime(), first?.getTime());
    assert.equal(
      allowanceWindowEnd(start, yearEnd, new Date(start.getTime() + 30 * DAY))?.toISOString(),
      new Date(start.getTime() + 60 * DAY).toISOString(),
      'the second window opens exactly where the first closes',
    );
  });

  test('a month, a trial or a sandbox year is a single window ending with its period', () => {
    for (const lengthMs of [28 * DAY, 31 * DAY, 7 * DAY, 60 * 60 * 1000, 59 * DAY]) {
      const end = new Date(start.getTime() + lengthMs);
      assert.equal(allowanceWindowCount(start, end), 1);
      assert.equal(allowanceWindowEnd(start, end, new Date(start.getTime() + lengthMs / 2))?.getTime(), end.getTime());
    }
  });

  test('there is no window at or after the end of the paid period, or in a malformed one', () => {
    assert.equal(allowanceWindowEnd(start, yearEnd, yearEnd), null, 'the store lapses a period at its end; a window there would outlive it');
    assert.equal(allowanceWindowEnd(start, yearEnd, new Date(yearEnd.getTime() + DAY)), null);
    assert.equal(allowanceWindowEnd(yearEnd, start, start), null, 'an end before its start is not a period');
    assert.equal(allowanceWindowEnd(start, start, start), null);
    assert.equal(allowanceWindowEnd(new Date('nonsense'), yearEnd, start), null);
    assert.equal(allowanceWindowCount(start, new Date('nonsense')), 0);
  });

  test('a clock behind the store reads as the first window, never as no window or a later one', () => {
    const behind = new Date(start.getTime() - 90 * 1000);
    assert.equal(allowanceWindowEnd(start, yearEnd, behind)?.toISOString(), new Date(start.getTime() + 30 * DAY).toISOString());
  });

  test('a yearly price change is the same three-part change as a monthly one', () => {
    const note =
      'changing a yearly price means changing YEARLY_PLANS.priceUsd, the yearly margin floors in this file, ' +
      'and the yearly product in App Store Connect together. The learner only ever sees the store string.';
    assert.equal(YEARLY_PLANS.starter.priceUsd, 99, note);
    assert.equal(YEARLY_PLANS.regular.priceUsd, 169, note);
    assert.equal(YEARLY_PLANS.starter.plan, 'starter');
    assert.equal(YEARLY_PLANS.regular.plan, 'regular');
  });

  test('a paid year is twelve monthly allowances, and its full-use loss is pinned (REV-001)', () => {
    // Twelve full windows: Core $173.70 against $84.15 received (-106%), Max
    // $347.40 against $143.65 (-142%), at the Small Business rate. REV-001
    // prices the year for expected use; these bands make a vendor move visible.
    const core = yearlyPlanMargin('starter', 1.0, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    const max = yearlyPlanMargin('regular', 1.0, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    assert.ok(
      Math.abs(max.worstCaseCostUsd - 12 * planMargin('regular', 1.0).worstCaseCostUsd) < 1e-9,
      'a paid year is twelve monthly allowances',
    );
    assert.ok(core.worstCaseMargin > -1.1 && core.worstCaseMargin < -1.03, `yearly Core at full use: ${(core.worstCaseMargin * 100).toFixed(1)}% (was -106.4%, $173.70 vs $84.15)`);
    assert.ok(max.worstCaseMargin > -1.45 && max.worstCaseMargin < -1.39, `yearly Max at full use: ${(max.worstCaseMargin * 100).toFixed(1)}% (was -141.8%, $347.40 vs $143.65)`);
  });

  test('at 40% utilisation and the Small Business rate yearly Core clears 15% and yearly Max breaks even', () => {
    // Core $69.48 against $84.15 (17.4%); Max $138.96 against $143.65 (3.3%).
    // At the standard 30% rate both go under (-0.3%, -17.5%): enrolment is load-bearing.
    const core = yearlyPlanMargin('starter', 0.4, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    const max = yearlyPlanMargin('regular', 0.4, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    assert.ok(core.expectedMargin > 0.15, `yearly Core leaves ${(core.expectedMargin * 100).toFixed(1)}% ($${core.expectedCostUsd.toFixed(2)} vs $${core.netRevenueUsd.toFixed(2)}; was 17.4%)`);
    assert.ok(max.expectedMargin > 0, `yearly Max leaves ${(max.expectedMargin * 100).toFixed(1)}% ($${max.expectedCostUsd.toFixed(2)} vs $${max.netRevenueUsd.toFixed(2)}; was 3.3%)`);
  });
});

describe('a yearly window that ends is a refill owed, never a lapse (F733 review)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const bought = new Date('2026-10-05T09:00:00.000Z');
  const yearEnd = new Date(bought.getTime() + 365 * DAY);

  test('a read keeps a yearly plan whose window ended a day ago, and lapses it only after the paid year', () => {
    // Window one spent to the last second, ended twenty-five hours ago, and no
    // renewal sweep has run. The learner still holds the year they paid for.
    const windowEnd = new Date(bought.getTime() + 30 * DAY);
    const spent: Entitlement = { plan: 'regular', secondsUsed: PLANS.regular.secondsPerPeriod, periodEnd: yearEnd, windowEnd };
    const later = new Date(windowEnd.getTime() + 25 * 60 * 60 * 1000);
    assert.equal(rollPeriod(spent, later), spent, 'a read lapsed a learner inside their paid year');
    const refused = canStartSession(spent);
    assert.equal(refused.allowed === false && refused.reason, 'exhausted', 'an unrefilled window reads as a paid plan out of minutes');
    // Said the same way for a month, a store trial's week and a yearly window,
    // because "this month" was untrue for two of the three.
    assert.equal(refused.allowed === false && refused.message, 'You have used all your minutes for now.');

    // The paid year itself still lapses exactly as a month does.
    assert.equal(rollPeriod(spent, new Date(yearEnd.getTime() + LAPSE_GRACE_SEC * 1000)), spent);
    assert.equal(rollPeriod(spent, new Date(yearEnd.getTime() + LAPSE_GRACE_SEC * 1000 + 1)).lapsed, true);
  });
});
