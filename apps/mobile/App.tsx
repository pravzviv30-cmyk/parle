/*
 * ── DIRECTION CONTRACT ───────────────────────────────────────────────────────
 * THESIS: Learning to speak should feel like a warm, unhurried picture book —
 *   calm, friendly, professional. Easy to look at twice a day.
 * OWN-WORLD: Paper & ink. Pale lilac paper, warm black ink, hand-drawn line
 *   art, Outfit for every word on the screen, French and English alike.
 *   Flat white cards on a hairline rule; one solid ink pill per screen.
 *   Chrome is plain English; French appears only as the
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { friendUsernameFromUrl } from './src/friends/invite.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { saveProfile, completeProfile, createStoredProfile, loadProfile, type StoredProfile } from './src/profile/store.ts';

import { paper, type, space } from './src/theme.ts';
import { IconAction, Card, GhostButton, PillButton } from './src/components.tsx';
import { ScrollScreen, ScreenHeader } from './src/layout.tsx';
import { saveConsent } from './src/analytics/consentStore.ts';
import { trackProductEvent } from './src/analytics/track.ts';
import { auth } from './src/auth/adapter.ts';
import { installationId } from './src/auth/installation.ts';
import { AuthProvider, useAuth } from './src/auth/useAuth.tsx';
import { AuthFlow } from './src/auth/AuthFlow.tsx';
import { SetNewPasswordScreen } from './src/auth/SetNewPasswordScreen.tsx';
import { EraseNoticeScreen } from './src/auth/EraseNoticeScreen.tsx';
import { DeletionPendingNotice } from './src/auth/DeletionPendingNotice.tsx';
import { deleteAccountAndErase } from './src/auth/deleteAccountFlow.ts';
import type { AuthUser } from './src/auth/types.ts';
import type { AuthResult } from './src/auth/types.ts';
import { recoverJournal } from './src/live/journal.ts';
import { clearActiveUserData, migrateLegacyStores, setActiveUser, userKey, scopeGeneration } from './src/storage/scope.ts';
import { startSync, type SyncEngine } from './src/sync/engine.ts';
import { createSyncDiagnostics } from './src/sync/diagnostics.ts';
import { syncPolicy } from './src/sync/policy.ts';
import { resetSyncRegistry } from './src/sync/registry.ts';
import { adoptBeforeReady, mayAdoptPreAccountDraft, type FreshStart } from './src/app/freshDevice.ts';
import { loadHistory } from './src/progress/store.ts';
import { backfillFrom } from './src/progress/activity.ts';
import { FIRST_MISSION, lessonXp, type MissionId } from '@luvani/core';
import { PreAccountOnboarding } from './src/onboarding/PreAccountOnboarding.tsx';
import { loadHapticPreference } from './src/motion/hapticPreference.ts';
import { loadSoundPreference } from './src/sound/soundPreference.ts';
import { hasUsedApp, rememberAppUse } from './src/auth/installHistory.ts';
import { GuestAccountHandoff } from './src/onboarding/GuestAccountHandoff.tsx';
import { flushFirstRunWall } from './src/onboarding/firstRunWall.ts';
import { fetchBillingStatus } from './src/purchases/client.ts';
import { purchases } from './src/purchases/adapter.ts';
import { paywallSurface } from './src/purchases/paywallView.ts';
import { loadGuestPractice } from './src/onboarding/guestPractice.ts';
import { OnboardingFlow } from './src/onboarding/OnboardingFlow.tsx';
import { withChosenVoice } from './src/onboarding/voiceStep.ts';
import { profileFromDraft, reminderFromDraft, reminderSummary } from './src/onboarding/createFromDraft.ts';
import { shouldStartFirstPractice } from './src/onboarding/firstPracticeEntry.ts';
import { firstSceneFor, planFor } from './src/onboarding/plan.ts';
import { saveReminder } from './src/reminders/store.ts';
import { cancelReminder } from './src/reminders/schedule.ts';
import { GuestReminderPlanner, ReminderPlanner, stopReminders, useReminderTaps } from './src/reminders/ReminderPlanner.tsx';
import { useTrialReminderSync } from './src/purchases/useTrialReminderSync.ts';
import {
  clearPreAccountDraft,
  loadPreAccountDraft,
  savePreAccountDraft,
  type PreAccountOnboardingDraft,
} from './src/onboarding/preAccountDraft.ts';
import { ProfileGate } from './src/app/ProfileContext.tsx';
import { LiveProvider } from './src/app/LiveContext.tsx';
import { GameProvider } from './src/game/GameProvider.tsx';
import { RootNavigator } from './src/nav/RootNavigator.tsx';
import { navTheme, linking } from './src/nav/theme.ts';
import type { RootStackParamList } from './src/nav/types.ts';
import { LaunchScreen } from './src/launch/LaunchScreen.tsx';
import { OnboardingPreview } from './src/dev/OnboardingPreview.tsx';
import { OnboardingLayout } from './src/onboarding/OnboardingLayout.tsx';
import { onboardingProgress } from './src/onboarding/onboardingProgress.ts';
import { setLaunchWelcome, useLaunchHold } from './src/launch/useLaunch.ts';
import { ReduceMotionBridge } from './src/motion/ReduceMotionBridge.tsx';
import { FlightLayer } from './src/motion/FlightLayer.tsx';
import { CelebrationHost } from './src/celebrate/CelebrationHost.tsx';

/**
 * Every wait in this file. While one is on screen it holds the launch, so the
 * launch screen leaves only once the app has something real to show. The waits
 * elsewhere hold it themselves; launch/launchHold.ts lists them all.
 */
