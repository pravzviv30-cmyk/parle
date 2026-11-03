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

/** The label's size, `boldType.small` (13/18); tabBar.test.ts reads theme.ts to hold them equal, since theme.ts imports React Native. */
export const LABEL_SIZE = 13;
/** The longest tab word, in letters. */
export const WIDEST_LABEL = Math.max(...MAIN_TABS.map((r) => (TAB_LABELS[r] ?? r).length));
/**
 * A letter's width as a share of the type size, flat for every letter. Outfit
 * Bold's real advances average 0.48 to 0.59 of the size across the five words
 * (measured from the font file, 2026-10-31), so 0.6 errs toward hiding.
 */
export const LETTER_EM = 0.6;
/** What a cell gives its word: the capsule's 8pt side padding each side, then 4pt face padding each side. */
const CAPSULE_PAD = 16;
const FACE_PAD = 8;

/**
 * Whether the words show under the icons (F947, founder decision 2026-10-31:
 * icons only at the largest sizes). Below the accessibility sizes nothing
 * changes. From there, when the widest word at this reading size cannot fit
 * whole in a fifth of the capsule, every tab shows its icon alone and is still
 * heard by its full name. `capsule` is the live capsule width (`tabCapsuleWidth`).
 */
export function tabLabelsShown(fontScale: number, capsule: number): boolean {
  if (!labelsWrapUnderGlyph(fontScale)) return true;
  const room = (capsule - CAPSULE_PAD) / 5 - FACE_PAD;
  return WIDEST_LABEL * LABEL_SIZE * LETTER_EM * fontScale <= room;
}

/** The cell under a finger `x` points into the capsule's row of `count` cells each `cell` wide, clamped to the row (item 7). */
export function tabCellAt(x: number, cell: number, count: number): number {
  if (cell <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(x / cell)));
}

/** The cell under a finger at `pageX`, measured from the capsule's left edge `capsuleX` and its inner padding `pad` (item 7, verifier fix). */
export function tabCellUnderFinger(pageX: number, capsuleX: number, pad: number, cell: number, count: number): number {
  return tabCellAt(pageX - capsuleX - pad, cell, count);
}
