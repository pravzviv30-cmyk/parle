/**
 * The three questions, and the two that are no longer asked.
 *
 * Half of this suite is behaviour and half is a source read, which is the
 * `labels.test.ts` and `nav/wiring.test.ts` idiom and is deliberate: apps/mobile
 * has no renderer, so "the flow does not ask for a date of birth" and "the goal
 * is asked in Profile" are claims about what a screen puts on glass, and the
 * only honest way to hold them here is to read the file. A tripwire that
 * catches the mistake anyone actually makes is worth more than a proof nobody
 * can run.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_REFUSAL,
  MOTIVATIONS,
  PAGES,
  WHY_SKIP,
  ageGate,
  answersFrom,
  needsOnboarding,
  nameFrom,
  pageAfter,
  pageBefore,
} from './answers.ts';
import { createStoredProfile } from '../profile/store.ts';
import { upgradeStored } from '../profile/upgrade.ts';

/** A fixed clock, because a rule about who gets asked must not depend on today. */
const NOW = new Date(2026, 5, 1, 12).getTime();

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FLOW = stripComments(read('./OnboardingFlow.tsx'));
const PROFILE_TAB = stripComments(read('../tabs/ProfileTab.tsx'));

describe('onboarding — three questions, and nothing that has to be answered', () => {
  test('a skipped name is stored as null, not as an empty string', () => {
    // An empty string is a name somebody typed. Null is a question they
    // declined, and the difference is what stopped Home greeting "Bonjour, ".
    assert.equal(nameFrom(''), null);
    assert.equal(nameFrom('   '), null, 'whitespace is not a name');
    assert.equal(nameFrom('  Camille '), 'Camille', 'a real name still arrives trimmed');

    const skipped = answersFrom({ name: '  ', ageConfirmed: true, motivation: null });
    assert.equal(skipped.name, null, 'the assembled answers carry the skip, not an empty string');
    assert.equal(skipped.motivation, null, 'a skipped why is null, never a reason invented for them');

    // And the flow delegates rather than assembling its own: this rule used to
    // live inline as `name: name.trim()`, where nothing could reach it.
    assert.match(FLOW, /answersFrom\(/, 'the flow assembles its answers somewhere no test can see');
    assert.doesNotMatch(FLOW, /name:\s*name\.trim\(\)/, 'the empty-string name is back in the screen');
    assert.doesNotMatch(FLOW, /motivation\s*\?\?\s*'/, 'the flow is inventing a reason for a learner again');
  });

  test('onboarding never asks for a date of birth', () => {
    assert.deepEqual([...PAGES], ['name', 'age', 'why'], 'the pages are the three that are left');

    for (const forbidden of [
      'DD/MM/YYYY',
      'When were you born',
      'isoFromDobInput',
      'formatDobInput',
      'dobText',
      'dobError',
    ]) {
      assert.ok(!FLOW.includes(forbidden), `onboarding still reaches for a date of birth: ${forbidden}`);
    }
    assert.doesNotMatch(FLOW, /\bdob\b/, 'the flow still handles a date of birth');
    assert.doesNotMatch(FLOW, /keyboardType="number-pad"/, 'onboarding still asks somebody to type a date');
  });

  test('a learner who cannot confirm their age is told plainly and is not let through', () => {
    const refused = ageGate(false);
    assert.equal(refused.go, false, 'the confirmation is the only way past');
    assert.equal(refused.refusal, AGE_REFUSAL);
    assert.equal(ageGate(true).go, true, 'and a learner who confirms is not stopped');
    assert.equal(ageGate(true).refusal, null, 'nobody who was let through is shown a refusal');

    // Plainly: it says who the product is for, without scolding and without a
    // number, and it does not pretend to be a retry.
    assert.ok(AGE_REFUSAL.length > 0);
    assert.ok(!/—/.test(AGE_REFUSAL), 'the refusal carries an em dash');
    assert.ok(!/\d/.test(AGE_REFUSAL), 'a refusal reads better in words than in digits');
    assert.ok(!/\b(sorry|wrong|cannot|denied|error)\b/i.test(AGE_REFUSAL), 'the refusal apologises or scolds');

    // The screen asks the question as one tap, and offers the honest no.
    assert.ok(FLOW.includes('AGE_CONFIRM'), 'the age page lost its confirmation');
    assert.ok(FLOW.includes('AGE_DENY'), 'a learner who is not old enough has no way to say so');
    assert.ok(FLOW.includes('ageGate('), 'the age page decides for itself again');
    assert.equal(AGE_CONFIRM, 'I am 13 or older');
    assert.ok(AGE_DENY.length > 0);
  });

  test('the daily goal is asked in profile and nowhere in onboarding', () => {
    for (const forbidden of ['dailyGoalMin', 'How much time each day', 'Five minutes', 'GOALS']) {
      assert.ok(!FLOW.includes(forbidden), `the goal question is back on the way to a first conversation: ${forbidden}`);
    }
    assert.ok(!PAGES.includes('goal' as never), 'the goal is a page again');

    assert.ok(PROFILE_TAB.includes('withDailyGoal'), 'profile has no way to set the goal, so nowhere asks it');
    assert.ok(
      PROFILE_TAB.includes('Daily goal'),
      'the goal row has no name a learner could find it by',
    );
  });
});

describe('onboarding — the shape of the walk', () => {
  test('every page has somewhere to go, and the first has nothing behind it', () => {
    assert.equal(pageBefore('name'), null, 'there is nothing behind the first question');
    assert.equal(pageAfter('name'), 'age');
    assert.equal(pageAfter('age'), 'why');
    assert.equal(pageAfter('why'), null, 'the last page finishes rather than advancing');
    assert.equal(pageBefore('why'), 'age');
  });

  test('the four reasons are still four, and none of them is a default', () => {
    assert.equal(MOTIVATIONS.length, 4);
    assert.ok(WHY_SKIP.length > 0, 'the why page lost its way past');
    const skipped = answersFrom({ name: 'Camille', ageConfirmed: true, motivation: null });
    assert.equal(skipped.motivation, null);
  });

  test('nothing onboarding says to a learner carries an em dash or a scolding', () => {
    for (const line of [...MOTIVATIONS.flatMap((m) => [m.label, m.gloss]), AGE_CONFIRM, AGE_DENY, WHY_SKIP]) {
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|must)\b/i.test(line), `"${line}" scolds`);
    }
  });
});

