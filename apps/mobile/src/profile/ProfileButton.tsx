import { Pressable, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../app/ProfileContext.tsx';
import { paper, accent, HIT, HAIRLINE, type } from '../theme.ts';

export function ProfileButton() {
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { profile } = useProfile();
  return <Pressable accessibilityRole="button" accessibilityLabel="Open profile and settings" onPress={() => nav.navigate('Profile')} style={({ pressed }) => [s.avatar, pressed && { opacity: 0.7 }]}>
    <Text style={[type.bodyStrong, { color: paper.ink }]}>{Array.from(profile.name?.trim() || 'You')[0]!.toLocaleUpperCase()}</Text>
  </Pressable>;
}
const s = StyleSheet.create({ avatar: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', borderWidth: HAIRLINE, borderColor: paper.ink, backgroundColor: accent.feature, flexShrink: 0 } });
