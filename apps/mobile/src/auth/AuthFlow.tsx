/** First install starts with value. Returning devices open sign-in directly. */
import { useState } from 'react';
import { Animated, View } from 'react-native';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
} from '../onboarding/preAccountDraft.ts';
import { signedOutEntry } from '../onboarding/flow.ts';
import { OnboardingFrame, useOnboardingTransition } from '../onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from '../onboarding/onboardingProgress.ts';
import { clearGuestPractice } from '../onboarding/guestPractice.ts';
import { cancelReminder } from '../reminders/schedule.ts';
import { SignUpScreen } from './SignUpScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';

type AuthScreen = 'welcome' | 'signup' | 'signin';
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
  refused,
  onRefuse,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  returning?: boolean;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
  refused: boolean;
  onRefuse: () => void;
}) {
  const [screen, setScreen] = useState<AuthScreen>(!returning && !refused && initialDraft?.page === 'account' ? initialDraft.accountMode === 'signin' ? 'signin' : 'signup' : signedOutEntry(returning));
  const pageMotion = useOnboardingTransition();
  const switchScreen = (next: AuthScreen) => pageMotion.transition(() => setScreen(next));
  const [introducing, setIntroducing] = useState(!returning);
  const [newDraft, setNewDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [signupDraft, setSignupDraft] = useState<PreAccountOnboardingDraft | null>(initialDraft?.page === 'account' ? initialDraft : null);
  const newAccount = () => {
    if (pageMotion.locked.current) return;
    const draft = refused ? refusalPage() : freshPreAccountDraft();
    void clearGuestPractice();
    if (initialDraft?.reminderEnabled === true) void cancelReminder();
    setNewDraft(draft);
    if (!refused) onDraftChange(draft);
    setRevision((value) => value + 1);
    setSignupDraft(null);
    setIntroducing(true);
    switchScreen('welcome');
  };
  const updateAccountEmail = (email: string) => {
    if (refused) return;
    const basis = signupDraft ?? newDraft ?? initialDraft ?? freshPreAccountDraft();
    const changed = { ...basis, accountEmail: email };
    setSignupDraft(changed); onDraftChange(changed);
  };
  const signIn = () => {
    if (pageMotion.locked.current) return;
    if (!refused) {
      const basis = signupDraft ?? newDraft ?? initialDraft ?? freshPreAccountDraft();
      const changed = { ...basis, page: 'account' as const, accountMode: 'signin' as const, accountReturnPage: basis.page === 'account' ? basis.accountReturnPage ?? 'keep' : basis.page ?? 'hear-it' };
      setSignupDraft(changed); onDraftChange(changed);
    }
    onSignIn();
    switchScreen('signin');
  };
  const returnToIntroduction = () => {
    const basis = signupDraft ?? newDraft ?? initialDraft;
    if (basis && !refused) onDraftChange({ ...basis, page: basis.accountReturnPage ?? 'keep' });
    switchScreen('welcome');
  };
  const createFromIntroduction = () => {
    if (pageMotion.locked.current || refused) return;
    const basis = signupDraft ?? newDraft ?? initialDraft;
    if (!basis?.eligibilityConfirmed) { newAccount(); return; }
    const changed = { ...basis, page: 'account' as const, accountMode: 'signup' as const };
    setSignupDraft(changed); onDraftChange(changed); onCreateAccount(changed);
    switchScreen('signup');
  };
  if (!introducing) return <SignInScreen onCreateAccount={newAccount} />;
  return (
    <OnboardingFrame initialProgress={onboardingProgress({ page: initialDraft?.page ?? 'hear-it', five: initialDraft?.onboardingVariant === 'five', skipped: initialDraft?.onboardingSkippedSteps, completed: initialDraft?.onboardingCompletedSteps })}>
      <Animated.View style={[{ flex: 1, minHeight: 0 }, pageMotion.style]}>
      <View style={{ flex: 1, display: screen === 'welcome' ? 'flex' : 'none' }} accessibilityElementsHidden={screen !== 'welcome'} importantForAccessibility={screen === 'welcome' ? 'auto' : 'no-hide-descendants'}>
      <PreAccountOnboarding
        key={revision}
        initialDraft={refused ? refusalPage() : (newDraft ?? initialDraft)}
        active={screen === 'welcome'}
        onDraftChange={onDraftChange}
        onCreateAccount={(draft) => {
          if (refused) return;
          const accountDraft = { ...draft, ...(signupDraft?.accountEmail ? { accountEmail: signupDraft.accountEmail } : {}), page: 'account' as const, accountMode: 'signup' as const, accountReturnPage: draft.page ?? 'keep' };
          setSignupDraft(accountDraft);
          onDraftChange(accountDraft);
          onCreateAccount(accountDraft);
          switchScreen('signup');
        }}
        onSignIn={signIn}
        refused={refused}
        onRefuse={onRefuse}
      />
      </View>
        {screen === 'signup' ? (
          <SignUpScreen
            planDraft={refused ? null : signupDraft}
            onBack={returnToIntroduction}
            onSignIn={signIn}
            onEmailChange={updateAccountEmail}
          />
        ) : screen === 'signin' ? (
          <SignInScreen onboarding planDraft={signupDraft ?? newDraft ?? initialDraft} onEmailChange={updateAccountEmail} onBack={returnToIntroduction} onCreateAccount={createFromIntroduction} />
        ) : null}
      </Animated.View>
    </OnboardingFrame>
  );
}
