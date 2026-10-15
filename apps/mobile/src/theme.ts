/**
 * Luvani, bright (revamp B).
 * Warm paper, white cards with no hairline and no shadow, one deep ink, four
 * saturated colours, and Outfit for every word on the screen, French and
 * English alike. The chartreuse is a highlighter pen, never a surface. Voice
 * signals, touch floors, reading-size scaling and reduced motion keep their
 * behaviour. Raw colours live in palette.ts.
 */

import { Platform } from 'react-native';
import { paper } from './palette.ts';

export { paper, colour, accent, highlight, signal, orb, onOrb, rungColor, lilac, textOn, onColour, segmentPending, passwordMeter, streakCelebration } from './palette.ts';

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

/**
 * Outfit, in the five cuts App.tsx loads, named exactly as it loads them. Every caller uses these five canonical names.
 */
export const font = {
  regular: 'Outfit-Regular',
  medium: 'Outfit-Medium',
  semiBold: 'Outfit-SemiBold',
  bold: 'Outfit-Bold',
  extraBold: 'Outfit-ExtraBold',
  black: 'Outfit-Black',
} as const;

/**
 * Type scale. One face, Outfit, at the STYLE scale: the weight and the size say
 * what a line is, never a second face. French keeps its own tokens by name and
 * is set in SemiBold, and the French line is always the largest text in its
 * block. Sentence case everywhere, no caps and no italics. Sizes are points and
 * scale with the OS reading size; nothing disables `allowFontScaling`.
 *
 * One line per token, in the order family, size, line height, tracking, which
 * is the order `theme.test.ts` reads them in.
 */
export const type = {
  /** The one giant number on a story or colour card. At most one per screen. */
  hero: { fontFamily: font.extraBold, fontSize: 112, lineHeight: 95, letterSpacing: -4.5 },
  /** A headline on colour: stories and onboarding, and the tab header for now. */
  display: { fontFamily: font.extraBold, fontSize: 44, lineHeight: 44, letterSpacing: -1.3 },
  /** The title of a working screen. */
  title: { fontFamily: font.extraBold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6 },
  /**
   * The number on a stat tile (SNIPPETS stat-tile, 36/800). STYLE section 3 has
   * no 36; the approved tile does, and a raw size in a component is the thing
   * this file exists to refuse.
   */
  stat: { fontFamily: font.extraBold, fontSize: 36, lineHeight: 36, letterSpacing: -0.7 },
  /** Card titles and section heads. */
  heading: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  /** The title of a card. The same style as heading. */
  cardTitle: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  /**
   * The French line that leads a screen. Always larger than any heading on the
   * screen it leads; `fitHero()` steps it 34, 30, 26 by length (`heroFit`).
   */
  frenchHero: { fontFamily: font.semiBold, fontSize: 34, lineHeight: 42, letterSpacing: -0.3 },
  /** The French line that leads a card or a scene. Sentence case, never caps. */
  frenchLg: { fontFamily: font.semiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  /** French in lists, rows and thread bubbles. */
  french: { fontFamily: font.semiBold, fontSize: 20, lineHeight: 26 },
  /**
   * French in a chip, where the phrase is a sample rather than the thing to
   * say. Nothing is ever clipped to make it fit (no `numberOfLines` anywhere in
   * this app), so the size is the only lever.
   */
  frenchSm: { fontFamily: font.semiBold, fontSize: 17, lineHeight: 23 },
  /** Sentences. */
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 25 },
  /** A sentence that has to carry more weight than the ones around it. */
  bodyStrong: { fontFamily: font.semiBold, fontSize: 17, lineHeight: 25 },
  /** Buttons and row titles. Sentence case, no tracking. */
  label: { fontFamily: font.semiBold, fontSize: 16, lineHeight: 20 },
  /** Button lettering. The same style as label. */
  button: { fontFamily: font.semiBold, fontSize: 16, lineHeight: 20 },
  /** Metadata lines, captions, and the English under a French line. */
  small: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  /** The word under a bottom-tab glyph, and nowhere else. */
  tabLabel: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 12 },
  /** IPA and notation. Never monospace-as-costume; this really is notation. */
  notation: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 },
} as const;

