/**
 * Sign back in. Forgot-password lives here as an inline state, not a page:
 * type the email, tap the link, watch this same screen confirm the send.
 *
 * It sits inside `ScrollScreen avoidKeyboard`: the frame pays the notch, lifts
 * the fields above the keyboard, and draws the one back through `ScreenHeader`.
 * The Sign in pill and the Google outline ride in the footer so a keyboard
 * cannot scroll them out of reach. The forgot-password ghost, the form message
 * and the "New here?" row stay in the body, so a field is still visible over an
 * SE-class keyboard rather than pinned under the buttons.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { paper, space, type, signal, HIT } from '../theme.ts';
import { PillButton, OutlineButton, GhostButton, Field, GoogleMark } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';

export function SignInScreen({ onBack, onCreateAccount }: { onBack: () => void; onCreateAccount: () => void }) {
  const { adapter } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  // One flag for the screen, and it names the request that is running. Every
  // button greys while anything is in flight, because two sign-ins at once is
  // the bug underneath; only the button that started it changes its words.
  const [pending, setPending] = useState<AuthAction | null>(null);
  const busy = pending !== null;

  const submit = async () => {
    // The keyboard's return key is not a button and cannot be greyed out, so
    // the guard is here rather than only on the pill.
    if (busy) return;
    const emailProblem = looksLikeEmail(email) ? null : 'That does not look like an email address.';
    setEmailError(emailProblem);
    setFormMessage(null);
    if (emailProblem) return;
    setPending('signIn');
    const result = await adapter.signInWithPassword(email.trim(), password);
    setPending(null);
    if (!result.ok) {
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

  const forgot = async () => {
    if (busy) return;
    const emailProblem = looksLikeEmail(email) ? null : 'Type your email above first, then tap this again.';
    setEmailError(null);
    if (emailProblem) {
      setFormOk(false);
      setFormMessage(emailProblem);
      return;
    }
    setPending('sendReset');
    const result = await adapter.sendPasswordReset(email.trim());
    setPending(null);
    setFormOk(result.ok);
    setFormMessage(result.ok ? result.message ?? 'Check your email for a reset link.' : result.message);
  };

  return (
    <ScrollScreen
      avoidKeyboard
      header={<ScreenHeader back={{ onPress: onBack }} />}
      footer={
        <View style={{ gap: space(3) }}>
          <PillButton label={authButtonLabel('signIn', pending === 'signIn')} onPress={() => void submit()} disabled={busy} />
          <OutlineButton
            label={authButtonLabel('google', pending === 'google')}
            onPress={() => void google()}
            disabled={busy}
            icon={<GoogleMark size={18} />}
          />
        </View>
      }
    >
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Welcome back</Text>

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
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secure
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </View>

      <GhostButton
        label={authButtonLabel('sendReset', pending === 'sendReset')}
        onPress={() => void forgot()}
        disabled={busy}
      />

      {formMessage != null && (
        <Text style={[type.body, { color: formOk ? signal.good : signal.correspondance, marginBottom: space(2) }]}>
          {formMessage}
        </Text>
      )}

      {/* The switch row stays in the body, not the footer: over an SE-class
          keyboard the footer pins to the keyboard's top and a field has to stay
          visible above it rather than this row. */}
      <Pressable onPress={onCreateAccount} accessibilityRole="button" style={st.switchRow}>
        <Text style={[type.small, { color: paper.inkSoft }]}>
          New here? <Text style={{ color: paper.ink, fontFamily: type.bodyStrong.fontFamily }}>Create an account</Text>
        </Text>
      </Pressable>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
});
