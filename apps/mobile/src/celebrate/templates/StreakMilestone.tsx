/**
 * A streak milestone (motion-sound 5.4), on coral: the flame lights in white
 * and sun, a white ring closes round it, and when it closes the glow opens and
 * the confetti flies. The ring closing is the milestone reached, a fact, never
 * progress towards one.
 */

import { Flame } from '../../game/art/index.ts';
import { ProgressRing } from '../../motion/ProgressRing.tsx';
import { DUR } from '../../motion/tokens.ts';
import { colour, paper, segmentPending } from '../../theme.ts';
import { Confetti } from '../Confetti.tsx';
import { TIMELINES, beatAt } from '../timelines.ts';
import { StageBloom, StageBox, artSize, type StageProps } from './stage.tsx';

const RING_AT = beatAt(TIMELINES['streak-milestone'], 'ring');

export function StreakMilestone({ card, final, reduced, reached, width, height }: StageProps) {
  const key = card.shows[0]!.key;
  const art = artSize(height);
  const flame = Math.round(art * 0.72);
  return (
    <StageBox height={height}>
      <StageBloom colour={colour.sun} radius={art * 0.55} started={reached('bloom')} final={final} reduced={reduced} hold />
      <ProgressRing from={final ? 1 : 0} to={1} size={art} stroke={8} color={paper.card} track={segmentPending.coral} duration={DUR.reveal} delay={final ? 0 : RING_AT}>
        <Flame size={flame} state="lit" ground="coral" ignite={final ? undefined : key} />
      </ProgressRing>
      <Confetti
        seed={key}
        started={reached('burst')}
        final={final}
        reduced={reduced}
        width={width}
        height={height}
        count={48}
        palette={['sun', 'paper', 'blue', 'mint']}
        ground="coral"
      />
    </StageBox>
  );
}
