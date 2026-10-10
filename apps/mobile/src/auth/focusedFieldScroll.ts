/** Scroll within the measured body, which ends above a pinned action and keyboard. */
export function focusedFieldScroll(
  offset: number,
  viewportTop: number,
  viewportHeight: number,
  fieldTop: number,
  fieldHeight: number,
  gap = 8,
): number {
  if (viewportHeight <= 0 || fieldHeight <= 0) return offset;
  if (fieldTop < viewportTop + gap) return Math.max(0, offset + fieldTop - viewportTop - gap);
  const hiddenBottom = fieldTop + fieldHeight + gap - viewportTop - viewportHeight;
  return hiddenBottom > 0 ? Math.max(0, offset + hiddenBottom) : offset;
}
