/**
 * The complete colour vocabulary. This leaf module imports nothing so the
 * palette can be tested without loading React Native.
 * The French notebook with one highlighter: ink is identity, the chartreuse is
 * a highlighter pen and never a surface. The six place tints are retired from
 * drawing; their tokens stay until the role tables go.
 * Voice states and pedagogical support colours retain their existing meanings.
 */

/** The single ground and its inks. Everything sits directly on this. */
export const paper = {
  /** The page itself. Everything sits directly on this. */
  ground: '#F7F3E8',
  /** One step deeper — pressed states, chip fills, the tab track. */
  groundDeep: '#E6DECD',
  /** Card surface. Flat white, hairline rule, no shadow. */
  card: '#FFFEFA',
  /** The ink. Near-black with a real violet cast so the page feels of a piece. */
  ink: '#182019',
  /** Secondary text. */
  inkSoft: '#51584C',
  /** Tertiary — counts, placeholders, timestamps, the inactive tab glyph. */
  inkFaint: '#6A7266',
  /** Hairline rule on the ground. */
  line: '#B8BCAD',
  /** Hairline divider inside a white card. */
  lineOnCard: '#DADBCF',
  /** Text and icons on a filled control. Warm violet-white, never pure. */
  onInk: '#FFFDF5',
} as const;

/**
 * The identity ink. One accent, two named jobs: the primary action and the
 * micro-labels. `label` is simply `primary` — there is one identity colour, and
 * this pins it so a second one cannot creep back in beside it.
 */
export const accent = {
  /** The primary action: the one ink pill. */
  primary: '#182019',
  /** Micro-labels — the caps line above a card. The same ink as primary. */
  label: '#182019',
  /**
   * Deprecated: resolves to the card. The chartreuse left this name for
   * `highlight`, so every panel, tile, avatar and tab still spelling
   * `accent.feature` turns to plain paper until its screen is rebuilt.
   */
  feature: paper.card,
} as const;

/**
 * The one highlighter. A pen, not a surface: the band behind a French line,
 * the "you are here" stop on the level path, and the brand mark. At most one
 * per screen, always under ink, never the ground of a panel, tile, avatar, tab,
 * title, card or button.
 */
export const highlight = '#D8FF54';

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
  4: '#182019',
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
