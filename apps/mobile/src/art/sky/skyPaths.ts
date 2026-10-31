/** Today's sky drawings (UI-015), as on the board. Path data only; the drawings are still. */

export const CLOUD_VIEWBOX = { width: 120, height: 44 } as const;
/** Three puffs over a rounded base. */
export const CLOUD_PUFFS = [
  { cx: 30, cy: 28, r: 14 },
  { cx: 52, cy: 20, r: 18 },
  { cx: 76, cy: 27, r: 14 },
] as const;
export const CLOUD_BASE = { x: 16, y: 26, width: 76, height: 16, rx: 8 } as const;

export const DISC_VIEWBOX = 100;
/** A crescent opening to the lower left: an outer circle of r40 less an offset one. */
export const MOON_CRESCENT = 'M62 12A40 40 0 1 0 88 62A32 32 0 1 1 62 12Z';
