/**
 * The complete colour vocabulary. This leaf module imports nothing so the
 * palette can be tested without loading React Native.
 *
 * Luvani, bright (revamp B). A warm paper ground, white cards, one deep ink,
 * and four saturated colours that each lead a screen or report the tutor's
 * state. The chartreuse is still a highlighter pen and never a surface.
 *
 * Raw values live here: the paper and its inks,
 * the four colours, the scoped streak palette, the highlighter, and the STYLE values that only
 * ever sit on a colour ground or inside a drawing. Every other token is a
 * reference to one of them, so a value can only drift in one place. Old token
 * names that screens still write stay as aliases of a B value until the stage
 * that redraws those screens retires them.
 */

/** The single ground and its inks. Everything sits directly on this. */
export const paper = {
  /** The page itself. Every working screen sits directly on this. */
  ground: '#FFF6E9',
  /** Loading blocks, and the one fill the first three rungs share. */
  skeleton: '#EFE6D6',
  /** Alias of skeleton until the pressed washes and chip fills are redrawn. */
  groundDeep: '#EFE6D6',
  /** Cards and tiles. Pure white, no hairline, no shadow. */
  card: '#FFFFFF',
  /** The ink. Primary text, the primary button, the dark live ground. */
  ink: '#16123A',
  /** Secondary text on paper or on a white card. Never on a colour ground. */
  inkSoft: '#5C5A74',
  /** Alias of inkSoft. B has no third ink, so counts and placeholders stay words. */
  inkFaint: '#5C5A74',
  /** The one hairline. Decorative dividers only. */
  line: '#EADFCB',
  /** Alias of line. B has one hairline, on the ground and inside a card alike. */
  lineOnCard: '#EADFCB',
  /**
   * The 1.5pt border of an input and the ring of an unchosen option. 3.6 on
   * white: a mark at the 3 floor, never words.
   */
  field: '#8A8499',
  /** Text and icons on a filled ink, blue or coral control. */
  onInk: '#FFFFFF',
} as const;

/**
 * The four colours. One leads a screen at most; the rest of the screen is
 * paper, white and ink. What may sit on each is fixed: white on blue and coral,
 * ink on sun and mint, and never the other way round.
 */
export const colour = {
  /** The brand. Onboarding, the next-scene card, the selected tab. White on it. */
  blue: '#3B2FE0',
  /** The tutor speaking, and the recap cover. White on it, never below 14pt. */
  coral: '#D63A22',
  /** Thinking, the plan, the focus sound. Ink on it, never white. */
  sun: '#FFC93C',
  /** Your turn, a can-do earned, a done tick. Ink on it, never white. */
  mint: '#2FD18B',
} as const;

/** Founder-authored sign-in divider and its short separating label. */
export const welcomeDividerInk = '#000000';

/** Decorative sign-in glow, exported from the founder's Figma motion. */
export const welcomeGlowColour = {
  rest: 'rgba(87, 69, 255, 0.12)',
  peak: 'rgba(87, 69, 255, 0.3)',
  settle: 'rgba(87, 69, 255, 0.16)',
  insetRest: 'rgba(222, 229, 255, 0.14)',
  insetPeak: 'rgba(222, 229, 255, 0.48)',
  insetSettle: 'rgba(222, 229, 255, 0.2)',
} as const;

/** The quieter earned-streak ground and its original flame illustration. */
export const streakCelebration = {
  ground: '#1CB982',
  flame: '#EE6031',
  orange: '#FF9539',
  gold: '#FFD45A',
  tipHighlight: '#FFF0B6',
  coreHighlight: '#FFF6D4',
  shadow: '#146B55',
  cream: paper.ground,
  ink: paper.ink,
} as const;

/**
 * The action colours. The primary action and the labels are ink, and the brand
 * is the blue. `label` is simply `primary`: this pins it so a second label
 * colour cannot creep back in beside it.
 */
export const accent = {
  /** The primary action: the one ink pill. */
  primary: paper.ink,
  /** Labels. The same ink as primary. */
  label: paper.ink,
  /** The brand blue, for the moments that lead in colour. */
  brand: colour.blue,
} as const;

/**
 * The one highlighter. A pen, not a surface: the band behind a French line,
 * the "you are here" stop on the level path, and the brand mark. At most one
 * per screen, always under ink, never the ground of a panel, tile, avatar, tab,
 * title, card or button.
 */
export const highlight = '#D8FF54';

/**
 * Signals. Words are ink, so the two word signals are ink and clear the text
 * floor by being ink. The tutor's coral is a mark on the orb and never words.
 */
