/**
 * The age gate's full stop, and the one door off it.
 *
 * The gate has two surfaces — the first-run flow and the return gate — and a
 * refused learner has to meet the same thing on both: the plain refusal, spoken,
 * and a way out that is not a way past. So this is one component rather than two
 * bare `Text` blocks that drift, and it is deliberately the only place either
 * surface draws the refusal.
 *
 * The refusal is announced the way `Field` announces an error: `role` alert and
 * a polite live region cover Android and the web, and iOS, which has neither, is
 * told out loud on mount. A child who cannot see the screen still hears why they
 * have stopped.
 *
 * The exit is a `GhostButton`, never a pill. The account was created before the
 * gate, so a refused learner is signed in on a page with nothing behind it; the
 * one honest action is to sign back out, and a solid pill under a refusal reads
 * as a second chance the boundary is not offering. `auth.signOut()` is the door,
 * threaded in from `App.tsx` — nothing is persisted on the first-run gate, and on
 * the return gate the stop stands and the gate re-shows on the next sign-in.
 */

import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { GhostButton } from '../components.tsx';
import { AGE_REFUSAL_EXIT } from './answers.ts';

export function AgeRefusal({ text, onSignOut }: { text: string; onSignOut: () => void }) {
  // Spoken on mount for VoiceOver, which has neither the live region nor the
  // alert role the other two platforms read. The trio matches Field's, on
  // purpose: one way of announcing a message the eye cannot see change.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(text);
  }, [text]);

  return (
    <View style={st.wrap}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={st.refusal}>
        {text}
      </Text>
      <View style={st.exit}>
        <GhostButton label={AGE_REFUSAL_EXIT} onPress={onSignOut} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginTop: space(5) },
  refusal: { ...type.bodyStrong, color: paper.ink, textAlign: 'center' },
  exit: { marginTop: space(4) },
});
