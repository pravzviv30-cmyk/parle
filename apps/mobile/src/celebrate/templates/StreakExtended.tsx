/**
 * The streak grew today (motion-sound 5.3), on paper: the flame lights from an
 * ember, a few sparks rise, and the run arrives under it. The flame lights
 * once, for this moment's own key; afterwards it flickers a few times and
 * rests, never a loop.
 *
 * Board A (2026-11-19) gives two forms their own quiet stage, picked by the
 * card's `mark`: a run a freeze carried draws the ink tick on a mint disc
 * (CheckDisc); a kept repair draws the RepairMark on a white tile. Each is
 * still once final and rises in on its `mark` beat while playing. Neither has
 * a flame, confetti or a mascot.
 */

import { StyleSheet, View } from 'react-native';

import { Flame } from '../../game/art/index.ts';
import { RepairMark } from '../../game/art/RepairMark.tsx';
import { Enter } from '../../motion/layout.tsx';
import { CheckDisc } from '../../today/TodayParts.tsx';
import { colour, corner, paper, textOn } from '../../theme.ts';
import { Confetti } from '../Confetti.tsx';
import { StageBox, artSize, type StageProps } from './stage.tsx';

/** The artboards' sizes: a 96pt disc, a 112pt tile with a 76pt mark. */
const DISC = 96;
const TILE = 112;
const MARK = 76;

export function StreakExtended({ card, view, final, reduced, reached, width, height }: StageProps) {
  if (view.mark === 'tick') {
    const disc = <CheckDisc size={DISC} fill={colour.mint} tick={textOn.mint} />;
    // Still once final; playing, the disc rises in on its beat, as the repair tile does.
    return <StageBox height={height}>{final ? disc : reached('mark') ? <Enter distance={24}>{disc}</Enter> : null}</StageBox>;
  }
  if (view.mark === 'repair') {
    const tile = (
      <View style={st.tile}>
        <RepairMark size={MARK} />
      </View>
    );
    // Still once final; playing, the tile rises in on its beat.
    return <StageBox height={height}>{final ? tile : reached('mark') ? <Enter distance={24}>{tile}</Enter> : null}</StageBox>;
  }
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

const st = StyleSheet.create({
  tile: { width: TILE, height: TILE, ...corner.card, backgroundColor: paper.card, alignItems: 'center', justifyContent: 'center' },
});
