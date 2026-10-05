/**
 * What the progress ring's two halves share: its props and its geometry.
 *
 * `ProgressRing.tsx` draws on a device through an animated dash offset;
 * `ProgressRing.web.tsx` redraws the same offset from state on the web. Both
 * read this, so the ring is the same ring on either. Pure: no engine, no
 * renderer.
 */

import type { ReactNode } from 'react';

export type ProgressRingProps = {
  /** Where the ring starts, a fraction from 0 to 1. A real earlier value, or 0. */
  from?: number;
  /** The real stored fraction it draws to, from 0 to 1. Never invented. */
  to: number;
  /** The ring's outer diameter, in points. */
  size?: number;
  /** The width of its stroke, in points. */
  stroke?: number;
  /** The drawn part. A palette token. */
  color?: string;
  /** The part still to draw. A palette token. */
  track?: string;
  /** How long it takes to draw. A `DUR` token. */
  duration?: number;
  /** Wait before it starts, in milliseconds. */
  delay?: number;
  /** Called once the ring has drawn to `to`, or on the next tick under reduced motion. */
  onDone?: () => void;
  /** With a label the ring is announced as a progress bar; without one it is decorative and the centre speaks. */
  accessibilityLabel?: string;
  /** What sits in the middle of the ring. It does not turn with it. */
  children?: ReactNode;
};

/** A fraction held to 0 to 1, with anything that is not a number treated as 0. */
export function fraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** The circle the stroke runs along: its centre, its radius and its length. */
export function ringGeometry(size: number, stroke: number): { centre: number; radius: number; length: number } {
  const radius = Math.max(0, (size - stroke) / 2);
  return { centre: size / 2, radius, length: 2 * Math.PI * radius };
}
