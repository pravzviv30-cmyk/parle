/**
 * Every colour in the app, and nothing else.
 *
 * This file exists at the bottom of the import graph on purpose: it imports
 * NOTHING. `theme.ts` imports `Platform` from react-native, and the mobile test
 * runner is `node --test --experimental-strip-types` with no renderer, so
 * anything that reaches react-native can never be unit tested. Pulling the raw
 * values down here is what lets `palette.test.ts` hold them to a contract.
 *
 * ## Papers
 *
 * A paper is a place's light: a ground, one step deeper for chips and pressed
 * states, a hairline, and the accent its small type is set in.
 *
 * All five grounds sit at **L* 93.1**, the lightness of the lilac the app
 * already had. That is the whole safety argument, and it is arithmetic rather
 * than taste: WCAG contrast is a function of relative luminance, luminance is a
 * function of L*, and the a/b axes do not enter the formula at all. Hold
 * lightness still and every ink, accent and signal keeps the exact ratio it had
 * on lilac, on every paper. Measured drift across the set is under 0.3%.
 *
 * The other two steps are not picked either. Reverse-engineering the original
 * lilac trio gives one rule that reproduces `#E4D3EE` and `#D9C8E2` exactly:
 *
 *     ground      L* 93.1
 *     groundDeep  L* 86.6, chroma + 8.5, hue - 11
 *     line        L* 82.7, chroma + 8.1, hue - 10
 *
 * So a paper is really a hue and a chroma, and the rest falls out. If you add a
 * sixth, compute it that way and let the test tell you whether you were right.
 *
 * ## Accents
 *
 * One per paper, all at **L* 42**, all at least a Delta-E of 30 from every
 * signal and rung colour. The separation is the point: green means go and red
 * means the tutor is talking, and an accent that drifted into either would make
 * the app lie. They also all clear 5.0 on their own paper, where the label
 * violet they replace sat at 4.08 and failed AA at 11.5pt.
 *
 * One rule keeps them safe, and it is the grammar the app already used:
 * **an accent is typographic, a signal is a mark.** A label, a chip, or the one
 * solid fill inside a drawing may take an accent. A dot, a ring, or anything
 * that reports state never may.
 */

/** The ink, the card, and the two colours that are not anybody's paper. */
export const ink = {
  /** Near-black with a real violet cast so the page feels of a piece. */
  ink: '#241633',
  /** Secondary text. */
  inkSoft: '#5F4E73',
  /** Tertiary. Counts, placeholders, timestamps. */
  inkFaint: '#94849F',
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: '#FFFFFF',
  /** Hairline divider inside a white card. Does not vary by paper. */
  lineOnCard: '#EAE0F0',
  /** Text and icons on a filled control. Warm violet-white, never pure. */
  onInk: '#FBF6FF',
} as const;

export interface Paper {
  /** The page itself. Everything sits directly on this. */
  readonly ground: string;
  /** One step deeper. Pressed states, chip fills, the tab track. */
  readonly groundDeep: string;
  /** Hairline rule on the ground. */
  readonly line: string;
  /** The micro-label above a card, and a drawing's one solid fill. */
  readonly accent: string;
}

/**
 * The accents, kept separately because two papers share one and because the
 * illustration layer wants them by name.
 */
export const accents = {
  /** The identity. Unchanged, and still the only violet on Home. */
  violet: '#6B3FA0',
  /**
   * The family's warmth, and the one that took three tries. A plum here would
   * have been the obvious pick, and the contrast test refused it: at a
   * Delta-E of 24 from `signal.correspondance`, the label above a card and the
   * colour that means "change this" were the same colour. Bronze sits 40 away
   * from the nearest signal.
   */
  bronze: '#8C5800',
  harbour: '#00689E',
  iris: '#445EB4',
} as const;

export const papers = {
  /** Everything that is not about one subject. The app's own light. */
  house: { ground: '#F3E8F3', groundDeep: '#E4D3EE', line: '#D9C8E2', accent: accents.violet },
  /** The cafe arc, and the recap of a conversation that happened there. */
  sand: { ground: '#FEE7DB', groundDeep: '#FCCFC1', line: '#EFC5B6', accent: accents.bronze },
  /** Entre amis. */
  sage: { ground: '#E8EED5', groundDeep: '#DBDCB2', line: '#CFD1A8', accent: accents.harbour },
  /** A topic the tutor wrote. */
  lagoon: { ground: '#CFF3EB', groundDeep: '#AFE4D0', line: '#A4D9C6', accent: accents.iris },
  /** Practice and its deck. A room rather than a subject, so it keeps violet. */
  sky: { ground: '#D5EFFE', groundDeep: '#ABE1F5', line: '#A1D6E9', accent: accents.violet },
} as const satisfies Record<string, Paper>;

export type PaperName = keyof typeof papers;

/** The papers a generated topic may be given, in a fixed order. */
const HASHED: readonly PaperName[] = ['lagoon', 'sage', 'sand'];

/**
 * The light for a place.
 *
 * Authored units are pinned by hand so the cafe is always sand. Everything the
 * learner's own conversations produce is hashed, because those ids are not
 * known when this file is written and a topic that changed colour between two
 * launches would read as a different topic.
 *
 * The hash is a plain sum of code units. It has to be stable forever, not
 * well distributed, so the boring one is the right one.
 */
export function paperFor(id: string | null | undefined): Paper {
  if (!id) return papers.house;
  if (id === 'cafe' || id.startsWith('cafe:')) return papers.sand;
  if (id === 'amis' || id.startsWith('amis:')) return papers.sage;
  if (id === 'practice' || id === 'review' || id === 'drill') return papers.sky;
  if (!id.startsWith('topic:')) return papers.house;

  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum = (sum + id.charCodeAt(i)) % 4096;
  // The `??` can never fire: the modulus is always in range. It is here because
  // noUncheckedIndexedAccess is on, and a lie to the compiler is worse.
  const name = HASHED[sum % HASHED.length] ?? 'lagoon';
  return papers[name];
}
