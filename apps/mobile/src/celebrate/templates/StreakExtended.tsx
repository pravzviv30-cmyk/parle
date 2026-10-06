/**
 * The streak grew today (motion-sound 5.3), on paper: the flame lights from an
 * ember, a few sparks rise, and the run arrives under it. The flame lights
 * once, for this moment's own key; afterwards it flickers a few times and
 * rests, never a loop.
 */

import { Flame } from '../../game/art/index.ts';
import { Confetti } from '../Confetti.tsx';
import { StageBox, artSize, type StageProps } from './stage.tsx';

export function StreakExtended({ card, final, reduced, reached, width, height }: StageProps) {
  const key = card.shows[0]!.key;
  return (
    <StageBox height={height}>
      <Flame size={artSize(height)} state="lit" ignite={final ? undefined : key} flicker={!final && reached('lines')} />
      <Confetti
        seed={key}
        started={reached('sparks')}
        final={final}
        reduced={reduced}
        width={width}
        height={height}
        count={12}
        palette={['sun', 'coral']}
        ground="paper"
        spread={50}
      />
    </StageBox>
  );
}
