/**
 * The drill eval used to count an exercise as clean when it passed
 * `validateExercise` alone, while production drops far more through
 * `groundedDrills` (F1124). It now reports both.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { DrillExercise } from '@luvani/core';

import { drillCounts } from './drillCounts.ts';

const input = {
  sessionPhrases: [{ fr: 'un café', frWritten: null, en: 'a coffee', enLiteral: null, register: 'courant' as const, note: null }],
  profilePhrases: [],
  errorTags: [],
  topics: [],
};

const grounded: DrillExercise = { id: 'gen:cafe:listen', kind: 'listen-type', phraseKey: 'phrase:un café', difficulty: 'production', fr: 'Un café', accepted: ['Un café'] };
const ungrounded: DrillExercise = { ...grounded, id: 'gen:foreign', phraseKey: 'phrase:une baguette', fr: 'Une baguette', accepted: ['Une baguette'] };

describe('drill eval — what production would keep', () => {
  test('drill eval counts an ungrounded exercise as rejected', () => {
    const counts = drillCounts([grounded, ungrounded], input);
    assert.equal(counts.total, 2);
    assert.equal(counts.basic, 2, 'both exercises are well formed, so the basic check passes both');
    assert.deepEqual(counts.kept, [grounded], 'production drops the exercise for a phrase the request never asked about');
  });

  test("the production drill count applies the learner's answer-length cap", () => {
    // Thirteen words: one past the A0 cap of twelve, which production applies to a learner with no history.
    const long = 'Un café et un croissant pour moi et mon ami qui attend dehors';
    const tooLong: DrillExercise = { ...grounded, id: 'gen:cafe:long', fr: long, accepted: [long] };
    const counts = drillCounts([grounded, tooLong], input);
    assert.equal(counts.basic, 2, 'the basic check has no length bound');
    assert.deepEqual(counts.kept, [grounded], 'an A0 learner never sees a thirteen-word answer, so the eval must not count it');
  });
});
