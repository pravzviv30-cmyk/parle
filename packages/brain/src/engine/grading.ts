/**
 * Where model observations become decisions.
 *
 * The model reports what it saw (assessment, coach findings); this module owns
 * the two judgments that must never drift with a model's mood:
 *
 *   1. What the turn was worth — mapped onto core's TurnQuality so the same
 *      tested ladder that runs scripted lessons runs conversation. Coaching
 *      kinds never block promotion: a learner who said something correct but
 *      textbook still climbs. That mirrors core's principle that words-right
 *      and sounds-right are separate questions.
 *
 *   2. What surfaces now versus at the recap. Strictness moves *when* feedback
 *      lands, never *whether*. The one hard rule, pinned by test: correct-but-
 *      textbook phrasing surfaces inline at every strictness, because telling
 *      people what locals actually say is the product.
 */

import type { TurnQuality } from '@parle/core';
import type { Assessment, CoachItem, CoachKind } from '../contract/types.ts';
import type { Strictness } from '../types.ts';

export function assessmentToQuality(assessment: Assessment, coach: readonly CoachItem[]): TurnQuality {
  const blocked = coach.some((c) => c.kind === 'blocking-error');
  if (!assessment.understood) return 'poor';
  if (assessment.comprehensibility === 'breakdown') return 'poor';
  if (assessment.language === 'english' || assessment.language === 'none') return 'poor';
  if (blocked || !assessment.taskAchieved) return 'poor';
  if (assessment.comprehensibility === 'strained' || assessment.language === 'mixed') return 'partial';
  return 'good';
}

/** Most important first — orders inline coaching and the recap's fix list. */
export const KIND_PRIORITY: readonly CoachKind[] = [
  'blocking-error',
  'textbook-phrasing',
  'register-mismatch',
  'anglicism',
  'grammar-slip',
];

const SURFACE: Record<Strictness, Record<CoachKind, 'inline' | 'recap'>> = {
  flow: {
    'blocking-error': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'recap',
    anglicism: 'recap',
    'grammar-slip': 'recap',
  },
  balanced: {
    'blocking-error': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'inline',
    anglicism: 'inline',
    'grammar-slip': 'recap',
  },
  strict: {
    'blocking-error': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'inline',
    anglicism: 'inline',
    'grammar-slip': 'inline',
  },
};

/**
 * How many findings may interrupt the scene per turn. Overflow is not lost —
 * it joins the recap queue. A conversation is not a homework hand-back.
 */
export const INLINE_CAP: Record<Strictness, number> = { flow: 1, balanced: 2, strict: 3 };

export function surfacePolicy(kind: CoachKind, strictness: Strictness): 'inline' | 'recap' {
  return SURFACE[strictness][kind];
}

/** Split findings into what interrupts now and what waits for the end card. */
export function splitCoach(
  coach: readonly CoachItem[],
  strictness: Strictness,
): { inline: CoachItem[]; deferred: CoachItem[] } {
  const ordered = [...coach].sort((a, b) => {
    const byKind = KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    if (a.weight === b.weight) return 0;
    return a.weight === 'matters-now' ? -1 : 1;
  });

  const inline: CoachItem[] = [];
  const deferred: CoachItem[] = [];
  for (const item of ordered) {
    if (surfacePolicy(item.kind, strictness) === 'inline' && inline.length < INLINE_CAP[strictness]) {
      inline.push(item);
    } else {
      deferred.push(item);
    }
  }
  return { inline, deferred };
}
