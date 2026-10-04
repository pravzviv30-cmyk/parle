import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_METRICS, parseGuestMetric } from './guestMetrics.ts';
import { MemoryGuestStore } from './onboardingGuest.ts';
test('optional starter evidence accepts only closed names and evidence, never learner content or identifiers', () => {
  for (const name of GUEST_METRICS) assert.deepEqual(parseGuestMetric({ name, evidence: 'typed' }), { name, evidence: 'typed' });
  for (const value of [null, [], { name: 'reply', evidence: 'typed' }, { name: 'retry', evidence: 'un café' }, { name: 'retry', evidence: 'typed', reply: 'secret' }, { name: 'retry', evidence: 'typed', userId: 'owner' }]) assert.equal(parseGuestMetric(value), null);
});
test('daily aggregate metrics contain only variant, event and evidence enums', async () => {
  const store = new MemoryGuestStore(); const event = parseGuestMetric({ name: 'retry', evidence: 'typed' })!;
  await store.metric(event, 'five', 0); await store.metric(event, 'five', 0);
  assert.deepEqual([...store.metrics.entries()], [['1970-01-01:five:retry:typed', 2]]);
});
