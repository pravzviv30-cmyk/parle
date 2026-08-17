/**
 * The landing spot for a reset-email link (web). The recovery session is
 * already signed in; all that is left is choosing the new password.
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paper, space, type, signal } from '../theme.ts';
import { PillButton, Field } from '../components.tsx';
import { useAuth } from './useAuth.tsx';
import { PASSWORD_MIN, passwordTooShort } from './validate.ts';

export function SetNewPasswordScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { adapter } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (passwordTooShort(password)) {
      setError(`Passwords need at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (confirm !== password) {
      setError('The two passwords are not the same yet.');
      return;
    }
    setError(null);
    setBusy(true);
    const result = (await adapter.completePasswordReset?.(password)) ?? {
      ok: false as const,
      message: 'Password reset is not available here.',
    };
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setError(result.message);
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top + space(10), paddingBottom: insets.bottom + space(6) }]}>
      <View>
        <Text style={[type.display, { color: paper.ink }]}>Choose a new password</Text>
        <View style={{ gap: space(4), marginTop: space(6) }}>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            secure
            autoComplete="new-password"
            returnKeyType="next"
          />
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Once more"
            secure
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {error != null && (
          <Text style={[type.body, { color: signal.correspondance, marginTop: space(4) }]}>{error}</Text>
        )}
      </View>
      <PillButton label="Save and continue" onPress={() => void submit()} disabled={busy} />
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: paper.ground,
    paddingHorizontal: space(6),
    justifyContent: 'space-between',
    gap: space(8),
  },
});
