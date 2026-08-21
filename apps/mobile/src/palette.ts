/**
 * Every colour in the app, and nothing else.
 *
 * This file exists at the bottom of the import graph on purpose: it imports
 * NOTHING. `theme.ts` imports `Platform` from react-native, and the mobile test
 * runner is `node --test --experimental-strip-types` with no renderer, so
 * anything that reaches react-native can never be unit tested. Pulling the raw
 * values down here is what lets `palette.test.ts` hold them to a contract.
 *
 * Papers now whisper where the learner is instead of repainting the entire
 * app. Their hue shifts are deliberately low-chroma and the same violet carries
 * identity everywhere. State colours are muted too, while retaining accessible
 * contrast. The tests below this file hold both promises numerically.
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
  /** The identity, shared across rooms so navigation feels like one product. */
  violet: '#6B3FA0',
  bronze: '#755F50',
  harbour: '#536B64',
  iris: '#5C6378',
} as const;

export const papers = {
  /** Everything that is not about one subject. The app's own light. */
  house: { ground: '#F3E8F3', groundDeep: '#E4D3EE', line: '#D9C8E2', accent: accents.violet },
  /** The cafe arc, and the recap of a conversation that happened there. */
  sand: { ground: '#F2EAE6', groundDeep: '#E2D7D2', line: '#D8CCC6', accent: accents.violet },
  /** Entre amis. */
  sage: { ground: '#EAECE4', groundDeep: '#D7DAD0', line: '#CBCFC5', accent: accents.violet },
  /** A topic the tutor wrote. */
  lagoon: { ground: '#E7EDEB', groundDeep: '#D3DBD8', line: '#C7D0CC', accent: accents.violet },
  /** Practice and its deck. A room rather than a subject, so it keeps violet. */
  sky: { ground: '#E8ECF2', groundDeep: '#D3D9E1', line: '#C7CFD9', accent: accents.violet },
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
