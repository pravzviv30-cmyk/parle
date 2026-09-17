/**
 * The three onboarding scenes, carried over exactly as they were drawn.
 *
 * These stay still on purpose. Onboarding is four questions in a row and the
 * learner is reading, not watching; a drawing that moved beside every one of
 * them would be four flourishes competing with the thing being asked.
 * `OnboardClock`'s wings are the obvious candidate if that ever changes.
 *
 * The cake left with revamp A. The age gate draws the registered `onboard-cake`
 * picture now, and the name page is the one of these still reached from a
 * screen, so it is the one still offered by the barrel.
 */

import { Path, Circle } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { Frame, Stipple, type SceneProps } from '../pen.tsx';

/** A name tag, still wet, and a hand mid-wave. */
export function OnboardWave({ width }: SceneProps) {
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

/** A suitcase with opinions about where to go next. */
export function OnboardSuitcase({ width }: SceneProps) {
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
export function OnboardClock({ width }: SceneProps) {
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
