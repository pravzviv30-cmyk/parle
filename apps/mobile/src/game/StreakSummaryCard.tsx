/**
 * Progress's streak card (F769; README Part 5.F): the flame and the run, the
 * longest run, this week Monday to Sunday, and under them the weekly day line
 * the tab hands in (`<DayCount weekly />`, whose slot the tab keeps pinned).
 *
 * The words and each day's state are `progressView.ts`'s, from the game view's
 * practice days and covers, the same days the Streak screen draws. There is no
 * "missed": a day without practice is a quiet ring, said as "no practice".
 * The heading row opens the Streak screen; the week is a fact, not a door, so
 * the card holds one target and nothing pressable inside another. Unread, the
 * card is not drawn, and the line it holds is drawn on its own.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ChevronRight, Card, Press } from '../components.tsx';
import { HIT, paper, space, type } from '../theme.ts';
import { Flame } from './art/Flame.tsx';
import { FreezeMark } from './art/FreezeMark.tsx';
import { RepairMark } from './art/RepairMark.tsx';
import { useGame } from './GameProvider.tsx';
import { streakSummaryView } from './progressView.ts';

const FLAME = HIT;
const MARK = space(6);
const COLUMN = `${100 / 7}%` as const;

export function StreakSummaryCard({ children }: { children?: ReactNode }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const card = streakSummaryView(useGame().view);
  // Unread, the card is not drawn; the line it holds still is.
  if (card === null) return <>{children}</>;
  return (
    <Card style={st.card}>
      <Press haptic="light" accessibilityRole="button" accessibilityLabel={card.label} onPress={() => nav.navigate('Streak')} style={st.head}>
        <Flame size={FLAME} state={card.lit ? 'lit' : 'unlit'} />
        <View style={st.words}>
          <Text style={[type.heading, { color: paper.ink }]}>{card.words}</Text>
          {card.longest !== null ? <Text style={[type.small, { color: paper.inkSoft }]}>{card.longest}</Text> : null}
        </View>
        <ChevronRight size={20} color={paper.inkSoft} />
      </Press>
      <View style={st.week}>
        {card.week.map((cell) => (
          <View key={cell.day} style={st.column} accessible accessibilityLabel={cell.label}>
            {cell.state === 'practised' ? (
              <Flame size={MARK} state="lit" />
            ) : cell.state === 'covered' ? (
              cell.cover === 'repair' ? <RepairMark size={MARK} /> : <FreezeMark size={MARK} />
            ) : (
              <View style={[st.ring, cell.state === 'today-open' && st.today]} />
            )}
            <Text style={[type.small, { color: paper.inkSoft }]}>{cell.mark}</Text>
          </View>
        ))}
      </View>
      {children}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  head: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { flex: 1, minWidth: 0 },
  week: { flexDirection: 'row' },
  column: { flexBasis: COLUMN, maxWidth: COLUMN, alignItems: 'center', gap: space(1) },
  ring: { width: MARK, height: MARK, borderRadius: MARK / 2, borderWidth: 2, borderColor: paper.field },
  today: { borderColor: paper.ink },
});
