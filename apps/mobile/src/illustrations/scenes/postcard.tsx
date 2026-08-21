/**
 * A postcard headed home. Wish you were hearing this.
 *
 * This is the biggest "you finished something" moment in the app, on both end
 * cards, and until now it was completely still. The card drifts as if it were
 * in the post, and the stamp lands on it a beat later.
 */

import { Path } from 'react-native-svg';
import { unit } from '../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion, arriveStyle } from '../useSceneMotion.ts';

export function RecapPostcard({ width = 200, paused = false }: SceneProps) {
  const { loops, arrivals, settled } = useSceneMotion({
    loops: [{ period: 3200 }],
    arrivals: 1,
    paused,
  });
  const drift = loops[0];
  const stamp = arrivals[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Stipple points={[[42, 122], [50, 126], [152, 120], [160, 124], [156, 129]]} />
      </Frame>

      {/* the card itself, drifting a degree either way */}
      <Moving
        box={{ x: 100, y: 75, w: 152, h: 100 }}
        width={width}
        style={{
          transform: [
            { translateY: drift?.interpolate({ inputRange: [0, 1], outputRange: [1.5 * u, -1.5 * u] }) ?? 0 },
            { rotate: drift?.interpolate({ inputRange: [0, 1], outputRange: ['-0.4deg', '0.4deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path
          d="M32 40c0-4 3-7 7-7h122c4 0 7 3 7 7v70c0 4-3 7-7 7H39c-4 0-7-3-7-7z"
          transform="rotate(-2 100 75)"
        />
        <Path d="M100 42v66" transform="rotate(-2 100 75)" />
        <Path d="M112 76h40M112 88h34M112 100h37" transform="rotate(-2 100 75)" />
        <Path d="M124 44a10 10 0 1 0 0 1M118 52c-4 1-8 4-9 8" transform="rotate(-2 122 50)" />
        {/* Eiffel doodle, left half */}
        <Path d="M66 96c2-16 5-28 10-38M74 96c-2-16-5-28-10-38" transform="translate(-4 0)" />
        <Path d="M58 96c4-6 12-6 16 0" transform="translate(-4 0)" />
        <Path d="M63 78h10M64 68h8" transform="translate(-4 0)" />
        <Path d="M66 58l2-8 2 8" transform="translate(-4 0)" />
        <Path d="M52 96h32" transform="translate(-4 0)" />
      </Moving>

      {/* the stamp, with its hand-torn border, landing after the card */}
      <Moving box={{ x: 146, y: 60, w: 40, h: 34 }} width={width} style={stamp ? arriveStyle(stamp) : null}>
        <Path
          d="M132 46l5 2 5-2 5 2 5-2 4 2v5l2 4-2 4v5l-4 2-5-2-5 2-5-2-5 2-4-2v-5l-2-4 2-4v-5z"
          transform="rotate(-2 146 60)"
        />
      </Moving>
    </Scene>
  );
}
