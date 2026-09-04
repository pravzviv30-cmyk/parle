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
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { buildPath, CAFE_LESSON, phraseKeyOf, type ConversationPack, type PathUnit, type PracticeTopic } from '@luvani/core';
import { paper, space, type } from '../theme.ts';
import { Card, Label, OutlineButton, GhostButton, PillButton } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { PathNodeRow } from '../practice/PathNodeRow.tsx';
import { MIX_OFFER, offersMix } from '../practice/mix.ts';
import { NEXT_STEP, nextStep, reviewLine, type NextStep } from '../practice/nextStep.ts';
import { statusLine } from '../practice/statusLine.ts';
import { seedTopicFor } from '../practice/talkAgain.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import { loadTopics } from '../topics/store.ts';
import { lastSummaryFor } from '../progress/store.ts';
import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { loadConversationPacks, refreshConversationPacks } from '../conversationPacks/store.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { TUTOR_OFFLINE } from '../tutor/gate.ts';

export function PracticeTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { recheck } = useLive();
  const { user, adapter } = useAuth();
  const { profile } = useProfile();
  const tutorName = tutorNameOf(profile);

  // The locked row draws a pen that keeps moving. It has no reason to keep
  // moving while the learner is on another tab, and the scene cannot ask
  // this for itself: useIsFocused throws outside a NavigationContainer, and
  // five of the places that render a scene mount above the navigator.
  const focused = useIsFocused();
  const [units, setUnits] = useState<PathUnit[] | null>(null);
  // What to do now, answered whole by practice/nextStep.ts: a due deck, the row
  // the path already marked next, or nothing at all. The tab draws it and works
  // out none of it, so due is never counted twice with two chances to disagree.
  const [step, setStep] = useState<NextStep | null>(null);
  // Kept rather than thrown away after buildPath: a topic row's second door
  // needs the topic's own title in both languages to seed a conversation with.
  const [topics, setTopics] = useState<PracticeTopic[]>([]);
  const [packs, setPacks] = useState<ConversationPack[]>([]);
  // Recomputed on every focus alongside everything else, which is the whole of
  // the daily refresh: the offer answers to today's due state, not to a clock.
  const [mixOffered, setMixOffered] = useState(false);
  // A probe is in flight. Both doors below run one before they navigate, and
  // both used to fire it with no flag at all: the tap did nothing visible for
  // up to a second and a half, and a second tap queued a second navigation.
  // TutorTab already carried this guard and this word for it.
  const [checking, setChecking] = useState(false);

  // Rebuilt on every return: a sitting that just finished must be visible on
  // the map the moment the learner lands back on it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadDeck(), loadDrillBank(), loadTopics(), lastSummaryFor(CAFE_LESSON.id)]).then(
        ([deck, bank, topics, lastLesson]) => {
          if (cancelled) return;
          const now = Date.now();
          const units = buildPath(deck, bank, topics, { lessonDone: lastLesson !== null }, now);
          setUnits(units);
          setStep(nextStep(units, deck, now));
          setTopics(topics);
          setMixOffered(offersMix(deck, topics, now));
        },
      );
      // Draw the cache at once, then quietly replace it with the server-owned
      // truth. A closed app can miss the original live delivery, so this pull
      // is the recovery path rather than a decorative refresh.
      void loadConversationPacks().then((stored) => {
        if (!cancelled) setPacks(stored);
      });
      if (user) {
        void refreshConversationPacks(user, adapter).then((result) => {
          if (!cancelled && result.ok) setPacks(result.packs);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [user, adapter]),
  );

  const open = (node: { id: string; kind: string; title: string; phraseKeys: readonly string[] }, textMode = false) => {
    if (node.kind === 'lesson') {
      // One probe in flight is enough; two would open two lessons.
      if (checking) return;
      setChecking(true);
      // Either way, the same way: the Lesson route is gated, so a learner whose
      // servers are down lands on honest words rather than on a tap that
      // appeared to do nothing. `go` is passed twice so a probe that ever threw
      // still lets go of the flag instead of retiring the tab.
      const go = () => {
        setChecking(false);
        nav.navigate('Lesson', textMode ? { textMode: true } : undefined);
      };
      void recheck().then(go, go);
      return;
    }
    // A drill is local. Nothing to probe, so nothing to wait for.
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
    if (checking) return;
    const seed = seedTopicFor(node.id, topics);
    setChecking(true);
    const go = () => {
      setChecking(false);
      nav.navigate('Convo', seed ? { seedTopic: seed } : {});
    };
    void recheck().then(go, go);
  };

  const continuePack = (pack: ConversationPack) => {
    if (checking) return;
    setChecking(true);
    const go = () => {
      setChecking(false);
      nav.navigate('Convo', { seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn } });
    };
    void recheck().then(go, go);
  };

  const practisePack = (pack: ConversationPack) => {
    nav.navigate('Drill', {
      node: {
        id: pack.id,
        title: pack.title.en,
        phraseKeys: pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)),
      },
    });
  };

  const lessonNode = units?.flatMap((u) => u.nodes).find((n) => n.kind === 'lesson') ?? null;
  const latestPack = latestReadyPack(packs);
  const pendingPack = packs.find((pack) => pack.state === 'generating') ?? null;

  return (
    <ScrollScreen
      bottom="tab"
      // The frame header keeps only the F154 checking receipt, so a tap that
      // has to wait on the network stays acknowledged when the title scrolls
      // away. The gate's own word, so the tab and the tutor card do not grow
      // two vocabularies for the same second and a half.
      header={checking && (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}
        >
          {TUTOR_OFFLINE.checking}
        </Text>
      )}
    >
      <View style={st.scroll}>
        <TabHeader
          title="Practice"
          purpose="Short drills from the lesson, and from your own conversations."
        />

        {latestPack && (
          <View style={{ marginBottom: space(6) }}>
            <Label>Continue conversation</Label>
            <Card style={{ marginTop: space(3) }}>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{latestPack.title.en}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{latestPack.summary}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Ready: {latestPack.keyPhrases.length} phrases</Text>
              <View style={{ marginTop: space(3), gap: space(2) }}>
                <OutlineButton label="Continue talking" disabled={checking} onPress={() => continuePack(latestPack)} />
                <OutlineButton label="Review phrases" onPress={() => practisePack(latestPack)} />
              </View>
            </Card>
          </View>
        )}

        {pendingPack && !latestPack && (
          <View style={{ marginBottom: space(6) }}>
            <Card>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>Your conversation is becoming practice.</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Come back in a moment. Your French is safely on its way here.</Text>
            </Card>
          </View>
        )}

        {/* The one thing to do now, decided in practice/nextStep.ts and drawn
            here as a door. A review step opens the deck; a node step opens
            through the very handler the path's heavy-ruled row uses, so it is
            never a second primary, only a shortcut to the same place. When the
            deck is quiet and the path is done there is no step, and this draws
            nothing rather than a cheerful message for a learner who is done. */}
        {step !== null && (
          <View style={{ marginBottom: space(6) }}>
            <Label>{NEXT_STEP.label}</Label>
            <View style={{ marginTop: space(3) }}>
              {/* The tab's one pill (F365). The line under it is the same line
                  the OutlineButton used to carry as its sub. */}
              {step.kind === 'review' ? (
                <View>
                  <PillButton label={NEXT_STEP.review} onPress={() => nav.navigate('Review')} />
                  <Text style={st.stepSub}>{reviewLine(step.due)}</Text>
                </View>
              ) : (
                <View>
                  <PillButton label={step.node.title} disabled={checking} onPress={() => open(step.node)} />
                  <Text style={st.stepSub}>{statusLine(step.node, tutorName)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {mixOffered && (
          <View style={{ marginBottom: space(6) }}>
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
              disabled={checking}
              onPress={() => open(lessonNode, true)}
            />
          </View>
        )}

        <Card>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>Practice from your conversations</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>
            Your tutor turns useful moments from free conversation into short, focused practice here.
          </Text>
        </Card>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  stepSub: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
});
