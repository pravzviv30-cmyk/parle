/**
 * Profile — who you are, and the two ways out.
 *
 * The account sheet became a screen. Same press-again arming for the
 * destructive act, chosen over a system alert so it behaves identically on
 * web, and still no numbers or scolding anywhere.
 *
 * The account-info rows, the editable username, the password row and Delete
 * account arrive with the backend that can enforce them. Showing an editable
 * username now, against a device-local store that cannot make it unique, would
 * be a promise the app cannot keep.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, OutlineButton } from '../components.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';

export function ProfileTab({ onSignOut, onResetProgress }: { onSignOut: () => void; onResetProgress: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [armed, setArmed] = useState(false);

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.identity}>
          <View style={st.ring}>
            <Text style={[type.title, { color: paper.ink }]}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[type.title, { color: paper.ink, marginTop: space(3) }]}>{profile.name ?? 'You'}</Text>
        </View>

        <Card>
          <Label>Account</Label>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{user?.email ?? 'Signed in'}</Text>
          {user?.provider === 'mock' && (
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(1) }]}>
              Demo account, stored on this device only.
            </Text>
          )}
          {user?.provider === 'google' && (
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(1) }]}>Signed in with Google.</Text>
          )}
        </Card>

        <View style={{ marginTop: space(5) }}>
          <OutlineButton label="Sign out" onPress={onSignOut} />
        </View>

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
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(4), paddingBottom: space(3) },
  identity: { alignItems: 'center', marginBottom: space(6) },
  ring: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: {
    minHeight: HIT,
    marginTop: space(3),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    borderWidth: HAIRLINE,
    borderColor: 'transparent',
  },
  resetArmed: { backgroundColor: signal.correspondance },
});
