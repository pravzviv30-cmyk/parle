import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEARNER_GOALS } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { GOAL_PICK_LINES, goalOf, goalPickLine } from './goalLine.ts';

test('every goal but "because" has one plain line, and nothing else does', () => {
  for (const goal of LEARNER_GOALS) {
    const line = goalPickLine(goal);
    if (goal === 'because') assert.equal(line, null);
    else assert.match(line ?? '', /^Picked for /);
  }
  assert.equal(goalPickLine(null), null);
  assert.equal(goalPickLine(undefined), null);
});

test('the lines are warm, plain and carry no em dash or number', () => {
  for (const line of Object.values(GOAL_PICK_LINES)) {
    assert.doesNotMatch(line, /—|\d/);
    assert.equal(guiltIn(line), undefined, line);
  }
});

test('the goal is read off the profile only when it is a known one', () => {
  assert.equal(goalOf({ onboardingGoal: 'moving' }), 'moving');
  assert.equal(goalOf({ onboardingGoal: 'skiing' }), null);
  assert.equal(goalOf({ onboardingGoal: null }), null);
  assert.equal(goalOf({}), null);
});
