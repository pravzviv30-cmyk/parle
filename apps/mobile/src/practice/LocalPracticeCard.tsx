import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ColourCard, FrenchBlock, PillButton } from '../components.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { paper, type } from '../theme.ts';
import { localPracticeFor } from './localPractice.ts';

/** Bundled reference audio and a temporary real take, never simulated speech. */
export function LocalPracticeCard() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const phrase = localPracticeFor(profile.tutorVoice, DAILY_ITEMS, TUTOR_DAILY_AUDIO);
  if (phrase === null) return null;
  return <ColourCard ground="sun">
    <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>Order a coffee</Text>
    <FrenchBlock french={phrase.fr ?? ''} english={phrase.en} ground="sun" />
    <Text style={[type.small, { color: paper.ink }]}>Hear, say and compare. Free offline practice. Your recording is temporary and is not graded.</Text>
    <PillButton label="Try this line" tone="ink" onPress={() => nav.navigate('DailyPractice', { id: phrase.id, mode: 'shadowing' })} />
  </ColourCard>;
}
