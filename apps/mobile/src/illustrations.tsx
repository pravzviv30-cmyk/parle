/**
 * The ink illustrations — one pen, eight scenes.
 *
 * House rules, so every future scene coheres:
 *   - stroke `paper.ink` at STROKE (2.2), round caps and joins, never scaled
 *   - `fill="none"` everywhere except tiny solid-ink accents (a beret, a
 *     flame, a heart) — at most a tenth of any scene
 *   - shading is stipple: clusters of r≈1 filled dots, never hatching
 *   - proportions are quirky on purpose: tilted verticals, one oversized
 *     small object per scene, nothing perfectly level
 *   - viewBox 0 0 200 150; scenes scale by width and stay 4:3
 *   - no gradients, no second colour — the paper shows through
 */

import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
import { paper, STROKE } from './theme.ts';

function Frame({ width = 200, children }: { width?: number; children: React.ReactNode }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 200 150" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

function Stipple({ points }: { points: readonly (readonly [number, number])[] }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.1} fill={paper.ink} stroke="none" />
      ))}
    </>
  );
}

/** A café table: cup still steaming, croissant waiting, a beret off duty. */
export function HeroCafe({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* table: tilted oval top on one pedestal leg */}
      <Ellipse cx={95} cy={92} rx={58} ry={12} transform="rotate(-2 95 92)" />
      <Path d="M93 104v28" />
      <Path d="M78 138c6-5 26-5 32 0" />
      {/* cup on saucer, steam keeping its own time */}
      <Ellipse cx={72} cy={83} rx={16} ry={4} />
      <Path d="M60 83c0 8 3 13 12 13s12-5 12-13" />
      <Path d="M84 85c6-1 9 2 7 6-1.6 3.2-6 3-8 1" />
      <Path d="M66 72c-2-4 2-6 0-10M75 73c2-4-2-6 0-10" />
      {/* croissant on a small plate */}
      <Ellipse cx={124} cy={92} rx={17} ry={4.5} transform="rotate(2 124 92)" />
      <Path d="M112 88c2-7 9-10 14-8 5 2 8 7 7 12" transform="rotate(-6 122 86)" />
      <Path d="M117 82.5c0 3 .5 5.5 2 8M122 80.5c.5 3.5 1.5 6 3.5 8.5" />
      {/* the chair, leaning back a little */}
      <Path d="M160 70l4 62" />
      <Path d="M186 74l-4 58" />
      <Path d="M161 78c8-4 17-4 24 0" />
      <Path d="M163 96c7-3 15-3 20 0" />
      {/* a beret hanging off the chair post — the solid accent */}
      <Path d="M150 66c1-7 9-11 16-8 6 3 7 10 3 13-7 4-18 2-19-5z" fill={paper.ink} stroke="none" />
      <Path d="M158 57l2-4" />
      <Stipple points={[[52, 104], [58, 108], [49, 110], [140, 103], [146, 106]]} />
    </Frame>
  );
}

/** A name tag, still wet, and a hand mid-wave. */
export function OnboardWave({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* the tag, slightly askew */}
      <Path d="M30 52c0-5 4-9 9-9h84c5 0 9 4 9 9v50c0 5-4 9-9 9H39c-5 0-9-4-9-9z" transform="rotate(-3 81 77)" />
      <Path d="M33 63l98-5" />
      {/* where a name goes: confident scribbles */}
      <Path d="M46 84c8-4 13 3 20-1s12 2 19-1 12 2 17-1" />
      <Path d="M47 96c6-3 10 2 16-1s10 2 15-1" />
      {/* pin */}
      <Circle cx={78} cy={51} r={2.6} transform="rotate(-3 81 77)" />
      {/* the waving hand */}
      <Path d="M150 108c-4-10-2-19 2-24 3-4 8-5 9-1 1 3-1 7-2 9" />
      <Path d="M159 92c2-5 4-9 8-8 3 1 3 5 1 9" />
      <Path d="M168 93c2-4 5-7 8-5 3 2 1 6-1 10" />
      <Path d="M175 98c3-3 6-4 8-1 2 3-2 7-5 10-5 6-14 9-21 5-3-2-6-8-7-14" />
      {/* wave arcs */}
      <Path d="M138 70c3-3 5-7 5-11M146 74c4-3 7-7 8-12" />
      <Stipple points={[[44, 118], [50, 121], [120, 116]]} />
    </Frame>
  );
}

