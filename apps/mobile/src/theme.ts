/**
 * Bright Luvani (direction B), the one design system (DECISIONS.md, 2026-10-19).
 * Warm paper, white cards with no hairline, one soft lift reserved for
 * illustrated Explore cards, one deep ink, four saturated colours, four pastels, and Outfit for every word on the screen, French and
 * English alike. The chartreuse is a highlighter pen, never a surface. Voice
 * signals, touch floors, reading-size scaling and reduced motion keep their
 * behaviour. Raw colours live in palette.ts.
 */

import { Platform } from 'react-native';
import { paper, liftInk } from './palette.ts';

export { paper, colour, pastel, accent, highlight, signal, orb, onOrb, rungColor, lilac, textOn, onColour, segmentPending, passwordMeter, streakCelebration } from './palette.ts';

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
  /** Main-appearance roles used by the paywall and account screens. */
  mainDisplay: { fontFamily: font.extraBold, fontSize: 44, lineHeight: 48 },
  mainHeading: { fontFamily: font.semiBold, fontSize: 22, lineHeight: 27 },
  mainBody: { fontFamily: font.regular, fontSize: 17, lineHeight: 23 },
  /** The one giant number on a story or colour card. At most one per screen. */
  hero: { fontFamily: font.extraBold, fontSize: 112, lineHeight: 95, letterSpacing: -4.5 },
  /** A headline on colour: stories and onboarding, and the tab header for now. */
  display: { fontFamily: font.extraBold, fontSize: 44, lineHeight: 44, letterSpacing: -1.3 },
  /** The title of a working screen. */
  title: { fontFamily: font.extraBold, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  /** A short label above a card title: "Next scene · 2 of 3". Sentence case. */
  eyebrow: { fontFamily: font.bold, fontSize: 13, lineHeight: 18 },
  /**
   * The number on a stat tile (SNIPPETS stat-tile, 36/800). STYLE section 3 has
   * no 36; the approved tile does, and a raw size in a component is the thing
   * this file exists to refuse.
   */
  stat: { fontFamily: font.extraBold, fontSize: 36, lineHeight: 36, letterSpacing: -0.7 },
  /** Card titles and section heads. */
  heading: { fontFamily: font.extraBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  /** The title of a card. The same style as heading. */
  cardTitle: { fontFamily: font.extraBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
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
  /** The number in a compact stat, three to a `StatRow` (B-Today, B0 2026-10-20). */
  statSm: { fontFamily: font.bold, fontSize: 17, lineHeight: 20 },
  /** The line under a compact stat (B-Today, B0 2026-10-20). */
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  /** The words of a lock badge (v82 artboards, B0 2026-10-20). */
  badge: { fontFamily: font.bold, fontSize: 12, lineHeight: 16 },
  /** The word under a bottom-tab glyph, and nowhere else. */
  tabLabel: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 12 },
  /** IPA and notation. Never monospace-as-costume; this really is notation. */
  notation: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 },
} as const;

/**
 * The direction B artboards' own sizes (DECISIONS.md UI-008, 2026-10-20,
 * first used by B-Today). Each is a size the canvas draws that the scale above
 * has no exact token for; a rebuilt screen reads these rather than a raw size.
 * Outfit 400/600/700/800 are regular/semiBold/bold/extraBold.
 */
