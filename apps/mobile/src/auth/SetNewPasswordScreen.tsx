/**
 * The landing spot for a reset-email link (web). The recovery session is
 * already signed in; all that is left is choosing the new password.
 *
 * Revamp B (F601): a working title on paper, with no card around the form and
 * no title in the header row, so nothing above the title carries a middot. The
 * one rule is on screen while it is typed, from the same module sign-up reads.
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard, Platform, type ScrollView as AuthScrollView, type TextInput } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { GhostButton, AlertGlyph, ROW_WORDS } from '../components.tsx';
import { AccountField as Field } from './AccountField.tsx';
import { BoldButton as PillButton } from '../onboarding/BoldButton.tsx';
import { boldType, c } from '../onboarding/boldRhythm.ts';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel } from './busyLabel.ts';
import { passwordHint } from './passwordHint.ts';
import { useFormKeyboard } from './useFormKeyboard.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { visibleFormHeight } from './signupForm.ts';

export function SetNewPasswordScreen({ onDone }: { onDone: () => void }) {
  const { adapter } = useAuth();
  const running = useRef(false);
  const alive = useRef(true);
  const confirmRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<AuthScrollView>(null);
  const scrollOffset = useRef(0);
  const passwordGroup = useRef<View>(null);
  const confirmGroup = useRef<View>(null);
  const focused = useRef<'password' | 'confirm' | null>(null);
  const focusTicket = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // A way out that grants nothing. The recovery link signed this device in
  // only to choose a password, so leaving without one signs it out again: the
  // learner lands on sign in, and no reset link becomes a way into the app.
  const [leaving, setLeaving] = useState(false);
  const cancel = async () => {
    if (busy || leaving || running.current) return;
    running.current = true;
    setLeaving(true);
    try {
      await adapter.signOut();
    } catch {
      if (alive.current) { setLeaving(false); setFormMessage('That did not work. Please try again.'); }
    } finally {
      running.current = false;
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
    if (busy || leaving || running.current) return;
    const passwordProblem = passwordTooShort(password) ? `Passwords need at least ${PASSWORD_MIN} characters.` : null;
    const confirmProblem = confirm !== password ? 'The two passwords are not the same yet.' : null;
    setPasswordError(passwordProblem);
    setConfirmError(confirmProblem);
    setFormMessage(null);
    if (passwordProblem || confirmProblem) return;
    running.current = true;
    Keyboard.dismiss();
    setBusy(true);
    try {
    const result = (await adapter.completePasswordReset?.(password)) ?? {
      ok: false as const,
      message: 'Password reset is not available here.',
    };
    if (!alive.current) return;
    if (result.ok) {
      onDone();
    } else {
      setFormMessage(result.message);
    }
    } catch { if (alive.current) setFormMessage('Your password could not be saved. Please try again.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };

  const keepFocusedVisible = () => {
    if (focused.current === null) return;
    const ticket = ++focusTicket.current;
    requestAnimationFrame(() => {
      const input = focused.current === 'password' ? passwordRef.current : confirmRef.current;
      const group = focused.current === 'password' ? passwordGroup.current : confirmGroup.current;
      const scroll = scrollRef.current;
      if (!input || !group || !scroll || !input.isFocused()) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        group.measureInWindow((_groupX, groupTop, _groupWidth, groupHeight) => {
          if (!alive.current || ticket !== focusTicket.current || !input.isFocused()) return;
          const height = visibleFormHeight(viewportTop, viewportHeight, keyboardTop.current);
          const offset = focusedFieldScroll(scrollOffset.current, viewportTop, height, groupTop, groupHeight);
          if (Math.abs(offset - scrollOffset.current) > 0.5) scroll.scrollTo({ y: offset, animated: false });
        });
      });
    });
  };
  const { visible: keyboardVisible, keyboardTop } = useFormKeyboard(keepFocusedVisible);
  useEffect(() => { keepFocusedVisible(); }, [passwordError, confirmError, formMessage]);

  return (
    <ScrollScreen
      header={<ScreenHeader title={false} divider={false} />}
      scrollRef={scrollRef}
      onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      onViewportLayout={keepFocusedVisible}
      footer={!keyboardVisible ? <View style={{ gap: 4 }}>
        <PillButton label={authButtonLabel('saveNewPassword', busy)} onPress={() => void submit()} disabled={busy || leaving} />
        <GhostButton label={leaving ? 'Signing out…' : 'Cancel and sign out'} disabled={busy || leaving} onPress={() => void cancel()} />
      </View> : undefined}
    >
      <View>
        <Text accessibilityRole="header" style={[type.title, boldType.title, { color: paper.ink, textAlign: 'center' }]}>Choose a new{'\n'}password.</Text>
        <View style={{ backgroundColor: c.lavender, borderRadius: 20, padding: 18, gap: 8, marginTop: 18 }}>
          <Text style={[boldType.heading, { color: c.ink }]}>Keep your account yours</Text>
          <Text style={[boldType.body, { color: c.ink }]}>Use a long password you haven’t used elsewhere.</Text>
        </View>
        <View style={{ gap: 18, marginTop: 18 }}>
          <View ref={passwordGroup} collapsable={false} onLayout={keepFocusedVisible} style={{ gap: space(1.5) }}>
            <Field
              ref={passwordRef}
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              secure
              autoComplete="new-password"
              error={passwordError}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              onFocus={() => { focused.current = 'password'; keepFocusedVisible(); }}
              onBlur={() => { if (focused.current === 'password') focused.current = null; }}
            />
            {passwordError == null && (
              <Text style={[type.small, { color: hint.met ? paper.ink : paper.inkSoft }]}>{hint.text}</Text>
            )}
          </View>
          <View ref={confirmGroup} collapsable={false} onLayout={keepFocusedVisible}><Field
            ref={confirmRef}
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Enter confirm new password"
            secure
            autoComplete="new-password"
            error={confirmError}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            onFocus={() => { focused.current = 'confirm'; keepFocusedVisible(); }}
            onBlur={() => { if (focused.current === 'confirm') focused.current = null; }}
          /></View>
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

        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(4) },
  messageMark: { paddingTop: space(1) },
});
