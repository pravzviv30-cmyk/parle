/**
 * WCAG 2 contrast for test files: one copy of the luminance maths, so every
 * contrast test measures the same way (F921).
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a six digit `#RRGGBB` colour. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`${hex} is not a six digit hex`);
  const [r, g, b] = [0, 2, 4].map((at) => channel(Number.parseInt(h.slice(at, at + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The contrast ratio between two colours, 1 to 21. Order does not matter. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Non-text marks (borders, rings, focus): WCAG 1.4.11. */
export const MARK = 3;
/** Words: WCAG 1.4.3. */
export const WORDS = 4.5;
