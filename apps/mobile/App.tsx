/*
 * ── DIRECTION CONTRACT ───────────────────────────────────────────────────────
 * THESIS: Learning to speak should feel like a warm, unhurried picture book —
 *   calm, friendly, professional. Easy to look at twice a day.
 * OWN-WORLD: Paper & ink. Pale lilac paper, warm black ink, hand-drawn line
 *   art, Fraunces for anything with a voice (headlines and every French line),
 *   DM Sans for the furniture. Flat white cards on a hairline rule; one solid
 *   ink pill per screen. Chrome is plain English; French appears only as the
 *   thing being learned.
 * KEPT FROM THE ENAMEL WORLD (behaviour, not surface): one primary action per
 *   screen; the four support colours cooling as help is withdrawn; the red
 *   live microphone; no scores and no scolding mid-session; 44pt floors.
 * STORY: A welcome that moves, sign in once, four gentle questions, then five
 *   doors along the bottom — Home, Tutor, Practice, Leaderboard, Profile.
 *   Stalling is stepped in for, never commented on.
 * MOTION (new, and the whole vocabulary): transform and opacity only, always
 *   on the native driver; never an SVG attribute; one loop plus one settling
 *   entrance; reduce-motion renders the final frame rather than nothing.
 * FINISH: unreviewed and undocumented is unfinished; the restyle ends with the
 *   finish review and a rewritten DESIGN.md. The enamel design survives at the
 *   repo's baseline commit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { completeProfile, createStoredProfile, type StoredProfile } from './src/profile/store.ts';

import { paper } from './src/theme.ts';
import { auth } from './src/auth/adapter.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import type { AuthUser } from './src/auth/types.ts';
import { clearActiveUserData, migrateLegacyStores, setActiveUser } from './src/storage/scope.ts';
import { loadHistory } from './src/progress/store.ts';
import { backfillFrom } from './src/progress/activity.ts';
import { lessonXp } from '@parle/core';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow.tsx';
import { SplashScreen } from './src/splash/SplashScreen.tsx';
import { hasSeenSplash, markSplashSeen } from './src/splash/store.ts';
import { ProfileGate } from './src/app/ProfileContext.tsx';
import { LiveProvider } from './src/app/LiveContext.tsx';
import { RootNavigator } from './src/nav/RootNavigator.tsx';
import { navTheme, linking } from './src/nav/theme.ts';

function Loading() {
  return (
    <View style={st.loading}>
      <ActivityIndicator color={paper.inkFaint} />
    </View>
  );
}

/**
 * Everything behind the sign-in door. Mounted with `key={user.id}` so an
 * account switch remounts the whole tree with fresh state; the storage scope
 * is set (and legacy data migrated, first account only) before anything that
 * reads a store renders — including the providers, which all read through
 * `userKey()` and would throw if hoisted above this.
 */
function SignedInRoot({ user }: { user: AuthUser }) {
  const [ready, setReady] = useState(false);
  // Bumped to force a remount after a progress reset, so every store re-reads
  // from a now-empty disk instead of holding what it loaded at mount.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setActiveUser(user.id);
    void migrateLegacyStores(user.id)
      .then(async () => {
        // Sessions finished before the activity log existed have no evidence
        // stored to price them properly, so each is credited at the base rate
        // and no more. Without this, everyone already using the app is told on
        // launch day that they are a Beginner with nothing to their name.
        const history = await loadHistory();
        if (history.length > 0) {
          await backfillFrom(history, lessonXp({ wordsProduced: [], unassistedRate: 0 }));
        }
      })
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      setActiveUser(null);
    };
  }, [user.id]);

  const resetProgress = useCallback(async () => {
    await clearActiveUserData();
    setGeneration((g) => g + 1);
  }, []);

  if (!ready) return <Loading />;

  return (
    <ProfileGate
      key={generation}
      onboarding={(existing, done) => (
        <OnboardingFlow
          existing={existing}
          onDone={(answers) => {
            const next: StoredProfile = existing === null ? createStoredProfile(answers) : completeProfile(existing, answers);
            done(next);
          }}
        />
      )}
    >
      <LiveProvider>
        <NavigationContainer
          theme={navTheme}
          // Web only. A native linking config would claim parle://auth/callback,
          // which auth/oauth.native.ts needs for the OAuth round trip.
          {...(Platform.OS === 'web' ? { linking } : {})}
        >
          <RootNavigator onSignOut={() => void auth.signOut()} onResetProgress={() => void resetProgress()} />
        </NavigationContainer>
      </LiveProvider>
    </ProfileGate>
  );
}

/**
 * The door. Loading holds a spinner, a first-ever launch gets the welcome,
 * signed out shows the auth flow, a password-recovery landing interposes its
 * one screen, and a signed-in user gets the app keyed to their account.
 */
function Gate() {
  const { status, user, recovering, clearRecovery } = useAuth();
  // Device-level, and checked before auth: the welcome runs ahead of sign-in,
  // where there is no user scope to key anything to.
  const [seenSplash, setSeenSplash] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void hasSeenSplash().then((seen) => {
      if (!cancelled) setSeenSplash(seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (seenSplash === null || status === 'loading') return <Loading />;
  if (!seenSplash) {
    return (
      <SplashScreen
        onDone={() => {
          void markSplashSeen();
          setSeenSplash(true);
        }}
      />
    );
  }
  if (status === 'signedIn' && user !== null) {
    if (recovering) return <SetNewPasswordScreen onDone={clearRecovery} />;
    return <SignedInRoot key={user.id} user={user} />;
  }
  return <AuthFlow />;
}

export default function App() {
  const [loaded] = useFonts({
    'Fraunces-SemiBold': require('./assets/fonts/Fraunces-SemiBold.ttf'),
    'Fraunces-Bold': require('./assets/fonts/Fraunces-Bold.ttf'),
    'DMSans-Regular': require('./assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('./assets/fonts/DMSans-Medium.ttf'),
    'DMSans-Bold': require('./assets/fonts/DMSans-Bold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider adapter={auth}>
        <View style={st.app}>
          {loaded ? (
            // A phone app that also runs in a browser. Constrained to a phone column
            // rather than stretched — the composition is designed for a thumb.
            // The navigator mounts INSIDE this, so the tab bar is clamped to the
            // column too rather than spanning the whole browser window.
            <View style={st.shell}>
              <Gate />
            </View>
          ) : (
            <Loading />
          )}
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: paper.ground },
  shell: { flex: 1, width: '100%', maxWidth: 460, alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
