/**
 * The row and disc glyphs: ICONS.md's marks, at its one stroke.
 *
 * They live here rather than in `components.tsx` because that file is sliced
 * between adjacent `export function X(` markers by its own test, and a new
 * export in the middle of it moves somebody else's region. `close` and `check`
 * are the exception and sit in `components.tsx`, beside the parts that draw
 * them: this file imports from that one (`SpeakerGlyph`), so the reverse edge
 * would be a cycle.
 *
 * The contract is `nav/icons.tsx`'s, deliberately word for word: one shared
 * wrapper, viewBox 0 0 24 24, `<Svg {...decorative}>` so assistive tech walks
 * straight past, and a single `<G>` carrying `fill="none"`, the shared STROKE
 * and round caps and joins. Nothing here is filled: ICONS.md fills only the two
 * brand marks. `glyphs.test.ts` and `motion.test.ts` walk this file to keep it
 * that way.
 *
 * Every export keeps the name it had in revamp A, and takes its ICONS.md path
 * where ICONS.md draws the same thing. `CoffeeCupGlyph`, `QuoteGlyph` and
 * `PlaceGlyph` have no ICONS.md match, so they stay as drawn, at the new
 * stroke, until the stages that redraw their callers retire them.
 *
 * The right chevron is NOT here: `components.tsx` has drawn ChevronLeft since
 * the first pushed screen and the pair belongs together.
 */

import Svg, { Path, Circle, G, Rect } from 'react-native-svg';
import type { MissionPlace } from '@luvani/core';
import { decorative, paper, STROKE } from './theme.ts';

export interface GlyphProps {
  size?: number;
  color?: string;
}

/**
 * The speaker mark, which is the ear the tutor's voice already used.
 *
 * Re-exported rather than redrawn: a phrase card's round speaker button and the
 * "tutor is talking" ear are the same idea (sound arriving), and two drawings
 * of it would drift apart the first time one of them was nudged.
 */
export { EarGlyph as SpeakerGlyph } from './components.tsx';

function Glyph({ size = 24, color = paper.ink, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...decorative}>
      <G fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

/** ICONS.md `clock`: how long tonight's French takes. */
export function ClockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 7v5l3.5 2" />
    </Glyph>
  );
}

/** The everyday mission: a café cup. No ICONS.md match; kept until Stage 3 retires it. */
export function CoffeeCupGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 9.5h11.2v5.3a4.2 4.2 0 0 1-4.2 4.2H9.2A4.2 4.2 0 0 1 5 14.8z" />
      <Path d="M16.2 10.8h1.8a2.4 2.4 0 0 1 0 4.8h-1.8" />
      <Path d="M9.4 6.4c.7-.9.7-1.6 0-2.5M12.6 6.6c.7-.9.7-1.8 0-2.7" />
    </Glyph>
  );
}

/** ICONS.md `language`: talking about anything, two bubbles in turn. */
export function ChatGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M5.5 4.5h7a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2H8.5L6 15.5V13h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
      <Path d="M14.5 9h4a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-1v3.5l-3-3.5h-3a2 2 0 0 1-2-2V13" />
    </Glyph>
  );
}

/** ICONS.md `book`: a written conversation, and the phrasebook. */
export function DocumentGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.5 18.5A2.5 2.5 0 0 1 7 16h13" />
      <Path d="M7 3h13v18H7a2.5 2.5 0 0 1-2.5-2.5v-13A2.5 2.5 0 0 1 7 3Z" />
    </Glyph>
  );
}

/** ICONS.md `repeat-one`: replay a moment, once more. */
export function ReplayGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M16.5 3l3.5 3.5-3.5 3.5" />
      <Path d="M3.5 12v-1.5a4 4 0 0 1 4-4H20" />
      <Path d="M7.5 21 4 17.5 7.5 14" />
      <Path d="M20.5 12v1.5a4 4 0 0 1-4 4H4" />
      <Path d="M10.75 10.75 12.25 9.5v5" />
    </Glyph>
  );
}

