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

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { friendUsernameFromUrl } from './src/friends/invite.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { completeProfile, createStoredProfile, loadProfile, type StoredProfile } from './src/profile/store.ts';

import { paper } from './src/theme.ts';
import { saveConsent } from './src/analytics/consentStore.ts';
import { trackProductEvent } from './src/analytics/track.ts';
import { auth } from './src/auth/adapter.ts';
import { installationId } from './src/auth/installation.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import { EraseNoticeScreen } from './src/auth/EraseNoticeScreen.tsx';
import { deleteAccountAndErase } from './src/auth/deleteAccountFlow.ts';
import type { AuthUser } from './src/auth/types.ts';
import type { AuthResult } from './src/auth/types.ts';
import { recoverJournal } from './src/live/journal.ts';
import { clearActiveUserData, migrateLegacyStores, setActiveUser, userKey } from './src/storage/scope.ts';
import { startSync, type SyncEngine } from './src/sync/engine.ts';
import { createSyncDiagnostics } from './src/sync/diagnostics.ts';
import { syncPolicy } from './src/sync/policy.ts';
import { resetSyncRegistry } from './src/sync/registry.ts';
import { adoptBeforeReady, mayAdoptPreAccountDraft, type FreshStart } from './src/app/freshDevice.ts';
import { loadHistory } from './src/progress/store.ts';
import { backfillFrom } from './src/progress/activity.ts';
import { FIRST_MISSION, lessonXp, type MissionId } from '@luvani/core';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow.tsx';
import { withChosenVoice } from './src/onboarding/voiceStep.ts';
import { profileFromDraft, reminderFromDraft } from './src/onboarding/createFromDraft.ts';
import { firstSceneFor } from './src/onboarding/plan.ts';
import { saveReminder } from './src/reminders/store.ts';
import {
  clearPreAccountDraft,
  loadPreAccountDraft,
  savePreAccountDraft,
  type PreAccountOnboardingDraft,
} from './src/onboarding/preAccountDraft.ts';
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
function PreAccountProfileBootstrap({
  draft,
  done,
  onConsumed,
}: {
  draft: PreAccountOnboardingDraft;
  done: (profile: StoredProfile) => void;
  onConsumed: () => void;
}) {
  // ProfileGate is intentionally the only owner of a user-scoped profile. The
  // pre-account flow can therefore carry its two answers across auth without
  // ever writing them to a shared account namespace. The effect is the bridge:
  // it runs once, builds the ordinary profile through its named constructors,
  // and lets ProfileGate move on to the app.
  const delivered = useRef(false);
  useEffect(() => {
    // React's development strict mode may replay an effect. Creating a profile
    // is idempotent in content, but the first-run navigation flag is an effect
    // too, so keep the bridge explicitly once-only.
    if (delivered.current) return;
    delivered.current = true;
    // The whole plan, through the existing doors (spine contract section 3):
    // reason, minutes, starting level, seeded goal, voice and first name. See
    // src/onboarding/createFromDraft.ts for which answer lands where.
    const built = profileFromDraft(draft);
    // The usage-data answer reaches the disk BEFORE the profile is handed over,
    // and the order is the point rather than a detail. `done` is what releases
    // the app, and `trackProductEvent` reads the stored consent at the moment
    // each event is sent, so anything the learner does in the seconds after
    // this would be dropped while the write was still in flight, and the ones
    // it drops are exactly the learners who had just said yes.
    //
    // There is an account by the time this renders, so there is a key to write
    // the answer under.
    void (async () => {
      try {
        await saveConsent({ allowed: draft.analyticsConsent });
      } catch {
        // No scope to write under, which should not be reachable from here. The
        // learner still gets their app, and an answer this build cannot prove
        // was given reads as off, which is the only safe direction.
      }
      try {
        // The plan's reminder time, kept off: no notification permission has
        // been asked for, and the recap is where it is offered.
        await saveReminder(reminderFromDraft(draft));
      } catch {
        // Nothing stored reads as off, which is what was meant anyway.
      }
      done(built);
      onConsumed();
    })();
  }, [draft, done, onConsumed]);
  return <Loading />;
}

/** ProfileGate mounts its children only once the signed-in profile is complete. */
function CompleteProfileDraftCleanup({ onConsumed }: { onConsumed: () => void }) {
  useEffect(() => {
    onConsumed();
  }, [onConsumed]);
  return null;
}

