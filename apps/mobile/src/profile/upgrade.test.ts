import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TUTOR_VOICE, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';

import { upgradeStored } from './upgrade.ts';

const NOW = Date.parse('2026-08-19T10:00:00Z');

/** Old enough on any clock this suite uses. */
const ADULT_DOB = '1999-04-01';
/** Too young on any clock this suite uses. */
const CHILD_DOB = '2020-01-01';

/**
 * Every branch that can carry a date of birth, shaped the way that version
 * shipped, with what each should say about the learner's age afterwards.
 *
 * v2 and v3 derive the confirmation from the date. v4 records already went
 * through that derivation at the hop, so what is on their disk is the answer —
 * including the fourth entry, a denial no version of this app has ever
 * written, which must not be handed back as one.
 */
function branchesCarrying(dob: string, adult: boolean): { name: string; blob: Record<string, unknown>; confirmed: true | null }[] {
  const derived = adult ? true : null;
  return [
    {
      name: 'v2',
      blob: { version: 2, name: 'Camille', dob, motivation: 'work', dailyGoalMin: 15, onboardedAt: 456, brain: {} },
      confirmed: derived,
    },
    {
      name: 'v3',
      blob: { version: 3, name: 'Camille', dob, motivation: 'work', dailyGoalMin: 5, onboardedAt: 789, username: 'camille.4821', brain: {} },
      confirmed: derived,
    },
    {
      name: 'v4 as the hop left it',
      blob: { version: 4, name: 'Camille', dob, ageConfirmed: derived, motivation: 'work', dailyGoalMin: null, onboardedAt: 789, username: null, brain: {} },
      confirmed: derived,
    },
    {
      name: 'v4 carrying a denial nothing wrote',
      blob: { version: 4, name: 'Camille', dob, ageConfirmed: false, motivation: 'work', dailyGoalMin: null, onboardedAt: 789, username: null, brain: {} },
      confirmed: null,
    },
  ];
}


/** Every catalogue key, so no test here hardcodes a list core owns. */
const VOICES = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

/**
 * A catalogue voice that is not the default.
 *
 * Every voice assertion below is planted with this rather than with `luc`,
 * because the default is what a dropped voice *resolves to* at the agent. A
 * fixture that chose the default would pass whether the chain kept the choice
 * or threw it away, which is the one thing these three tests exist to tell
 * apart.
 */
const OTHER_VOICE: TutorVoiceKey = VOICES.find((key) => key !== DEFAULT_TUTOR_VOICE) ?? DEFAULT_TUTOR_VOICE;

/** A profile as version 6 writes it, with whatever the caller wants in the voice slot. */
function v6(tutorVoice: unknown): Record<string, unknown> {
  return {
    version: 6,
    name: 'Camille',
    dob: null,
    ageConfirmed: true,
    ageStopAt: null,
    tutorVoice,
    motivation: 'travel',
    dailyGoalMin: 10,
    onboardedAt: 456,
    username: 'camille.4821',
    brain: { seen: 6 },
  };
}

/** One blob per version below 6, each shaped the way that version shipped. */
function everyOlderVersion(tutorVoice: unknown): Record<string, unknown>[] {
  return [
    { version: 1, motivation: 'travel', onboardedAt: 123, brain: {}, tutorVoice },
    { version: 2, name: 'Camille', dob: ADULT_DOB, motivation: 'work', dailyGoalMin: 15, onboardedAt: 456, brain: {}, tutorVoice },
    { version: 3, name: 'Camille', dob: ADULT_DOB, motivation: 'work', dailyGoalMin: 5, onboardedAt: 789, username: 'camille.4821', brain: {}, tutorVoice },
    { version: 4, name: 'Camille', dob: null, ageConfirmed: true, motivation: null, dailyGoalMin: null, onboardedAt: 789, username: null, brain: {}, tutorVoice },
    { version: 5, name: 'Camille', dob: null, ageConfirmed: true, ageStopAt: null, motivation: null, dailyGoalMin: null, onboardedAt: 789, username: null, brain: {}, tutorVoice },
  ];
}

