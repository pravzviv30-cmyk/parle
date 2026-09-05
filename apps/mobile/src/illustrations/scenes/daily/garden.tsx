/**
 * Three garden drawings for the word of the day: a snail on a leaf, a cat on a
 * wall, and a toy boat on a pond.
 *
 * The pack's rules are written out at the top of `kitchen.tsx`. The one worth
 * repeating here is the silhouette rule these three lean on: where two shapes
 * meet, only one of them draws the line. The snail's foot is the leaf's edge,
 * and the cat's underside is the top of the wall. Drawing both would put two
 * strokes in one place, which reads as a blot rather than as either of them.
 */

import { Circle, Path } from 'react-native-svg';
import { paper } from '../../../theme.ts';
import { unit } from '../../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../../pen.tsx';
import { useSceneMotion } from '../../useSceneMotion.ts';

/**
 * A snail crossing a leaf, at the speed of a snail.
 *
 * The shell is the oversized object: a fifth of the frame across, on a body
 * that could not possibly carry it. One very long loop, a few units of
 * travel, and no rotation — inching is the whole joke, and a snail that
 * hurries is a slug.
 */
export function WordSnail({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 3600 }], paused });
  const creep = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the leaf, its midrib and three veins */}
        <Path d="M16 114C44 84 100 76 148 88C158 91 168 98 174 106C130 122 56 126 16 114Z" />
        <Path d="M16 114l-8 6" />
        <Path d="M20 113C66 108 122 100 172 106" />
        <Path d="M60 110l-4 8M92 104l-2 9M124 101v9" />
        <Stipple points={[[38, 118], [44, 121], [32, 120], [140, 114], [146, 117]]} />
      </Frame>

      {/* the snail, inching */}
      <Moving
        box={{ x: 100, y: 70, w: 92, h: 60 }}
        width={width}
        style={{
          transform: [
            { translateX: creep?.interpolate({ inputRange: [0, 1], outputRange: [-3 * u, 3 * u] }) ?? 0 },
          ],
        }}
      >
        {/* the shell: one line wound in on itself */}
        <Path d="M96 42c11 0 20 9 20 20s-9 20-20 20-18-8-18-17 7-16 16-16 14 6 14 13-5 12-11 12-9-4-9-8 3-7 7-7" />
        {/* the body, in two strokes, with the leaf closing the underside */}
        <Path d="M62 90c1-8 7-13 15-14" />
        <Path d="M106 80c12 0 20-3 26-9" />
        <Path d="M132 71c5 4 3 12-5 14" />
        {/* two stalks, and the only solid marks in the frame */}
        <Path d="M130 68l5-13" />
        <Circle cx={136} cy={53} r={2.2} fill={paper.ink} stroke="none" />
        <Path d="M124 70l-1-12" />
        <Circle cx={123} cy={56} r={2} fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}

/**
 * A cat sitting on a wall, deciding.
 *
 * The head is the oversized object — it is two thirds of the body — and the
 * top of the wall is the cat's underside, so neither line is drawn twice. One
 * loop moves the tail, and it rotates about the base of the tail because the
 * `Moving` box is centred there: a tail that swings about its own middle
 * detaches from the cat at both ends.
 */
export function WordCat({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 1600 }], paused });
  const swish = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the wall: two courses, joints staggered, running off the frame */}
        <Path d="M14 96h172" />
        <Path d="M14 116h172" />
        <Path d="M14 136h172" />
        <Path d="M14 96v48M186 96v48" />
        <Path d="M48 96v20M96 96v20M144 96v20" />
        <Path d="M26 116v20M72 116v20M120 116v20M168 116v20" />

        {/* the cat, sitting. The wall closes the bottom of it. */}
        <Path d="M94 66c-8 8-12 18-12 30" />
        <Path d="M126 66c8 8 12 18 12 30" />
        <Path d="M100 93V78M112 93V80" />
        <Path d="M96 96c0-4 8-4 8 0M110 96c0-4 8-4 8 0" />
        <Circle cx={110} cy={46} r={17} />
        <Path d="M97 36l-3-13 14 6" />
        <Path d="M123 36l3-13-14 6" />
        <Circle cx={104} cy={45} r={1.9} fill={paper.ink} stroke="none" />
        <Circle cx={116} cy={45} r={1.9} fill={paper.ink} stroke="none" />
        <Path d="M110 52l-3.5 3h7z" fill={paper.ink} stroke="none" />
        <Path d="M110 55c-3 3-6 1-6-1M110 55c3 3 6 1 6-1" />
        <Path d="M105 58l-14-3M105 61l-13 3M116 58l14-3M116 61l13 3" />
        <Stipple points={[[34, 106], [40, 109], [28, 110], [158, 126], [164, 129]]} />
      </Frame>

      {/* the tail, swishing from where it joins */}
      <Moving
        box={{ x: 138, y: 94, w: 60, h: 44 }}
        width={width}
        style={{
          transform: [
            { rotate: swish?.interpolate({ inputRange: [0, 1], outputRange: ['-9deg', '9deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M138 94c14 2 22-4 24-16" />
      </Moving>
    </Scene>
  );
}

/**
 * A toy boat on a pond, bobbing.
 *
 * The rig is the oversized object: the mast is most of the height of the frame
 * over a hull you could hold in one hand, which is what makes it a toy. Two loops — the boat rocks on one
 * and the ripples under it drift on the other, slower and starting late, so
 * the water is never doing the same thing as the thing floating on it.
 */
export function WordSailboat({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 2400 }, { period: 3400, delay: 500 }],
    paused,
  });
  const rock = loops[0];
  const wake = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the water, with a gap in it exactly where the hull sits */}
        <Path d="M14 124h44M142 124h44" />
        <Path d="M22 132c6-4 14-4 20 0" />
        <Path d="M158 134c6-4 14-4 20 0" />
        {/* two reeds at the near edge, and one cattail */}
        <Path d="M170 124c2-14 4-22 8-30M178 124c0-12 1-18 3-24" />
        <Path d="M179 84c3.4 0 4.4 3 4.4 6.5s-1 6.5-4.4 6.5-4.4-3-4.4-6.5 1-6.5 4.4-6.5z" fill={paper.ink} stroke="none" />
        <Stipple points={[[30, 140], [36, 142], [24, 141], [150, 140], [156, 142]]} />
      </Frame>

      {/* the boat, rocking */}
      <Moving
        box={{ x: 100, y: 82, w: 92, h: 92 }}
        width={width}
        style={{
          transform: [
            { translateY: rock?.interpolate({ inputRange: [0, 1], outputRange: [1.5 * u, -1.5 * u] }) ?? 0 },
            { rotate: rock?.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M58 108h84l-14 16H72z" />
        <Path d="M100 108V40" />
        <Path d="M104 46l30 50h-30z" />
        <Path d="M96 58L74 96h22z" />
        <Path d="M100 40l14 5-14 5z" fill={paper.ink} stroke="none" />
      </Moving>

      {/* and the water going the other way under it */}
      <Moving
        box={{ x: 112, y: 131, w: 110, h: 24 }}
        width={width}
        style={{
          opacity: wake?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] }) ?? 1,
          transform: [
            { translateX: wake?.interpolate({ inputRange: [0, 1], outputRange: [-4 * u, 4 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M64 128c6-4 14-4 20 0" />
        <Path d="M120 132c6-4 14-4 20 0" />
      </Moving>
    </Scene>
  );
}
