/**
 * What the tutor is, said once.
 *
 * Four pages, in the onboarding idiom so it feels like the same app rather
 * than a bolted-on tour: the same ProgressDots, the same back chevron, the same
 * one-question-per-page rhythm.
 *
 * Deliberately NOT appended to onboarding. An explainer read four screens
 * before the thing it explains is a leaflet; read at the door of the tutor, it
 * is instructions. It also names the three controls the conversation actually
 * renders — Help me out, Slower, In English — so it teaches the real UI rather
 * than a general idea of one.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HIT, paper, space, type } from '../theme.ts';
import { ChevronLeft, ProgressDots, PillButton, Card } from '../components.tsx';
import { SpeakBubbles, OnboardWave, RecapPostcard } from '../illustrations.tsx';
import { VoiceOrb, type OrbState } from './VoiceOrb.tsx';
import { TUTOR_NAME } from './tutorName.ts';

/**
 * The final page's lesson: the circle speaks traffic lights. Three live mini
 * orbs, each in one state, each with the sentence that state means. The same
 * component the conversation renders, so this page can never drift from the
 * real thing.
 */
function OrbWalkthrough() {
  const rows: { state: OrbState; title: string; sub: string }[] = [
    { state: 'speaking', title: `Red, ${TUTOR_NAME} is talking`, sub: 'Just listen.' },
    { state: 'listening', title: 'Green, your turn', sub: 'Say it out loud.' },
    { state: 'thinking', title: 'Amber, it is thinking', sub: 'One moment.' },
  ];
  return (
    <View style={{ gap: space(3), alignSelf: 'stretch', marginTop: space(5) }}>
      {rows.map((row) => (
        <Card key={row.state} style={{ paddingVertical: space(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
            <VoiceOrb state={row.state} size={56} withCaption={false} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.title}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{row.sub}</Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

const PAGES = [
  {
    key: 'what',
    art: SpeakBubbles,
    title: `You'll be talking to ${TUTOR_NAME}`,
    body: `Not a quiz. ${TUTOR_NAME} is from Lyon, he ran a bar there for twenty years, and he is not a teacher. He asks about your day, waits while you find the French, and answers what you actually said.`,
    note: null,
  },
  {
    key: 'stuck',
    art: OnboardWave,
    title: 'Getting stuck is planned for',
    body: 'You always get the first attempt. If you get stuck, a small English hint appears without interrupting the scene. The answer stays hidden unless you ask again.',
    note: `Help me out reveals a hint. Slower keeps ${TUTOR_NAME} slow. In English tells you what he just said.`,
  },
  {
    key: 'after',
    art: RecapPostcard,
    title: 'Afterwards it remembers',
    body: 'At the end you get the phrases you used and one sound to work on. Tomorrow your practice is written from what you said today.',
    note: null,
  },
  {
    key: 'orb',
    art: null,
    title: 'The circle runs the room',
    body: 'One circle tells you whose turn it is, in traffic lights. You never have to guess.',
    note: null,
  },
] as const;

export function TutorIntro({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const page = PAGES[index]!;
  const Art = page.art;
  const last = index === PAGES.length - 1;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.topRow}>
        {index > 0 ? (
          <Pressable
            onPress={() => setIndex((i) => i - 1)}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={st.back}
          >
            <ChevronLeft />
          </Pressable>
        ) : (
          <View style={st.back} />
        )}
        <ProgressDots total={PAGES.length} index={index} />
        <View style={st.back} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {Art ? (
          <View style={st.art}>
            <Art width={170} />
          </View>
        ) : null}
        <Text style={st.title}>{page.title}</Text>
        <Text style={st.body}>{page.body}</Text>
        {page.key === 'orb' ? <OrbWalkthrough /> : null}
        {page.note ? (
          <Card style={{ marginTop: space(5) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{page.note}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <PillButton label={last ? 'Start talking' : 'Next'} onPress={() => (last ? onDone() : setIndex((i) => i + 1))} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  art: { alignItems: 'center', marginBottom: space(5) },
  title: { ...type.display, color: paper.ink, textAlign: 'center' },
  body: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
});
