/**
 * The arithmetic behind a moving scene. No React, no react-native, so it can
 * actually be tested.
 *
 * ## The bug this file exists to make unrepeatable
 *
 * A scene is drawn in a 200x150 viewBox and rendered at some other width, so
 * everything inside it scales. A moving piece is a SEPARATE `<Svg>` layered on
 * top, absolutely positioned, and it does not scale unless somebody remembers
 * to make it.
 *
 * Nobody remembered. `SplashScreen` draws its cafe at 260 wide, a scale of
 * 1.3, so the cup's 2.2 stroke renders at 2.86px. The steam above it is its
 * own 44x44 box drawn at width 44, a scale of 1.0, so it renders at 2.2px. The
 * steam is 23% thinner than the cup it rises from, and its position was worked
 * out by hand in a comment: "cup centre sits at viewBox x=70 -> 91px".
 *
 * `place()` does that arithmetic, and `Moving` sizes the child so its user
 * units are the parent's user units. One pen, one weight, computed.
 */

/** The viewBox every scene is drawn in. 4:3, and not negotiable. */
export const VIEW_W = 200;
export const VIEW_H = 150;

/** One settling entrance. Matches the splash, which set the vocabulary. */
export const SETTLE_MS = 380;
/** How far a settling piece travels, in container pixels. */
export const SETTLE_PX = 10;
/** One arrival. Slightly longer than a settle, because it carries further. */
export const ARRIVE_MS = 420;
/** The gap between two pieces arriving, so they read as a sequence. */
export const STAGGER_MS = 180;

/** Container pixels per viewBox unit. The 1.3 nobody should type by hand. */
export function unit(width: number): number {
  return width / VIEW_W;
}

/** A scene's rendered height. Scenes stay 4:3 whatever width they are given. */
export function frameHeight(width: number): number {
  return width * (VIEW_H / VIEW_W);
}

export interface Box {
  /** Centre of the piece, in viewBox coordinates. */
  readonly x: number;
  readonly y: number;
  /** The piece's own extent, in viewBox units. */
  readonly w: number;
  readonly h: number;
}

export interface Placed {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a moving piece goes, in CONTAINER pixels, given where it sits in the
 * viewBox. The piece is centred on (x, y), because a scene is authored by
 * pointing at the middle of a thing rather than at its corner.
 */
export function place(box: Box, width: number): Placed {
  const u = unit(width);
  return {
    left: (box.x - box.w / 2) * u,
    top: (box.y - box.h / 2) * u,
    width: box.w * u,
    height: box.h * u,
  };
}

/**
 * Where a driver sits when movement is withheld, either because the OS asked
 * for reduced motion or because the screen is not on top.
 *
 * A loop rests in the MIDDLE of its travel, not at either end: the ends are
 * the extremes of the movement and the middle is the drawing. An arrival rests
 * at 1, which is the frame it was always heading for.
 *
 * This is the rule DESIGN.md states as "reduce-motion renders the final frame,
 * not nothing". A scene is the content; the movement is the flourish.
 */
export function restFor(kind: 'loop' | 'arrival'): number {
  return kind === 'loop' ? 0.5 : 1;
}
