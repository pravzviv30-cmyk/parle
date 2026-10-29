import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANS, refillWhen, type Plan, type StartRefusal } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { PLANS_LEAD, dueLine, plansLeadBody } from './nextAction.ts';
import { nextTaskKind, todayLead } from '../practice/nextTask.ts';
// 2026-10-29 (F651, F934): `homeActionFor` was never called in production and
// was deleted; these tests now hold the rule Today really uses, `todayLead`
// over `nextTaskKind`. Review is no longer a lead: it is its own row on
// Today's path (todayPath.test.ts), so the recall cases left with it.
const none = { kind: 'none', fallback: 'first' } as const;

test('an unavailable live tutor leads to an owned review or local phrase practice', () => {
  assert.equal(todayLead({ live: false, billing: null, starter: false }), 'local');
  assert.equal(nextTaskKind(none, false, null, true), 'review', 'an owned review still comes before local practice where a surface offers it');
  // Offline, the starter's typed practice still leads: it needs no connection.
  assert.equal(todayLead({ live: false, billing: null, starter: true }), 'starter');
});

// Revamp B (F602): the trial's used minutes lead Home with the sun card, read
// through the same billing call Speak makes. Only that state does.
test('the used free minutes lead Home with the plans card, ahead of review and the scene', () => {
  const plans = Object.keys(PLANS) as Plan[];
  const reasons: readonly (StartRefusal | null)[] = [null, 'exhausted', 'insufficient-for-session', 'subscription-lapsed'];
  for (const plan of plans) {
    for (const reason of reasons) {
      const out = plan === 'trial' && (reason === 'exhausted' || reason === 'insufficient-for-session');
      // A paid plan out of minutes gets its out-of-time words, never the plans card (2026-10-29).
      const paidOut = plan !== 'trial' && (reason === 'exhausted' || reason === 'insufficient-for-session');
      assert.equal(todayLead({ live: true, billing: { plan, reason }, starter: false }), reason === 'subscription-lapsed' ? 'lapsed' : out ? 'plans' : paidOut ? 'outOfTime' : 'scene', `${plan}/${reason}`);
      assert.equal(todayLead({ live: true, billing: { plan, reason }, starter: true }), reason === 'subscription-lapsed' ? 'lapsed' : out ? 'plans' : paidOut ? 'outOfTime' : 'starter', `${plan}/${reason} with a starter`);
    }
  }
  // An unknown plan (signed out, offline, a failed read) never leads with plans.
  assert.equal(todayLead({ live: true, billing: null, starter: false }), 'scene');

  // The card's words: the trial's own minutes, what still works, what is kept.
  assert.equal(PLANS_LEAD.title, 'Ready for more speaking time?', 'the card must stay true even with a short amount remaining');
  assert.match(PLANS_LEAD.body, /offline/, 'the card no longer says what still works without minutes');
  assert.match(PLANS_LEAD.keeps, /stay yours/, 'the card no longer says the learner keeps what they made');
  assert.equal(PLANS_LEAD.action, 'See the plans');
  for (const line of Object.values(PLANS_LEAD)) {
    assert.equal(guiltIn(line), undefined, `"${line}" carries the banned word "${guiltIn(line)}"`);
    assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
    assert.doesNotMatch(line, /%|\bof \d/, `"${line}" reads as a rate`);
    assert.equal(line, line.replace(/[A-Z]{2,}/g, ''), `"${line}" carries a caps label`);
  }

  // REV-001: on the free plan the card says when the free conversation comes back, on this phone's clock.
  const back = refillWhen(new Date('2026-10-26T12:00:00.000Z'));
  assert.equal(plansLeadBody({ plan: 'trial', reason: 'exhausted', periodEnd: '2026-10-26T12:00:00.000Z' }, Date.parse('2026-10-25T00:00:00.000Z')), `Your next free conversation is ready ${back}. Until then, practise offline. When you want more conversations, a plan adds speaking time every month.`);
  assert.equal(plansLeadBody({ plan: 'trial', reason: 'exhausted', periodEnd: null }), 'Your free conversation is used for now. Practice and review still work offline. When you want more conversations, a plan adds speaking time every month.', 'F911: a free lead with no refill time says so plainly');
  assert.equal(plansLeadBody({ plan: 'starter', reason: 'exhausted', periodEnd: '2026-10-26T12:00:00.000Z' }), PLANS_LEAD.body, 'a paid period end was said as a free refill');
  assert.equal(plansLeadBody(null), PLANS_LEAD.body);
  assert.equal(guiltIn(plansLeadBody({ plan: 'trial', reason: 'exhausted', periodEnd: '2026-10-26T12:00:00.000Z' }, Date.parse('2026-10-25T00:00:00.000Z'))), undefined);

  // The white review row under a plans or scene lead counts phrases and nothing else.
  assert.equal(dueLine(1), 'One phrase ready to recall');
  assert.equal(dueLine(4), '4 phrases ready to recall');
  for (let n = 2; n <= 40; n += 1) {
    assert.deepEqual(dueLine(n).match(/\d+/g), [String(n)], `"${dueLine(n)}" carries more than one number`);
    assert.doesNotMatch(dueLine(n), / of |%|\//, `"${dueLine(n)}" reads as a rate`);
  }
});
