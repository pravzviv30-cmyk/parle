/**
 * A badge, or up to three earned together (motion-sound 5.8), on paper: the
 * medals drop in side by side and a sun glow opens behind them. The frame names
 * each badge and says what earned it, from the badge catalogue.
 */

import { StyleSheet, View } from 'react-native';

import { Medal, type MedalState } from '../../game/art/index.ts';
import { Enter } from '../../motion/layout.tsx';
import { DUR, STAGGER } from '../../motion/tokens.ts';
import { colour, space } from '../../theme.ts';
import { StageBloom, StageBox, artSize, type StageProps } from './stage.tsx';

/** Medals side by side wear the three medal colours in turn, so they read as several. */
const STATES: readonly MedalState[] = ['sun', 'mint', 'blue'];

export function BadgeEarned({ view, final, reduced, reached, height }: StageProps) {
  const art = artSize(height);
  const many = view.badges.length > 1;
  const size = many ? Math.round(art * 0.62) : art;
  return (
    <StageBox height={height}>
      <StageBloom colour={colour.sun} radius={art * 0.6} started={reached('bloom')} final={final} reduced={reduced} hold />
      <View style={st.row}>
        {view.badges.map((badge, i) => {
          const medal = <Medal size={size} state={STATES[i % STATES.length]} />;
          return final ? (
            <View key={badge.id}>{medal}</View>
          ) : (
            <Enter key={badge.id} from="up" distance={60} duration={DUR.settle} index={i} step={STAGGER.base}>
              {medal}
            </Enter>
          );
        })}
      </View>
    </StageBox>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(3) },
});
