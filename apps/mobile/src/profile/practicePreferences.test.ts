import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeStoredProfiles, preferenceClocks } from '@luvani/brain/profile/merge';
import { setActiveUser, userKey, clearActiveUserData } from '../storage/scope.ts';
import { adopterFor } from '../sync/registry.ts';
import { createStoredProfile, loadProfile, saveProfile, saveMemoryChange, withName, type StoredProfile } from './store.ts';
import { upgradeStored } from './upgrade.ts';
import { practicePreferencesOf, storedPracticePreferences } from './practicePreferences.ts';

const answers = { level: 'getby', confidence: 'hesitant', focus: 'listening' } as const;
const empty = { level: null, confidence: null, focus: null };
const fresh = (): StoredProfile => createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'trip' }, 1000);

function disk(owner: string): Map<string, string> {
  setActiveUser(owner);
  const values = new Map<string, string>();
  const storage = AsyncStorage as unknown as Record<string, unknown>;
  storage.getItem = async (key: string) => values.get(key) ?? null;
  storage.setItem = async (key: string, value: string) => { values.set(key, value); };
  storage.multiRemove = async (keys: string[]) => { keys.forEach(key => values.delete(key)); };
  return values;
}

test('all four self-described starting points stay distinct from earned CEFR', () => {
  for (const level of ['zero', 'few', 'getby', 'confident'] as const) {
    const before = fresh();
    const profile = { ...before, practicePreferences: storedPracticePreferences({ ...answers, level }) };
    assert.equal(practicePreferencesOf(profile).level, level);
    assert.deepEqual(profile.brain.cefr, before.brain.cefr);
  }
});

test('malformed fields are discarded independently with no invented preference', () => {
  assert.deepEqual(storedPracticePreferences({ ...answers, confidence: 'fluent', transcript: 'private' }), {
    level: 'getby', confidence: null, focus: 'listening',
  });
  for (const value of [null, undefined, [], 'confident', { level: 'B2', focus: 123 }, { ...empty, extra: 'anything' }]) {
    assert.equal(storedPracticePreferences(value), undefined);
  }
  assert.deepEqual(practicePreferencesOf(null), empty);
  assert.deepEqual(practicePreferencesOf({ practicePreferences: { level: 'confident' } }), {
    level: 'confident', confidence: null, focus: null,
  });
});

test('legacy profile upgrades keep the account and earned brain without re-onboarding', () => {
  for (const version of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const before = { ...fresh(), version };
    const upgraded = upgradeStored(before, 2000);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 9);
    assert.deepEqual(upgraded.brain, before.brain);
    assert.equal(upgraded.practicePreferences, undefined);
    assert.deepEqual(practicePreferencesOf(upgraded), empty);
  }
});

test('upgrade keeps only bounded practice choices and drops unknown fields', () => {
  const upgraded = upgradeStored({ ...fresh(), practicePreferences: { ...answers, other: 'unbounded' } });
  assert.deepEqual(upgraded?.practicePreferences, answers);
  assert.equal(upgradeStored({ ...fresh(), practicePreferences: ['confident'] })?.practicePreferences, undefined);
});

test('an answered onboarding preference survives a heavier legacy device and both merge orders', () => {
  const old = fresh();
  old.brain.stats.sessions = 30;
  const chosen = { ...fresh(), practicePreferences: answers };
  for (const [local, remote] of [[old, chosen], [chosen, old]] as const) {
    const result = mergeStoredProfiles({ stored: local, savedAt: 100 }, { stored: remote, savedAt: 200 }, { upgrade: upgradeStored, now: 3000 });
    assert.deepEqual(result?.practicePreferences, answers);
    assert.equal(result?.brain.stats.sessions, 30);
  }
});

