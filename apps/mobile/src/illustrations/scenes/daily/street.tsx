/**
 * Six street drawings for the word of the day: a postbox, a bicycle, a
 * fountain, a pigeon, a paper lantern and a pair of shutters.
 *
 * The pack's rules are written out at the top of `kitchen.tsx`.
 *
 * Two of these — the lantern and the curtain — hang from something, and a
 * hanging thing rotates about where it is hung, not about its own middle. A
 * `Moving` layer rotates about the CENTRE of its box, so those two boxes are
 * centred on the rail and run twice as tall as the drawing inside them. The
 * empty half draws nothing and takes no touches; it is the cheapest way to
 * move a pivot without leaving transform and opacity behind.
 */

import { Circle, Ellipse, Path } from 'react-native-svg';
import { paper } from '../../../theme.ts';
import { unit } from '../../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../../pen.tsx';
import { useSceneMotion } from '../../useSceneMotion.ts';

/** Two decimals, no trailing zeros. Local twin of the one in `weather.tsx`. */
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

/**
 * A letter going into a postbox.
 *
 * The slot is the oversized object: it would take a parcel. One loop carries
 * the envelope down, and the envelope fades out over the last quarter of the
 * travel so that it goes IN rather than sliding across the front of the box —
 * a moving layer is always drawn over the still one, and fading is the honest
 * way to say a thing has gone inside.
 */
