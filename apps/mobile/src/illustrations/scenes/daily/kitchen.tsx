/**
 * Five kitchen drawings for the word of the day: a kettle, a croissant, a
 * candle in a bottle, a covered pot and a teapot mid-pour.
 *
 * ## Why a pack at all
 *
 * The word card had one drawing, `WordSprout`, and a learner who opens Home
 * every morning saw the same seedling every morning. Twenty scenes is three
 * weeks before a repeat, which is long enough that coming back feels like
 * being shown something rather than being shown the same thing.
 *
 * ## The rules these nineteen were drawn to
 *
 * `sprout.tsx` set them and this pack keeps them, so a card can swap one for
 * another without the page changing character:
 *
 *   - one stroke weight, supplied by `Frame` and `Moving`, never written here
 *   - `fill="none"` except a tiny solid accent: a lid knob, a flame, a match
 *     head. Nothing solid is more than a tenth of its scene
 *   - shading is stipple, never hatching, and it sits where a shadow would
 *   - one oversized object per scene, named in each scene's comment, and
 *     nothing perfectly level
 *   - one honest bit of motion per scene, at most two loops, and the moving
 *     piece is a `Moving` layer rather than an animated SVG attribute. The
 *     long version of why is at the top of `pen.tsx`; the short version is
 *     that an animated `d` or `cx` cannot cross to the native driver
 *   - a translate is in CONTAINER pixels while the drawing is in viewBox
 *     units, so every one is multiplied by `unit(width)`. Rotations and
 *     opacity are unitless and are not
 *
 * Reduce motion and an unfocused tab both rest a loop at 0.5, which is the
 * middle of its travel: the drawing, held still. `useSceneMotion` owns that;
 * no scene repeats it.
 */

import { Circle, Ellipse, Path } from 'react-native-svg';
import { paper } from '../../../theme.ts';
import { unit } from '../../timing.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../../pen.tsx';
import { useSceneMotion } from '../../useSceneMotion.ts';

/**
 * A stovetop kettle, steam leaving the spout.
 *
 * The kettle is the oversized thing: it is nearly half the frame wide, and the
 * tin beside it would fit inside its lid. Only the steam moves, on two loops of
 * different lengths so the two curls drift rather than pulse together — the
 * kettle itself is the subject, and a subject that fidgets stops being read.
 */
