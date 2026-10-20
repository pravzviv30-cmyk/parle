/**
 * The complete colour vocabulary. This leaf module imports nothing so the
 * palette can be tested without loading React Native.
 *
 * Bright Luvani (direction B), the one design system (DECISIONS.md,
 * 2026-10-19). A warm paper ground, white cards, one deep ink, four saturated
 * colours that each lead a screen or report the tutor's state, and four soft
 * pastels for illustrated Explore cards. The chartreuse is still a highlighter
 * pen and never a surface.
 *
 * The C2 "bold rhythm" and Luvani-theme names (`boldRhythm`, `mainApp.light`)
 * survive only as aliases of these values until A2 and A3 move their screens
 * across; they no longer carry a hex of their own except where noted.
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
  /**
   * The one hairline. Decorative dividers only. Folds the old #EADFCB and the
   * C2 border #DCD2C4 into one value (DECISIONS.md, 2026-10-19).
   */
  line: '#F0E6D6',
  /** Alias of line. B has one hairline, on the ground and inside a card alike. */
  lineOnCard: '#F0E6D6',
  /**
   * A recessed well inside a white card: a track, a quiet field, a stat
   * plate. Replaces the C2 sand #EFE6D9. Never on the ground itself.
   */
  inset: '#F5EEE2',
  /** Secondary words on a pastel (lavender, butter, peach, sage): 6.5+ on each. */
  inkOnPastel: '#4A4766',
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
  /** The blue under a finger: a pressed blue control. White on it (10.9). */
  bluePressed: '#2A20B0',
  /** A pale mint wash behind a done or earned state. Ink or mintWords on it. */
  mintWash: '#D4F5E5',
  /** Green words: 5.3 on white, 4.5 on mintWash. The only green that letters text. */
  mintWords: '#1F7A52',
  /**
   * A pale violet ring (B0, 2026-10-20): a progress track, a decorative circle.
   * About 1.4 on white, so it is decoration only and never the only edge of a
   * control or a mark that carries meaning.
   */
  ring: '#D9CFE9',
  /**
   * A second violet, a chip ground on a blue card (B0, 2026-10-20). White words
   * on it clear the floor; onColour.blue never sits on it.
   */
  violet2: '#5A50EA',
} as const;

/**
 * The four soft pastels. Grounds for illustrated Explore cards and gentle
 * section cards, never for a primary action. Ink on them, or inkOnPastel for a
 * secondary line.
 */
export const pastel = {
  butter: '#FFE8AB',
  lavender: '#E9E3FA',
  peach: '#F7D8C7',
  sage: '#D4E2D7',
} as const;

/**
 * The one soft lift (DECISIONS.md, 2026-10-19), reversing the old no-shadow
 * rule for illustrated Explore cards only. Ink at 0.45 alpha; the geometry
 * lives with the token in theme.ts.
 */
export const liftInk = 'rgba(22, 18, 58, 0.45)';

/**
 * Alias table for the retired C2 "bold rhythm" names. Every entry points at
 * the one direction-B value: muted is inkSoft, line is the one hairline, sand
 * is the inset well.
 */
export const boldRhythm = {
  butter: pastel.butter,
  violet: colour.blue, sun: colour.sun, paper: paper.ground, ink: paper.ink,
  white: paper.card, lavender: pastel.lavender, peach: pastel.peach, sage: pastel.sage,
  coral: colour.coral, muted: paper.inkSoft, line: paper.line, sand: paper.inset,
} as const;

/**
 * The retired Luvani-theme semantic names. `light` is now an alias table onto
 * direction B; `dark` keeps its own values for when dark mode returns
 * (DARK_MODE_ENABLED is false).
 */
export const mainApp = {
  light: { background: paper.ground, surface: paper.card, inset: pastel.lavender, text: paper.ink, muted: paper.inkSoft, border: paper.line, hero: colour.blue, plum: pastel.lavender, teal: pastel.sage, rose: pastel.peach, ochre: pastel.butter, link: colour.blue, selected: paper.card, danger: '#C2341F' },
  dark: { background: '#151127', surface: '#25203D', inset: '#302A48', text: paper.ground, muted: '#C6BED8', border: '#514967', hero: '#363064', plum: '#322B50', teal: '#233F41', rose: '#49333F', ochre: '#493C2E', link: '#A79AFF', selected: '#4A4170', danger: '#FF9A85' },
} as const;