/**
 * The French hero's fit steps for a long line, after `type.frenchHero` at 34.
 * Each step is still larger than every head a card carries.
 */
export const heroFit = {
  /** Over sixteen characters. */
  long: { fontFamily: font.semiBold, fontSize: 30, lineHeight: 38 },
  /** Over thirty-two characters. */
  longest: { fontFamily: font.semiBold, fontSize: 26, lineHeight: 34 },
} as const;

/** 4pt base. Tight within a group, generous between groups. */
export const space = (n: number) => n * 4;
export const RHYTHM = { inline: space(2), item: space(3), block: space(5), section: space(8) } as const;

export const radius = {
  /** The one Card and the colour card: white or colour, no shadow, never nested. */
  card: 24,
  /** A feature card that leads a screen. */
  feature: 28,
  /** A stat tile. */
  tile: 20,
  /** An input field. */
  field: 16,
  /** A real tappable capsule, fully rounded. */
  pill: 999,
  row: 20, // alias of tile
  chip: 16, // alias of field
  input: 16, // alias of field
  control: 16, // alias of field
} as const;

/** The white disc that holds a glyph inside a tinted row. */
export const DISC = 44;

/**
 * The one stroke weight, ICONS.md's 2: every glyph, the orb's rings and the
 * pen's scenes. The flat illustrations in `art/flat/` carry their own 3pt
 * strokes and fills by design, which is why they live outside `illustrations/`.
 */
export const STROKE = 2;

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

/**
 * Marks a line as French, so a screen reader reads it in a French voice. Spread
 * onto the `Text` that carries the French, and only that one: it is what STYLE
 * section 3's `lang="fr"` means in React Native.
 *
 * Three platforms, the `decorative` shape again: the web takes the `lang`
 * attribute, which react-native-web forwards to the DOM; iOS takes
 * `accessibilityLanguage`, which switches VoiceOver's voice; Android ignores
 * both and reads in the system voice. Neither half is sent to the other
 * platform, so nothing unknown reaches the DOM.
 */
export const frenchText: { lang?: string; accessibilityLanguage?: string } =
  Platform.OS === 'web' ? { lang: 'fr' } : { accessibilityLanguage: 'fr-FR' };

/** C2 typography, using bundled Outfit cuts and the approved Figma line heights. */
export const boldType = {
  ...type,
  display: { fontFamily: font.extraBold, fontSize: 44, lineHeight: 48, letterSpacing: -0.7 },
  title: { fontFamily: font.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: font.semiBold, fontSize: 22, lineHeight: 27 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.medium, fontSize: 16, lineHeight: 21 },
  choiceTitle: { fontFamily: font.semiBold, fontSize: 18, lineHeight: 24 },
  tutorName: { fontFamily: font.semiBold, fontSize: 20, lineHeight: 26 },
  tutorNameCompact: { fontFamily: font.semiBold, fontSize: 18, lineHeight: 24 },
  tutorListen: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  returningTitle: { fontFamily: font.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.4 },
  celebration: { fontFamily: font.bold, fontSize: 46, lineHeight: 52, letterSpacing: -0.4 },
  celebrationSupport: { fontFamily: font.regular, fontSize: 19, lineHeight: 25 },
  achievement: { fontFamily: font.bold, fontSize: 36, lineHeight: 39, letterSpacing: -0.4 },
  streakTitle: { fontFamily: font.extraBold, fontSize: 42, lineHeight: 44, letterSpacing: -0.7 },
  streakCount: { fontFamily: font.semiBold, fontSize: 24, lineHeight: 28 },
  streakBadge: { fontFamily: font.bold, fontSize: 52, lineHeight: 56 },
} as const;

/** Provider-approved lettering uses the platform sans face. */
export const providerType = { fontSize: 16, fontWeight: '500' as const };
