/** Shared phone/tablet geometry; window width also follows iPad split view. */
export function screenInsets(width: number, left: number, right: number, padded = true) {
  const gutter = padded ? 20 : 0;
  const spare = Math.max(0, (width - left - right - 800) / 2);
  return { paddingLeft: left + spare + gutter, paddingRight: right + spare + gutter };
}

export function navigationWidth(width: number, left: number, right: number) {
  return Math.max(0, Math.min(640, width - left - right - 16));
}

/** Compact phones keep the five goal choices discoverable; text still scales and scrolls. */
export function compactPhone(width: number, height: number) {
  return width <= 360 && height < 760;
}

/**
 * The reading column (come alive, icons section 3.6): the first run's pages and
 * sheets sit in a centred 560-point column on an iPad, so a line of copy and a
 * row of choices stay the width a phone gives them rather than stretching
 * across the content column.
 */
export const READING = 560;

/** Regular width is based on usable space, including iPad split view. */
export function layoutClass(width: number, left: number, right: number): 'compact' | 'regular' {
  return width - left - right >= 700 ? 'regular' : 'compact';
}
export const FOOTER_MAX = 480;
