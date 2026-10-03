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

import { PLANS } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { dayAndMonth, wallAccount } from './wallAccount.ts';

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
  test('the trial is said in minutes, and in conversations rounded down', () => {
    const account = wallAccount(status({ secondsRemaining: 1100 }), PLANS, NOW);
    assert.ok(account);
    assert.equal(account.title, 'Free trial');
    // 30 free minutes is three ten-minute conversations. 1100 seconds is 18.3
    // minutes, which is eighteen and one whole conversation, never nineteen or two.
    assert.deepEqual(account.lines, [
      'Your free trial is 30 minutes, about 3 conversations.',
      '18 minutes left, about 1 conversation.',
    ]);
  });

  test('a paid plan says its minutes left and the day they start fresh', () => {
    const periodEnd = '2026-10-12T12:00:00.000Z';
    const account = wallAccount(status({ plan: 'starter', secondsRemaining: 42 * 60 + 59, periodEnd }), PLANS, NOW);
    assert.ok(account);
    assert.equal(account.title, 'Starter');
    assert.deepEqual(account.lines, ['42 minutes left, about 4 conversations.', `They start fresh on ${dayAndMonth(periodEnd)}.`]);
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
    assert.equal(none?.lines[0], 'No speaking time left for now.');
    assert.match(none?.lines[1] ?? '', /^They start fresh on /, 'an empty paid plan did not say when it fills again');
  });

  test('a period already over says about now, rather than a date in the past', () => {
    const account = wallAccount(status({ plan: 'starter', secondsRemaining: 600, periodEnd: new Date(NOW - DAY).toISOString() }), PLANS, NOW);
    assert.equal(account?.lines[1], 'They start fresh about now.');
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
