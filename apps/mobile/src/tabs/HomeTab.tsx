/**
 * Home — where the learner sees that they are getting better.
 *
 * Phase 2 shape: the greeting, the evidence the app already has, and one way
 * in. The XP ladder and the level card land here next and will sit between the
 * greeting and the stats; nothing else on this screen has to move for that.
 *
 * `buildProgressReport` deliberately says nothing at all without data, so the
 * empty state is not optional — a first-run learner must not meet a rail of
 * zeros telling them they have achieved nothing.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { buildProgressReport, type ProgressReport } from '@parle/core';
import { paper, space, type, radius, HIT } from '../theme.ts';
import { Card, Label, PillButton } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { loadHistory } from '../progress/store.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useLive } from '../app/LiveContext.tsx';

export function HomeTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { profile } = useProfile();
  const { live } = useLive();

  const [report, setReport] = useState<ProgressReport | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadHistory().then((h) => {
      if (!cancelled) setReport(h.length > 0 ? buildProgressReport(h) : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';

  return (
    // No bottom inset: the tab bar owns the bottom edge now and adding it here
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
        <View style={st.hero}>
          <SpeakBubbles width={170} />
        </View>

        {report && report.headlines.length > 0 ? (
          <>
            <Text style={st.headline}>Since you started</Text>
            <Card style={{ marginTop: space(4) }}>
              <View style={{ gap: space(2) }}>
                {report.headlines.map((h) => (
                  <Text key={h} style={[type.bodyStrong, { color: paper.ink }]}>
                    {h}
                  </Text>
                ))}
              </View>
            </Card>
          </>
        ) : (
          <>
            <Text style={st.headline}>Nothing here yet</Text>
            <Text style={st.subline}>
              Talk to your tutor once and this fills with what you said, which sounds held up, and what to try next.
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
    backgroundColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(3) },
  hero: { alignItems: 'center', marginBottom: space(4) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  actions: { marginTop: 'auto', paddingTop: space(6) },
});
