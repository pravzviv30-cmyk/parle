/**
 * What the plans page says about the account in hand: minutes left, and when
 * they start fresh (2026-09-27, notebook Phase 6-E).
 *
 * The seconds are the server's own answer from `/billing/status`, so nothing on
 * the phone is guessed. Every count is rounded down, because a learner who is
 * told eighteen minutes and gets eighteen and a bit has been told the truth, and
 * one told nineteen has not.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { PLANS, refillWhen } from '@luvani/core';

const FREE_LINE = 'You get one free conversation every other day, up to 10 minutes.';

import { guiltIn } from '../copy/guilt.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { dayAndMonth, wallAccount } from './wallAccount.ts';
import { freshMinutesLine, PERIOD_LINES } from '../purchases/outOfTime.ts';

const NOW = Date.parse('2026-09-27T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const status = (over: Partial<BillingStatus> = {}): BillingStatus => ({
  plan: 'trial',
  secondsRemaining: 1800,
  periodEnd: null,
  lapsed: false,
  canStart: true,
  reason: null,
  ...over,
});

describe('the account in hand, in minutes', () => {
  test('the free plan is said as one conversation every other day, what is left, and when it comes back', () => {
    // REV-001 (2026-10-23): "Free", one ten-minute conversation, back 44 hours after first use.
    const account = wallAccount(status({ secondsRemaining: 230, periodEnd: '2026-10-12T12:00:00.000Z' }), PLANS, NOW);
    assert.ok(account);
    assert.equal(account.title, 'Free');
    // 230 seconds is 3.8 minutes: three, never four.
    assert.deepEqual(account.lines, [FREE_LINE, '3 minutes left.', `The next one is ready ${refillWhen(new Date('2026-10-12T12:00:00.000Z'))}.`]);
    // Untouched: no refill time yet, because the window starts at first use.
    assert.deepEqual(wallAccount(status({ secondsRemaining: 600, periodEnd: null }), PLANS, NOW)?.lines, [FREE_LINE, '10 minutes left, about 1 conversation.']);
    // A lapsed plan is back on the free conversation, and says so.
    assert.equal(wallAccount(status({ secondsRemaining: 300, periodEnd: null, lapsed: true }), PLANS, NOW)?.title, 'Free');
  });

  test('a paid plan says its minutes left and the day they start fresh', () => {
    const periodEnd = '2026-10-12T12:00:00.000Z';
    const account = wallAccount(status({ plan: 'starter', secondsRemaining: 42 * 60 + 59, periodEnd }), PLANS, NOW);
    assert.ok(account);
    assert.equal(account.title, 'Core');
    assert.deepEqual(account.lines, ['42 minutes left, about 4 conversations.', `Fresh minutes on ${dayAndMonth(periodEnd)}.`]);
    // F911: the same fact in the same words as Subscription and the band.
    assert.equal(account.lines[1], freshMinutesLine(dayAndMonth(periodEnd)!));
    assert.equal(dayAndMonth(periodEnd), '12 October');
  });

  test('nothing is rounded up, down to the last minute', () => {
    const one = wallAccount(status({ plan: 'regular', secondsRemaining: 119, periodEnd: new Date(NOW + 3 * DAY).toISOString() }), PLANS, NOW);
    assert.equal(one?.lines[0], '1 minute left.');
    const under = wallAccount(status({ plan: 'regular', secondsRemaining: 59, periodEnd: new Date(NOW + 3 * DAY).toISOString() }), PLANS, NOW);
    assert.equal(under?.lines[0], 'Less than a minute left.');
    const none = wallAccount(
      status({ plan: 'starter', secondsRemaining: 0, canStart: false, reason: 'exhausted', periodEnd: new Date(NOW + 3 * DAY).toISOString() }),
      PLANS,
      NOW,
    );
    // F911: an empty paid plan says when it fills again, in the words every screen uses.
    assert.deepEqual(none?.lines, [`Fresh minutes on ${dayAndMonth(new Date(NOW + 3 * DAY).toISOString())}.`, 'Until then, practise offline.']);
  });

  test('a period already over says about now, rather than a date in the past', () => {
    const account = wallAccount(status({ plan: 'starter', secondsRemaining: 600, periodEnd: new Date(NOW - DAY).toISOString() }), PLANS, NOW);
    assert.equal(account?.lines[1], PERIOD_LINES.freshSoon);
  });

  test('where the account has no minutes to report, the page says nothing about them', () => {
    assert.equal(wallAccount(null, PLANS, NOW), null, 'an unanswered read was drawn as a plan');
    assert.equal(
      wallAccount(status({ plan: 'starter', secondsRemaining: 0, lapsed: true, canStart: false, reason: 'subscription-lapsed' }), PLANS, NOW),
      null,
      'a lapsed plan was drawn as if it had minutes',
    );
    // No catalogue: the trial's size is the server's to say, so it is not said.
    assert.deepEqual(wallAccount(status({ secondsRemaining: 600 }), null, NOW)?.lines, ['10 minutes left, about 1 conversation.']);
  });

  test('every line clears the guilt list and the em dash, and no digit is compiled in', () => {
    const lines: string[] = [];
    for (const plan of ['trial', 'starter', 'regular'] as const) {
      for (const seconds of [0, 1, 59, 60, 61, 599, 600, 1800, 10800, 18000]) {
        for (const periodEnd of [null, new Date(NOW - DAY).toISOString(), new Date(NOW + 20 * DAY).toISOString()]) {
          const account = wallAccount(
            status({ plan, secondsRemaining: seconds, periodEnd, canStart: seconds > 0, reason: seconds > 0 ? null : 'exhausted' }),
            PLANS,
            NOW,
          );
          if (account !== null) lines.push(account.title, ...account.lines);
        }
      }
    }
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /[$€£%]/, `"${line}" carries a price or a percentage`);
    }
    const source = readFileSync(fileURLToPath(new URL('./wallAccount.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(source, /'[^'\n]*\d[^'\n]*'|`[^`\n]*\d[^`\n]*`/, 'the module spells a number of its own in a string');
    assert.doesNotMatch(source, /Math\.(round|ceil)\b/, 'the module rounds a count up');
  });
});
