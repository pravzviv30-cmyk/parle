/**
 * Five weather drawings for the word of the day: an umbrella in the rain, a
 * cloud crossing the sun, a kite, a plane tree shedding, and a lamp post in
 * snow.
 *
 * The pack's rules are written out at the top of `kitchen.tsx` and they hold
 * here unchanged. What is worth saying twice: every translate below is
 * multiplied by `unit(width)` because a transform is in container pixels while
 * the drawing is in viewBox units, and rotations are not, because a degree is
 * a degree at any size.
 *
 * Three marks repeat across this file — a drop, a snowflake and a leaf — so
 * they are built by a function rather than written out eight times. They
 * return path DATA, not components: the shape is arithmetic, the drawing is
 * still a plain `<Path>` at the pen's one weight.
 */

import { Circle, Path } from 'react-native-svg';
import { paper } from '../../../theme.ts';
import { unit } from '../../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../../pen.tsx';
import { useSceneMotion } from '../../useSceneMotion.ts';

/** Two decimals, no trailing zeros, so the generated path data stays readable. */
const n = (v: number) => String(Number(v.toFixed(2)));

/** A falling drop: apex at (x, y), 2s across, a little under 3s tall. */
function drop(x: number, y: number, s: number): string {
  return (
    `M${n(x)} ${n(y)}` +
    `c${n(0.65 * s)} ${n(s)} ${n(s)} ${n(1.54 * s)} ${n(s)} ${n(1.96 * s)}` +
    `a${n(s)} ${n(s)} 0 0 1 ${n(-2 * s)} 0` +
    `c0 ${n(-0.42 * s)} ${n(0.35 * s)} ${n(-0.96 * s)} ${n(s)} ${n(-1.96 * s)}z`
  );
}

/** A six-spoke flake centred on (x, y), r across the arms. */
function flake(x: number, y: number, r: number): string {
  const a = r * 0.5;
  const b = r * 0.87;
  return (
    `M${n(x)} ${n(y - r)}V${n(y + r)}` +
    `M${n(x - b)} ${n(y - a)}L${n(x + b)} ${n(y + a)}` +
    `M${n(x - b)} ${n(y + a)}L${n(x + b)} ${n(y - a)}`
  );
}

/**
 * A leaf: blade, midrib, and a short stalk off the base. The stalk is what
 * stops it reading as an eye, which is what the blade and midrib alone did.
 */
function leaf(x: number, y: number, s: number): string {
  return (
    `M${n(x - s)} ${n(y)}` +
    `C${n(x - 0.6 * s)} ${n(y - s)} ${n(x + 0.4 * s)} ${n(y - s)} ${n(x + s)} ${n(y - 0.2 * s)}` +
    `C${n(x + 0.4 * s)} ${n(y + 0.7 * s)} ${n(x - 0.5 * s)} ${n(y + 0.8 * s)} ${n(x - s)} ${n(y)}z` +
    `M${n(x - s)} ${n(y)}L${n(x + 0.7 * s)} ${n(y - 0.3 * s)}` +
    `M${n(x - s)} ${n(y)}L${n(x - 1.4 * s)} ${n(y + 0.25 * s)}`
  );
}

/**
 * An open umbrella with the rain going past it.
 *
 * The canopy is the oversized object: two thirds of the frame wide over a
 * shaft nobody is holding. Two loops, one per side, at different lengths, so
 * the rain never falls in step — which is the difference between rain and a
 * metronome.
 */
