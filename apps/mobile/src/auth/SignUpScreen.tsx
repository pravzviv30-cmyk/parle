/** A stable scrolling form inside the shared onboarding frame. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, findNodeHandle, Platform, type ScrollView as AuthScrollView, TextInput, View, Text, StyleSheet } from 'react-native';
import { paper, space, type, HIT, HAIRLINE } from '../theme.ts';
import { PillButton, Press, GoogleMark, AppleMark, AlertGlyph, CheckGlyph, ROW_WORDS, Sheet } from '../components.tsx';
import { readingColumn, useFontScale } from '../layout.tsx';
import { OnboardingLayout } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import type { PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { AccountField as Field } from './AccountField.tsx';
import { AuthForm, useWebFieldName } from './AuthForm.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail, PASSWORD_MIN } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { PasswordMeter } from './PasswordMeter.tsx';
import { signupProblems, signupReady, signupWaitingReason, passwordsMatch, visibleFormHeight } from './signupForm.ts';
import { useFormKeyboard } from './useFormKeyboard.ts';
import { BoldScene } from '../onboarding/motion/BoldScene.tsx';
import { ProviderButton } from './ProviderButton.tsx';
import { BoldButton } from '../onboarding/BoldButton.tsx';
import { boldType, c } from '../onboarding/boldRhythm.ts';
import { TermsAcceptance } from '../legal/TermsAcceptance.tsx';
import { TermsScreen } from '../legal/TermsScreen.tsx';
import { PolicyScreen } from '../legal/PolicyScreen.tsx';
import type { SignUpFormDraft } from './signUpFormDraft.ts';
import { Feedback } from '../motion/Feedback.tsx';
import { friendly } from './friendly.ts';
import { appleSignInOffered } from './apple.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { useReduceMotion } from '../motion.ts';
import { BArt } from '../art/BArt.tsx';
import { BBand, BBandDisc } from '../onboarding/BOnboardingParts.tsx';
import { useB } from '../main/bTheme.tsx';
import { bType } from '../theme.ts';

export function SignUpScreen({ onBack, onSignIn, planDraft = null, onEmailChange, embedded = false, accountFirst = false, formDraft, onFormDraftChange, onTermsAccepted }: { onBack: () => void; onSignIn: () => void; planDraft?: PreAccountOnboardingDraft | null; onEmailChange?: (email: string) => void; embedded?: boolean; accountFirst?: boolean; formDraft?: SignUpFormDraft; onFormDraftChange?: (draft: SignUpFormDraft) => void; onTermsAccepted?: (email: string) => boolean | void }) {
  const { adapter } = useAuth();
  // 2026-10-21 UI-008: onboarding is pinned light, so these are b.light.
  const b = useB();
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
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
  const [resending, setResending] = useState(false);
  const busy = pending !== null || resending;
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
  useWebFieldName(emailRef, 'email');
  useWebFieldName(passwordRef, 'new-password');
  useWebFieldName(confirmRef, 'new-password');
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
      if (onTermsAccepted?.(email.trim()) === false) return;
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

  const resend = async () => {
    if (busy || requestRunning.current || !formOk || !adapter.resendConfirmation) return;
    requestRunning.current = true;
    setResending(true);
    try {
      const result = await adapter.resendConfirmation(email.trim());
      if (alive.current) setFormMessage(result.message ?? 'Check your email for a confirmation link.');
    } catch (error) {
      if (alive.current) setFormMessage(friendly(error as { message?: string }));
    } finally {
      requestRunning.current = false;
      if (alive.current) setResending(false);
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
      if (onTermsAccepted?.(email.trim()) === false) return;
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
      if (onTermsAccepted?.(email.trim()) === false) return;
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
    <>
    <OnboardingLayout
      page="account"
      progress={onboardingProgress({ page: accountFirst ? 'hear-it' : 'account', five: planDraft?.onboardingVariant === 'five', skipped: planDraft?.onboardingSkippedSteps, completed: planDraft?.onboardingCompletedSteps })}
      center={false}
      // 2026-10-21 UI-008, artboard B-OB-Consent ("Save your plan"): a blue band under the clock with the star jar.
      bleedTop={!embedded}
      statusBar="light"
      hero={embedded ? undefined : (
        <BBand tone="brand" art={<>
          <BBandDisc size={200} right={-11} top={-6} color={b.violet2} />
          <BArt name="star-jar" width={160} height={136} style={st.bandArt} />
        </>}>
          {/* Refresh typography measurements on a live reading-size change;
              the fields themselves retain their native identity and caret. */}
          <Text key={fontScale} ref={headingRef} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[bType.band32, st.bandWords, { color: b.onBrand }]}>{planDraft ? 'Save your plan' : 'A home for your French.'}</Text>
          <Text style={[bType.para16, st.bandWords, { color: b.onBrandSoft }]}>{planDraft ? 'Create an account to keep your plan and pick up where you left off.' : 'Create an account to keep your practice.'}</Text>
        </BBand>
      )}
      footer={!keyboardVisible ? <>
      <View style={{ gap: 8 }}>
        <TermsAcceptance context="account" onTerms={() => setLegal('terms')} onPrivacy={() => setLegal('privacy')} />
        <BoldButton
          key={fontScale}
          label={authButtonLabel('createAccount', pending === 'createAccount')}
          onPress={() => void submit()}
          disabled={busy || !ready || formOk}
          disabledReason={!busy && !formOk && !ready ? signupWaitingReason(email, password, confirm) ?? undefined : undefined}
          state={pending === 'createAccount' ? 'busy' : formOk ? 'done' : 'idle'}
        />
      </View>

      {formOk && adapter.resendConfirmation && <Press haptic="light" disabled={busy}
        accessibilityRole="button" accessibilityState={{ disabled: busy, busy: resending }}
        onPress={() => void resend()} style={st.resendRow}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{resending ? 'Sending confirmation…' : 'Resend confirmation email'}</Text>
      </Press>}

      <Press haptic="light" style={[st.switchRow, busy && { opacity: 0.5 }]} accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => leave(onSignIn)}>
        <Text key={fontScale} style={[type.small, { color: paper.inkSoft }]}>
          <Text style={st.switchWord}>I already have an account</Text>
        </Text>
      </Press>
