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
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { buildPath, CAFE_LESSON, dueCards, type PathUnit, type PracticeTopic } from '@parle/core';
import { paper, paperFor, space, type } from '../theme.ts';
import { Card, Label, OutlineButton, GhostButton } from '../components.tsx';
import { PathNodeRow } from '../practice/PathNodeRow.tsx';
import { MIX_OFFER, offersMix } from '../practice/mix.ts';
import { seedTopicFor } from '../practice/talkAgain.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadTopics } from '../topics/store.ts';
import { lastSummaryFor } from '../progress/store.ts';
import { useLive } from '../app/LiveContext.tsx';

export function PracticeTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();

  // The locked row draws a pen that keeps moving. It has no reason to keep
  // moving while the learner is on another tab, and the scene cannot ask
  // this for itself: useIsFocused throws outside a NavigationContainer, and
  // five of the places that render a scene mount above the navigator.
  const focused = useIsFocused();
  const [units, setUnits] = useState<PathUnit[] | null>(null);
  const [due, setDue] = useState(0);
  // Kept rather than thrown away after buildPath: a topic row's second door
  // needs the topic's own title in both languages to seed a conversation with.
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
  // Recomputed on every focus alongside everything else, which is the whole of
  // the daily refresh: the offer answers to today's due state, not to a clock.
  const [mixOffered, setMixOffered] = useState(false);

  // Rebuilt on every return: a sitting that just finished must be visible on
  // the map the moment the learner lands back on it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadDeck(), loadDrillBank(), loadTopics(), lastSummaryFor(CAFE_LESSON.id)]).then(
        ([deck, bank, topics, lastLesson]) => {
          if (cancelled) return;
          const now = Date.now();
          setUnits(buildPath(deck, bank, topics, { lessonDone: lastLesson !== null }, now));
          setDue(dueCards(deck, now).length);
          setTopics(topics);
          setMixOffered(offersMix(deck, topics, now));
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

  /**
   * Back to the tutor, about this topic.
   *
   * Probed first, the way the lesson row already does, so a server that came up
   * after launch is used. The navigation happens either way because the Convo
   * route is gated: a learner whose servers are down lands on honest words with
   * Check again and Back, rather than on a press that appears to do nothing.
   * The seed is dropped rather than sent empty when the stored title is half
   * written.
   */
  const talkAgain = (node: { id: string }) => {
    const seed = seedTopicFor(node.id, topics);
    void recheck().then(() => nav.navigate('Convo', seed ? { seedTopic: seed } : {}));
  };

  const lessonNode = units?.flatMap((u) => u.nodes).find((n) => n.kind === 'lesson') ?? null;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <Text style={[type.title, { color: paper.ink }]}>Practice</Text>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {mixOffered && (
          <View style={{ marginBottom: space(3) }}>
            {/* Offered only when the due phrases come from more than one topic,
                because below that this is that topic's own sitting wearing a
                bigger name. The rule is in practice/mix.ts. */}
            <OutlineButton
              label={MIX_OFFER.title}
              sub={MIX_OFFER.sub}
              onPress={() => nav.navigate('Drill', { mix: true })}
            />
          </View>
        )}

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
                <PathNodeRow
                  key={node.id}
                  node={node}
                  onPress={() => open(node)}
                  onTalkAgain={() => talkAgain(node)}
                  paused={!focused}
                />
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
          <Text style={[type.bodyStrong, { color: paper.ink }]}>
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

/**
 * This place's light: sky. Practice and its deck share one light.
 * paperFor is how a place asks for its own paper. The house spread in `paper`
 * cannot follow a screen, because StyleSheet.create evaluates once at import,
 * so a screen that wants a different light names it here instead.
 */
const sheet = paperFor('practice');

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: sheet.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(4) },
});