/** A lopsided cake with one enormous candle. Age is just a number. */
export function OnboardCake({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* cake stand */}
      <Path d="M46 128h108" />
      <Path d="M96 128c0 6 8 6 8 0" transform="translate(0 1)" />
      {/* bottom layer, listing slightly */}
      <Path d="M56 104c0-8 2-12 6-12h76c4 0 6 4 6 12l1 22H55z" transform="rotate(-1.5 100 110)" />
      {/* frosting drips */}
      <Path d="M62 92c2 6 5 7 7 1 2 6 6 7 8 1 2 5 6 6 8 1 2 6 6 6 8 0 2 6 6 6 8 1 2 5 6 6 8 0 2 6 6 6 8 1 2 5 5 6 7 0" transform="rotate(-1.5 100 96)" />
      {/* top layer, listing the other way */}
      <Path d="M74 92l2-22c0-3 2-5 5-5h38c3 0 5 2 5 5l2 22" transform="rotate(2 100 80)" />
      <Path d="M76 76c3 4 6 4 8 0 2 4 6 4 8 0 2 4 6 4 8 0 2 4 6 4 8 0 2 4 6 4 8 0 2 4 5 4 7 0" transform="rotate(2 100 76)" />
      {/* THE candle */}
      <Path d="M97 63V26M105 63V26" />
      <Path d="M97 30c3-2 5-2 8 0M97 40c3 2 5 2 8 0M97 50c3-2 5-2 8 0" />
      <Path d="M101 22v-4" />
      {/* flame — solid accent */}
      <Path d="M101 4c4 5 6 8 6 11 0 4-3 6-6 6s-6-2-6-6c0-3 2-6 6-11z" fill={paper.ink} stroke="none" />
      {/* a little heat */}
      <Path d="M86 16c-2-3-2-6 0-9M116 16c2-3 2-6 0-9" />
      <Stipple points={[[63, 112], [70, 116], [78, 112], [126, 114], [133, 111], [119, 117]]} />
    </Frame>
  );
}

/** A suitcase with opinions about where to go next. */
export function OnboardSuitcase({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* body, tilted like it was set down in a hurry */}
      <Path d="M44 56c0-6 4-10 10-10h92c6 0 10 4 10 10v58c0 6-4 10-10 10H54c-6 0-10-4-10-10z" transform="rotate(-3 100 85)" />
      {/* handle */}
      <Path d="M86 44c0-8 5-13 14-13s14 5 14 13" transform="rotate(-3 100 38)" />
      {/* straps */}
      <Path d="M72 49l6 76M124 44l6 76" transform="rotate(-3 100 85)" />
      {/* latches */}
      <Path d="M74 60h8v7h-8zM120 57h8v7h-8z" transform="rotate(-3 100 62)" />
      {/* stickers: a solid heart, an outline sun, a small triangle */}
      <Path d="M98 78c3-5 9-4 9 1 0 4-5 7-9 10-4-3-9-6-9-10 0-5 6-6 9-1z" fill={paper.ink} stroke="none" transform="rotate(6 98 84)" />
      <Circle cx={62} cy={92} r={6} transform="rotate(-3 62 92)" />
      <Path d="M62 82v-3M62 105v-3M52 92h-3M75 92h-3" transform="rotate(-3 62 92)" />
      <Path d="M132 92l10-6 1 12z" transform="rotate(4 137 92)" />
      {/* going somewhere */}
      <Path d="M22 70c6 0 10 0 14-2M18 84c8 0 13 0 18-2" />
      <Stipple points={[[46, 132], [54, 136], [148, 128], [155, 132], [151, 138]]} />
    </Frame>
  );
}

/** Ten minutes a day. The clock has wings because time will fly. */
export function OnboardClock({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* bells + striker */}
      <Path d="M72 38c-4-8 2-16 10-15M128 38c4-8-2-16-10-15" />
      <Path d="M96 20c2-3 6-3 8 0" />
      {/* body */}
      <Circle cx={100} cy={78} r={42} />
      <Circle cx={100} cy={78} r={34} />
      {/* legs */}
      <Path d="M74 114l-8 12M126 114l8 12" />
      {/* ticks */}
      <Path d="M100 48v6M100 102v6M70 78h6M124 78h6" />
      {/* hands: set to a small, keepable promise */}
      <Path d="M100 78L100 58" />
      <Path d="M100 78l14 8" />
      <Circle cx={100} cy={78} r={2.4} fill={paper.ink} stroke="none" />
      {/* the wings */}
      <Path d="M52 74c-12-2-20 2-26 8 8 2 14 2 20 0M54 84c-8 0-14 3-18 8 6 1 11 0 15-2" />
      <Path d="M148 74c12-2 20 2 26 8-8 2-14 2-20 0M146 84c8 0 14 3 18 8-6 1-11 0-15-2" />
      {/* a hop off the ground */}
      <Path d="M80 136c4-3 8-3 12 0M108 136c4-3 8-3 12 0" />
      <Stipple points={[[38, 116], [44, 120], [160, 114], [166, 118]]} />
    </Frame>
  );
}

