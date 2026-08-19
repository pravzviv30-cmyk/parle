/**
 * Practice — the path.
 *
 * Two authored units over the phrases the bank can actually drill, plus one
 * that fills itself from the learner's own conversations. Node state is read
 * from the review deck rather than stored, so the map and the scheduler can
 * never disagree about whether something has been learned.
 *
 * Honest about its length. The repo holds one lesson and one fixture bank, so
 * this is seven authored stops and no more; a longer map would be empty rooms.
 * The terminus says where the rest comes from, because that is true and it is
 * also the product's whole argument.
 */

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { buildPath, CAFE_LESSON, type PathUnit } from '@parle/core';
import { paper, space, type } from '../theme.ts';
import { Card, Label, OutlineButton, GhostButton } from '../components.tsx';
import { PathNodeRow } from '../practice/PathNodeRow.tsx';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { lastSummaryFor } from '../progress/store.ts';
import { dueCount } from '../review/store.ts';
import { useLive } from '../app/LiveContext.tsx';

export function PracticeTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();

  const [units, setUnits] = useState<PathUnit[] | null>(null);
  const [due, setDue] = useState(0);

  // Rebuilt on every return: a sitting that just finished must be visible on
  // the map the moment the learner lands back on it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadDeck(), loadDrillBank(), lastSummaryFor(CAFE_LESSON.id), dueCount()]).then(
        ([deck, bank, lastLesson, dueNow]) => {
          if (cancelled) return;
          setUnits(buildPath(deck, bank, { lessonDone: lastLesson !== null }, Date.now()));
          setDue(dueNow);
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const open = (node: { id: string; kind: string; title: string; phraseKeys: readonly string[] }, textMode = false) => {
    if (node.kind === 'lesson') {
      void recheck().then(() => nav.navigate('Lesson', textMode ? { textMode: true } : undefined));
      return;
    }
    nav.navigate('Drill', { node: { id: node.id, title: node.title, phraseKeys: node.phraseKeys } });
  };

  const lessonNode = units?.flatMap((u) => u.nodes).find((n) => n.kind === 'lesson') ?? null;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <Text style={[type.title, { color: paper.ink }]}>Practice</Text>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {due > 0 && (
          <View style={{ marginBottom: space(6) }}>
            <OutlineButton
              label="Review"
              sub={due === 1 ? '1 card is ready' : `${due} cards are ready`}
              onPress={() => nav.navigate('Review')}
            />
          </View>
        )}

        {units?.map((unit) => (
          <View key={unit.id} style={{ marginBottom: space(7) }}>
            <Label>{unit.title}</Label>
            <View style={{ marginTop: space(3), gap: space(2.5) }}>
              {unit.nodes.map((node) => (
                <PathNodeRow key={node.id} node={node} onPress={() => open(node)} />
              ))}
            </View>
          </View>
        ))}

        {lessonNode && (
          <View style={{ marginBottom: space(6) }}>
            <GhostButton
              label="Unable to speak right now?"
              onPress={() => open(lessonNode, true)}
            />
          </View>
        )}

        <Card>
          <Label>The rest of this path</Label>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>
            Your conversations write the rest of this.
          </Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
            Every time you talk to your tutor, it writes practice from what you actually said, and it lands here.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(4) },
});
