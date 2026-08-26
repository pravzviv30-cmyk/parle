/**
 * Sign back in. Forgot-password lives here as an inline state, not a page:
 * type the email, tap the link, watch this same screen confirm the send.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, signal, HIT } from '../theme.ts';
import { PillButton, OutlineButton, GhostButton, Field, ChevronLeft, GoogleMark } from '../components.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail } from './validate.ts';

export function SignInScreen({ onBack, onCreateAccount }: { onBack: () => void; onCreateAccount: () => void }) {
  const insets = useSafeAreaInsets();
  const { adapter } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const emailProblem = looksLikeEmail(email) ? null : 'That does not look like an email address.';
    setEmailError(emailProblem);
    setFormMessage(null);
    if (emailProblem) return;
    setBusy(true);
    const result = await adapter.signInWithPassword(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setFormOk(false);
      setFormMessage(result.message);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await adapter.signInWithGoogle();
    setBusy(false);
    if (!result.ok) {
      setFormOk(false);
      setFormMessage(result.message);
    }
  };

  const forgot = async () => {
    const emailProblem = looksLikeEmail(email) ? null : 'Type your email above first, then tap this again.';
    setEmailError(null);
    if (emailProblem) {
      setFormOk(false);
      setFormMessage(emailProblem);
      return;
    }
    setBusy(true);
    const result = await adapter.sendPasswordReset(email.trim());
    setBusy(false);
    setFormOk(result.ok);
    setFormMessage(result.ok ? result.message ?? 'Check your email for a reset link.' : result.message);
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

        <GhostButton label="Forgot password?" onPress={() => void forgot()} />

        {formMessage != null && (
          <Text style={[type.body, { color: formOk ? signal.good : signal.correspondance, marginBottom: space(2) }]}>
            {formMessage}
          </Text>
        )}

        <View style={{ gap: space(3) }}>
          <PillButton label="Sign in" onPress={() => void submit()} disabled={busy} />
          <OutlineButton
            label="Continue with Google"
            onPress={() => void google()}
            disabled={busy}
            icon={<GoogleMark size={18} />}
          />
          <Pressable onPress={onCreateAccount} accessibilityRole="button" style={st.switchRow}>
            <Text style={[type.small, { color: paper.inkSoft }]}>
              New here? <Text style={{ color: paper.ink, fontFamily: type.bodyStrong.fontFamily }}>Create an account</Text>
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
