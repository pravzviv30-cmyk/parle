/**
 * The signed-out flow: welcome, create account, sign in. The same hand-rolled
 * discriminated-union machine the rest of the app navigates with — three
 * screens do not need a navigation library either.
 *
 * The welcome itself lives in `onboarding/`, not here. It is the app's single
 * product introduction rather than a page of the auth flow, so it sits with the
 * rest of the first run; this flow only decides when to show it.
 */

import { useState } from 'react';
import { WelcomeScreen } from '../onboarding/WelcomeScreen.tsx';
import { SignUpScreen } from './SignUpScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';

type AuthScreen = 'welcome' | 'signup' | 'signin';

export function AuthFlow() {
  const [screen, setScreen] = useState<AuthScreen>('welcome');

  if (screen === 'signup') {
    return <SignUpScreen onBack={() => setScreen('welcome')} onSignIn={() => setScreen('signin')} />;
  }
  if (screen === 'signin') {
    return <SignInScreen onBack={() => setScreen('welcome')} onCreateAccount={() => setScreen('signup')} />;
  }
  return <WelcomeScreen onCreateAccount={() => setScreen('signup')} onSignIn={() => setScreen('signin')} />;
}
