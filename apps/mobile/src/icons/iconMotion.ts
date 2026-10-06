/**
 * The numbers icons move by: `AnimatedIcon`'s ten kinds and the selected tab's
 * pop in `nav/TabGlyph.tsx` (come alive, icons section 1.5 and 1.7).
 *
 * Pure and engine-free, like `motion/tokens.ts`, so a Node suite reads them.
 * Durations, curves and springs that are shared come from the motion tokens;
 * what is here belongs to one icon kind each. Degrees, points and shares of
 * the icon's size; durations in milliseconds.
 */

/** The selected tab rises `lift` points and grows to `scale`, then the pop spring brings it home. */
export const TAB_POP = { scale: 1.15, lift: 2 } as const;

export const ICON_MOTION = {
  /** A reminder set: the bell swings about its top and pops once. */
  bell: {
    swing: [-16, 14, -10, 6, -3, 0],
    steps: [90, 90, 90, 90, 80, 80],
    pop: 1.12,
    origin: '50% 12%',
  },
  /** A phrase saved: the Bulk fill rises, the mark pops, three dots fly off. */
  bookmark: {
    reveal: 220,
    popAt: 160,
    pop: 1.2,
    unsave: 180,
    dots: [-45, -90, -135],
    dot: 4,
    travel: 10,
    fade: 260,
  },
  /** A choice ticked: the disc grows in, then the tick is wiped on from the left. */
  check: { from: 0.6, fill: 120, wipe: 200, wipeAt: 60 },
  /** A line playing: each arc breathes from `low` to full and back over `period`, the outer `lag` behind. */
  speaker: { low: 0.35, period: 700, lag: 140 },
  /** Today's streak: lit once, then a slow flicker while the screen is in view. */
  flame: {
    from: 0.3,
    peak: 1.25,
    tilt: -8,
    ignite: 420,
    grow: 1.06,
    sway: 2,
    period: 1600,
    glow: 0.75,
    glowLag: 400,
    origin: '50% 100%',
  },
  /** A retry: one turn on a press, a steady turn while busy. */
  refresh: { press: 600, busy: 900 },
  /** An account saved: the cloud rises in, the tick is wiped on, the whole pops. */
  cloud: { rise: 6, arrive: 180, wipeAt: 120, wipe: 200, pop: 1.1, check: 0.5 },
  /** Recording: two rings swell out from the microphone and fade, the second half a beat behind. */
  mic: { grow: 1.35, start: 0.6, period: 1100, lag: 550 },
  /** XP recorded: the star spins in and pops, four ticks fly out. */
  star: { peak: 1.3, rise: 120, tilt: -30, settle: 360, ticks: [0, 90, 180, 270], tick: { width: 2, height: 6 }, travel: 8, fade: 220 },
  /** A plan confirmed: the lock gives way to the open lock, whose shackle lifts and swings on its hinge. */
  lock: { fade: 180, lift: 3, swing: 20, pop: 1.08, hinge: '29% 40%' },
} as const;
