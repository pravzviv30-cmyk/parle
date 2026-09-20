import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoredProfile } from './store.ts';
import { factKey, snapshotFor, visibleFacts, withFactEdited, withGoalEdited, withLearnerGoal, withMemoryCleared } from './memory.ts';

function profile() {
  const value = createStoredProfile({ name: 'Test learner', ageConfirmed: true, motivation: 'travel' }, 0);
  value.brain.memory = { ...value.brain.memory, opener: { fr: 'Bonjour', en: 'Hello' }, facts: [{ kind: 'life-event', en: 'Lives in Paris', fr: 'Habite à Paris', notedAt: '2026-09-01', happensAround: null }] };
  return value;
}

test('editing a remembered detail retires its old wording and stale translation', () => {
  const edited = withFactEdited(profile(), 'Lives in Paris', 'Lives in London');
  assert.deepEqual(visibleFacts(edited).map((f) => f.en), ['Lives in London']);
  assert.equal(visibleFacts(edited)[0]?.fr, null);
  assert.ok(edited.forgottenFacts.includes(factKey('Lives in Paris')));
  assert.equal(edited.brain.memory.opener, null);
  assert.ok(snapshotFor(edited).memory.facts.some((f) => f.en === 'Lives in London'));
});

test('blank or stale edits preserve existing details', () => {
  const original = profile();
  assert.equal(withFactEdited(original, 'Lives in Paris', '  '), original);
  assert.equal(withFactEdited(original, 'Missing detail', 'Replacement'), original);
});

test('editing one goal preserves the others and deduplicates equivalent goals', () => {
  const original = withLearnerGoal(withLearnerGoal(profile(), 'Order coffee'), 'Meet friends');
  const edited = withGoalEdited(original, 'Order coffee', 'Order bread');
  assert.deepEqual(edited.learnerGoals, ['Order bread', 'Meet friends']);
  assert.deepEqual(withGoalEdited(edited, 'Order bread', 'Meet friends').learnerGoals, ['Meet friends']);
});

test('clearing remembered details preserves goals and learning preferences', () => {
  const original = withLearnerGoal(profile(), 'Order coffee');
  const cleared = withMemoryCleared(original);
  assert.deepEqual(visibleFacts(cleared), []);
  assert.deepEqual(cleared.learnerGoals, original.learnerGoals);
  assert.deepEqual(cleared.brain.preferences, original.brain.preferences);
});
