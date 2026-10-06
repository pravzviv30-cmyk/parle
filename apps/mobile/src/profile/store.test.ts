/**
 * The profile builders, which are pure even though the store around them is
 * not — AsyncStorage is only ever touched inside `loadProfile` and
 * `saveProfile`, so the three functions that decide what a profile *says*
 * about a learner can be held to it here, under plain node.
 *
 * The one they mostly exist for: from v4 on, a new learner has no date of
 * birth written down anywhere. That is a promise about someone's data, and a
 * promise nothing checks is a comment.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveUser } from '../storage/scope.ts';
import {
  completeProfile,
  createStoredProfile,
  loadProfile,
  saveProfile,
  withDailyGoal,
  withName,
  withPreferTyping,
  withTutorVoice,
  type StoredProfile,
} from './store.ts';

const NOW = Date.parse('2026-08-22T10:00:00Z');

/** A profile as it sits on an upgraded learner's phone. */
function existing(overrides: Partial<StoredProfile> = {}): StoredProfile {
  return {
    ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW),
    ...overrides,
  };
}

describe('a new profile — what the app writes down about someone who just joined', () => {
  test('a learner who joins today has no date of birth on file', () => {
    const profile = createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: 'travel' }, NOW);
    assert.equal(profile.dob, null, 'the product stopped asking for a date, so there is none to keep');
    assert.equal(profile.ageConfirmed, true, 'what they actually told us is that they are old enough');
    assert.equal(profile.version, 9);
    assert.deepEqual(profile.forgottenFacts, [], 'nobody arrives having forgotten anything');
    assert.deepEqual(profile.learnerGoals, [], 'nobody arrives with a goal written');
    assert.equal(profile.preferTyping, false, 'nobody arrives preferring to type; the row in Profile is where that is said');
    assert.equal(profile.ageStopAt, null, 'nobody arrives already stopped');
    assert.equal(
      profile.tutorVoice,
      null,
      'nobody arrives having chosen a voice either, and writing the default here would record a choice they never made',
    );
  });

  test('a learner who skipped the questions is stored as having skipped them', () => {
    const profile = createStoredProfile({ name: null, ageConfirmed: true, motivation: null }, NOW);
    assert.equal(profile.name, null, 'an unnamed learner is unnamed, not an empty string');
    assert.equal(profile.motivation, null, 'a skipped why is null, never a reason invented for them');
    assert.equal(profile.dailyGoalMin, null, 'the goal is asked in Profile now, and until then it is honestly empty');
  });

  test('a learner who never confirmed anything is not recorded as having refused', () => {
    const profile = createStoredProfile({ name: 'Camille', motivation: null }, NOW);
    assert.equal(profile.ageConfirmed, null, 'null is not asked; false would be a denial nobody made');
  });

  test('the date of birth the old flow still collects answers the age question and is then let go', () => {
    // The interim state, and the reason it is safe: while the old onboarding
    // page is still on the tree it hands over a date, which is enough to
    // answer "are you thirteen" — and then nothing writes it down.
    const profile = createStoredProfile({ name: 'Camille', dob: '1999-04-01', motivation: 'work' }, NOW);
    assert.equal(profile.ageConfirmed, true, 'a date over the floor is the learner having answered, in a longer form');
    assert.equal(profile.dob, null, 'answering the question is not a reason to keep the date');
  });

  test('a date that reads young confirms nothing and is still not stored', () => {
    const profile = createStoredProfile({ name: 'Sam', dob: '2020-01-01', motivation: 'school' }, NOW);
    assert.equal(profile.ageConfirmed, null, 'this code never writes a denial on a learner behalf');
    assert.equal(profile.dob, null);
  });
});

describe('an existing profile — what a second pass through onboarding may change', () => {
  test('a learner running onboarding again keeps the date they gave the first time', () => {
    const before = existing({ dob: '1999-04-01' });
    const after = completeProfile(before, { name: 'Cam', motivation: 'travel' }, NOW);
    assert.equal(after.dob, '1999-04-01', 'the new flow stopped asking, which is not the learner withdrawing the answer');
    assert.equal(after.name, 'Cam', 'the questions they did answer are the ones that change');
  });

  test('a learner running onboarding again keeps their brain and their username', () => {
    const before = existing({ username: 'camille.4821', brain: { marker: true } as unknown as StoredProfile['brain'] });
    const after = completeProfile(before, { name: 'Cam', motivation: null }, NOW);
    assert.equal(after.username, 'camille.4821');
    assert.deepEqual(after.brain, { marker: true }, 'what the tutor knows about them is never an onboarding answer');
  });

  test('a confirmation already given is never quietly withdrawn', () => {
    const before = existing({ ageConfirmed: true, dob: null });
    const after = completeProfile(before, { name: 'Cam', motivation: null }, NOW);
    assert.equal(after.ageConfirmed, true, 'they said it once; a later page that does not ask cannot unsay it');
  });
});

