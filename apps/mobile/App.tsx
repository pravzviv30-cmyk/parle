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
 *   screen; the four support colours cooling as help is withdrawn; no scores
 *   and no scolding mid-session; 44pt floors.
 * CHANGED DELIBERATELY: the live microphone is GREEN. Green means you speak,
 *   everywhere, which lets the voice circle's red mean the tutor is speaking
 *   without the two ever reading as one signal.
 * STORY: A welcome that moves, sign in once, three gentle questions, a first
 *   situation to walk into, then five doors along the bottom — Home, Tutor,
 *   Practice, My French, Profile.
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
import type { AuthResult } from './src/auth/types.ts';
import { recoverJournal } from './src/live/journal.ts';
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
  /**
   * Did this learner finish onboarding a moment ago, in this launch?
   *
   * In memory, and deliberately never written to disk. It decides one thing:
   * whether the navigator opens on the mission chooser instead of Home, so the
   * first thing after signing up is choosing something to say rather than
   * reading a summary of a level nobody has earned yet. A persisted flag would
   * be one more piece of state that can get stuck; an app killed between the
   * last onboarding tap and the first frame lands on Home, whose mission card
   * leads to exactly the same screen.
   */
  const [justOnboarded, setJustOnboarded] = useState(false);
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
        // A conversation that ended without being banked, because the app was
        // closed between the recap and the practice message. Ordinary launches
        // find nothing here and this costs one read.
        const recovered = await recoverJournal();
        if (recovered > 0) console.info(`[parle] recovered ${recovered} phrases from a session that did not finish banking`);
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

  const deleteAccount = useCallback(async (reauthentication?: string): Promise<AuthResult> => {
    const reauthenticated = await auth.reauthenticateForDeletion(reauthentication);
    if (!reauthenticated.ok) return reauthenticated;
    const result = await auth.deleteAccount();
    if (!result.ok) return result;
    // The adapter deliberately leaves the local session available until this
    // point so the active user namespace can still be resolved and erased.
    try {
      await clearActiveUserData();
    } catch {
      await auth.signOut();
      return {
        ok: false,
        message: 'Your online account was deleted, but this device could not finish erasing its local copy. Clear the app data before sharing this device.',
      };
    }
    await auth.signOut();
    return result;
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
            // Brand new, rather than someone answering a question that was
            // added since they joined. Only the first kind is sent to the
            // chooser; the second already has a Home worth returning to.
            setJustOnboarded(existing === null);
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
          <RootNavigator
            onSignOut={() => void auth.signOut()}
            onResetProgress={() => void resetProgress()}
            onDeleteAccount={deleteAccount}
            startOnMissions={justOnboarded}
          />
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