test('conflicting real choices use the existing deterministic answer merge', () => {
  const a = { ...fresh(), practicePreferences: answers };
  const b = { ...fresh(), practicePreferences: { level: 'confident', confidence: 'comfortable', focus: 'speaking' } };
  const merge = (local: unknown, remote: unknown) => mergeStoredProfiles(
    { stored: local, savedAt: 100 }, { stored: remote, savedAt: 100 }, { upgrade: upgradeStored, now: 3000 },
  );
  assert.deepEqual(merge(a, b)?.practicePreferences, merge(b, a)?.practicePreferences);
});

test('cold load, stale profile save, sync adoption and account reset retain the correct choices', async () => {
  const values = disk('practice-preferences-one');
  const before = fresh();
  assert.equal(await saveProfile({ ...before, practicePreferences: answers }), true);
  assert.deepEqual(practicePreferencesOf(await loadProfile()), answers);
  // A whole-profile save captured before onboarding completed is not a clear action.
  assert.equal(await saveProfile(before), true);
  assert.deepEqual(practicePreferencesOf(await loadProfile()), answers);
  const adopt = adopterFor('profile');
  assert.ok(adopt);
  await adopt(current => mergeStoredProfiles({ stored: current, savedAt: 100 }, { stored: fresh(), savedAt: 200 }, { upgrade: upgradeStored, now: 3000 }));
  assert.deepEqual(practicePreferencesOf(await loadProfile()), answers);
  const firstKey = userKey('profile');
  setActiveUser('practice-preferences-two');
  assert.equal(await loadProfile(), null);
  assert.equal(await saveProfile(fresh()), true);
  assert.deepEqual(practicePreferencesOf(await loadProfile()), empty);
  setActiveUser('practice-preferences-one');
  await clearActiveUserData({ sweepAudio: () => ({ removed: 0, failed: 0 }) });
  assert.equal(values.has(firstKey), false);
  assert.equal(await loadProfile(), null);
});

test('the post-verification name write durably materializes its existing preference clock', async () => {
  disk('verified-name-clock');
  const before = { ...fresh(), practicePreferences: answers };
  assert.equal(await saveProfile(before), true);
  const saved = await saveMemoryChange(current => withName(current, 'Praveen'));
  assert.ok(saved);
  assert.equal(saved.name, 'Praveen');
  assert.equal(preferenceClocks(saved).name?.value, 'Praveen');
  assert.ok((preferenceClocks(saved).name?.counter ?? 0) > 0);
  const cold = await loadProfile();
  assert.equal(cold?.name, 'Praveen');
  assert.deepEqual(cold?.preferenceClocks, saved.preferenceClocks);
  assert.deepEqual(cold?.practicePreferences, answers);
  assert.deepEqual(cold?.brain, before.brain);
});

test('withStatedLevel moves only the level, keeps confidence and focus, and creates the object when absent', async () => {
  const { withStatedLevel } = await import('./store.ts');
  const base: StoredProfile = { ...fresh(), practicePreferences: { ...answers } };
  const next = withStatedLevel(base, 'few');
  assert.deepEqual(next.practicePreferences, { level: 'few', confidence: 'hesitant', focus: 'listening' });
  assert.deepEqual(base.practicePreferences, answers);
  const bare = fresh(); delete bare.practicePreferences;
  assert.deepEqual(withStatedLevel(bare, 'confident').practicePreferences, { level: 'confident', confidence: null, focus: null });
  assert.throws(() => withStatedLevel(base, 'fluent' as never));
});

test('the parser rejects stated levels outside the closed four', () => {
  assert.equal(storedPracticePreferences({ level: 'fluent' }), undefined);
  assert.deepEqual(storedPracticePreferences({ level: 'C2', confidence: 'hesitant' }), { level: null, confidence: 'hesitant', focus: null });
});

test('changing the stated level leaves every earned-ability input untouched', async () => {
  const { withStatedLevel } = await import('./store.ts');
  const base: StoredProfile = { ...fresh(), practicePreferences: { ...answers } };
  const before = structuredClone(base.brain);
  for (const level of ['zero', 'few', 'getby', 'confident'] as const) {
    const next = withStatedLevel(base, level);
    assert.deepEqual(next.brain, before, 'cefr, stats and preferences stay as earned');
    const { practicePreferences: _a, ...restNext } = next;
    const { practicePreferences: _b, ...restBase } = base;
    assert.deepEqual(restNext, restBase);
  }
});

