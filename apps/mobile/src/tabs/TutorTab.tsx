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

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton, OutlineButton, Card, Label } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { TUTOR_OFFLINE, tutorGate } from '../tutor/gate.ts';
import { hasSeenTutorIntro, markTutorIntroSeen } from '../tutor/store.ts';

export function TutorTab() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { live, recheck } = useLive();

  // Read here rather than at the app root: the flag only matters to this tab,
  // and gating higher would flash the bottom nav and hold up Home for a disk
  // read that nothing else is waiting on.
  const [seenIntro, setSeenIntro] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void hasSeenTutorIntro().then((seen) => {
      if (!cancelled) setSeenIntro(seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The start that was asked for and did not happen, route included. The Demo
  // mode card is already on the screen saying why; this is what turns it from a
  // note into an answer, with the way forward attached. It holds the attempt
  // rather than a flag because Check again has to be the SAME start: a learner
  // who tapped the quiet door and is retrying from a train must not be dropped
  // into a voice session for waiting.
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  const open = (textMode: boolean) => {
    // Probe again at the moment of starting, so a server that came up after
    // launch is used and one that just died is not. The answer decides: this
    // used to navigate either way, which walked a learner the app had just told
    // "Demo mode" into a live screen whose only control is Back.
    if (checking) return; // One probe in flight is enough; two would open two rooms.
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, textMode);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      nav.navigate(decision.screen, decision.params);
    });
  };

  if (seenIntro === null) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkFaint} />
      </View>
    );
  }
  if (!seenIntro) {
    return (
      <TutorIntro
        onDone={() => {
          void markTutorIntroSeen();
          setSeenIntro(true);
          // The button says "Start talking", so it starts talking. Landing on
          // this tab's idle screen instead was a promise the app didn't keep.
          open(false);
        }}
      />
    );
  }

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <SpeakBubbles width={190} />
        </View>

        <Text style={st.headline}>Ready to talk?</Text>
        <Text style={st.subline}>Your tutor remembers you. Come ready to chat about anything.</Text>

        {!live && (
          <Card style={{ marginTop: space(5) }}>
            <Label>{TUTOR_OFFLINE.label}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{TUTOR_OFFLINE.headline}</Text>
            {heldBack !== null && (
              <>
                <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{TUTOR_OFFLINE.body}</Text>
                <View style={{ marginTop: space(3) }}>
                  {/* Secondary on purpose: the pill below is still this
                      screen's one primary action, and this is the door back to
                      it rather than a second front door. It retries the route
                      the learner picked, not the one this tab prefers. */}
                  <OutlineButton
                    label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
                    disabled={checking}
                    onPress={() => open(heldBack.textMode)}
                  />
                </View>
              </>
            )}
          </Card>
        )}

        <View style={st.actions}>
          <PillButton label="Start a conversation" onPress={() => open(false)} disabled={checking} />
          <GhostButton label="Unable to speak right now?" onPress={() => open(true)} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingTop: space(5), paddingBottom: space(3) },
  hero: { alignItems: 'center', marginBottom: space(4) },
  headline: { ...type.display, color: paper.ink, textAlign: 'center' },
  subline: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  actions: { marginTop: 'auto', gap: space(3), paddingTop: space(6) },
});
