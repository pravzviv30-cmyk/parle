/**
 * What a generated icon is, and the one number it shares.
 *
 * Hand-written, so `scripts/icons/build-icons.mjs` never touches it: it has no
 * generated header. Every generated `<Pascal>.tsx` imports its type from here,
 * and the Bulk ones import `SECONDARY_OPACITY`. It lives apart from `Icon.tsx`
 * because `Icon.tsx` reads the registry, the registry imports every drawing,
 * and a drawing importing `Icon.tsx` back would be a cycle.
 *
 * Pure: no engine, no renderer, so a Node suite may import it.
 */

import type { ReactElement } from 'react';

/**
 * The opacity of a Bulk icon's second layer: the soft fill behind the mark.
 * Iconsax draws it at 0.4; the generator writes this name, never the number.
 */
export const SECONDARY_OPACITY = 0.4;

/** Linear for controls; Bulk for tiles, tabs and states. */
export type IconVariant = 'linear' | 'bulk';

/** What every drawing is handed: its size in points and its two token colours. */
export type IconPaint = {
  readonly size: number;
  /** The mark. */
  readonly color: string;
  /** The Bulk second layer, drawn at `SECONDARY_OPACITY`. Usually the mark's own colour. */
  readonly secondary: string;
};

/** One drawing: a decorative 24-box Svg at the size it is given. */
export type IconDraw = (paint: IconPaint) => ReactElement;

/** One generated icon: its Linear drawing, its Bulk one when it has one, and any named parts. */
export type IconDrawings = {
  readonly linear: IconDraw;
  readonly bulk?: IconDraw;
  /**
   * The same drawing split into named parts, so `AnimatedIcon` can move one
   * part (a speaker's arcs, a lock's shackle) and hold the rest still. Stacked,
   * a variant's parts draw exactly what that variant draws whole.
   */
  readonly parts?: Readonly<Partial<Record<IconVariant, Readonly<Record<string, IconDraw>>>>>;
};
