/**
 * Create an account: email, password, or a provider door.
 * Errors are plain sentences under the field they belong to.
 *
 * It sits inside `ScrollScreen avoidKeyboard`: the frame pays the notch, lifts
 * the fields above the keyboard, and draws the one back through `ScreenHeader`.
 * The primary pill and the provider outlines ride in the footer so a keyboard
 * cannot scroll them out of reach, and the "Already have an account? Sign in"
 * row stays at the end of the body, where a field is still visible over an
 * SE-class keyboard rather than pinned under the buttons.
 *
 * The Apple outline sits above the Google one and only where the platform
 * offers it, which today means iOS. Sign-in and sign-up draw the same doors in
 * the same order on purpose: a learner who cannot remember which one they used
 * last time should not have to find out from a screen that offers fewer.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { accent, HAIRLINE, paper, radius, space, type, signal, HIT } from '../theme.ts';
import { PillButton, OutlineButton, Field, GoogleMark, AppleMark } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail, PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { passwordHint } from './passwordHint.ts';
import { appleSignInOffered } from './apple.ts';

export function SignUpScreen({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
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
  // Asked once, and false until it answers. The Apple door is drawn only where
  // the platform actually opens it; Android and web never do.
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

  return (
    <ScrollScreen
      avoidKeyboard
      header={<ScreenHeader title={false} divider={false} back={{ onPress: onBack }} />}
      footer={
        <View style={{ gap: space(3) }}>
          <PillButton
            label={authButtonLabel('createAccount', pending === 'createAccount')}
            onPress={() => void submit()}
            disabled={busy}
          />
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
      {/* A compact feature heading keeps the form close to its introduction. */}
      <View style={st.head}>
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Create your account</Text>
      </View>
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

      {/* The switch row stays at the end of the body, not in the footer: over an
          SE-class keyboard the footer buttons pin to the keyboard's top, and a
          field has to stay visible above them rather than this row. */}
      <Pressable onPress={onSignIn} accessibilityRole="button" style={st.switchRow}>
        <Text style={[type.small, { color: paper.inkSoft }]}>
          Already have an account? <Text style={{ color: paper.ink, fontFamily: type.bodyStrong.fontFamily }}>Sign in</Text>
        </Text>
      </Pressable>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: accent.feature, borderWidth: HAIRLINE, borderColor: paper.ink, borderRadius: radius.card, padding: space(5) },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', marginTop: space(6) },
});
