/** Reveal the field group within the visible viewport without resetting its place. */
export function focusedFieldScroll(
  offset: number,
  viewportTop: number,
  viewportHeight: number,
  fieldTop: number,
  fieldHeight: number,
  gap = 8,
): number {
  if (viewportHeight <= 0 || fieldHeight <= 0) return offset;
  // At large reading sizes the whole group can be taller than the keyboard
  // viewport. Prioritise its label/input instead of alternating top/bottom.
  if (fieldHeight > viewportHeight - gap * 2) return Math.max(0, offset + fieldTop - viewportTop - gap);
  if (fieldTop < viewportTop + gap) return Math.max(0, offset + fieldTop - viewportTop - gap);
  const hiddenBottom = fieldTop + fieldHeight + gap - viewportTop - viewportHeight;
  return hiddenBottom > 0 ? Math.max(0, offset + hiddenBottom) : offset;
}
