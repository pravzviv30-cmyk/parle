/**
 * One grade per card position: a second tap on a grade tile before the next
 * card arrives must not grade the same card twice, re-queue it twice or skip a card.
 */
export function firstGradeAt(gradedAt: number | null, index: number): boolean {
  return gradedAt !== index;
}