describe('leaving onboarding — the journey, not the field', () => {
  // Driven through the real constructors rather than hand-built objects. The
  // defect this pins came from a guard reading a field that a different function
  // was allowed to leave null, so a test that fabricates its own profile would
  // reproduce the author's assumption instead of the app's behaviour.

  test('a learner who skips their name is not sent back to page one', () => {
    // The trap: the name became optional, the guard still read the name, and the
    // learner was returned to onboarding on that launch and every launch after.
    const stored = createStoredProfile(answersFrom({ name: '   ', ageConfirmed: true, motivation: null }), NOW);

    assert.equal(stored.name, null, 'a skipped name is still stored as null, which is the honest value');
    assert.equal(
      needsOnboarding(stored),
      false,
      'they answered every question they were required to answer, so nothing may ask them again',
    );
  });

  test('a learner who gave their name is not asked again either', () => {
    const stored = createStoredProfile(answersFrom({ name: 'Sam', ageConfirmed: true, motivation: 'trip' }), NOW);
    assert.equal(needsOnboarding(stored), false);
  });

  test('a learner who has never seen the age question is still asked', () => {
    // The case the old guard actually existed for: a version-1 record, from
    // before either question was asked. Migrating one must not smuggle it past.
    const migrated = upgradeStored({ version: 1, motivation: 'work', onboardedAt: NOW - 1000, brain: {} }, NOW);

    assert.ok(migrated, 'a v1 record still upgrades');
    assert.equal(migrated.ageConfirmed, null, 'nothing in a v1 record can answer the age question');
    assert.equal(needsOnboarding(migrated), true, 'so they have to be asked, exactly as before');
  });

  test('a learner whose stored date of birth already answered it is left alone', () => {
    // They answered this question years ago in a different shape. Asking again
    // because the shape changed would be the app forgetting its own learner.
    const migrated = upgradeStored({ version: 3, name: 'Ada', dob: '1990-04-02', motivation: 'want', dailyGoalMin: 10, onboardedAt: NOW - 1000, username: null, brain: {} }, NOW);

    assert.ok(migrated);
    assert.equal(migrated.ageConfirmed, true);
    assert.equal(needsOnboarding(migrated), false, 'a dob that already proves thirteen is an answer, not a gap');
    assert.equal(migrated.dob, '1990-04-02', 'and nothing of theirs was thrown away to reach that conclusion');
  });

  test('nobody at all is asked', () => {
    assert.equal(needsOnboarding(null), true);
  });
});

describe('the age gate is a gate on screen, not only in the rule', () => {
  test('the way through disappears once the learner says they are younger', () => {
    // A tripwire, in this file's own idiom. `ageGate(false).go === false` was
    // already true and already tested, and the screen showed the refusal with
    // the confirm pill still rendered and enabled underneath it. The rule said
    // no and the glass said yes, and only the rule was under test.
    const guarded = FLOW.match(/\{page === 'age' &&[^}]*PillButton[^}]*\}/);
    assert.ok(guarded, 'the age page still offers a way through');
    assert.match(
      guarded[0],
      /oldEnough !== false/,
      'and it has to be gone once they have answered, or the refusal is a suggestion with a button under it',
    );
  });
});
