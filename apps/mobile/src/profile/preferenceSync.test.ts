import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREFERENCE_FIELDS, preferenceClocks, preferenceValue, newPreferenceClock, maxPreferenceCounter, mergeStoredProfiles } from '@luvani/brain/profile/merge';
import { setActiveUser, userKey } from '../storage/scope.ts';
import { adopterFor } from '../sync/registry.ts';
import { withStrictness } from '../tutor/strictness.ts';
import { withPace } from '../tutor/pace.ts';
import { upgradeStored } from './upgrade.ts';
import { carryPreferenceEdits, createStoredProfile, completeProfile, loadProfile, saveProfile, withDailyGoal, withTutorVoice, withPreferTyping, withName, withUsername, withStatedLevel, withOnboardingGoal, type StoredProfile } from './store.ts';

function disk(owner: string): Map<string, string> {
  setActiveUser(owner);
  const values = new Map<string, string>();
  const storage = AsyncStorage as unknown as Record<string, unknown>;
  storage.getItem = async (key: string) => values.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { values.set(key, value); };
  storage.removeItem = async (key: string) => { values.delete(key); };
  return values;
}
const fresh = () => createStoredProfile({ name: 'Before', ageConfirmed: true, motivation: null, dailyGoalMin: 10 }, 100);
const id = '00000000-0000-4000-8000-000000000100';

test('the real nine settings doors persist causal metadata through upgrade, cold load, save and remote adoption', async () => {
  disk('preference-seven');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const updated = withOnboardingGoal(withStatedLevel(withPace(withStrictness(withUsername(withName(withPreferTyping(withTutorVoice(withDailyGoal(original, null), 'marie'), true), 'After'), 'after.1234'), 'flow'), 'slow'), 'getby'), 'food');
  assert.equal(await saveProfile(updated), true);
  const saved = await loadProfile();
  assert.ok(saved);
  const clocks = preferenceClocks(saved);
  assert.equal(Object.keys(clocks).length, 9);
  for (const field of PREFERENCE_FIELDS) assert.equal(clocks[field]?.value, preferenceValue(saved, field));
  assert.equal(maxPreferenceCounter(saved), 9);
  assert.equal(saved.dob, original.dob);
  assert.equal(saved.ageConfirmed, original.ageConfirmed);
  assert.equal(saved.ageStopAt, original.ageStopAt);
  assert.deepEqual(saved.brain.cefr, original.brain.cefr);
  assert.deepEqual(saved.brain.stats, original.brain.stats);
  assert.deepEqual(upgradeStored(saved)?.preferenceClocks, clocks);
  assert.equal(await saveProfile(saved), true);
  assert.deepEqual((await loadProfile())?.preferenceClocks, clocks, 'plain saves cannot invent edits');
  const adopter = adopterFor('profile');
  assert.ok(adopter);
  assert.equal(await adopter(() => saved), 'adopted');
  assert.deepEqual((await loadProfile())?.preferenceClocks, clocks, 'remote adoption cannot advance clocks');
  assert.equal(await saveProfile(updated), true);
  assert.deepEqual((await loadProfile())?.preferenceClocks, clocks, 'same local object retry cannot invent another edit');
});

test('newer remote settings survive stale recap writes while the new learning still lands', async () => {
  disk('preference-recap');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  assert.equal(await saveProfile(withPace(withStrictness(withDailyGoal(withPreferTyping(original, true), null), 'strict'), 'slow')), true);
  const before = await loadProfile();
  assert.ok(before);
  const recap = { ...original, brain: { ...original.brain, stats: { ...original.brain.stats, sessions: 50, totalTurns: 200 } } };
  assert.equal(await saveProfile(recap), true);
  const after = await loadProfile();
  assert.ok(after);
  assert.equal(after.dailyGoalMin, null);
  assert.equal(after.preferTyping, true);
  assert.equal(after.brain.preferences.strictness, 'strict');
  assert.equal(after.brain.preferences.pace, 'slow');
  assert.equal(after.brain.stats.sessions, 50);
  assert.deepEqual(after.preferenceClocks, before.preferenceClocks);
});

test('a queued local edit advances after maximum observed remote counter, even from another field', async () => {
  const values = disk('preference-queue');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const remote = { ...original, name: 'Remote', preferenceClocks: { name: newPreferenceClock({ ...original, name: 'Remote' }, 'name', id, 100) } };
  const adopter = adopterFor('profile');
  assert.ok(adopter);
  const adoption = adopter((held) => mergeStoredProfiles({ stored: held, savedAt: 0 }, { stored: remote, savedAt: 0 }, { upgrade: upgradeStored, now: 100 }));
  const edit = saveProfile(withStrictness(original, 'strict'));
  assert.equal(await adoption, 'adopted');
  assert.equal(await edit, true);
  const after = await loadProfile();
  assert.ok(after);
  assert.equal(after.name, 'Remote');
  assert.equal(after.preferenceClocks?.strictness?.counter, 102);
  assert.equal(after.preferenceClocks?.name?.counter, 101);
  assert.ok(values.get(userKey('profile')));
});

test('editing the highest-clock field still remembers its observed counter when the old value binding is replaced', async () => {
  disk('preference-replaced-binding');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const observed = { ...original, name: 'Observed', preferenceClocks: { name: newPreferenceClock({ ...original, name: 'Observed' }, 'name', id, 100) } };
  // The edit's in-memory source has observed a remote clock which the current
  // disk has not adopted yet. Changing the value invalidates that old binding
  // but cannot erase the causal observation.
  assert.equal(await saveProfile(withName(observed, 'After observed')), true);
  assert.equal((await loadProfile())?.preferenceClocks?.name?.counter, 102);
});

