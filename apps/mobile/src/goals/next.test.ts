/**
 * One task for a goal, decided in code (Stage 4, 2026-09-25).
 *
 * Missions only: a daily situation would reuse the Max-only seed path and a
 * Real Moment task needs moment identity the screen does not carry, so both
 * are descoped. A keyword table over each mission's place and goal decides a
 * match; nothing matching is a starting point, worded as one, and never
 * "matches your goal".
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIRST_MISSION, MISSIONS, getMission } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { GOAL_FIT_COPY, goalTaskOf, missionOfTask, nextLine, nextTaskForGoal } from './next.ts';

describe('the next task for a goal — Stage 4', () => {
  test('a goal that names a place gets that place, fit matched', () => {
    const cases: [string, string][] = [
      ['Order a coffee in Paris', 'mission:cafe'],
      ['Stop a stranger and ask for the way', 'mission:chemin'],
      ['Order a croissant at the boulangerie', 'mission:cafe'],
      ['Check in at my hotel in Lyon', 'mission:hotel'],
      ['Ask about my room at the réception', 'mission:hotel'],
      ['Buy vegetables at the market', 'mission:marche'],
      ['Ask for directions to the metro', 'mission:chemin'],
      ['Find my way to the train station', 'mission:chemin'],
      ['Tell my partner about my day', 'mission:journee'],
      ['Make plans with friends for the weekend', 'mission:amis'],
    ];
    for (const [goal, expected] of cases) {
      const next = nextTaskForGoal(goal, { missions: MISSIONS });
      assert.ok(next, `${goal}: no task at all`);
      assert.deepEqual(next.task, { kind: 'mission', id: expected }, `${goal}: the wrong place`);
      assert.equal(next.fit, 'matched', `${goal}: a real match was called a starting point`);
    }
  });

  test('matching reads words, not letters inside words, and ignores accents and case', () => {
    // "coffee" matches, "roomba" is not a room and "marketing" is not a market.
    assert.equal(nextTaskForGoal('I want to talk about marketing at work', { missions: MISSIONS })?.task.id !== 'mission:marche', true);
    assert.equal(nextTaskForGoal('CAFÉ au lait, s’il vous plaît', { missions: MISSIONS })?.task.id, 'mission:cafe');
    assert.equal(nextTaskForGoal('Buy a new roomba', { missions: MISSIONS })?.task.id !== 'mission:hotel', true);
  });

  test('nothing matching is the first mission, fit starter', () => {
    // The second group are ordinary sentences whose words also sit in a
    // mission's goal line or mean a place in another sense: none is a match,
    // and "(matches your goal)" over any of them would be false.
    for (const goal of [
      'Pass my B2 exam',
      'x',
      'Understand French films',
      'Check the weather forecast',
      'Speak better in order to get a job',
      'Speak French every day',
      'Train my ear for fast speech',
      'Stay motivated',
      'Run a meeting at work',
    ]) {
      const next = nextTaskForGoal(goal, { missions: MISSIONS });
      assert.ok(next);
      // 2026-09-27: FIRST_MISSION became the three-line opener, which goals
      // never offer; the starter stays the full café, as rows.test expects.
      assert.deepEqual(next.task, { kind: 'mission', id: 'mission:cafe' }, `${goal}: the starter is not the café`);
      assert.notEqual(next.task.id, FIRST_MISSION, `${goal}: a goal was handed the three-line opener`);
      assert.equal(next.fit, 'starter', `${goal}: nothing matched and it was called a match`);
    }
    // A catalogue without the café still has a starter: its own first mission.
    const noCafe = MISSIONS.filter((m) => m.id !== FIRST_MISSION);
    assert.equal(nextTaskForGoal('Pass my exam', { missions: noCafe })?.task.id, noCafe[0]!.id);
    assert.equal(nextTaskForGoal('Pass my exam', { missions: [] }), null, 'an empty catalogue invented a task');
  });

  test('a word with an ordinary second meaning, or a negated goal, never claims a match — Stage 4 review', () => {
    // Fable review (2026-09-25) found "(matches your goal)" over goals the
    // mission does not serve: shared verbs ("buy", "drink"), words that name
    // more than one place ("station", "stranger", "tea"), and negated goals.
    // Each of these is a starting point now, never a match.
    for (const goal of [
      'Buy a house',
      'Buy a train ticket at the station',
      'price negotiation for a car',
      'Tea with my grandmother',
      'Talk to my colleagues at work',
      'have a drink with a stranger',
      'I do not want to eat at restaurants, I want to read novels',
      'Never stay in hotels again',
      'not the market, the museum',
      "Je ne veux pas aller au marché",
      'Work from home',
      'I lost my passport',
      'Plan my weekend',
      'Understand the way people speak',
      'Go shopping for clothes',
      'Book a table for dinner',
    ]) {
      const next = nextTaskForGoal(goal, { missions: MISSIONS });
      assert.ok(next);
      assert.equal(next.fit, 'starter', `"${goal}" was called a match for ${next.task.id}`);
    }
    // And the real matches around them still hold, including a goal that says
    // "without", which is not a negation of the place it names.
    const kept: [string, string][] = [
      ['Check into my hotel in Lyon without switching to English', 'mission:hotel'],
      ['Order in a restaurant', 'mission:cafe'],
      ['Meet friends for an apéro', 'mission:amis'],
      ['Buy fruit at the market stall', 'mission:marche'],
      ['Talk with my family about my day', 'mission:journee'],
    ];
    for (const [goal, expected] of kept) {
      const next = nextTaskForGoal(goal, { missions: MISSIONS });
      assert.deepEqual(next, { task: { kind: 'mission', id: expected }, fit: 'matched' }, `"${goal}" lost its real match`);
    }
  });

  test('figurative and second-meaning uses of a place word are starting points too — Stage 5 review', () => {
    // The final Fable review (2026-09-26) found "(matches your goal)" still
    // printed over metaphors and second meanings. A starting point claims
    // nothing, so a word stays in the table only when it almost always means
    // the place; precision over recall.
    for (const goal of [
      'Navigate the French healthcare system',
      'Read a map of the Paris metro',
      'Get lost in a good French novel',
      'Find my way around the tax office',
      'Cook with fresh produce for my family',
      'Explain to my family that I hate the market',
      'Understand the French job market',
      'Follow the stock market news',
      'Learn some street slang',
      'Take my career in a new direction',
      'Join a political party',
      'Build a study routine',
    ]) {
      const next = nextTaskForGoal(goal, { missions: MISSIONS });
      assert.ok(next);
      assert.equal(next.fit, 'starter', `"${goal}" was called a match for ${next.task.id}`);
    }
    // The literal goals around them still match.
    const kept: [string, string][] = [
      ['Find my way to the train station', 'mission:chemin'],
      ['Ask for directions to the Louvre', 'mission:chemin'],
      ['Describe my daily routine', 'mission:journee'],
      ['Buy groceries at the supermarket', 'mission:marche'],
      ['Read the menu in a bistro', 'mission:cafe'],
    ];
    for (const [goal, expected] of kept) {
      assert.deepEqual(nextTaskForGoal(goal, { missions: MISSIONS }), { task: { kind: 'mission', id: expected }, fit: 'matched' }, `"${goal}" lost its real match`);
    }
  });

  test('a match never reaches outside the catalogue it was given', () => {
    const only = MISSIONS.filter((m) => m.id === 'mission:hotel');
    const next = nextTaskForGoal('Order a coffee', { missions: only });
    assert.deepEqual(next, { task: { kind: 'mission', id: 'mission:hotel' }, fit: 'starter' });
  });

  test('ties go to catalogue order, so the same goal always gets the same task', () => {
    // "coffee" is the café's and "friends" is the evening with friends: one
    // hit each, and the café comes first in the catalogue.
    const once = nextTaskForGoal('Coffee with friends', { missions: MISSIONS });
    const again = nextTaskForGoal('Coffee with friends', { missions: [...MISSIONS] });
    assert.deepEqual(once, again);
    assert.equal(once?.task.id, 'mission:cafe');
    // The same tie with the catalogue reversed goes the other way, which is
    // what "catalogue order decides" means.
    assert.equal(nextTaskForGoal('Coffee with friends', { missions: [...MISSIONS].reverse() })?.task.id, 'mission:amis');
  });

  test('the task string is the mission id, and reads back to the mission', () => {
    assert.equal(goalTaskOf({ kind: 'mission', id: 'mission:cafe' }), 'mission:cafe');
    assert.equal(missionOfTask('mission:cafe')?.id, 'mission:cafe');
    assert.equal(missionOfTask('mission:not-a-mission'), null, 'an unknown mission was invented');
    assert.equal(missionOfTask('situation:scene-market'), null, 'a descoped task family opened a mission');
  });

  test('matched may say it matches the goal; a starter is a starting point and never a match', () => {
    const cafe = getMission('mission:cafe')!;
    const matched = nextLine(cafe, 'matched');
    const starter = nextLine(cafe, 'starter');
    assert.equal(matched, 'Next: Order at a café (matches your goal)');
    assert.equal(starter, 'A good place to start: Order at a café');
    assert.doesNotMatch(starter, /match/i, 'a starting point claims to match the goal');
    for (const line of [matched, starter, ...Object.values(GOAL_FIT_COPY)]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /\d|%|achiev|master|ready\b/i, `"${line}" claims a result`);
    }
  });

  test('nothing is decided by a model: the module imports no network, no brain and no prompt', () => {
    const source = readFileSync(fileURLToPath(new URL('./next.ts', import.meta.url)), 'utf8');
    for (const reach of ['fetch(', '@luvani/brain', 'anthropic', 'openai', 'seedTopic']) {
      assert.ok(!source.includes(reach), `next.ts reaches for ${reach}; the task is decided in code`);
    }
  });
});
