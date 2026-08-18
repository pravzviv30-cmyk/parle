/**
 * Tutor — the door to free conversation.
 *
 * Phase 2 shape: the invitation and the two ways in. The voice orb and the
 * transcript replace this screen's body next; the two routes out of it
 * (spoken, typed) stay exactly as they are.
 *
 * Both are always offered. The typed route in particular used to sit behind a
 * gate that a learner who cannot speak could never pass, which is precisely
 * backwards — it is the one they need most.
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton, Card, Label } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { useLive } from '../app/LiveContext.tsx';

export function TutorTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();

  const open = (textMode: boolean) => {
    // Probe again at the moment of starting, so a server that came up after
    // launch is used and one that just died is not.
    void recheck().then(() => nav.navigate('Convo', { textMode }));
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <SpeakBubbles width={190} />
        </View>

        <Text style={st.headline}>Ready to talk?</Text>
        <Text style={st.subline}>Your tutor remembers you. Pick a topic and go.</Text>

        {!live && (
          <Card style={{ marginTop: space(5) }}>
            <Label>Demo mode</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>
              The live tutor needs its servers up. Practice still works.
            </Text>
          </Card>
        )}

        <View style={st.actions}>
          <PillButton label="Start a conversation" onPress={() => open(false)} />
          <GhostButton label="Unable to speak right now?" onPress={() => open(true)} />
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
  actions: { marginTop: 'auto', gap: space(3), paddingTop: space(6) },
});
