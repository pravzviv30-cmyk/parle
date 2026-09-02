/**
 * Colourful calm — the design system.
 *
 * The world is a picture book for adults: pale lilac paper, violet-cast ink,
 * hand-drawn line-art, a serif that speaks and a sans that stays out of the
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
 */

import { Platform } from 'react-native';
import { ink, papers, accents, paperFor, type Paper, type PaperName } from './palette.ts';

/**
 * The papers, and which place gets which. Every raw value lives in
 * `palette.ts`, which imports nothing, because this file imports `Platform`
 * and the mobile test runner has no react-native. A colour you cannot test is
 * a colour somebody will change with an eyedropper.
 */
export { papers, accents, paperFor };
export type { Paper, PaperName };

/**
 * The house paper, spread flat for the thirty-odd modules that read it inside
 * a `StyleSheet.create` block. Those evaluate once at import and cannot follow
 * a screen's paper, which is exactly why a screen that wants a different light
 * sets `backgroundColor` inline on its own root rather than reaching for a
 * context that could never have reached them.
 */
export const paper = {
  /** The page itself. Everything sits directly on this. */
  ground: papers.house.ground,
  /** One step deeper — pressed states, chip fills, the tab track. */
  groundDeep: papers.house.groundDeep,
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: ink.card,
  /** The ink. Near-black with a real violet cast so the page feels of a piece. */
  ink: ink.ink,
  /** Secondary text. */
  inkSoft: ink.inkSoft,
  /** Tertiary — counts, placeholders, timestamps. */
  inkFaint: ink.inkFaint,
  /** Hairline rule on the lilac ground. */
  line: papers.house.line,
  /** Hairline divider inside a white card. */
  lineOnCard: ink.lineOnCard,
  /** Text and icons on a filled control. Warm violet-white, never pure. */
  onInk: ink.onInk,
} as const;

/**
 * The identity violet. One accent, three jobs: the primary pill, the micro
 * labels, the monogram. Everything else keeps to paper and signals, so the
 * violet stays special.
 *
 * `label` is now the house paper's own accent rather than a lighter violet.
 * The old `#8A5BBF` read 4.08 against the ground at 11.5pt bold, which is
 * under the floor for small text; every paper's accent clears 5.0. A screen on
 * another paper takes that paper's accent instead, which is the one place
 * colour varies by where you are rather than by what a thing means.
 */
export const accent = {
  /** The primary action and the monogram. */
  primary: accents.violet,
  /** Micro-labels — the caps line above a card. */
  label: papers.house.accent,
} as const;

/**
 * Support colours for the four rungs, cooling as help is withdrawn: hot yellow
 * while the tutor carries the learner, plain ink once they walk alone. The
 * semantics predate this skin and survive it.
 */
export const rungColor: Record<1 | 2 | 3 | 4, string> = {
  1: '#D6A846',
  2: '#C8794A',
  3: '#5F95AA',
  4: '#241633',
};

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

/** Signal colours, kept out of the rung set so state never reads as a rung. */
export const signal = {
  /** Something to change, muted plum rather than neon magenta. */
  correspondance: '#8B5578',
  /** A sound that is working, muted eucalyptus rather than bright green. */
  good: '#437A62',
  /** The tutor's voice. A dusty red keeps "listen" distinct without shouting. */
  live: '#A9564F',
} as const;

/**
 * The voice circle speaks traffic lights, and these are its three words:
 * red, the tutor is talking, listen; green, your turn, speak; amber, it is
 * thinking, one moment. The intro's final page teaches exactly this mapping,
 * so these values changing means that page is teaching a lie — change both.
 *
 * Each is a MARK, and a mark that reports state is held to 3 against the paper
 * it sits on, not to the 4.5 that words are held to. That distinction is the
 * whole of J2: the amber measured 1.79 and the red 2.79, and the captions were
 * being set in those same colours, so the word under the orb was the least
 * legible text in the app. The colours now clear the floor for a mark and the
 * captions are ink, which is the floor for words. Amber stays well clear of
 * rung 1's yellow; it sits nearer accents.bronze than anything else in the
 * palette, which is safe only because bronze is sand's accent and the orb only
 * ever appears on house.
 */
export const orb = {
  /** Red — the tutor is speaking. Listen. */
  speaking: signal.live,
  /** Green — your turn. Speak. */
  yourTurn: signal.good,
  /** Amber — the tutor is thinking. Muted, but still distinct from green/red. */
  thinking: '#8A6A2D',
  /**
   * Violet — the microphone is closed and the circle is waiting to be pressed.
   *
   * Not a fourth traffic light. Waiting to be tapped is not a state report, it
   * is the primary control of the whole product, so it takes the primary
   * colour exactly as the pill does. It stops being violet the instant the orb
   * starts reporting anything.
   */
  ready: accent.primary,
} as const;

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
