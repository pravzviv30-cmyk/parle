/**
 * The microphone meter's numbers (come alive, README Part 5.C row 7). Pure.
 *
 * expo-audio reports a recording's level as `metering`, in decibels from about
 * -160 (silence) to 0. The meter reads -50 dB and below as nothing and 0 dB as
 * full, which is the range a voice near a phone actually moves through. Five
 * bars share that one level, the middle tallest, so the meter reads as a voice
 * rather than a graph. Every number on it is the real level of the take that is
 * recording; nothing moves on a timer.
 */

/** The level below which the meter reads as silence. */
export const METER_FLOOR_DB = -50;

/** Each bar's share of the level, left to right. */
export const BAR_SHAPE = [0.6, 0.85, 1, 0.85, 0.6] as const;

/** A bar at rest stands at this share of its height, so a quiet meter is still a meter. */
export const BAR_REST = 0.25;

/** Above this level the meter says it hears a voice. About -45 dB. */
export const HEARING_LEVEL = 0.1;

/** A metering reading as a level from 0 to 1. A missing or broken reading is silence. */
export function meterLevel(db: number | null | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

/** Each bar's height, as a share of its full height, at this level. */
export function barScales(level: number): number[] {
  const held = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  return BAR_SHAPE.map((share) => BAR_REST + (1 - BAR_REST) * held * share);
}

/** Whether the level is a voice rather than the room. */
export function hearsVoice(level: number): boolean {
  return level > HEARING_LEVEL;
}
