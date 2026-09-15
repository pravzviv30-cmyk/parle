/**
 * Every colour in the app, and nothing else.
 *
 * This file exists at the bottom of the import graph on purpose: it imports
 * NOTHING. `theme.ts` imports `Platform` from react-native, and the mobile test
 * runner is `node --test --experimental-strip-types` with no renderer, so
 * anything that reaches react-native can never be unit tested. Pulling the raw
 * values down here is what lets `palette.test.ts` hold them to a contract.
 *
 * There is one ground now — Porcelain — not five papers keyed by place. The
 * violet carries identity everywhere, the signals are saturated back up to full
 * colour, and each family is held numerically by the tests below this file:
 * words clear the text floor, marks clear the mark floor, and nothing that means
 * one thing comes close enough to something that means another to be confused
 * with it.
 */

/** The single ground and its inks. Everything sits directly on this. */
export const paper = {
  /** The page itself. Everything sits directly on this. */
  ground: '#F4F2F7',
  /** One step deeper — pressed states, chip fills, the tab track. */
  groundDeep: '#E6E2EE',
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: '#FFFFFF',
  /** The ink. Near-black with a real violet cast so the page feels of a piece. */
  ink: '#241633',
  /** Secondary text. */
  inkSoft: '#5F4E73',
  /** Tertiary — counts, placeholders, timestamps, the inactive tab glyph. */
  inkFaint: '#8A7996',
  /** Hairline rule on the ground. */
  line: '#DAD5E3',
  /** Hairline divider inside a white card. */
  lineOnCard: '#E9E5F0',
  /** Text and icons on a filled control. Warm violet-white, never pure. */
  onInk: '#FBF6FF',
} as const;

/**
 * The identity violet. One accent, two named jobs: the primary action and the
 * micro-labels. `label` is simply `primary` — there is one identity colour, and
 * this pins it so a second one cannot creep back in beside it.
 */
export const accent = {
  /** The primary action and the monogram. */
  primary: '#6B3FA0',
  /** Micro-labels — the caps line above a card. The same violet as primary. */
  label: '#6B3FA0',
} as const;

/**
 * Signal colours, kept out of the rung set so state never reads as a rung.
 * Green and magenta are words and clear the text floor; the tutor's red is a
 * mark and clears the mark floor.
 */
export const signal = {
  /** Something to change. Full magenta. */
  correspondance: '#B4008A',
  /** A sound that is working. Full green — the same green the learner speaks in. */
  good: '#12784A',
  /** The tutor's voice. A saturated red that says "listen" without shouting. */
  live: '#DE3B2D',
} as const;

/**
 * The voice circle speaks traffic lights, and these are its three words:
 * red, the tutor is talking, listen; green, your turn, speak; amber, it is
 * thinking, one moment. The intro's final page teaches exactly this mapping,
 * so these values changing means that page is teaching a lie — change both.
 *
 * Each is a MARK, and a mark that reports state is held to 3 against the ground
 * it sits on, not to the 4.5 that words are held to. The captions are ink, which
 * is the floor for words.
 */
export const orb = {
  /** Red — the tutor is speaking. Listen. */
  speaking: signal.live,
  /** Green — your turn. Speak. */
  yourTurn: signal.good,
  /** Amber — the tutor is thinking. Muted, but still distinct from green/red. */
  thinking: '#B07510',
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

/**
 * Support colours for the four rungs, cooling as help is withdrawn: hot yellow
 * while the tutor carries the learner, plain ink once they walk alone. A rung
 * colour is a fill under an ink numeral, not a state mark, so its floor is that
 * ink clears the text floor on it, not that the fill clears the mark floor on
 * the ground.
 */
export const rungColor: Record<1 | 2 | 3 | 4, string> = {
  1: '#FFCD00',
  2: '#FF7B00',
  3: '#6EC4E8',
  4: '#241633',
};

/**
 * Tints: soft paper under a row.
 *
 * A tint is a SURFACE under a place's row or under a kind of practice. It is the
 * disc behind a situation's drawing, and since revamp A it is mostly the ground
 * under the row itself: the way into a place, into a way of talking, into a
 * drill made from a conversation. Which tint goes with which role is not decided
 * here and never inside a screen — `missions/missionTint.ts`,
 * `tutor/doorTint.ts`, `practice/madeFromTint.ts` and `profile/rhythmTint.ts`
 * name a tint by the job it does, so a screen names a place and a primitive
 * names the colour.
 *
 * It is not a mark and not an accent: never lettering, never a stroke or a
 * border, never a ring or a dot that reports state. So its floors are a paper's
 * floors: ink and soft ink both clear the text floor on it, it sits far enough
 * off the ground, the chip fill and the card to read as a surface, it stays
 * thirty from every signal and the accent, twenty from every rung fill, lighter
 * than every mark, and no two tints come within ten of each other. The sky is
 * twenty-six from rung three's blue, which is why the rung floor is twenty and
 * not thirty: nothing reads a disc under a café cup as a support colour, but
 * nothing should have to squint either.
 */
export const tint = {
  /** Café: a warm paper under the cup. */
  sand: '#FEE7DB',
  /** Friends: a blush under the clinking bubbles. */
  rose: '#F8D8DF',
  /** Home: the old house lilac, under the window and the moon. */
  lilac: '#E4D3EE',
  /** The street: a cool lagoon under the signpost. */
  lagoon: '#CFF3EB',
  /** The market: sage under the crate of tomatoes. */
  sage: '#E8EED5',
  /** The hotel: sky under the front desk. */
  sky: '#D5EFFE',
} as const;

export type TintName = keyof typeof tint;
