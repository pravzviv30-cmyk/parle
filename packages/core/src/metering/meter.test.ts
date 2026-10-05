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
  rollPeriod,
  secondsRemaining,
  storeTrialCostUsd,
  storeTrialSeconds,
  yearlyPlanMargin,
  type Entitlement,
} from './meter.ts';

const fresh = (plan: Entitlement['plan'] = 'trial'): Entitlement => ({ plan, secondsUsed: 0 });

describe('entitlements', () => {
  test('a fresh trial grants thirty minutes', () => {
    assert.equal(secondsRemaining(fresh()), 30 * 60);
  });

  test('the free tier is finite and does not renew — it cannot be farmed', () => {
    assert.equal(PLANS.trial.periodDays, null);
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
    assert.deepEqual(rollPeriod(spent, new Date('2027-01-01')), spent);
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
        assert.equal(secondsRemaining(after), 0, `${plan} was handed minutes nobody paid for, ${daysPast} days on`);
      }
    }
  });

  test('an expired paid period collapses to an exhausted trial, not a fresh month', () => {
    const after = rollPeriod(expiredStarter(), new Date(ended.getTime() + 3 * DAY_MS));
    assert.equal(after.plan, 'trial');
    assert.equal(after.secondsUsed, PLANS.trial.secondsPerPeriod);
    assert.equal(after.periodEnd, undefined, 'a lapsed entitlement carries no period end');
    assert.equal(after.lapsed, true, 'the lapsed state forgot that this learner previously paid');
  });

  test('the lapsed trial is exhausted, so cancelling is not a route back to free minutes', () => {
    const after = rollPeriod(expiredStarter(), new Date(ended.getTime() + 3 * DAY_MS));
    const decision = canStartSession(after);
    assert.equal(decision.allowed, false);
    assert.equal(decision.allowed === false && decision.reason, 'subscription-lapsed');
    // And the one-time trial does not come back through the lapse door later.
    assert.deepEqual(rollPeriod(after, new Date(ended.getTime() + 900 * DAY_MS)), after);
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
    assert.match(trial.allowed === false ? trial.message : '', /trial is finished/i);

    const paid = canStartSession({ plan: 'starter', secondsUsed: PLANS.starter.secondsPerPeriod });
    assert.match(paid.allowed === false ? paid.message : '', /this month/i);
  });

  test('a learner whose paid plan lapsed is not told their free trial ended', () => {
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
  test('a five-minute session costs roughly thirty cents', () => {
    const cost = estimateSessionCost({ wallClockSec: 300, utterancesScored: 15 });
    assert.ok(cost.total > 0.2 && cost.total < 0.35, `unexpected session cost $${cost.total.toFixed(3)}`);
  });

  test('voice and brain together are the cost; everything else is noise', () => {
    // With the Claude talker the brain line caught up with the voice line —
    // the two now co-dominate, and either is the first place to look if
    // margins bite. STT and assessment stay rounding errors beside them.
    const c = estimateSessionCost({ wallClockSec: 300, utterancesScored: 15 });
    assert.ok(c.tts + c.llm > 3 * (c.stt + c.assessment), 'voice + brain should dwarf the rest; if not, the model is wrong');
    assert.ok(c.llm < 2 * c.tts && c.tts < 2 * c.llm, 'voice and brain should be the same order of magnitude');
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
  test('the starter plan survives a learner who burns every single minute', () => {
    const m = planMargin('starter', 1.0);
    assert.ok(m.worstCaseMargin > 0, `starter loses money on heavy users: $${m.worstCaseCostUsd.toFixed(2)} cost vs $${m.priceUsd}`);
  });

  test('the regular plan also survives full utilisation', () => {
    assert.ok(planMargin('regular', 1.0).worstCaseMargin > 0);
  });

  test('at realistic utilisation the starter plan clears a healthy margin', () => {
    const m = planMargin('starter', 0.5);
    assert.ok(m.expectedMargin > 0.6, `expected >60% margin at half utilisation, got ${(m.expectedMargin * 100).toFixed(0)}%`);
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

  test('metering inverts that — margin holds no matter how committed the learner is', () => {
    assert.ok(planMargin('starter', 1.0).worstCaseMargin > 0.4);
    // The Claude-brain repricing squeezed the big plan hardest: a maxed-out
    // regular learner now leaves ~33%, not 40%. Still profitable on every
    // learner — the invariant that matters — but if this drops below 30%,
    // the $39 price point wants revisiting before the vendor bills do it.
    assert.ok(planMargin('regular', 1.0).worstCaseMargin > 0.3);
  });

  test('the free trial is cheap enough to give away', () => {
    const cost = estimateSessionCost({ wallClockSec: PLANS.trial.secondsPerPeriod, utterancesScored: PLANS.trial.secondsPerPeriod / 20 });
    // ~$1.75 of vendor spend per trial signup with the Claude brain. That is
    // acquisition cost, not a leak — but it is no longer pocket change, so
    // the ceiling is pinned here.
    assert.ok(cost.total < 2, `a free trial costing $${cost.total.toFixed(2)} is too expensive to hand out`);
  });
});

describe('margins after the store takes its cut', () => {
  // Measured from DEFAULT_COST_MODEL, not quoted from anyone: at full burn a
  // minute costs $0.0578, so starter's 180 minutes cost $10.40 against $19 and
  // regular's 450 cost $26.01 against $39.
  //
  // Margin here is measured against what actually reaches us. The store's
  // percentage is a deduction from revenue, not a cost of goods, so it divides
  // as well as subtracts: at 15% starter leaves 35.6% and regular 21.5%; at 30%
  // starter leaves 21.8% and regular 4.7%.
  //
  // Currency: a margin is a ratio, so it holds in any single currency provided
  // price and cost are quoted in the same one. Both are USD here. The store's
  // base currency is GBP and the real tier prices come back from App Store
  // Connect - when they do, convert them into USD before they replace priceUsd
  // rather than mixing the two, and re-run these floors, because FX moves them.
  const worstCase = (plan: 'starter' | 'regular', fee: number) => planMargin(plan, 1.0, DEFAULT_COST_MODEL, fee);

  test('both paid plans clear twenty percent worst-case margin after the small business store fee', () => {
    for (const plan of ['starter', 'regular'] as const) {
      const small = worstCase(plan, STORE_FEE_RATES.smallBusiness);
      const standard = worstCase(plan, STORE_FEE_RATES.standard);
      assert.ok(
        small.worstCaseMargin > 0.2,
        `${plan} leaves ${(small.worstCaseMargin * 100).toFixed(1)}% at the ` +
          `${(STORE_FEE_RATES.smallBusiness * 100).toFixed(0)}% Small Business rate ` +
          `($${small.worstCaseCostUsd.toFixed(2)} of vendor cost against $${small.netRevenueUsd.toFixed(2)} received). ` +
          `At the standard ${(STORE_FEE_RATES.standard * 100).toFixed(0)}% rate the same plan leaves ` +
          `${(standard.worstCaseMargin * 100).toFixed(1)}%. Revisit the price point before a vendor does it for us.`,
      );
    }
  });

  test('the standard store rate is why Small Business enrolment is a requirement, not a nicety', () => {
    const regular = worstCase('regular', STORE_FEE_RATES.standard);
    assert.ok(
      regular.worstCaseMargin > 0,
      `regular is underwater at the standard rate: $${regular.worstCaseCostUsd.toFixed(2)} of cost ` +
        `against $${regular.netRevenueUsd.toFixed(2)} received.`,
    );
    assert.ok(
      regular.worstCaseMargin < 0.2,
      `regular now clears the twenty percent floor even at the standard rate ` +
        `(${(regular.worstCaseMargin * 100).toFixed(1)}%). Small Business enrolment has stopped being ` +
        `load-bearing - say that on the founder checklist rather than leaving this test to say it.`,
    );
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
    // The pre-store floors elsewhere in this file still mean what they meant.
    assert.ok(implicit.worstCaseMargin > 0.3);
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
    assert.equal(PLANS.starter.priceUsd, 19, note);
    assert.equal(PLANS.regular.priceUsd, 29, note);
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
    assert.equal(PLANS.trial.secondsPerPeriod, 30 * 60, note);
    assert.equal(PLANS.starter.secondsPerPeriod, 180 * 60, note);
    assert.equal(PLANS.regular.secondsPerPeriod, 300 * 60, note);
  });
});

describe('a store free trial is a week of the plan, not a month of it (D16)', () => {
  test('a store trial is a week of the monthly allowance: Starter 42 minutes, Max 70', () => {
    assert.equal(STORE_TRIAL_DAYS, 7);
    assert.equal(ALLOWANCE_WINDOW_DAYS, 30);
    assert.equal(storeTrialSeconds('starter'), 42 * 60);
    assert.equal(storeTrialSeconds('regular'), 70 * 60);
    for (const plan of ['starter', 'regular'] as const) {
      assert.ok(storeTrialSeconds(plan) < PLANS[plan].secondsPerPeriod, `${plan}'s trial grants the whole month`);
      assert.ok(storeTrialSeconds(plan) >= MIN_VIABLE_SESSION_SEC, `${plan}'s trial is too small to hold one session`);
      assert.equal(storeTrialSeconds(plan) % 60, 0, 'a trial in part-minutes would be said as a number the app has to round');
    }
  });

  test('a store trial used to the last second costs a few dollars, and the ceiling is pinned', () => {
    // Measured from DEFAULT_COST_MODEL at $0.0578 a minute: about $2.43 for
    // Starter's 42 minutes and $4.05 for Max's 70. That is acquisition cost for a
    // learner who never pays, on top of the free thirty minutes they already had.
    const starter = storeTrialCostUsd('starter');
    const max = storeTrialCostUsd('regular');
    assert.ok(starter < 2.5, `a Starter trial now costs $${starter.toFixed(2)} to give away`);
    assert.ok(max < 4.25, `a Max trial now costs $${max.toFixed(2)} to give away`);
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
    assert.equal(YEARLY_PLANS.starter.priceUsd, 149, note);
    assert.equal(YEARLY_PLANS.regular.priceUsd, 229, note);
    assert.equal(YEARLY_PLANS.starter.plan, 'starter');
    assert.equal(YEARLY_PLANS.regular.plan, 'regular');
  });

  test('yearly Max loses about a dollar a month at full use, which D16 accepted, and no more than that', () => {
    // The modelled number, in the contract as the founder decision requires:
    // twelve windows of 300 minutes cost $208.08 at DEFAULT_COST_MODEL against
    // $194.65 received at the Small Business rate. That is -6.9% worst case, or
    // about $1.12 a month on the heaviest possible learner. At the standard 30%
    // rate the same learner costs about $3.98 a month, which is why enrolment
    // stays a requirement. If this fails, the loss grew past what was accepted.
    const max = yearlyPlanMargin('regular', 1.0, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    const lossPerMonth = (max.worstCaseCostUsd - max.netRevenueUsd) / 12;
    assert.equal(max.priceUsd, 229);
    assert.ok(
      Math.abs(max.worstCaseCostUsd - 12 * planMargin('regular', 1.0).worstCaseCostUsd) < 1e-9,
      'a paid year is twelve monthly allowances',
    );
    assert.ok(max.worstCaseMargin < 0, `yearly Max no longer loses at full use (${(max.worstCaseMargin * 100).toFixed(1)}%); say so in D16`);
    assert.ok(lossPerMonth < 1.25, `yearly Max now loses $${lossPerMonth.toFixed(2)} a month at full use, past the dollar D16 accepted`);
  });

  test('yearly Starter still pays for its heaviest learner at the Small Business rate', () => {
    // $124.85 of cost against $126.65 received: +1.4%, about fifteen cents a
    // month. Thin, and below zero at the standard rate (-19.7%).
    const starter = yearlyPlanMargin('starter', 1.0, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
    assert.ok(starter.worstCaseMargin >= 0, `yearly Starter loses ${(starter.worstCaseMargin * 100).toFixed(1)}% at full use`);
  });

  test('at realistic utilisation both yearly plans clear a healthy margin after the store fee', () => {
    for (const plan of ['starter', 'regular'] as const) {
      const m = yearlyPlanMargin(plan, 0.5, DEFAULT_COST_MODEL, STORE_FEE_RATES.smallBusiness);
      assert.ok(m.expectedMargin > 0.4, `yearly ${plan} leaves ${(m.expectedMargin * 100).toFixed(0)}% at half utilisation`);
    }
  });
});
