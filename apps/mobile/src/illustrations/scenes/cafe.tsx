/**
 * A cafe table: cup still steaming, croissant waiting, a beret off duty.
 *
 * The art is unchanged from the original. What is new is that the steam and
 * the beret have come out of the still frame and into their own layers, so
 * they can move without animating an SVG attribute.
 *
 * This scene also replaces the splash's private copy of itself. That copy
 * drew the table at 260 wide and the steam in its own 44-unit box at width 44,
 * so the steam rendered at 2.2px over a cup rendered at 2.86px. `Moving` keeps
 * both in scene coordinates, so both draw at one weight.
 */

import { Path, Ellipse } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { unit } from '../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion } from '../useSceneMotion.ts';

export function HeroCafe({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    // The steam keeps its own time; the beret sways slower and starts late, so
    // the two never move as one.
    loops: [{ period: 2600 }, { period: 4000, delay: 600 }],
    paused,
  });
  const steam = loops[0];
  const beret = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* table: tilted oval top on one pedestal leg */}
        <Ellipse cx={95} cy={92} rx={58} ry={12} transform="rotate(-2 95 92)" />
        <Path d="M93 104v28" />
        <Path d="M78 138c6-5 26-5 32 0" />
        {/* cup on saucer */}
        <Ellipse cx={72} cy={83} rx={16} ry={4} />
        <Path d="M60 83c0 8 3 13 12 13s12-5 12-13" />
        <Path d="M84 85c6-1 9 2 7 6-1.6 3.2-6 3-8 1" />
        {/* croissant on a small plate */}
        <Ellipse cx={124} cy={92} rx={17} ry={4.5} transform="rotate(2 124 92)" />
        <Path d="M112 88c2-7 9-10 14-8 5 2 8 7 7 12" transform="rotate(-6 122 86)" />
        <Path d="M117 82.5c0 3 .5 5.5 2 8M122 80.5c.5 3.5 1.5 6 3.5 8.5" />
        {/* the chair, leaning back a little */}
        <Path d="M160 70l4 62" />
        <Path d="M186 74l-4 58" />
        <Path d="M161 78c8-4 17-4 24 0" />
        <Path d="M163 96c7-3 15-3 20 0" />
        <Path d="M158 57l2-4" />
        <Stipple points={[[52, 104], [58, 108], [49, 110], [140, 103], [146, 106]]} />
      </Frame>

      {/* Steam, rising straight off the cup. Opacity and translate only. */}
      <Moving
        box={{ x: 70.5, y: 67, w: 24, h: 24 }}
        width={width}
        style={{
          opacity: steam?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }) ?? 1,
          transform: [
            {
              translateY:
                steam?.interpolate({ inputRange: [0, 1], outputRange: [4 * u, -8 * u] }) ?? 0,
            },
          ],
        }}
      >
        <Path d="M66 72c-2-4 2-6 0-10M75 73c2-4-2-6 0-10" />
      </Moving>

      {/* The beret on the chair post, the scene's one solid accent, swaying. */}
      <Moving
        box={{ x: 161, y: 66, w: 32, h: 24 }}
        width={width}
        style={{
          transform: [
            {
              rotate:
                beret?.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) ??
                '0deg',
            },
          ],
        }}
      >
        <Path
          d="M150 66c1-7 9-11 16-8 6 3 7 10 3 13-7 4-18 2-19-5z"
          fill={paper.ink}
          stroke="none"
        />
      </Moving>
    </Scene>
  );
}
