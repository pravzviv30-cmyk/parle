/**
 * How tall the drill's answer sheet may grow (drill B v2, UI-016).
 *
 * The sheet takes its natural height up to this cap. Past it, the sheet's body
 * scrolls and Continue stays pinned at its foot, so a waiting sheet's one way
 * on is always fully on screen: at 320x640, and at accessibility-large text.
 * The frame's scroll area above shrinks to give the sheet room, and keeps at
 * least `SHEET_BODY_FLOOR` points of the exercise visible above it.
 *
 * Pure, so `sheetLayout.test.ts` holds it.
 */

/** The share of the usable height the sheet may take. */
export const SHEET_SHARE = 0.72;
/** The least of the exercise kept visible above the sheet, in points. */
export const SHEET_BODY_FLOOR = 140;
/** The least the cap ever is: a headline and a Continue. */
export const SHEET_MIN = 160;

/** The sheet's height cap for a screen with `usableHeight` points between the insets. */
export function sheetMaxHeight(usableHeight: number): number {
  const share = Math.round(usableHeight * SHEET_SHARE);
  return Math.max(SHEET_MIN, Math.min(share, usableHeight - SHEET_BODY_FLOOR));
}
