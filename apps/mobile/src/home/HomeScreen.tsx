/**
 * Home: two doors under one greeting.
 *
 * Speak is the product — the conversation, and the guided lesson beside it.
 * Learn is the echo — practice the tutor authored from what the learner
 * actually said. One primary action per tab.
 *
 * The conversation used to be gated behind one finished lesson. That gate was
 * a deadlock: history is scoped per account, so every account after the first
 * on a device started at zero, and the only way to earn the tutor was the very
 * lesson that was failing. The tutor is now reachable whenever the servers are
 * up — including the mic-free text route, which a learner who cannot speak
 * needs most and could previously never get to at all.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAFE_LESSON } from '@parle/core';
import { paper, space, type, radius, HIT } from '../theme.ts';
import { Card, Label, PillButton, OutlineButton, GhostButton, TabBar } from '../components.tsx';
import { SpeakBubbles, LearnStack } from '../illustrations.tsx';
import { dueCount } from '../review/store.ts';
import { hasGeneratedExercises } from '../drill/store.ts';
import { AccountSheet } from './AccountSheet.tsx';
import type { AuthUser } from '../auth/types.ts';
import type { StoredProfile } from '../profile/store.ts';

export type HomeTab = 'speak' | 'learn';

export function HomeScreen({
  user,
  profile,
  live,
  tab,
  onTab,
  onBegin,
  onConvo,
  onReview,
  onDrill,
  onSignOut,
  onResetProgress,
}: {
  user: AuthUser;
  profile: StoredProfile;
  live: boolean;
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  onBegin: () => void;
  onConvo: (textMode: boolean) => void;
  onReview: () => void;
  onDrill: () => void;
  onSignOut: () => void;
  onResetProgress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const lesson = CAFE_LESSON;
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cards waiting in the review deck. The screen remounts on every return
  // home, so the count stays honest.
  const [due, setDue] = useState(0);
  const [curated, setCurated] = useState(false);
  useEffect(() => {
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
  }, []);

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4), paddingBottom: insets.bottom + space(5) }]}>
      <View style={st.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: paper.ink }]} numberOfLines={1}>
            Bonjour, {firstName}
          </Text>
          {!live && <Label color={paper.inkFaint}>Demo</Label>}
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Account"
          style={({ pressed }) => [st.avatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={[type.heading, { color: paper.onInk }]}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: space(4) }}>
        <TabBar
          tabs={[
            { key: 'speak', label: 'Speak' },
            { key: 'learn', label: 'Learn' },
          ]}
          active={tab}
          onChange={onTab}
        />
      </View>

      {tab === 'speak' ? (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <View style={st.hero}>
            <SpeakBubbles width={190} />
          </View>

          {live ? (
            <>
              <Text style={st.headline}>Ready to talk?</Text>
              <Text style={st.subline}>Your tutor remembers you. Pick a topic and go.</Text>
              <View style={st.actions}>
                <PillButton label="Start a conversation" onPress={() => onConvo(false)} />
                <OutlineButton label="Café lesson" sub="Guided, about five minutes" onPress={onBegin} />
                <GhostButton label="Unable to speak right now?" onPress={() => onConvo(true)} />
              </View>
            </>
          ) : (
            <>
              <Text style={st.headline}>{lesson.title}</Text>
              <Text style={st.subline}>{lesson.premise}</Text>
              <Card style={{ marginTop: space(5) }}>
                <Label>Before you go</Label>
                <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>
                  {lesson.culturalNotes[0]}
                </Text>
              </Card>
              <View style={st.actions}>
                <PillButton label="Start the lesson" onPress={onBegin} />
                <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center', marginTop: space(1) }]}>
                  Running in demo mode. The live tutor needs its servers up.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <View style={st.hero}>
            <LearnStack width={190} />
          </View>

          <Text style={st.headline}>Practice what you said</Text>
          <Text style={st.subline}>
            {curated
              ? 'Fresh exercises, written by your tutor from your own conversations.'
              : 'Your conversations write these. After you talk with your tutor, personal practice lands here. The starter set is ready meanwhile.'}
          </Text>

          {due > 0 && (
            <View style={{ marginTop: space(5) }}>
              <OutlineButton
                label="Review"
                sub={due === 1 ? '1 card is ready' : `${due} cards are ready`}
                onPress={onReview}
              />
            </View>
          )}

          <View style={st.actions}>
            <PillButton label="Start practice" onPress={onDrill} />
          </View>
        </ScrollView>
      )}

      {sheetOpen && (
        <AccountSheet
          user={user}
          onClose={() => setSheetOpen(false)}
          onSignOut={onSignOut}
          onResetProgress={onResetProgress}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  avatar: {
    width: HIT,
    height: HIT,
    borderRadius: radius.pill,
    backgroundColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(2) },
  hero: { alignItems: 'center', marginBottom: space(4) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  actions: { marginTop: 'auto', gap: space(3), paddingTop: space(6) },
});
