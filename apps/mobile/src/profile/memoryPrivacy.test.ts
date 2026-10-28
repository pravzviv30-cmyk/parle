import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfile, applyExtractionToProfile, memoryPaused, repairProfile } from '@luvani/brain/profile';
import { mergeLearnerProfiles } from '@luvani/brain/profile/merge';
import { createStoredProfile } from './store.ts';
import { brainAfterRecap, snapshotFor, storedForgottenFacts, withFactForgotten, withLearnerGoal, withMemoryPaused, withoutForgotten } from './memory.ts';
import { SYNC_POLICIES } from '../sync/policy.ts';
import { memoryEmptyLine, NOTHING_YET, MEMORY_PAUSED_EMPTY } from './tutorMemory.ts';
import { upgradeStored } from './upgrade.ts';

const held = () => {
  const profile = createStoredProfile({ name: 'James', motivation: 'travel' }, 1000);
  profile.brain.memory.facts = [{ kind: 'interest', en: 'Likes jazz', fr: 'Aime le jazz', notedAt: '2026-01-01', source: 'conversation', updatedAt: '2026-01-01', happensAround: null }];
  profile.brain.memory.opener = { en: 'How was the concert?', fr: 'Comment était le concert ?' };
  return profile;
};

test('old forgets survive more than forty later forgets, upgrades, extraction and both sync orders', () => {
  let profile = withFactForgotten(held(), 'Likes jazz');
  for (let i = 0; i < 100; i++) profile = withFactForgotten(profile, `Old fact ${i}`);
  assert.equal(profile.forgottenFacts.length, 101);
  const stale = held();
  stale.brain.stats.sessions = 50;
  const policy = SYNC_POLICIES.find((item) => item.namespace === 'profile')!;
  for (const [a, b] of [[profile, stale], [stale, profile]]) {
    const merged = policy.merge(a, b, 2000) as typeof profile;
    assert.equal(merged.forgottenFacts.length, 101);
    assert.ok(merged.forgottenFacts.includes('likes jazz'));
    assert.deepEqual(merged.brain.memory.facts, [], 'the raw synced profile must also forget the fact');
    assert.equal(merged.brain.memory.opener, null);
  }
  assert.ok(profile.forgottenFacts.includes('likes jazz'));
  const upgraded = upgradeStored(profile, 2000);
  assert.ok(upgraded);
  assert.deepEqual(upgraded.forgottenFacts, profile.forgottenFacts);
  const extracted = applyExtractionToProfile(createProfile(), { facts: held().brain.memory.facts, openerEn: 'How was the concert?', openerFr: 'Et le concert ?' }, '2026-02-01');
  const saved = withoutForgotten(extracted, profile.forgottenFacts);
  assert.deepEqual(saved.memory.facts, []);
  assert.equal(saved.memory.opener, null, 'an unsourced paraphrased opener must not repeat forgotten details');
  assert.deepEqual(storedForgottenFacts(['likes jazz', 'Likes Jazz', null, '']), ['likes jazz']);
});

test('pause withholds personal facts and goals while preserving name and French progress', () => {
  const profile = withLearnerGoal(held(), 'Order at a bakery');
  const paused = withMemoryPaused(profile, true, 2000);
  assert.equal(memoryPaused(paused.brain), true);
  assert.equal(memoryEmptyLine(paused), MEMORY_PAUSED_EMPTY);
  assert.equal(memoryEmptyLine(profile), NOTHING_YET);
  assert.deepEqual(paused.brain.memory.facts, profile.brain.memory.facts, 'pause preserves what the learner can manage');
  const snapshot = snapshotFor(paused);
  assert.deepEqual(snapshot.memory.facts, []);
  assert.equal(snapshot.memory.learnerGoals, undefined, 'a paused memory still carried the typed goals');
  assert.equal(snapshot.memory.opener, null);
  assert.equal(snapshot.memory.name, 'James');
  assert.deepEqual(snapshot.stats, profile.brain.stats);
  const after = brainAfterRecap({ ...held().brain, stats: { sessions: 2, totalTurns: 4, rescues: 0, lastRung: null } }, paused);
  assert.deepEqual(after.memory, paused.brain.memory, 'a late recap must not unpause or replace personal memory');
  assert.equal(after.stats.sessions, 2, 'pausing personal memory must not erase French progress');
  assert.equal(applyExtractionToProfile(paused.brain, { facts: [], openerFr: 'Salut', openerEn: 'Hello' }, '2026-02-01'), paused.brain);
  const resumed = withMemoryPaused(paused, false, 1000);
  assert.equal(resumed.brain.memory.control?.changedAt, 2001, 'the local observed clock must advance even after clock rollback');
  assert.equal(memoryPaused(resumed.brain), false);
  assert.deepEqual(snapshotFor(resumed).memory.learnerGoals, ['Order at a bakery']);
  const screen = readFileSync(new URL('./TutorMemoryScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /SwitchRow[^\n]+MEMORY_PAUSE_TITLE[^\n]+commitMemory[^\n]+withMemoryPaused/);
});

test('the newest pause choice survives a busier stale device and ties conservatively pause', () => {
  const paused = withMemoryPaused(held(), true, 2000).brain;
  const busy = held().brain;
  busy.stats.sessions = 50;
  for (const [a, b] of [[paused, busy], [busy, paused]]) {
    const merged = mergeLearnerProfiles(a, b, 10, 20);
    assert.equal(memoryPaused(merged), true);
    assert.equal(merged.memory.opener, null);
    assert.deepEqual(mergeLearnerProfiles(merged, a, 20, 10), merged);
  }
  const resumed = withMemoryPaused({ ...held(), brain: paused }, false, 3000).brain;
  assert.equal(memoryPaused(mergeLearnerProfiles(paused, resumed, 100, 1)), false);
  const tie = { ...resumed, memory: { ...resumed.memory, control: { paused: true, changedAt: 3000 } } };
  assert.equal(memoryPaused(mergeLearnerProfiles(resumed, tie, 100, 1)), true);
  for (const invalid of [{ paused: true }, { paused: 'yes', changedAt: 10 }, { paused: true, changedAt: -1 }]) {
    const repaired = repairProfile({ ...held().brain, memory: { ...held().brain.memory, control: invalid } });
    assert.equal(repaired.memory.control, undefined);
  }
});