/** Exact approved editable illustration colours. */
export const mainArtColours = {
  light: { ink: paper.ink, cream: paper.ground, violet: colour.blue, lilac: '#DED6FF', gold: colour.sun, peach: '#FFBDA5', sage: '#CADFCB', softGold: '#FFE8A5' },
  dark: { ink: '#211C3A', cream: '#EEE8FF', violet: '#A79AFF', lilac: '#625980', gold: '#EDC976', peach: '#DBA5A5', sage: '#80B6AE', softGold: '#C4A66A' },
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

/** Official provider assets retain their required brand colors. */
export const providerBrand = { black: '#000000', white: '#FFFFFF', googleInk: '#1F1F1F' } as const;

/**
 * Direction B's semantic tokens, one set per appearance (DECISIONS.md UI-008,
 * 2026-10-20). Light is read straight off the canvas artboards and equals the
 * values above, so a screen drawn from `b.light` looks exactly as it did from
 * `paper` and `colour`. Dark follows the Figma M3 "Reviewed main app, Dark"
 * page (file sjAwoGinWQKvhGrWbgMO18, 307:364), the same values as
 * `mainApp.dark`. Screens read these through `useB()` (main/MainAppearance.tsx)
 * and never import a mode directly; a screen not yet rebuilt is pinned light.
 */
const bLight = {
  ground: paper.ground,
  card: paper.card,
  inset: paper.inset,
  line: paper.line,
  text: paper.ink,
  muted: paper.inkSoft,
  secondary: paper.inkOnPastel,
  /** The radio ring and the switch-off track: a mark, never words. */
  field: paper.field,
  /** Loading blocks, the pressed wash and the disabled fill. */
  skeleton: paper.skeleton,
  brand: colour.blue,
  brandPressed: colour.bluePressed,
  onBrand: paper.onInk,
  /** The soft words on a blue card (the artboards' near-identical soft lilac, folded into onColour.blue). */
  onBrandSoft: onColour.blue,
  violet2: colour.violet2,
  violetDeep: '#2E24B8',
  periwinkle: lilac,
  ring: colour.ring,
  sun: colour.sun,
  mint: colour.mint,
  mintWash: colour.mintWash,
  mintWords: colour.mintWords,
  /** The ink tick and star stroke on a mint disc, in both modes (B-Today, 2026-10-20). */
  onMint: paper.ink,
  coral: colour.coral,
  butter: pastel.butter,
  lavender: pastel.lavender,
  peach: pastel.peach,
  sage: pastel.sage,
  heroGround: colour.sun,
  heroText: paper.ink,
  heroCta: paper.ink,
  heroCtaText: paper.onInk,
  heroChip: paper.card,
  /** The one primary pill. */
  primary: paper.ink,
  onPrimary: paper.onInk,
  /** The quiet secondary button and chip. */
  quiet: paper.inset,
  link: colour.blue,
  avatar: paper.ink,
  onAvatar: paper.onInk,
  /** The sheet's scrim, drawn at 0.4 opacity. */
  scrim: paper.ink,
  danger: '#C2341F',
  tabCapsule: paper.ink,
  tabSelected: colour.blue,
  tabGlyphSelected: colour.sun,
  tabLabel: paper.ground,
  /** The "Hint" bar of the help legend (B-ThenNow, 2026-10-20). A mark, never words. */
  hint: cloudOrb.upper,
  /** The half arc of an ability practised with help (B-Journey). A mark, never words. */
  sunDeep: '#E0A800',
  /** The five-stage track behind the nodes (B-Journey). */
  stageTrack: '#EFE7F9',
  /** The art panel inside the peach Postcards tile (B-Journey). */
  peachSoft: '#FCEADF',
  /** The art panel inside the lavender Badges tile (B-Journey). */
  lavenderSoft: '#F5F1FE',
  statusBar: 'dark' as 'dark' | 'light',
};

export type BTokens = { readonly [K in Exclude<keyof typeof bLight, 'statusBar'>]: string } & { readonly statusBar: 'dark' | 'light' };

export const b: { readonly light: BTokens; readonly dark: BTokens } = {
  light: bLight,
  dark: {
    ...bLight,
    ground: '#151127',
    card: '#25203D',
    inset: '#302A48',
    line: '#514967',
    text: paper.ground,
    muted: '#C6BED8',
    secondary: '#C6BED8',
    skeleton: '#302A48',
    ring: '#514967',
    // Mint words on the dark teal wash and on a dark card: the mint itself
    // clears the text floor on both (palette.test.ts).
    mintWash: '#233F41',
    mintWords: colour.mint,
    butter: '#493C2E',
    lavender: '#322B50',
    peach: '#49333F',
    sage: '#233F41',
    heroGround: '#363064',
    heroText: paper.ground,
    heroCta: colour.sun,
    heroCtaText: paper.ink,
    heroChip: '#4A4170',
    primary: colour.blue,
    onPrimary: paper.onInk,
    quiet: '#302A48',
    link: '#A79AFF',
    avatar: '#302A48',
    onAvatar: paper.ground,
    scrim: '#000000',
    danger: '#FF9A85',
    // 2026-10-20 UI-008, B-Journey and B-ThenNow: the stage track sits on the
    // dark card's inset, and the tiles' art panels one step lighter than their pastel.
    stageTrack: '#302A48',
    peachSoft: '#5A3F4C',
    lavenderSoft: '#3D3560',
    statusBar: 'light',
  },
};