describe('the name — one field, one write path — F477', () => {
  test('setting the name changes the name and nothing else', () => {
    // The door exists so the Name sheet stops spreading the whole profile
    // inline while every neighbouring row goes through a helper. A field two
    // places can set is a field that can disagree with itself, which is the
    // same reason tutorVoice.test.ts refuses the spread on the voice sheet.
    const before = existing({ name: 'Camille' });
    const after = withName(before, 'Cam');
    assert.equal(after.name, 'Cam');
    assert.deepEqual({ ...after, name: 'Camille' }, before, 'the name row edits the name, not the learner');
  });

  test('a learner who never gave a name can still be given one', () => {
    // Null is what "skipped the question at sign-up" means, and the door has to
    // be able to answer it later without the caller reaching for a spread.
    const before = existing({ name: null });
    assert.equal(withName(before, 'Cam').name, 'Cam');
    assert.equal(withName(withName(before, 'Cam'), 'Camille').name, 'Camille', 'the last name given is the name');
  });
});

describe('the daily goal — one field, one write path', () => {
  test('setting the daily goal changes the goal and nothing else', () => {
    const before = existing({ dailyGoalMin: null });
    const after = withDailyGoal(before, 15);
    assert.equal(after.dailyGoalMin, 15);
    assert.deepEqual({ ...after, dailyGoalMin: null }, before, 'the goal row edits the goal, not the learner');
  });

  test('a twenty-minute goal survives every profile read', async () => {
    const { upgradeStored } = await import('./upgrade.ts');
    const { dailyGoalOf, goalKeyOf, goalLine, DAILY_GOAL_UNSET } = await import('./dailyGoal.ts');
    const { createSyncPolicy } = await import('../sync/policy.ts');
    const { preferenceClocks } = await import('@luvani/brain/profile/merge');

    const map = new Map<string, string>();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
    shared.setItem = (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    };
    setActiveUser('20202020-2020-4020-8020-202020202020');

    // Intense, chosen through the goal's one door.
    const intense = withDailyGoal(existing({ dailyGoalMin: null }), 20);
    assert.equal(intense.dailyGoalMin, 20);

    // 1. Load: the store's own round trip, the version chain and the repair door.
    assert.equal(await saveProfile(intense), true, 'the profile holding twenty minutes could not be saved');
    const loaded = await loadProfile();
    assert.ok(loaded, 'the profile did not survive its own round trip');
    assert.equal(loaded.dailyGoalMin, 20, 'a saved twenty read back as no goal');
    assert.equal(loaded.version, 9);
    assert.equal(preferenceClocks(loaded).dailyGoalMin?.value, 20, 'the edit lost its clock, so a sync could quietly undo it');

    // 2. Upgrade: a v8 envelope carrying the answer keeps it, and arrives at v9.
    const v8 = { ...(JSON.parse(JSON.stringify(loaded)) as Record<string, unknown>), version: 8 };
    const upgraded = upgradeStored(v8, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 9);
    assert.equal(upgraded.dailyGoalMin, 20, 'the version chain discarded a twenty-minute goal');
    assert.equal(upgradeStored({ ...v8, dailyGoalMin: 15 }, NOW)?.dailyGoalMin, 15, 'an older goal stopped reading');
    assert.equal(upgradeStored({ ...v8, dailyGoalMin: 25 }, NOW)?.dailyGoalMin, null, 'a goal nobody offered read as an answer');

    // 3. Sync: another device with an older, unclocked goal does not undo it, either way round.
    const policy = createSyncPolicy({ now: () => NOW });
    const other = existing({ dailyGoalMin: 10 });
    for (const [local, remote] of [[loaded, other], [other, loaded], [loaded, loaded]] as const) {
      const merged = policy.merge({ namespace: 'profile', local, remote });
      assert.equal(merged.kind, 'merged', 'the profile merge went quiet on a version-9 profile');
      const data = merged.kind === 'merged' ? (merged.data as { dailyGoalMin?: unknown } | null) : null;
      assert.equal(data?.dailyGoalMin, 20, 'a sync merge discarded the twenty-minute goal');
    }

    // 4. The row's readers: twenty minutes, said in words, and never "No target".
    assert.equal(dailyGoalOf(loaded), 20);
    assert.equal(goalLine(loaded), 'Twenty minutes as a flexible routine. Local practice is free; connected tutor time uses live minutes.');
    assert.notEqual(goalLine(loaded), DAILY_GOAL_UNSET);
    assert.equal(goalKeyOf(loaded), null, 'a goal the row has no segment for was marked as No target');
  });
});

