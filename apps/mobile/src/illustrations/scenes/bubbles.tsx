/**
 * Two speech bubbles, clinked like glasses. Sante.
 *
 * The Tutor tab's hero, and the one screen in the app where nothing moved at
 * all. The bubbles now arrive one after the other, as if somebody just started
 * talking, and the one that is saying something keeps breathing afterwards.
 * The clink stays still, because it is the moment they already met.
 */

import { Path, Circle } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion, arriveStyle } from '../useSceneMotion.ts';

export function SpeakBubbles({ width = 200, paused = false }: SceneProps) {
  const { loops, arrivals, settled } = useSceneMotion({
    loops: [{ period: 2400, delay: 900 }],
    arrivals: 2,
    paused,
  });
  const breathe = loops[0];
  const left = arrivals[0];
  const right = arrivals[1];

  const breathing = {
    transform: [
      { scale: breathe?.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.015] }) ?? 1 },
    ],
  };

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the clink, which is the one thing that already happened */}
        <Path d="M98 34l4-8M104 40l8-4M92 30l0-9" />
        <Stipple points={[[86, 120], [93, 124], [100, 119], [108, 123]]} />
      </Frame>

      {/* left bubble, leaning in, still talking */}
      <Moving
        box={{ x: 61, y: 63, w: 92, h: 82 }}
        width={width}
        style={[left ? arriveStyle(left) : null, breathing]}
      >
        <Path
          d="M28 44c0-9 7-16 16-16h34c9 0 16 7 16 16v22c0 9-7 16-16 16H60l-14 14 2-14h-4c-9 0-16-7-16-16z"
          transform="rotate(8 61 63)"
        />
        <Circle cx={50} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
        <Circle cx={61} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
        <Circle cx={72} cy={58} r={2} fill={paper.ink} stroke="none" transform="rotate(8 61 63)" />
      </Moving>

      {/* right bubble, meeting it, answering with a small heart */}
      <Moving box={{ x: 141, y: 71, w: 92, h: 82 }} width={width} style={right ? arriveStyle(right) : null}>
        <Path
          d="M108 52c0-9 7-16 16-16h34c9 0 16 7 16 16v22c0 9-7 16-16 16h-4l2 14-14-14h-18c-9 0-16-7-16-16z"
          transform="rotate(-8 141 71)"
        />
        <Path
          d="M141 60c2.6-4.4 8-3.5 8 .8 0 3.5-4.4 6-8 8.7-3.6-2.7-8-5.2-8-8.7 0-4.3 5.4-5.2 8-.8z"
          fill={paper.ink}
          stroke="none"
          transform="rotate(-8 141 71)"
        />
      </Moving>
    </Scene>
  );
}
