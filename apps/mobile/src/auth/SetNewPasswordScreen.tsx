/**
 * The landing spot for a reset-email link (web). The recovery session is
 * already signed in; all that is left is choosing the new password.
 */

import { useState } from 'react';
import { View, Text } from 'react-native';
import { paper, space, type, signal } from '../theme.ts';
import { Card, PillButton, Field } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel } from './busyLabel.ts';

export function SetNewPasswordScreen({ onDone }: { onDone: () => void }) {
  const { adapter } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Two field errors and one banner. The length and the mismatch each belong to
  // a field, and Field is what announces them; a failure from the provider
  // belongs to neither, so it keeps a line of its own.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <ScrollScreen avoidKeyboard header={<ScreenHeader title="Luvani · Your account" />} footer={<PillButton label={authButtonLabel('saveNewPassword', busy)} onPress={() => void submit()} disabled={busy} />}>
      <View>
        <Card tone="feature">
        <Text style={[type.display, { color: paper.ink }]}>Choose a new password</Text>
        </Card>
        <View style={{ gap: space(4), marginTop: space(6) }}>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            secure
            autoComplete="new-password"
            error={passwordError}
            returnKeyType="next"
          />
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
          <Text style={[type.body, { color: signal.correspondance, marginTop: space(4) }]}>{formMessage}</Text>
        )}
      </View>
    </ScrollScreen>
  );
}
