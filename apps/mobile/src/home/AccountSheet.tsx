/**
 * The account sheet: who is signed in, the way out, and the one destructive
 * act — kept behind a press-again confirmation rather than a system alert so
 * it works identically on web.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, OutlineButton, GhostButton } from '../components.tsx';
import type { AuthUser } from '../auth/types.ts';

export function AccountSheet({
  user,
  onClose,
  onSignOut,
  onResetProgress,
}: {
  user: AuthUser;
  onClose: () => void;
  onSignOut: () => void;
  onResetProgress: () => void;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <View style={st.backdropWrap}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Close account sheet" />
      <Card style={st.sheet}>
        <Label>Account</Label>
        <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(1) }]}>
          {user.email ?? 'Signed in'}
        </Text>
        {user.provider === 'mock' && (
          <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>
            Demo account, stored on this device only.
          </Text>
        )}

        <View style={st.divider} />

        <OutlineButton label="Sign out" onPress={onSignOut} />

        <Pressable
          onPress={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            onResetProgress();
          }}
          accessibilityRole="button"
          accessibilityLabel={armed ? 'Press again to erase progress' : 'Reset progress'}
          style={({ pressed }) => [st.reset, armed && st.resetArmed, pressed && { opacity: 0.7 }]}
        >
          <Text style={[type.bodyStrong, { color: armed ? paper.onInk : signal.correspondance }]}>
            {armed ? 'Press again to erase everything' : 'Reset progress'}
          </Text>
          {!armed && (
            <Text style={[type.small, { color: paper.inkFaint, marginTop: 2 }]}>
              Erases lessons, phrases and the tutor's memory of you.
            </Text>
          )}
        </Pressable>

        <GhostButton label="Close" onPress={onClose} color={paper.ink} />
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  backdropWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26,20,30,0.45)' },
  sheet: {
    marginHorizontal: space(3),
    marginBottom: space(6),
    gap: space(3),
  },
  divider: { height: HAIRLINE, backgroundColor: paper.lineOnCard, marginVertical: space(2) },
  reset: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2.5),
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
  },
  resetArmed: { backgroundColor: signal.correspondance },
});
