/**
 * The motion tokens: every duration, stagger, curve, spring and budget the app
 * moves by, written once.
 *
 * Pure on purpose. This file imports nothing, so a Node suite can read the
 * numbers without loading an animation engine, and a primitive that needs a
 * number takes it from here rather than writing its own. `motion/drive.ts` turns
 * these into Reanimated calls; `motion.ts` keeps the legacy `Animated` helpers
 * and the press scale literal that F597 pins.
 */

/** Durations in milliseconds. `instant` is what reduced motion lands with. */
export const DUR = {
  instant: 0,
  /** Fades on exit, icon nudges. */
  micro: 120,
  /** Selection fill, the selected ring, label swaps. */
  fast: 180,
  /** Entrances and page-level fades. */
  base: 260,
  /** The settling entrance; equal to `SETTLE_MS` in motion.ts. */
  settle: 380,
  /** Bloom, a card expanding. */
  slow: 420,
  /** A token's sideways travel. */
  flight: 480,
  /** A ring drawing in, art rising. */
  reveal: 650,
  /** A number counting up. */
  count: 900,
  /** A celebration template's core beat. */
  celebrate: 900,
  /** Confetti's whole life. */
  burst: 1400,
} as const;

/** Gaps between siblings arriving one after another. */
export const STAGGER = {
  /** Words. */
  tight: 40,
  /** Rows. */
  base: 60,
  /** Icon rows. */
  loose: 90,
  /** Stat tiles. */
  tiles: 140,
} as const;

/** A cubic bezier, as CSS writes one: x1, y1, x2, y2. */
export type Bezier = readonly [number, number, number, number];