test('a refused write retries the same mutation, and rapid queued edits cannot lose an unrelated setting', async () => {
  const values = disk('preference-retry');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const edited = withName(original, 'Changed');
  const storage = AsyncStorage as unknown as Record<string, unknown>;
  let rejected: StoredProfile | undefined;
  storage.setItem = async (_key: string, json: string) => { rejected = JSON.parse(json); throw new Error('synthetic refusal'); };
  assert.equal(await saveProfile(edited), false);
  assert.ok(rejected?.preferenceClocks?.name);
  storage.setItem = async (key: string, json: string) => { values.set(key, json); };
  assert.equal(await saveProfile(edited), true);
  assert.deepEqual((await loadProfile())?.preferenceClocks?.name, rejected.preferenceClocks.name);
  const first = saveProfile(withDailyGoal(original, 5));
  const second = saveProfile(withTutorVoice(original, 'marie'));
  assert.equal(await first, true);
  assert.equal(await second, true);
  const after = await loadProfile();
  assert.ok(after);
  assert.equal(after.name, 'Changed');
  assert.equal(after.dailyGoalMin, 5);
  assert.equal(after.tutorVoice, 'marie');
  assert.equal(after.preferenceClocks?.tutorVoice?.counter, 3);
});

test('local edit intent is account/generation bound and cannot stamp the next account or an ABA reset', async () => {
  const values = disk('preference-owner-a');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const stale = withName(original, 'Private name');
  setActiveUser('preference-owner-b');
  assert.equal(await saveProfile(stale), false);
  assert.equal(values.has(userKey('profile')), false);
  setActiveUser('preference-owner-a');
  assert.equal(await saveProfile(stale), false, 'same account after switch is still another generation');
  assert.equal((await loadProfile())?.name, 'Before');
});

test('composed pending intent cannot be transferred to different wording or from pre-auth into an account', async () => {
  disk('preference-intent-value');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const changed = withName(original, 'Requested');
  const rewritten = carryPreferenceEdits(changed, { ...changed, name: 'Not requested' });
  assert.equal(await saveProfile(rewritten), false);
  assert.equal((await loadProfile())?.name, 'Before');
  setActiveUser(null);
  const unbound = withName(original, 'Before sign-in');
  setActiveUser('preference-intent-value');
  assert.equal(await saveProfile(unbound), false);
  assert.equal((await loadProfile())?.name, 'Before');
});

test('onboarding completion carries genuine name/goal edits through age confirmation without creating age clocks', async () => {
  disk('preference-onboarding');
  const original = fresh();
  assert.equal(await saveProfile(original), true);
  const updated = completeProfile(original, { name: 'Completed', ageConfirmed: true, motivation: 'travel', dailyGoalMin: 15 }, 200);
  assert.equal(await saveProfile(updated), true);
  const saved = await loadProfile();
  assert.ok(saved);
  assert.deepEqual(Object.keys(preferenceClocks(saved)).sort(), ['dailyGoalMin', 'name']);
  assert.equal(saved.name, 'Completed');
  assert.equal(saved.dailyGoalMin, 15);
  const planted = { ...saved, name: 'Other', preferenceClocks: { ...saved.preferenceClocks, dob: { counter: 900, mutationId: id, value: null } } };
  assert.equal(upgradeStored(planted)?.preferenceClocks?.name, undefined, 'clock cannot be transferred to different wording');
  assert.equal('dob' in (upgradeStored(planted)?.preferenceClocks ?? {}), false);
});

test('a goal edit carries its own clock on save, and the newer goal or clear wins a two-device merge', async () => {
  disk('preference-goal');
  const moving = { ...fresh(), onboardingGoal: 'moving' };
  assert.equal(await saveProfile(moving), true);
  assert.equal(await saveProfile(withOnboardingGoal(moving, 'food')), true);
  const saved = await loadProfile();
  assert.ok(saved);
  assert.equal(saved.onboardingGoal, 'food');
  assert.equal(saved.preferenceClocks?.onboardingGoal?.value, 'food');
  assert.equal(saved.preferenceClocks?.onboardingGoal?.counter, 1);

  // The other phone, busier, chose 'moving' first; this phone later changed or cleared it.
  const busy = { ...moving, brain: { ...moving.brain, stats: { ...moving.brain.stats, sessions: 40 } } };
  const older = { ...busy, preferenceClocks: { onboardingGoal: newPreferenceClock(busy, 'onboardingGoal', id, 0) } };
  const at = (goal: 'food' | null) => {
    const next = { ...moving, onboardingGoal: goal };
    return { ...next, preferenceClocks: { onboardingGoal: newPreferenceClock(next, 'onboardingGoal', '00000000-0000-4000-8000-000000000200', 1) } };
  };
  for (const goal of [null, 'food'] as const) {
    for (const [a, b] of [[older, at(goal)], [at(goal), older]]) {
      const result = mergeStoredProfiles({ stored: a, savedAt: 0 }, { stored: b, savedAt: 0 }, { upgrade: upgradeStored, now: 100 });
      assert.ok(result);
      assert.equal(result.onboardingGoal, goal, `newer ${String(goal)} beats older moving`);
      assert.equal(result.brain.stats.sessions, 40, 'the busier learning still lands');
    }
  }
});
