/**
 * Modern Atelier with the warmth of a French journal.
 * Warm paper and near-black ink, chartreuse feature panels, bold DM Sans
 * headings and Fraunces French. Shared geometry carries this language through
 * every screen, including forms, live sessions, recaps and settings.
 * Voice signals, touch floors, reading-size scaling and reduced motion retain
 * their established behavior. Raw colours live in palette.ts.
 */

import { Platform } from 'react-native';
import { paper } from './palette.ts';

export { paper, accent, signal, orb, rungColor, tint } from './palette.ts';
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
 * Type scale. The serif carries anything with a voice — headlines, stats, and
 * every French line the learner reads. The sans carries the furniture. Sizes
 * are points and scale with the OS reading size; nothing disables
 * `allowFontScaling`.
 */
export const type = {
  /** Screen headline. */
  display: { fontFamily: font.sansBold, fontSize: 34, lineHeight: 39, letterSpacing: -1.2 },
  /** Section head, big stat. */
  title: { fontFamily: font.sansBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  /** The title of a card that leads a tab: the hero. Bold serif, smaller than the display. */
  cardTitle: { fontFamily: font.sansBold, fontSize: 26, lineHeight: 31, letterSpacing: -0.8 },
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
  heading: { fontFamily: font.sansBold, fontSize: 17, lineHeight: 22 },
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

/** 4pt base. Tight within a group, generous between groups. */
export const space = (n: number) => n * 4;

export const radius = {
  /** A white card. Broad enough to feel like one generous page rather than a utility panel. */
  card: 12,
  /** A tinted row. Tighter than a card on purpose, so the two never read as one shape. */
  row: 8,
  chip: 6,
  input: 8,
  control: 8,
  pill: 999,
} as const;

/**
 * The whisper. One soft shadow under a white card, and nothing else: the only other
 * shadow in the app is the live microphone's glow in `SpeakCircle`. Never on a tinted
 * row, the tab bar, the orb, a pill or a header. Its colour is the ink token, so the
 * palette test's rule that no raw hex lives outside `palette.ts` still holds.
 */
export const shadow = {
  whisper: {
    shadowColor: paper.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 0,
    elevation: 2,
  },
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
