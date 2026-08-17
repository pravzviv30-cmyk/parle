import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { INLINE_CAP, assessmentToQuality, splitCoach, surfacePolicy } from './grading.ts';
import { sampleCoachItem, sampleTurn } from '../contract/samples.ts';
import type { Assessment, CoachKind } from '../contract/types.ts';
import type { Strictness } from '../types.ts';

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return { ...sampleTurn().assessment, ...overrides };
}

describe('assessmentToQuality — the promotion signal', () => {
  test('clear French that does its job is good', () => {
    assert.equal(assessmentToQuality(assessment(), []), 'good');
  });

  test('coaching kinds never block promotion — correct-but-textbook still climbs', () => {
    for (const kind of ['grammar-slip', 'textbook-phrasing', 'register-mismatch', 'anglicism'] as const) {
      assert.equal(assessmentToQuality(assessment(), [sampleCoachItem({ kind })]), 'good', kind);
    }
  });

  test('a blocking error is poor, whatever else was fine', () => {
    assert.equal(assessmentToQuality(assessment(), [sampleCoachItem({ kind: 'blocking-error' })]), 'poor');
  });

  test('understood but shaky holds position at partial', () => {
    assert.equal(assessmentToQuality(assessment({ comprehensibility: 'strained' }), []), 'partial');
    assert.equal(assessmentToQuality(assessment({ language: 'mixed' }), []), 'partial');
  });

  test('english, nothing, breakdown, or not understood is poor', () => {
    assert.equal(assessmentToQuality(assessment({ language: 'english' }), []), 'poor');
    assert.equal(assessmentToQuality(assessment({ language: 'none' }), []), 'poor');
    assert.equal(assessmentToQuality(assessment({ comprehensibility: 'breakdown' }), []), 'poor');
    assert.equal(assessmentToQuality(assessment({ understood: false }), []), 'poor');
  });

  test('a reply that does not do its job is poor even in clear French', () => {
    assert.equal(assessmentToQuality(assessment({ taskAchieved: false }), []), 'poor');
  });
});

describe('surface policy — when feedback lands, never whether', () => {
  const ALL_KINDS: CoachKind[] = ['blocking-error', 'grammar-slip', 'textbook-phrasing', 'register-mismatch', 'anglicism'];
  const ALL_LEVELS: Strictness[] = ['flow', 'balanced', 'strict'];

  test('textbook phrasing surfaces inline at EVERY strictness — this is the product', () => {
    for (const strictness of ALL_LEVELS) {
      assert.equal(surfacePolicy('textbook-phrasing', strictness), 'inline', strictness);
    }
  });

  test('blocking errors always surface inline', () => {
    for (const strictness of ALL_LEVELS) {
      assert.equal(surfacePolicy('blocking-error', strictness), 'inline', strictness);
    }
  });

  test('grammar slips wait for the recap except at strict', () => {
    assert.equal(surfacePolicy('grammar-slip', 'flow'), 'recap');
    assert.equal(surfacePolicy('grammar-slip', 'balanced'), 'recap');
    assert.equal(surfacePolicy('grammar-slip', 'strict'), 'inline');
  });

  test('every kind has a decision at every strictness', () => {
    for (const kind of ALL_KINDS) {
      for (const strictness of ALL_LEVELS) {
        assert.ok(['inline', 'recap'].includes(surfacePolicy(kind, strictness)));
      }
    }
  });
});

describe('splitCoach — caps and priority', () => {
  test('nothing surfaced is nothing lost: overflow joins the recap queue', () => {
    const items = [
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'a' }),
      sampleCoachItem({ kind: 'register-mismatch', quote: 'b' }),
      sampleCoachItem({ kind: 'anglicism', quote: 'c' }),
    ];
    const { inline, deferred } = splitCoach(items, 'balanced');
    assert.equal(inline.length, INLINE_CAP.balanced);
    assert.equal(inline.length + deferred.length, items.length);
  });

  test('flow interrupts once at most', () => {
    const items = [
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'a' }),
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'b' }),
    ];
    const { inline, deferred } = splitCoach(items, 'flow');
    assert.equal(inline.length, 1);
    assert.equal(deferred.length, 1);
  });

  test('a blocking error outranks everything else for the inline slot', () => {
    const items = [
      sampleCoachItem({ kind: 'grammar-slip', quote: 'slip' }),
      sampleCoachItem({ kind: 'blocking-error', quote: 'block' }),
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'textbook' }),
    ];
    const { inline } = splitCoach(items, 'flow');
    assert.equal(inline[0]!.kind, 'blocking-error');
  });

  test('matters-now outranks minor within a kind', () => {
    const items = [
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'later', weight: 'minor' }),
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'now', weight: 'matters-now' }),
    ];
    const { inline } = splitCoach(items, 'flow');
    assert.equal(inline[0]!.quote, 'now');
  });

  test('at strict, grammar slips surface inline within the cap', () => {
    const { inline } = splitCoach([sampleCoachItem({ kind: 'grammar-slip' })], 'strict');
    assert.equal(inline.length, 1);
  });
});
