/**
 * What the tutor remembers, as something the learner can edit — F562, F563.
 *
 * The defect these hold against is quiet: a fact deleted from the brain is
 * back the next session that mentions it, because the extraction dedupes on
 * the fact's own text and sees nothing on file. So a forget is a tombstone,
 * applied at the one write every recap goes through, and a goal is appended
 * where the agent's `slice(-5)` will find it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MAX_MEMORY_FACTS, applyExtractionToProfile, createProfile, type LearnerProfile, type RememberedFact } from '@luvani/brain/profile';
import { parsePreviousCorrection } from '@luvani/core';

import { createStoredProfile, type StoredProfile } from './store.ts';
import { upgradeStored } from './upgrade.ts';
import { SYNC_POLICIES } from '../sync/policy.ts';
import {
  MAX_LEARNER_GOALS,
  factKey,
  snapshotFor,
  visibleFacts,
  withFactForgotten,
  withLearnerGoal,
  withMemoryCleared,
  withMemoryPaused,
  withoutForgotten,
  withoutLearnerGoal,
} from './memory.ts';

const NOW = Date.parse('2026-09-12T10:00:00Z');

function fact(en: string, kind: RememberedFact['kind'] = 'life-event', notedAt = '2026-09-01T00:00:00.000Z'): RememberedFact {
  return { kind, fr: null, en, happensAround: null, notedAt };
}

function learner(facts: readonly RememberedFact[] = [], over: Partial<StoredProfile> = {}): StoredProfile {
  const base = createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW);
  const brain: LearnerProfile = { ...createProfile(), memory: { facts: [...facts], opener: { fr: 'Alors, cet entretien ?', en: 'So, that interview?' }, name: null } };
  return { ...base, brain, ...over };
}

describe('the tutor’s memory, edited by the learner', () => {
  test('the onboarding goal rides the snapshot, paused memory included', () => {
    assert.equal(snapshotFor(learner([], { onboardingGoal: 'work' })).memory.goal, 'work');
    assert.equal(snapshotFor(learner([], { onboardingGoal: undefined })).memory.goal, null);
    assert.equal(snapshotFor(learner([], { onboardingGoal: 'nonsense' })).memory.goal, null);
    const paused = withMemoryPaused(learner([fact('Likes jazz')], { onboardingGoal: 'trip' }), true, NOW);
    const snap = snapshotFor(paused);
    assert.deepEqual(snap.memory.facts, []);
    assert.equal(snap.memory.goal, 'trip', 'a paused memory dropped the onboarding answer');
  });

  test('a previous correction is bounded ephemeral learning context, including while personal memory is paused', () => {
    const correction = parsePreviousCorrection({ packId: 'one', title: 'At a café', quote: 'je veux', better: 'Je voudrais', betterEn: 'I would like', why: 'A polite request.' })!;
    const profile = learner([fact('Likes jazz')]);
    profile.brain.memory.control = { paused: true, changedAt: NOW };
    const before = JSON.stringify(profile);
    const snapshot = snapshotFor(profile, [], NOW, correction);
    assert.deepEqual(snapshot.previousCorrection, correction);
    assert.deepEqual(snapshot.memory.facts, []);
    assert.equal(JSON.stringify(profile), before);
    assert.equal(snapshotFor(profile, [], NOW, { ...correction, quote: '' }).previousCorrection, undefined);
    const navigator = readFileSync(fileURLToPath(new URL('../nav/RootNavigator.tsx', import.meta.url)), 'utf8');
    assert.match(navigator, /previousCorrectionFromPacks\(packs.value, owner\)/, 'the source pack must belong to the active learner');
    assert.match(navigator, /Promise.allSettled\(\[loadDeck\(\), loadConversationPacks\(\)\]\)/);
  });
  test("a forgotten fact stays forgotten across an extraction that mentions it, and a learner's goal is among the five facts that ride", () => {
    // F562. Forget one: the tombstone is written and the fact leaves the
    // brain in the same step, and nothing else about the learner moves.
    const before = learner([fact('Has a job interview on Friday'), fact('Likes jazz', 'interest')]);
    const forgot = withFactForgotten(before, 'Has a job interview on Friday');
    assert.deepEqual(forgot.forgottenFacts, [factKey('Has a job interview on Friday')]);
    assert.deepEqual(visibleFacts(forgot).map((f) => f.en), ['Likes jazz']);
    assert.deepEqual(forgot.brain.memory.facts.map((f) => f.en), ['Likes jazz'], 'the fact is still in the brain that rides');
    assert.deepEqual({ ...forgot, forgottenFacts: [], brain: before.brain }, before, 'forgetting edited more than the memory');

    // The next session mentions it again. The extraction sees nothing on file
    // and writes it back, exactly as it would on a phone, and the one write
    // every recap goes through applies the tombstone.
    const recap = applyExtractionToProfile(forgot.brain, {
      facts: [{ kind: 'life-event', fr: null, en: 'has a job interview on friday', happensAround: 'Friday' }],
      openerFr: null,
      openerEn: null,
    }, '2026-09-12T00:00:00.000Z');
    assert.ok(recap.memory.facts.some((f) => f.en === 'has a job interview on friday'), 'the fixture does not reproduce the return');
    const saved = withoutForgotten(recap, forgot.forgottenFacts);
    assert.deepEqual(saved.memory.facts.map((f) => f.en), ['Likes jazz'], 'the forgotten fact came back through the recap');
    assert.equal(withoutForgotten(recap, []), recap, 'with nothing forgotten, the brain is handed back untouched');

    // The context applies it at that one write, not in the navigator's
    // handler, whose deps must stay exactly [updateBrain] (F386).
    const context = readFileSync(fileURLToPath(new URL('../app/ProfileContext.tsx', import.meta.url)), 'utf8');
    assert.match(context, /brain: brainAfterRecap\(blob, current\)/, 'updateBrain saves the recap’s brain without applying the tombstones');
    const navigator = readFileSync(fileURLToPath(new URL('../nav/RootNavigator.tsx', import.meta.url)), 'utf8');
    assert.match(navigator, /snapshot=\{snapshotFor\(profile, reviewDeck, Date.now\(\), previousCorrection\)\}/, 'the session snapshot, review focus and previous correction are composed in memory.ts');
    assert.ok(!navigator.includes('withLearnerName('), 'the navigator still folds the name in itself, beside the one snapshot');

    // Forget everything: every fact becomes a tombstone and the opener, which
    // was written from them, goes too.
    const cleared = withMemoryCleared(before);
    assert.deepEqual(cleared.brain.memory.facts, []);
    assert.equal(cleared.brain.memory.opener, null);
    assert.deepEqual(visibleFacts(cleared), []);
    assert.deepEqual(cleared.forgottenFacts, [factKey('Has a job interview on Friday'), factKey('Likes jazz')]);

    // A goal rides last, or never: the agent sends the last five facts, so
    // with a full memory the goal is still among them, and the brain's cap
    // holds from the end.
    const full = learner(Array.from({ length: MAX_MEMORY_FACTS }, (_, i) => fact(`Fact number ${i}`)));
    const withGoal = withLearnerGoal(full, '  Order at a bakery   without switching to English ');
    assert.deepEqual(withGoal.learnerGoals, ['Order at a bakery without switching to English'], 'the goal was not trimmed and collapsed');
    const snapshot = snapshotFor(withGoal);
    assert.equal(snapshot.memory.facts.length, MAX_MEMORY_FACTS, 'the snapshot outgrew the brain’s own cap');
    const ride = snapshot.memory.facts.slice(-5).map((f) => f.en);
    assert.ok(ride.includes('Their goal: Order at a bakery without switching to English'), `the goal is not among the five that ride: ${ride.join(' | ')}`);
    assert.equal(snapshot.memory.facts[snapshot.memory.facts.length - 1]!.kind, 'goal');
    assert.equal(snapshot.memory.name, 'Camille', 'the name stopped riding with the snapshot');
    assert.deepEqual(withGoal.brain, full.brain, 'a goal was written into the brain rather than beside it');

    // Three goals, the last three; a repeat is not a second goal; a blank is
    // nothing; and a goal can be taken back.
    let goals = learner();
    for (const text of ['a', 'b', 'A', 'c', 'd', '   ']) goals = withLearnerGoal(goals, text);
    assert.deepEqual(goals.learnerGoals, ['b', 'c', 'd']);
    assert.equal(goals.learnerGoals.length, MAX_LEARNER_GOALS);
    assert.deepEqual(withoutLearnerGoal(goals, 'c').learnerGoals, ['b', 'd']);
    assert.equal(snapshotFor(learner()).memory.facts.length, 0, 'with no goal, nothing is appended');

    // Forget markers never expire by count.
    let many = learner();
    for (let i = 0; i < 85; i += 1) many = withFactForgotten(many, `fact ${i}`);
    assert.equal(many.forgottenFacts.length, 85);
    assert.equal(many.forgottenFacts[0], factKey('fact 0'));
    const fresh = learner();
    assert.equal(withFactForgotten(fresh, '   '), fresh, 'a blank forgets nothing');
  });

  test('version seven upgrades to eight with empty tombstones and goals, the sync policy writes eight, and a forget on either device survives the merge', () => {
    // The title is pinned by the ledger (F563) and keeps its wording. The profile
    // moved to version 9 with F730 (a twenty-minute goal), so a v7 blob now
    // arrives at 9 and the policy writes 9; what this test guards is unchanged.
    // F563. The chain first: a v7 blob arrives at the current version with both
    // lists empty, because nothing that happened before the field existed is a forget.
    const v7 = { ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW), version: 7 } as Record<string, unknown>;
    delete v7.forgottenFacts;
    delete v7.learnerGoals;
    const up = upgradeStored(v7, NOW);
    assert.ok(up);
    assert.equal(up.version, 9);
    assert.deepEqual(up.forgottenFacts, []);
    assert.deepEqual(up.learnerGoals, []);

    // The policy writes what the store writes, read off the store's own type
    // rather than a number typed here.
    const policy = SYNC_POLICIES.find((entry) => entry.namespace === 'profile');
    assert.ok(policy, 'the profile namespace has no sync policy');
    assert.equal(policy.writes, createStoredProfile({ name: null, motivation: null }, NOW).version);
    assert.equal(policy.writes, 9);
    assert.match(policy.rule, /forgotten facts union/, 'the policy table does not say the tombstones union');

    // And the merge, through the real chain: a forget on the quiet phone
    // survives the busy one, whichever side asks.
    const busy = learner([fact('Likes jazz', 'interest')], { brain: { ...createProfile(), stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } } });
    const quiet = withFactForgotten(learner([fact('Has a dog')]), 'Has a dog');
    for (const [a, b] of [[busy, quiet], [quiet, busy]] as const) {
      const merged = policy.merge(a, b, NOW) as StoredProfile;
      assert.ok(typeof merged === 'object' && merged !== null && 'forgottenFacts' in merged, 'the merge declined two readable profiles');
      assert.deepEqual(merged.forgottenFacts, [factKey('Has a dog')], 'the busier device undid the forget');
      assert.equal(merged.version, 9);
    }
  });
});
