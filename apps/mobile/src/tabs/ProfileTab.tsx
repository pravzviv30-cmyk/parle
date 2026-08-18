/**
 * Profile — who you are, what the app knows, and the ways out.
 *
 * Structure follows the reference screenshots: an ACCOUNT group, a SUPPORT
 * group, sign out, then a legal footer. The visual translation is the whole
 * job — the reference is a dark sheet of full-bleed rows, and this world is
 * pale paper with white cards and hairline rules, so the groups become Cards
 * and the section heads become the one place caps live in this system.
 *
 * What is deliberately NOT here, and why: a username, an editable-once-a-
 * fortnight rule, and a real Delete account. All three need a server to be
 * true. There is no database anywhere in this repo, identity is a device-local
 * id, and a username this app cannot make unique is not a username. Showing
 * those rows now would be promising something the app cannot keep, so they
 * arrive with the backend that can enforce them and the screen says so.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, OutlineButton, Field } from '../components.tsx';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { Acknowledgements } from '../legal/Acknowledgements.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';

type Sheet = 'none' | 'name' | 'acknowledgements' | 'unavailable';

export function ProfileTab({ onSignOut, onResetProgress }: { onSignOut: () => void; onResetProgress: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [draftName, setDraftName] = useState(profile.name ?? '');
  const [armed, setArmed] = useState(false);
  const [unavailable, setUnavailable] = useState('');

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';
  // Only an email sign-up has a password to change; Google and the device-local
  // demo account have nothing this screen could edit.
  const hasPassword = user?.provider === 'password';

  if (sheet === 'acknowledgements') return <Acknowledgements onBack={() => setSheet('none')} />;

  if (sheet === 'name') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>Your name</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          What your tutor calls you at the start of a session.
        </Text>
        <View style={{ marginTop: space(6) }}>
          <Field label="Your name" value={draftName} onChangeText={setDraftName} placeholder="Your name" />
        </View>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          <OutlineButton
            label="Save"
            onPress={() => {
              const next = draftName.trim();
              if (next.length > 0) update({ ...profile, name: next });
              setSheet('none');
            }}
          />
          <OutlineButton label="Cancel" onPress={() => { setDraftName(profile.name ?? ''); setSheet('none'); }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4) }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <View style={st.identity}>
          <View style={st.ring}>
            <Text style={[type.title, { color: paper.ink }]}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[type.title, { color: paper.ink, marginTop: space(3) }]}>{profile.name ?? 'You'}</Text>
        </View>

        <Label>Account</Label>
        <Card style={{ marginTop: space(2.5) }}>
          <SettingsRow first label="Name" value={profile.name ?? 'Not set'} onPress={() => setSheet('name')} />
          <SettingsRow label="Email" value={user?.email ?? 'Signed in'} />
          {hasPassword && (
            <SettingsRow
              label="Password"
              value="Change it"
              onPress={() => {
                setUnavailable('Changing your password needs the account server, which is not running yet.');
                setSheet('unavailable');
              }}
            />
          )}
          {user?.provider === 'google' && <SettingsRow label="Signed in with" value="Google" />}
          {user?.provider === 'mock' && <SettingsRow label="Account" value="Demo, stored on this device only" />}
          <SettingsRow
            label="Delete account"
            destructive
            onPress={() => {
              setUnavailable(
                'Deleting an account has to happen on the server that holds it, and Parle does not have one yet. Reset progress below erases everything this device knows about you.',
              );
              setSheet('unavailable');
            }}
          />
        </Card>

        <View style={{ marginTop: space(6) }}>
          <Label>Support</Label>
          <Card style={{ marginTop: space(2.5) }}>
            <SettingsRow
              first
              label="Help"
              onPress={() => {
                setUnavailable('There is no help centre yet. When there is, this is where it will be.');
                setSheet('unavailable');
              }}
            />
            <SettingsRow
              label="Send feedback"
              onPress={() => {
                setUnavailable('Feedback needs somewhere to go. Add an address and this will send there.');
                setSheet('unavailable');
              }}
            />
          </Card>
        </View>

        <View style={{ marginTop: space(6) }}>
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

        {/* The legal footer. Terms and a privacy policy are content someone has
            to write and have reviewed; the app has neither, and inventing them
            would be worse than their absence. Acknowledgements is real today. */}
        <View style={st.legal}>
          <Pressable
            onPress={() => setSheet('acknowledgements')}
            accessibilityRole="button"
            style={({ pressed }) => [st.legalItem, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.label, { color: paper.inkSoft }]}>Acknowledgements</Text>
          </Pressable>
          <Text style={[type.small, { color: paper.inkFaint, marginTop: space(3) }]}>
            Terms and a privacy policy are not written yet. Parle records your email, your name, your date of birth, and
            sends what you say to speech and language services so the tutor can answer. Nothing is shared with anyone else.
          </Text>
        </View>

        {sheet === 'unavailable' && (
          <Card style={{ marginTop: space(5) }}>
            <Label>Not yet</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{unavailable}</Text>
            <View style={{ marginTop: space(3) }}>
              <OutlineButton label="Close" onPress={() => setSheet('none')} />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  scroll: { flexGrow: 1, paddingTop: space(4), paddingBottom: space(6) },
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
  legal: { marginTop: space(8), alignItems: 'center' },
  legalItem: { minHeight: HIT, justifyContent: 'center' },
});
