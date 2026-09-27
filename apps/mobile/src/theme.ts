/**
 * The French notebook with one highlighter.
 * Warm paper and near-black ink, one white card with a hairline and no shadow,
 * DM Sans Medium for the furniture and Fraunces for French only. The
 * chartreuse is a highlighter pen, never a surface. Voice signals, touch
 * floors, reading-size scaling and reduced motion keep their behaviour.
 * Raw colours live in palette.ts.
 */

import { Platform } from 'react-native';
import { paper } from './palette.ts';

export { paper, accent, highlight, signal, orb, rungColor, tint } from './palette.ts';
export type { TintName } from './palette.ts';

/**
 * What each rung asks of the learner, in words.
 *
 * The words themselves live in `tutor/rungLabel.ts` and are re-exported here so
 * every screen still reaches them beside the colour they go with. They had to
 * leave this file to be testable at all: theme.ts imports `Platform`, and the
 * mobile test runner has no react-native, which is the same reason `palette.ts`
 * exists. A sentence that names the tutor is a decision, and a decision nothing
 * can import is a decision nothing can check.
 */
export { rungLabel } from './tutor/rungLabel.ts';

export const font = {
  serif: 'Fraunces-SemiBold',
  serifBold: 'Fraunces-Bold',
  sans: 'DMSans-Regular',
  sansMedium: 'DMSans-Medium',
  sansBold: 'DMSans-Bold',
} as const;

/**
 * Type scale. Fraunces is for French only: every style set in the serif is a
 * French style by name. DM Sans Medium carries the UI heads and the regular cut
 * carries prose. Sizes are points and scale with the OS reading size; nothing
 * disables `allowFontScaling`.
 */
export const type = {
  /** Screen headline. */
  display: { fontFamily: font.sansMedium, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  /** Section head, big stat. */
  title: { fontFamily: font.sansMedium, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  /** The title of a card. */
  cardTitle: { fontFamily: font.sansMedium, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  /**
   * The French line that leads a screen. Always larger than any heading on the
   * screen it leads; `fitHero()` steps it 34, 30, 26 by length (`heroFit`).
   */
  frenchHero: { fontFamily: font.serif, fontSize: 34, lineHeight: 42 },
  /** The French line to say. Sentence case, never caps. */
  frenchLg: { fontFamily: font.serif, fontSize: 28, lineHeight: 36 },
  /** Inline French content — options and cards. */
  french: { fontFamily: font.serif, fontSize: 21, lineHeight: 28 },
  /**
   * French in a chip, where the phrase is a sample rather than the thing to
   * say. Momentum's hero shows two of the learner's own lines beside a count,
   * and at `french` a real sentence wraps to two lines and the chip stops
   * being a chip. Nothing is ever clipped to make it fit — no `numberOfLines`
   * anywhere in this app — so the size is the only lever, and this is the
   * smallest Fraunces that still reads as the voice rather than the furniture.
   */
  frenchSm: { fontFamily: font.serif, fontSize: 17, lineHeight: 23 },
  heading: { fontFamily: font.sansMedium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.sansMedium, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19 },
  /** The word under a bottom-tab glyph. Small enough to sit two to a cell. */
  tabLabel: { fontFamily: font.sansBold, fontSize: 12, lineHeight: 16 },
  /** Tiny caps label above a card or count. */
  label: {
    fontFamily: font.sansBold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  /** Button lettering. */
  button: { fontFamily: font.sansBold, fontSize: 16, lineHeight: 20 },
  /** IPA and notation. Never monospace-as-costume — this really is notation. */
  notation: { fontFamily: font.sansMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 },
} as const;

/**
 * The French hero's fit steps for a long line, after `type.frenchHero` at 34.
 * Each step is still larger than every UI head a card carries.
 */
export const heroFit = {
  /** Over sixteen characters. */
  long: { fontFamily: font.serif, fontSize: 30, lineHeight: 38 },
  /** Over thirty-two characters. */
  longest: { fontFamily: font.serif, fontSize: 26, lineHeight: 34 },
} as const;

/** 4pt base. Tight within a group, generous between groups. */
export const space = (n: number) => n * 4;

export const radius = {
  /** The one Card: white, a paper hairline, no shadow, never nested. */
  card: 16,
  /** Deprecated with TintRow; nothing new draws at it. */
  row: 8,
  chip: 6,
  input: 8,
  control: 8,
  /** The one ink pill, fully rounded like the logo's L. */
  pill: 999,
} as const;

/** The white disc that holds a glyph inside a tinted row. */
export const DISC = 44;

/** The one stroke weight: icons and illustrations alike. */
export const STROKE = 2.2;

/** Hairline rule width for cards and dividers. */
export const HAIRLINE = 1;

/** Minimum tappable size. iOS HIG floor, enforced on every control. */
export const HIT = 44;

/**
 * Hides decorative art from assistive tech. Spread onto any illustration.
 *
 * The scenes carry no information the surrounding text does not already say,
 * so a screen reader should walk straight past them rather than announce an
 * unlabelled image.
 *
 * Three platforms, three spellings: iOS reads `accessibilityElementsHidden`,
 * Android reads `importantForAccessibility`, and the web needs `aria-hidden`.
 * Sending the React Native pair to the web is not merely useless — react-native-svg
 * forwards unknown props straight onto the DOM node, and React rejects both as
 * invalid attributes, so every illustration logged two console errors.
 */
export const decorative: {
  'aria-hidden'?: boolean;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'no-hide-descendants';
} =
  Platform.OS === 'web'
    ? { 'aria-hidden': true }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
