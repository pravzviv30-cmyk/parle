/**
 * The tab bar's decisions, out of the component so they can be tested without
 * React Native (2026-10-20, UI-008, Figma C2/Main2/Navigation 292:1103): the
 * word and the Iconsax drawing per route, the capsule's width, when the words
 * wrap, and whether the Practice dot shows. `LuvaniTabBar.tsx` is the layout.
 */
import type { IconName } from '../icons/names.ts';

/** The tab routes, in bar order. Route names are what deep links spell; they do not move. */
export const MAIN_TABS = ['Home', 'Explore', 'Tutor', 'Practice', 'MyFrench'] as const;

/** The word under each glyph, and what a screen reader announces for the tab. */
export const TAB_LABELS: Readonly<Record<string, string>> = {
  Home: 'Today',
  Explore: 'Explore',
  Tutor: 'Speak',
  Practice: 'Practice',
  MyFrench: 'Journey',
};

/** Codex's Iconsax set: Linear when not selected, Bulk when selected. Speak is the control's own microphone. */
export const TAB_ICONS: Readonly<Record<string, IconName>> = {
  Home: 'home',
  Explore: 'exploring',
  Tutor: 'microphone',
  Practice: 'cards',
  MyFrench: 'progress',
};

/** The capsule's inset from each screen edge, after the safe areas (Figma: left 12 of 390). */
export const CAPSULE_INSET = 12;
/** The widest the capsule grows on a tablet, so five cells do not drift apart. */
export const CAPSULE_MAX = 640;

/** The capsule's width: 12pt in from each edge inside the safe areas, never wider than 640. */
export function tabCapsuleWidth(width: number, left: number, right: number): number {
  return Math.max(0, Math.min(CAPSULE_MAX, width - left - right - 2 * CAPSULE_INSET));
}

/**
 * The reading size at which the words stop fitting beside each other. Below it
 * the cells share the capsule by flex; at and above it every cell takes exactly
 * a fifth and a long word wraps inside it, and the cell grows taller.
 */
export const WRAPS_UNDER_GLYPH = 1.3;

/** Whether the words have to wrap under their glyphs at this reading size. */
export function labelsWrapUnderGlyph(fontScale: number): boolean {
  return fontScale >= WRAPS_UNDER_GLYPH;
}

/** The Practice dot: null until the deck has been read, then whether anything is due. Other tabs never carry it. */
export function tabDot(route: string, due: number | null): boolean | null {
  if (route !== 'Practice') return false;
  return due === null ? null : due > 0;
}

/** What a screen reader hears for a cell: the word, plus "practice ready" when the dot shows. */
export function tabAccessibilityLabel(route: string, dot: boolean | null): string {
  const label = TAB_LABELS[route] ?? route;
  return dot === true ? `${label}, practice ready` : label;
}
