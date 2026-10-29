import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PLANS, refillWhen, type Plan, type StartRefusal } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { billingStatusIn, type BillingStatus } from './billingStatus.ts';
import { dayAndMonthOf, PLAN_STATUS_COPY, planStatusFor } from './planStatus.ts';

const NOW = Date.parse('2026-09-12T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function status(over: Partial<BillingStatus> = {}): BillingStatus {
  return { plan: 'trial', secondsRemaining: 1800, periodEnd: null, lapsed: false, canStart: true, reason: null, ...over };
}

describe('plan status — the plan is drawn in words, never a countdown (F541)', () => {
  test('plan status is one of three bands in words, and no numeral reaches the card', () => {
    const plans: Plan[] = ['trial', 'starter', 'regular'];
    const refusals: (StartRefusal | null)[] = [null, 'exhausted', 'insufficient-for-session', 'subscription-lapsed'];
    const ends = [null, new Date(NOW - DAY).toISOString(), new Date(NOW + 3 * DAY).toISOString(), new Date(NOW + 20 * DAY).toISOString()];
    const bands = new Set<string>();
    for (const plan of plans) {
      const allowance = PLANS[plan].secondsPerPeriod;
      for (const reason of refusals) {
        for (const periodEnd of ends) {
          for (const seconds of [0, 1, allowance / 5, allowance / 2, allowance]) {
            for (const lapsed of [false, true]) {
              const view = planStatusFor(
                status({ plan, secondsRemaining: seconds, periodEnd, lapsed, canStart: reason === null, reason }),
                NOW,
              );
              assert.ok(view.known);
              if (!view.known) return;
              bands.add(view.band);
              // REV-001: the free plan's band alone says its whole minutes and when they come back.
              for (const line of plan === 'trial' ? [view.planLabel, view.periodLine] : [view.planLabel, view.periodLine, view.bandLine]) {
                // F909 (founder decision 9, 2026-10-29): a paid plan's period line may say the
                // day its minutes are fresh, and that date is the only numeral it may carry.
                // F911: an out-of-time paid band says the same date, in the shared words.
                const dated = plan !== 'trial'
                  && ((line === view.periodLine && /^Fresh minutes on \d{1,2} [A-Z][a-z]+\.$/.test(line))
                    || (line === view.bandLine && /^(There is a little speaking time left, but not quite enough for a whole conversation\. )?Fresh minutes on \d{1,2} [A-Z][a-z]+\. Until then, practise offline\.$/.test(line)));
                if (!dated) assert.doesNotMatch(line, /\d/, `a numeral reached the card: "${line}"`);
                assert.doesNotMatch(line, /%/, `a percentage reached the card: "${line}"`);
                assert.doesNotMatch(line, /—/, `an em dash reached the card: "${line}"`);
              }
              assert.equal(view.canStart, reason === null, 'the card carries core’s answer and never re-decides it');
              if (reason !== null) assert.equal(view.band, 'none', 'a refused start is the none band, whatever the seconds say');
            }
          }
        }
      }
    }
    assert.deepEqual([...bands].sort(), ['a-little', 'none', 'plenty'], 'every band is reachable and there are exactly three');
    for (const line of PLAN_STATUS_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries the word "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—/);
    }
    const unknown = planStatusFor(null, NOW);
    assert.ok(!unknown.known);
    if (!unknown.known) assert.doesNotMatch(unknown.line, /\d/);
  });

  test('the bands say what the seconds mean, and the period is a distance in words', () => {
    const plenty = planStatusFor(status({ plan: 'starter', secondsRemaining: PLANS.starter.secondsPerPeriod }), NOW);
    assert.ok(plenty.known && plenty.band === 'plenty' && plenty.planLabel === 'Core');
    const little = planStatusFor(status({ plan: 'regular', secondsRemaining: 60 * 10, periodEnd: new Date(NOW + 2 * DAY).toISOString() }), NOW);
    assert.ok(little.known && little.band === 'a-little' && little.planLabel === 'Max');
    // F909: the minutes window is dated, said apart from the store's billing renewal.
    if (little.known) assert.equal(little.periodLine, `Fresh minutes on ${dayAndMonthOf(NOW + 2 * DAY)}.`);
    const later = planStatusFor(status({ plan: 'starter', periodEnd: new Date(NOW + 20 * DAY).toISOString() }), NOW);
    if (later.known) assert.equal(later.periodLine, `Fresh minutes on ${dayAndMonthOf(NOW + 20 * DAY)}.`);
    // REV-001 (2026-10-23): the free plan is "Free", one conversation every
    // other day, and its band says the minutes left and when they come back,
    // as a day and a time on this phone's clock.
    const MONDAY = '2026-09-14T12:00:00.000Z';
    const WHEN = refillWhen(new Date(MONDAY));
    const BACK = `Your next free conversation is ready ${WHEN}. Until then, practise offline.`;
    const SHORT = `There is a little speaking time left, but not quite enough for a whole conversation. ${BACK}`;
    const untouched = planStatusFor(status({ secondsRemaining: 600 }), NOW);
    assert.ok(untouched.known);
    if (untouched.known) {
      assert.equal(untouched.planLabel, 'Free');
      assert.equal(untouched.periodLine, 'One free conversation every other day.');
      assert.equal(untouched.bandLine, '10 free minutes left');
      assert.equal(untouched.band, 'plenty');
    }
    const some = planStatusFor(status({ secondsRemaining: 190, periodEnd: MONDAY }), NOW);
    if (some.known) assert.equal(some.bandLine, `3 free minutes left, refills ${WHEN}`);
    const one = planStatusFor(status({ secondsRemaining: 61, periodEnd: MONDAY, canStart: false, reason: 'insufficient-for-session' }), NOW);
    if (one.known) { assert.equal(one.bandLine, SHORT); assert.equal(one.band, 'none'); }
    const spent = planStatusFor(status({ secondsRemaining: 0, periodEnd: MONDAY, canStart: false, reason: 'exhausted' }), NOW);
    if (spent.known) assert.equal(spent.bandLine, BACK);
    for (const view of [untouched, some, one, spent]) {
      if (view.known) { assert.doesNotMatch(view.bandLine, /—|–/); assert.equal(guiltIn(view.bandLine), undefined); }
    }
    // A lapsed plan is back on the free taste: its band is the free band.
    const lapsed = planStatusFor(status({ secondsRemaining: 0, lapsed: true, periodEnd: MONDAY, canStart: false, reason: 'subscription-lapsed' }), NOW);
    if (lapsed.known) {
      assert.equal(lapsed.band, 'none');
      assert.equal(lapsed.periodLine, 'Your paid plan has ended.');
      assert.equal(lapsed.bandLine, BACK);
    }
    const lapsedFresh = planStatusFor(status({ secondsRemaining: 600, lapsed: true }), NOW);
    if (lapsedFresh.known) assert.equal(lapsedFresh.bandLine, '10 free minutes left');
  });

  test('a body the server did not shape reads as nothing rather than as a plan', () => {
    const good = { plan: 'starter', secondsRemaining: 100, periodEnd: null, lapsed: false, canStart: true, reason: null };
    assert.deepEqual(billingStatusIn(good), good);
    assert.equal(billingStatusIn({ ...good, plan: 'unlimited' }), null, 'a plan this build does not know is a wire fault');
    assert.equal(billingStatusIn({ ...good, secondsRemaining: -1 }), null);
    assert.equal(billingStatusIn({ ...good, secondsRemaining: '100' }), null);
    assert.equal(billingStatusIn({ ...good, periodEnd: 'soon' }), null);
    assert.equal(billingStatusIn({ ...good, canStart: false }), null, 'a refusal with no reason is half an answer');
    assert.equal(billingStatusIn({ ...good, reason: 'exhausted' }), null, 'a reason on a start that is allowed contradicts itself');
    assert.equal(billingStatusIn({ ...good, reason: 'over-quota', canStart: false }), null, 'a fourth reason is a newer build, not a status');
    assert.equal(billingStatusIn(null), null);
    assert.equal(billingStatusIn('starter'), null);
  });
});
