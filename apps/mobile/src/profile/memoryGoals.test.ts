/**
 * LEARN-009. Typed goals ride the snapshot as `memory.learnerGoals`, never as
 * facts, so the agent's echo in a recap cannot store them as facts: they would
 * duplicate, outlive their removal and eat the twelve-fact cap.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createProfile, repairProfile, type LearnerProfile, type RememberedFact } from '@luvani/brain/profile';

import { createStoredProfile, type StoredProfile } from './store.ts';
import { brainAfterRecap, snapshotFor, visibleFacts, withoutLearnerGoal } from './memory.ts';

const NOW = Date.parse('2026-09-12T10:00:00Z');
const T = '2026-09-01T00:00:00.000Z';

function fact(en: string, kind: RememberedFact['kind'] = 'life-event', notedAt = T): RememberedFact {
  return { kind, fr: null, en, happensAround: null, notedAt, source: 'conversation', updatedAt: notedAt };
}

function learner(facts: RememberedFact[], goals: string[]): StoredProfile {
  const base = createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW);
  const brain: LearnerProfile = { ...createProfile(), memory: { facts, opener: null, name: null } };
  return { ...base, brain, learnerGoals: goals };
}

function goalMentions(snapshot: LearnerProfile, goal: string): number {
  const inFacts = snapshot.memory.facts.filter((f) => f.en.includes(goal)).length;
  const inGoals = (snapshot.memory.learnerGoals ?? []).filter((g) => g === goal).length;
  return inFacts + inGoals;
}

describe('learner goals never become stored facts (LEARN-009)', () => {
  test('a recap echo of the snapshot stores no goal, and goals ride once', () => {
    const profile = learner([fact('Has a dog called Biscuit')], ['Order at a bakery', 'Call the plumber']);
    const echoed = repairProfile(JSON.parse(JSON.stringify(snapshotFor(profile))));
    const stored = brainAfterRecap(echoed, profile);
    assert.ok(!stored.memory.facts.some((f) => f.en.startsWith('Their goal:')), 'a goal was stored as a fact');
    assert.equal(stored.memory.learnerGoals, undefined, 'the recap stored the wire-only goals');
    assert.deepEqual(stored.memory.facts.map((f) => f.en), ['Has a dog called Biscuit']);

    const next = snapshotFor({ ...profile, brain: stored });
    for (const goal of profile.learnerGoals) assert.equal(goalMentions(next, goal), 1, `${goal} did not ride exactly once`);

    const removed = withoutLearnerGoal({ ...profile, brain: stored }, 'Order at a bakery');
    assert.equal(goalMentions(snapshotFor(removed), 'Order at a bakery'), 0, 'a removed goal still rode');
    assert.equal(goalMentions(snapshotFor(removed), 'Call the plumber'), 1);
  });

  test('echoes already stored are cleaned on read; a real extracted goal fact stays', () => {
    const echo: RememberedFact = { kind: 'goal', fr: null, en: 'Their goal: Order at a bakery', happensAround: null, notedAt: '', source: 'learner', updatedAt: '' };
    const real = fact('Wants to pass the DELF B1', 'goal');
    const profile = learner([echo, real], []);
    assert.deepEqual(visibleFacts(profile).map((f) => f.en), [real.en]);
    assert.deepEqual(snapshotFor(profile).memory.facts.map((f) => f.en), [real.en]);
    assert.deepEqual(brainAfterRecap(profile.brain, profile).memory.facts.map((f) => f.en), [real.en]);
  });

  test('paused memory carries no typed goals', () => {
    const profile = learner([], ['Order at a bakery']);
    profile.brain.memory.control = { paused: true, changedAt: NOW };
    const snap = snapshotFor(profile);
    assert.equal(snap.memory.learnerGoals, undefined);
    assert.deepEqual(snap.memory.facts, []);
  });
});
