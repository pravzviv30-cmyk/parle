/**
 * Sign back in. Forgot-password lives here as an inline state, not a page:
 * type the email, tap the link, watch this same screen confirm the send.
 *
 * It sits inside `ScrollScreen avoidKeyboard`: the frame pays the notch, lifts
 * the fields above the keyboard, and draws the one back through `ScreenHeader`.
 * The Sign in pill and the provider outlines ride in the footer so a keyboard
 * cannot scroll them out of reach. The forgot-password ghost, the form message
 * and the "New here?" row stay in the body, so a field is still visible over an
 * SE-class keyboard rather than pinned under the buttons.
 *
 * The Apple outline sits above the Google one and is drawn only where the
 * platform offers it, which today means iOS. That order is Apple's own
 * guidance where its button appears at all, and it costs an Android or web
 * learner nothing, because there the button does not exist.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { paper, space, type, signal, HIT } from '../theme.ts';
import { PillButton, OutlineButton, GhostButton, Field, GoogleMark, AppleMark } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { appleSignInOffered } from './apple.ts';
import { SIGN_IN_PURPOSE } from './copy.ts';

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
  // Asked once, and false until it answers. A door is drawn only where the
  // platform actually opens it: Android and web never offer Apple sign-in, and
  // an iPhone too old for it says no as well. Drawing the button first and
  // hiding it after would flash a door that was never there.
  const [appleOffered, setAppleOffered] = useState(false);
  useEffect(() => {
    let alive = true;
    void appleSignInOffered().then((offered) => {
      if (alive) setAppleOffered(offered);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const apple = async () => {
    if (busy) return;
    setPending('apple');
    const result = await adapter.signInWithApple();
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
          {appleOffered && (
            <OutlineButton
              label={authButtonLabel('apple', pending === 'apple')}
              onPress={() => void apple()}
              disabled={busy}
              icon={<AppleMark size={18} />}
            />
          )}
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
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{SIGN_IN_PURPOSE}</Text>

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