export function WordPostbox({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2200 }], paused });
  const post = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Path d="M20 136h160" />
        {/* the box, its cap, its plinth and its feet */}
        <Path d="M58 76h84v52H58z" />
        <Path d="M52 76l8-10h80l8 10z" />
        <Path d="M50 128h100" />
        <Path d="M70 128v8M130 128v8" />
        {/* the slot, and the plate that says when it is emptied */}
        <Path d="M74 86h52v9H74z" />
        <Path d="M77 88h46v5H77z" fill={paper.ink} stroke="none" />
        <Path d="M84 106h32v14H84z" />
        <Path d="M84 112h32" />
        <Stipple points={[[36, 130], [42, 133], [30, 132], [152, 130], [158, 133]]} />
      </Frame>

      {/* the letter, arriving */}
      <Moving
        box={{ x: 100, y: 56, w: 52, h: 40 }}
        width={width}
        style={{
          opacity: post?.interpolate({ inputRange: [0, 0.5, 0.75, 1], outputRange: [1, 1, 0.5, 0] }) ?? 1,
          transform: [
            { translateY: post?.interpolate({ inputRange: [0, 1], outputRange: [-10 * u, 12 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M82 46h36v20H82z" transform="rotate(-4 100 56)" />
        <Path d="M82 46l18 12 18-12" transform="rotate(-4 100 56)" />
      </Moving>
    </Scene>
  );
}

/**
 * A bicycle left against a wall, with a leaf going past it.
 *
 * The basket is the oversized object — too big for the bicycle carrying it —
 * and the baguette in it does not fit either, which is the joke. The bicycle is still — it is parked — and the only motion
 * is the leaf, on one loop, turning as it falls.
 */
export function WordBicycle({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2900 }], paused });
  const fall = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the wall it is leaning on, and the pavement */}
        <Path d="M16 26v100" />
        <Path d="M16 126h168" />
        {/* the wheels, three spokes each, which is all a drawing needs */}
        <Circle cx={54} cy={104} r={22} />
        <Circle cx={148} cy={104} r={22} />
        <Path d="M54 82v44M35 93l38 22M35 115l38-22" />
        <Path d="M148 82v44M129 93l38 22M129 115l38-22" />
        {/* the frame */}
        <Path d="M54 104h46" />
        <Path d="M100 112L86 70" />
        <Path d="M54 104L86 70" />
        <Path d="M100 112L140 76" />
        <Path d="M86 70l52-8" />
        <Path d="M138 62l2 14" />
        <Path d="M140 76L148 104" />
        {/* saddle, bars, crank */}
        <Path d="M76 68c6-5 16-5 20 0" />
        <Path d="M138 62v-6M126 56h20" />
        <Path d="M146 56c6 1 7 5 4 8" />
        <Path d="M100 112l6 10M102 122h10" />
        {/* the basket, and the baguette that will not go in it */}
        <Path d="M140 58h34l-5 18h-24z" />
        <Path d="M142 66h30" />
        <Path d="M156 58l16-19" />
        <Path d="M161 48l4 4M165 43l4 4" />
        <Stipple points={[[30, 118], [36, 121], [24, 120], [168, 118], [174, 121]]} />
      </Frame>

      {/* one leaf, tumbling past */}
      <Moving
        box={{ x: 44, y: 51, w: 34, h: 38 }}
        width={width}
        style={{
          opacity: fall?.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.4] }) ?? 1,
          transform: [
            { translateY: fall?.interpolate({ inputRange: [0, 1], outputRange: [-12 * u, 20 * u] }) ?? 0 },
            { translateX: fall?.interpolate({ inputRange: [0, 1], outputRange: [-3 * u, 3 * u] }) ?? 0 },
            { rotate: fall?.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '34deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M34 52c2-9 12-13 19-8 5 4 3 13-5 16-6 2-15-1-14-8z" />
        <Path d="M34 52c8 1 15 3 20 8" />
      </Moving>
    </Scene>
  );
}

/**
 * A fountain in a square, with the arc coming apart on the way down.
 *
 * The basin is the oversized object: more than half the frame for a jet the
 * width of a thumb. The arcs themselves are still — water under pressure
 * holds its shape — and what moves is the drops coming off them, on two loops
 * of different lengths so the left and right sides never fall together.
 */
export function WordFountain({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 1300 }, { period: 1550, delay: 400 }],
    paused,
  });
  const left = loops[0];
  const right = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Path d="M16 128h168" />
        {/* the basin, its rim and its one moulding */}
        <Path d="M46 106h108l-6 22H52z" />
        <Path d="M42 106h116" />
        <Path d="M54 116h92" />
        {/* the column, the upper bowl, and the nozzle */}
        <Path d="M102 106L100 82" />
        <Path d="M88 74h28l-6 8H94z" />
        <Path d="M84 74h36" />
        <Path d="M102 74v-16" />
        {/* the two arcs, thrown clear of the bowl and landing short of the rim */}
        <Path d="M102 58C88 60 78 72 74 90" />
        <Path d="M102 58C118 60 128 72 132 90" />
        <Stipple points={[[58, 120], [64, 123], [52, 124], [140, 120], [146, 123]]} />
      </Frame>

      {/* what comes off the left arc */}
      <Moving
        box={{ x: 70, y: 100, w: 28, h: 34 }}
        width={width}
        style={{
          opacity: left?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }) ?? 1,
          transform: [
            { translateY: left?.interpolate({ inputRange: [0, 1], outputRange: [-5 * u, 7 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={drop(72, 92, 2.4)} fill={paper.ink} stroke="none" />
        <Path d={drop(66, 101, 1.9)} fill={paper.ink} stroke="none" />
      </Moving>

      {/* and off the right, later */}
      <Moving
        box={{ x: 136, y: 100, w: 28, h: 34 }}
        width={width}
        style={{
          opacity: right?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 1, 0.15] }) ?? 1,
          transform: [
            { translateY: right?.interpolate({ inputRange: [0, 1], outputRange: [-5 * u, 7 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d={drop(134, 92, 2.4)} fill={paper.ink} stroke="none" />
        <Path d={drop(140, 101, 1.9)} fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}

/**
 * A pigeon that has taken a bistro chair.
 *
 * The bird is the oversized object — as wide as the chair it has taken — and
 * this is the one scene in the pack where the moving piece is part of the
 * subject rather than the weather. Only the head goes, on one short loop: down
 * and back, the way a pigeon actually looks at a crumb. The neck travels with
 * the head, so the two never come apart.
 */
export function WordPigeon({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 640 }], paused });
  const bob = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Path d="M14 136h172" />
        {/* the chair, seen from the side it was left at */}
        <Ellipse cx={99} cy={110} rx={34} ry={6} />
        <Path d="M65 110c2 6 16 9 34 9s32-3 34-9" />
        <Path d="M78 110C74 92 76 78 82 72" />
        <Path d="M120 110C124 92 122 78 116 72" />
        <Path d="M82 72c6-4 28-4 34 0" />
        <Path d="M80 90h38" />
        <Path d="M92 104V74M108 104V74" />
        <Path d="M76 116l-8 20M122 116l8 20" />
        <Path d="M72 128h54" />
        {/* the pigeon: body, wing, tail, and two feet on the rail */}
        <Ellipse cx={96} cy={50} rx={26} ry={17} transform="rotate(-6 96 50)" />
        <Path d="M84 48c8-9 26-9 34 0-8 9-26 9-34 0z" />
        <Path d="M72 56l-20 6 18 8z" />
        <Path d="M90 66v5M86 71h9" />
        <Path d="M102 66v5M98 71h9" />
        {/* the crumbs it is here for */}
        <Stipple points={[[36, 130], [42, 133], [30, 132], [148, 132], [154, 133]]} />
      </Frame>

      {/* the head, bobbing */}
      <Moving
        box={{ x: 130, y: 28, w: 48, h: 38 }}
        width={width}
        style={{
          transform: [
            { translateY: bob?.interpolate({ inputRange: [0, 1], outputRange: [0, 2 * u] }) ?? 0 },
            { translateX: bob?.interpolate({ inputRange: [0, 1], outputRange: [0, -2 * u] }) ?? 0 },
          ],
        }}
      >
        <Circle cx={128} cy={26} r={10} />
        <Path d="M138 26l9 4-9 4z" fill={paper.ink} stroke="none" />
        <Circle cx={131} cy={23} r={1.7} fill={paper.ink} stroke="none" />
        <Path d="M121 33c-4 5-8 7-13 9" />
      </Moving>
    </Scene>
  );
}

/**
 * A paper lantern on a wire, swinging.
 *
 * The lantern is the oversized object and the bunting either side of it is
 * deliberately tiny, so the wire reads as a long one. One loop, one rotation,
 * about the point where the string meets the wire: see the note at the top of
 * this file for why the box is centred up there and half of it is empty.
 */
export function WordLantern({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2800 }], paused });
  const swing = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the wire, sagging, and the bunting somebody left on it */}
        <Path d="M14 30c40 12 132 12 172 0" />
        <Path d="M32 35l5 13 6-12" />
        <Path d="M50 39l5 13 6-12" />
        <Path d="M140 51l5 12 6-13" fill={paper.ink} stroke="none" />
        <Path d="M158 47l5 13 6-13" />
        <Stipple points={[[40, 120], [46, 123], [34, 122], [156, 118], [162, 121]]} />
      </Frame>

      {/* the lantern, hanging off the wire and swinging on it */}
      <Moving
        box={{ x: 100, y: 39, w: 72, h: 160 }}
        width={width}
        style={{
          transform: [
            { rotate: swing?.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M100 39v9" />
        <Path d="M100 48c18 0 32 12 32 26s-14 26-32 26-32-12-32-26 14-26 32-26z" />
        <Path d="M100 48c-11 6-11 46 0 52M100 48c11 6 11 46 0 52" />
        <Path d="M92 48h16M92 100h16" />
        <Circle cx={100} cy={104} r={2.2} fill={paper.ink} stroke="none" />
        <Path d="M96 107v8M100 107v10M104 107v8" />
      </Moving>
    </Scene>
  );
}

/**
 * Shutters thrown back, a flower box on the sill, and a curtain in the draught.
 *
 * The shutters are the oversized object: each one is nearly half as wide as
 * the window it belongs to, which no shutter is. One loop, and it moves the curtain about the
 * rail it hangs from rather than about its own waist — the pivot note at the
 * top of this file applies here too.
 */
export function WordShutters({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 3200 }], paused });
  const draught = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the window and its two panes */}
        <Path d="M62 24h76v70H62z" />
        <Path d="M100 24v70M62 58h76" />
        {/* the shutters, and the louvres in them */}
        <Path d="M26 24h34v70H26z" />
        <Path d="M140 24h34v70h-34z" />
        <Path d="M28 34h30M28 44h30M28 54h30M28 64h30M28 74h30M28 84h30" />
        <Path d="M142 34h30M142 44h30M142 54h30M142 64h30M142 74h30M142 84h30" />
        {/* the sill, the flower box, and what is in it */}
        <Path d="M50 94h100" />
        <Path d="M62 98h76l-6 22H68z" />
        <Path d="M74 98v-6M90 98v-8M112 98v-6" />
        <Circle cx={74} cy={88} r={4.4} />
        <Circle cx={90} cy={86} r={5} />
        <Circle cx={112} cy={88} r={4.4} />
        <Circle cx={74} cy={88} r={1.5} fill={paper.ink} stroke="none" />
        <Circle cx={90} cy={86} r={1.5} fill={paper.ink} stroke="none" />
        <Circle cx={112} cy={88} r={1.5} fill={paper.ink} stroke="none" />
        <Path d="M66 100c6-3 11-2 14 2M134 100c-6-3-11-2-14 2" />
        {/* two courses of the wall, so the window is in something */}
        <Path d="M16 110h44M140 110h44M16 128h168" />
        <Stipple points={[[30, 120], [36, 123], [24, 122], [160, 120], [166, 123]]} />
      </Frame>

      {/* the curtain, swinging from the rail rather than from its middle */}
      <Moving
        box={{ x: 78, y: 26, w: 36, h: 100 }}
        width={width}
        style={{
          transform: [
            { rotate: draught?.interpolate({ inputRange: [0, 1], outputRange: ['-3.5deg', '3.5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M68 26c5 14-3 26 0 44" />
        <Path d="M76 26c5 14-3 26 0 44" />
        <Path d="M84 26c5 14-3 26 0 44" />
        <Path d="M68 70c3 5 5 5 8 0 3 5 5 5 8 0" />
      </Moving>
    </Scene>
  );
}
