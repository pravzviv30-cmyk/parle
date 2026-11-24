import type { GradeContext, ReviewGrade } from '@luvani/core';

/**
 * One grade per card position: a second tap on a grade tile before the next
 * card arrives must not grade the same card twice, re-queue it twice or skip a card.
 */
export function firstGradeAt(gradedAt: number | null, index: number): boolean {
  return gradedAt !== index;
}

/**
 * The grade a card is given, knowing which ids were missed with Again earlier
 * in this sitting (F1153). The answer was on screen seconds ago, so Got it or
 * Easy on one of them is helped recall, as LEARN-003 rules for drills: back
 * tomorrow at the same stage, with no recall count (founder, 2026-11-24). Easy
 * is read as an assisted Got it, since the scheduler's Easy has no assisted path.
 */
export function sittingGrade(
  id: string,
  grade: ReviewGrade,
  context: GradeContext,
  missed: ReadonlySet<string>,
): { grade: ReviewGrade; context: GradeContext } {
  if (grade === 'again' || !missed.has(id)) return { grade, context };
  return { grade: 'good', context: { ...context, assisted: true } };
}