function SignedInRoot({
  user,
  preAccountDraft,
  onPreAccountDraftConsumed,
  onDeleteAccount,
}: {
  user: AuthUser;
  preAccountDraft: PreAccountOnboardingDraft | null;
  onPreAccountDraftConsumed: () => void;
  /**
   * Delete the account, erase this device, sign out.
   *
   * Owned by `Gate` rather than by this tree, and that is the point: the last
   * step of it unmounts everything here, so anything the sequence still has to
   * say has to be held by something on the other side of the door. See F496.
   */
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  const [ready, setReady] = useState(false);
  const [freshStart, setFreshStart] = useState<FreshStart | null>(null);
  /**
   * Did this learner finish onboarding a moment ago, in this launch?
   *
   * In memory, and deliberately never written to disk. It decides one thing:
   * whether the navigator opens on the first scene's microphone primer, with
   * Today behind it, so the first thing after signing up is the scene the plan
   * promised. A persisted flag would be one more piece of state that can get
   * stuck; an app killed between the last onboarding tap and the first frame
   * lands on Today, whose Start leads to the same scene.
   */
  const [justOnboarded, setJustOnboarded] = useState(false);
  /** Which scene the plan put first: the spine's first, less the opener for "I can get by". */
  const firstScene = useRef<MissionId>(FIRST_MISSION);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingInvite = useRef<string | null>(null);
  const openPendingInvite = useCallback(() => {
    if (pendingInvite.current && navigationRef.isReady()) {
      const username = pendingInvite.current; pendingInvite.current = null;
      navigationRef.navigate('AddFriends', { username });
    }
  }, [navigationRef]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    const receive = ({ url }: { url: string }) => {
      const username = friendUsernameFromUrl(url);
      if (live && username) { pendingInvite.current = username; openPendingInvite(); }
    };
    const listener = Linking.addEventListener('url', receive);
    void Linking.getInitialURL().then(url => { if (url) receive({ url }); }).catch(() => {});
    return () => { live = false; listener.remove(); };
  }, [openPendingInvite]);

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
        if (!cancelled) {
          setFreshStart(start);
          setReady(true);
        }
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

  /**
   * Linking owns the initial state on web, so a stale URL can resolve somewhere
   * other than where a first run belongs. Wait until that resolution is
   * complete, then replace the root exactly once. Native takes the same path
   * harmlessly, which keeps one first-run rule for both platforms.
   *
   * A first run opens on the first scene (notebook Phase 5): the microphone
   * primer for the scene the plan put first, with Today behind it, so a back
   * from the primer or the scene lands on Today rather than on nothing. The
   * ten-way chooser is never the first thing a new learner meets; it stays
   * reachable from Speak's level path. A reset rather than a push, because a
   * first run has no screen behind it.
   */
  const openFirstRun = useCallback(() => {
    if (!justOnboarded || !navigationRef.isReady()) return;
    navigationRef.resetRoot({
      index: 1,
      routes: [{ name: 'Tabs' }, { name: 'FirstScene', params: { missionId: firstScene.current } }],
    });
    setJustOnboarded(false);
  }, [justOnboarded, navigationRef]);

  if (!ready || freshStart === null) return <Loading />;

  return (
    <ProfileGate
      onSignOut={() => void auth.signOut()}
      onboarding={(existing, done) => (
        existing === null && preAccountDraft !== null && mayAdoptPreAccountDraft(freshStart) ? (
          <PreAccountProfileBootstrap
            draft={preAccountDraft}
            onConsumed={onPreAccountDraftConsumed}
            done={(profile) => {
              firstScene.current = firstSceneFor(preAccountDraft.startLevel);
              setJustOnboarded(true);
              done(profile);
            }}
          />
        ) : (
          <OnboardingFlow
            existing={existing}
            onSignOut={() => void auth.signOut()}
            onDone={(answers) => {
              const built = existing === null ? createStoredProfile(answers) : completeProfile(existing, answers);
              // The voice step is the one onboarding answer neither constructor
              // carries. It is applied here, through `withTutorVoice` — the same
              // named door the Profile sheet writes with — rather than by adding a
              // second opinion about the field to `createStoredProfile`. A skip
              // leaves the profile untouched, so the field still reads "never
              // chosen" and both ends of the wire resolve it to the default.
              const next: StoredProfile = withChosenVoice(built, answers.tutorVoice);
              // The order below is the whole reason `onboarding_completed` is
              // sent from this file rather than from inside the flow, where it
              // lived until now. `trackProductEvent` reads the stored consent
              // on every event, so an event sent while the answer was still on
              // its way to the disk is dropped, and the learners it drops are
              // exactly the ones who had just agreed to be counted. So the
              // write is awaited, and the event follows it.
              //
              // Null is a page that did not ask, and nothing at all is written
              // for it. A learner who answered this once already owns that
              // answer in Settings, and a flow they were sent back through for
              // an unrelated reason must not be able to replace it.
              void (async () => {
                try {
                  if (answers.analyticsConsent !== null) await saveConsent({ allowed: answers.analyticsConsent });
                } catch {
                  // No scope to write under. The app still opens, and the answer
                  // reads as off until Settings says otherwise.
                }
                // Brand new, rather than someone answering a question that was
                // added since they joined. Only the first kind is sent to the
                // chooser; the second already has a Home worth returning to.
                setJustOnboarded(existing === null);
                done(next);
                await trackProductEvent({
                  name: 'onboarding_completed',
                  properties: { personalisedGreeting: answers.name !== null },
                });
              })();
            }}
          />
        )
      )}
    >
      <CompleteProfileDraftCleanup onConsumed={onPreAccountDraftConsumed} />
      <LiveProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => { openFirstRun(); openPendingInvite(); }}
          theme={navTheme}
          // Web only. A native linking config would claim luvani://auth/callback,
          // which auth/oauth.native.ts needs for the OAuth round trip.
          {...(Platform.OS === 'web' ? { linking } : {})}
        >
          <RootNavigator
            onSignOut={() => void auth.signOut()}
            onDeleteAccount={onDeleteAccount}
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
  const [preAccountDraft, setPreAccountDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  /**
   * Did an account deletion leave a copy of the learner's data on this device?
   *
   * In memory, and deliberately never written to disk, for the same reason
   * `justOnboarded` is not: it describes something that happened in this
   * launch, and a warning about a device state that may since have been fixed
   * would arrive on the next launch as if it had just happened.
   *
   * It is held here rather than in `AuthProvider` on purpose. `recovering` is
   * the closest-looking seam and it is the wrong one twice over: it means a
   * reset link landed and the learner must set a new password, and the
   * provider clears it the moment a sign-out arrives, which is exactly when
   * this has to start being true. What is right about it is its shape, and that
   * is what is copied here: a fact above the auth boundary, a screen `Gate`
   * interposes on it, and one way to clear it. `Gate` already owns the other
   * piece of state that has to cross this door, `preAccountDraft`, and whether
   * a disk erase finished is not an auth fact for the provider to carry.
   */
  const [localCopyKept, setLocalCopyKept] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPreAccountDraft().then((draft) => {
      if (!cancelled) {
        setPreAccountDraft(draft);
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const keepPreAccountDraft = useCallback((draft: PreAccountOnboardingDraft) => {
    setPreAccountDraft(draft);
    void savePreAccountDraft(draft);
  }, []);

  const discardPreAccountDraft = useCallback(() => {
    setPreAccountDraft(null);
    void clearPreAccountDraft();
  }, []);

  /**
   * The whole of deleting an account, wired to the real adapter and the real
   * erase. The sequence itself is `auth/deleteAccountFlow.ts`, where it can be
   * tested; this is where it is plugged in, because the last step of it signs
   * the learner out and the step before it may still have something to say.
   *
   * The erase resolves the namespace to wipe from the active user, which
   * `SignedInRoot` sets and clears. Defining the sequence here rather than in
   * that tree changes nothing about when it runs: the only door into it is a
   * button on a screen inside the tree.
   */
  const deleteAccount = useCallback((reauthentication?: string): Promise<AuthResult> => {
    return deleteAccountAndErase(
      {
        reauthenticate: (secret) => auth.reauthenticateForDeletion(secret),
        deleteAccount: () => auth.deleteAccount(),
        eraseThisDevice: () => clearActiveUserData(),
        signOut: () => auth.signOut(),
        warnLocalCopyKept: () => setLocalCopyKept(true),
      },
      reauthentication,
    );
  }, []);

  if (status === 'loading' || !draftLoaded) return <Loading />;
  if (status === 'signedIn' && user !== null) {
    if (recovering) return <SetNewPasswordScreen onDone={clearRecovery} />;
    return (
      <SignedInRoot
        key={user.id}
        user={user}
        preAccountDraft={preAccountDraft}
        onPreAccountDraftConsumed={discardPreAccountDraft}
        onDeleteAccount={deleteAccount}
      />
    );
  }
  // Signed out with a copy still on the disk. Drawn here, below the signed-in
  // branch, so it is read after the sign-out rather than written to a sheet the
  // sign-out has already taken away. Dismissing it leads to the welcome, and
  // nothing else can be reached until it is, so this cannot be waiting behind
  // the next learner's sign-in either. F496.
  if (localCopyKept) return <EraseNoticeScreen onDismiss={() => setLocalCopyKept(false)} />;
  return (
    <AuthFlow
      initialDraft={preAccountDraft}
      onDraftChange={keepPreAccountDraft}
      onCreateAccount={keepPreAccountDraft}
      onSignIn={discardPreAccountDraft}
    />
  );
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
            // The navigator fills the device. Shared screen gutters and the dock
            // adapt independently, so iPad is not trapped in a phone-sized shell.
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
  shell: { flex: 1, width: '100%', alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
