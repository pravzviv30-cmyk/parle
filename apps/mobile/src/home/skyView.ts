/**
 * Today's sky (UI-015, direction A), as a rule rather than as part of a screen.
 *
 * The band behind the greeting follows the hour: morning, afternoon, evening
 * and night, a sun by day and a moon from the evening on. The evening starts
 * with Bonsoir, so the sky and the greeting word under it can never describe
 * two parts of one day (the suite checks all twenty-four hours).
 *
 * In dark mode the sky has two states only, day and night, so it never
 * brightens a dark screen at noon.
 *
 * No React, no clock read: the hour arrives as an argument.
 */

import { sky } from '../palette.ts';
import { localHour, withinWindow, type HourWindow } from './greeting.ts';

export type SkyTime = 'morning' | 'afternoon' | 'evening' | 'night';

/** The four windows tile the clock; night wraps around midnight. */
export const SKY_WINDOWS: readonly { time: SkyTime; hours: HourWindow }[] = [
  { time: 'morning', hours: { from: 5, to: 12 } },
  { time: 'afternoon', hours: { from: 12, to: 18 } },
  { time: 'evening', hours: { from: 18, to: 22 } },
  { time: 'night', hours: { from: 22, to: 5 } },
];

export interface SkyView {
  time: SkyTime;
  discKind: 'sun' | 'moon';
  ground: string;
  disc: string;
  chip: string;
  lip: string;
}

/** The sky at `hour`. An hour nobody can read lands on the afternoon, as the greeting lands on midday. */
export function skyView(hour: number, mode: 'light' | 'dark'): SkyView {
  const match = Number.isFinite(hour) ? SKY_WINDOWS.find((window) => withinWindow(hour, window.hours)) : undefined;
  const time: SkyTime = match?.time ?? 'afternoon';
  const day = time === 'morning' || time === 'afternoon';
  const colours = mode === 'dark' ? (day ? sky.dark.day : sky.dark.night) : sky.light[time];
  return { time, discKind: day ? 'sun' : 'moon', ground: colours.ground, disc: colours.disc, chip: colours.chip, lip: colours.lip };
}

/** The sky at the timestamp `now`, through the greeting's own local hour. */
export function skyNow(now: number, mode: 'light' | 'dark'): SkyView {
  return skyView(localHour(now), mode);
}
