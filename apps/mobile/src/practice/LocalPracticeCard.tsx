import { Illustration } from '../art/flat/Illustration.tsx';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, ColourCard, FrenchBlock, PillButton } from '../components.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { decorative, space, type } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { localPracticeFor } from './localPractice.ts';

/** Bundled reference audio and a temporary real take, never simulated speech. */
export function LocalPracticeCard({ vivid = false }: { vivid?: boolean }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  // 2026-10-21 UI-008: theme tokens. The white card follows the mode; the sun
  // ground is sun in both modes, so its words take onMint, the ink of both.
  const t = useB();
  const phrase = localPracticeFor(profile.tutorVoice, DAILY_ITEMS, TUTOR_DAILY_AUDIO);
  if (phrase === null) return null;
  if (vivid) return <View style={{ gap: space(4) }}>
    <View {...decorative} style={{ alignItems: 'center' }}><Illustration name="place-cafe-counter" style={{ width: '100%', height: space(47.5) }} /></View>
    <Card style={{ gap: space(1) }}><Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>At the café</Text><Text style={[type.small, { color: t.muted }]}>Hear and try your first order. Free offline.</Text></Card>
    <PillButton label="Try this line" onPress={() => nav.navigate('DailyPractice', { id: phrase.id, mode: 'shadowing' })} />
  </View>;
  return <ColourCard ground="sun">
    <Text accessibilityRole="header" style={[type.heading, { color: t.onMint }]}>Order a coffee</Text>
    <FrenchBlock french={phrase.fr ?? ''} english={phrase.en} ground="sun" />
    <Text style={[type.small, { color: t.onMint }]}>Hear, say and compare. Free offline practice. Your recording is temporary and is not graded.</Text>
    <PillButton label="Try this line" tone="ink" onPress={() => nav.navigate('DailyPractice', { id: phrase.id, mode: 'shadowing' })} />
  </ColourCard>;
}
