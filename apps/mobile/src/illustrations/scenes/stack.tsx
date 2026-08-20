/**
 * Word cards with a sprout: practice grows out of conversation.
 *
 * The sprout sways, slowly, and the top card settles square from a degree off
 * as the scene arrives. Both are the same idea said twice, which is why the
 * sprout gets the loop and the card only gets the entrance: a stack of cards
 * that kept moving would read as unstable rather than alive.
 */

import { Path } from 'react-native-svg';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion, arriveStyle } from '../useSceneMotion.ts';

export function LearnStack({ width = 200, paused = false }: SceneProps) {
  const { loops, arrivals, settled } = useSceneMotion({
    loops: [{ period: 3600 }],
    arrivals: 1,
    paused,
  });
  const sway = loops[0];
  const card = arrivals[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* bottom card */}
        <Path
          d="M46 96c0-4 3-7 7-7h94c4 0 7 3 7 7v26c0 4-3 7-7 7H53c-4 0-7-3-7-7z"
          transform="rotate(-4 100 109)"
        />
        {/* middle card */}
        <Path
          d="M50 74c0-4 3-7 7-7h94c4 0 7 3 7 7v26c0 4-3 7-7 7H57c-4 0-7-3-7-7z"
          transform="rotate(2 104 87)"
        />
        {/* the stem, which holds still so the leaves have something to move against */}
        <Path d="M118 42c0-10 1-16 4-22" />
        <Stipple points={[[110, 40], [126, 38], [118, 34], [58, 130], [66, 134], [140, 128]]} />
      </Frame>

      {/* top card, with a written line and a blank to fill */}
      <Moving box={{ x: 99, y: 64, w: 130, h: 56 }} width={width} style={card ? arriveStyle(card) : null}>
        <Path
          d="M44 50c0-4 3-7 7-7h96c4 0 7 3 7 7v28c0 4-3 7-7 7H51c-4 0-7-3-7-7z"
          transform="rotate(-1 99 64)"
        />
        <Path d="M56 62c7-3 11 2 17-1s11 2 16-1" transform="rotate(-1 99 64)" />
        <Path d="M56 72h34" transform="rotate(-1 99 64)" />
      </Moving>

      {/* the two leaves, up through the top edge */}
      <Moving
        box={{ x: 120, y: 21, w: 40, h: 30 }}
        width={width}
        style={{
          transform: [
            { rotate: sway?.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M121 26c-8-1-13-5-15-12 8 0 13 3 16 8" />
        <Path d="M122 21c1-7 5-11 12-13-1 8-4 12-10 15" />
      </Moving>
    </Scene>
  );
}
