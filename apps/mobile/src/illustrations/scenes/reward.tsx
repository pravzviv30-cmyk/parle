/**
 * The verdict mark.
 *
 * The only place in the illustration layer that may take a signal colour,
 * because here the drawing IS the verdict rather than the label above one.
 */

import { Path, Circle } from 'react-native-svg';
import Svg, { G } from 'react-native-svg';
import { View } from 'react-native';
import { paper, signal, STROKE, decorative } from '../../theme.ts';

/**
 * The mark beside a drill verdict.
 *
 * Not a scene: the verdict slot is `HIT + 8` tall and a 4:3 drawing would not
 * fit in it. One tick in a ring, and still (notebook Phase 4, 2026-09-27): only
 * the orb and the highlighter move in the notebook, so the mark no longer
 * arrives or throws a ring. It is there when the verdict is, and gone with it.
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
}: {
  size?: number;
  /** Core's own words for a drill verdict, so there is not a second set. */
  kind?: 'good' | 'typo';
}) {
  const colour = kind === 'good' ? signal.good : paper.ink;

  return (
    <View style={{ width: size, height: size }} {...decorative}>
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
    </View>
  );
}
