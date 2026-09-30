import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLANS, type Plan, type StartRefusal } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { PLANS_LEAD, dueLine, homeActionFor } from './nextAction.ts';
import { fallbackHero } from './homeMission.ts';
// 2026-09-27 (notebook Phase 3): the hero is a spine scene or, once the whole
// spine is earned, the day's scene. Recall can only stand in for the day's.
test('Today keeps one next action: the next scene, recall, then a fresh scene', () => {
  const hero = fallbackHero();
  assert.equal(homeActionFor({ ...hero, kind: 'scene' }, 12, null), 'conversation', 'recall replaced the next scene on the spine');
  // Only the discriminant is read by this policy.
  assert.equal(homeActionFor({ ...hero, kind: 'today' }, 12, null), 'review');
  assert.equal(homeActionFor({ ...hero, kind: 'today' }, 0, null), 'conversation');
});

// Revamp B (F602): the trial's used minutes lead Home with the sun card, read
// through the same billing call Speak makes. Only that one state does.
test('the used free minutes lead Home with the plans card, ahead of review and the scene', () => {
  const hero = fallbackHero();
  const spent = { plan: 'trial', reason: 'exhausted' } as const;

  // Ahead of the scene, and ahead of recall.
  assert.equal(homeActionFor({ ...hero, kind: 'scene' }, 0, spent), 'plans', 'a spent trial still leads with the next scene');
  assert.equal(homeActionFor({ ...hero, kind: 'today' }, 12, spent), 'plans', 'recall stood in front of the used free minutes');

  // Every other billing answer leaves the old rule exactly as it was.
  const plans: readonly Plan[] = ['trial', 'starter', 'regular'];
  const reasons: readonly (StartRefusal | null)[] = [null, 'exhausted', 'insufficient-for-session', 'subscription-lapsed'];
  for (const plan of plans) {
    for (const reason of reasons) {
      if (plan === 'trial' && reason === 'exhausted') continue;
      const billing = { plan, reason };
      assert.equal(homeActionFor({ ...hero, kind: 'scene' }, 12, billing), 'conversation', `${plan}/${reason} changed the scene lead`);
      assert.equal(homeActionFor({ ...hero, kind: 'today' }, 12, billing), 'review', `${plan}/${reason} changed the recall lead`);
      assert.equal(homeActionFor({ ...hero, kind: 'today' }, 0, billing), 'conversation', `${plan}/${reason} changed the fresh scene`);
    }
  }
  // An unknown plan (signed out, offline, a failed read) never leads with plans.
  assert.equal(homeActionFor({ ...hero, kind: 'scene' }, 0, null), 'conversation');

  // The card's words: the trial's own minutes, what still works, what is kept.
  assert.equal(PLANS_LEAD.title, `Your ${PLANS.trial.secondsPerPeriod / 60} free minutes are used.`);
  assert.equal(PLANS_LEAD.title, 'Your 30 free minutes are used.', 'the trial changed length; check the card still reads true');
  assert.match(PLANS_LEAD.body, /offline/, 'the card no longer says what still works without minutes');
  assert.match(PLANS_LEAD.keeps, /stay yours/, 'the card no longer says the learner keeps what they made');
  assert.equal(PLANS_LEAD.action, 'See the plans');
  for (const line of Object.values(PLANS_LEAD)) {
    assert.equal(guiltIn(line), undefined, `"${line}" carries the banned word "${guiltIn(line)}"`);
    assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
    assert.doesNotMatch(line, /%|\bof \d/, `"${line}" reads as a rate`);
    assert.equal(line, line.replace(/[A-Z]{2,}/g, ''), `"${line}" carries a caps label`);
  }

  // The white review row under a plans or scene lead counts phrases and nothing else.
  assert.equal(dueLine(1), 'One phrase ready to recall');
  assert.equal(dueLine(4), '4 phrases ready to recall');
  for (let n = 2; n <= 40; n += 1) {
    assert.deepEqual(dueLine(n).match(/\d+/g), [String(n)], `"${dueLine(n)}" carries more than one number`);
    assert.doesNotMatch(dueLine(n), / of |%|\//, `"${dueLine(n)}" reads as a rate`);
  }
});
