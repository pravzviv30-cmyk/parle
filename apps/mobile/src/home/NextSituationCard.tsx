import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MissionProgress } from '@luvani/core';

import { Card, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { NEXT_SITUATION } from '../progress/portfolio.ts';
import { missionStatus } from '../missions/chooserView.ts';
import { MissionDisc } from '../missions/MissionDisc.tsx';

/**
 * The next situation to walk into, drawn once for Home and for My French.
 *
 * The two tabs used to spell this card separately and a test kept the copy in
 * step; now there is one card, so they are identical by construction (F351,
 * F363). It says the place (the drawing on its tint), the French and English
 * titles, what the learner will be able to do (the mission's own `goalEn`), and
 * where they stand with it (`missionStatus`, decided in chooserView.ts).
 *
 * The actions come in as children, because each tab keeps its own pill: Home's
 * is this card, My French's is this card, and neither tab may carry a second.
 */
export function NextSituationCard({
  next,
  children,
  style,
}: {
  next: MissionProgress;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={style}>
      <Label>{NEXT_SITUATION.label}</Label>
      <View style={st.head}>
        <MissionDisc place={next.mission.place} size={64} />
        <View style={st.titles}>
          <Text style={[type.title, { color: paper.ink }]}>{next.mission.title}</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(0.5) }]}>{next.mission.titleEn}</Text>
        </View>
      </View>
      <Text style={st.goal}>{next.mission.goalEn}</Text>
      <Text style={st.status}>{missionStatus(next.state, next.independence)}</Text>
      <View style={st.actions}>{children}</View>
    </Card>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3) },
  // `minWidth: 0` beside `flex: 1`, or a French title beside the disc pushes
  // its neighbour off the screen at the largest reading size.
  titles: { flex: 1, minWidth: 0 },
  goal: { ...type.body, color: paper.ink, marginTop: space(3) },
  status: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  actions: { marginTop: space(4) },
});
