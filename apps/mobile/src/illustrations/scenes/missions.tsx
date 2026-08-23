/**
 * Four places a learner can walk into: a street corner, a market stall, a hotel
 * desk, and an evening at home.
 *
 * One drawing per mission, because six cards that share a picture are six cards
 * a learner cannot tell apart at a glance, which is the whole job of a card.
 * The other two missions already had theirs: the cafe is `HeroCafe` and the
 * evening with friends is `SpeakBubbles`.
 *
 * Still, all four, deliberately. Six moving scenes on one scrolling screen is
 * six things competing for the eye at the moment the learner is trying to
 * choose one, and the motion vocabulary is one loop per screen, not six. They
 * take `paused` anyway so they stay interchangeable with the scenes that move.
 *
 * Drawn to the pen's contract: ink at STROKE, `fill="none"` except one small
 * solid accent, stipple for shading, nothing perfectly level, viewBox 200x150.
 */

import { Circle, Ellipse, Path } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { Frame, Scene, Stipple, type SceneProps } from '../pen.tsx';

/** Asking the way: a leaning signpost with two boards pointing opposite ways. */
export function StreetCorner({ width = 200 }: SceneProps) {
  return (
    <Scene width={width}>
      <Frame width={width}>
        {/* the post, out of true on purpose */}
        <Path d="M101 134L96 40" />
        <Path d="M84 138c8-5 26-5 34 0" />
        {/* upper board, pointing right */}
        <Path d="M97 54h44l12 10-12 10H98z" />
        {/* lower board, pointing left */}
        <Path d="M99 84H55l-12 10 12 10h45z" />
        {/* a kerb and a lamp leaning the other way */}
        <Path d="M12 132h176" />
        <Path d="M170 130V62" />
        <Path d="M170 62c0-8 6-13 13-13" />
        <Ellipse cx={184} cy={54} rx={7} ry={5} />
        <Stipple points={[[34, 126], [40, 129], [28, 130], [140, 127], [147, 130]]} />
      </Frame>
    </Scene>
  );
}

/** The market: a crate of tomatoes on a trestle under a scalloped awning. */
export function MarketStall({ width = 200 }: SceneProps) {
  return (
    <Scene width={width}>
      <Frame width={width}>
        {/* awning, scalloped along its edge */}
        <Path d="M22 30h158" />
        <Path d="M24 30c0 12 10 12 10 0M44 30c0 12 10 12 10 0M64 30c0 12 10 12 10 0M84 30c0 12 10 12 10 0M104 30c0 12 10 12 10 0M124 30c0 12 10 12 10 0M144 30c0 12 10 12 10 0M164 30c0 12 10 12 10 0" />
        {/* the crate, tilted a touch */}
        <Path d="M62 88h78l-9 32H71z" transform="rotate(-1.5 101 104)" />
        <Path d="M69 104h64" transform="rotate(-1.5 101 104)" />
        {/* what is in it */}
        <Circle cx={78} cy={82} r={8} />
        <Circle cx={96} cy={79} r={9} />
        <Circle cx={116} cy={83} r={7.5} />
        <Path d="M96 70v-4" />
        {/* trestle legs */}
        <Path d="M74 120l-10 20M130 120l10 20" />
        {/* the one solid accent: a paper price tag on the crate */}
        <Path d="M138 92l14-4 4 10-14 4z" fill={paper.ink} stroke="none" />
        <Stipple points={[[52, 128], [58, 132], [46, 133], [150, 128], [157, 132]]} />
      </Frame>
    </Scene>
  );
}

/** Checking in: a desk, a bell that is slightly too big, a key on a fob. */
export function FrontDesk({ width = 200 }: SceneProps) {
  return (
    <Scene width={width}>
      <Frame width={width}>
        {/* the desk */}
        <Path d="M32 96h136v34H32z" transform="rotate(-1 100 113)" />
        <Path d="M32 108h136" transform="rotate(-1 100 113)" />
        {/* the bell, one size larger than it should be */}
        <Path d="M78 92c0-14 9-24 22-24s22 10 22 24" />
        <Path d="M72 92h56" />
        <Path d="M100 68v-7" />
        <Circle cx={100} cy={57} r={4} />
        {/* the key, waiting on the counter */}
        <Circle cx={142} cy={88} r={7} />
        <Path d="M149 88h20" />
        <Path d="M162 88v7M168 88v6" />
        {/* pigeonholes behind */}
        <Path d="M40 16h48v34H40zM96 16h48v34H96z" />
        <Path d="M40 33h48M96 33h48" />
        <Stipple points={[[46, 122], [52, 126], [40, 127], [150, 122], [157, 125]]} />
      </Frame>
    </Scene>
  );
}

/** The end of the day: a window, a moon, and a mug on the sill. */
export function EveningIn({ width = 200 }: SceneProps) {
  return (
    <Scene width={width}>
      <Frame width={width}>
        {/* the window, leaning a degree */}
        <Path d="M60 26h84v82H60z" transform="rotate(-1 102 67)" />
        <Path d="M102 26v82M60 67h84" transform="rotate(-1 102 67)" />
        {/* the moon, the scene's one solid accent */}
        <Circle cx={126} cy={46} r={8} fill={paper.ink} stroke="none" />
        {/* the sill */}
        <Path d="M46 110h112" />
        {/* a mug on it, and a book */}
        <Path d="M72 96h20v10c0 3-3 5-6 5h-8c-3 0-6-2-6-5z" />
        <Path d="M92 99c6-1 8 2 6 5-1 2-4 2-6 1" />
        <Path d="M114 104h30l-2 7h-30z" />
        <Path d="M118 104v7" />
        {/* the curtain, gathered to one side */}
        <Path d="M52 20c8 14 8 62 2 88" />
        <Path d="M56 20c5 16 5 60 1 86" />
        <Stipple points={[[36, 118], [42, 122], [30, 123], [160, 118], [167, 121]]} />
      </Frame>
    </Scene>
  );
}
