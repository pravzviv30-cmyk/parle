/**
 * Existing installs gain new missions' drills, and the cap leaves room for
 * generated ones. Stored choices always win.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DRILL_FIXTURES, type DrillExercise } from '@luvani/core';

import { MAX_DRILL_EXERCISES, MIN_GENERATED_HEADROOM, fixturesMissingFrom } from './merge.ts';

const NEW = 'phrase:new mission';
const HELD = 'phrase:held';

const ex = (id: string, phraseKey: string, kind: string): DrillExercise =>
  ({ id, phraseKey, kind, difficulty: 'recognition' }) as unknown as DrillExercise;

const fixtures = [
  ex('fx:new-r', NEW, 'fill-blank'),
  ex('fx:new-p', NEW, 'production'),
  ex('fx:held-r', HELD, 'fill-blank'),
  ex('fx:held-p', HELD, 'production'),
  ex('fx:held-own', HELD, 'own-words'),
];

test('the cap leaves room for generated drills beside every fixture', () => {
  assert.ok(
    DRILL_FIXTURES.length + MIN_GENERATED_HEADROOM <= MAX_DRILL_EXERCISES,
    `${DRILL_FIXTURES.length} fixtures + ${MIN_GENERATED_HEADROOM} headroom exceeds cap ${MAX_DRILL_EXERCISES}`,
  );
});

test('a bank missing a new phrase gains both its fixtures', () => {
  const bank = [ex('saved:held', HELD, 'fill-blank'), ex('saved:held-own', HELD, 'own-words')];
  assert.deepEqual(fixturesMissingFrom(bank, fixtures).map(f => f.id), ['fx:new-r', 'fx:new-p']);
});

test('a phrase with one stored exercise gains only the own-words rung', () => {
  const bank = [ex('saved:new', NEW, 'fill-blank'), ex('saved:held', HELD, 'translate')];
  assert.deepEqual(fixturesMissingFrom(bank, fixtures).map(f => f.id), ['fx:held-own']);
});

test('own-words is not re-added once stored', () => {
  const bank = [ex('saved:new', NEW, 'fill-blank'), ex('saved:own', HELD, 'own-words')];
  assert.deepEqual(fixturesMissingFrom(bank, fixtures), []);
});

test('the shipped fixtures against an empty bank are all of them, and against themselves none', () => {
  assert.equal(fixturesMissingFrom([]).length, DRILL_FIXTURES.length);
  assert.equal(fixturesMissingFrom(DRILL_FIXTURES).length, 0);
});
