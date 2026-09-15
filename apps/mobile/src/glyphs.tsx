/**
 * The row and disc glyphs — the same pen as the tab icons.
 *
 * Revamp A puts a white disc with a line-art mark at the head of every tinted
 * row and at the head of several white ones, so the app needed a clock, a cup,
 * a bubble, a page, the replay arrows, a pair of quote marks, a waveform and
 * one mark per place a mission happens in. They live here rather than in
 * `components.tsx` because that file is sliced between adjacent
 * `export function X(` markers by its own test, and a new export in the middle
 * of it moves somebody else's region.
 *
 * The contract is `nav/icons.tsx`'s, deliberately word for word: one shared
 * wrapper, viewBox 0 0 24 24, `<Svg {...decorative}>` so assistive tech walks
 * straight past, and a single `<G>` carrying `fill="none"`, the shared STROKE
 * and round caps and joins. One pen drew the whole app, and `motion.test.ts`
 * now walks this file to keep it that way.
 *
 * The right chevron is NOT here: `components.tsx` has drawn ChevronLeft since
 * the first pushed screen and the pair belongs together.
 */

import Svg, { Path, Circle, G } from 'react-native-svg';
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

/** How long tonight's French takes, beside the ready line. */
export function ClockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Circle cx={12} cy={12} r={8.6} />
      <Path d="M12 7.2v5.1l3.4 2.1" />
    </Glyph>
  );
}

/** The everyday mission: a café cup with its steam not quite straight. */
export function CoffeeCupGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M5 9.5h11.2v5.3a4.2 4.2 0 0 1-4.2 4.2H9.2A4.2 4.2 0 0 1 5 14.8z" />
      <Path d="M16.2 10.8h1.8a2.4 2.4 0 0 1 0 4.8h-1.8" />
      <Path d="M9.4 6.4c.7-.9.7-1.6 0-2.5M12.6 6.6c.7-.9.7-1.8 0-2.7" />
    </Glyph>
  );
}

/** Talking about anything: one open bubble, nothing written in it yet. */
export function ChatGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M5.6 5.4h12.8a2.2 2.2 0 0 1 2.2 2.2v7a2.2 2.2 0 0 1-2.2 2.2h-7.6l-4.4 3.3v-3.3a2.2 2.2 0 0 1-2.2-2.2v-7a2.2 2.2 0 0 1 2.2-2.2Z" />
    </Glyph>
  );
}

/** A written conversation: a page with a folded corner and two lines on it. */
export function DocumentGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 3.6h7.2l4.4 4.4v12.4H7z" />
      <Path d="M14.2 3.6v4.4h4.4" />
      <Path d="M9.6 12.2h5.4M9.6 15.8h4" />
    </Glyph>
  );
}

/** Replay a moment: the two arrows going round again. */
export function ReplayGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M19.2 12a7.2 7.2 0 0 1-12.4 5" />
      <Path d="M4.8 12a7.2 7.2 0 0 1 12.4-5" />
      <Path d="M17.2 3.6v3.4h-3.4" />
      <Path d="M6.8 20.4V17h3.4" />
    </Glyph>
  );
}

/** The phrase shelf: what the learner said, kept in quotes. */
export function QuoteGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M8 11.6H3.6v4.6H8v-4.6c0-2.9 1.3-4.9 4-6" />
      <Path d="M18.2 11.6h-4.4v4.6h4.4v-4.6c0-2.9 1.3-4.9 4-6" />
    </Glyph>
  );
}

/** Tune one sound: a voice seen sideways, the middle bar the tallest. */
export function WaveformGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M4.5 10v4M8.2 7.2v9.6M12 4.6v14.8M15.8 8v8M19.5 10.4v3.2" />
    </Glyph>
  );
}

/**
 * The mark for a place a conversation happens in.
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
