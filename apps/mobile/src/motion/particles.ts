/**
 * The confetti a burst throws, worked out before it moves (come alive section 3).
 *
 * Every piece is decided here, once, from a seed: its shape, its colour, the
 * angle and speed it leaves at, and how fast it spins. The same event key
 * always throws the same burst, so a celebration that is shown again (a resume,
 * a test) looks the same, and nothing here asks `Math.random`.
 *
 * The shapes are the illustrations' confetti vocabulary (ILLUSTRATIONS.md: 14
 * by 6 bars, dots, rings), and the colours are the four palette colours and the
 * card's white, never the highlighter and never the illustrations' lilac (the
 * palette tests hold both to their own few places). A colour that matches the
 * ground it falls on is left out, because a piece you cannot see is a piece
 * that only costs.
 *
 * Pure: the palette and the tokens, nothing else, so a Node suite loads it.
 * `particleFrame` is also the worklet each piece runs on the UI thread, so the
 * physics the suite checks is the physics the screen draws.
 */

import { colour, paper } from '../palette.ts';
import { BURST_MAX, DUR, IPAD_WIDTH } from './tokens.ts';

/** The names a burst's palette is written in. `paper` is the card's white. */
export type ConfettiColour = 'blue' | 'coral' | 'sun' | 'mint' | 'paper';

/** The only colours confetti is ever drawn in. */
export const CONFETTI_COLOURS: Readonly<Record<ConfettiColour, string>> = {
  blue: colour.blue,
  coral: colour.coral,
  sun: colour.sun,
  mint: colour.mint,
  paper: paper.card,
};

/** The illustrations' confetti, as views: a bar, a dot and a ring, in points. */
export const CONFETTI_SHAPES = {
  bar: { width: 14, height: 6, radius: 3, border: 0 },
  dot: { width: 8, height: 8, radius: 4, border: 0 },
  ring: { width: 10, height: 10, radius: 5, border: 2 },
} as const;

export type ConfettiShape = keyof typeof CONFETTI_SHAPES;

const SHAPES = Object.keys(CONFETTI_SHAPES) as ConfettiShape[];

/** How a burst flies: the fan it leaves in, how hard, how it spins, falls, slows and fades. */
export const BURST = {
  /** The width of the fan, in degrees, centred straight up. */
  spread: 110,
  /** The slowest and fastest a piece leaves at, in points a second. */
  power: [600, 1100] as const,
  /** The fastest a piece spins either way, in degrees a second. */
  spin: 540,
  /** Gravity, in points a second squared. */
  gravity: 1800,
  /** How much the air slows a piece sideways over its life. */
  drag: 0.35,
  /** The share of its life a piece stays fully opaque before it fades. */
  fadeFrom: 0.75,
  /** Its whole life, in seconds. */
  seconds: DUR.burst / 1000,
} as const;

export type Particle = {
  readonly shape: ConfettiShape;
  readonly colour: string;
  /** Sideways and upward speed as it leaves, in points a second (up is negative). */
  readonly vx: number;
  readonly vy: number;
  /** The angle it starts at and how fast it turns, in degrees and degrees a second. */
  readonly turn: number;
  readonly spin: number;
};

/** Where a piece is at one moment of its life, relative to where it left. */
export type ParticleFrame = { x: number; y: number; rotate: number; opacity: number };

/** A 32-bit seed from any key, FNV-1a, so an event key always gives the same burst. */
export function seedOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast, seeded generator of numbers from 0 up to 1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The most pieces a burst may throw on this device: a phone, an iPad (744 wide or more), or the web. */
export function burstLimit(platform: string, width: number): number {
  if (platform === 'web') return BURST_MAX.web;
  return width >= IPAD_WIDTH ? BURST_MAX.ipad : BURST_MAX.phone;
}

/**
 * Every piece of one burst.
 *
 * `count` is held to `limit` (the device's `burstLimit`), and both to the
 * largest burst the tokens allow. The palette is left as asked, less any
 * colour that matches `ground`; with nothing left there is nothing to throw.
 */
export function particles({
  seed,
  count,
  limit,
  palette = ['blue', 'sun', 'mint', 'paper'],
  ground,
  spread = BURST.spread,
  power = BURST.power,
}: {
  seed: string;
  count: number;
  limit: number;
  palette?: readonly ConfettiColour[];
  /** The ground the burst falls on; its own colour is left out. */
  ground?: ConfettiColour;
  spread?: number;
  power?: readonly [number, number];
}): Particle[] {
  const colours = palette.filter((name) => name !== ground && name in CONFETTI_COLOURS);
  const most = Math.min(limit, Math.max(BURST_MAX.phone, BURST_MAX.ipad, BURST_MAX.web));
  const total = Math.max(0, Math.min(Math.floor(count), most));
  if (colours.length === 0 || total === 0) return [];
  const next = mulberry32(seedOf(seed));
  const [slow, fast] = power;
  const out: Particle[] = [];
  for (let i = 0; i < total; i += 1) {
    const angle = ((-90 + (next() - 0.5) * spread) * Math.PI) / 180;
    const speed = slow + next() * (fast - slow);
    out.push({
      shape: SHAPES[Math.floor(next() * SHAPES.length)] ?? 'dot',
      colour: CONFETTI_COLOURS[colours[Math.floor(next() * colours.length)] ?? colours[0]!],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      turn: next() * 360,
      spin: (next() * 2 - 1) * BURST.spin,
    });
  }
  return out;
}

/**
 * Where a piece is at `progress` (0 to 1) through the burst's life: thrown,
 * slowed sideways by the air, pulled down, turning, and fading over its last
 * quarter. A worklet, so the UI thread runs this same function each frame.
 */
export function particleFrame(piece: Particle, progress: number): ParticleFrame {
  'worklet';
  const t = Math.min(1, Math.max(0, progress));
  const s = t * BURST.seconds;
  return {
    x: piece.vx * s * (1 - BURST.drag * s),
    y: piece.vy * s + 0.5 * BURST.gravity * s * s,
    rotate: piece.turn + piece.spin * s,
    opacity: t < BURST.fadeFrom ? 1 : Math.max(0, (1 - t) / (1 - BURST.fadeFrom)),
  };
}
