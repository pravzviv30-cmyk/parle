/**
 * The three moments.
 *
 * These are not screens, they are beats, so none of them loops. A reward that
 * keeps moving stops being a moment and becomes decoration, and the app's rule
 * is one loop plus one entrance, not one loop everywhere.
 *
 * They are also the only place a scene may take a signal colour, because here
 * the drawing IS the verdict rather than the label above one.
 */

import { Path, Circle } from 'react-native-svg';
import Svg, { G } from 'react-native-svg';
import { Animated } from 'react-native';
import { paper, signal, STROKE, decorative } from '../../theme.ts';
import { Frame, Moving, Scene, Stipple, type SceneProps } from '../pen.tsx';
import { useSceneMotion, arriveStyle } from '../useSceneMotion.ts';

/**
 * A sprig in a small glass, one leaf just opened. For a clean session, for a
 * finished drill sitting, and for a phrase graduating out of the deck.
 */

/**
 * The mark that lands beside a drill verdict.
 *
 * Not a scene: the verdict slot is `HIT + 8` tall and a 4:3 drawing would not
 * fit in it. One tick, arriving once. The ring is a second arrival rather than
 * a loop, so the whole thing is over in under half a second and the learner is
 * looking at the next exercise, not at a celebration.
 *
 * `kind` is the only place in the illustration layer that takes a signal
 * colour, because here the drawing is the verdict rather than a label above
 * one, and it uses core's own words (`good`, `typo`) so the app does not grow
 * a second vocabulary for one thing.
 *
 * There is no `miss` variant on purpose. DESIGN.md forbids a mid-session
 * message that scolds, and a drawing scolds louder than a word: a miss keeps
 * the line it already had, alone. `typo` gets a bar rather than a tick because
 * the answer was accepted and only the spelling was named.
 */
export function RewardMark({
  size = 28,
  kind = 'good',
  paused = false,
}: {
  size?: number;
  /** Core's own words for a drill verdict, so there is not a second set. */
  kind?: 'good' | 'typo';
  paused?: boolean;
}) {
  const { arrivals } = useSceneMotion({ arrivals: 2, paused });
  const tick = arrivals[0];
  const ring = arrivals[1];
  const colour = kind === 'good' ? signal.good : paper.ink;

  return (
    <Animated.View
      style={[{ width: size, height: size }, tick ? arriveStyle(tick) : null]}
      {...decorative}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40" {...decorative}>
        <G fill="none" stroke={colour} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={20} cy={20} r={16} />
          {kind === 'good' ? (
            <Path d="M12 20l6 7 12-14" strokeWidth={STROKE * 1.3} />
          ) : (
            <Path d="M13 20h14" strokeWidth={STROKE * 1.3} />
          )}
        </G>
      </Svg>
      {/* a single ring, expanding out and fading. Opacity and scale only. */}
      <Animated.View
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: STROKE,
          borderColor: colour,
          opacity: ring?.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }) ?? 0,
          transform: [{ scale: ring?.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) ?? 1.6 }],
        }}
      />
    </Animated.View>
  );
}
