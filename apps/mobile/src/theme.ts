/**
 * Enamel wayfinding — the design system.
 *
 * The world is the Paris street plaque and the Métro sign: a deep bottle-green
 * vitreous enamel field, a bevelled white border, a thin inner keyline, and white
 * caps with generous tracking.
 *
 * It was chosen because it is a *wayfinding* system, and scaffolding is wayfinding:
 * you are here, go this way. Enamel signs are calm and authoritative — they never
 * panic and never scold, they just orient you. That is precisely the behaviour this
 * product's tutor is contractually required to have.
 *
 * The rung colours are real RATP line colours rather than invented ones, ordered so
 * support visibly cools as the learner climbs: hot yellow when the tutor is carrying
 * them, plain enamel white when they are on their own.
 */

export const enamel = {
  /** The ground behind everything — the darkest green, like a plaque in shadow. */
  ground: '#08221A',
  /** The plaque body. Paris street-plaque green. */
  field: '#0F3B2C',
  /** A raised plaque, one step lighter. */
  fieldRaised: '#154836',
  /** Enamel white is never pure — it is a warm, slightly creamy vitreous white. */
  white: '#F2EFE4',
  /** Secondary text, tinted from the field's own hue rather than greyed. */
  whiteMuted: '#A9C4B6',
  /** Tertiary — timestamps, counts, IPA. */
  whiteFaint: '#6E9384',
  /** The bevel highlight on the top-left edge of a struck enamel border. */
  bevelLight: 'rgba(255, 255, 255, 0.28)',
  /** The bevel shadow on the bottom-right. */
  bevelDark: 'rgba(0, 0, 0, 0.35)',
} as const;

/**
 * Rung indicators, as Métro line bullets.
 * Real line colours: L1 yellow, L5 orange, L13 sky, then enamel white for "no line
 * left to follow — you are walking it yourself".
 */
export const rungColor: Record<1 | 2 | 3 | 4, string> = {
  1: '#FFCD00', // Ligne 1
  2: '#FF7E2E', // Ligne 5
  3: '#6EC4E8', // Ligne 13
  4: '#F2EFE4', // no line
};

export const rungLabel: Record<1 | 2 | 3 | 4, string> = {
  1: 'RÉPÉTEZ',
  2: 'CHOISISSEZ',
  3: 'À VOUS',
  4: 'LIBRE',
};

export const rungLabelEn: Record<1 | 2 | 3 | 4, string> = {
  1: 'Repeat after the tutor',
  2: 'Choose a reply and say it',
  3: 'Say it in your own words',
  4: 'Free conversation',
};

/** Signal colours, kept out of the rung set so state never reads as a rung. */
export const signal = {
  /** Correspondance magenta — where you change lines to fix something. */
  correspondance: '#CF009E',
  /** A sound that is working. */
  good: '#6ECA97',
  /** Live microphone. */
  live: '#FF4B3E',
} as const;

export const font = {
  regular: 'Archivo-Regular',
  semibold: 'Archivo-SemiBold',
  bold: 'Archivo-Bold',
  extrabold: 'Archivo-ExtraBold',
} as const;

/**
 * Type scale. Sizes are in points and scale with the OS reading size, because
 * `allowFontScaling` defaults to true and nothing here disables it.
 */
export const type = {
  /** The line on the plaque. Signage lettering: heavy, caps, wide tracking. */
  plaque: { fontFamily: font.extrabold, fontSize: 30, letterSpacing: 1.6, lineHeight: 38 },
  plaqueSmall: { fontFamily: font.extrabold, fontSize: 21, letterSpacing: 1.1, lineHeight: 28 },
  /** Station names and section headings. */
  heading: { fontFamily: font.bold, fontSize: 19, letterSpacing: 0.6, lineHeight: 25 },
  /** The small enamel tag lettering above a plaque. */
  tag: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.8, lineHeight: 15 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 19 },
  /** IPA and counts. Never monospace-as-costume — this really is notation. */
  notation: { fontFamily: font.semibold, fontSize: 14, letterSpacing: 0.4, lineHeight: 20 },
} as const;

/** 4pt base. Tight within a group, generous between groups. */
export const space = (n: number) => n * 4;

export const radius = {
  /** Real enamel plaques have a small, almost-square corner. */
  plaque: 5,
  bullet: 999,
} as const;

/** Minimum tappable size. iOS HIG floor, enforced on every control. */
export const HIT = 44;
