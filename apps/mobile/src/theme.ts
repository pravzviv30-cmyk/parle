/**
 * Paper & ink — the design system.
 *
 * The world is a picture book for adults: pale lilac paper, warm black ink,
 * hand-drawn line-art, a serif that speaks and a sans that stays out of the
 * way. Cards are flat white with a hairline rule, buttons are solid ink pills.
 * Calm, friendly, professional — easy to look at twice a day.
 *
 * What carried over from the enamel system unchanged, because it is behaviour
 * rather than surface: one primary action per screen, the four support colours
 * that cool as the learner climbs, the red live microphone, 44pt touch floors,
 * and type that respects the OS reading size.
 */

import { Platform } from 'react-native';

export const paper = {
  /** The page itself. Everything sits directly on this. */
  ground: '#F3E8F3',
  /** One step deeper — pressed states, chip fills, the tab track. */
  groundDeep: '#EAD9EA',
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: '#FFFFFF',
  /** The ink. Near-black with a whisper of violet so it sits on lilac. */
  ink: '#1A141E',
  /** Secondary text. */
  inkSoft: '#5F5566',
  /** Tertiary — counts, placeholders, timestamps. */
  inkFaint: '#92879A',
  /** Hairline rule on the lilac ground. */
  line: '#DCCEDC',
  /** Hairline divider inside a white card. */
  lineOnCard: '#EAE0EA',
  /** Text and icons on an ink-filled control. Warm white, never pure. */
  onInk: '#FFF9F2',
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
  4: '#1A141E',
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
  /** Live microphone. */
  live: '#FF4B3E',
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
