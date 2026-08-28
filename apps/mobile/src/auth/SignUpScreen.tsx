/**
 * Create an account: email, password, or the Google door.
 * Errors are plain sentences under the field they belong to.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, signal, HIT } from '../theme.ts';
import { PillButton, OutlineButton, Field, ChevronLeft, GoogleMark } from '../components.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail, PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { passwordHint } from './passwordHint.ts';

export function SignUpScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const { adapter } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  // One flag, naming the request that is running: everything greys, and only
  // the button that started it changes its words.
  const [pending, setPending] = useState<AuthAction | null>(null);
  const busy = pending !== null;
  // Recomputed on every keystroke, which is the point: the rule is on screen
  // while it is being met, not only after it has been broken.
  const hint = passwordHint(password);

  const submit = async () => {
    // The keyboard's return key cannot be greyed out, so the guard is here too.
    if (busy) return;
    const emailProblem = looksLikeEmail(email) ? null : 'That does not look like an email address.';
    const passwordProblem = passwordTooShort(password) ? `Passwords need at least ${PASSWORD_MIN} characters.` : null;
    const confirmProblem = confirm === password ? null : 'The two passwords are not the same yet.';
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    setConfirmError(confirmProblem);
    setFormMessage(null);
    if (emailProblem || passwordProblem || confirmProblem) return;
    setPending('createAccount');
    const result = await adapter.signUpWithPassword(email.trim(), password);
    setPending(null);
    if (result.ok) {
      // Signed straight in unless the project requires email confirmation;
      // either way the message says what happens next.
      if (result.message) {
        setFormOk(true);
        setFormMessage(result.message);
      }
    } else {
      setFormOk(false);
      setFormMessage(result.message);
    }
  };

  const google = async () => {
    if (busy) return;
    setPending('google');
    const result = await adapter.signInWithGoogle();
    setPending(null);
    if (!result.ok) {
      setFormOk(false);
      setFormMessage(result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView
        style={{ backgroundColor: paper.ground }}
        contentContainerStyle={[st.root, { paddingTop: insets.top + space(4), paddingBottom: insets.bottom + space(6) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={st.back}>
          <ChevronLeft />
        </Pressable>

        <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Create your account</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
          Your progress, your phrases, and your tutor's memory live here.
        </Text>

        <View style={{ gap: space(4), marginTop: space(6) }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            error={emailError}
            returnKeyType="next"
          />
          <View style={{ gap: space(1.5) }}>
            <Field
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                // The complaint is from the last submit. Once they are typing
                // again it is stale, and the hint below says the same thing
                // without the red.
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Choose a password"
              secure
              autoComplete="new-password"
              error={passwordError}
              returnKeyType="next"
            />
            {passwordError == null && (
              <Text style={[type.small, { color: hint.met ? signal.good : paper.inkSoft }]}>{hint.text}</Text>
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

        {formMessage != null && (
          <Text style={[type.body, { color: formOk ? signal.good : signal.correspondance, marginTop: space(4) }]}>
            {formMessage}
          </Text>
        )}

        <View style={{ gap: space(3), marginTop: space(6) }}>
          <PillButton
            label={authButtonLabel('createAccount', pending === 'createAccount')}
            onPress={() => void submit()}
            disabled={busy}
          />
          <OutlineButton
            label={authButtonLabel('google', pending === 'google')}
            onPress={() => void google()}
            disabled={busy}
            icon={<GoogleMark size={18} />}
          />
          <Pressable onPress={onSignIn} accessibilityRole="button" style={st.switchRow}>
            <Text style={[type.small, { color: paper.inkSoft }]}>
              Already have an account? <Text style={{ color: paper.ink, fontFamily: type.bodyStrong.fontFamily }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: space(6) },
  back: { minHeight: HIT, minWidth: HIT, justifyContent: 'center', marginBottom: space(2), alignSelf: 'flex-start' },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
});
