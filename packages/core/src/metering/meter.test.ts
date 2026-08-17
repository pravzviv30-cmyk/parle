import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLANS,
  DEFAULT_COST_MODEL,
  MIN_VIABLE_SESSION_SEC,
  canStartSession,
  estimateSessionCost,
  planMargin,
  recordUsage,
  rollPeriod,
  secondsRemaining,
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

  test('a paid period resets usage when it rolls', () => {
    const e: Entitlement = { plan: 'starter', secondsUsed: 9000, periodEnd: new Date('2026-01-01') };
    const rolled = rollPeriod(e, new Date('2026-02-01'));
    assert.equal(rolled.secondsUsed, 0);
    assert.ok(rolled.periodEnd! > new Date('2026-02-01'));
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
