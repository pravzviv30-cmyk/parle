/**
 * Sign back in. Forgot-password lives here as an inline state, not a page:
 * type the email, tap the link, watch this same screen confirm the send.
 *
 * Native keyboard insets and focused-field scrolling keep the active input
 * visible. The primary action is inline and hides during software keyboard use.
 * Sign-in hides onboarding progress. The reset link, messages and account
 * switch stay in the body.
 *
 * Revamp B (F601): the same family as sign-up. The provider doors lead the
 * body, above an "or" rule and the two fields. Provider pills share a row and
 * stack for larger text. Returning
 * devices use the full page; a guest opens it in a sheet after practice.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, findNodeHandle, Platform, View, Text, StyleSheet, type TextInput, type ScrollView as NativeScrollView } from 'react-native';
import { colour, paper, space, type, HIT, STROKE } from '../theme.ts';
import { PillButton, GhostButton, Press, GoogleMark, AppleMark, AlertGlyph, ArrowRight, ROW_WORDS } from '../components.tsx';
import { AccountField as Field } from './AccountField.tsx';
import { BoldScene } from '../onboarding/motion/BoldScene.tsx';
import { ProviderButton } from './ProviderButton.tsx';
import { BoldButton } from '../onboarding/BoldButton.tsx';
import { boldType, c } from '../onboarding/boldRhythm.ts';
import { useFormKeyboard } from './useFormKeyboard.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { visibleFormHeight } from './signupForm.ts';
import { useReduceMotion } from '../motion.ts';
import { readingColumn, ScrollScreen, useFontScale, useScreenGeometry } from '../layout.tsx';
import { useAuth } from './useAuth.tsx';
import { looksLikeEmail } from './validate.ts';
import { authButtonLabel, type AuthAction } from './busyLabel.ts';
import { appleSignInOffered } from './apple.ts';
import { SIGN_IN_PURPOSE, welcomeBackGreeting } from './copy.ts';
import { friendly } from './friendly.ts';
import { welcomeLayout } from './welcomeLayout.ts';
import { WelcomeOrb } from './WelcomeOrb.tsx';
import { welcomeDividerInk } from '../palette.ts';
import { WelcomeSignInGlow } from './WelcomeSignInGlow.tsx';
import { RevealItem } from '../onboarding/motion/OnboardingScenes.tsx';

import { OnboardingLayout, useOnboardingFramePresentation } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import type { PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';

export function SignInScreen({ onBack, onCreateAccount, onboarding = false, planDraft = null, onEmailChange, embedded = false }: { onBack?: () => void; onCreateAccount: () => void; onboarding?: boolean; planDraft?: PreAccountOnboardingDraft | null; onEmailChange?: (email: string) => void; embedded?: boolean }) {
  const { adapter } = useAuth();
  const [mode, setMode] = useState<'signin' | 'reset' | 'reset-sent'>('signin');
  const [email, setEmail] = useState(planDraft?.accountEmail ?? '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  // One flag for the screen, and it names the request that is running. Every
  // other button disables while anything is in flight; the active button
  // keeps its colour and shows the request label and spinner.
  const [pending, setPending] = useState<AuthAction | null>(null);
  const busy = pending !== null;
  const fontScale = useFontScale();
  const geometry = useScreenGeometry();
  const layout = welcomeLayout(geometry.usableHeight, fontScale, geometry.compact);
  // Refresh Fabric's text measurements after a live Dynamic Type change,
  // using the same uncapped typography revision as AccountField.
  const liveFontMultiplier = fontScale + 1;
  // Sign-in is a returning-user door, including detours from new-user setup.
  useOnboardingFramePresentation(onboardingProgress({ page: 'account' }), { hideProgress: true }, !embedded);
  const alive = useRef(true);
  const requestRunning = useRef(false);
  const headingRef = useRef<Text>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const emailGroup = useRef<View>(null);
  const passwordGroup = useRef<View>(null);
  const scrollRef = useRef<NativeScrollView>(null);
  const scrollOffset = useRef(0);
  const focused = useRef<'email' | 'password' | null>(null);
  const focusFrame = useRef<number | null>(null);
  const focusMeasurement = useRef(0);
  const reduced = useReduceMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const keepFocusedVisible = () => {
    if (focused.current === null) return;
    const ticket = ++focusMeasurement.current;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const input = focused.current === 'email' ? emailRef.current : passwordRef.current;
      const group = focused.current === 'email' ? emailGroup.current : passwordGroup.current;
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
  useEffect(() => { keepFocusedVisible(); }, [emailError, formMessage, providerMessage, fontScale]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    const message = providerMessage ?? formMessage;
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [providerMessage, formMessage]);
  useEffect(() => {
    if (!onboarding || embedded) return;
    const node = headingRef.current;
    if (Platform.OS === 'web') (node as unknown as { focus?: () => void })?.focus?.();
    else { const handle = findNodeHandle(node); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
  }, [onboarding, embedded]);
  // Asked once, and false until it answers. A door is drawn only where the
  // platform can open it; Android and web use configured browser OAuth, and
  // an iPhone too old for it says no as well. Drawing the button first and
  // hiding it after would flash a door that was never there.
  const [appleOffered, setAppleOffered] = useState(false);
  useEffect(() => {
    if (!onboarding || !onBack || embedded) return;
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (!requestRunning.current && !busy) onBack(); return true; });
    return () => back.remove();
  }, [onboarding, onBack, embedded, busy]);
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
    if (requestRunning.current) return;
    const emailProblem = looksLikeEmail(email) ? null : 'That does not look like an email address.';
    setEmailError(emailProblem);
    setFormMessage(null);
    setProviderMessage(null);
    if (emailProblem) return;
    if (!password) { setFormMessage('Enter your password to sign in.'); passwordRef.current?.focus(); return; }
    Keyboard.dismiss();
    requestRunning.current = true;
    setPending('signIn');
    try {
      const result = await adapter.signInWithPassword(email.trim(), password);
      if (alive.current && !result.ok) { setFormOk(false); setFormMessage(result.message); }
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

  const forgot = async () => {
    if (busy) return;
    if (requestRunning.current) return;
    setProviderMessage(null);
    const emailProblem = looksLikeEmail(email) ? null : 'Type your email above first, then tap this again.';
    setEmailError(null);
    if (emailProblem) {
      setFormOk(false);
      setFormMessage(emailProblem);
      return;
    }
    Keyboard.dismiss();
    requestRunning.current = true;
    setPending('sendReset');
    try {
      const result = await adapter.sendPasswordReset(email.trim());
      if (!alive.current) return;
      setFormOk(result.ok);
      if (result.ok) setMode('reset-sent');
      setFormMessage(result.ok ? result.message ?? 'Check your email for a reset link.' : result.message);
    } catch (error) {
      if (alive.current) { setFormOk(false); setFormMessage(friendly(error as { message?: string })); }
    } finally {
      requestRunning.current = false;
      if (alive.current) setPending(null);
    }
  };

  const Frame = OnboardingLayout;
  const returnToSignIn = () => { if (busy || requestRunning.current) return; setMode('signin'); setFormMessage(null); setFormOk(false); };
  if (mode !== 'signin') return <OnboardingLayout page="signin" hideProgress embedded={embedded}
    scrollRef={scrollRef} automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    footer={!keyboardVisible ? <View style={{ gap: 4 }}>
      {mode === 'reset' && <BoldButton label={authButtonLabel('sendReset', pending === 'sendReset')} state={pending === 'sendReset' ? 'busy' : 'idle'} disabled={busy} onPress={() => void forgot()} />}
      <GhostButton label="Return to sign in" disabled={busy} onPress={returnToSignIn} color={c.violet} />
    </View> : undefined}>
    <View style={{ gap: 18 }}>
      <Text ref={headingRef} accessibilityRole="header" style={[boldType.title, { color: c.ink, textAlign: 'center' }]}>{mode === 'reset-sent' ? 'Check your email.' : 'Forgot your password?'}</Text>
      {mode === 'reset-sent' ? <><BoldScene kind="reset" width={220} /><Text style={[boldType.body, { color: c.muted, textAlign: 'center' }]}>We sent a password reset link to {email.trim()}. Open it to choose a new password.</Text><GhostButton label={pending === 'sendReset' ? 'Sending…' : 'Resend reset email'} disabled={busy} onPress={() => void forgot()} color={c.violet} /></>
      : <><Text style={[boldType.body, { color: c.muted, textAlign: 'center' }]}>We’ll send you a link to choose a new one.</Text><Field ref={emailRef} label="Email" value={email} onChangeText={value => { setEmail(value); onEmailChange?.(value); setEmailError(null); }} placeholder="Enter your email" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy} error={emailError} returnKeyType="done" onSubmitEditing={() => void forgot()} /></>}
      {formMessage != null && !formOk && <Text accessibilityRole="alert" style={[boldType.body, { color: c.ink }]}>{formMessage}</Text>}
    </View>
  </OnboardingLayout>;
  return (
    <Frame
      dismissKeyboardOnBackground
      page="signin"
      hideProgress
      embedded={embedded}
      center={false}
      footer={<>      {!keyboardVisible && <View style={{ gap: 4 }}>
        <BoldButton label={authButtonLabel('signIn', pending === 'signIn')} onPress={() => void submit()} state={pending === 'signIn' ? 'busy' : 'idle'} disabled={busy && pending !== 'signIn'} />
      </View>}

      {/* The primary action returns after keyboard dismissal, inside the body. */}
      {!keyboardVisible && <Press haptic="light" frame={{ alignSelf: 'center' }} style={st.switchRow} accessibilityRole="button" disabled={busy} onPress={() => { if (!requestRunning.current && !busy) onCreateAccount(); }}>
        <Text maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, { color: paper.inkSoft }]}>
          <Text maxFontSizeMultiplier={liveFontMultiplier} style={st.switchWord}>Create an account</Text>
        </Text>
      </Press>}
