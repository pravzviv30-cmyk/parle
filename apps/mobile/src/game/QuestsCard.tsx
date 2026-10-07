/**
 * Home's daily quests (F767; README Part 5.F, D22): "Daily quests", the day so
 * far in one line, and today's three as rows, each with its own progress.
 *
 * What it says is `questsCardView.ts`'s, from the game layer's `useQuests()`:
 * the three dealt and frozen for today, never a fourth, and when all three are
 * done the one quiet line "All three quests done today.". There is no chest,
 * no reward and no countdown. Nothing is drawn when the quests could not be
 * read or are not dealt yet.
 *
 * Home only shows the quests: progress and claims are the game layer's, and a
 * row is a fact rather than a door, so nothing here presses. The day's count
 * counts up once from what Home last showed (`home/homeSeen.ts`) and is said
 * once to a screen reader when it changes. No sound of its own: the end card
 * that finished a quest played it.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { LivingBar } from '../motion/LivingBar.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { useShownFrom } from '../home/useShownFrom.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { HIT, accent, paper, space, type } from '../theme.ts';
import { GAME_COPY } from './copy.ts';
import { useGame, useGoal, useQuests } from './GameProvider.tsx';
import { questsCardView } from './questsCardView.ts';

/** A row's tile, a little under the touch floor: the row is not a target. */
const TILE = HIT - space(2);
const BAR = space(1.5);

export function QuestsCard() {
  const { profile } = useProfile();
  const { view } = useGame();
  const quests = useQuests();
  const goal = useGoal();
  const card = questsCardView(quests, { tutorName: tutorNameOf(profile), goalTarget: goal?.target ?? null });
  const from = useShownFrom(view?.today ?? null, card === null ? null : { questsDone: card.done });
  if (card === null || from === null) return null;

  return (
    <Card style={st.card}>
      <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>
        {card.title}
      </Text>
      <View accessibilityLiveRegion="polite">
        <CountUp
          from={Math.min(from.questsDone ?? card.done, card.done)}
          to={card.done}
          format={GAME_COPY.quests.progress}
          textStyle={[card.allDone ? type.bodyStrong : type.small, { color: card.allDone ? paper.ink : paper.inkSoft }]}
        />
      </View>
      {card.rows.map((row) => (
        <View key={row.id} accessible accessibilityLabel={row.label} style={st.row}>
          <IconTile ground={row.complete ? 'mint' : 'skeleton'} name={row.complete ? 'tick-circle' : row.icon} size={TILE} />
          <View style={st.words}>
            <Text style={[type.label, { color: paper.ink }]}>{row.title}</Text>
            <LivingBar from={row.fraction} to={row.fraction} height={BAR} radius={BAR / 2} color={accent.brand} />
          </View>
          <Text style={[type.small, { color: row.complete ? paper.ink : paper.inkSoft }]}>{row.count}</Text>
        </View>
      ))}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(5), gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1) },
  words: { flex: 1, minWidth: 0, gap: space(1.5) },
});