/** The curves. `drive.ts` hands each to `Easing.bezier`. */
export const EASE = {
  /** The default entrance: arrives fast and settles. */
  out: [0.22, 1, 0.36, 1],
  /** The out-cubic the legacy settle uses, `Easing.out(Easing.cubic)`. */
  settle: [0.33, 1, 0.68, 1],
  /** A ring drawing, an expand or collapse, a sideways flight. */
  inOut: [0.65, 0, 0.35, 1],
  /** An exit that sets down. */
  in: [0.55, 0, 1, 0.45],
  /** A glint or a spinner. */
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, Bezier>;

/** C2's local illustration and brand loops, read from the approved Figma variants. */
export const C2_MOTION = {
  pageMs: 300,
  halfLoopMs: 2400,
  ringDelayMs: 800,
  ringRotationMs: 8800,
  inOut: [0.42, 0, 0.58, 1] as Bezier,
  linear: [0, 0, 1, 1] as Bezier,
} as const;

/** A spring in the physical numbers Reanimated takes. */
export type SpringToken = { readonly stiffness: number; readonly damping: number; readonly mass: number };

/**
 * How each spring is described: its response in seconds and its damping ratio,
 * the way iOS and STYLE section 11 describe one. The physical numbers below are
 * converted from these rather than eyeballed:
 *
 *   stiffness = (2 * PI / response)^2
 *   damping   = 2 * ratio * sqrt(stiffness * mass)
 *   mass      = 1
 *
 * press   0.30 s, 0.70: (2PI/0.30)^2 = 438.6, so 439; 2 * 0.70 * sqrt(439) = 29.33, so 29.3
 * pop     0.35 s, 0.55: (2PI/0.35)^2 = 322.3, so 322; 2 * 0.55 * sqrt(322) = 19.74, so 19.7
 * settle  0.50 s, 0.85: (2PI/0.50)^2 = 157.9, so 158; 2 * 0.85 * sqrt(158) = 21.37, so 21.4
 * snap    0.20 s, 0.80: (2PI/0.20)^2 = 987.0, so 987; 2 * 0.80 * sqrt(987) = 50.27, so 50.3
 *
 * `tokens.test.ts` holds every spring to its description.
 */
export const SPRING_SHAPE = {
  press: { response: 0.3, ratio: 0.7 },
  pop: { response: 0.35, ratio: 0.55 },
  settle: { response: 0.5, ratio: 0.85 },
  snap: { response: 0.2, ratio: 0.8 },
} as const;

export const SPRING = {
  /** The press: a little overshoot on release, by design. Unchanged from the legacy spring. */
  press: { stiffness: 439, damping: 29.3, mass: 1 },
  /** Chips, medals, numbers landing: about 12.6 percent overshoot. */
  pop: { stiffness: 322, damping: 19.7, mass: 1 },
  /** Bars and cards: under 1 percent overshoot. */
  settle: { stiffness: 158, damping: 21.4, mass: 1 },
  /** Detents and a knob letting go. */
  snap: { stiffness: 987, damping: 50.3, mass: 1 },
} as const satisfies Record<keyof typeof SPRING_SHAPE, SpringToken>;

/**
 * The stronger press, for option tiles, icon buttons, quest and goal tiles.
 * Controls (pills, links, rows) keep `PRESS_SCALE`, 0.97, which motion.ts
 * writes as a literal because F597 pins it there.
 */
export const PRESS_SCALE_TILE = 0.95;

/** The one pop a tile gives when it becomes the chosen one. */
export const SELECT_POP = 1.03;

/** How long the pop takes to rise before the pop spring brings it home. */
export const SELECT_POP_MS = 90;

/** The chosen tile's blue ring layer, at rest. A ring layer, never a shadow (F569). */
export const SELECT_RING_OPACITY = 0.16;

/** The longest a celebration may hold back the learner's next tap. */
export const INPUT_READY_MS = 600;

/** The end of any celebration's last beat. */
export const CELEBRATION_MAX_MS = 2600;

/** The most confetti pieces a burst may draw, by device. An iPad is a width of 744 or more. */
export const BURST_MAX = { phone: 36, ipad: 56, web: 24 } as const;

/** The narrowest window a burst treats as an iPad. */
export const IPAD_WIDTH = 744;

/*
 * The primitives' own numbers (come alive section 3). Each group belongs to the
 * one primitive its name says. They live here, beside the shared tokens, so no
 * primitive writes a number of its own and a Node suite can read every one.
 */

/**
 * How long a one-shot (an entrance, a count, a ring drawing in, a burst) waits
 * for the OS to say whether movement is reduced. Past this it plays the reduced
 * version: the final frame, at once.
 */
export const ANSWER_WAIT_MS = 300;

/** An entrance (Enter, StaggerIn): how far a thing travels as it fades in. */
export const ENTER_DISTANCE = 10;

/** StaggerIn: the whole cascade starts within this, however many children there are. */
export const STAGGER_SPAN_MS = 480;

/** A transcript bubble arriving (BubbleIn). The learner's rises further and grows a little. */
export const BUBBLE = {
  learner: { rise: 16, from: 0.96 },
  tutor: { rise: 8, from: 1 },
} as const;

/** CountUp: the shortest gap between two redraws of the shown number, about 30 a second. */
export const COUNT_FRAME_MS = 33;

/** LivingBar: the shine along the top of the fill, the spark at its edge, and the pop when it fills. */
export const LIVING_BAR = {
  /** The shine covers this share of the fill's height, from the top, */
  shine: 0.3,
  /** at this opacity. */
  shineOpacity: 0.25,
  /** The spark grows and shrinks once over this. */
  spark: 300,
  /** A full bar stretches to this height and springs back on the pop spring. */
  fullPop: 1.25,
} as const;

/** DiscBloom, the spec's Bloom: three flat discs, each a share of the radius at its own opacity. No gradient. */
export const BLOOM = {
  discs: [
    { size: 0.6, opacity: 0.3 },
    { size: 0.85, opacity: 0.18 },
    { size: 1.1, opacity: 0.1 },
  ],
  /** It grows from this scale. */
  from: 0.3,
  /** A held bloom rests at this scale. */
  rest: 0.92,
} as const;

/** TokenFlight: a chosen token flying to where it is kept. */
export const FLIGHT = {
  /** It appears this far above the centre of where it was chosen, */
  above: 40,
  /** at this scale, */
  from: 0.76,
  /** grows to this over `lift`, then lands on the pop spring at 1. */
  peak: 1.12,
  lift: 200,
  /** The fall to the target; the sideways travel takes `DUR.flight`, so the path curves. */
  rise: 360,
  /** The most tokens in the air at once. Another lands where it is going at once. */
  max: 2,
} as const;

/** Glint: one pass of light across a pill, once per mount. */
export const GLINT = {
  /** Three bands, each a share of the pill's width at its own opacity. */
  bands: [
    { width: 0.12, opacity: 0.1 },
    { width: 0.28, opacity: 0.24 },
    { width: 0.12, opacity: 0.1 },
  ],
  /** The tilt of the bands, in degrees. */
  tilt: 18,
  /** It travels from this share of the width to that one, */
  from: -0.4,
  to: 1.2,
  /** over this, on the linear curve, */
  pass: 240,
  /** after waiting this long once it is asked for. */
  wait: 700,
} as const;

/** MorphButton: the pill closing to a circle while it waits, and the check when it is done. */
export const MORPH = {
  /** The circle it closes to: the pill's own height. */
  size: 56,
  /** The label fades over this before the pill closes. */
  fade: 80,
  /** The pill closes to the circle, and opens again, over this. */
  close: 220,
  /** One turn of the spinner. */
  turn: 800,
  /** The spinner's arc, as a share of the circle. */
  arc: 0.25,
  /** The spinner stops turning after this, however long the wait. */
  spinMax: 30000,
  /** The check draws over this. */
  draw: 160,
  /** The finished check holds this long before the caller moves on. */
  hold: 600,
} as const;

/** LevelRing: two rings that swell with a live level from 0 to 1. */
export const LEVEL_RING = {
  /** At level L a ring scales to 1 + grow * L, */
  grow: 0.22,
  /** at opacity base + lift * L. */
  base: 0.25,
  lift: 0.6,
  /** The second ring follows the first over this. */
  follow: 140,
  /** Under reduced motion there is no scale, only these opacity steps, each from its level up. */
  steps: [
    { from: 0.75, opacity: 1 },
    { from: 0.45, opacity: 0.6 },
    { from: 0.15, opacity: 0.3 },
  ],
} as const;