/** Two speech bubbles, clinked like glasses. Santé. */
export function SpeakBubbles({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* left bubble, leaning in */}
      <Path
        d="M28 44c0-9 7-16 16-16h34c9 0 16 7 16 16v22c0 9-7 16-16 16H60l-14 14 2-14h-4c-9 0-16-7-16-16z"
        transform="rotate(8 61 63)"
      />
      {/* right bubble, meeting it */}
      <Path
        d="M108 52c0-9 7-16 16-16h34c9 0 16 7 16 16v22c0 9-7 16-16 16h-4l2 14-14-14h-18c-9 0-16-7-16-16z"
        transform="rotate(-8 141 71)"
      />
      {/* the clink */}
      <Path d="M98 34l4-8M104 40l8-4M92 30l0-9" />
      {/* left says … */}
      <Circle cx={50} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
      <Circle cx={61} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
      <Circle cx={72} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
      {/* right answers with a small heart */}
      <Path
        d="M141 60c2.6-4.4 8-3.5 8 .8 0 3.5-4.4 6-8 8.7-3.6-2.7-8-5.2-8-8.7 0-4.3 5.4-5.2 8-.8z"
        fill={paper.ink}
        stroke="none"
        transform="rotate(-8 141 71)"
      />
      <Stipple points={[[86, 120], [93, 124], [100, 119], [108, 123]]} />
    </Frame>
  );
}

/** Word cards with a sprout: practice grows out of conversation. */
export function LearnStack({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* bottom card */}
      <Path d="M46 96c0-4 3-7 7-7h94c4 0 7 3 7 7v26c0 4-3 7-7 7H53c-4 0-7-3-7-7z" transform="rotate(-4 100 109)" />
      {/* middle card */}
      <Path d="M50 74c0-4 3-7 7-7h94c4 0 7 3 7 7v26c0 4-3 7-7 7H57c-4 0-7-3-7-7z" transform="rotate(2 104 87)" />
      {/* top card with a written line and a blank to fill */}
      <Path d="M44 50c0-4 3-7 7-7h96c4 0 7 3 7 7v28c0 4-3 7-7 7H51c-4 0-7-3-7-7z" transform="rotate(-1 99 64)" />
      <Path d="M56 62c7-3 11 2 17-1s11 2 16-1" transform="rotate(-1 99 64)" />
      <Path d="M56 72h34" transform="rotate(-1 99 64)" />
      {/* the sprout, up through the top edge */}
      <Path d="M118 42c0-10 1-16 4-22" />
      <Path d="M121 26c-8-1-13-5-15-12 8 0 13 3 16 8" />
      <Path d="M122 21c1-7 5-11 12-13-1 8-4 12-10 15" />
      {/* soil crumbs it carried up */}
      <Stipple points={[[110, 40], [126, 38], [118, 34], [58, 130], [66, 134], [140, 128]]} />
    </Frame>
  );
}

/** A postcard headed home. Wish you were hearing this. */
export function RecapPostcard({ width }: { width?: number }) {
  return (
    <Frame width={width}>
      {/* the card */}
      <Path d="M32 40c0-4 3-7 7-7h122c4 0 7 3 7 7v70c0 4-3 7-7 7H39c-4 0-7-3-7-7z" transform="rotate(-2 100 75)" />
      {/* divider */}
      <Path d="M100 42v66" transform="rotate(-2 100 75)" />
      {/* address lines */}
      <Path d="M112 76h40M112 88h34M112 100h37" transform="rotate(-2 100 75)" />
      {/* stamp with a hand-torn border */}
      <Path
        d="M132 46l5 2 5-2 5 2 5-2 4 2v5l2 4-2 4v5l-4 2-5-2-5 2-5-2-5 2-4-2v-5l-2-4 2-4v-5z"
        transform="rotate(-2 146 60)"
      />
      {/* postmark */}
      <Path d="M124 44a10 10 0 1 0 0 1M118 52c-4 1-8 4-9 8" transform="rotate(-2 122 50)" />
      {/* Eiffel doodle, left half */}
      <Path d="M66 96c2-16 5-28 10-38M74 96c-2-16-5-28-10-38" transform="translate(-4 0)" />
      <Path d="M58 96c4-6 12-6 16 0" transform="translate(-4 0)" />
      <Path d="M63 78h10M64 68h8" transform="translate(-4 0)" />
      <Path d="M66 58l2-8 2 8" transform="translate(-4 0)" />
      <Path d="M52 96h32" transform="translate(-4 0)" />
      {/* a few km of travel dust */}
      <Stipple points={[[42, 122], [50, 126], [152, 120], [160, 124], [156, 129]]} />
    </Frame>
  );
}
