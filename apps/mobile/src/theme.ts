/**
 * Colourful calm — the design system.
 *
 * The world is a picture book for adults: one pale Porcelain ground, violet-cast
 * ink, hand-drawn line-art, a serif that speaks and a sans that stays out of the
 * way. Cards are flat white with a hairline rule. Colour does jobs now: violet
 * is identity (the primary pill, the labels, the monogram), green means go
 * (your turn to speak), amber means the tutor is thinking, red means it is
 * talking. Calm, friendly, professional — easy to look at twice a day.
 *
 * What carried over unchanged, because it is behaviour rather than surface:
 * one primary action per screen, the four support colours that cool as the
 * learner climbs, 44pt touch floors, and type that respects the OS reading
 * size. What deliberately changed with this skin: the live microphone is
 * GREEN now, not red — green means "you speak" everywhere, so the orb's red
 * can mean "the tutor is speaking" without the two ever reading as one.
 *
 * Every raw colour value lives in `palette.ts`, which imports nothing, because
 * this file imports `Platform` and the mobile test runner has no react-native.
 * A colour you cannot test is a colour somebody will change with an eyedropper,
 * so the palette is re-exported from here and the values are held to a contract
 * in `palette.test.ts`.
 */

import { Platform } from 'react-native';

export { paper, accent, signal, orb, rungColor } from './palette.ts';

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
  display: { fontFamily: font.serifBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  /** Section head, big stat. */
  title: { fontFamily: font.serif, fontSize: 24, lineHeight: 30 },
  /** The French line to say. Sentence case, never caps. */
  frenchLg: { fontFamily: font.serif, fontSize: 28, lineHeight: 36 },
  /** Inline French content — options, cards, chips. */
  french: { fontFamily: font.serif, fontSize: 21, lineHeight: 28 },
  heading: { fontFamily: font.sansBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.sans, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.sansMedium, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19 },
  /** The word under a bottom-tab glyph. Small enough to sit two to a cell. */
  tabLabel: { fontFamily: font.sansMedium, fontSize: 11, lineHeight: 14 },
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
  card: 14,
  chip: 10,
  input: 12,
  pill: 999,
} as const;

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
