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
