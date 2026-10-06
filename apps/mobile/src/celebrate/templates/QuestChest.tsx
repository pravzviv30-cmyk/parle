/**
 * All three of today's quests done (README Part 6: the chest is a takeover only
 * then; a single quest is a row on the end card), on sun: the chest drops in,
 * its lid opens on its hinge, a blue glow and confetti come out of it.
 */

import { Chest } from '../../game/art/index.ts';
import { Enter } from '../../motion/layout.tsx';
import { DUR } from '../../motion/tokens.ts';
import { colour } from '../../theme.ts';
import { Confetti } from '../Confetti.tsx';
import { StageBloom, StageBox, artSize, type StageProps } from './stage.tsx';

export function QuestChest({ card, final, reduced, reached, width, height }: StageProps) {
  const key = card.shows[0]!.key;
  const art = artSize(height);
  return (
    <StageBox height={height}>
      <StageBloom colour={colour.blue} radius={art * 0.55} started={reached('bloom')} final={final} reduced={reduced} hold />
      {final ? (
        <Chest size={art} open ground="sun" />
      ) : (
        <Enter from="up" distance={40} duration={DUR.base}>
          <Chest size={art} open={reached('lid')} ground="sun" />
        </Enter>
      )}
      <Confetti
        seed={key}
        started={reached('burst')}
        final={final}
        reduced={reduced}
        width={width}
        height={height}
        count={28}
        palette={['blue', 'coral', 'paper']}
        ground="sun"
      />
    </StageBox>
  );
}
