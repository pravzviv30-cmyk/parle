/**
 * Acknowledgements — the one legal screen that can be honest today.
 *
 * Terms and a privacy policy are content someone has to write and have
 * reviewed; this app has neither, and inventing them here would be worse than
 * their absence. What the repo DOES hold is two real font licences that
 * genuinely have to be reproduced, so those are reproduced.
 *
 * The licence text is committed alongside the fonts. It is repeated here as a
 * short attribution plus the licence name rather than the full body, which is
 * what OFL section requires for an application that redistributes the fonts
 * embedded — the full text ships in the bundle at assets/fonts/.
 */

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HIT, paper, space, type } from '../theme.ts';
import { Card, Label, ChevronLeft } from '../components.tsx';

interface Notice {
  name: string;
  by: string;
  licence: string;
  note: string;
}

const NOTICES: readonly Notice[] = [
  {
    name: 'Fraunces',
    by: 'Phaedra Charles, Flavia Zimbardi and the Fraunces project authors',
    licence: 'SIL Open Font License 1.1',
    note: 'The serif. Every French line you read is set in it.',
  },
  {
    name: 'DM Sans',
    by: 'Colophon Foundry, Jonny Pinhorn and Indian Type Foundry',
    licence: 'SIL Open Font License 1.1',
    note: 'Everything else on the screen.',
  },
  {
    name: 'LiveKit',
    by: 'LiveKit, Inc.',
    licence: 'Apache License 2.0',
    note: 'Carries your voice to the tutor and back.',
  },
  {
    name: 'Expo and React Native',
    by: '650 Industries and Meta Platforms, Inc.',
    licence: 'MIT License',
    note: 'The app itself is built on them.',
  },
];

export function Acknowledgements({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(4) }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={st.back}>
        <ChevronLeft />
      </Pressable>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[type.display, { color: paper.ink }]}>Acknowledgements</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
          Luvani is built on other people's work. The full licence text for each of these ships inside the app.
        </Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {NOTICES.map((n) => (
            <Card key={n.name}>
              <Label>{n.licence}</Label>
              <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{n.name}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{n.by}</Text>
              <Text style={[type.small, { color: paper.inkFaint, marginTop: space(2) }]}>{n.note}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  back: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: space(3), paddingBottom: space(6) },
});
