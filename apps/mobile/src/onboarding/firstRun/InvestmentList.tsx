/**
 * The save card (come alive, README Part 5.C row 10): what this phone holds,
 * under "On this phone only", one row each. Which rows, and their words, are
 * `guestProgress.ts` `guestInvestment`, which lists only what is true; this
 * only draws them, arriving one after another.
 *
 * Reduced motion: every row is in place at once (StaggerIn's entrances watch
 * the setting live).
 */

import { StyleSheet, Text, View } from 'react-native';
import { ROW_WORDS } from '../../components.tsx';
import { Icon } from '../../icons/Icon.tsx';
import { IconTile, type TileGround } from '../../icons/IconTile.tsx';
import { StaggerIn } from '../../motion/StaggerIn.tsx';
import { STAGGER } from '../../motion/tokens.ts';
import { decorative, paper, radius, space, type } from '../../theme.ts';
import type { InvestmentRow } from '../guestProgress.ts';
import { FIRST_RUN_COPY } from './copy.ts';

/** Each row's tile ground: a pair IconTile allows, and the flame on coral as the game draws it. */
const GROUND: Readonly<Record<InvestmentRow['key'], TileGround>> = {
  streak: 'coral',
  replies: 'mint',
  kept: 'blue',
  plan: 'sun',
  tutor: 'skeleton',
  reminder: 'ink',
};

export function InvestmentList({ rows }: { rows: readonly InvestmentRow[] }) {
  return (
    <View style={st.card}>
      <View style={st.head}>
        <View {...decorative}>
          <Icon name="mobile" size={20} color={paper.inkSoft} />
        </View>
        <Text style={[type.small, st.soft]}>{FIRST_RUN_COPY.onThisPhone}</Text>
      </View>
      <StaggerIn step={STAGGER.base}>
        {rows.map((row) => (
          <View key={row.key} style={st.row}>
            <IconTile name={row.icon} ground={GROUND[row.key]} size={40} />
            <Text style={[type.body, st.words]}>{row.text}</Text>
          </View>
        ))}
      </StaggerIn>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(5), gap: space(3) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  soft: { color: paper.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: space(11) },
  words: { ...ROW_WORDS, color: paper.ink },
});
