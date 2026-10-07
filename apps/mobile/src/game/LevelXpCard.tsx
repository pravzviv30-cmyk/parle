/**
 * Progress's level card (F769; README Part 5.F, Part 6): the numbered level,
 * a bar for the XP into it, the XP in all and what the next level takes, and
 * the line for a day whose XP reached the shown cap.
 *
 * The level and the XP come from `useLevel()` and `useXp()` alone and the
 * words from `progressView.ts`; this file is layout. A level is a number and
 * never a rank name. Unread, the card is not drawn. The bar and the total are
 * drawn where they stand when the tab opens and move only when a new fact
 * lands while it is open, so nothing replays each time the tab is opened.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { LivingBar } from '../motion/LivingBar.tsx';
import { accent, paper, space, type } from '../theme.ts';
import { GAME_COPY } from './copy.ts';
import { useLevel, useXp } from './GameProvider.tsx';
import { levelXpCardView } from './progressView.ts';

export function LevelXpCard() {
  const card = levelXpCardView(useLevel(), useXp());
  if (card === null) return null;
  return (
    <Card style={st.card}>
      {/* One element to a screen reader, and that element is the card's
          header: a role on the Text inside an accessible View is never heard. */}
      <View style={st.head} accessible accessibilityRole="header" accessibilityLabel={card.label}>
        <Icon name="star" variant="bulk" size={space(8)} color={accent.brand} />
        <Text style={[type.title, st.grow, { color: paper.ink }]}>{card.title}</Text>
      </View>
      <LivingBar from={card.fraction} to={card.fraction} />
      <View style={st.line}>
        <CountUp from={card.total} to={card.total} format={GAME_COPY.progress.xpTotal} textStyle={[type.bodyStrong, { color: paper.ink }]} />
        <Text style={[type.small, st.grow, st.end, { color: paper.inkSoft }]}>{card.next}</Text>
      </View>
      {card.capped !== null ? <Text style={[type.small, { color: paper.inkSoft }]}>{card.capped}</Text> : null}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space(3), rowGap: space(1) },
  grow: { flex: 1, minWidth: 0 },
  end: { textAlign: 'right' },
});