describe("the tutor's voice — one field, one write path", () => {
  /** A catalogue voice that is not the default, so a no-op cannot pass as a write. */
  const CHOICE: TutorVoiceKey =
    (Object.keys(TUTOR_VOICES) as TutorVoiceKey[]).find((key) => key !== DEFAULT_TUTOR_VOICE) ?? DEFAULT_TUTOR_VOICE;

  test('choosing a voice changes the voice and nothing else', () => {
    const before = existing({ tutorVoice: null });
    const after = withTutorVoice(before, CHOICE);
    assert.equal(after.tutorVoice, CHOICE);
    assert.deepEqual({ ...after, tutorVoice: null }, before, 'the voice row edits the voice, not the learner');
  });

  test('changing their mind replaces the voice rather than collecting one', () => {
    // The bound, held the way the age stop's is: one key, replaced. A profile
    // field that accumulates is a profile that eventually will not fit in the
    // token the whole learner model is signed into.
    const twice = withTutorVoice(withTutorVoice(existing(), CHOICE), DEFAULT_TUTOR_VOICE);
    assert.equal(twice.tutorVoice, DEFAULT_TUTOR_VOICE, 'the last choice is the choice');
    assert.equal(typeof twice.tutorVoice, 'string', 'and it is still one key, not a list of them');
  });

  test('a second pass through onboarding does not take their voice away', () => {
    // Onboarding never asks about the voice, so it cannot answer for them.
    // This is the same rule the username and the brain already ride on.
    const before = existing({ tutorVoice: CHOICE });
    const after = completeProfile(before, { name: 'Cam', motivation: 'travel' }, NOW);
    assert.equal(after.tutorVoice, CHOICE, 'a flow that does not ask about the voice cannot unpick it');
  });
});

describe('preferring typing — one field, one write path', () => {
  /** One in-memory AsyncStorage, so the round trip is the real store's. */
  function installDisk(): void {
    const map = new Map<string, string>();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
    shared.setItem = (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    };
    shared.removeItem = (key: string): Promise<void> => {
      map.delete(key);
      return Promise.resolve();
    };
  }

  test('preferring typing changes that and nothing else, and survives the store\'s round trip — F370', async () => {
    setActiveUser('77777777-7777-4777-8777-777777777777');
    // A new learner has not said how they like to answer, so the circle is
    // the way in. The door flips one boolean and touches nothing else.
    const before = existing();
    assert.equal(before.preferTyping, false, 'a new profile arrives preferring to type, which nobody said');
    const typing = withPreferTyping(before, true);
    assert.equal(typing.preferTyping, true);
    assert.deepEqual({ ...typing, preferTyping: false }, before, 'the switch edits the preference, not the learner');
    assert.equal(withPreferTyping(typing, false).preferTyping, false, 'the switch cannot be turned back off');

    // And the store keeps it, through the same door the app reads on every
    // launch: the version chain and repairProfile both run on the way out.
    installDisk();
    setActiveUser('77777777-7777-4777-8777-777777777777');
    await saveProfile(typing);
    const reloaded = await loadProfile();
    assert.ok(reloaded, 'the profile did not survive its own round trip');
    assert.equal(reloaded.preferTyping, true, 'the preference reset itself on the next launch');
    assert.equal(reloaded.version, 9);
    assert.equal(reloaded.name, 'Camille', 'and the learner kept everything else');

    await saveProfile(withPreferTyping(reloaded, false));
    const again = await loadProfile();
    assert.ok(again);
    assert.equal(again.preferTyping, false, 'turning it back off was lost');
  });
});
