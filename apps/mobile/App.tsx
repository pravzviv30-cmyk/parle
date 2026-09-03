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
 * STORY: One welcome that moves, sign in once, a few gentle questions, a first
 *   situation to walk into, then five doors along the bottom: Home, Tutor,
 *   Practice, My French, Profile. One introduction, not three: the welcome is
 *   the first screen of the auth flow rather than a screen in front of it, and
 *   nothing runs before sign-in that a device-level flag has to remember.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { completeProfile, createStoredProfile, loadProfile, type StoredProfile } from './src/profile/store.ts';

import { paper } from './src/theme.ts';
import { auth } from './src/auth/adapter.ts';
import { installationId } from './src/auth/installation.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import type { AuthUser } from './src/auth/types.ts';
import type { AuthResult } from './src/auth/types.ts';
import { recoverJournal } from './src/live/journal.ts';
import { clearActiveUserData, migrateLegacyStores, setActiveUser, userKey } from './src/storage/scope.ts';
import { startSync, type SyncEngine } from './src/sync/engine.ts';
import { createSyncDiagnostics } from './src/sync/diagnostics.ts';
import { syncPolicy } from './src/sync/policy.ts';
import { resetSyncRegistry } from './src/sync/registry.ts';
import { adoptBeforeReady } from './src/app/freshDevice.ts';
import { loadHistory } from './src/progress/store.ts';
import { backfillFrom } from './src/progress/activity.ts';
import { lessonXp } from '@luvani/core';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow.tsx';
import { withChosenVoice } from './src/onboarding/voiceStep.ts';
import { ProfileGate } from './src/app/ProfileContext.tsx';
import { LiveProvider } from './src/app/LiveContext.tsx';
import { RootNavigator } from './src/nav/RootNavigator.tsx';
import { navTheme, linking } from './src/nav/theme.ts';
import type { RootStackParamList } from './src/nav/types.ts';

function Loading() {
  return (
    <View style={st.loading}>
      <ActivityIndicator color={paper.inkFaint} />
    </View>
  );
}

// Read as literals, because Expo inlines EXPO_PUBLIC_ names at build time and a
// computed lookup would come back undefined in a real bundle. Same two values
// auth/adapter.ts reads, deliberately: an app running on the mock adapter has
// no project to reconcile with, and sync must stay silent there.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Assemble the one sync engine for this account, or nothing at all.
 *
 * Everything the engine will ever need is resolved here and handed over once:
 * the account id, the key resolver, the token getter, the device id. That is
 * the review/store.ts discipline applied to a whole subsystem — a sign-out
 * while a retry is queued must not be able to redirect that retry into the next
 * learner's namespace. See src/sync/engine.ts.
 *
 * Null when this launch has no project configured, which is the local mock
 * path. The promise that the app runs with no keys is older than sync.
 */
