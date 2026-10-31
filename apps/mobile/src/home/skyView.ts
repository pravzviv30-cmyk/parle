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
import { greetingWord, localHour, withinWindow, type HourWindow } from './greeting.ts';
import { ROWS_FONT_SCALE } from '../game/todayHeroView.ts';

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

/**
 * The greeting as the sky draws it: "Bonjour," over "Léa.", or "Bonjour."
 * alone with no name. The screen reader hears `homeGreeting`'s one title.
 */
export function greetingLines(greeting: { word: string; name: string | null }): string[] {
  return greeting.name === null ? [`${greeting.word}.`] : [`${greeting.word},`, `${greeting.name}.`];
}

/** The profile button's disc, and the band's side padding (space(4) + space(1)), for keeping clouds clear of it. */
const PROFILE_DISC = 44;
const BAND_SIDE = 20;
const CLOUD_CLEAR = 8;
/** Below this the profile button: a cloud lower than it may run to the disc. */
const BELOW_PROFILE = PROFILE_DISC + 4;

export interface CloudPlace { left: number; top: number; width: number; opacity: number }

/**
 * Where the sky's two clouds sit (fix round 1): in the band's top area, right
 * of the greeting, around the sun or moon. Tops are measured from the head
 * (the greeting's row, under the top inset). One about 16pt down at 48%
 * across, one about 56pt down at 66% across, sized with the width; each
 * starts right of the greeting's measured edge, and the upper one stops short
 * of the profile button. A cloud with too little room is left out.
 */
export function cloudPlaces(width: number, greetingRight: number | null): CloudPlace[] {
  const scale = width / 390;
  const edge = (greetingRight ?? width * 0.5) + CLOUD_CLEAR;
  const specs = [
    { at: 0.48, top: 16, size: 120, opacity: 0.35 },
    { at: 0.66, top: 56, size: 80, opacity: 0.25 },
  ];
  const places: CloudPlace[] = [];
  for (const spec of specs) {
    const left = Math.max(width * spec.at, edge);
    const limit = spec.top < BELOW_PROFILE ? width - BAND_SIDE - PROFILE_DISC - CLOUD_CLEAR : width;
    const size = Math.min(spec.size * scale, limit - left);
    if (size < 40) continue;
    places.push({ left: Math.round(left), top: spec.top, width: Math.round(size), opacity: spec.opacity });
  }
  return places;
}

/**
 * Whether the sky's foot has scrolled up under the status bar (fix round 2):
 * the band's measured height less the bar's own height. Unmeasured, never.
 */
export function skyScrolledPast(scrollY: number, sky: { band: number; bar: number } | null): boolean {
  if (sky === null || !Number.isFinite(scrollY)) return false;
  return scrollY >= sky.band - sky.bar;
}

/**
 * The status bar's content over Today: light while Today is on top and the
 * sky is still under the bar; once it has scrolled past, the theme's own
 * (dark on light paper, light in dark mode). Not focused, Today sets none.
 */
export function skyBarStyle(input: { focused: boolean; scrolledPast: boolean; themeBar: 'dark' | 'light' }): 'dark' | 'light' | null {
  if (!input.focused) return null;
  return input.scrolledPast ? input.themeBar : 'light';
}

/** Whether a path row puts its trailing action under its words: at accessibility text sizes, the tiles' own cut-off (1.6). */
export function routeRowStacked(fontScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= ROWS_FONT_SCALE;
}

/**
 * Whether Today's one clock should move on (fix round 3): only when the sky's
 * window or the greeting's word differs between the clock drawn and now, so a
 * Today left open across 12:00, 18:00 or 22:00 redraws, and nothing else does.
 */
export function skyClockMoved(drawn: number, now: number): boolean {
  return skyNow(drawn, 'light').time !== skyNow(now, 'light').time || greetingWord(drawn) !== greetingWord(now);
}

/** The sky's disc as SkyBand draws it: 170pt, hanging 40pt past the top right corner. */
export const SKY_DISC = { size: 170, bleed: 40 } as const;
/** The clearance kept between the disc's circle and the greeting's measured box. */
const DISC_CLEAR = 8;
/** The head sits this far under the bar (TopInset's extra, space(2)). */
const HEAD_BELOW_BAR = 8;

/**
 * How far the sun or moon slides right, off the band, so its circle clears
 * the greeting's measured box by 8pt (fix round 5). White words never sit on
 * the disc (about 1.6:1 against the morning sun), and nothing is capped, so
 * no word is ever split for it. The disc is 170pt and hangs 40pt past the
 * top right corner of the band; the box is the greeting's own layout,
 * relative to the head (which starts `bar` + 8 below the band's top), with
 * `left` and `right` across the band. Zero before the box is measured, when
 * it already clears, and for any input that is not a number; at most fully
 * off the band.
 */
export function discShiftFor(input: { width: number; bar: number | null; box: { left: number; right: number; top: number; bottom: number } | null }): number {
  const { width, bar, box } = input;
  if (box === null || bar === null) return 0;
  if (![width, bar, box.left, box.right, box.top, box.bottom].every(Number.isFinite)) return 0;
  const r = SKY_DISC.size / 2;
  const cx = width + SKY_DISC.bleed - r;
  const cy = r - SKY_DISC.bleed;
  const top = bar + HEAD_BELOW_BAR + box.top;
  const bottom = bar + HEAD_BELOW_BAR + box.bottom;
  const near = Math.min(Math.max(cy, top), bottom);
  const dy = Math.abs(near - cy);
  const reach = r + DISC_CLEAR;
  if (dy >= reach) return 0;
  const needed = box.right + Math.sqrt(reach * reach - dy * dy) - cx;
  const fullyOff = width - (cx - r);
  return Math.max(0, Math.min(Math.ceil(needed), fullyOff));
}