</>}
      scrollRef={scrollRef}
      scrollEventThrottle={16}
      onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      onViewportLayout={keepFocusedVisible}
    >
      <View style={readingColumn}>
      <RevealItem active={!embedded}>
      {/* Welcome back is personal only when this flow already has a saved name. */}
      {!embedded && <View style={[st.head, layout.compact && st.headCompact]}>

        <Text ref={headingRef} maxFontSizeMultiplier={liveFontMultiplier} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[boldType.returningTitle, { color: c.ink, textAlign: 'center', letterSpacing: 0 }]}>Good to have{'\n'}you back.</Text>
      </View>}
      <View style={{ gap: 12, marginTop: embedded ? 0 : fontScale > 1.3 ? 32 : 64 }}>
        <View ref={emailGroup} collapsable={false} onLayout={keepFocusedVisible}>
        <Field
          ref={emailRef}
          label="Email"
          labelWeight="medium"
          value={email}
          onChangeText={(value) => { setEmail(value); onEmailChange?.(value); setEmailError(null); }}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          error={emailError}
          returnKeyType="next"
          submitBehavior="submit"
          blurOnSubmit={false}
          onFocus={() => { focused.current = 'email'; keepFocusedVisible(); }}
          onBlur={() => {  if (focused.current === 'email') focused.current = null; }}
          onSubmitEditing={() => {

            if (busy || requestRunning.current) return;
            if (looksLikeEmail(email)) { setEmailError(null); passwordRef.current?.focus(); }
            else setEmailError('Enter a valid email address.');
          }}
        />
        </View>
        <View ref={passwordGroup} collapsable={false} onLayout={keepFocusedVisible}>
        <Field
          ref={passwordRef}
          label="Password"
          labelWeight="medium"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          secure
          autoComplete="current-password"
          textContentType="password"
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          onFocus={() => { focused.current = 'password'; keepFocusedVisible(); }}
          onBlur={() => { if (focused.current === 'password') focused.current = null; }}
        />
        </View>
      </View>

      {/* The reset link sits under the password it is about, centred below the field. */}
      <View style={st.forgot}>
        <GhostButton
          label="Forgot your password?"
          onPress={() => { if (!busy) { setMode('reset'); setFormMessage(null); } }}
          disabled={busy}
          color={colour.blue}
          small
        />
      </View>

      {/* The provider doors lead the form, stacking when text needs more room. */}
      <View style={[st.doors, layout.compact && st.doorsCompact, fontScale > 1.3 && st.doorsStacked, embedded && { marginTop: 0 }]}>
        <View style={st.door}>
        <ProviderButton provider="google" onPress={() => void google()} disabled={busy} busy={pending === 'google'} />
        </View>
        {appleOffered && (
          <View style={st.door}>
          <ProviderButton provider="apple" onPress={() => void apple()} disabled={busy} busy={pending === 'apple'} />
          </View>
        )}
      </View>

      {providerMessage != null && (
        <View style={[st.message, { marginTop: space(3) }]}>
          <View style={st.messageMark}><AlertGlyph size={16} color={paper.ink} /></View>
          <Text maxFontSizeMultiplier={liveFontMultiplier} accessibilityLiveRegion="polite" style={[type.body, ROW_WORDS, { color: paper.ink }]}>{providerMessage}</Text>
        </View>
      )}

      {/* In ink, never red. A refusal carries the alert mark the fields use, so
          the difference from a "check your email" line is not colour alone. */}
      {formOk && <BoldScene kind="reset" width={160} />}
      {formMessage != null && (
        <View style={st.message}>
          {!formOk && (
            <View style={st.messageMark}>
              <AlertGlyph size={16} color={paper.ink} />
            </View>
          )}
          <Text maxFontSizeMultiplier={liveFontMultiplier} accessibilityLiveRegion="polite" style={[type.body, ROW_WORDS, { color: paper.ink }]}>{formMessage}</Text>
        </View>
      )}

      </RevealItem>
      </View>
    </Frame>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center', gap: space(2) },
  headCompact: { gap: space(1) },
  doors: { flexDirection: 'column', alignItems: 'stretch', gap: 12, marginTop: 12 },
  doorsCompact: { marginTop: space(3) },
  doorsStacked: { flexDirection: 'column' },
  door: { flex: 1, minWidth: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(4) },
  orCompact: { marginVertical: space(2) },
  rule: { flex: 1, height: STROKE, backgroundColor: welcomeDividerInk },
  orLabel: { color: welcomeDividerInk, fontFamily: type.heading.fontFamily },
  forgot: { alignItems: 'center', marginTop: 12 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginBottom: space(2) },
  messageMark: { paddingTop: space(1) },
  action: { marginTop: 80 },
  switchRow: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  switchWord: { ...boldType.label, color: c.violet },
});
