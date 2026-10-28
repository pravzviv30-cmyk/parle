import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CAFE_LESSON,
  CORRECTION_COOLDOWN_TURNS,
  createSession,
  submitTurn,
  type LearnerInput,
} from '@luvani/core';

import {
  INLINE_CAP,
  INLINE_COACH_COOLDOWN_TURNS,
  assessmentToQuality,
  highValueSlip,
  splitCoach,
  surfacePolicy,
} from './grading.ts';
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

  // F906: at balanced the table still says recap; splitCoach lifts only the
  // few high-value slips (highValueSlip) out of it, one per turn.
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

  /**
   * F205. How often a learner is interrupted is one decision, and it was taken
   * twice: this module declared `2` and `packages/core/src/session/session.ts`
   * declared `2` again, held level by a comment and by a test asserting the
   * literal in both files. That caught drift, but only after somebody had
   * written it, which is a test standing in for a type system.
   *
   * Core is the shared leaf and brain already depends on it, so the number went
   * home to core and this module re-exports it. The pin is mechanical now, and
   * this test is what says so: one declaration, and both modes are driven by it
   * rather than by a number that happens to look the same.
   */
  test('the correction cooldown has one home and both modes read it', () => {
    assert.equal(INLINE_COACH_COOLDOWN_TURNS, CORRECTION_COOLDOWN_TURNS);

    // One home. A re-typed literal here is exactly the drift the old pinning
    // test existed to catch, and this catches it before the values differ
    // rather than after.
    const source = readFileSync(new URL('./grading.ts', import.meta.url), 'utf8');
    const declared = source.match(/^export const INLINE_COACH_COOLDOWN_TURNS = (.+);$/m)?.[1];
    assert.equal(
      declared,
      'CORRECTION_COOLDOWN_TURNS',
      'the conversation is declaring its own cooldown again instead of reading core’s',
    );

    // The conversation reads it: one turn short of the cooldown holds the
    // interruption back, and the cooldown itself lets it through.
    assert.equal(splitCoach([textbook('a')], 'flow', CORRECTION_COOLDOWN_TURNS - 1).inline.length, 0);
    assert.equal(splitCoach([textbook('a')], 'flow', CORRECTION_COOLDOWN_TURNS).inline.length, 1);

    // And the scripted lesson reads the same one. Driven through core's own
    // engine rather than asserted about it: a learner who misses every line,
    // and the rule that decides whether each miss is answered out loud.
    const wrong: LearnerInput = { type: 'spoke', transcript: 'un éléphant', durationSec: 2, phonemes: [] };
    let state = createSession(CAFE_LESSON);
    let corrections = 0;
    let held = 0;
    for (let guard = 0; guard < 20 && !state.finished; guard += 1) {
      const waited = state.turnsSinceCorrection;
      const { state: next, feedback } = submitTurn(CAFE_LESSON, state, wrong);
      // Only a miss that is getting the same line again is a candidate: a turn
      // the lesson has already moved past answers the learner instead.
      if (feedback.quality === 'poor' && !feedback.advanced && !feedback.rescued) {
        const corrected = next.turnsSinceCorrection === 0;
        assert.equal(
          corrected,
          waited >= CORRECTION_COOLDOWN_TURNS,
          `the lesson corrected on its own schedule: waited ${waited}, cooldown ${CORRECTION_COOLDOWN_TURNS}`,
        );
        if (corrected) corrections += 1;
        else held += 1;
      }
      state = next;
    }
    assert.ok(corrections >= 2, `only ${corrections} corrections, so the schedule was never exercised twice`);
    assert.ok(held >= 1, 'no correction was ever held back, so the cooldown proved nothing here');
  });
});

const slip = (quote: string, better: string, betterWritten: string | null = null) =>
  sampleCoachItem({ kind: 'grammar-slip', quote, better, betterWritten, weight: 'minor' });

