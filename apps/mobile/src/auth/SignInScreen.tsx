/**
 * Sign back in. Forgot-password lives here as an inline state, not a page:
 * type the email, tap the link, watch this same screen confirm the send.
 *
 * It sits inside `ScrollScreen avoidKeyboard`: the frame pays the notch, lifts
 * the fields above the keyboard, and draws the one back through `ScreenHeader`.
 * Only the Sign in pill rides in the footer, so a keyboard cannot scroll the
 * one ink action out of reach. The forgot-password link, the form message and
 * the "Need an account?" row stay in the body, so a field is still visible over
 * an SE-class keyboard rather than pinned under the buttons.
 *
 * Revamp B (F601): the same family as sign-up. The provider doors lead the
 * body, above an "or" rule and the two fields. The Apple pill sits above the
 * Google one where the platform offers native or browser OAuth. Returning
 * devices use the full page; a guest opens it in a sheet after practice.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HIT, HAIRLINE } from '../theme.ts';
import { PillButton, GhostButton, Press, Field, GoogleMark, AppleMark, AlertGlyph, ROW_WORDS } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { appleSignInOffered } from './apple.ts';
import { SIGN_IN_PURPOSE } from './copy.ts';

export function SignInScreen({ onBack, onCreateAccount, embedded = false }: { onBack?: () => void; onCreateAccount: () => void; embedded?: boolean }) {
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
  // platform can open it; Android and web use configured browser OAuth, and
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
      embedded={embedded}
      avoidKeyboard
      header={!embedded && onBack ? <ScreenHeader title={false} divider={false} back={{ onPress: onBack }} /> : undefined}
      footer={<PillButton label={authButtonLabel('signIn', pending === 'signIn')} onPress={() => void submit()} disabled={busy} />}
    >
      {/* A working title on the paper itself, then what is behind the door. */}
      {!embedded && <View style={st.head}>
        <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>Welcome back</Text>
      </View>}
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{SIGN_IN_PURPOSE}</Text>

      {/* The provider doors lead the form. Apple is an ink pill, drawn only where
          the platform offers it; Google is the white pill beneath it. */}
      <View style={[st.doors, embedded && { marginTop: 0 }]}>
        {appleOffered && (
          <PillButton
            label={authButtonLabel('apple', pending === 'apple')}
            onPress={() => void apple()}
            disabled={busy}
            icon={<AppleMark color={paper.onInk} />}
          />
        )}
        <PillButton
          tone="white"
          label={authButtonLabel('google', pending === 'google')}
          onPress={() => void google()}
          disabled={busy}
          icon={<GoogleMark />}
        />
      </View>

      <View style={st.or}>
        <View style={st.rule} />
        <Text style={[type.small, { color: paper.inkSoft }]}>or</Text>
        <View style={st.rule} />
      </View>

      <View style={{ gap: space(4) }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. james@example.com"
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

      {/* The reset link sits under the password it is about, at the right edge. */}
      <View style={st.forgot}>
        <GhostButton
          label={authButtonLabel('sendReset', pending === 'sendReset')}
          onPress={() => void forgot()}
          disabled={busy}
        />
      </View>

      {/* In ink, never red. A refusal carries the alert mark the fields use, so
          the difference from a "check your email" line is not colour alone. */}
      {formMessage != null && (
        <View style={st.message}>
          {!formOk && (
            <View style={st.messageMark}>
              <AlertGlyph size={16} color={paper.ink} />
            </View>
          )}
          <Text style={[type.body, ROW_WORDS, { color: paper.ink }]}>{formMessage}</Text>
        </View>
      )}

      {/* The switch row stays in the body, not the footer: over an SE-class
          keyboard the footer pins to the keyboard's top and a field has to stay
          visible above it rather than this row. */}
      <Press haptic="light" style={st.switchRow} accessibilityRole="button" onPress={onCreateAccount}>
        <Text style={[type.small, { color: paper.inkSoft }]}>
          Need an account? <Text style={st.switchWord}>Create one</Text>
        </Text>
      </Press>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  head: { paddingTop: space(2) },
  doors: { gap: space(3), marginTop: space(6) },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(5) },
  rule: { flex: 1, height: HAIRLINE, backgroundColor: paper.line },
  forgot: { alignItems: 'flex-end', marginTop: space(2) },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginBottom: space(2) },
  messageMark: { paddingTop: space(1) },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  switchWord: { color: paper.ink, fontFamily: type.bodyStrong.fontFamily, textDecorationLine: 'underline' },
});
