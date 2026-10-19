import { test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeStoredProfiles, preferenceClocks } from '@luvani/brain/profile/merge';
import { setActiveUser } from '../storage/scope.ts';
import { createStoredProfile, loadProfile, saveProfile, saveMemoryChange, withName } from '../profile/store.ts';
import { upgradeStored } from '../profile/upgrade.ts';
import { profileFromDraft } from './createFromDraft.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { needsAccountName } from './accountName.ts';

function disk(owner: string) {
  setActiveUser(owner);
  const values = new Map<string, string>();
  const storage = AsyncStorage as unknown as Record<string, unknown>;
  storage.getItem = async (key: string) => values.get(key) ?? null;
  const write = async (key: string, value: string) => { values.set(key, value); };
  storage.setItem = write;
  return { storage, write };
}
const emptyLegacy = () => createStoredProfile({ name: null, ageConfirmed: true, motivation: 'trip' }, 1000);

test('cold email verification and a first OAuth session retain the required new-profile name question without an in-memory signup flag', async () => {
  for (const entry of ['email-verified-cold-launch', 'oauth-first-profile']) {
    disk(entry);
    const built = profileFromDraft({ ...freshPreAccountDraft(), ageConfirmed: true }, 1000);
    assert.equal(built.namePromptPending, true);
    assert.equal(await saveProfile(built), true);
    const cold = await loadProfile();
    assert.ok(cold);
    assert.equal(cold.namePromptPending, true);
    assert.equal(needsAccountName(false, cold.name, cold.namePromptPending), true,
      'the resumed account has no AuthProvider.newAccountUserId and must still answer its pending question');
  }
});

test('legacy unnamed profiles and a new profile with a supplied name never get the new question', async () => {
  for (const before of [emptyLegacy(), profileFromDraft({ ...freshPreAccountDraft(), firstName: 'Camille' }, 1000)]) {
    disk('name-prompt-legacy-or-named');
    assert.equal(before.namePromptPending, undefined);
    assert.equal(await saveProfile(before), true);
    const cold = await loadProfile();
    assert.ok(cold);
    assert.equal(needsAccountName(false, cold.name, cold.namePromptPending), false);
  }
  for (const bad of [undefined, null, 'true', 1, [], {}]) {
    assert.equal(upgradeStored({ ...emptyLegacy(), namePromptPending: bad })?.namePromptPending, undefined);
  }
  assert.equal(upgradeStored({ ...emptyLegacy(), namePromptPending: true })?.namePromptPending, true);
  assert.equal(upgradeStored({ ...emptyLegacy(), namePromptPending: false })?.namePromptPending, false);
  assert.equal(upgradeStored({ ...emptyLegacy(), name: 'Camille', namePromptPending: true })?.namePromptPending, false);
});

test('failed name persistence keeps the pending question and retry durably clears it with the existing name clock', async () => {
  const { storage, write } = disk('pending-name-failure');
  const built = profileFromDraft(freshPreAccountDraft(), 1000);
  assert.equal(await saveProfile(built), true);
  storage.setItem = async () => { throw new Error('disk unavailable'); };
  assert.equal(await saveMemoryChange(current => withName(current, 'Amélie')), null);
  const failed = await loadProfile();
  assert.equal(failed?.name, null);
  assert.equal(failed?.namePromptPending, true);
  assert.equal(needsAccountName(false, failed?.name, failed?.namePromptPending), true);
  storage.setItem = write;
  const saved = await saveMemoryChange(current => withName(current, 'Amélie'));
  assert.ok(saved);
  assert.equal(saved.namePromptPending, false);
  assert.equal(preferenceClocks(saved).name?.value, 'Amélie');
  const cold = await loadProfile();
  assert.equal(cold?.name, 'Amélie');
  assert.equal(cold?.namePromptPending, false);
  assert.equal(needsAccountName(false, cold?.name, cold?.namePromptPending), false);
});

test('stale recap writes and both sync merge orders preserve a pending question while a completed name cannot reopen it', async () => {
  disk('pending-name-stale-writes');
  const pending = profileFromDraft(freshPreAccountDraft(), 1000);
  const old = emptyLegacy();
  old.brain.stats.sessions = 30;
  assert.equal(await saveProfile(pending), true);
  assert.equal(await saveProfile(old), true);
  assert.equal((await loadProfile())?.namePromptPending, true, 'an old whole-profile snapshot is not an answer');
  const merge = (a: unknown, b: unknown) => mergeStoredProfiles({ stored: a, savedAt: 100 }, { stored: b, savedAt: 200 }, { upgrade: upgradeStored, now: 3000 });
  for (const [a, b] of [[old, pending], [pending, old]]) {
    const folded = merge(a, b);
    assert.equal(folded?.namePromptPending, true);
    assert.equal(folded?.brain.stats.sessions, 30, 'pending UI state must not change earned evidence ownership');
  }
  const named = await saveMemoryChange(current => withName(current, 'Camille'));
  assert.ok(named);
  assert.equal(await saveProfile(pending), true);
  const cold = await loadProfile();
  assert.equal(cold?.name, 'Camille');
  assert.equal(cold?.namePromptPending, false, 'a stale pending snapshot cannot reopen a completed name ask');
  for (const [a, b] of [[named, pending], [pending, named]]) {
    const folded = merge(a, b);
    assert.equal(folded?.name, 'Camille');
    assert.equal(folded?.namePromptPending, false);
  }
});
