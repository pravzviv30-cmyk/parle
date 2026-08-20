/**
 * Home — where the learner sees that they are getting better.
 *
 * The level card, then the evidence, then one way in. What is deliberately NOT
 * here is a streak: PRODUCT.md calls streaks a guilt mechanic implicated in
 * intermediate-plateau churn, and that commitment stands. What replaces it is a
 * ladder whose every input is production — words said, turns composed unaided,
 * phrases resolved, cards recalled — so the number going up always means the
 * learner got better, never that they merely showed up.
 *
 * `buildProgressReport` deliberately says nothing at all without data, so the
 * empty state is not optional: a first-run learner must not meet a rail of
 * zeros telling them they have achieved nothing yet.
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { buildProgressReport, levelFor, type LevelStanding, type ProgressReport } from '@parle/core';
import { accent, paper, space, type, radius, HIT } from '../theme.ts';
import { Card, Label, PillButton, StationLine, Stat } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { loadHistory } from '../progress/store.ts';
import { earnedXp } from '../progress/activity.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useLive } from '../app/LiveContext.tsx';

export function HomeTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { profile } = useProfile();
  const { live } = useLive();

  const [report, setReport] = useState<ProgressReport | null>(null);
  const [standing, setStanding] = useState<LevelStanding | null>(null);

  // Re-read on every return: finishing a sitting anywhere in the app should be
  // visible here the moment the learner comes back to look.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadHistory().then((h) => {
        if (!cancelled) setReport(h.length > 0 ? buildProgressReport(h) : null);
      });
      void earnedXp().then((xp) => {
        if (!cancelled) setStanding(levelFor(xp));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';
  const started = standing !== null && standing.xp > 0;

  return (
    // No bottom inset: the tab bar owns the bottom edge now, and adding it here
    // would double the gap on a notched phone.
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <View style={st.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: paper.ink }]} numberOfLines={1}>
            Bonjour, {firstName}
          </Text>
          {!live && <Label color={paper.inkFaint}>Demo</Label>}
        </View>
        <Pressable
          onPress={() => nav.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          style={({ pressed }) => [st.avatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={[type.heading, { color: paper.onInk }]}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {started && standing ? (
          <>
            <Card>
              <Label>Your level</Label>
              <Text style={[type.title, { color: paper.ink, marginTop: space(2) }]}>{standing.name}</Text>
              <View style={{ marginTop: space(3) }}>
                {/* Six levels is exactly the sequence StationLine already
                    draws, so no new progress primitive is invented for this. */}
                <StationLine total={6} index={standing.index} />
              </View>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>
                {standing.next
                  ? `${standing.next.xpAway} XP to ${standing.next.name}`
                  : 'You have come the whole way along this line.'}
              </Text>
            </Card>

            {report && (
              <View style={{ marginTop: space(6) }}>
                <Label color={paper.inkFaint}>What you have</Label>
                <View style={st.stats}>
                  <Stat value={String(report.wordsKnown.length)} label="Words said" />
                  <Stat value={String(report.sessionCount)} label="Sessions" />
                  <Stat value={`${report.longestTurnEverSec.toFixed(1)}s`} label="Longest turn" />
                  <Stat value={String(standing.xp)} label="XP earned" />
                </View>
              </View>
            )}

            {report && report.headlines.length > 0 && (
              <Card style={{ marginTop: space(6) }}>
                <Label>Since you started</Label>
                <View style={{ marginTop: space(2.5), gap: space(2) }}>
                  {report.headlines.map((h) => (
                    <Text key={h} style={[type.bodyStrong, { color: paper.ink }]}>
                      {h}
                    </Text>
                  ))}
                </View>
              </Card>
            )}
          </>
        ) : (
          <>
            <View style={st.hero}>
              <SpeakBubbles width={170} />
            </View>
            <Text style={st.headline}>Nothing here yet</Text>
            <Text style={st.subline}>
              Talk to your tutor once and this fills with what you said, which sounds held up, and how far along you are.
            </Text>
          </>
        )}

        <View style={st.actions}>
          <PillButton label="Talk to your tutor" onPress={() => nav.navigate('Tutor')} />
        </View>
      </ScrollView>
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
    backgroundColor: accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(3) },
  hero: { alignItems: 'center', marginBottom: space(4) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3), rowGap: space(5), columnGap: space(3) },
  actions: { marginTop: 'auto', paddingTop: space(6) },
});
