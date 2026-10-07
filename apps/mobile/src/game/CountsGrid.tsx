/**
 * Progress's four counts (F769; README Part 5.F): phrases kept, conversations,
 * minutes practised and practice days, two by two, each a tile at the touch
 * floor that opens where the count comes from.
 *
 * The tab hands in the counts it already read (the deck and the conversation
 * records). The minutes and the practice days are the game view's, through its
 * hooks: the minutes over every finished sitting by the goal ring's own rule,
 * so a daily phrase counts here as it does on Home's ring, and the days from
 * the streak's lifetime total. A count the game layer could not read is not
 * drawn. Every number is a persisted fact; the tiles and their words are
 * `progressView.ts`'s. Named `CountsGrid`, never a `Stat`: the tab's own test
 * refuses the old stat tiles.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Press } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { HIT, paper, radius, space, type } from '../theme.ts';
import { useMinutesPractised, useStreak } from './GameProvider.tsx';
import { countTiles } from './progressView.ts';

export function CountsGrid({ phrases, conversations }: { phrases: number; conversations: number }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const run = useStreak();
  const minutes = useMinutesPractised();
  const tiles = countTiles({ phrases, conversations, minutes, days: run === null ? null : run.lifetimeDays });
  return (
    <View style={st.grid}>
      {tiles.map((tile) => (
        <Press
          key={tile.id}
          haptic="light"
          depth="tile"
          accessibilityRole="button"
          accessibilityLabel={tile.label}
          onPress={() => nav.navigate(tile.opens)}
          frame={st.frame}
          style={st.tile}
        >
          <IconTile ground="skeleton" name={tile.icon} size={space(10)} />
          <Text style={[type.stat, { color: paper.ink }]}>{tile.value}</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>{tile.words}</Text>
        </Press>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  // Two to a row, each allowed to take a whole row at a large reading size.
  frame: { flexBasis: '40%', flexGrow: 1, minWidth: 0 },
  tile: { minHeight: HIT * 2, padding: space(4), gap: space(1), borderRadius: radius.tile, backgroundColor: paper.card },
});