describe('highValueSlip: the few slips Balanced shows now (F906)', () => {
  const cases: Array<[string, string, ReturnType<typeof highValueSlip>]> = [
    ["j'ai allé au cinéma", 'je suis allé au cinéma', 'auxiliary'],
    ['Samedi, j’ai allé au cinéma', 'Samedi, je suis allé au cinéma', 'auxiliary'],
    ['elle a venue hier', 'elle est venue hier', 'auxiliary'],
    ['nous avons partis tôt', 'nous sommes partis tôt', 'auxiliary'],
    ['ils ont tombé', 'ils sont tombés', 'auxiliary'],
    ['Je vais à le restaurant', 'Je vais au restaurant', 'contraction'],
    ['À LE marché', 'Au marché', 'contraction'],
    ['je parle à les enfants', 'je parle aux enfants', 'contraction'],
    ['le prix de le café', 'le prix du café', 'contraction'],
    ['la plupart de les gens', 'la plupart des gens', 'contraction'],
    ['la croissant', 'le croissant', 'gender'],
    ['un baguette, merci', 'une baguette, merci', 'gender'],
    ['Ma frère et mon sœur', 'Mon frère et ma sœur', 'gender'],
    ['ce table est libre', 'cette table est libre', 'gender'],
    // Negatives.
    ['les fille sont content', 'les filles sont contentes', null],
    ["j'ai mangé", "j'ai mangé quelque chose", null],
    ["j'ai mangé", 'je suis mangé', null],
    ['il a le temps', 'il a du temps libre', null],
    ['je suis content de les voir', 'je suis content de les voir demain avec des amis', null],
    ['Je voudrais un café', "J'voudrais un café", null],
    ['un pain', 'une baguette', null],
    ['je mange le pomme rouge', 'je mange la pomme', null],
    ['à l’hôtel', 'à l’hôtel', null],
    ['au la boulangerie', 'à la boulangerie', null],
    ['Je vais bien', 'Ça va bien', null],
  ];
  for (const [quote, better, expected] of cases) {
    test(`"${quote}" -> "${better}" is ${expected ?? 'not high value'}`, () => {
      assert.equal(highValueSlip(slip(quote, better)), expected);
    });
  }

  test('the written form counts when the spoken one is reduced', () => {
    assert.equal(highValueSlip(slip("j'ai allé", "j'suis allé", 'je suis allé')), 'auxiliary');
  });
});

describe('splitCoach: high-value slips at balanced (F906)', () => {
  test('at balanced a passé composé auxiliary error surfaces inline', () => {
    const { inline } = splitCoach([slip("j'ai allé au cinéma", 'je suis allé au cinéma')], 'balanced');
    assert.equal(inline.length, 1);
  });

  test('at balanced an uncontracted à le surfaces inline', () => {
    const { inline } = splitCoach([slip('à le restaurant', 'au restaurant')], 'balanced');
    assert.equal(inline.length, 1);
  });

  test('at balanced a determiner gender slip surfaces inline', () => {
    const { inline, interrupted } = splitCoach([slip('la croissant', 'le croissant')], 'balanced');
    assert.equal(inline.length, 1);
    assert.equal(interrupted, true, 'it is an uninvited note, so it starts the cooldown');
  });

  test('at balanced an agreement slip still waits for the recap', () => {
    const { inline, deferred } = splitCoach([slip('les fille sont content', 'les filles sont contentes')], 'balanced');
    assert.equal(inline.length, 0);
    assert.equal(deferred.length, 1);
  });

  test('the cooldown still holds a high-value slip back', () => {
    const { inline, deferred } = splitCoach([slip('à le restaurant', 'au restaurant')], 'balanced', 1);
    assert.equal(inline.length, 0);
    assert.equal(deferred.length, 1);
  });

  test('at most one grammar slip surfaces inline per turn at balanced', () => {
    const { inline, deferred } = splitCoach(
      [slip("j'ai allé", 'je suis allé'), slip('à le restaurant', 'au restaurant')],
      'balanced',
    );
    assert.equal(inline.length, 1);
    assert.equal(deferred.length, 1);
  });

  test('flow still holds a high-value slip for the recap', () => {
    const { inline } = splitCoach([slip("j'ai allé", 'je suis allé')], 'flow');
    assert.equal(inline.length, 0);
  });

  test('a high-value slip spends the balanced cap like any other finding', () => {
    const { inline, deferred } = splitCoach(
      [
        sampleCoachItem({ kind: 'textbook-phrasing', quote: 'a' }),
        sampleCoachItem({ kind: 'anglicism', quote: 'b' }),
        slip('à le restaurant', 'au restaurant'),
      ],
      'balanced',
    );
    assert.equal(inline.length, INLINE_CAP.balanced);
    assert.equal(deferred.length, 1);
    assert.equal(deferred[0]!.kind, 'grammar-slip');
  });
});
