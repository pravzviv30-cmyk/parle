/**
 * A seedling being watered. The drawing beside the word of the day.
 *
 * The card says: here is one French word, and here is what it is for. So the
 * picture is a small thing being fed rather than a thing being finished. A
 * seedling figure stands in its pot, a long-spouted can leans in from the top
 * right, and three drops are on their way down. The service bell on the ground
 * beside the pot is the picture-book beat the mockup asked for: something small
 * and domestic sharing the table with the plant, and it is the same bell the
 * hotel desk already draws, so the app has one bell rather than two.
 *
 * ## What moves, and why only that
 *
 * The water, and nothing else. The figure is the subject and a subject that
 * fidgets stops being read; the can is heavy enough on the page that tilting it
 * would drag the eye off the word. Water falling is the one thing in this frame
 * that is genuinely in motion, so it is the one thing given a loop.
 *
 * The drops are their own `Moving` layer for the reason `pen.tsx` sets out at
 * length: a layer animated inside the still `<Svg>` would have to animate an
 * SVG attribute, which cannot cross to the native driver, and a layer sized in
 * its own box would draw at its own stroke weight. `Moving` keeps them in the
 * scene's 200x150 coordinates, so a drop written at x=91 falls out of a spout
 * written at x=91 and draws at the spout's weight. Their travel is multiplied
 * by `unit(width)` because a transform is in CONTAINER pixels while the drawing
 * is in viewBox units, and mixing the two is how a scene drifts when it is
 * rendered at a size nobody tried.
 *
 * Reduce motion and a tab that is not focused both rest the loop at 0.5, which
 * is drops mid-fall between the rose and the leaves. That is the whole drawing,
 * held still. `useSceneMotion` owns that rule; this file does not repeat it.
 */

import { Circle, Ellipse, Path } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { unit } from '../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion } from '../useSceneMotion.ts';

export function WordSprout({ width = 200, paused = false }: SceneProps) {
  // One loop. Slower than the cafe's steam reads as a shower rather than a
  // patter, which is the "gently" in gently watered.
  const { loops, settled } = useSceneMotion({ loops: [{ period: 1800 }], paused });
  const water = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the ground, short of both edges so the scene is not a box */}
        <Path d="M24 134h142" />

        {/* the pot: a rim band and a tapering body, set down a degree off true */}
        <Path d="M58 96h44v9H58z" transform="rotate(-2 80 100)" />
        <Path d="M62 105l5 29h26l5-29z" transform="rotate(-2 80 100)" />

        {/* the figure: a stem for a body, two leaves for arms, a bud for a head */}
        <Path d="M80 96c-3-13 0-23 2-31" />
        <Path d="M81 78c9-2 15-8 16-16-9-1-16 5-17 13" />
        <Path d="M79 88c-9-1-15-7-16-15 9-1 16 5 17 13" />
        <Circle cx={82} cy={53} r={11} />
        {/* the tuft it will grow out of, and the one thing pointing up. It
            leans left because the water comes down on the right, and two small
            shapes in one place read as a blot rather than as either of them. */}
        <Path d="M82 42v-4" />
        <Path d="M82 38c-1-4-4-5-7-4 1 4 4 5 7 4z" />

        {/* the watering can, leaning in from the top right */}
        <Path d="M128 28l44-12 6 28c1 4-1 7-5 8l-26 7c-4 1-7-1-8-5z" />
        <Ellipse cx={150} cy={22} rx={23} ry={5} transform="rotate(-15 150 22)" />
        <Path d="M134 25c4-13 26-16 32-6" />
        <Path d="M176 35c8 3 9 12 1 16" />
        {/* the spout, long on purpose, and the rose at the end of it */}
        <Path d="M129 29c-14-2-27-4-38-11" />
        <Path d="M135 44c-16 0-31-5-43-14" />
        <Ellipse cx={91} cy={24} rx={4} ry={7} transform="rotate(-16 91 24)" />

        {/* shading on the ground, and two marks left hanging in the air */}
        <Stipple points={[[44, 126], [50, 130], [38, 131], [150, 128], [157, 131], [108, 48], [114, 54]]} />

        {/* the service bell, sharing the ground with the pot */}
        <Path d="M114 134h28" />
        <Path d="M116 134c0-9 5-15 12-15s12 6 12 15" />
        <Path d="M128 119v-5" />
        <Circle cx={128} cy={111} r={3.2} />
      </Frame>

      {/*
        Three drops between the rose and the leaves. Opacity and translate only,
        and the ends of the travel are the faint frames, so the return half of
        the cycle reads as the gap between two waterings rather than as water
        running backwards up the spout.
      */}
      <Moving
        box={{ x: 90, y: 39, w: 18, h: 20 }}
        width={width}
        style={{
          opacity: water?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }) ?? 1,
          transform: [
            {
              translateY:
                water?.interpolate({ inputRange: [0, 1], outputRange: [-5 * u, 6 * u] }) ?? 0,
            },
          ],
        }}
      >
        <Path
          d="M91 32c1.7 2.6 2.6 4 2.6 5.1a2.6 2.6 0 0 1-5.2 0c0-1.1.9-2.5 2.6-5.1z"
          fill={paper.ink}
          stroke="none"
        />
        <Path
          d="M95 39c1.3 2 2 3.1 2 3.9a2 2 0 0 1-4 0c0-.8.7-1.9 2-3.9z"
          fill={paper.ink}
          stroke="none"
        />
        <Path
          d="M86 38c1.1 1.7 1.7 2.6 1.7 3.3a1.7 1.7 0 0 1-3.4 0c0-.7.6-1.6 1.7-3.3z"
          fill={paper.ink}
          stroke="none"
        />
      </Moving>
    </Scene>
  );
}
