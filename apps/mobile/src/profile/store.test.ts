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

import { completeProfile, createStoredProfile, withDailyGoal, withTutorVoice, type StoredProfile } from './store.ts';

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
    assert.equal(profile.version, 6);
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

describe('the daily goal — one field, one write path', () => {
  test('setting the daily goal changes the goal and nothing else', () => {
    const before = existing({ dailyGoalMin: null });
    const after = withDailyGoal(before, 15);
    assert.equal(after.dailyGoalMin, 15);
    assert.deepEqual({ ...after, dailyGoalMin: null }, before, 'the goal row edits the goal, not the learner');
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