export const signal = {
  /** Something to change. Set in ink; the words carry the meaning. */
  correspondance: paper.ink,
  /** A sound that is working. Set in ink; the words carry the meaning. */
  good: paper.ink,
  /** The tutor's voice. A mark, and never words. */
  live: colour.coral,
} as const;

/**
 * The voice circle's four states: coral, the tutor is talking; mint, your turn;
 * sun, it is thinking; ink, ready to be tapped. The intro teaches these states
 * in words, never by colour name, because the glyph and the caption carry the
 * state for a learner who cannot tell the colours apart.
 *
 * Mint and sun are too light to be a mark on paper, so the fill is never the
 * only signal: each state carries a glyph in the colour `onOrb` pairs with it,
 * and the caption beside the orb is ink.
 */
export const orb = {
  /** Coral. The tutor is speaking. Listen. */
  speaking: colour.coral,
  /** Mint. Your turn. Speak. */
  yourTurn: colour.mint,
  /** Sun. The tutor is thinking. One moment. */
  thinking: colour.sun,
  /**
   * Ink. The microphone is closed and the circle is waiting to be pressed. Not
   * a fourth state report: the primary control of the whole product, so it
   * takes the primary colour exactly as the pill does.
   */
  ready: paper.ink,
} as const;

/**
 * What sits ON each orb fill: the voice bars and the embedded status. White on
 * coral and ink, ink on mint and sun, so every glyph clears the text floor on
 * its own fill.
 */
export const onOrb = {
  speaking: paper.onInk,
  yourTurn: paper.ink,
  thinking: paper.ink,
  ready: paper.onInk,
} as const;

/**
 * What the words on each colour ground are set in: white on blue and coral, ink
 * on sun and mint, and never the other way round (STYLE section 4's forbidden
 * pairs).
 */
export const textOn = {
  blue: paper.onInk,
  coral: paper.onInk,
  sun: paper.ink,
  mint: paper.ink,
} as const;

/**
 * The secondary line on each ground: a meta line, the English under a French
 * line. Soft ink is never set on a colour, so each ground has its own. Coral
 * has no secondary and takes white; ink is the live-session dark ground.
 */
export const onColour = {
  /** 6.2 on blue. */
  blue: '#E4E1FF',
  /** White, 4.7 on coral: coral carries one text colour. */
  coral: paper.onInk,
  /** 7.0 on sun. */
  sun: '#3E3A56',
  /** 5.5 on mint. */
  mint: '#3E3A56',
  /** 10.7 on ink. */
  ink: '#C9C6DE',
} as const;

/**
 * The pending bars of the story segments on each ground. A decorative mark
 * beside the done bars, which are `textOn` of the ground; on paper the pending
 * bar is the hairline.
 */
export const segmentPending = {
  blue: '#7F78EB',
  coral: '#E47F6F',
  sun: '#D0A43C',
  mint: '#2AAB7B',
  paper: paper.line,
} as const;

/**
 * The illustrations' lilac. ILLUSTRATIONS.md allows it in the flat drawings and
 * nowhere else, so nothing under `src` but `art/flat/` draws it, and
 * `palette.test.ts` walks the source to keep it that way.
 */
export const lilac = '#B9A7FF';

/**
 * The fills under the four rung numerals. Rungs one to three share the one
 * skeleton fill under an ink numeral, and rung four is plain ink: no line left
 * to follow. The words in `rungLabel` say which rung is which, not the fill.
 */
export const rungColor: Record<1 | 2 | 3 | 4, string> = {
  1: paper.skeleton,
  2: paper.skeleton,
  3: paper.skeleton,
  4: paper.ink,
};

/**
 * Tints are retired (notebook redesign, 2026-09-27).
 *
 * Six soft papers used to sit under a place's row, a way into the tutor, a kind
 * of practice and the speaking rhythm, named by role in four small tables. The
 * app has one ground and one white card, so the tokens, the role tables and the
 * tinted primitives are deleted, and `surfaceContract.test.ts` refuses any of
 * them coming back: no `tint` token, no role table, no tinted row, panel or
 * disc, and none of the six hexes anywhere in source. DESIGN.md's Colour
 * section records the retirement.
 */

/** Decorative cloud-orb colours; never used for text or plan status. */
export const cloudOrb = {
  deep: '#6670FA',
  upper: '#7E8AFF',
  lower: '#BECBF9',
  milk: '#EBEFFF',
} as const;

/** Password feedback colours: strength always also has a readable label. */
export const passwordMeter = { low: colour.coral, medium: colour.sun, good: '#17623F' } as const;
