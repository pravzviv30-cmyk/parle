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
