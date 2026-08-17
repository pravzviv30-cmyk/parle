/**
 * The front door. One illustration, one promise, one primary action.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type } from '../theme.ts';
import { PillButton, GhostButton } from '../components.tsx';
import { HeroCafe } from '../illustrations.tsx';

export function WelcomeScreen({ onCreateAccount, onSignIn }: { onCreateAccount: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.root, { paddingTop: insets.top + space(10), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.hero}>
        <HeroCafe width={230} />
        <Text style={[type.display, { color: paper.ink, textAlign: 'center', marginTop: space(6) }]}>
          Speak French from day one
        </Text>
        <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(3) }]}>
          A tutor that talks with you, steps in when you stall, and never makes you feel silly.
        </Text>
      </View>

      <View style={{ gap: space(3) }}>
        <PillButton label="Create account" onPress={onCreateAccount} />
        <GhostButton label="I already have an account" onPress={onSignIn} color={paper.ink} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: paper.ground,
    paddingHorizontal: space(6),
    justifyContent: 'space-between',
    gap: space(8),
  },
  hero: { alignItems: 'center', paddingHorizontal: space(2) },
});