export function WordKettle({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 2200 }, { period: 2800, delay: 500 }],
    paused,
  });
  const near = loops[0];
  const far = loops[1];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the hob, and the front of the range under it */}
        <Path d="M26 120h148" />
        <Path d="M32 120v10M168 120v10" />
        <Path d="M32 130h136" />

        {/* the kettle: tall, barely tapered, and much too big for the hob */}
        <Path d="M56 120c-8-14-8-32 4-46h52c12 14 12 32 4 46z" />
        <Path d="M56 74h60" />
        {/* the lid, flat, with the collar it drops into */}
        <Path d="M64 74v-5h44v5" />
        <Path d="M86 69v-3" />
        {/* the lid knob, the one solid mark in the frame */}
        <Circle cx={86} cy={62} r={3.6} fill={paper.ink} stroke="none" />
        {/* the bail handle, arcing well clear of the knob so the two do not blot */}
        <Path d="M64 70C64 42 108 42 108 70" />
        {/* the spout, off the shoulder, long on purpose */}
        <Path d="M115 78c18-2 34-6 45-14" />
        <Path d="M120 88c16 0 33-8 43-18" />
        <Path d="M160 64l3 6" />

        {/* the tin that keeps it company, the way the bell sits by the pot */}
        <Path d="M24 120v-16h18v16" />
        <Path d="M22 104h22" />
        <Path d="M33 104v-4" />

        <Stipple points={[[44, 126], [50, 129], [38, 130], [66, 108], [72, 111], [60, 112]]} />
      </Frame>

      {/* the near curl, rising straight off the mouth of the spout */}
      <Moving
        box={{ x: 158, y: 50, w: 24, h: 28 }}
        width={width}
        style={{
          opacity: near?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }) ?? 1,
          transform: [
            { translateY: near?.interpolate({ inputRange: [0, 1], outputRange: [4 * u, -8 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M158 58c-3-6 3-9 0-15" />
      </Moving>

      {/* the far curl, slower and starting late, so the steam never pumps */}
      <Moving
        box={{ x: 172, y: 44, w: 24, h: 28 }}
        width={width}
        style={{
          opacity: far?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.9, 0.15] }) ?? 1,
          transform: [
            { translateY: far?.interpolate({ inputRange: [0, 1], outputRange: [3 * u, -9 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M172 52c3-6-3-9 0-15" />
      </Moving>
    </Scene>
  );
}

/**
 * An enormous croissant, and the cup it dwarfs.
 *
 * The joke is the proportion: the croissant is four times the cup, which is
 * the one oversized object. The steam over the cup is the only motion, on one
 * slow loop, because the pastry is the subject and pastry does not move.
 */
export function WordCroissant({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 2600 }], paused });
  const steam = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the table, short of both edges so the scene is not a box */}
        <Path d="M14 128h172" />

        {/* the plate, and the croissant curled on it. The belly arches clear
            of the plate, which is the difference between a croissant and a
            bread roll, and the four segments do the rest. */}
        <Ellipse cx={82} cy={116} rx={54} ry={7} />
        <Path d="M30 112Q30 86 52 84Q66 60 88 60Q110 58 118 72Q130 84 134 110C124 98 108 88 88 88C66 88 44 98 30 112z" />
        <Path d="M52 84c2 4 2 8 2 11" />
        <Path d="M88 60c2 10 2 20 1 28" />
        <Path d="M118 72c0 6-1 12-2 17" />

        {/* the cup, small on purpose, in its saucer */}
        <Ellipse cx={160} cy={100} rx={11} ry={3.4} />
        <Path d="M149 100c0 11 4 19 11 19s11-8 11-19" />
        <Path d="M171 104c5-1 8 3 5 6-2 2-4 1-5 0" />
        <Ellipse cx={160} cy={124} rx={17} ry={4} />

        {/* two marks left hanging, and two on the table by the saucer */}
        <Stipple points={[[26, 44], [32, 50], [20, 52], [140, 112], [146, 115]]} />
      </Frame>

      {/* steam off the cup: opacity and translate, nothing else */}
      <Moving
        box={{ x: 161, y: 83, w: 28, h: 32 }}
        width={width}
        style={{
          opacity: steam?.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] }) ?? 1,
          transform: [
            { translateY: steam?.interpolate({ inputRange: [0, 1], outputRange: [4 * u, -8 * u] }) ?? 0 },
          ],
        }}
      >
        <Path d="M156 92c-2-5 2-8 0-13M166 88c2-5-2-8 0-13" />
      </Moving>
    </Scene>
  );
}

/**
 * A candle stuck in a bottle, the way every bistro table used to have one.
 *
 * The bottle is the oversized object. The flame and the match head are the
 * only solid shapes, and together they are under a fiftieth of the frame.
 * Two loops drive one piece: a fast one on scale and a slower, later one on
 * opacity, which is what stops a flicker reading as a pulse. The flame is a
 * `Moving` layer because scaling it in place would mean animating a path.
 */
export function WordCandle({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({
    loops: [{ period: 620 }, { period: 880, delay: 260 }],
    paused,
  });
  const size = loops[0];
  const glow = loops[1];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Path d="M18 132h164" />

        {/* the bottle: everything else here is smaller than its neck */}
        <Path d="M66 132V84c0-14 14-18 16-30V50h16v4c2 12 16 16 16 30v48z" />
        <Path d="M81 50h18" />
        {/* wax that has run down the neck */}
        <Path d="M84 54c-3 6-4 11-3 16" />
        <Path d="M96 56c3 5 4 9 3 13" />

        {/* the stub of candle, and the wick the flame sits on */}
        <Path d="M84 50V34h12v16" />
        <Path d="M90 34v-5" />

        {/* the matchbox and one spent match, keeping the bottle company */}
        <Path d="M124 120h32v12h-32z" />
        <Path d="M124 125h32" />
        <Path d="M160 130l16-4" />
        <Circle cx={178} cy={125} r={2.4} fill={paper.ink} stroke="none" />

        <Stipple points={[[38, 126], [44, 129], [32, 130], [74, 110], [80, 114]]} />
      </Frame>

      {/* the flame. Scale from one loop, opacity from another. */}
      <Moving
        box={{ x: 90, y: 19, w: 28, h: 32 }}
        width={width}
        style={{
          opacity: glow?.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) ?? 1,
          transform: [
            { scale: size?.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) ?? 1 },
          ],
        }}
      >
        <Path
          d="M90 8c5 7 7 11 7 14a7 7 0 0 1-14 0c0-3 2-7 7-14z"
          fill={paper.ink}
          stroke="none"
        />
      </Moving>
    </Scene>
  );
}