describe('the profile version chain', () => {
  test('a v1 profile still reaches the latest version in one pass, brain intact', () => {
    const upgraded = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 123, brain: { seen: 1 } }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 8, 'the chain runs direct to the latest version, never a step at a time');
    assert.equal(upgraded.name, null, 'v1 never asked for a name');
    assert.equal(upgraded.dob, null);
    assert.equal(upgraded.ageConfirmed, null, 'v1 never asked about age either, so nothing is claimed on the learner behalf');
    assert.equal(upgraded.motivation, 'travel');
    assert.equal(upgraded.dailyGoalMin, 10);
    assert.equal(upgraded.onboardedAt, 123);
    assert.equal(upgraded.username, null, 'the username is claimed later, not invented here');
    assert.deepEqual(upgraded.brain, { seen: 1 }, 'the brain passes through untouched for the door to repair');
  });

  test('a v1 profile missing its fields gets the old defaults', () => {
    const upgraded = upgradeStored({ version: 1 }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.motivation, 'want');
    assert.equal(upgraded.onboardedAt, NOW);
  });

  test('a v2 profile keeps every answer it ever gave', () => {
    const v2 = {
      version: 2,
      name: 'Camille',
      dob: ADULT_DOB,
      motivation: 'work',
      dailyGoalMin: 15,
      onboardedAt: 456,
      brain: { seen: 2 },
    };
    const upgraded = upgradeStored(v2, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 8);
    assert.equal(upgraded.name, 'Camille');
    assert.equal(upgraded.dob, ADULT_DOB, 'the date they typed is theirs and stays');
    assert.equal(upgraded.motivation, 'work');
    assert.equal(upgraded.dailyGoalMin, 15);
    assert.equal(upgraded.onboardedAt, 456);
    assert.equal(upgraded.username, null);
    assert.deepEqual(upgraded.brain, { seen: 2 });
  });

  test('a v3 profile passes through with its username intact', () => {
    const v3 = {
      version: 3,
      name: 'Camille',
      dob: ADULT_DOB,
      motivation: 'work',
      dailyGoalMin: 5,
      onboardedAt: 789,
      username: 'camille.4821',
      brain: {},
    };
    const upgraded = upgradeStored(v3, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 8);
    assert.equal(upgraded.username, 'camille.4821');
    assert.equal(upgraded.name, 'Camille');
  });

  test('a v3 profile with an adult dob arrives at v4 already age-confirmed', () => {
    const upgraded = upgradeStored(
      { version: 3, name: 'Camille', dob: ADULT_DOB, motivation: 'work', dailyGoalMin: 5, onboardedAt: 789, username: null, brain: {} },
      NOW,
    );
    assert.ok(upgraded);
    assert.equal(upgraded.version, 8);
    assert.equal(
      upgraded.ageConfirmed,
      true,
      'a learner who gave a date putting them over thirteen already answered the age question, in a longer form',
    );
    assert.equal(upgraded.dob, ADULT_DOB, 'deriving the confirmation is not a reason to drop the answer it came from');
  });

  test('a dob that reads young derives nothing, because nobody denied anything', () => {
    const upgraded = upgradeStored(
      { version: 3, name: 'Sam', dob: CHILD_DOB, motivation: 'school', dailyGoalMin: 5, onboardedAt: 789, username: null, brain: {} },
      NOW,
    );
    assert.ok(upgraded);
    assert.equal(upgraded.ageConfirmed, null, 'false would be this code claiming a learner said something they were never asked');
    assert.equal(upgraded.dob, CHILD_DOB, 'the answer stays on file even when it confirms nothing');
  });

  test('a v4 profile keeps the confirmation the learner actually gave', () => {
    const v4 = {
      version: 4,
      name: 'Camille',
      dob: null,
      ageConfirmed: true,
      motivation: null,
      dailyGoalMin: null,
      onboardedAt: 999,
      username: null,
      brain: { seen: 4 },
    };
    const upgraded = upgradeStored(v4, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 8);
    assert.equal(upgraded.ageConfirmed, true, 'a tap on the confirmation is an answer, and it survives every later read');
    assert.equal(upgraded.dob, null, 'a v4 learner was never asked for a date, and none is invented for them');
    assert.equal(upgraded.motivation, null, 'a skipped question stays skipped');
    assert.equal(upgraded.dailyGoalMin, null, 'the goal is asked in Profile now, and until then it is honestly empty');
    assert.deepEqual(upgraded.brain, { seen: 4 });
  });

  test('no upgrade branch ever drops the dob or invents a confirmation', () => {
    const v1 = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 123, brain: {} }, NOW);
    assert.ok(v1);
    assert.equal(v1.dob, null, 'v1 predates the question, so there is no answer to lose');
    assert.equal(v1.ageConfirmed, null, 'and none to derive');

    for (const dob of [ADULT_DOB, CHILD_DOB, '2013-xx-01']) {
      for (const { name, blob, confirmed } of branchesCarrying(dob, dob === ADULT_DOB)) {
        const upgraded = upgradeStored(blob, NOW);
        assert.ok(upgraded, `${name} must still upgrade`);
        assert.equal(upgraded.dob, dob, `${name} kept the date the learner typed, whatever v4 stopped asking for`);
        assert.notEqual(upgraded.ageConfirmed, false, `${name} must never hand back a denial the learner never made`);
        assert.ok(
          upgraded.ageConfirmed === true || upgraded.ageConfirmed === null,
          `${name} says either what the learner answered or nothing at all`,
        );
        assert.equal(upgraded.ageConfirmed, confirmed, `${name} confirms only an age the learner actually answered for`);
      }
    }
  });

  test('a v3 blob with a mangled username reads as unclaimed, not as junk', () => {
    const upgraded = upgradeStored({ version: 3, name: 'C', username: 42, brain: {} }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.username, null);
  });

  test('a blob with a goal nobody was ever offered reads as unanswered', () => {
    const upgraded = upgradeStored({ version: 3, name: 'C', dailyGoalMin: 7, brain: {} }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.dailyGoalMin, null, 'five, ten and fifteen are the only answers the app ever offered');
  });

  test('a v6 profile keeps the voice the learner chose', () => {
    // Every key, not one. The chain is the only thing standing between a
    // learner's choice and the tutor that speaks it, and a reader that knew
    // seven of the eight would quietly move one persona's learners back to a
    // stranger's voice on the next launch, with nothing on fire to say why.
    for (const key of VOICES) {
      const upgraded = upgradeStored(v6(key), NOW);
      assert.ok(upgraded, `a v6 profile carrying ${key} still upgrades`);
      assert.equal(upgraded.version, 8);
      assert.equal(upgraded.tutorVoice, key, `${key} is a choice the learner made, and the read hands it straight back`);
    }

    // And choosing a voice costs nothing else on the way past. This is the
    // ordinary version-chain promise, stated once for the new field's own
    // fixture so a v6 branch that forgot a spread fails here.
    const chosen = upgradeStored(v6(OTHER_VOICE), NOW);
    assert.ok(chosen);
    assert.equal(chosen.name, 'Camille');
    assert.equal(chosen.ageConfirmed, true);
    assert.equal(chosen.username, 'camille.4821');
    assert.equal(chosen.dailyGoalMin, 10);
    assert.deepEqual(chosen.brain, { seen: 6 }, 'the brain still passes through untouched for the door to repair');
  });

  test('every version below 6 arrives with no voice chosen, never an invented one', () => {
    // The slot is planted with a *well-formed* catalogue key on purpose. If
    // these branches dropped it because the value looked wrong, the rule would
    // be about validation. It is about the version: nothing that happened
    // before the field existed is a choice, so a key sitting in a v5 blob is a
    // hand edit or a downgrade's leftovers, never an answer somebody gave.
    for (const blob of everyOlderVersion(OTHER_VOICE)) {
      const label = `v${String(blob.version)}`;
      const upgraded = upgradeStored(blob, NOW);
      assert.ok(upgraded, `${label} must still upgrade`);
      assert.equal(upgraded.version, 8);
      assert.equal(upgraded.tutorVoice, null, `${label} predates the voice question, so it has no answer to it`);
      assert.notEqual(
        upgraded.tutorVoice,
        DEFAULT_TUTOR_VOICE,
        `${label} was handed the default as if it had asked for it — null is what the agent resolves to the default, not what an upgrade writes down`,
      );
    }

    // The same blobs with an empty slot, which is what these versions actually
    // have on disk. Identical outcome, and it must be: a learner whose phone
    // never wrote the field and one whose phone wrote junk into it have both
    // answered nothing, and the Profile row greets them the same way.
    for (const blob of everyOlderVersion(undefined)) {
      const upgraded = upgradeStored(blob, NOW);
      assert.ok(upgraded);
      assert.equal(upgraded.tutorVoice, null, 'a version that never wrote the field arrives without one');
    }
  });

  test('a stored voice that is not a catalogue key reads as not chosen', () => {
    // The reading the goal and the age stop already get: what is not a value
    // this app wrote is not an answer. Case and whitespace are in the list
    // because the catalogue key is the wire value — a near miss kept here
    // would travel to the token server and on towards a vendor URL, which is
    // the one thing the resolve at the agent exists to make impossible. The
    // array is here for the same reason: a check written on `String(value)`
    // would read it as a key.
    const notKeys: unknown[] = ['LUC', ' luc', 'luc ', 'nathalie', '', 'A1b2C3d4E5f6G7h8I9j0', 42, true, null, {}, [], ['luc']];
    for (const junk of notKeys) {
      const upgraded = upgradeStored(v6(junk), NOW);
      assert.ok(upgraded, `a profile carrying ${JSON.stringify(junk)} in the slot still upgrades`);
      assert.equal(
        upgraded.tutorVoice,
        null,
        `${JSON.stringify(junk)} is not a catalogue key, so it is not a choice — and dropping it costs the learner one tap, not their session`,
      );
    }

    // A v6 profile written before the learner ever opened the row has no slot
    // at all, and that is not junk. It reads the same way, which is what makes
    // null mean exactly one thing everywhere: nobody has chosen yet.
    const absent = v6(null);
    delete absent.tutorVoice;
    const never = upgradeStored(absent, NOW);
    assert.ok(never);
    assert.equal(never.tutorVoice, null);
  });

  test('a v7 profile keeps the typing choice, every older version arrives without one, and junk reads as no — F370', () => {
    // The field is a boolean and the only honest readings are "they said so"
    // and "nobody has". A v7 blob's own true is the first; everything else,
    // including a well-formed true planted in a v6 blob by a hand edit or a
    // downgrade's leftovers, is the second, because nothing that happened
    // before the field existed is an answer to it.
    const v7 = (preferTyping: unknown): Record<string, unknown> => ({ ...v6(OTHER_VOICE), version: 7, preferTyping });
    const chosen = upgradeStored(v7(true), NOW);
    assert.ok(chosen);
    assert.equal(chosen.version, 8);
    assert.equal(chosen.preferTyping, true, 'a learner who asked to type was not heard');
    assert.equal(chosen.tutorVoice, OTHER_VOICE, 'a v7 blob still keeps the voice a v6 one would');
    assert.equal(chosen.name, 'Camille', 'and nothing else on the way past');

    const declined = upgradeStored(v7(false), NOW);
    assert.ok(declined);
    assert.equal(declined.preferTyping, false);

    for (const junk of [1, 'true', 'yes', {}, [], null, undefined]) {
      const upgraded = upgradeStored(v7(junk), NOW);
      assert.ok(upgraded, `a profile carrying ${JSON.stringify(junk)} in the slot still upgrades`);
      assert.equal(upgraded.preferTyping, false, `${JSON.stringify(junk)} is not a boolean this app wrote, so it is not an answer`);
    }

    for (const blob of [...everyOlderVersion(undefined), v6(OTHER_VOICE)]) {
      const planted = { ...blob, preferTyping: true };
      const upgraded = upgradeStored(planted, NOW);
      assert.ok(upgraded, `v${String(blob.version)} must still upgrade`);
      assert.equal(upgraded.version, 8);
      assert.equal(upgraded.preferTyping, false, `v${String(blob.version)} predates the question, so it has no answer to it`);
    }
  });

  test('a v8 profile keeps what the learner forgot and the goals they wrote, every older version arrives with neither, and junk reads as nothing — F563', () => {
    // Two lists, both read only from a v8 blob's own slot, through the reader
    // profile/memory.ts keeps: a string is a key or a goal, anything else in
    // the list is dropped, and a blank is not a goal.
    const v8 = (forgottenFacts: unknown, learnerGoals: unknown): Record<string, unknown> => ({
      ...v6(OTHER_VOICE), version: 8, preferTyping: true, forgottenFacts, learnerGoals,
    });
    const kept = upgradeStored(v8(['has a dog', 'Has a DOG', 'job interview friday'], ['Order at a bakery', '  ', 'Call the plumber']), NOW);
    assert.ok(kept);
    assert.equal(kept.version, 8);
    assert.deepEqual(kept.forgottenFacts, ['has a dog', 'job interview friday'], 'a forget was lost, doubled or reordered on the way through');
    assert.deepEqual(kept.learnerGoals, ['Order at a bakery', 'Call the plumber'], 'a goal was lost, or a blank was kept as one');
    assert.equal(kept.preferTyping, true, 'a v8 blob still keeps the typing choice a v7 one would');
    assert.equal(kept.tutorVoice, OTHER_VOICE, 'and the voice a v6 one would');

    for (const junk of [1, 'true', {}, null, undefined, [7, null, {}], [['nested']]]) {
      const upgraded = upgradeStored(v8(junk, junk), NOW);
      assert.ok(upgraded, `a profile carrying ${JSON.stringify(junk)} in the slots still upgrades`);
      assert.deepEqual(upgraded.forgottenFacts, [], `${JSON.stringify(junk)} is not a list of keys this app wrote`);
      assert.deepEqual(upgraded.learnerGoals, [], `${JSON.stringify(junk)} is not a list of goals this app wrote`);
    }

    // Forget markers survive without expiry; goals retain the last-three limit.
    const many = upgradeStored(v8(Array.from({ length: 50 }, (_, i) => `fact ${i}`), ['a', 'b', 'c', 'd']), NOW);
    assert.ok(many);
    assert.equal(many.forgottenFacts.length, 50);
    assert.equal(many.forgottenFacts[0], 'fact 0', 'an old forget must never be evicted');
    assert.deepEqual(many.learnerGoals, ['b', 'c', 'd']);

    for (const blob of [...everyOlderVersion(undefined), v6(OTHER_VOICE), { ...v6(OTHER_VOICE), version: 7, preferTyping: true }]) {
      const planted = { ...blob, forgottenFacts: ['has a dog'], learnerGoals: ['Order at a bakery'] };
      const upgraded = upgradeStored(planted, NOW);
      assert.ok(upgraded, `v${String(blob.version)} must still upgrade`);
      assert.equal(upgraded.version, 8);
      assert.deepEqual(upgraded.forgottenFacts, [], `v${String(blob.version)} predates the field, so nothing in its slot is a forget`);
      assert.deepEqual(upgraded.learnerGoals, [], `v${String(blob.version)} predates the field, so nothing in its slot is a goal`);
    }
  });

  test('what is not a profile comes back null', () => {
    assert.equal(upgradeStored(null, NOW), null);
    assert.equal(upgradeStored('profile', NOW), null);
    assert.equal(upgradeStored({ version: 99 }, NOW), null);
    assert.equal(upgradeStored({}, NOW), null);
  });
});
