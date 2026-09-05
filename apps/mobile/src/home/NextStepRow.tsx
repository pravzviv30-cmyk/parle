/**
 * The next step: one row, and the way to the whole path.
 *
 * Core picks the situation (`suggestedMission`), `progress/portfolio.ts` owns
 * the two words above it, and this file draws a row. Nothing here re-decides
 * which situation is next, and nothing here spells "Next step" or "View
 * learning path", for the reason `NEXT_SITUATION` gave first: a screen that
 * spells its own heading is a screen that will spell it differently from the
 * next one.
 *
 * It is a row rather than the card it used to be, because the card was Home's
 * headline and the founder's mockup gives that place to today's situation. The
 * full card still exists and My French still draws it; what leaves Home is the
 * duplicate, not the destination.
 *
 * The whole row is the target, at the touch floor, and its screen-reader
 * sentence carries the situation and what the learner will be able to do, so
 * the arrow at the end is decorative rather than a second control.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MissionProgress } from '@luvani/core';

import { ArrowRight, Card, GhostButton, Label } from '../components.tsx';
import { MissionDisc } from '../missions/MissionDisc.tsx';
import { NEXT_STEP } from '../progress/portfolio.ts';
import { HIT, paper, space, type } from '../theme.ts';

export function NextStepRow({
  next,
  onOpen,
  onViewPath,
}: {
  next: MissionProgress;
  onOpen: () => void;
  onViewPath: () => void;
}) {
  return (
    <View style={st.block}>
      <View style={st.head}>
        <View style={st.headWords}>
          <Label>{NEXT_STEP.label}</Label>
        </View>
        <GhostButton label={NEXT_STEP.link} onPress={onViewPath} />
      </View>
      <Card padded={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${next.mission.titleEn}. ${next.mission.goalEn}`}
          onPress={onOpen}
          style={({ pressed }) => [st.row, pressed && st.pressed]}
        >
          <MissionDisc place={next.mission.place} size={48} />
          <View style={st.words}>
            <Text style={st.title}>{next.mission.titleEn}</Text>
            <Text style={st.gloss}>{next.mission.goalEn}</Text>
          </View>
          <ArrowRight />
        </Pressable>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(7) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(2) },
  headWords: { flex: 1, minWidth: 0 },
  // The whole row is the target and it never falls under the touch floor, so it
  // stays reachable one handed on a train.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, padding: space(3) },
  pressed: { opacity: 0.72 },
  words: { flex: 1, minWidth: 0 },
  title: { ...type.title, color: paper.ink },
  gloss: { ...type.small, color: paper.inkSoft, marginTop: space(0.5) },
});