/** The phrase shelf: what the learner said, kept in quotes. No ICONS.md match; kept until Stage 6 retires it. */
export function QuoteGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M8 11.6H3.6v4.6H8v-4.6c0-2.9 1.3-4.9 4-6" />
      <Path d="M18.2 11.6h-4.4v4.6h4.4v-4.6c0-2.9 1.3-4.9 4-6" />
    </Glyph>
  );
}

/** ICONS.md `waveform`: a voice seen sideways, the middle bar the tallest. */
export function WaveformGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3" />
    </Glyph>
  );
}

/**
 * The mark for a place a conversation happens in.
 *
 * No ICONS.md match: kept as drawn, at the new stroke, until Stage 3 draws the
 * places with the flat illustrations and Stage 6 retires it.
 *
 * One case per `MissionPlace`, because the tint is chosen by place too
 * (`missions/missionTint.ts`) and a row whose colour and drawing disagreed
 * would be two different situations on one line. The switch is exhaustive by
 * the union rather than by a default, so a seventh place is a typecheck
 * failure here and not a blank disc on a phone.
 */
export function PlaceGlyph({ place, ...rest }: GlyphProps & { place: MissionPlace }) {
  return <Glyph {...rest}>{placeMark(place)}</Glyph>;
}

function placeMark(place: MissionPlace): React.ReactNode {
  switch (place) {
    /** Café: the little round table, seen from the side, with a cup on it. */
    case 'cafe':
      return (
        <>
          <Path d="M4 20.2h16" />
          <Path d="M12 20.2v-6" />
          <Path d="M6.2 14.2h11.6" />
          <Path d="M14.6 8.4h-6v2.6a3 3 0 0 0 6 0z" />
          <Path d="M14.6 9.2h1.2a1.4 1.4 0 0 1 0 2.8h-1.2" />
        </>
      );
    /** Hotel: a bed with its headboard, which is the front desk's other half. */
    case 'hotel':
      return (
        <>
          <Path d="M3.6 18.4V9.8" />
          <Path d="M3.6 13.2h16.8v5.2" />
          <Path d="M20.4 13.2v5.2" />
          <Path d="M6 13.2V8.6h4.4v4.6" />
          <Path d="M3.6 15.8h16.8" />
        </>
      );
    /** Market: a basket with a handle and three things standing in it. */
    case 'market':
      return (
        <>
          <Path d="M4.2 10.4h15.6l-1.6 8.4H5.8z" />
          <Path d="M8.2 10.4a3.8 3.8 0 0 1 7.6 0" />
          <Path d="M9 13.4v3M12 13.4v3M15 13.4v3" />
        </>
      );
    /** Street: a signpost pointing two ways, which is asking the way. */
    case 'street':
      return (
        <>
          <Path d="M12 20.6V4.2" />
          <Path d="M12 7h7.2l1.8 1.8-1.8 1.8H12z" />
          <Path d="M12 12.6H5.4L3.6 14.4l1.8 1.8H12z" />
        </>
      );
    /** Home: the sun through a window, the warmest of the six. */
    case 'home':
      return (
        <>
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
        </>
      );
    /** Friends: two glasses raised, and nobody drawn holding them. */
    case 'friends':
      return (
        <>
          <Path d="M6 4.2h5v4.8a2.5 2.5 0 0 1-5 0z" />
          <Path d="M8.5 11.5v6M6.4 17.5h4.2" />
          <Path d="M13 4.2h5v4.8a2.5 2.5 0 0 1-5 0z" />
          <Path d="M15.5 11.5v6M13.4 17.5h4.2" />
        </>
      );
  }
}

// ─────────────────────────────────────────── the Round 1 marks (revamp B)
// ICONS.md marks the Round 1 boards draw that no revamp A name covered.

/** ICONS.md `chevron-down`: a row or a sheet that opens downward. */
export function ChevronDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 9l7 7 7-7" />
    </Glyph>
  );
}

