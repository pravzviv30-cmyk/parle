/**
 * F911: the free limit said three different things on three screens, and most
 * never said when time came back. These drive every site through its own
 * public function, so a site that stops using the shared words fails here.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { refillWhen } from '@luvani/core';

import type { BillingStatus } from './billingStatus.ts';
import { dayAndMonthOf, planSentence, planStatusFor } from './planStatus.ts';
import { outOfTimeCard } from '../empty/emptyStates.ts';
import { minutesBand } from '../tutor/speakTabView.ts';
import { refusalWords } from '../live/refusalRefill.ts';
import { plansLeadBody } from '../home/nextAction.ts';
import { wallAccount } from '../wall/wallAccount.ts';
import { PLANS } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';

const NOW = Date.parse('2026-10-27T09:00:00.000Z');
const REFILL = '2026-10-29T16:10:00.000Z';
const TABLE = { label: 'Out of minutes', message: 'The table sentence.' };

function status(over: Partial<BillingStatus> = {}): BillingStatus {
  return { plan: 'trial', secondsRemaining: 0, periodEnd: REFILL, lapsed: false, canStart: false, reason: 'exhausted', ...over };
}

/** Every out-of-time sentence each site would show for this state. */
function everySite(s: BillingStatus): Record<string, string> {
  const view = planStatusFor(s, NOW);
  assert.ok(view.known);
  const card = outOfTimeCard(view);
  return {
    'Speak band': minutesBand(view),
    ...(card === null ? {} : { 'Speak card': `${card.title}. ${card.body}` }),
    'Settings and Subscription': view.known ? planSentence(view.bandLine, view.periodLine) : '',
    ...(s.plan === 'trial' ? {
      'live Start': refusalWords(TABLE, s.reason ?? 'exhausted', { error: s.reason, refillsAt: s.periodEnd }, NOW).message,
      'Today lead': plansLeadBody({ plan: s.plan, reason: s.reason, periodEnd: s.periodEnd }),
    } : {}),
    wall: (wallAccount(s, PLANS, NOW)?.lines ?? []).join(' '),
  };
}

describe('F911: one out-of-time message, with the time it comes back', () => {
  test('every out-of-time message names when the next free conversation is ready', () => {
    const line = `Your next free conversation is ready ${refillWhen(new Date(REFILL))}. Until then, practise offline.`;
    for (const [site, words] of Object.entries(everySite(status()))) {
      assert.ok(words.includes(line), `${site} did not say when the free conversation is back: "${words}"`);
      assert.doesNotMatch(words, /No speaking time left|—|·/, `${site}: "${words}"`);
      assert.equal(guiltIn(words), undefined, `${site}: "${words}"`);
    }
    // Settings says it once, not followed by a second, vaguer answer.
    const settings = everySite(status())['Settings and Subscription'];
    assert.equal(settings, line);
  });

  test('a paid plan out of minutes says the day they are fresh', () => {
    const end = '2026-11-27T10:00:00.000Z';
    const fresh = `Fresh minutes on ${dayAndMonthOf(end)}. Until then, practise offline.`;
    assert.equal(fresh, 'Fresh minutes on 27 November. Until then, practise offline.');
    for (const [site, words] of Object.entries(everySite(status({ plan: 'starter', periodEnd: end })))) {
      assert.ok(words.includes(fresh), `${site}: "${words}"`);
    }
  });

  test('a little left but not enough says so plainly, then the same refill line', () => {
    const s = status({ secondsRemaining: 61, reason: 'insufficient-for-session' });
    const words = `There is a little speaking time left, but not quite enough for a whole conversation. Your next free conversation is ready ${refillWhen(new Date(REFILL))}.`;
    for (const [site, said] of Object.entries(everySite(s))) {
      assert.ok(said.includes(words), `${site}: "${said}"`);
    }
  });

  test('a 402 for insufficient-for-session reads its refillsAt, and a body without one keeps the table', () => {
    const said = refusalWords(TABLE, 'insufficient-for-session', { error: 'insufficient-for-session', refillsAt: REFILL }, NOW);
    assert.equal(said.label, 'Not quite enough time for a conversation');
    assert.equal(said.message, `There is a little speaking time left, but not quite enough for a whole conversation. Your next free conversation is ready ${refillWhen(new Date(REFILL))}. Until then, practise offline.`);
    assert.deepEqual(refusalWords(TABLE, 'insufficient-for-session', { error: 'insufficient-for-session' }, NOW), TABLE);
  });

  test('a free row with no known refill says so truthfully, never a time', () => {
    const view = planStatusFor(status({ periodEnd: null }), NOW);
    assert.ok(view.known);
    if (view.known) assert.equal(view.bandLine, 'Your free conversation is used for now. Practice and review still work offline.');
  });
});
