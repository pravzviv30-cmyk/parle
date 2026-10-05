/**
 * When a number counting up may tick (CountUp, come alive section 3).
 *
 * A count is felt as steps, not a buzz, and heard as a few clicks, not a
 * rattle. So one run ticks by touch at most 12 times, at least 70 ms apart, and
 * by sound at most 10 times, at least 90 ms apart. It never ticks on the final
 * value: the moment the number lands belongs to whatever shows it (a template's
 * landing beat), and a tick there would answer the same moment twice. A step
 * that shows the number it already showed does not tick either.
 *
 * Pure and clock-free: the caller passes the time of each step, so a Node suite
 * can drive a whole run without waiting for one.
 */

/** Which ticks a count makes. */
export type TickKind = 'haptic' | 'sound' | 'both' | 'none';

/** The most ticks one run may make, and the least gap between two of them. */
export type TickRule = { readonly max: number; readonly gapMs: number };

/** A selection tick under the finger. */
export const HAPTIC_TICKS: TickRule = { max: 12, gapMs: 70 };

/** The count-tick sound. */
export const SOUND_TICKS: TickRule = { max: 10, gapMs: 90 };

/** What one step of a count may fire. */
export type Tick = { readonly haptic: boolean; readonly sound: boolean };

const SILENT: Tick = { haptic: false, sound: false };

/** A gate that opens at most `rule.max` times, never closer than `rule.gapMs` together. */
function gate(rule: TickRule): (at: number) => boolean {
  let fired = 0;
  let last = Number.NEGATIVE_INFINITY;
  return (at) => {
    if (fired >= rule.max || at - last < rule.gapMs) return false;
    fired += 1;
    last = at;
    return true;
  };
}

/**
 * One run of a count towards `final`.
 *
 * `step(at, value)` is called each time the shown number changes, with the time
 * in milliseconds; it answers which ticks may fire and counts the ones it
 * allows. A new run (a new target) needs a new one.
 */
export function createCountTicks(final: number, kind: TickKind): { step: (at: number, value: number) => Tick } {
  const touch = kind === 'haptic' || kind === 'both' ? gate(HAPTIC_TICKS) : null;
  const sound = kind === 'sound' || kind === 'both' ? gate(SOUND_TICKS) : null;
  let shown: number | null = null;
  return {
    step(at, value) {
      const moved = value !== shown;
      shown = value;
      if (!moved || value === final) return SILENT;
      return { haptic: touch !== null && touch(at), sound: sound !== null && sound(at) };
    },
  };
}