/**
 * A covered pot on the range, the lid lifting the way a lid does when what is
 * under it has finally caught.
 *
 * The pot is the oversized object: more than half the frame across, on a range
 * drawn with one dial.
 * One loop carries the lid, and it carries a translate and a small rotation
 * together, because a lid that lifts perfectly level reads as a lift on a
 * string. The lid is a `Moving` layer for the usual reason, and its rim rests
 * a little above the pot's so the gap is part of the drawing, not a mistake.
 */
export function WordCasserole({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 1500 }], paused });
  const lid = loops[0];
  const u = unit(width);

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        {/* the range top, its front, and the one dial that is turned on */}
        <Path d="M24 126h152" />
        <Path d="M30 126v12M170 126v12" />
        <Path d="M30 138h140" />
        <Circle cx={152} cy={132} r={4.2} />
        <Path d="M152 132v-3" />

        {/* the pot, wider than the hob is deep */}
        <Path d="M52 92c0 24 10 34 44 34s44-10 44-34z" />
        <Path d="M52 98h-10c-4 0-4-6 0-6h10" />
        <Path d="M140 98h10c4 0 4-6 0-6h-10" />

        {/* the wooden spoon, put down where it was last used */}
        <Path d="M158 124l14-24" />
        <Path d="M172 100c4-6 10-4 9 2-1 5-6 6-9-2z" />

        <Stipple points={[[42, 132], [48, 135], [36, 136], [64, 112], [70, 115]]} />
      </Frame>

      {/* the lid, lifting and settling on one loop */}
      <Moving
        box={{ x: 96, y: 73, w: 104, h: 44 }}
        width={width}
        style={{
          transform: [
            { translateY: lid?.interpolate({ inputRange: [0, 1], outputRange: [0, -5 * u] }) ?? 0 },
            { rotate: lid?.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1.5deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M50 90h92" />
        <Path d="M54 90c6-14 22-20 42-20s36 6 42 20" />
        <Path d="M96 70v-6" />
        <Circle cx={96} cy={60} r={4} fill={paper.ink} stroke="none" />
      </Moving>
    </Scene>
  );
}

/**
 * A teapot pouring, held by nobody, which is how a picture book pours tea.
 *
 * The pot is the oversized object and it is tipped fourteen degrees, so the
 * scene has no level line in it except the table. The stream is the only
 * moving piece and it swings on one loop about the mouth of the spout: the
 * `Moving` box is CENTRED on that mouth, so the end that leaves the pot stays
 * put and only the end that lands in the cup wanders.
 */
export function WordTeapot({ width = 200, paused = false }: SceneProps) {
  const { loops, settled } = useSceneMotion({ loops: [{ period: 1900 }], paused });
  const stream = loops[0];

  return (
    <Scene width={width} style={settled}>
      <Frame width={width}>
        <Path d="M20 130h160" />

        {/* the pot, tipped to pour. Every part carries the same rotation. */}
        <Ellipse cx={72} cy={68} rx={30} ry={22} transform="rotate(-14 72 68)" />
        <Path d="M62 48c2-10 18-10 20 0" transform="rotate(-14 72 68)" />
        <Circle cx={72} cy={36} r={3.4} fill={paper.ink} stroke="none" transform="rotate(-14 72 68)" />
        <Path d="M44 58C24 56 22 84 44 82" transform="rotate(-14 72 68)" />
        {/* the spout leaves the body on a short chord, so it reads as a spout
            rather than as a flap laid over the side of the pot */}
        <Path d="M100 62c15 3 22 10 26 20" transform="rotate(-14 72 68)" />
        <Path d="M101 70c7 5 12 9 18 16" transform="rotate(-14 72 68)" />
        <Path d="M126 82l-7 4" transform="rotate(-14 72 68)" />

        {/* the cup it is aimed at */}
        <Ellipse cx={147} cy={104} rx={14} ry={4} />
        <Path d="M133 104c0 10 5 16 14 16s14-6 14-16" />
        <Path d="M161 108c6-1 8 4 5 7-2 2-4 1-5 0" />
        <Ellipse cx={147} cy={126} rx={21} ry={4.5} />

        <Stipple points={[[36, 122], [42, 125], [30, 126], [58, 102], [64, 105]]} />
      </Frame>

      {/* the stream, swinging about the spout it leaves */}
      <Moving
        box={{ x: 125, y: 71, w: 48, h: 66 }}
        width={width}
        style={{
          transform: [
            { rotate: stream?.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) ?? '0deg' },
          ],
        }}
      >
        <Path d="M125 71c9 9 16 19 22 31" />
      </Moving>
    </Scene>
  );
}
