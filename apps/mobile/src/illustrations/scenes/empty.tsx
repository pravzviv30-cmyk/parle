/**
 * The two empty states, drawn.
 *
 * Nine screens in this app tell a learner there is nothing here and none of
 * them showed anything. "The rest of this path" is not even bad news: it means
 * the learner has conversations still ahead of them. A bare sentence on lilac
 * reads as a dead end anyway.
 *
 * So each of these is drawn as the good version of itself. Nothing here
 * apologises, and nothing sulks.
 *
 * The cleared cafe table left with revamp A: the empty review deck and the
 * empty drill bank draw the registered `empty-table` picture now, and a scene
 * the barrel carries with nobody drawing it is the thing J14 exists to catch.
 */

import { Path, Circle, Ellipse } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { unit } from '../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion } from '../useSceneMotion.ts';

/**
 * A cafe noticeboard with one pin and one blank card. For both leaderboard
 * empty states, one of which is permanent until there is a server, so it has
 * to be charming rather than sorry.
 */
export function NobodyYet({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 3000 }], paused });
  const flutter = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the board, hung a degree off */}
        <Path d="M34 26h132v98H34z" transform="rotate(-1 100 75)" />
        <Path d="M28 20h144v10H28z" transform="rotate(-1 100 25)" />
        {/* two older notices, long since read */}
        <Path d="M50 48h34v26H50z" transform="rotate(3 67 61)" />
        <Path d="M56 56h22M56 64h16" transform="rotate(3 67 61)" />
        <Path d="M120 92h34v22h-34z" transform="rotate(-4 137 103)" />
        <Path d="M126 100h22" transform="rotate(-4 137 103)" />
        <Stipple points={[[44, 130], [52, 134], [148, 128], [156, 132]]} />
      </Frame>

      {/* the blank card, pinned at the top, its free corner moving */}
      <Moving
        box={{ x: 122, y: 56, w: 54, h: 46 }}
        width={width}
        style={{
          transform: [
            { rotate: flutter?.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M104 42h36v30h-36z" transform="rotate(4 122 57)" />
        <Circle cx={122} cy={44} r={2.8} fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}

/**
 * A pen resting on a half-written page, the last line still blank. For a topic
 * node whose drills the tutor has not finished, which is the only thing this
 * app ever locks, and for the practice path's honest tail.
 */
export function StillWriting({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2800 }], paused });
  const nib = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the page */}
        <Path d="M38 30h114v100H38z" transform="rotate(-2 95 80)" />
        <Path d="M52 50c9-4 14 3 22-1s14 3 21-1s13 3 20-1" transform="rotate(-2 95 80)" />
        <Path d="M52 66c9-4 14 3 22-1s14 3 21-1" transform="rotate(-2 95 80)" />
        <Path d="M52 82c7-3 11 2 17-1" transform="rotate(-2 95 80)" />
        {/* the line that is not written yet */}
        <Path d="M52 100h56" transform="rotate(-2 95 80)" />
        <Stipple points={[[46, 138], [54, 142], [140, 136]]} />
      </Frame>

      {/* the pen, tracking along the blank line and back */}
      <Moving
        box={{ x: 128, y: 76, w: 76, h: 76 }}
        width={width}
        style={{
          transform: [
            { translateX: nib?.interpolate({ inputRange: [0, 1], outputRange: [-6 * u, 4 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M110 104l38-52c3-4 8-5 11-2 4 3 4 8 1 12l-38 52z" />
        <Path d="M117 98l10 7" />
        <Path d="M110 104l-4 12 11-5z" fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}
