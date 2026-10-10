/**
 * Create an account: a provider door, or email and password.
 * Errors are plain sentences under the field they belong to.
 *
 * It sits inside `ScrollScreen avoidKeyboard`: the frame pays the notch, lifts
 * the fields above the keyboard, and draws the one back through `ScreenHeader`.
 * Only the "Create account" pill rides in the footer, so a keyboard cannot
 * scroll the one ink action out of reach. The "Already have an account? Sign
 * in" row stays at the end of the body, where a field is still visible over an
 * SE-class keyboard rather than pinned under the buttons.
 *
 * Provider doors lead the form. Their short visible labels sit side by side;
 * VoiceOver keeps the full action. The form fits a standard iPhone with the
 * keyboard hidden, while scrolling remains available for larger reading sizes.
 */

import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type ScrollView as AuthScrollView, TextInput, View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HIT, HAIRLINE } from '../theme.ts';
import { PillButton, Press, GoogleMark, AppleMark, AlertGlyph, ROW_WORDS } from '../components.tsx';
import { ScrollScreen, ScreenHeader, readingColumn, useCompactPhone } from '../layout.tsx';
import { AccountField as Field } from './AccountField.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail, PASSWORD_MIN, passwordTooShort } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { PasswordMeter } from './PasswordMeter.tsx';
import { EMAIL_ADVANCE_IDLE_MS, emailReadyToAdvance } from './emailAdvance.ts';
import { friendly } from './friendly.ts';
import { appleSignInOffered } from './apple.ts';
import type { PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { useReduceMotion } from '../motion.ts';

export function SignUpScreen({ onBack, onSignIn, planDraft = null, embedded = false }: { onBack: () => void; onSignIn: () => void; planDraft?: PreAccountOnboardingDraft | null; embedded?: boolean }) {
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
  const compact = useCompactPhone();
  const reduced = useReduceMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const scrollRef = useRef<AuthScrollView>(null);
  const scrollOffset = useRef(0);
  const focusFrame = useRef<number | null>(null);
  const focusMeasurement = useRef(0);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const emailGroup = useRef<View>(null);
  const passwordGroup = useRef<View>(null);
  const confirmGroup = useRef<View>(null);
  const focused = useRef<'email' | 'password' | 'confirm' | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const autoAdvanced = useRef(false);
  const alive = useRef(true);
  const requestRunning = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const keepFocusedVisible = () => {
    if (Platform.OS === 'web' || focused.current === null) return;
    const ticket = ++focusMeasurement.current;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    // Focus precedes the keyboard layout. Measure after React has laid out the
    // smaller body; the RN keyboard helper assumes a full-screen ScrollView.
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = null;
        const input = focused.current === 'email' ? emailRef.current : focused.current === 'password' ? passwordRef.current : focused.current === 'confirm' ? confirmRef.current : null;
        const group = focused.current === 'email' ? emailGroup.current : focused.current === 'password' ? passwordGroup.current : focused.current === 'confirm' ? confirmGroup.current : null;
        const scroll = scrollRef.current;
        if (!input || !group || !scroll || !input.isFocused()) return;
        scroll.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
          group.measureInWindow((_groupX, groupTop, _groupWidth, groupHeight) => {
            if (!alive.current || ticket !== focusMeasurement.current || !input.isFocused()) return;
            const next = focusedFieldScroll(scrollOffset.current, viewportTop, viewportHeight, groupTop, groupHeight);
            if (Math.abs(next - scrollOffset.current) > 0.5) scroll.scrollTo({ y: next, animated: !reducedRef.current });
          });
        });
      });
    });
  };
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', keepFocusedVisible);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', keepFocusedVisible);
    return () => {
      shown.remove();
      changed.remove();
      focusMeasurement.current += 1;
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);
  useEffect(() => {
    if (focused.current !== null) keepFocusedVisible();
  }, [emailError, passwordError, confirmError, formMessage, compact]);
  useEffect(() => {
    if (!emailFocused || autoAdvanced.current || busy || password.length > 0 || !emailReadyToAdvance(email)) return;
    const idle = setTimeout(() => {
      if (focused.current !== 'email') return;
      autoAdvanced.current = true;
      passwordRef.current?.focus();
    }, EMAIL_ADVANCE_IDLE_MS);
    return () => clearTimeout(idle);
  }, [email, emailFocused, busy, password.length]);
  // Asked once, and false until it answers. The Apple door is drawn only where
  // the platform can open it; the adapter checks provider configuration.
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
    // The keyboard's return key cannot be greyed out, so the guard is here too.
    if (busy || requestRunning.current) return;
    const emailProblem = looksLikeEmail(email) ? null : 'That does not look like an email address.';
    const passwordProblem = passwordTooShort(password) ? `Passwords need at least ${PASSWORD_MIN} characters.` : null;
    const confirmProblem = confirm === password ? null : 'The two passwords are not the same yet.';
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    setConfirmError(confirmProblem);
    setFormMessage(null);
    if (emailProblem || passwordProblem || confirmProblem) return;
    requestRunning.current = true;
    setPending('createAccount');
    try {
      const result = await adapter.signUpWithPassword(email.trim(), password);
      if (!alive.current) return;
      if (result.ok) {
        // Confirmation-pending never triggers the account-created celebration.
        if (result.message) {
          setFormOk(true);
          setFormMessage(result.message);
        }
      } else {
        setFormOk(false);
        setFormMessage(result.message);
      }
    } catch (error) {
      if (alive.current) { setFormOk(false); setFormMessage(friendly(error as { message?: string })); }
    } finally {
      requestRunning.current = false;
      if (alive.current) setPending(null);
    }
  };

  const google = async () => {
    if (busy) return;
    if (requestRunning.current) return;
    requestRunning.current = true;
    setPending('google');
    setFormMessage(null);
    try {
      Keyboard.dismiss();
      const result = await adapter.signInWithGoogle();
      if (alive.current && !result.ok) { setFormOk(false); setFormMessage(result.message); }
    } catch (error) {
      if (alive.current) { setFormOk(false); setFormMessage(friendly(error as { message?: string })); }
    } finally {
      requestRunning.current = false;
      if (alive.current) setPending(null);
    }
  };

  const apple = async () => {
    if (busy) return;
    if (requestRunning.current) return;
    requestRunning.current = true;
    setPending('apple');
    setFormMessage(null);
    try {
      Keyboard.dismiss();
      const result = await adapter.signInWithApple();
      if (alive.current && !result.ok) { setFormOk(false); setFormMessage(result.message); }
    } catch (error) {
      if (alive.current) { setFormOk(false); setFormMessage(friendly(error as { message?: string })); }
    } finally {
      requestRunning.current = false;
      if (alive.current) setPending(null);
    }
  };

  return (
    <ScrollScreen
      embedded={embedded}
      scrollRef={scrollRef}
      onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      avoidKeyboard
      topGap={space(2)}
      header={embedded ? undefined : <ScreenHeader title={false} divider={false} back={{ onPress: onBack }} />}
      footer={
        <PillButton
          label={authButtonLabel('createAccount', pending === 'createAccount')}
          onPress={() => void submit()}
          disabled={busy}
        />
      }
    >
      {/* The saved plan remains in the handoff; this form needs only its task. */}
      <View style={[readingColumn, { paddingBottom: space(2) }]}>
      {!embedded && <View style={st.head}>
        <Text accessibilityRole="header" style={[type.title, { color: paper.ink }]}>Create your account</Text>
      </View>}
      {/* Apple leads when available; both choices stay above the email fields. */}
      <View style={[st.doors, compact && { marginTop: space(2), gap: space(2) }]}>
        {appleOffered && (
          <View style={st.provider}>
          <PillButton
            label={pending === 'apple' ? 'Waiting…' : 'Apple'}
            accessibilityLabel={authButtonLabel('apple', pending === 'apple')}
            onPress={() => void apple()}
            disabled={busy}
            icon={<AppleMark color={paper.onInk} />}
          />
          </View>
        )}
        <View style={st.provider}>
        <PillButton
          tone="white"
          label={pending === 'google' ? 'Waiting…' : 'Google'}
          accessibilityLabel={authButtonLabel('google', pending === 'google')}
          onPress={() => void google()}
          disabled={busy}
          icon={<GoogleMark />}
        />
        </View>
      </View>

      <View style={[st.or, compact && { marginVertical: space(1) }]}>
        <View style={st.rule} />
        <Text style={[type.small, { color: paper.inkSoft }]}>or</Text>
        <View style={st.rule} />
      </View>

      <View style={{ gap: compact ? space(1) : space(2) }}>
        <View ref={emailGroup} collapsable={false} onLayout={keepFocusedVisible}>
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={(value) => { setEmail(value); if (emailError) setEmailError(null); }}
          placeholder="e.g. james@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          error={emailError}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => { if (emailReadyToAdvance(email)) passwordRef.current?.focus(); }}
          onFocus={() => { focused.current = 'email'; setEmailFocused(true); keepFocusedVisible(); }}
          onBlur={() => { setEmailFocused(false); if (focused.current === 'email') focused.current = null; }}
        />
        </View>
        <View ref={passwordGroup} collapsable={false} onLayout={keepFocusedVisible} style={{ gap: compact ? space(1) : space(1.5) }}>
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              // The complaint is from the last submit. Once they are typing
              // again it is stale, and the hint below says the same thing
              // without the alert mark.
              if (passwordError) setPasswordError(null);
            }}
            placeholder="Choose a password"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
            error={passwordError}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            onFocus={() => { focused.current = 'password'; keepFocusedVisible(); }}
            onBlur={() => { if (focused.current === 'password') focused.current = null; }}
          />
          <PasswordMeter value={password} />
        </View>
        <View ref={confirmGroup} collapsable={false} onLayout={keepFocusedVisible} style={{ gap: compact ? space(1) : space(1.5) }}><Field
          ref={confirmRef}
          label="Confirm password"
          value={confirm}
          onChangeText={(value) => { setConfirm(value); if (confirmError) setConfirmError(null); }}
          placeholder="Enter your password again"
          secure
          autoComplete="off"
          textContentType="none"
          editable={!busy}
          error={confirmError}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          onFocus={() => { focused.current = 'confirm'; keepFocusedVisible(); }}
          onBlur={() => { if (focused.current === 'confirm') focused.current = null; }}
        /><PasswordMeter value={confirm} matching={confirm.length > 0 ? confirm === password : undefined} /></View>
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

      {/* The switch row stays at the end of the body, not in the footer: over an
          SE-class keyboard the footer pill pins to the keyboard's top, and a
          field has to stay visible above it rather than this row. */}
      <Press haptic="light" style={st.switchRow} accessibilityRole="button" onPress={onSignIn}>
        <Text style={[type.small, { color: paper.inkSoft }]}>
          Already have an account? <Text style={st.switchWord}>Sign in</Text>
        </Text>
      </Press>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  head: {},
  doors: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  provider: { flex: 1, minWidth: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(3) },
  rule: { flex: 1, height: HAIRLINE, backgroundColor: paper.line },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(4) },
  messageMark: { paddingTop: space(1) },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', marginTop: space(2) },
  switchWord: { color: paper.ink, fontFamily: type.bodyStrong.fontFamily, textDecorationLine: 'underline' },
});
