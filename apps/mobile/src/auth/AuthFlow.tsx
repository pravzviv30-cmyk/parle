/** First install starts with value. Returning devices open sign-in directly. */
import { useState } from 'react';
import { View } from 'react-native';
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
import { emptySignUpFormDraft, type SignUpFormDraft } from './signUpFormDraft.ts';

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
  // Back and sign-in detours unmount the form. Its entered values belong to
  // this flow's lifetime, separate from the saved pre-account plan.
  const [signUpFormDraft, setSignUpFormDraft] = useState<SignUpFormDraft>(emptySignUpFormDraft);
  const newAccount = () => {
    const draft = refused ? refusalPage() : freshPreAccountDraft();
    void clearGuestPractice();
    if (initialDraft?.reminderEnabled === true) void cancelReminder();
    setNewDraft(draft);
    if (!refused) onDraftChange(draft);
    setRevision((value) => value + 1);
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
      <View style={{ flex: 1, display: screen === 'welcome' ? 'flex' : 'none' }} accessibilityElementsHidden={screen !== 'welcome'} importantForAccessibility={screen === 'welcome' ? 'auto' : 'no-hide-descendants'}>
      <PreAccountOnboarding
        key={revision}
        initialDraft={refused ? refusalPage() : (newDraft ?? initialDraft)}
        onDraftChange={onDraftChange}
        onCreateAccount={(draft) => {
          if (refused) return;
          onCreateAccount(draft);
          setScreen('signup');
        }}
        onSignIn={signIn}
        refused={refused}
        onRefuse={onRefuse}
      />
      </View>
        {screen === 'signup' ? (
          <SignUpScreen
            formDraft={signUpFormDraft}
            onFormDraftChange={setSignUpFormDraft}
            onBack={() => setScreen('welcome')}
            onSignIn={signIn}
          />
        ) : screen === 'signin' ? (
          <SignInScreen onBack={() => setScreen('welcome')} onCreateAccount={newAccount} />
        ) : null}
    </>
  );
}