</> : undefined}
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
      <AuthForm onSubmit={() => void submit()}>
      <View style={st.fields}>
        <View ref={emailGroup} collapsable={false} onLayout={keepFocusedVisible}>
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={(value) => { setEmail(value); onEmailChange?.(value); setEmailError(null); clearResult(); }}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          error={emailError}
          returnKeyType="next"
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={() => {

            if (busy || requestRunning.current) return;
            if (looksLikeEmail(email)) { setEmailError(null); passwordRef.current?.focus(); }
            else { setEmailError('Enter a valid email address.'); keepFocusedVisible(); }
          }}
          onFocus={() => { focused.current = 'email'; keepFocusedVisible(); }}
          onBlur={() => {  if (focused.current === 'email') focused.current = null; }}
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
            placeholder="Enter password"
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
          {password.length > 0 && <PasswordMeter value={password} />}
        </View>
        <View ref={confirmGroup} collapsable={false} onLayout={keepFocusedVisible} style={st.passwordGroup}><Field
          ref={confirmRef}
          label="Confirm password"
          value={confirm}
          onChangeText={(value) => { setConfirm(value); setConfirmError(null); clearResult(); }}
          placeholder="Enter confirm password"
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
          {confirm.length > 0 && confirmError === null && <Feedback kind="selection" active={match}>
            <View style={[st.confirmFeedback, { minHeight: type.small.lineHeight * 2 * fontScale }]}>
              {match && <CheckGlyph size={16} color={paper.ink} />}
              <Text key={fontScale} accessibilityLiveRegion="polite" style={[type.small, st.feedbackText]}>
                {match ? 'Passwords match.' : 'Enter the same password again.'}
              </Text>
            </View>
          </Feedback>}
        </View>
      </View>
      </AuthForm>

      <Text style={[boldType.small, { color: c.muted, marginTop: 12 }]}>Use at least {PASSWORD_MIN} characters. A longer phrase can be easier to remember.</Text>
      {/* Provider choices remain embedded beneath the form. */}
      <View style={st.doors}>
        <View style={st.provider}>
        <ProviderButton provider="google" onPress={() => void google()} disabled={busy} busy={pending === 'google'} />
        </View>
        {appleOffered && (
          <View style={st.provider}>
          <ProviderButton provider="apple" onPress={() => void apple()} disabled={busy} busy={pending === 'apple'} />
          </View>
        )}
      </View>

      {providerMessage != null && (
        <View style={[st.message, { marginTop: space(3) }]}>
          <View style={st.messageMark}><AlertGlyph size={16} color={paper.ink} /></View>
          <Text key={fontScale} accessibilityLiveRegion="polite" style={[type.body, ROW_WORDS, { color: paper.ink }]}>{providerMessage}</Text>
        </View>
      )}

      {/* In ink, never red. A refusal carries the alert mark the fields use, so
          the difference from a "check your email" line is not colour alone. */}
      {formOk && <BoldScene kind="email" width={160} />}
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



      </View>
    </OnboardingLayout>
    <Sheet reading returnFocus={headingRef} visible={legal !== null} title={legal === 'terms' ? 'Terms of Use' : 'Privacy Policy'} onClose={() => setLegal(null)}>
      {legal === 'terms' ? <TermsScreen onBack={() => setLegal(null)} /> : legal === 'privacy' ? <PolicyScreen onBack={() => setLegal(null)} /> : null}
    </Sheet>
    </>
  );
}

const st = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: space(2) },
  bandArt: { position: 'absolute', right: 8, top: 27 },
  bandWords: { maxWidth: '52%' },
  head: { marginBottom: 12, alignItems: 'center' },
  fields: { gap: 10 },
  passwordGroup: { gap: space(1.5) },
  confirmFeedback: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), minHeight: type.small.lineHeight * 2 },
  feedbackText: { flex: 1, color: paper.inkSoft },
  action: { marginTop: space(4) },
  doors: { flexDirection: 'column', gap: 8, marginTop: 12 },
  provider: { flex: 1, minWidth: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(3) },
  rule: { flex: 1, height: HAIRLINE, backgroundColor: paper.line },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(3) },
  messageMark: { paddingTop: space(1) },
  resendRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', marginTop: space(2) },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', marginTop: space(2) },
  switchWord: { ...boldType.label, color: c.violet },
});
