/**
 * The daily goal, moved onto its own row — F368.
 *
 * It had a whole screen: a winged clock, a headline, a paragraph and three
 * cards, reached by a tap and left by another. Four taps and two screen changes
 * to answer a question whose entire content is three words, on a setting the
 * app does not yet read. The three words are on the row now, and what the
 * chosen one means is written under them, which is the part a segmented control
 * would otherwise hide.
 *
 * The suite is a pure half and a wiring half, for the reason docs/TESTING.md
 * gives: there is no renderer here, so a rule that stays inside a `.tsx` is a
 * rule nothing can ask a question about, and a row nothing renders is exactly
 * the shape the strictness dial's own defect had.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DAILY_GOAL_ROW,
  DAILY_GOAL_UNSET,
  GOALS,
  dailyGoalOf,
  goalFor,
  goalKeyOf,
  goalLine,
} from './dailyGoal.ts';
import { createStoredProfile, withDailyGoal, type StoredProfile } from './store.ts';

const NOW = Date.parse('2026-09-01T09:00:00Z');

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** A learner who has not answered this question, which is most of them. */
const learner = (): StoredProfile =>
  createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null }, NOW);

describe('the flexible speaking target, chosen where it is read — F368', () => {
  test('the speaking target is a three-way choice with the chosen gloss beneath, written through withDailyGoal — F368', () => {
    // 1. Three options, and the minute counts the store's own union names. A
    //    fourth would not fit the track, and a value outside the union would be
    //    a write the store types reject.
    assert.equal(GOALS.length, 3, 'a segmented control with a different number of segments is a different control');
    assert.deepEqual(GOALS.map((g) => g.minutes), [5, 10, 15], 'the goal offers minutes the store cannot hold');
    assert.deepEqual(GOALS.map((g) => g.label), ['Five', 'Ten', 'Fifteen'], 'the segments are not the three words');
    assert.deepEqual(
      GOALS.map((g) => g.gloss),
      ['A quick speaking moment', 'Room for a full scene', 'A longer conversation'],
      'the choices judge commitment instead of describing the size of a sitting',
    );
    assert.equal(new Set(GOALS.map((g) => g.key)).size, 3, 'two segments share a key, so one of them cannot be chosen');

    // 2. Reading it. Never chosen is null rather than a default, because "has
    //    not been asked" and "asked for five" are different facts and the
    //    control has to be able to stand with nothing on it.
    assert.equal(dailyGoalOf(null), null, 'no profile at all resolves to a promise nobody made');
    assert.equal(dailyGoalOf(undefined), null);
    assert.equal(dailyGoalOf(learner()), null, 'a new learner arrives already committed to something');
    assert.equal(goalKeyOf(learner()), null, 'the control would draw a pill over a choice nobody made');
    for (const junk of ['10', 0, 7, -5, null, {}, [10], true]) {
      const tampered = { ...learner(), dailyGoalMin: junk } as unknown as StoredProfile;
      assert.equal(dailyGoalOf(tampered), null, `${JSON.stringify(junk)} in the slot read as a real goal`);
      assert.equal(goalLine(tampered), DAILY_GOAL_UNSET, `${JSON.stringify(junk)} produced a line about a goal`);
    }

    // 3. Writing it, through the store's one named door. Every option is
    //    reachable, not just the one this test happens to pick.
    for (const option of GOALS) {
      const set = withDailyGoal(learner(), option.minutes);
      assert.equal(dailyGoalOf(set), option.minutes, `${option.label} cannot be set`);
      assert.equal(goalKeyOf(set), option.key, `${option.label} is set and the control marks a different segment`);
      assert.equal(goalFor(option.key).minutes, option.minutes, 'a segment key resolves to a different number of minutes');
    }
    const before = learner();
    withDailyGoal(before, 15);
    assert.equal(dailyGoalOf(before), null, 'the write mutated the profile it was handed');

    // 4. The line under the control. What is set, and what that means, in that
    //    order, because a learner scanning the card reads the first sentence.
    assert.equal(goalLine(withDailyGoal(learner(), 10)), 'Ten minutes today. Room for a full scene.');
    assert.equal(goalLine(withDailyGoal(learner(), 5)), 'Five minutes today. A quick speaking moment.');
    assert.equal(goalLine(null), DAILY_GOAL_UNSET, 'a learner who has not chosen is told nothing about what to do');
    assert.match(DAILY_GOAL_UNSET, /flexible speaking target/, 'the unset line makes the target sound compulsory');

    // 5. The copy. No digits anywhere a learner reads: the store holds five,
    //    ten and fifteen because minutes are a number, and the row says the
    //    words, exactly as the reminder presets do.
    const lines = [
      DAILY_GOAL_ROW,
      DAILY_GOAL_UNSET,
      ...GOALS.map((g) => g.label),
      ...GOALS.map((g) => g.gloss),
      ...GOALS.map((g) => goalLine(withDailyGoal(learner(), g.minutes))),
    ];
    for (const line of lines) {
      assert.ok(line.length > 0, 'a line on the goal row is empty');
      assert.ok(!/\d/.test(line), `"${line}" counts at somebody in a settings label`);
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(
        !/\b(streak|missed|behind|must|should|failed|sorry)\b/i.test(line),
        `"${line}" turns a promise into a debt`,
      );
    }
    assert.equal(DAILY_GOAL_ROW, 'Speaking target', 'the row is named something onboarding.test.ts cannot find');

    // 6. The wiring. There is no renderer in this suite, so the row is read out
    //    of the screen: the choice is on the card, it writes through the store's
    //    door, and the sheet it replaced is gone rather than orphaned.
    const tab = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(tab, /<ChoiceRow/, 'the goal is not a choice on the row, so nothing on the card can be chosen in place');
    assert.match(
      tab,
      /update\(withDailyGoal\(profile, goalFor\(key\)\.minutes\)\)/,
      'the row changes what is on screen without writing it down',
    );
    assert.match(tab, /active=\{goalKeyOf\(profile\)\}/, 'the control does not mark what is already set');
    assert.match(tab, /gloss=\{goalLine\(profile\)\}/, 'the segments stand alone, so three words hide every difference between them');
    assert.match(tab, /DAILY_GOAL_ROW/, 'the screen spells the row name itself instead of importing the one name');
    assert.ok(!tab.includes("'goal'"), 'the goal sheet is still in the screen, so there are two ways to answer one question');
    assert.ok(!tab.includes('How much time each day'), 'the sheet went and its headline stayed behind');
    assert.ok(!tab.includes('OnboardClock'), 'the drawing outlived the only screen that drew it');
  });
});