export function WordUmbrella({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 1500 }, { period: 1750, delay: 400 }],
    paused,
  });
  const left = loops[0];
  const right = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the canopy, and the scallops along its edge */}
        <Path d="M28 78c0-30 30-48 68-48s68 18 68 48" />
        <Path d="M28 78c5 11 18 11 23 0M51 78c5 11 18 11 23 0M74 78c5 11 18 11 23 0M97 78c5 11 18 11 23 0M120 78c5 11 17 11 22 0M142 78c5 11 17 11 22 0" />
        {/* three ribs and the ferrule */}
        <Path d="M96 32L51 78M96 32v46M96 32l46 46" />
        <Path d="M96 30v-8" />
        {/* the shaft and the crook of the handle */}
        <Path d="M96 78v42" />
        <Path d="M96 120c0 8-11 10-13 1" />
        {/* the puddle it is all landing in */}
        <Path d="M60 132c16-6 44-6 58 0" />
        <Stipple points={[[72, 137], [80, 139], [98, 138], [150, 128], [156, 131]]} />
      </Frame>

      {/* rain off the left of the canopy */}
      <Moving
        box={{ x: 36, y: 100, w: 34, h: 44 }}
        width={width}
        style={{
          opacity: left?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }) ?? 1,
          transform: [
            { translateY: left?.interpolate({ inputRange: [0, 1], outputRange: [-6 * u, 10 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={drop(34, 86, 3)} fill={paper.ink} stroke="none" />
        <Path d={drop(44, 100, 2.4)} fill={paper.ink} stroke="none" />
        <Path d={drop(28, 108, 2)} fill={paper.ink} stroke="none" />
      </Moving>

      {/* and off the right, on its own clock */}
      <Moving
        box={{ x: 158, y: 98, w: 34, h: 44 }}
        width={width}
        style={{
          opacity: right?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }) ?? 1,
          transform: [
            { translateY: right?.interpolate({ inputRange: [0, 1], outputRange: [-6 * u, 10 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={drop(160, 84, 3)} fill={paper.ink} stroke="none" />
        <Path d={drop(150, 98, 2.4)} fill={paper.ink} stroke="none" />
        <Path d={drop(166, 106, 2)} fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}

/**
 * A cloud on its way across the sun.
 *
 * The cloud is the oversized object and it is the only thing that moves: one
 * long loop of pure translateX, so at the ends of its travel it has taken a
 * bite out of the sun and in the middle — which is where reduce motion rests
 * it — the two sit side by side with the day still visible.
 */
export function WordCloud({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 5000 }], paused });
  const drift = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the sun, and the rays it is still getting out */}
        <Circle cx={140} cy={52} r={26} />
        <Path d="M140 18v-8M140 86v8M106 52h-8M174 52h8M116 28l-6-6M164 76l6 6M116 76l-6 6M164 28l6-6" />
        {/* the hill it is all happening over */}
        <Path d="M12 128c34-16 74-16 106-4s52 12 70 0" />
        <Stipple points={[[40, 134], [46, 137], [34, 138], [150, 132], [156, 135]]} />
      </Frame>

      {/* the cloud, crossing */}
      <Moving
        box={{ x: 72, y: 73, w: 116, h: 64 }}
        width={width}
        style={{
          transform: [
            { translateX: drift?.interpolate({ inputRange: [0, 1], outputRange: [-14 * u, 16 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M40 98C28 98 22 88 26 79C30 70 42 68 48 73C50 55 66 46 82 52C93 56 99 66 98 74C110 70 120 78 120 88C120 94 116 98 110 98Z" />
      </Moving>
    </Scene>
  );
}

/**
 * A kite over a hill, leaning on its string.
 *
 * The kite is the oversized object and the string is drawn in the still frame
 * on purpose: only the kite and its tail move, and they rotate about the point
 * where the string is knotted on. That is why the `Moving` box is CENTRED on
 * the bottom corner of the kite and twice as tall as it needs to be — the
 * pivot of a rotation is the middle of its layer, so the middle of the layer
 * is put where the knot is. The empty half of the box draws nothing.
 */
export function WordKite({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2600 }], paused });
  const sway = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the hill, and the spool the string came off */}
        <Path d="M10 126c34-18 72-14 100 0s58 14 80 2" />
        <Path d="M34 103h16v12H34z" />
        <Path d="M34 109h16" />
        {/* the string, which stays where it was put */}
        <Path d="M112 86C98 96 74 100 50 103" />
        <Stipple points={[[70, 128], [76, 131], [64, 130], [150, 126], [156, 129]]} />
      </Frame>

      {/* the kite and its tail, swinging on the knot */}
      <Moving
        box={{ x: 112, y: 86, w: 60, h: 144 }}
        width={width}
        style={{
          transform: [
            { rotate: sway?.interpolate({ inputRange: [0, 1], outputRange: ['-3.5deg', '3.5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M112 16l28 32-28 38-28-38z" />
        <Path d="M112 16v70M84 48h56" />
        <Path d="M112 86c12 10 14 22 12 34" />
        <Path d="M117 94h7M121 104h7M122 113h7" />
      </Moving>
    </Scene>
  );
}

/**
 * A plane tree letting two leaves go.
 *
 * The canopy is the oversized object — it is most of the frame, on a trunk too
 * thin for it, which is how a plane tree in a square actually looks. The two
 * leaves fall on separate loops of different lengths, one starting late, so
 * they never pair up. Each one turns as it goes, because a leaf that falls
 * without turning is a stone.
 */
export function WordLeaves({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 3200 }, { period: 3800, delay: 700 }],
    paused,
  });
  const near = loops[0];
  const far = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the canopy */}
        <Path d="M62 94C50 96 40 90 40 82C30 80 26 70 32 62C26 52 34 40 46 40C48 28 62 22 72 28C78 18 96 16 104 26C118 20 134 30 132 44C144 48 148 62 140 70C144 82 134 94 122 92C110 98 74 98 62 94Z" />
        {/* the trunk, and the mottling that makes it a plane tree */}
        <Path d="M84 94c-2 14-2 26-1 38" />
        <Path d="M104 94c2 14 2 26 1 38" />
        <Path d="M26 132h148" />
        <Stipple points={[[90, 108], [96, 118], [91, 126], [99, 102], [95, 113], [40, 127], [46, 130], [33, 129]]} />
      </Frame>

      {/* one leaf down the right */}
      <Moving
        box={{ x: 164, y: 65, w: 44, h: 38 }}
        width={width}
        style={{
          opacity: near?.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.4] }) ?? 1,
          transform: [
            { translateY: near?.interpolate({ inputRange: [0, 1], outputRange: [-14 * u, 22 * u] }) ?? 0 },
            { translateX: near?.interpolate({ inputRange: [0, 1], outputRange: [3 * u, -4 * u] }) ?? 0 },
            { rotate: near?.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '14deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d={leaf(166, 66, 12)} />
      </Moving>

      {/* one down the left, later and slower */}
      <Moving
        box={{ x: 38, y: 111, w: 40, h: 38 }}
        width={width}
        style={{
          opacity: far?.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.4] }) ?? 1,
          transform: [
            { translateY: far?.interpolate({ inputRange: [0, 1], outputRange: [-12 * u, 10 * u] }) ?? 0 },
            { translateX: far?.interpolate({ inputRange: [0, 1], outputRange: [-2 * u, 4 * u] }) ?? 0 },
            { rotate: far?.interpolate({ inputRange: [0, 1], outputRange: ['12deg', '-22deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d={leaf(40, 112, 10)} />
      </Moving>
    </Scene>
  );
}

/**
 * A lamp post with the snow coming down through its light.
 *
 * The lantern head is the oversized object: half as tall as the post under it,
 * which is not how a lamp post is built and is how one is remembered. Two loops of flakes at different lengths, one starting
 * late, drifting sideways as they fall so the snow reads as weather rather
 * than as a screensaver.
 */
export function WordSnowflake({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 3000 }, { period: 3600, delay: 800 }],
    paused,
  });
  const near = loops[0];
  const far = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the lantern: glass, roof, finial */}
        <Path d="M80 58h30l-5-24H85z" />
        <Path d="M95 58V34M83 46h24" />
        <Path d="M74 34h42L95 20z" />
        <Path d="M95 20v-5" />
        <Circle cx={95} cy={12} r={2.6} fill={paper.ink} stroke="none" />
        {/* the light it throws, four short marks */}
        <Path d="M72 44l-10-4M70 54l-10 3M118 44l10-4M120 54l10 3" />
        {/* the post, out of true, and its foot */}
        <Path d="M97 138L95 58" />
        <Path d="M84 138c4-9 22-9 28 0" />
        {/* the ground, and what has already settled on it */}
        <Path d="M18 138h164" />
        <Path d="M120 138c12-9 32-7 40 0" />
        <Stipple points={[[36, 132], [42, 135], [30, 134]]} />
      </Frame>

      {/* snow down the left */}
      <Moving
        box={{ x: 46, y: 81, w: 44, h: 64 }}
        width={width}
        style={{
          opacity: near?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }) ?? 1,
          transform: [
            { translateY: near?.interpolate({ inputRange: [0, 1], outputRange: [-8 * u, 20 * u] }) ?? 0 },
            { translateX: near?.interpolate({ inputRange: [0, 1], outputRange: [2 * u, -3 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={flake(44, 60, 7)} />
        <Path d={flake(58, 90, 5)} />
        <Path d={flake(34, 104, 4)} />
      </Moving>

      {/* and down the right, later */}
      <Moving
        box={{ x: 152, y: 76, w: 48, h: 70 }}
        width={width}
        style={{
          opacity: far?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }) ?? 1,
          transform: [
            { translateY: far?.interpolate({ inputRange: [0, 1], outputRange: [-10 * u, 18 * u] }) ?? 0 },
            { translateX: far?.interpolate({ inputRange: [0, 1], outputRange: [-2 * u, 3 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={flake(150, 50, 6)} />
        <Path d={flake(166, 84, 4.5)} />
        <Path d={flake(140, 102, 5)} />
      </Moving>
    </Scene>
  );
}
