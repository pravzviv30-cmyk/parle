/**
 * The numbers the game art moves by (come alive, motion section 3 and the
 * StreakExtended template).
 *
 * Pure and engine-free, like `motion/tokens.ts` and `icons/iconMotion.ts`, so a
 * Node suite reads them. Shared durations, curves and springs come from the
 * motion tokens; what is here belongs to one drawing each. Scales are plain
 * factors, angles are degrees, distances are shares of the drawing's size,
 * and durations are milliseconds.
 */

import { DUR } from '../../motion/tokens.ts';

/**
 * The flame. Lighting: the grey flame fades as the lit one grows from an ember
 * on the pop spring, leaning in and straightening, its inner flame and then its
 * white core a beat behind. Flickering: the outer flame stretches upward from
 * its foot and the inner flame rises a little, a beat behind, a set number of
 * times each time it is asked to, then it rests. It never loops for good.
 */
export const FLAME_MOTION = {
  /** The lit flame grows from this scale to 1. */
  ember: 0.4,
  /** It leans this far as it lights, and straightens over `DUR.slow`. */
  tilt: -8,
  /** The inner flame grows from this scale, `innerLag` behind. */
  innerFrom: 0.5,
  innerLag: 80,
  /** The core grows from nothing, `coreLag` behind. */
  coreLag: 160,
  /** The grey flame under a lighting one fades over this. */
  fade: DUR.base,
  /** One flicker: up and back over this. */
  flickerMs: 1200,
  /** How many flickers each time it is asked to flicker. Finite: then it rests. */
  flickers: 3,
  /** The outer flame stretches to this height. */
  stretch: 1.05,
  /** The inner flame rises this share of the size, `riseLag` behind the stretch. */
  rise: 0.015,
  riseLag: 300,
  /** A flicker starts this long after it is asked for, so a flame that is lighting settles first. */
  wait: DUR.slow,
} as const;
