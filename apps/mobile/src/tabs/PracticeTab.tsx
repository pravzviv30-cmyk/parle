/**
 * Practice — everything that is not a conversation.
 *
 * The guided café lesson, the review deck when cards are due, and the drill
 * bank, which is always open. The lesson lives here rather than under Tutor
 * because it is scripted content, not the tutor: Tutor is the thing that talks
 * back.
 *
 * The lesson path/map lands on this screen next. What is here now is the honest
 * shape of today's content — one lesson and one bank — rather than a map with
 * nothing on it.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CAFE_LESSON } from '@parle/core';
import { paper, space, type } from '../theme.ts';
import { Card, Label, PillButton, OutlineButton } from '../components.tsx';
import { LearnStack } from '../illustrations.tsx';
import { dueCount } from '../review/store.ts';
import { hasGeneratedExercises } from '../drill/store.ts';
import { useLive } from '../app/LiveContext.tsx';

export function PracticeTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { recheck } = useLive();

  const [due, setDue] = useState(0);
  const [curated, setCurated] = useState(false);

  // Re-read on every return to the tab: finishing a sitting must be able to
  // clear the count, and the tab is not remounted between visits.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void dueCount().then((n) => {
        if (!cancelled) setDue(n);
      });
      void hasGeneratedExercises().then((has) => {
        if (!cancelled) setCurated(has);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <LearnStack width={170} />
        </View>

        <Text style={st.headline}>Practice</Text>
        <Text style={st.subline}>
          {curated
            ? 'Fresh exercises, written by your tutor from your own conversations.'
            : 'Your conversations write these. The starter set is ready meanwhile.'}
        </Text>

        <Card style={{ marginTop: space(5) }}>
          <Label>The guided lesson</Label>
          <Text style={[type.french, { color: paper.ink, marginTop: space(2) }]}>{CAFE_LESSON.title}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{CAFE_LESSON.premise}</Text>
          <View style={{ marginTop: space(3) }}>
            <OutlineButton
              label="Start the lesson"
              sub="Guided, about five minutes"
              onPress={() => void recheck().then(() => nav.navigate('Lesson'))}
            />
          </View>
        </Card>

        {due > 0 && (
          <View style={{ marginTop: space(4) }}>
            <OutlineButton
              label="Review"
              sub={due === 1 ? '1 card is ready' : `${due} cards are ready`}
              onPress={() => nav.navigate('Review')}
            />
          </View>
        )}

        <View style={st.actions}>
          <PillButton label="Start practice" onPress={() => nav.navigate('Drill')} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(3) },
  hero: { alignItems: 'center', marginBottom: space(4) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  actions: { marginTop: 'auto', paddingTop: space(6) },
});
