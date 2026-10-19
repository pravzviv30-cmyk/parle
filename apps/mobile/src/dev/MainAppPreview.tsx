/** Developer-only QA. Every fixture write stays in the explicit synthetic scope. */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../auth/useAuth.tsx';
import type { AuthAdapter, AuthResult, AuthUser } from '../auth/types.ts';
import { ProfileGate } from '../app/ProfileContext.tsx';
import { GameProvider } from '../game/GameProvider.tsx';
import { LiveProvider } from '../app/LiveContext.tsx';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { RootNavigator } from '../nav/RootNavigator.tsx';
import { MainAppearanceProvider } from '../main/MainAppearance.tsx';
import { MainNavigationTheme } from '../main/MainNavigationTheme.tsx';
import { createStoredProfile, loadProfile, saveProfile } from '../profile/store.ts';
import { activeUserId, setActiveUser } from '../storage/scope.ts';
import { loadSampleConversation } from '../conversationPacks/sampleFixture.ts';
import { Press } from '../components.tsx';
import { colour, paper, space, type } from '../theme.ts';
import { mainPreviewAllowed, MAIN_PREVIEW_USER_ID } from './mainPreviewGuard.ts';

const user: AuthUser = { id: MAIN_PREVIEW_USER_ID, email: null, provider: 'mock' };
const unavailable = async (): Promise<AuthResult> => ({ ok: false, message: 'Synthetic preview only. No account operation was performed.' });
const adapter: AuthAdapter = {
  kind: 'mock', getSession: async () => user, onAuthStateChange: () => () => {},
  signUpWithPassword: unavailable, signInWithPassword: unavailable,
  signInWithGoogle: unavailable, signInWithApple: unavailable,
  sendPasswordReset: unavailable, completePasswordReset: unavailable,
  reauthenticateForDeletion: unavailable, deleteAccount: unavailable,
  signOut: async () => {}, getAccessToken: async () => null,
};

export function MainAppPreview({ onExit }: { onExit: () => void }) {
  const allowed = mainPreviewAllowed({
    development: __DEV__, nodeEnv: process.env.NODE_ENV,
    screenPreview: process.env.EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW,
    localDevelopment: process.env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL, supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    tokenServerUrl: TOKEN_SERVER,
  });
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    if (!allowed) return;
    // Fast refresh must remount all account-bound providers with the new scope.
    setState('loading');
    let cancelled = false;
    const previous = activeUserId();
    setActiveUser(MAIN_PREVIEW_USER_ID);
    const current = () => !cancelled && activeUserId() === MAIN_PREVIEW_USER_ID;
    void (async () => {
      const existing = await loadProfile();
      if (!current()) return;
      if (!existing && !(await saveProfile({
        ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null, dailyGoalMin: 10 }),
        tutorVoice: 'emilie', practicePreferences: { level: 'getby', confidence: 'trying', focus: 'speaking' },
      }))) throw new Error('Preview profile unavailable');
      if (!current()) return;
      const sample = await loadSampleConversation(user, adapter);
      if (!sample.ok) throw new Error('Preview conversation unavailable');
      if (current()) setState('ready');
    })().catch(() => { if (current()) setState('failed'); });
    return () => { cancelled = true; if (activeUserId() === MAIN_PREVIEW_USER_ID) setActiveUser(previous); };
  }, [allowed]);
  if (!allowed) return <Text style={[type.body, { color: paper.ink }]}>Main app preview requires an isolated local development build.</Text>;
  return <View style={{ flex: 1 }}>
    <Press accessibilityRole="button" accessibilityLabel="Synthetic main app preview. Return to screen selector" onPress={onExit} style={{ minHeight: 44, backgroundColor: colour.sun, paddingHorizontal: space(4), justifyContent: 'center' }}>
      <Text style={[type.small, { color: paper.ink }]}>Synthetic learner. Sample conversation. Exit preview</Text>
    </Press>
    {state !== 'ready' ? <Text style={[type.body, { color: paper.ink, padding: space(5) }]}>{state === 'failed' ? 'The isolated preview could not be prepared. Return to the selector and try again.' : 'Preparing the isolated preview…'}</Text> : <AuthProvider adapter={adapter}>
      <ProfileGate onSignOut={onExit} onboarding={() => <Text>Preview profile unavailable.</Text>}>
        <GameProvider><LiveProvider><MainAppearanceProvider><MainNavigationTheme>{theme => <NavigationContainer theme={theme}>
          <RootNavigator onSignOut={onExit} onDeleteAccount={unavailable} />
        </NavigationContainer>}</MainNavigationTheme></MainAppearanceProvider></LiveProvider></GameProvider>
      </ProfileGate>
    </AuthProvider>}
  </View>;
}
