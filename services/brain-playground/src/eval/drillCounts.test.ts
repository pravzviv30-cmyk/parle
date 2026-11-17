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
});
