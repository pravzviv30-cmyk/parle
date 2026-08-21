/**
 * Two scenes for places rather than moments.
 *
 * `OffTheHook` is the one that had to be got right. It appears when the token
 * server cannot be reached, which is by far the most common live failure, and
 * the temptation is a broken-looking drawing. A learner who cannot reach the
 * tutor has not done anything wrong and nothing is damaged, so the picture is
 * a phone off its cradle: honest, undramatic, and obviously temporary. No red,
 * no cross, no warning triangle.
 */

import { Path } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion } from '../useSceneMotion.ts';

/** A telephone with the receiver resting beside the cradle, cord swaying. */
export function OffTheHook({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 3600 }], paused });
  const cord = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the body, tilted */}
        <Path d="M46 66h72v46a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8z" transform="rotate(-2 82 96)" />
        <Path d="M56 82h52" transform="rotate(-2 82 96)" />
        <Path d="M58 96h10M76 96h10M94 96h10" transform="rotate(-2 82 96)" />
        {/* the empty cradle */}
        <Path d="M52 66c0-6 4-10 10-10h40c6 0 10 4 10 10" transform="rotate(-2 82 62)" />
        {/* the receiver, set down beside it */}
        <Path d="M126 112c-4 0-7-3-7-7s3-7 7-7h44c4 0 7 3 7 7s-3 7-7 7z" transform="rotate(4 148 105)" />
        <Path d="M130 98c0-5 3-8 7-8M166 98c0-5-3-8-7-8" transform="rotate(4 148 105)" />
        <Stipple points={[[54, 128], [62, 132], [160, 122], [168, 126]]} />
      </Frame>

      {/* the cord, looping down between them */}
      <Moving
        box={{ x: 122, y: 96, w: 60, h: 52 }}
        width={width}
        style={{
          transform: [
            { rotate: cord?.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M110 78c6 10 2 16 8 22s2 14 8 20" />
        <Path d="M113 86c5 0 8-2 8-6M117 100c5 0 8-2 8-6M121 114c5 0 8-2 8-6" />
      </Moving>
    </Scene>
  );
}

/**
 * An open notebook with a ribbon marker. The hero for the phrasebook, and the
 * card that opens it: the learner's own lines, written down and kept.
 */
export function Phrasebook({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 3800 }], paused });
  const ribbon = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* two pages meeting at a gutter that is not quite straight */}
        <Path d="M22 44c26-8 48-8 76 2v78c-28-10-50-10-76-2z" />
        <Path d="M174 44c-26-8-48-8-76 2v78c28-10 50-10 76-2z" />
        <Path d="M98 46v78" />
        {/* lines on both sides */}
        <Path d="M34 62c14-4 26-3 52 3" />
        <Path d="M34 78c14-4 22-3 40 2" />
        <Path d="M34 94c12-3 20-2 34 2" />
        <Path d="M162 62c-14-4-26-3-52 3" />
        <Path d="M162 78c-14-4-22-3-40 2" />
        <Stipple points={[[40, 132], [48, 136], [150, 130], [158, 134]]} />
      </Frame>

      {/* the ribbon marker, down the gutter */}
      <Moving
        box={{ x: 100, y: 106, w: 26, h: 68 }}
        width={width}
        style={{
          transform: [
            { rotate: ribbon?.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M96 74v58l4-6 4 6V74z" fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}
