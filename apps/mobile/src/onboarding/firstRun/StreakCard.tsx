/** The guest home's quiet streak card, using the guest's real finish days. */

import { StyleSheet, Text, View } from 'react-native';
import type { DayKey } from '@luvani/core';
import { Flame } from '../../game/art/index.ts';
import { GAME_COPY } from '../../game/copy.ts';
import { paper, radius, space, type } from '../../theme.ts';
import type { GuestStreak } from '../guestProgress.ts';
import { WeekStrip } from './WeekStrip.tsx';

const CARD_FLAME = 40;

export function StreakCard({ streak, today }: { streak: GuestStreak; today: DayKey }) {
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Flame size={CARD_FLAME} state={streak.todayPractised ? 'lit' : 'unlit'} />
        <Text style={[type.heading, st.ink, st.words]}>{`${streak.current} ${GAME_COPY.streak.label}`}</Text>
      </View>
      <WeekStrip week={streak.week} today={today} />
    </View>
  );
}

const st = StyleSheet.create({
  ink: { color: paper.ink },
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(5), gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { flex: 1 },
});
