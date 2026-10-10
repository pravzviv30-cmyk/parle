/** A stable scrolling form inside the shared onboarding frame. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, findNodeHandle, Platform, type ScrollView as AuthScrollView, TextInput, View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HIT, HAIRLINE } from '../theme.ts';
import { PillButton, Press, GoogleMark, AppleMark, AlertGlyph, CheckGlyph, ROW_WORDS } from '../components.tsx';
import { readingColumn, useFontScale } from '../layout.tsx';
import { OnboardingLayout } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import type { PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { AccountField as Field } from './AccountField.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail, PASSWORD_MIN } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { PasswordMeter } from './PasswordMeter.tsx';
import { signupProblems, signupReady, passwordsMatch, visibleFormHeight } from './signupForm.ts';
import { useFormKeyboard } from './useFormKeyboard.ts';
import type { SignUpFormDraft } from './signUpFormDraft.ts';
import { Feedback } from '../motion/Feedback.tsx';
import { friendly } from './friendly.ts';
import { appleSignInOffered } from './apple.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { useReduceMotion } from '../motion.ts';

export function SignUpScreen({ onBack, onSignIn, planDraft = null, onEmailChange, embedded = false, formDraft, onFormDraftChange }: { onBack: () => void; onSignIn: () => void; planDraft?: PreAccountOnboardingDraft | null; onEmailChange?: (email: string) => void; embedded?: boolean; formDraft?: SignUpFormDraft; onFormDraftChange?: (draft: SignUpFormDraft) => void }) {
  const { adapter } = useAuth();
  const [email, setEmail] = useState(planDraft?.accountEmail ?? formDraft?.email ?? '');
  const [password, setPassword] = useState(formDraft?.password ?? '');
  const [confirm, setConfirm] = useState(formDraft?.confirm ?? '');
  // Autofill may update several fields in one batch. Publish the committed
  // values together rather than overwriting a sibling with a stale snapshot.
  useEffect(() => { onFormDraftChange?.({ email, password, confirm }); }, [email, password, confirm, onFormDraftChange]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  // One flag, naming the request that is running: everything greys, and only
  // the button that started it changes its words.
  const [pending, setPending] = useState<AuthAction | null>(null);
  const busy = pending !== null;
  const fontScale = useFontScale();
  const reduced = useReduceMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const scrollRef = useRef<AuthScrollView>(null);
  const scrollOffset = useRef(0);
  const focusFrame = useRef<number | null>(null);
  const focusMeasurement = useRef(0);
  const headingRef = useRef<Text>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const emailGroup = useRef<View>(null);
  const passwordGroup = useRef<View>(null);
  const confirmGroup = useRef<View>(null);
  const focused = useRef<'email' | 'password' | 'confirm' | null>(null);
  const alive = useRef(true);
  const requestRunning = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (!embedded) {
      const node = headingRef.current;
      if (Platform.OS === 'web') (node as unknown as { focus?: () => void })?.focus?.();
      else { const handle = findNodeHandle(node); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
    }
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (embedded) return;
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { leave(onBack); return true; });
    return () => back.remove();
  }, [onBack, embedded, busy]);
  const keepFocusedVisible = () => {
    if (focused.current === null) return;
    const ticket = ++focusMeasurement.current;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    // Focus precedes the keyboard layout. Measure after React has laid out the
    // viewport; include the label and guidance, not only the input itself.
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
            const height = visibleFormHeight(viewportTop, viewportHeight, keyboardTop.current);
            const next = focusedFieldScroll(scrollOffset.current, viewportTop, height, groupTop, groupHeight);
            if (Math.abs(next - scrollOffset.current) > 0.5) scroll.scrollTo({ y: next, animated: keyboardTop.current === null && !reducedRef.current });
          });
        });
      });
    });
  };
  const { visible: keyboardVisible, keyboardTop } = useFormKeyboard(keepFocusedVisible);
  useEffect(() => () => {
    focusMeasurement.current += 1;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
  }, []);
  useEffect(() => {
    if (focused.current !== null) keepFocusedVisible();
  }, [emailError, passwordError, confirmError, formMessage, fontScale]);
  useEffect(() => {
    const message = providerMessage ?? formMessage;
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [providerMessage, formMessage]);
  const ready = signupReady(email, password, confirm);
  const match = passwordsMatch(password, confirm);
  const clearResult = () => { setFormMessage(null); setProviderMessage(null); setFormOk(false); };
  const validateForm = () => {
    const problems = signupProblems(email, password, confirm);
    setEmailError(problems.email);
    setPasswordError(problems.password);
    setConfirmError(problems.confirm);
    if (problems.email) emailRef.current?.focus();
    else if (problems.password) passwordRef.current?.focus();
    else if (problems.confirm) confirmRef.current?.focus();
    return problems.email === null && problems.password === null && problems.confirm === null;
  };
  const finishEditing = () => {
    if (busy || !validateForm()) return;
    // Done only finishes editing. Creating an account always takes a button tap.
    Keyboard.dismiss();
  };
  const leave = (next: () => void) => {
    // Unmounting would discard this request's lock and allow a second signup
    // after returning to the form while the first request is still running.
    if (busy || requestRunning.current) return false;
    Keyboard.dismiss();
    next();
  };
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
    if (busy || requestRunning.current) return;
    setFormMessage(null);
    setProviderMessage(null);
    if (!validateForm()) return;
    Keyboard.dismiss();
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
    setProviderMessage(null);
    try {
      Keyboard.dismiss();
      const result = await adapter.signInWithGoogle();
      if (alive.current && !result.ok) setProviderMessage(result.message);
    } catch (error) {
      if (alive.current) setProviderMessage(friendly(error as { message?: string }));
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
    setProviderMessage(null);
    try {
      Keyboard.dismiss();
      const result = await adapter.signInWithApple();
      if (alive.current && !result.ok) setProviderMessage(result.message);
    } catch (error) {
      if (alive.current) setProviderMessage(friendly(error as { message?: string }));
    } finally {
      requestRunning.current = false;
      if (alive.current) setPending(null);
    }
  };

  return (
    <OnboardingLayout
      page="account"
      progress={onboardingProgress({ page: 'account', five: planDraft?.onboardingVariant === 'five', skipped: planDraft?.onboardingSkippedSteps, completed: planDraft?.onboardingCompletedSteps })}
      center={false}
      embedded={embedded}
      scrollRef={scrollRef}
      scrollEventThrottle={16}
      onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      onViewportLayout={keepFocusedVisible}
    >
      {/* The saved plan remains in the handoff; this form needs only its task. */}
      <View style={[readingColumn, st.page]}>
      {!embedded && <View style={st.head}>
        {/* Refresh typography measurements on a live reading-size change;
            the fields themselves retain their native identity and caret. */}
        <Text key={fontScale} ref={headingRef} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[type.title, { color: paper.ink, textAlign: 'center' }]}>Create your account</Text>
      </View>}
      {/* Apple leads when available; both choices stay above the email fields. */}
      <View style={st.doors}>
        {appleOffered && (
          <View style={st.provider}>
          <PillButton
            key={fontScale}
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
          key={fontScale}
          tone="white"
          label={pending === 'google' ? 'Waiting…' : 'Google'}
          accessibilityLabel={authButtonLabel('google', pending === 'google')}
          onPress={() => void google()}
          disabled={busy}
          icon={<GoogleMark />}
        />
        </View>
      </View>

      {providerMessage != null && (
        <View style={[st.message, { marginTop: space(3) }]}>
          <View style={st.messageMark}><AlertGlyph size={16} color={paper.ink} /></View>
          <Text key={fontScale} accessibilityLiveRegion="polite" style={[type.body, ROW_WORDS, { color: paper.ink }]}>{providerMessage}</Text>
        </View>
      )}

      <View style={st.or}>
        <View style={st.rule} />
        <Text key={fontScale} style={[type.small, { color: paper.inkSoft }]}>or</Text>
        <View style={st.rule} />
      </View>

      <View style={st.fields}>
        <View ref={emailGroup} collapsable={false} onLayout={keepFocusedVisible}>
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={(value) => { setEmail(value); onEmailChange?.(value); setEmailError(null); clearResult(); }}
          placeholder="e.g. james@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          error={emailError}
          returnKeyType="next"
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (busy) return;
            if (looksLikeEmail(email)) { setEmailError(null); passwordRef.current?.focus(); }
            else { setEmailError('Enter a valid email address.'); keepFocusedVisible(); }
          }}
          onFocus={() => { focused.current = 'email'; keepFocusedVisible(); }}
          onBlur={() => { if (focused.current === 'email') focused.current = null; }}
        />
        </View>
        <View ref={passwordGroup} collapsable={false} onLayout={keepFocusedVisible} style={st.passwordGroup}>
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setPasswordError(null);
              setConfirmError(null);
              clearResult();
            }}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
            error={passwordError}
            returnKeyType="next"
            submitBehavior="submit"
            blurOnSubmit={false}
            onSubmitEditing={() => { if (!busy) confirmRef.current?.focus(); }}
            onFocus={() => { focused.current = 'password'; keepFocusedVisible(); }}
            onBlur={() => { if (focused.current === 'password') focused.current = null; }}
          />
          <PasswordMeter value={password} />
        </View>
        <View ref={confirmGroup} collapsable={false} onLayout={keepFocusedVisible} style={st.passwordGroup}><Field
          ref={confirmRef}
          label="Confirm password"
          value={confirm}
          onChangeText={(value) => { setConfirm(value); setConfirmError(null); clearResult(); }}
          placeholder="Enter your password again"
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!busy}
          error={confirmError}
          returnKeyType="done"
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={finishEditing}
          onFocus={() => { focused.current = 'confirm'; keepFocusedVisible(); }}
          onBlur={() => {
            if (focused.current === 'confirm') focused.current = null;
            if (confirm.length > 0 && confirm !== password) setConfirmError('The passwords do not match. Try entering it again.');
          }}
        />
          {confirmError === null && <Feedback kind="selection" active={match}>
            <View style={[st.confirmFeedback, { minHeight: type.small.lineHeight * 2 * fontScale }]}>
              {match && <CheckGlyph size={16} color={paper.ink} />}
              <Text key={fontScale} accessibilityLiveRegion="polite" style={[type.small, st.feedbackText]}>
                {match ? 'Passwords match.' : 'Enter the same password again.'}
              </Text>
            </View>
          </Feedback>}
        </View>
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
          <Text key={fontScale} accessibilityLiveRegion="polite" style={[type.body, ROW_WORDS, { color: paper.ink }]}>{formMessage}</Text>
        </View>
      )}

      {!keyboardVisible && <View style={st.action}>
        <PillButton
          key={fontScale}
          label={authButtonLabel('createAccount', pending === 'createAccount')}
          onPress={() => void submit()}
          disabled={busy || !ready || formOk}
          state={pending === 'createAccount' ? 'busy' : formOk ? 'done' : 'idle'}
        />
      </View>}

      <Press haptic="light" style={[st.switchRow, busy && { opacity: 0.5 }]} accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => leave(onSignIn)}>
        <Text key={fontScale} style={[type.small, { color: paper.inkSoft }]}>
          Already have an account? <Text style={st.switchWord}>Sign in</Text>
        </Text>
      </Press>
      </View>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  page: { paddingBottom: space(2) },
  head: { marginTop: space(1), marginBottom: space(1), alignItems: 'center' },
  fields: { gap: space(4) },
  passwordGroup: { gap: space(1.5) },
  confirmFeedback: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), minHeight: type.small.lineHeight * 2 },
  feedbackText: { flex: 1, color: paper.inkSoft },
  action: { marginTop: space(4) },
  doors: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  provider: { flex: 1, minWidth: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(3) },
  rule: { flex: 1, height: HAIRLINE, backgroundColor: paper.line },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(3) },
  messageMark: { paddingTop: space(1) },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', marginTop: space(2) },
  switchWord: { color: paper.ink, fontFamily: type.bodyStrong.fontFamily, textDecorationLine: 'underline' },
});
