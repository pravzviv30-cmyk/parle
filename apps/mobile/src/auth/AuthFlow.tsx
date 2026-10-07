/** First install starts with value. Returning devices open sign-in directly. */
import { useState } from 'react';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
} from '../onboarding/preAccountDraft.ts';
import { signedOutEntry } from '../onboarding/flow.ts';
import { clearGuestPractice } from '../onboarding/guestPractice.ts';
import { cancelReminder } from '../reminders/schedule.ts';
import { SignUpScreen } from './SignUpScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';
import { Sheet } from '../components.tsx';

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
  const [screen, setScreen] = useState<AuthScreen>(signedOutEntry(returning));
  const [introducing, setIntroducing] = useState(!returning);
  const [newDraft, setNewDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const [revision, setRevision] = useState(0);
  const [signupDraft, setSignupDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const newAccount = () => {
    const draft = refused ? refusalPage() : freshPreAccountDraft();
    void clearGuestPractice();
    if (initialDraft?.reminderEnabled === true) void cancelReminder();
    setNewDraft(draft);
    if (!refused) onDraftChange(draft);
    setRevision((value) => value + 1);
    setSignupDraft(null);
    setIntroducing(true);
    setScreen('welcome');
  };
  const signIn = () => {
    onSignIn();
    setScreen('signin');
  };
  if (!introducing) return <SignInScreen onCreateAccount={newAccount} />;
  return (
    <>
      <PreAccountOnboarding
        key={revision}
        initialDraft={refused ? refusalPage() : (newDraft ?? initialDraft)}
        onDraftChange={onDraftChange}
        onCreateAccount={(draft) => {
          if (refused) return;
          setSignupDraft(draft);
          onCreateAccount(draft);
          setScreen('signup');
        }}
        onSignIn={signIn}
        refused={refused}
        onRefuse={onRefuse}
      />
      <Sheet
        visible={screen !== 'welcome'}
        title={screen === 'signup' ? 'Create your account' : 'Sign in'}
        onClose={() => setScreen('welcome')}
      >
        {screen === 'signup' ? (
          <SignUpScreen
            embedded
            planDraft={refused ? null : signupDraft}
            onBack={() => setScreen('welcome')}
            onSignIn={signIn}
          />
        ) : (
          <SignInScreen embedded onBack={() => setScreen('welcome')} onCreateAccount={newAccount} />
        )}
      </Sheet>
    </>
  );
}
