/**
 * The signed-out flow: welcome, create account, sign in. The same hand-rolled
 * discriminated-union machine the rest of the app navigates with — three
 * screens do not need a navigation library either.
 *
 * The welcome itself lives in `onboarding/`, not here. It is the app's single
 * product introduction rather than a page of the auth flow, so it sits with the
 * rest of the first run; this flow only decides when to show it.
 *
 * ## The under-13 refusal holds for the launch (F637, F639, F641)
 *
 * The first run can be left and entered again in one launch. "I have an
 * account", then sign-in's back, mounts the welcome afresh, and a sign-in
 * followed by a sign-out mounts this whole flow afresh. A refusal kept in the
 * screen's own state, or in this flow's, was undone by one of those. So `Gate`
 * in `App.tsx`, which stays mounted for the whole launch, holds it. The screen
 * says so once through `onRefuse`, and this flow hands it back as `refused`
 * every time the first run is drawn again, opening on the refusal page rather
 * than the first page. While refused, the one door to sign-up leads to that
 * page instead, so sign-in's "Create one" is not a way round it, and the save
 * page's create-account handler writes nothing.
 *
 * The same moment clears the saved first-run draft, first name and all. The
 * refusal itself is memory only and never reaches the device: a marker would be
 * new data about a minor, which the founder did not choose (2026-09-30).
 * Signing in and out again does not end it; only closing the app does. After a
 * relaunch the question can be asked again, the same close-the-app escape the
 * age gate keeps.
 */

import { useState } from 'react';
import { PreAccountOnboarding } from '../onboarding/PreAccountOnboarding.tsx';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { SignUpScreen } from './SignUpScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';

type AuthScreen = 'welcome' | 'signup' | 'signin';

/**
 * Where the first run opens once refused: the save page, which the screen draws
 * as the refusal. It carries no answers and no first name, and it is never
 * saved, because a refused screen writes nothing to the draft. The draft the
 * learner had is not handed back either: the refusal cleared it.
 */
const refusalPage = (): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), page: 'save' });

export function AuthFlow({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
  refused,
  onRefuse,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
  /** An under-13 answer given earlier in this launch, held by `Gate`, which outlives this flow. */
  refused: boolean;
  /** Tells `Gate` the learner said they are under 13, so it holds the refusal and clears the saved draft. */
  onRefuse: () => void;
}) {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const [signupDraft, setSignupDraft] = useState<PreAccountOnboardingDraft | null>(null);

  /** The one door to sign-up. Once refused it opens the refusal page instead. */
  const toSignUp = () => setScreen(refused ? 'welcome' : 'signup');

  if (screen === 'signup') {
    return <SignUpScreen planDraft={refused ? null : signupDraft} onBack={() => setScreen('welcome')} onSignIn={() => {
      setSignupDraft(null);
      onSignIn();
      setScreen('signin');
    }} />;
  }
  if (screen === 'signin') {
    return <SignInScreen onBack={() => setScreen('welcome')} onCreateAccount={toSignUp} />;
  }
  return (
    <PreAccountOnboarding
      initialDraft={refused ? refusalPage() : initialDraft}
      onDraftChange={onDraftChange}
      onCreateAccount={(draft) => {
        if (!refused) {
          setSignupDraft(draft);
          onCreateAccount(draft);
        }
        toSignUp();
      }}
      onSignIn={() => {
        setSignupDraft(null);
        onSignIn();
        setScreen('signin');
      }}
      refused={refused}
      onRefuse={onRefuse}
    />
  );
}
