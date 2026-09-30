/**
 * The landing spot for a reset-email link (web). The recovery session is
 * already signed in; all that is left is choosing the new password.
 *
 * Revamp B (F601): a working title on paper, with no card around the form and
 * no title in the header row, so nothing above the title carries a middot. The
 * one rule is on screen while it is typed, from the same module sign-up reads.
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { GhostButton, PillButton, Field, AlertGlyph, ROW_WORDS } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel } from './busyLabel.ts';
import { passwordHint } from './passwordHint.ts';

export function SetNewPasswordScreen({ onDone }: { onDone: () => void }) {
  const { adapter } = useAuth();
  // A way out that grants nothing. The recovery link signed this device in
  // only to choose a password, so leaving without one signs it out again: the
  // learner lands on sign in, and no reset link becomes a way into the app.
  const [leaving, setLeaving] = useState(false);
  const cancel = async () => {
    if (busy || leaving) return;
    setLeaving(true);
    try {
      await adapter.signOut();
    } catch {
      setLeaving(false);
      setFormMessage('That did not work. Please try again.');
    }
  };
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Two field errors and one banner. The length and the mismatch each belong to
  // a field, and Field is what announces them; a failure from the provider
  // belongs to neither, so it keeps a line of its own.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Recomputed on every keystroke, so the rule is on screen while it is met.
  const hint = passwordHint(password);

  const submit = async () => {
    // The keyboard's return key cannot be greyed out, so the guard is here too.
    if (busy) return;
    const passwordProblem = passwordTooShort(password) ? `Passwords need at least ${PASSWORD_MIN} characters.` : null;
    const confirmProblem = confirm !== password ? 'The two passwords are not the same yet.' : null;
    setPasswordError(passwordProblem);
    setConfirmError(confirmProblem);
    setFormMessage(null);
    if (passwordProblem || confirmProblem) return;
    setBusy(true);
    const result = (await adapter.completePasswordReset?.(password)) ?? {
      ok: false as const,
      message: 'Password reset is not available here.',
    };
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setFormMessage(result.message);
    }
  };

  return (
    <ScrollScreen
      avoidKeyboard
      header={<ScreenHeader title={false} divider={false} />}
      footer={<PillButton label={authButtonLabel('saveNewPassword', busy)} onPress={() => void submit()} disabled={busy} />}
    >
      <View>
        <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>Choose a new password</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          Your reset link worked. Pick the password you will use from now on.
        </Text>
        <View style={{ gap: space(4), marginTop: space(6) }}>
          <View style={{ gap: space(1.5) }}>
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a password"
              secure
              autoComplete="new-password"
              error={passwordError}
              returnKeyType="next"
            />
            {passwordError == null && (
              <Text style={[type.small, { color: hint.met ? paper.ink : paper.inkSoft }]}>{hint.text}</Text>
            )}
          </View>
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Once more"
            secure
            autoComplete="new-password"
            error={confirmError}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {/* A failure from the provider belongs to neither field. In ink, never
            red, with the alert mark the fields carry. */}
        {formMessage != null && (
          <View style={st.message}>
            <View style={st.messageMark}>
              <AlertGlyph size={16} color={paper.ink} />
            </View>
            <Text style={[type.body, ROW_WORDS, { color: paper.ink }]}>{formMessage}</Text>
          </View>
        )}
        <View style={{ marginTop: space(6) }}>
          <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Changed your mind? Your current password still works.</Text>
          <GhostButton
            label={leaving ? 'Signing out…' : 'Cancel and sign out'}
            disabled={leaving}
            onPress={() => void cancel()}
          />
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(4) },
  messageMark: { paddingTop: space(1) },
});
