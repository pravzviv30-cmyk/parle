import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_SCENARIOS } from '@luvani/core';
import { exploreAccessLabel, freeExploreScenarioIds, hasExplorePlan, isFreeExploreContent, openExploreContent } from './exploreAccess.ts';
import type { BillingStatus } from './billingStatus.ts';

const future = new Date(Date.now() + 86400000).toISOString();
const paid: BillingStatus = { plan: 'starter', secondsRemaining: 0, periodEnd: future, lapsed: false, canStart: false, reason: 'exhausted' };
test('free samples resolve permanently across every theme and all three authored pitches', () => {
  const ids = freeExploreScenarioIds();
  assert.equal(new Set(ids).size, ids.length);
  const coverage = new Set(ids.map(id => {
    const scenario = DAILY_SCENARIOS.find(item => item.id === id);
    assert.ok(scenario, id);
    return `${scenario.theme}:${scenario.tier}`;
  }));
  assert.equal(coverage.size, 30);
  for (const scenario of DAILY_SCENARIOS) assert.ok(coverage.has(`${scenario.theme}:${scenario.tier}`));
  assert.equal(isFreeExploreContent({ kind: 'daily', id: 'any-existing-item' }), true);
  assert.equal(isFreeExploreContent({ kind: 'mission', id: 'mission:cafe' }), true);
});
test('plan access uses server standing, independently of live minutes and annual refill clocks', () => {
  assert.equal(hasExplorePlan(paid), true);
  assert.equal(hasExplorePlan({ ...paid, plan: 'regular' }), true);
  assert.equal(hasExplorePlan({ ...paid, lapsed: true }), false);
  assert.equal(hasExplorePlan({ ...paid, periodEnd: new Date(0).toISOString() }), true, 'a delayed annual allowance refill is not a lapsed subscription');
  assert.equal(hasExplorePlan({ ...paid, periodEnd: null }), true);
  assert.equal(hasExplorePlan(null), false);
  assert.equal(exploreAccessLabel({ kind: 'scenario', id: freeExploreScenarioIds()[0]! }, null), 'Free sample');
  assert.equal(exploreAccessLabel({ kind: 'scenario', id: 'other' }, paid), null);
});
test('unread billing is recovery, a known free account reaches plans, samples need no network', async () => {
  const seen: string[] = [];
  const run = (id: string, status: BillingStatus | null) => openExploreContent({ ref: { kind: 'scenario', id }, read: async () => { seen.push('read'); return status; }, current: () => true, open: () => seen.push('open'), plans: () => seen.push('plans'), unavailable: () => seen.push('unavailable') });
  await run(freeExploreScenarioIds()[0]!, null);
  assert.deepEqual(seen.splice(0), ['open']);
  await run('other', null);
  assert.deepEqual(seen.splice(0), ['read', 'unavailable']);
  await run('other', { ...paid, plan: 'trial', periodEnd: null });
  assert.deepEqual(seen.splice(0), ['read', 'plans']);
  await run('other', paid);
  assert.deepEqual(seen.splice(0), ['read', 'open']);
});
test('a delayed access answer cannot open content after an account change or blur', async () => {
  let current = true;
  let resolve!: (value: BillingStatus) => void;
  const seen: string[] = [];
  const pending = openExploreContent({ ref: { kind: 'scenario', id: 'other' }, read: () => new Promise(done => { resolve = done; }), current: () => current, open: () => seen.push('open'), plans: () => seen.push('plans'), unavailable: () => seen.push('unavailable') });
  current = false;
  resolve(paid);
  await pending;
  assert.deepEqual(seen, []);
});