export const bType = {
  /** The tab greeting, "Bonjour, Yasmin.": 34/800, -0.5. */
  greeting: { fontFamily: font.extraBold, fontSize: 34, lineHeight: 36, letterSpacing: -0.5 },
  /** The yellow lead's title: 27/800, -0.3. */
  leadTitle: { fontFamily: font.extraBold, fontSize: 27, lineHeight: 30, letterSpacing: -0.3 },
  /** A 13/700 eyebrow with the artboards' 0.3 tracking. */
  eyebrow: { fontFamily: font.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  /** A 13/700 chip or pill. */
  chip: { fontFamily: font.bold, fontSize: 13, lineHeight: 17 },
  /** A 13 regular note or prompt. */
  note: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  /** A 14 regular count or link line. */
  meta: { fontFamily: font.regular, fontSize: 14, lineHeight: 19 },
  /** A 15 regular line: the English under a French phrase, a checklist row. */
  line15: { fontFamily: font.regular, fontSize: 15, lineHeight: 20 },
  /** A 16 regular line: a row's words, the lead's line. */
  line16: { fontFamily: font.regular, fontSize: 16, lineHeight: 21 },
  /** A 16 bold title or button. */
  bold16: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
  /** A 15 bold button. */
  bold15: { fontFamily: font.bold, fontSize: 15, lineHeight: 19 },
  /** A 15 semibold quiet button. */
  semi15: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 19 },
  /** A 17 bold button. */
  bold17: { fontFamily: font.bold, fontSize: 17, lineHeight: 21 },
  /** An 18 bold lead button. */
  bold18: { fontFamily: font.bold, fontSize: 18, lineHeight: 22 },
  /** A 19 bold card sentence. */
  bold19: { fontFamily: font.bold, fontSize: 19, lineHeight: 24 },
  /** A 20 bold line: the English to say in French. */
  bold20: { fontFamily: font.bold, fontSize: 20, lineHeight: 25 },
  /** A 22 bold French phrase. */
  bold22: { fontFamily: font.bold, fontSize: 22, lineHeight: 26 },
  /** A tab's section head, "French for real life": 21/800 (B-Explore). */
  section21: { fontFamily: font.extraBold, fontSize: 21, lineHeight: 26 },
  /** A pushed screen's section head, "Lines you'll likely need": 19/800 (B-ScenePreview). */
  section19: { fontFamily: font.extraBold, fontSize: 19, lineHeight: 24 },
  /** The scene band's title: 28/800 at 1.1 (B-ScenePreview). */
  bandTitle: { fontFamily: font.extraBold, fontSize: 28, lineHeight: 31 },
  /** A 14 bold selected filter chip (B-Explore). */
  bold14: { fontFamily: font.bold, fontSize: 14, lineHeight: 18 },
  /** A 14 semibold filter chip (B-Explore). */
  semi14: { fontFamily: font.semiBold, fontSize: 14, lineHeight: 18 },
  /** A 13 semibold field label (B-Explore). */
  semi13: { fontFamily: font.semiBold, fontSize: 13, lineHeight: 17 },
  /** A 12 bold small pill, "Free sample" (B-Explore). */
  bold12: { fontFamily: font.bold, fontSize: 12, lineHeight: 16 },
  /** A 12 semibold step note (B-Practice). */
  semi12: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 16 },
  /** A 12 regular quiet line (B-Practice). */
  note12: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  /** A 15 paragraph at 1.45 (B-Practice, B-Empty-Practice). */
  para15: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** A 17 bold card title (B-Practice). */
  title17: { fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  /** A pushed screen's title, "Your fixes": 26/800 (B-Fixes). */
  title26: { fontFamily: font.extraBold, fontSize: 26, lineHeight: 31 },
  /** The empty card's head: 22/800 (B-Empty-Practice). */
  section22: { fontFamily: font.extraBold, fontSize: 22, lineHeight: 27 },
  /** A tab's sub-section head: 20/800 (B-Empty-Practice). */
  section20: { fontFamily: font.extraBold, fontSize: 20, lineHeight: 25 },
  /** A 13 extrabold pill, "3 this week" (B-Practice). */
  heavy13: { fontFamily: font.extraBold, fontSize: 13, lineHeight: 17 },
  /** The current stage's name under its node, "Starter": 12/800 (B-Journey). */
  heavy12: { fontFamily: font.extraBold, fontSize: 12, lineHeight: 16 },
  /** "You're here" under the current stage: 11/700 (B-Journey). */
  bold11: { fontFamily: font.bold, fontSize: 11, lineHeight: 14 },
  /** The level pill, "Level 2": 14/800 (B-Journey). */
  heavy14: { fontFamily: font.extraBold, fontSize: 14, lineHeight: 18 },
  /** A stage node's number: 15/800 (B-Journey). */
  heavy15: { fontFamily: font.extraBold, fontSize: 15, lineHeight: 19 },
  /** A sound tile's letters, "on": 16/800 (B-Journey). */
  heavy16: { fontFamily: font.extraBold, fontSize: 16, lineHeight: 20 },
  /** The help card's sentence: 17/700 at 1.3 (B-Journey). */
  bold17Loose: { fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  /** "Bien joué.": 40/800 (B-AfterSession, 2026-10-21). */
  display40: { fontFamily: font.extraBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  /** The ability earned: 34/800, -0.4, at 1.1 (B-Celebrate, 2026-10-21). */
  ability34: { fontFamily: font.extraBold, fontSize: 34, lineHeight: 37, letterSpacing: -0.4 },
  /** The Recap band's title: 30/800 (B-Recap, 2026-10-21). */
  title30: { fontFamily: font.extraBold, fontSize: 30, lineHeight: 33, letterSpacing: -0.5 },
  /** A 17 regular sentence on a blue page (B-AfterSession, B-Celebrate, 2026-10-21). */
  para17: { fontFamily: font.regular, fontSize: 17, lineHeight: 24 },
  /** A word bank tile, 17/600 (B-Drill). */
  semi17: { fontFamily: font.semiBold, fontSize: 17, lineHeight: 21 },
  /** The revealed French on a review card, 24/700 at 1.2 (B-ReviewReveal). */
  answer24: { fontFamily: font.bold, fontSize: 24, lineHeight: 29 },
  /** The review prompt, 27/700 at 1.2, -0.2 (B-Review). */
  prompt27: { fontFamily: font.bold, fontSize: 27, lineHeight: 32, letterSpacing: -0.2 },
  /** The Profile avatar's initial: 34/800 (B-Profile, 2026-10-21). */
  initial34: { fontFamily: font.extraBold, fontSize: 34, lineHeight: 40 },
  /** The Profile name: 30/800 at -0.3 (B-Profile, 2026-10-21). */
  name30: { fontFamily: font.extraBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  /** The streak's run, "3 days": 52/800 at -1 (B-Streak, 2026-10-21). */
  run52: { fontFamily: font.extraBold, fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  /** The welcome's display, "A little French.": 40/800 at -1, 1.04 (B-OB-Welcome, 2026-10-21). */
  welcome40: { fontFamily: font.extraBold, fontSize: 40, lineHeight: 42, letterSpacing: -1 },
  /** An onboarding band's title, "Meet your tutor": 32/800 at -0.5 (B-OB-Tutor, 2026-10-21). */
  band32: { fontFamily: font.extraBold, fontSize: 32, lineHeight: 35, letterSpacing: -0.5 },
  /** The welcome's sun button: 19/800 (B-OB-Welcome, 2026-10-21). */
  heavy19: { fontFamily: font.extraBold, fontSize: 19, lineHeight: 24 },
  /** The welcome's speech bubbles: 17/800 (B-OB-Welcome, 2026-10-21). */
  heavy17: { fontFamily: font.extraBold, fontSize: 17, lineHeight: 21 },
  /** A 16 paragraph at 1.4 (the onboarding subtitles, 2026-10-21). */
  para16: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  /** A 14 paragraph at 1.45 (B-OB-Ready's info rows, 2026-10-21). */
  para14: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
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

/**
 * The one shadow (DECISIONS.md, 2026-10-19): a soft lift under an illustrated
 * Explore card, and nowhere else. Neutral field names so a caller maps it onto
 * the platform's own style keys; `css` is the same lift for the web.
 */
export const shadow = {
  lift: { offsetX: 0, offsetY: 12, blur: 24, spread: -16, color: liftInk, css: `0px 12px 24px -16px ${liftInk}` },
} as const;

/** UI-006: the lift as a style, for an illustrated Explore tile only (Card / ColourCard `lift`). */
export const liftStyle = { boxShadow: shadow.lift.css } as const;

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
 * The keyboard focus ring (F927): 2pt, 2pt clear of the control, in a colour
 * that reaches 3:1 on cream, white and the dark ground. Drawn on the web on
 * keyboard focus only, by the one rule `keyActivation.ts` installs.
 */
export const FOCUS = { width: 2, offset: 2, colour: paper.focus } as const;

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