function Loading() {
  useLaunchHold();
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
  requireReview,
  accountLabel,
}: {
  draft: PreAccountOnboardingDraft;
  done: (profile: StoredProfile, startPractice: boolean) => void;
  onConsumed: () => void;
  requireReview: boolean;
  accountLabel: string;
}) {
  // OAuth can sign into an existing empty account. A clean account read proves
  // there is no profile to overwrite, not whose anonymous draft this is.
  const [confirmed, setConfirmed] = useState(!requireReview);
  const [bootstrapError, setBootstrapError] = useState('');
  const [bootstrapRetry, setBootstrapRetry] = useState(0);
  const restarting = useRef(false);
  const mounted = useRef(true);
  const [restartBusy, setRestartBusy] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
    if (!confirmed || delivered.current) return;
    delivered.current = true;
    const owner = scopeGeneration();
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
      let startPractice = false;
      try {
        const guest = await loadGuestPractice(true);
        if (owner !== scopeGeneration()) return;
        startPractice = shouldStartFirstPractice(draft, guest);
        if ((await saveConsent({ allowed: draft.analyticsConsent })) !== 'durable') throw new Error('storage failed');
        if (owner !== scopeGeneration()) return;
        // The plan's reminder as the first run left it: on only when the
        // learner said yes on day one and the system scheduled it, off otherwise.
        if ((await saveReminder(reminderFromDraft(draft))) !== 'durable') throw new Error('storage failed');
        if (owner !== scopeGeneration()) return;
        if (!(await saveProfile(built))) throw new Error('storage failed');
      } catch {
        if (owner === scopeGeneration()) { delivered.current = false; setBootstrapError('Your plan could not be saved. Try again.'); }
        return;
      }
      if (owner !== scopeGeneration()) return;
      done(built, startPractice);
      if (!draft.eligibilityConfirmed || startPractice) onConsumed();
    })();
  }, [confirmed, draft, done, onConsumed, bootstrapRetry]);
  if (bootstrapError && confirmed) return <OnboardingLayout page="account-welcome" footer={<PillButton label="Try again" onPress={() => { setBootstrapError(''); setBootstrapRetry(v => v+1); }} />}><Text style={[type.body, { textAlign: 'center' }]}>{bootstrapError}</Text></OnboardingLayout>;
  if (!confirmed) {
    const plan = planFor(draft);
    // A reminder the first run set belongs to the plan being put aside, so it
    // leaves the phone first; otherwise it would keep nudging under a Settings
    // row that says Off.
    const startAgain = async () => {
      if (!mounted.current || restarting.current) return;
      restarting.current = true; setRestartBusy(true); setBootstrapError('');
      const owner = scopeGeneration();
      try {
        if (draft.reminderEnabled === true && (await cancelReminder()) === 'failed') throw new Error('reminder cancellation failed');
        if (!mounted.current || owner !== scopeGeneration()) return;
        onConsumed();
      } catch {
        if (mounted.current && owner === scopeGeneration()) setBootstrapError('Your reminder could not be cancelled. Your plan is still here. Try starting a new plan again.');
      } finally {
        restarting.current = false;
        if (mounted.current && owner === scopeGeneration()) setRestartBusy(false);
      }
    };
    return <OnboardingLayout page="account-welcome" progress={onboardingProgress({ page: 'account-welcome', five: draft.onboardingVariant === 'five' })}
      footer={<PillButton label="Use this plan for my account" disabled={restartBusy} onPress={() => { if (!restarting.current) setConfirmed(true); }} />}>
      <Text accessibilityRole="header" style={[type.title, { color: paper.ink, textAlign: 'center', marginBottom: space(4) }]}>Use this starting plan?</Text>
      <Text style={[type.body, { color: paper.ink, textAlign: 'center' }]}>You are signed in as {accountLabel}. This account has no saved profile. The plan on this phone may have been made by someone else.</Text>
      <Card style={{ marginTop: space(4), gap: space(2) }}>
        {draft.firstName ? <Text style={type.body}>Name: {draft.firstName}</Text> : null}
        <Text style={type.heading}>{plan.starter.title}</Text>
        <Text style={type.body}>{plan.startingReason}</Text>
        {plan.goal ? <Text style={type.body}>{plan.goal}</Text> : null}
        <Text style={type.body}>{plan.minutes === 'none' ? 'No fixed daily target.' : `${plan.minutes} minutes as a suggested daily routine.`}</Text>
        <Text style={type.small}>Optional usage data: {draft.analyticsConsent ? 'on' : 'off'}. {reminderSummary(draft)} You can change these choices in Settings.</Text>
      </Card>
      {!!bootstrapError && <Text accessibilityRole="alert" style={[type.body, { color: paper.ink }]}>{bootstrapError}</Text>}
      <IconAction layout="inline" icon="edit" label="Start a new plan instead" busy={restartBusy} disabled={restartBusy} onPress={() => void startAgain()} />
    </OnboardingLayout>;
  }
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
  refused,
  onRefuseOnboarding,
  onDeleteAccount,
}: {
  user: AuthUser;
  preAccountDraft: PreAccountOnboardingDraft | null;
  onPreAccountDraftConsumed: () => void;
  refused: boolean;
  onRefuseOnboarding: () => void;
  /**
   * Delete the account, erase this device, sign out.
   *
   * Owned by `Gate` rather than by this tree, and that is the point: the last
   * step of it unmounts everything here, so anything the sequence still has to
   * say has to be held by something on the other side of the door. See F496.
   */
  onDeleteAccount: (reauthentication?: string) => Promise<AuthResult>;
}) {
  const { newAccountUserId, clearNewAccount } = useAuth();
  const newlyCreated = newAccountUserId === user.id;
  const [ready, setReady] = useState(false);
  const [startupFailed, setStartupFailed] = useState(false);
  const [startupRead, setStartupRead] = useState(0);
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
  // A tap on a reminder opens the place its line promised; one that launched
  // the app waits until the navigator says it is ready.
  useReminderTaps(navigationRef);
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

  // Establish the account before descendant passive focus effects read stores.
  // Effect replay can retain the visible screens while this owner restarts.
  useLayoutEffect(() => {
    let cancelled = false;
    let engine: SyncEngine | null = null;
    setReady(false);
    setStartupFailed(false);
    setActiveUser(user.id);
    const owner = scopeGeneration();
    void migrateLegacyStores(user.id)
      .then(async () => {
        if (cancelled || owner !== scopeGeneration()) return;
        // Sessions finished before the activity log existed have no evidence
        // stored to price them properly, so each is credited at the base rate
        // and no more. Without this, everyone already using the app is told on
        // launch day that they are a Beginner with nothing to their name.
        // An unread history is not an empty history. Preserve it and let the
        // Progress read show its recovery state; optional backfill must not
        // trap every screen behind the launch spinner.
        try {
          const history = await loadHistory();
          if (cancelled || owner !== scopeGeneration()) return;
          if (history.length > 0) {
            await backfillFrom(history, lessonXp({ wordsProduced: [], unassistedRate: 0 }));
          }
        } catch {
          if (!cancelled && owner === scopeGeneration()) console.warn('[luvani] startup history recovery unavailable');
        }
        if (cancelled || owner !== scopeGeneration()) return;
        // A failed recovery retains the outbox for a future launch. It does not
        // manufacture phrases or counts and is independent of opening the app.
        try {
          const recovered = await recoverJournal();
          if (cancelled || owner !== scopeGeneration()) return;
          if (recovered > 0) console.info(`[luvani] recovered ${recovered} phrases from a session that did not finish banking`);
        } catch {
          if (!cancelled && owner === scopeGeneration()) console.warn('[luvani] startup phrase recovery unavailable');
        }

        // Sync starts here and nowhere else: after the journal has been banked,
        // so the launch reconcile pushes a device that is already whole, and
        // inside the effect that owns this account, so the cleanup below is the
        // only thing that can outlive it.
        if (cancelled || owner !== scopeGeneration()) return;
        const started = await startAccountSync(user.id);
        if (cancelled || owner !== scopeGeneration()) {
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
        if (!cancelled && owner === scopeGeneration()) {
          setFreshStart(start);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled && owner === scopeGeneration()) setStartupFailed(true);
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
  }, [user.id, startupRead]);

  /**
   * The first-run offer (come alive, README Part 5.C row 12): set when the
   * hand-off ends with the guest's practice kept, and taken once by
   * `openFirstRun` when the navigator is ready, after its own reset. The
   * existing wall opens at its `path-complete` door only after the server says
   * this account holds no paid plan and the store has plans to sell
   * (`onboarding/firstRunWall.ts`). In memory only, so it is never shown again
   * on its own.
   */
  const pendingWall = useRef(false);
  const openPendingWall = useCallback(() => {
    const owner = scopeGeneration();
    void flushFirstRunWall({
      take: () => {
        const due = pendingWall.current;
        pendingWall.current = false;
        return due;
      },
      status: () => fetchBillingStatus(user.id),
      storeHasPlans: async () => paywallSurface(await purchases.offering(user.id)) !== null,
      stillHere: () => owner === scopeGeneration() && navigationRef.isReady(),
      open: () => navigationRef.navigate('Wall', { entry: 'path-complete' }),
    });
  }, [navigationRef, user.id]);

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
    if (!navigationRef.isReady()) return;
    if (justOnboarded) {
      navigationRef.resetRoot({
        index: 1,
        routes: [{ name: 'Tabs' }, { name: 'FirstScene', params: { missionId: firstScene.current } }],
      });
      setJustOnboarded(false);
    }
    // Then the first-run offer, once, after a kept practice (below).
    openPendingWall();
  }, [justOnboarded, navigationRef, openPendingWall]);

  // An unreachable account is not an empty account. Keep existing learning
  // safe and offer retry instead of treating an offline reinstall as first use.
  const restoreUnavailable = ready && (freshStart?.kind === 'timed-out' || freshStart?.kind === 'unavailable');
  if (startupFailed || restoreUnavailable) return (
    <ScrollScreen header={<ScreenHeader title={startupFailed ? "Your saved learning" : "Welcome back"} />}>
      <Card>
        <Text style={[type.body, { color: paper.ink }]}>{startupFailed
          ? 'Your saved learning could not be opened. Try again when this phone can read its storage.'
          : 'We couldn’t restore your saved learning yet. Connect to the internet and try again to pick up where you left off.'}</Text>
        <PillButton label="Try again" onPress={() => setStartupRead(value => value + 1)} />
        <GhostButton label="Sign out" onPress={() => void auth.signOut()} />
      </Card>
    </ScrollScreen>
  );
  if (!ready || freshStart === null) return <Loading />;

  return (
    <ProfileGate
      onSignOut={() => void auth.signOut()}
      onboarding={(existing, done) => (
        existing === null && preAccountDraft !== null && preAccountDraft.accountReturnPage !== 'hear-it' && mayAdoptPreAccountDraft(freshStart) ? (
          <PreAccountProfileBootstrap
            draft={preAccountDraft}
            requireReview={!newlyCreated && (preAccountDraft.eligibilityConfirmed === true || user.provider === 'google' || user.provider === 'apple')}
            accountLabel={user.email ?? 'your current account'}
            onConsumed={onPreAccountDraftConsumed}
            done={(profile, startPractice) => {
              firstScene.current = firstSceneFor(preAccountDraft.startLevel, preAccountDraft.reason);
              setJustOnboarded(startPractice);
              done(profile);
            }}
          />
        ) : existing === null ? (
          <PreAccountOnboarding
            initialDraft={preAccountDraft?.accountReturnPage === 'hear-it' ? { ...preAccountDraft, page: 'hear-it' } : null}
            signedIn
            refused={refused}
            onDraftChange={() => { /* Drafts for signed-in learners remain inside their account flow. */ }}
            onSignIn={() => void auth.signOut()}
            onRefuse={() => { onRefuseOnboarding(); void auth.signOut(); }}
            onCreateAccount={async draft => {
              if (!draft.eligibilityConfirmed) return false;
              const owner = scopeGeneration();
              const built = profileFromDraft(draft);
              const guest = await loadGuestPractice(true);
              if (owner !== scopeGeneration()) return false;
              const startPractice = shouldStartFirstPractice(draft, guest);
              if ((await saveConsent({ allowed: draft.analyticsConsent })) !== 'durable' || owner !== scopeGeneration()) return false;
              if ((await saveReminder(reminderFromDraft(draft))) !== 'durable' || owner !== scopeGeneration()) return false;
              if (!(await saveProfile(built)) || owner !== scopeGeneration()) return false;
              firstScene.current = firstSceneFor(draft.startLevel, draft.reason);
              setJustOnboarded(startPractice);
              onPreAccountDraftConsumed();
              done(built);
              return true;
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
              return (async () => {
                const owner = scopeGeneration();
                try {
                  if (answers.analyticsConsent !== null && (await saveConsent({ allowed: answers.analyticsConsent })) !== 'durable') return false;
                } catch {
                  // Keep the answers available for retry until every chosen
                  // preference is durable under the same account.
                  return false;
                }
                // Brand new, rather than someone answering a question that was
                // added since they joined. Only the first kind is sent to the
                // chooser; the second already has a Home worth returning to.
                if (owner !== scopeGeneration() || !(await saveProfile(next)) || owner !== scopeGeneration()) return false;
                setJustOnboarded(existing === null);
                done(next);
                await trackProductEvent({
                  name: 'onboarding_completed',
                  properties: { personalisedGreeting: answers.name !== null },
                });
                return true;
              })();
            }}
          />
        )
      )}
    >
      <GuestAccountHandoff
        draft={preAccountDraft}
        newlyCreated={newlyCreated}
        onWelcomeDone={clearNewAccount}
        onDone={(kept, showFirstRunOffer) => {
          if (kept && showFirstRunOffer) pendingWall.current = true;
          onPreAccountDraftConsumed();
        }}
      >
      {!preAccountDraft?.eligibilityConfirmed && <CompleteProfileDraftCleanup onConsumed={onPreAccountDraftConsumed} />}
      <GameProvider>
      {/* After the hand-off, inside the game layer: plans on mount, on the way
          back to the foreground, after every settled sitting and when the tutor
          changes. */}
      <ReminderPlanner />
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
      </GameProvider>
      </GuestAccountHandoff>
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
  const { status, user, recovering, clearRecovery, creatingAccount } = useAuth();
  const [preAccountDraft, setPreAccountDraft] = useState<PreAccountOnboardingDraft | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [returning, setReturning] = useState(false);
  const appUsed = useCallback(() => { setReturning(true); void rememberAppUse(); }, []);
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
  const [deletionPending, setDeletionPending] = useState(false);
  /**
   * An under-13 answer on the first run's save page, before any account
   * (F637, F639, F641). Held here because `Gate` stays mounted for the whole
   * launch and `AuthFlow` does not: a sign-in unmounts the flow, and a sign-out
   * mounts a new one. A refusal kept in the flow ended with it, and a sign-in
   * through Google or Apple followed by a sign-out offered the pill again.
   *
   * Memory only, and nothing sets it back to false, so it lasts until the app
   * is closed. It is never written to the device: a marker would be new data
   * about a minor, which the founder did not choose (2026-09-30). The tradeoff:
   * on a shared phone, an adult who signs out later in the same launch meets
   * the refusal page until the app is reopened.
   */
  const [preAccountRefused, setPreAccountRefused] = useState(false);

  /**
   * Signing out, or another account signing in, takes every pending reminder
   * with it, so a shared phone never shows one learner's lines to the next.
   * Keyed on who is signed in rather than on the signed-in tree unmounting,
   * so the password-recovery screen (the same learner) cancels nothing, and
   * signing in cancels nothing. A layout effect, so the cancel is queued
   * before the next tree's planner plans.
   */
  const signedInAs = status === 'signedIn' ? user?.id ?? null : null;
  const lastSignedIn = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (status === 'loading') return;
    const was = lastSignedIn.current;
    lastSignedIn.current = signedInAs;
    if (was !== null && was !== signedInAs) void stopReminders();
  }, [status, signedInAs]);
  // The trial-ending reminder: synced on launch, foreground and every billing
  // change, and cancelled on sign-out or account switch.
  useTrialReminderSync(signedInAs, status === 'loading');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadPreAccountDraft(), hasUsedApp()]).then(([draft, used]) => {
      if (!cancelled) {
        setPreAccountDraft(draft);
        setReturning(previous => previous || used);
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A verified sign-in is sufficient evidence, including an account whose
  // onboarding was interrupted. The hint contains no identity or credentials.
  useEffect(() => {
    if (signedInAs !== null) appUsed();
  }, [signedInAs, appUsed]);

  useLayoutEffect(() => {
    setLaunchWelcome(status === 'loading' || !draftLoaded
      ? null
      : status === 'signedOut' && !returning && preAccountDraft === null);
  }, [status, draftLoaded, returning, preAccountDraft]);

  const keepPreAccountDraft = useCallback((draft: PreAccountOnboardingDraft) => {
    setPreAccountDraft(draft);
    void savePreAccountDraft(draft);
  }, []);

  const discardPreAccountDraft = useCallback(() => {
    setPreAccountDraft(null);
    void clearPreAccountDraft();
  }, []);

  /**
   * "I am younger than that": hold the refusal for the launch and clear the
   * draft, first name and all, and any reminder that draft set on day one.
   */
  const refusePreAccount = useCallback(() => {
    setPreAccountRefused(true);
    if (preAccountDraft?.reminderEnabled === true) void cancelReminder();
    discardPreAccountDraft();
  }, [discardPreAccountDraft, preAccountDraft]);

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
        deleteAccount: async () => {
          const result = await auth.deleteAccount();
          if (result.ok && result.deletionPending) setDeletionPending(true);
          return result;
        },
        eraseThisDevice: () => clearActiveUserData(),
        signOut: () => auth.signOut(),
        warnLocalCopyKept: () => setLocalCopyKept(true),
      },
      reauthentication,
    );
  }, []);

  if (status === 'loading' || !draftLoaded || (status === 'signedIn' && creatingAccount)) return <Loading />;
  if (status === 'signedIn' && user !== null) {
    if (recovering) return <SetNewPasswordScreen onDone={clearRecovery} />;
    return (
      <SignedInRoot
        key={user.id}
        user={user}
        preAccountDraft={preAccountDraft}
        onPreAccountDraftConsumed={discardPreAccountDraft}
        refused={preAccountRefused}
        onRefuseOnboarding={refusePreAccount}
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
  if (deletionPending) return <DeletionPendingNotice onDismiss={() => setDeletionPending(false)} />;
  return (
    <>
      {/* A guest who said yes on day one has no account yet: their reminder is
          planned from the first run's draft and the days they finished. */}
      <GuestReminderPlanner draft={preAccountDraft} />
      <AuthFlow
        initialDraft={preAccountDraft}
        returning={returning}
        onDraftChange={keepPreAccountDraft}
        onCreateAccount={keepPreAccountDraft}
        onDiscardDraft={discardPreAccountDraft}
        onSignIn={() => { /* Preserve the local practice until its owner chooses whether to keep it. */ }}
        refused={preAccountRefused}
        onRefuse={refusePreAccount}
      />
    </>
  );
}

export default function App() {
  useLayoutEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW === '1') setLaunchWelcome(false);
  }, []);
  useEffect(() => { void loadHapticPreference(); }, []);
  useEffect(() => { void loadSoundPreference(); }, []);
  const [loaded] = useFonts({
    'Outfit-Regular': require('./assets/fonts/Outfit-Regular.ttf'),
    'Outfit-Medium': require('./assets/fonts/Outfit-Medium.ttf'),
    'Outfit-SemiBold': require('./assets/fonts/Outfit-SemiBold.ttf'),
    'Outfit-Bold': require('./assets/fonts/Outfit-Bold.ttf'),
    'Outfit-ExtraBold': require('./assets/fonts/Outfit-ExtraBold.ttf'),
    'Outfit-Black': require('./assets/fonts/Outfit-Black.ttf'),
  });
  /**
   * Whether the launch screen has finished. It is drawn over the app from the
   * first frame, releases the native launch screen itself (it is the same
   * frame), and fades out once nothing here is loading any more. The app
   * renders beneath it all the while, so it opens wherever it was always going
   * to: the welcome and onboarding for somebody new, Home for everybody else.
   */
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ReduceMotionBridge />
      <AuthProvider adapter={auth}>
        {/* Out of a screen reader's reach until the launch has gone, on both
            platforms: the first prop is VoiceOver's, the second TalkBack's. */}
        <View
          style={st.app}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': !launched, inert: !launched ? true : undefined } as object) : {})}
          accessibilityElementsHidden={!launched}
          importantForAccessibility={launched ? 'auto' : 'no-hide-descendants'}
        >
          {loaded ? (
            // The navigator fills the device. Shared screen gutters and the dock
            // adapt independently, so iPad is not trapped in a phone-sized shell.
            <View style={st.shell}>
              {__DEV__ && process.env.EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW === '1' ? <OnboardingPreview /> : <Gate />}
            </View>
          ) : (
            <Loading />
          )}
          {/* Over everything the navigator draws, the first run included, and
              outside it: the one celebration host and the one layer tokens fly
              in. Both draw nothing and take no touches while idle. */}
          <CelebrationHost />
          <FlightLayer />
        </View>
        {!launched && <LaunchScreen onDone={finishLaunch} />}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: paper.ground },
  shell: { flex: 1, width: '100%', alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
