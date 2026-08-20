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

export const paper = {
  /** The page itself. Everything sits directly on this. */
  ground: '#F3E8F3',
  /** One step deeper — pressed states, chip fills, the tab track. */
  groundDeep: '#E4D3EE',
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: '#FFFFFF',
  /** The ink. Near-black with a real violet cast so the page feels of a piece. */
  ink: '#241633',
  /** Secondary text. */
  inkSoft: '#5F4E73',
  /** Tertiary — counts, placeholders, timestamps. */
  inkFaint: '#94849F',
  /** Hairline rule on the lilac ground. */
  line: '#D9C8E2',
  /** Hairline divider inside a white card. */
  lineOnCard: '#EAE0F0',
  /** Text and icons on a filled control. Warm violet-white, never pure. */
  onInk: '#FBF6FF',
} as const;

/**
 * The identity violet. One accent, three jobs: the primary pill, the micro
 * labels, the monogram. Everything else keeps to paper and signals, so the
 * violet stays special.
 */
export const accent = {
  /** The primary action and the monogram. */
  primary: '#6B3FA0',
  /** Micro-labels — the caps line above a card. */
  label: '#8A5BBF',
} as const;

/**
 * Support colours for the four rungs, cooling as help is withdrawn: hot yellow
 * while the tutor carries the learner, plain ink once they walk alone. The
 * semantics predate this skin and survive it.
 */
export const rungColor: Record<1 | 2 | 3 | 4, string> = {
  1: '#FFCD00',
  2: '#FF7E2E',
  3: '#6EC4E8',
  4: '#241633',
};

export const rungLabel: Record<1 | 2 | 3 | 4, string> = {
  1: 'Repeat after the tutor',
  2: 'Choose a reply and say it',
  3: 'Say it in your own words',
  4: 'Free conversation',
};

/** Signal colours, kept out of the rung set so state never reads as a rung. */
export const signal = {
  /** Something to change — darkened to hold on white cards. */
  correspondance: '#B4008A',
  /** A sound that is working — darkened to hold on white cards. */
  good: '#1E8A5B',
  /** The tutor's voice, live. Red means listen; it never marks the learner's mic. */
  live: '#FF4B3E',
} as const;

/**
 * The voice circle speaks traffic lights, and these are its three words:
 * red, the tutor is talking, listen; green, your turn, speak; amber, it is
 * thinking, one moment. The intro's final page teaches exactly this mapping,
 * so these values changing means that page is teaching a lie — change both.
 * Amber is darker than rung 1's yellow so the caption under it stays legible
 * on lilac.
 */
export const orb = {
  /** Red — the tutor is speaking. Listen. */
  speaking: signal.live,
  /** Green — your turn. Speak. */
  yourTurn: signal.good,
  /** Amber — the tutor is thinking. One moment. */
  thinking: '#E3A800',
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
