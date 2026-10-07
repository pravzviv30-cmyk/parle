/**
 * A purchase the server has confirmed (motion-sound 5.9), on mint: the lock
 * opens and confetti flies. Published by the wall only once
 * `wallSuccess(confirmedGrant, …)` names a confirmed entitlement, never from a
 * store's say-so alone; a restore stays quiet. No countdown, nothing limited,
 * no number: the wall's own page under this card names the plan and its
 * minutes from the server's grant.
 */

import { AnimatedIcon } from '../../icons/AnimatedIcon.tsx';
import { paper } from '../../theme.ts';
import { Confetti } from '../Confetti.tsx';
import { StageBox, artSize, type StageProps } from './stage.tsx';

export function PurchaseConfirmed({ card, final, reduced, reached, width, height }: StageProps) {
  const key = card.shows[0]!.key;
  return (
    <StageBox height={height}>
      <AnimatedIcon kind="lock-open" size={Math.round(artSize(height) * 0.6)} color={paper.ink} state={reached('lock') ? 'on' : 'off'} />
      <Confetti
        seed={key}
        started={reached('burst')}
        final={final}
        reduced={reduced}
        width={width}
        height={height}
        count={36}
        palette={['blue', 'sun', 'paper']}
        ground="mint"
      />
    </StageBox>
  );
}
