import { SceneActivity } from '../onboarding/motion/SceneActivity.ts';
/** First install starts with value. Returning devices open sign-in directly. */
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
} from '../onboarding/preAccountDraft.ts';
import { signedOutEntry } from '../onboarding/flow.ts';
import { OnboardingFrame, OnboardingLayout, useOnboardingTransition } from '../onboarding/OnboardingLayout.tsx';
import { BoldScene } from '../onboarding/motion/BoldScene.tsx';
import { BoldButton } from '../onboarding/BoldButton.tsx';
import { boldType, c } from '../onboarding/boldRhythm.ts';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import { clearGuestPractice } from '../onboarding/guestPractice.ts';
import { cancelReminder } from '../reminders/schedule.ts';
import { SignUpScreen } from './SignUpScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';
import { emptySignUpFormDraft, type SignUpFormDraft } from './signUpFormDraft.ts';

type AuthScreen = 'welcome' | 'signup' | 'signin' | 'resume';
const refusalPage = (): PreAccountOnboardingDraft => ({
  ...freshPreAccountDraft(),
  page: 'save',
});

export function AuthFlow({
  initialDraft,
  returning = false,
  onDraftChange,
  onCreateAccount,
  onSignIn,
  onDiscardDraft,
  refused,
  onRefuse,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  returning?: boolean;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
  onDiscardDraft: () => void;
  refused: boolean;
  onRefuse: () => void;
}) {
  const resumable = !returning && !refused && initialDraft?.page != null && !['hear-it', 'account'].includes(initialDraft.page);
  const [screen, setScreen] = useState<AuthScreen>(resumable ? 'resume' : !returning && !refused && initialDraft?.page === 'account' ? initialDraft.accountMode === 'signin' ? 'signin' : 'signup' : signedOutEntry(returning));
  const pageMotion = useOnboardingTransition();
  const switchScreen = (next: AuthScreen, onSwitched?: () => void) => pageMotion.transition(() => { setScreen(next); onSwitched?.(); });
  const [introducing, setIntroducing] = useState(!returning);
  const [accountFirst, setAccountFirst] = useState(!refused && initialDraft?.page === 'account' && initialDraft.accountReturnPage === 'hear-it');
  const [newDraft, setNewDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [signupDraft, setSignupDraft] = useState<PreAccountOnboardingDraft | null>(initialDraft?.page === 'account' ? initialDraft : null);
  // Back and sign-in detours unmount the form. Its entered values belong to
  // this flow's lifetime, separate from the saved pre-account plan.
  const [signUpFormDraft, setSignUpFormDraft] = useState<SignUpFormDraft>(emptySignUpFormDraft);
  const restarting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartError, setRestartError] = useState(false);
  const [accountRestart, setAccountRestart] = useState(false);
  const restartPlan = async () => {
    if (!mounted.current || restarting.current || pageMotion.locked.current) return;
    restarting.current = true; setRestartBusy(true); setRestartError(false);
    try {
      await clearGuestPractice();
      if (!mounted.current) return;
      if (initialDraft?.reminderEnabled === true && (await cancelReminder()) === 'failed') throw new Error('reminder cancellation failed');
      if (!mounted.current) return;
      onDiscardDraft();
      const draft = freshPreAccountDraft();
      setNewDraft(draft); setSignupDraft(null); setAccountFirst(false);
      setRevision(value => value + 1);
      onDraftChange(draft);
      switchScreen('welcome');
    } catch { if (mounted.current) setRestartError(true); }
    finally { restarting.current = false; if (mounted.current) setRestartBusy(false); }
  };
  const newAccount = async () => {
    if (!mounted.current || restarting.current || pageMotion.locked.current) return;
    restarting.current = true;
    setRestartBusy(true); setRestartError(false); setAccountRestart(true);
    try {
      await clearGuestPractice();
      if (!mounted.current) return;
      if (initialDraft?.reminderEnabled === true && (await cancelReminder()) === 'failed') throw new Error('reminder cancellation failed');
      if (!mounted.current) return;
      const draft = refused ? refusalPage() : freshPreAccountDraft();
      // Keep the old plan until both of its cleanup owners have settled.
      if (!refused) onDiscardDraft();
      setNewDraft(draft);
      // An empty account must reach signed-in onboarding, not bootstrap a
      // profile from an unanswered anonymous draft.
      setRevision((value) => value + 1);
      setSignupDraft(null);
      setIntroducing(true);
      setAccountFirst(!refused);
      switchScreen(refused ? 'welcome' : 'signup', () => { if (mounted.current) setAccountRestart(false); });
    } catch {
      if (mounted.current) setRestartError(true);
    } finally {
      restarting.current = false;
      if (mounted.current) setRestartBusy(false);
    }
  };
  const acceptAccountTerms = (email: string) => {
    if (refused) return false;
    const basis = signupDraft ?? newDraft ?? initialDraft ?? freshPreAccountDraft();
    const changed = { ...basis, eligibilityConfirmed: true, accountEmail: email, page: 'account' as const,
      accountMode: 'signup' as const, accountReturnPage: accountFirst ? 'hear-it' as const : basis.accountReturnPage ?? 'keep' as const };
    setSignupDraft(changed);
    if (accountFirst) setNewDraft(changed);
    onDraftChange(changed);
    return true;
  };
  const updateAccountEmail = (email: string) => {
    if (refused || accountFirst) return;
    const basis = signupDraft ?? newDraft ?? initialDraft ?? freshPreAccountDraft();
    const changed = { ...basis, accountEmail: email };
    setSignupDraft(changed); onDraftChange(changed);
  };
  const signIn = (currentDraft?: PreAccountOnboardingDraft) => {
    if (pageMotion.locked.current) return;
    if (!refused && !accountFirst) {
      const basis = currentDraft ?? signupDraft ?? newDraft ?? initialDraft ?? freshPreAccountDraft();
      const changed = { ...basis, ...(typeof signupDraft?.accountEmail === 'string' ? { accountEmail: signupDraft.accountEmail } : {}), page: 'account' as const, accountMode: 'signin' as const, accountReturnPage: basis.page === 'account' ? basis.accountReturnPage ?? 'keep' : basis.page ?? 'hear-it' };
      setSignupDraft(changed); onDraftChange(changed);
    }
    onSignIn();
    switchScreen('signin');
  };
  const returnToIntroduction = () => {
    if (accountFirst) { switchScreen('signin'); return; }
    const basis = signupDraft ?? newDraft ?? initialDraft;
    if (basis && !refused) onDraftChange({ ...basis, page: basis.accountReturnPage ?? 'keep' });
    switchScreen('welcome');
  };
  const createFromIntroduction = () => {
    if (pageMotion.locked.current || refused) return;
    if (accountFirst) { switchScreen('signup'); return; }
    const basis = signupDraft ?? newDraft ?? initialDraft;
    if (!basis?.eligibilityConfirmed) { newAccount(); return; }
    const changed = { ...basis, page: 'account' as const, accountMode: 'signup' as const };
    setSignupDraft(changed); onDraftChange(changed); onCreateAccount(changed);
    switchScreen('signup');
  };
  if (accountRestart) return <Animated.View style={[{ flex: 1, minHeight: 0 }, pageMotion.style]}>
    <OnboardingLayout page="signin" hideProgress center footer={restartError && !restartBusy ? <View style={{ gap: 12 }}>
      <BoldButton label="Try again" onPress={() => void newAccount()} />
      <BoldButton label="Back to sign in" tone="white" onPress={() => { if (!restarting.current) pageMotion.transition(() => { if (mounted.current) { setRestartError(false); setAccountRestart(false); } }); }} />
    </View> : undefined}>
      <View style={{ alignItems: 'center', gap: 20 }}>
        <BoldScene kind={restartError ? 'retry' : 'saving'} width={220} />
        <Text accessibilityRole="header" style={[boldType.title, { color: c.ink, textAlign: 'center' }]}>A fresh start.</Text>
        <Text accessibilityLiveRegion="polite" style={[boldType.body, { color: c.muted, textAlign: 'center' }]}>{restartError ? 'We couldn’t prepare your new plan. Your previous plan has not been discarded. Try again or return to sign in.' : 'Preparing your new plan…'}</Text>
      </View>
    </OnboardingLayout>
  </Animated.View>;
  if (!introducing) return <SignInScreen onCreateAccount={newAccount} />;
  return (
    <OnboardingFrame initialProgress={onboardingProgress({ page: accountFirst ? 'hear-it' : initialDraft?.page ?? 'hear-it', five: initialDraft?.onboardingVariant === 'five', skipped: initialDraft?.onboardingSkippedSteps, completed: initialDraft?.onboardingCompletedSteps })}>
      <Animated.View style={[{ flex: 1, minHeight: 0 }, pageMotion.style]}>
      {screen === 'resume' && <OnboardingLayout page="resume" center={false}>
        <View style={{ gap: 24, alignItems: 'center' }}>
          <Text accessibilityRole="header" style={[boldType.title, { color: c.ink, textAlign: 'center' }]}>Pick up where you left off.</Text>
          <Text style={[boldType.body, { color: c.muted, textAlign: 'center' }]}>Your French plan and confirmed practice are still here.</Text>
          <BoldScene kind="resume" width={240} />
          {restartError && <Text accessibilityLiveRegion="polite" style={[boldType.body, { color: c.ink }]}>We couldn’t clear the previous practice. Try again.</Text>}
          <View style={{ width: '100%', gap: 12 }}>
            <BoldButton label="Continue my plan" disabled={restartBusy} onPress={() => switchScreen('welcome')} />
            <BoldButton label="Start a new plan" tone="white" disabled={restartBusy} state={restartBusy ? 'busy' : 'idle'} onPress={() => void restartPlan()} />
          </View>
        </View>
      </OnboardingLayout>}
      <SceneActivity.Provider value={screen === 'welcome'}>
      <View pointerEvents={screen === 'welcome' ? 'auto' : 'none'} style={{ flex: 1, display: screen === 'welcome' ? 'flex' : 'none' }} accessibilityElementsHidden={screen !== 'welcome'} importantForAccessibility={screen === 'welcome' ? 'auto' : 'no-hide-descendants'}>
      {!accountFirst && <PreAccountOnboarding
        key={revision}
        initialDraft={refused ? refusalPage() : (newDraft ?? initialDraft)}
        active={screen === 'welcome'}
        onDraftChange={onDraftChange}
        onCreateAccount={(draft) => {
          if (refused) return;
          const accountDraft = { ...draft, ...(typeof signupDraft?.accountEmail === 'string' ? { accountEmail: signupDraft.accountEmail } : {}), page: 'account' as const, accountMode: 'signup' as const, accountReturnPage: draft.page ?? 'keep' };
          setSignupDraft(accountDraft);
          onDraftChange(accountDraft);
          onCreateAccount(accountDraft);
          switchScreen('signup');
        }}
        onSignIn={signIn}
        refused={refused}
        onRefuse={onRefuse}
      />}
      </View>
      </SceneActivity.Provider>
        {screen === 'signup' ? (
          <SignUpScreen
            accountFirst={accountFirst}
            planDraft={refused ? null : signupDraft}
            formDraft={signUpFormDraft}
            onFormDraftChange={setSignUpFormDraft}
            onBack={returnToIntroduction}
            onSignIn={() => signIn()}
            onEmailChange={updateAccountEmail}
            onTermsAccepted={acceptAccountTerms}
          />
        ) : screen === 'signin' ? (
          <SignInScreen onboarding={!accountFirst} planDraft={accountFirst ? null : signupDraft ?? newDraft ?? initialDraft} onEmailChange={updateAccountEmail} onBack={returnToIntroduction} onCreateAccount={createFromIntroduction} />
        ) : null}
      </Animated.View>
    </OnboardingFrame>
  );
}
