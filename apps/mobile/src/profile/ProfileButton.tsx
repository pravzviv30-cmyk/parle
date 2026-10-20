/**
 * The way into Profile from a tab header: the learner's initial.
 *
 * Notebook Phase 4 (2026-09-27): the shared `Monogram`, an ink initial on
 * `groundDeep` with no ring. It used to hand-roll its own disc in the old
 * feature green under an ink outline. The Monogram is decorative, so the one
 * name a screen reader hears is this button's own.
 */

import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../app/ProfileContext.tsx';
import { Monogram } from '../components.tsx';
import { HIT } from '../theme.ts';
import { avatarInitial } from './avatar.ts';

export function ProfileButton() {
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const { profile } = useProfile();
  // 2026-10-20, sim nits: the greeting's name source; null draws the person glyph.
  const initial = avatarInitial(profile.name);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile and settings"
      onPress={() => nav.navigate('Profile')}
      style={({ pressed }) => [s.hit, pressed && s.pressed]}
    >
      <Monogram initial={initial} size={HIT} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  hit: { width: HIT, height: HIT, flexShrink: 0 },
  pressed: { opacity: 0.7 },
});
