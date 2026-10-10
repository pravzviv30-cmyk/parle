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
import { RevealItem } from '../motion/OnboardingScenes.tsx';
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
        {rows.map((row, index) => (
          <RevealItem key={row.key} index={index}><View style={st.row}>
            <IconTile name={row.icon} ground={GROUND[row.key]} size={32} />
            <Text style={[type.body, st.words]}>{row.text}</Text>
          </View></RevealItem>
        ))}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(4), gap: space(2) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  soft: { color: paper.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: space(11) },
  words: { ...ROW_WORDS, color: paper.ink },
});