async function startAccountSync(uid: string): Promise<SyncEngine | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const diagnostics = createSyncDiagnostics();
  return startSync({
    uid,
    // A per-install random already on this device. It is not an account, not a
    // person and not a platform; it only tells two devices apart in an envelope.
    deviceId: await installationId(),
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    // The learner's own bearer, from the adapter that already owns the session.
    // A second Supabase client here would be a second refresh loop.
    getAccessToken: () => auth.getAccessToken(),
    fetch: (url, init) => fetch(url, init),
    storage: AsyncStorage,
    keyFor: userKey,
    policy: syncPolicy,
    record: diagnostics.record,
  });
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
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    let cancelled = false;
    let engine: SyncEngine | null = null;
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
        if (recovered > 0) console.info(`[luvani] recovered ${recovered} phrases from a session that did not finish banking`);

        // Sync starts here and nowhere else: after the journal has been banked,
        // so the launch reconcile pushes a device that is already whole, and
        // inside the effect that owns this account, so the cleanup below is the
        // only thing that can outlive it.
        if (cancelled) return;
        const started = await startAccountSync(user.id);
        if (cancelled) {
          started?.stop();
          return;
        }
        engine = started;

        // The one thing worth making a learner wait for. On a device with no
        // profile, this is somebody who reinstalled or bought a new phone, and
        // opening onboarding for them would write a beginner over the top of
        // everything they have done. So the account gets a bounded moment to
        // answer first. Offline, the box expires and the app opens exactly as
        // it does today. See src/app/freshDevice.ts for the rule and its tests.
        const start = await adoptBeforeReady({
          hasLocalProfile: async () => (await loadProfile()) !== null,
          pull: started === null ? null : () => started.reconcileAll(),
        });
        if (start.waited) console.info(`[luvani] fresh device start: ${start.kind}`);
        // The ordinary launch reconcile, in the background where it belongs. It
        // is the backstop that makes the dirty set an optimisation rather than
        // something correctness depends on. Skipped when the fresh device pull
        // above already ran one.
        if (started !== null && !start.waited) void started.reconcileAll();
      })
      .then(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      // Stop before the scope goes, so nothing in flight can look up a key for
      // an account that is no longer active. A straggling push is already aimed
      // at the old uid with the old learner's token and dies at row level
      // security, which is where it should die.
      engine?.stop();
      resetSyncRegistry();
      setActiveUser(null);
    };
  }, [user.id]);

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

  /**
   * Linking owns the initial state on web, so `/` resolves to Tabs after the
   * stack's `initialRouteName` has chosen Missions. Wait until that resolution
   * is complete, then replace the root exactly once. Native takes the same
   * path harmlessly, which keeps one first-run rule for both platforms.
   *
   * This is deliberately a reset rather than a push. A first run has no screen
   * behind the chooser, and MissionsScreen already turns its Back control into
   * an explicit route to Tabs when there is no history to pop.
   */
  const openFirstMissionChooser = useCallback(() => {
    if (!justOnboarded || !navigationRef.isReady()) return;
    navigationRef.resetRoot({ index: 0, routes: [{ name: 'Missions' }] });
    setJustOnboarded(false);
  }, [justOnboarded, navigationRef]);

  if (!ready) return <Loading />;

  return (
    <ProfileGate
      onboarding={(existing, done) => (
        <OnboardingFlow
          existing={existing}
          onDone={(answers) => {
            const built = existing === null ? createStoredProfile(answers) : completeProfile(existing, answers);
            // The voice step is the one onboarding answer neither constructor
            // carries. It is applied here, through `withTutorVoice` — the same
            // named door the Profile sheet writes with — rather than by adding a
            // second opinion about the field to `createStoredProfile`. A skip
            // leaves the profile untouched, so the field still reads "never
            // chosen" and both ends of the wire resolve it to the default.
            const next: StoredProfile = withChosenVoice(built, answers.tutorVoice);
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
          ref={navigationRef}
          onReady={openFirstMissionChooser}
          theme={navTheme}
          // Web only. A native linking config would claim luvani://auth/callback,
          // which auth/oauth.native.ts needs for the OAuth round trip.
          {...(Platform.OS === 'web' ? { linking } : {})}
        >
          <RootNavigator
            onSignOut={() => void auth.signOut()}
            onDeleteAccount={deleteAccount}
            startOnMissions={justOnboarded}
          />
        </NavigationContainer>
      </LiveProvider>
    </ProfileGate>
  );
}

/**
 * The door. Loading holds a spinner, signed out shows the auth flow (whose own
 * first screen is the welcome), a password-recovery landing interposes its one
 * screen, and a signed-in user gets the app keyed to their account.
 *
 * Auth status is the only thing that decides what renders here. There used to
 * be a branch in front of all of it, gated on a device-level flag that
 * remembered whether this install had ever seen a separate pre-auth welcome.
 * That was a second introduction and a second piece of state to get stuck, and
 * it could not answer for the learner rather than the handset, because it ran
 * where there is no user scope to key anything to. The welcome moved inside the
 * auth flow and the flag went with it.
 */
function Gate() {
  const { status, user, recovering, clearRecovery } = useAuth();

  if (status === 'loading') return <Loading />;
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