test('a stated-level edit carries sibling setting edits and survives merge with an older remote copy that never answered', async () => {
  const { withStatedLevel, withDailyGoal, carryPreferenceEdits } = await import('./store.ts');
  disk('stated-level');
  const base: StoredProfile = { ...fresh(), practicePreferences: { ...answers } };
  assert.equal(await saveProfile(base), true);
  const edited = withStatedLevel(withDailyGoal(base, 20), 'confident');
  assert.equal(carryPreferenceEdits(edited, { ...edited }).dailyGoalMin, 20);
  assert.equal(await saveProfile(edited), true);
  const saved = await loadProfile();
  assert.equal(saved?.practicePreferences?.level, 'confident');
  assert.equal(saved?.dailyGoalMin, 20);
  const remote = { ...base, practicePreferences: { ...answers, level: null } };
  const merged = mergeStoredProfiles({ stored: saved, savedAt: 300 }, { stored: remote, savedAt: 100 }, { upgrade: upgradeStored, now: 3000 });
  assert.equal((merged?.practicePreferences as { level: string })?.level, 'confident');
});

test('stated-level copy matches the onboarding titles verbatim', async () => {
  const { STATED_LEVEL_OPTIONS, STATED_LEVEL_FOOTER } = await import('./practicePreferences.ts');
  const { START_LEVELS } = await import('../onboarding/plan.ts');
  assert.deepEqual(STATED_LEVEL_OPTIONS.map((o) => [o.key, o.title]), START_LEVELS.map((o) => [o.key, o.title]));
  assert.equal(STATED_LEVEL_FOOTER, 'Changes the conversations we suggest next. Your earned level stays as it is.');
});

test('a newer stated-level edit records a clock and beats an older remote level in both merge directions', async () => {
  const { withStatedLevel, withDailyGoal } = await import('./store.ts');
  disk('stated-level-clock');
  const base: StoredProfile = { ...fresh(), practicePreferences: { ...answers } };
  assert.equal(await saveProfile(base), true);
  // An older edit made elsewhere on a busier device.
  const busy = structuredClone(base);
  busy.brain.stats.sessions = 50; busy.brain.stats.totalTurns = 150;
  busy.practicePreferences = { ...answers, level: 'few' };
  busy.preferenceClocks = { statedLevel: { counter: 1, mutationId: '00000000-0000-4000-8000-000000000001', value: 'few' } };
  // The local edit, composed with a sibling setting through carryPreferenceEdits.
  assert.equal(await saveProfile(withStatedLevel(withDailyGoal(base, 20), 'confident')), true);
  const saved = (await loadProfile())!;
  assert.equal(preferenceClocks(saved).statedLevel?.value, 'confident');
  assert.ok(preferenceClocks(saved).dailyGoalMin);
  // Saved after observing the remote clock, so its counter is newer.
  await adopterFor('profile')!(current => mergeStoredProfiles({ stored: current, savedAt: 100 }, { stored: busy, savedAt: 200 }, { upgrade: upgradeStored, now: 3000 }));
  const saved2Base = (await loadProfile())!;
  const reedit = withStatedLevel(saved2Base, 'zero');
  assert.equal(await saveProfile(reedit), true);
  const local = (await loadProfile())!;
  for (const merged of [
    mergeStoredProfiles({ stored: local, savedAt: 100 }, { stored: busy, savedAt: 200 }, { upgrade: upgradeStored, now: 3000 }),
    mergeStoredProfiles({ stored: busy, savedAt: 200 }, { stored: local, savedAt: 100 }, { upgrade: upgradeStored, now: 3000 }),
  ]) {
    assert.deepEqual(merged?.practicePreferences, { level: 'zero', confidence: 'hesitant', focus: 'listening' });
    assert.equal(merged?.brain.stats.sessions, 50);
  }
});
