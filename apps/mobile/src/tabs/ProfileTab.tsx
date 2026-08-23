/**
 * Profile — who you are, what the app knows, and the ways out.
 *
 * Structure follows the reference screenshots: an ACCOUNT group, a SUPPORT
 * group, sign out, then a legal footer. The visual translation is the whole
 * job — the reference is a dark sheet of full-bleed rows, and this world is
 * pale paper with white cards and hairline rules, so the groups become Cards
 * and the section heads become the one place caps live in this system.
 *
 * A real Delete account is wired through the authenticated token server. The
 * database rows cascade from auth.users and the app clears the device scope
 * before signing out, so the row now means exactly what it says.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accent, paper, signal, space, type, radius, HAIRLINE, HIT } from '../theme.ts';
import { Card, Label, OptionCard, OutlineButton, Field } from '../components.tsx';
import { OnboardClock } from '../illustrations.tsx';
import { SettingsRow } from '../settings/SettingsRow.tsx';
import { Acknowledgements } from '../legal/Acknowledgements.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { TutorIntro } from '../tutor/TutorIntro.tsx';
import { TUTOR_INTRO_LINK } from '../tutor/gate.ts';
import { withDailyGoal } from '../profile/store.ts';
import type { AuthResult } from '../auth/types.ts';

/**
 * How much a day, asked here instead of on the way to a first conversation.
 *
 * It was the fourth onboarding page, which put a preference between a new
 * account and the first French sentence. Nothing in the app reads it yet, so
 * asking it before any value had been delivered was pure friction.
 */
const GOALS = [
  { minutes: 5, label: 'Five minutes', gloss: 'A gentle start' },
  { minutes: 10, label: 'Ten minutes', gloss: 'The steady middle' },
  { minutes: 15, label: 'Fifteen minutes', gloss: 'Serious momentum' },
] as const;

type Sheet = 'none' | 'name' | 'goal' | 'intro' | 'acknowledgements' | 'delete' | 'unavailable';

export function ProfileTab({
  onSignOut,
  onResetProgress,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onResetProgress: () => void;
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [draftName, setDraftName] = useState(profile.name ?? '');
  const [armed, setArmed] = useState(false);
  const [unavailable, setUnavailable] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  const firstName = (profile.name ?? '').split(' ')[0] || 'you';
  // Only an email sign-up has a password to change; Google and the device-local
  // demo account have nothing this screen could edit.
  const hasPassword = user?.provider === 'password';

  if (sheet === 'acknowledgements') return <Acknowledgements onBack={() => setSheet('none')} />;

  // Demoted, not deleted: the intro is still the only place that teaches what
  // the three colours of the circle mean, and it is one tap from here.
  if (sheet === 'intro') return <TutorIntro onDone={() => setSheet('none')} />;

  if (sheet === 'delete') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Text style={[type.display, { color: paper.ink }]}>Delete your account?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
          This permanently removes your sign-in, conversations turned into practice, progress, and remaining minutes. It cannot be undone.
        </Text>
        {hasPassword && (
          <View style={{ marginTop: space(5) }}>
            <Field
              label="Confirm with your password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Your password"
              secure
              autoComplete="current-password"
            />
          </View>
        )}
        {user?.provider === 'google' && (
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(4) }]}>
            Google will ask you to sign in again before anything is deleted.
          </Text>
        )}
        {deleteError && <Text style={[type.bodyStrong, { color: signal.correspondance, marginTop: space(4) }]}>{deleteError}</Text>}
        <View style={{ marginTop: space(7), gap: space(3) }}>
          <OutlineButton
            label={deleting ? 'Verifying…' : 'Verify and delete permanently'}
            disabled={deleting || (hasPassword && deletePassword.length === 0)}
            onPress={() => {
              if (deleting) return;
              setDeleting(true);
              setDeleteError(null);
              void onDeleteAccount(hasPassword ? deletePassword : undefined).then((result) => {
                if (!result.ok) {
                  setDeleteError(result.message);
                  setDeleting(false);
                }
              });
            }}
          />
          <OutlineButton
            label="Keep my account"
            disabled={deleting}
            onPress={() => {
              setDeletePassword('');
              setSheet('none');
            }}
          />
        </View>
      </View>
    );
  }

  if (sheet === 'goal') {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <View style={{ alignItems: 'center', marginBottom: space(5) }}>
          <OnboardClock width={150} />
        </View>
        <Text style={[type.display, { color: paper.ink }]}>How much time each day?</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          Small and daily beats big and rare. Change it whenever you like.
        </Text>
        <View style={{ marginTop: space(6), gap: space(3) }}>
          {GOALS.map((g) => (
            <OptionCard
              key={g.minutes}
              text={g.label}
              gloss={g.gloss}
              selected={profile.dailyGoalMin === g.minutes}
              onPress={() => {
                update(withDailyGoal(profile, g.minutes));
                setSheet('none');
              }}
            />
          ))}
        </View>
        <View style={{ marginTop: space(6) }}>
          <OutlineButton label="Cancel" onPress={() => setSheet('none')} />
        </View>
      </View>
    );
  }

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
          <SettingsRow
            label="Daily goal"
            value={profile.dailyGoalMin === null ? 'Not set' : `${profile.dailyGoalMin} minutes a day`}
            onPress={() => setSheet('goal')}
          />
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
            onPress={() => setSheet('delete')}
          />
        </Card>

        <View style={{ marginTop: space(6) }}>
          <Label>Support</Label>
          <Card style={{ marginTop: space(2.5) }}>
            <SettingsRow first label={TUTOR_INTRO_LINK} onPress={() => setSheet('intro')} />
            <SettingsRow
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
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>
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
            Terms and a privacy policy are not written yet. Parle records your email, your name, and that you said you are
            old enough, then sends what you say to speech and language services so the tutor can answer. If you joined
            when Parle asked for a date of birth, that date is still on file and is still yours. Nothing is shared with
            anyone else.
          </Text>
        </View>

        {sheet === 'unavailable' && (
          <Card style={{ marginTop: space(5) }}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{unavailable}</Text>
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
    borderColor: accent.primary,
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
