/**
 * A new level (motion-sound 5.7), on blue: the crest rises in front of a sun
 * glow and confetti flies as the number changes. The crest carries no number
 * and no name; the frame says "Level n" from the moment's own data
 * (`xpLevelFor`'s numbers), and never a rank name.
 */

import { Crest } from '../../game/art/index.ts';
import { Enter } from '../../motion/layout.tsx';
import { DUR } from '../../motion/tokens.ts';
import { colour } from '../../theme.ts';
import { Confetti } from '../Confetti.tsx';
import { StageBloom, StageBox, artSize, type StageProps } from './stage.tsx';

export function LevelUp({ card, final, reduced, reached, width, height }: StageProps) {
  const key = card.shows[0]!.key;
  const art = artSize(height);
  return (
    <StageBox height={height}>
      <StageBloom colour={colour.sun} radius={art * 0.6} started={reached('bloom')} final={final} reduced={reduced} hold />
      {final ? (
        <Crest size={art} ground="blue" />
      ) : (
        <Enter from="none" scaleFrom={0.4} duration={DUR.settle}>
          <Crest size={art} ground="blue" />
        </Enter>
      )}
      <Confetti
        seed={key}
        started={reached('burst')}
        final={final}
        reduced={reduced}
        width={width}
        height={height}
        count={48}
        palette={['sun', 'paper', 'mint', 'coral']}
        ground="blue"
      />
    </StageBox>
  );
}
