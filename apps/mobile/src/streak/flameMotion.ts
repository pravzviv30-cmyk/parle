/** Shared contour interpolation for the web player and the exact SVG still. */
export const FLAME_IGNITION_MS = 800;
export const FLAME_IDLE_MS = 4000;

export type FlameFrame = {
  amount: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

const REST: FlameFrame = { amount: 0, scaleX: 1, scaleY: 1, opacity: 1 };
const IGNITION = [
  { at: 0, amount: -.3, scaleX: .56, scaleY: .38, opacity: .25 },
  { at: 333.333, amount: 1.8, scaleX: 1.065, scaleY: 1.05, opacity: 1 },
  { at: 566.667, amount: -.65, scaleX: .985, scaleY: .98, opacity: 1 },
  { at: 800, ...REST },
] as const;

export function flameFrameAt(elapsedMs: number, ignition: boolean): FlameFrame {
  const elapsed = Math.max(0, elapsedMs);
  if (ignition && elapsed < FLAME_IGNITION_MS) {
    const end = IGNITION.findIndex(key => key.at > elapsed);
    const from = IGNITION[Math.max(0, end - 1)]!;
    const to = IGNITION[Math.max(1, end)]!;
    const progress = (elapsed - from.at) / (to.at - from.at);
    const eased = .5 - .5 * Math.cos(Math.PI * progress);
    const mix = (a: number, b: number) => a + (b - a) * eased;
    return { amount: mix(from.amount, to.amount), scaleX: mix(from.scaleX, to.scaleX), scaleY: mix(from.scaleY, to.scaleY), opacity: mix(from.opacity, to.opacity) };
  }
  const idleElapsed = elapsed - (ignition ? FLAME_IGNITION_MS : 0);
  const amount = Math.sin((idleElapsed % FLAME_IDLE_MS) / FLAME_IDLE_MS * Math.PI * 2);
  return { amount, scaleX: 1 - amount * .004, scaleY: 1 + amount * .006, opacity: 1 };
}

/** Every cubic handle and contour vertex moves; this never scales a still path. */
export function flamePath(poses: readonly (readonly number[])[], amount = 0): string {
  const base = poses[0]!;
  const target = poses[amount < 0 ? 2 : 1]!;
  const strength = Math.abs(amount);
  const coordinate = (index: number) => {
    const value = base[index]! + (target[index]! - base[index]!) * strength;
    return Number(value.toFixed(3));
  };
  let d = `M${coordinate(0)} ${coordinate(1)}`;
  for (let i = 2; i < base.length; i += 6) {
    d += ` C${coordinate(i)} ${coordinate(i + 1)} ${coordinate(i + 2)} ${coordinate(i + 3)} ${coordinate(i + 4)} ${coordinate(i + 5)}`;
  }
  return `${d} Z`;
}
