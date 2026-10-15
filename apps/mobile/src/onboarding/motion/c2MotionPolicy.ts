import { C2_MOTION } from '../../motion/tokens.ts';

/** The rendered illustration follows screen visibility and the live OS preference. */
export function c2MotionRuns({ active, visible, foreground, reduced }: {
  active: boolean;
  visible: boolean;
  foreground: boolean;
  reduced: boolean | null | undefined;
}): boolean {
  return active && visible && foreground && reduced === false;
}

/** A full cycle has the same pose at both ends, including its velocity. */
export function c2FloatAmount(phase: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, phase));
  const triangular = t < 0.5 ? t * 2 : (1 - t) * 2;
  if (triangular === 0 || triangular === 1) return triangular;
  const [x1, y1, x2, y2] = C2_MOTION.inOut;
  // Figma's ease-in-out curve, inverted by bisection.
  let low = 0;
  let high = 1;
  let u = triangular;
  // Enough precision for offset gestures to keep the same velocity at the seam.
  for (let i = 0; i < 24; i++) {
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
    if (x < triangular) low = u;
    else high = u;
    u = (low + high) / 2;
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}

/** Phase offsets retain the authored still pose, including under Reduce Motion. */
export function c2GestureAmount(phase: number, offset = 0): number {
  'worklet';
  const start = ((offset % 1) + 1) % 1;
  if (phase <= 0 || phase >= 1) return 0;
  return c2FloatAmount((phase + start) % 1) - c2FloatAmount(start);
}