/** ICONS.md `play`. */
export function PlayGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 4.5v15l12.5-7.5Z" />
    </Glyph>
  );
}

/** ICONS.md `speaker-slow`: the speaker with its outer arc dashed, for "Simpler". */
export function SpeakerSlowGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 9.5h3.5L13 5v14l-5.5-4.5H4Z" />
      <Path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
      <Path d="M19 7a7 7 0 0 1 0 10" strokeDasharray="2.6 2.6" />
    </Glyph>
  );
}

/** ICONS.md `mic-off`: the microphone struck through. */
export function MicOffGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <Path d="M12 18v3" />
      <Path d="M8.5 21h7" />
      <Path d="M4 4l16 16" />
    </Glyph>
  );
}

/** ICONS.md `keyboard`: type instead. The keys are dots drawn by the round cap. */
export function KeyboardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Rect x={2.5} y={6} width={19} height={12} rx={2.5} />
      <Path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M6.5 14h.01M17.5 14h.01M9.5 14h5" />
    </Glyph>
  );
}

/** ICONS.md `plus`. */
export function PlusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

/** ICONS.md `search`. */
export function SearchGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Path d="M15.5 15.5 20.5 20.5" />
    </Glyph>
  );
}

/** ICONS.md `settings`: the cog. */
export function SettingsGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M18.95 9.77L21.33 10.21L21.33 13.79L18.95 14.23A7.3 7.3 0 0 1 18.49 15.34L18.49 15.34L19.87 17.33L17.33 19.87L15.34 18.49A7.3 7.3 0 0 1 14.23 18.95L14.23 18.95L13.79 21.33L10.21 21.33L9.77 18.95A7.3 7.3 0 0 1 8.66 18.49L8.66 18.49L6.67 19.87L4.13 17.33L5.51 15.34A7.3 7.3 0 0 1 5.05 14.23L5.05 14.23L2.67 13.79L2.67 10.21L5.05 9.77A7.3 7.3 0 0 1 5.51 8.66L5.51 8.66L4.13 6.67L6.67 4.13L8.66 5.51A7.3 7.3 0 0 1 9.77 5.05L9.77 5.05L10.21 2.67L13.79 2.67L14.23 5.05A7.3 7.3 0 0 1 15.34 5.51L15.34 5.51L17.33 4.13L19.87 6.67L18.49 8.66A7.3 7.3 0 0 1 18.95 9.77Z" />
      <Circle cx={12} cy={12} r={3} />
    </Glyph>
  );
}

/** ICONS.md `lock`. */
export function LockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Rect x={5} y={11} width={14} height={10} rx={2.5} />
      <Path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </Glyph>
  );
}

/** ICONS.md `share`. */
export function ShareGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 3.5v11" />
      <Path d="M8 7.5 12 3.5l4 4" />
      <Path d="M8 11.5H5.5A1.5 1.5 0 0 0 4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6a1.5 1.5 0 0 0-1.5-1.5H16" />
    </Glyph>
  );
}

/** ICONS.md `cards`: the review deck. */
export function CardsGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3h9A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H17" />
      <Rect x={3} y={7} width={14} height={14} rx={2.5} />
    </Glyph>
  );
}

/** ICONS.md `info`. The dot is drawn by the round cap, not a fill. */
export function InfoGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 11v5" />
      <Path d="M12 8h.01" />
    </Glyph>
  );
}

/** ICONS.md `alert`: beside a field's error line. Errors are never red. */
export function AlertGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M10.3 4.5 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z" />
      <Path d="M12 9.5v4" />
      <Path d="M12 17h.01" />
    </Glyph>
  );
}

/** ICONS.md `postcard`. */
export function PostcardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Rect x={2.5} y={5.5} width={19} height={13} rx={2.5} />
      <Rect x={15} y={8.5} width={3.5} height={3.5} rx={0.75} />
      <Path d="M6 11.5h5M6 15h7" />
    </Glyph>
  );
}
