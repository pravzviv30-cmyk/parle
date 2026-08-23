import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { INLINE_CAP, INLINE_COACH_COOLDOWN_TURNS, assessmentToQuality, splitCoach, surfacePolicy } from './grading.ts';
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

  test('silence and a genuine breakdown still drop the rung', () => {
    assert.equal(assessmentToQuality(assessment({ language: 'none' }), []), 'poor');
    assert.equal(assessmentToQuality(assessment({ comprehensibility: 'breakdown' }), []), 'poor');
    assert.equal(assessmentToQuality(assessment({ understood: false }), []), 'poor');
  });

  test('reaching for English holds the rung instead of dropping it', () => {
    // G5. Half-English already held at partial, so English-only dropping was an
    // inconsistency inside this function. Reaching for words is what a beginner
    // does; the drop also writes stats.lastRung down, so two polite questions
    // today opened tomorrow's session a rung lower. The beat is re-invited by
    // the hand-back loop either way, so the drop bought nothing.
    assert.equal(assessmentToQuality(assessment({ language: 'english' }), []), 'partial');
    assert.equal(
      assessmentToQuality(assessment({ language: 'english', taskAchieved: false }), []),
      'partial',
      'asking how to say something never does the scene’s job, and must not be punished for it',
    );
    assert.equal(
      assessmentToQuality(assessment({ language: 'english' }), [sampleCoachItem({ kind: 'blocking-error' })]),
      'partial',
      'a blocking error reported alongside English is still the learner reaching, not failing',
    );
  });

  test('a reply that does not do its job is poor even in clear French', () => {
    assert.equal(assessmentToQuality(assessment({ taskAchieved: false }), []), 'poor');
  });
});

describe('surface policy — when feedback lands, never whether', () => {
  const ALL_KINDS: CoachKind[] = [
    'blocking-error',
    'english-to-french',
    'grammar-slip',
    'textbook-phrasing',
    'register-mismatch',
    'anglicism',
  ];
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

  test('English-to-French recasts always surface after the learner attempts', () => {
    for (const strictness of ALL_LEVELS) {
      assert.equal(surfacePolicy('english-to-french', strictness), 'inline', strictness);
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

  test('a blocking error never silences the English hand-back', () => {
    // G7. blocking-error outranks english-to-french and flow allows one inline
    // finding, so a learner who asked how to say something heard "Not quite"
    // and never got their answer. The hand-back answers the learner rather than
    // interrupting them, so it neither spends the budget nor waits for it.
    const items = [
      sampleCoachItem({ kind: 'blocking-error', quote: 'a' }),
      sampleCoachItem({ kind: 'english-to-french', quote: 'b' }),
    ];
    const { inline, deferred } = splitCoach(items, 'flow');
    assert.deepEqual(
      inline.map((i) => i.kind),
      ['blocking-error', 'english-to-french'],
    );
    assert.equal(deferred.length, 0);
  });

  test('the exempt hand-back does not spend the budget the other findings share', () => {
    const items = [
      sampleCoachItem({ kind: 'english-to-french', quote: 'a' }),
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'b' }),
      sampleCoachItem({ kind: 'textbook-phrasing', quote: 'c' }),
    ];
    const { inline, deferred } = splitCoach(items, 'flow');
    assert.equal(inline.filter((i) => i.kind === 'textbook-phrasing').length, INLINE_CAP.flow);
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

describe('splitCoach — the cooldown between interruptions', () => {
  /**
   * The bug: INLINE_CAP is a budget per turn, so a budget of one spent every
   * turn is an interruption every turn. At A0 every utterance is textbook
   * French and textbook-phrasing surfaces inline at every strictness, so the
   * tutor corrected on every single turn on its loosest setting. Reported as
   * "it never just reacts".
   */
  const textbook = (quote: string) => sampleCoachItem({ kind: 'textbook-phrasing', quote });

  test('the first finding of a session is never held back', () => {
    const { inline } = splitCoach([textbook('a')], 'flow');
    assert.equal(inline.length, 1, 'with no interruption behind it there is nothing to cool down from');
  });

  test('a second correction on the very next turn waits instead of interrupting again', () => {
    const { inline, deferred } = splitCoach([textbook('a')], 'flow', 1);
    assert.equal(inline.length, 0);
    assert.equal(deferred.length, 1, 'nothing surfaced is still nothing lost');
  });

  test('the cooldown expires, so coaching resumes rather than stopping', () => {
    const { inline } = splitCoach([textbook('a')], 'flow', INLINE_COACH_COOLDOWN_TURNS);
    assert.equal(inline.length, 1);
  });

  test('a turn that interrupts says so, so the caller can restart the clock', () => {
    assert.equal(splitCoach([textbook('a')], 'flow').interrupted, true);
    assert.equal(splitCoach([textbook('a')], 'flow', 1).interrupted, false);
    assert.equal(splitCoach([], 'flow').interrupted, false);
  });

  test('a comprehension breakdown is coached even mid-cooldown', () => {
    // Withholding this to keep the rhythm pleasant strands the learner inside
    // the scene, which costs more than the interruption saves.
    const { inline } = splitCoach([sampleCoachItem({ kind: 'blocking-error', quote: 'a' })], 'flow', 1);
    assert.equal(inline.length, 1);
  });

  test('an English hand-back is never held back, because it answers a question', () => {
    const { inline } = splitCoach([sampleCoachItem({ kind: 'english-to-french', quote: 'a' })], 'flow', 1);
    assert.equal(inline.length, 1);
  });

  test('answering the learner never buys the tutor silence on the next turn', () => {
    // Both exempt kinds pass through without spending the budget, so a learner
    // who asks for help does not thereby lose the next thing worth saying.
    for (const kind of ['english-to-french', 'blocking-error'] as const) {
      assert.equal(splitCoach([sampleCoachItem({ kind, quote: 'a' })], 'flow').interrupted, false, kind);
    }
  });

  test('the cooldown holds things back without making them ineligible', () => {
    // surfacePolicy is the product commitment and this must not touch it:
    // textbook phrasing still surfaces inline at every strictness. The cooldown
    // is about when, never about whether.
    for (const strictness of ['flow', 'balanced', 'strict'] as Strictness[]) {
      assert.equal(surfacePolicy('textbook-phrasing', strictness), 'inline', strictness);
    }
  });

  test('a caller that tracks nothing behaves exactly as before', () => {
    const items = [textbook('a'), textbook('b')];
    const withoutClock = splitCoach(items, 'balanced');
    const longAgo = splitCoach(items, 'balanced', Number.POSITIVE_INFINITY);
    assert.deepEqual(withoutClock.inline, longAgo.inline);
    assert.deepEqual(withoutClock.deferred, longAgo.deferred);
  });
});
