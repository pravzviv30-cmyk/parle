import { FadeOverlay } from '../motion/TimedExit.tsx';
import { loadArrival, saveArrival } from './arrival.ts';
import { HomeArrivalAllowed } from './HomeArrival.tsx';
import { loadConversationPackForLearner } from '../conversationPacks/store.ts';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { phraseKeyOf } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { Card, GhostButton } from '../components.tsx';
import { paper } from '../theme.ts';
import { boldType as type } from './boldRhythm.ts';
import { BoldButton as PillButton } from './BoldButton.tsx';
import { BoldScene } from './motion/BoldScene.tsx';
import { addPhrases } from '../review/store.ts';
import { activeUserId, scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';
import {
  adoptGuestUsage,
  claimGuestPractice,
  clearGuestPractice,
  loadGuestPractice,
  type GuestPractice,
} from './guestPractice.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';
import { useLaunchHold } from '../launch/useLaunch.ts';
import { settleGuestHandoff } from '../game/guestHandoff.ts';
import { celebrationKey, publishCelebrations } from '../celebrate/events.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { keptPhrase, savedPhraseTasks } from './guestProgress.ts';
import { guestPracticeCompletes } from '../wall/launchWall.ts';
import { markConversationDone } from '../wall/launchWallSeen.ts';
import { tutorTimeLine } from './firstRun/copy.ts';
import { AccountWelcome } from './AccountWelcome.tsx';
import { OnboardingFrame, OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';
import { guestScenePhrases } from '@luvani/core';
import { GuestClaimRefused, claimRefusalIsFinal, scenePhrasebookEntries } from './guestScene.ts';
/**
 * The account keeps its own profile. Explicit adoption adds practice, never silently overwrites it.
 *
 * Come alive (README Part 5.C row 11): Keep this practice saves the natural
 * line (F757), says "Saved to your phrasebook." once the phrasebook write is
 * durable, settles the guest's finished days into the account's streak (F744),
 * and then says how much time with the tutor the server holds for this
 * account. The card names only a phrase the save writes (`savedPhraseTasks`):
 * with none, it says the practice is saved and names no phrase. `onDone(kept)`
 * tells the app whether the practice was kept, which is what opens the
 * first-run offer once (App.tsx).
 */
export function GuestAccountHandoff({
  draft,
  onDone,
  children,
  newlyCreated = false,
  onWelcomeDone,
}: {
  draft: PreAccountOnboardingDraft | null;
  /** Called once the hand-off is over: true when the practice was kept, false for Start fresh. */
  onDone: (kept: boolean, showFirstRunOffer?: boolean) => void;
  children: React.ReactNode;
  /** Only a verified signup in this visit can adopt its own anonymous draft automatically. */
  newlyCreated?: boolean;
  onWelcomeDone?: () => void;
}) {
  const { user, adapter } = useAuth();
  const [guest, setGuest] = useState<GuestPractice | null | undefined>(undefined);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  // The server's answer about the account, read once the practice is saved.
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [welcoming, setWelcoming] = useState(false);
  const [resumeAdoption, setResumeAdoption] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const autoStarted = useRef(false);
  const autoFinished = useRef(false);
  const operation = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(true);
  // Auth has completed, but this handoff still finishes the original guest
  // journey. Keep its conditional route when App clears the consumed draft.
  const journey = useRef(draft);
  if (journey.current === null && guest) journey.current = guest.plan;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setReadError(false);
    void Promise.all([loadGuestPractice(true), loadArrival()]).then(([value, arrival]) => {
      if (active) {
        if (value === null && ((arrival && !arrival.welcomeSeen) || (newlyCreated && !arrival?.welcomeSeen))) setWelcoming(true);
        if (value?.live?.sessionId === arrival?.sessionId && arrival && !arrival.welcomeSeen) setResumeAdoption(true);
        if (value === null && newlyCreated && arrival?.welcomeSeen) onWelcomeDone?.();
        setGuest(value);
      }
    }).catch(() => { if (active) { setReadError(true); setError('Your saved practice could not be read. Try again. Your progress has not been removed.'); } });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [readAttempt]);
  // Reading the guest's practice draws a blank, so the launch screen stays up
  // over it. Above both returns, so the hook runs on every render.
  useLaunchHold(guest === undefined && !readError);
  useEffect(() => {
    if ((!newlyCreated && !resumeAdoption) || guest === undefined || busy || autoStarted.current) return;
    autoStarted.current = true;
    if (guest === null) { /* The durable arrival reader decides whether welcome is pending. */ }
    else void keep();
  }, [newlyCreated, resumeAdoption, guest, busy]);
  useEffect(() => {
    if ((newlyCreated || resumeAdoption) && saved && !busy && guest !== null && guest !== undefined && !autoFinished.current) {
      autoFinished.current = true;
      void finish();
    }
  }, [newlyCreated, resumeAdoption, saved, busy, guest]);
  const keep = async () => {
    if (!user || operation.current || finished.current || !guest) return;
    operation.current = true;
    setBusy(true);
    setError('');
    const owner = scopeGeneration();
    const uid = user.id;
    try {
      const claim = await claimGuestPractice(guest, uid);
      const balance = claim.secondsRemaining;
      if (!mounted.current || owner !== scopeGeneration() || activeUserId() !== uid) return;
      // A café scene has no pack: its lines are the server's turn ids, mapped to the reviewed French.
      const scene = guest.live?.scene ? claim.sceneTurns : null;
      if (guest.live?.pack) {
        const linked = await loadConversationPackForLearner(user, adapter, guest.live.pack.id);
        if (!linked.ok || !linked.pack || linked.pack.sessionId !== guest.live.sessionId) throw new Error('Your conversation is linked, but has not synced to this device yet. Try again.');
      }
      // Each accepted or kept reply's task, as its natural line, never the
      // learner's unchecked spelling (F757).
      const phrases = scene ? scenePhrasebookEntries(scene) : savedPhraseTasks(guest).map((task) => ({
        fr: keptPhrase(task),
        frWritten: null,
        en: task.meaning,
        enLiteral: null,
        register: 'courant' as const,
        note: null,
      }));
      if ((await addPhrases(phrases, { source: 'curated' })) !== 'durable')
        throw new Error('Your phrase could not be saved. Try again.');
      // Said only now that the phrasebook write is durable: one toast for the
      // phrase kept last, keyed by the stored phrase, never the learner's text.
      const newest = phrases[phrases.length - 1];
      if (newest !== undefined && owner === scopeGeneration()) {
        const phraseKey = phraseKeyOf(newest.fr);
        publishCelebrations([{ type: 'phrase-saved', key: celebrationKey.saved(phraseKey), origin: 'account', at: Date.now(), data: { phraseKey } }]);
      }
      const key = userKey('onboarding-practice');
      if (
        !(await writeInUserScope(owner, () =>
          AsyncStorage.setItem(key, JSON.stringify({ ...guest, token: null, ...(scene && guest.live ? { live: { ...guest.live, sceneTurns: scene } } : {}) })),
        ))
      )
        throw new Error('Your practice could not be saved.');
      // The guest's finished days become the account's, once, and day one
      // never lights a second time (F744). Nothing to record is not a failure.
      if ((await settleGuestHandoff(guest)).ack !== 'durable') throw new Error('Your practice could not be saved.');
      if (!mounted.current || owner !== scopeGeneration() || activeUserId() !== uid) return;
      // Founder decision 4: a kept guest practice that ran to its end is the first completed conversation.
      if (guestPracticeCompletes(guest)) void markConversationDone();
      if (guest.live?.sessionId) {
        const arrival = await loadArrival();
        if (arrival?.sessionId !== guest.live.sessionId) await saveArrival({ sessionId: guest.live.sessionId,
          finishedAt: guest.live.outcome === 'completed' ? guest.finishedAt ?? [] : [], welcomeSeen: !newlyCreated, streakSeen: false });
      }
      // The card names the newest line the server confirmed, which is the one saved.
      if (scene && guest.live) setGuest({ ...guest, live: { ...guest.live, sceneTurns: scene } });
      setRemaining(balance);
      setSaved(true);
      // Free or on a plan: the server says, after the claim above has spent the
      // guest's seconds. Read in the background, so nothing waits on it; until
      // it answers, and if it cannot, the claim's own balance is said plainly.
      void fetchBillingStatus(uid).then((answer) => {
        if (mounted.current && owner === scopeGeneration() && activeUserId() === uid) setStatus(answer);
      });
    } catch (cause) {
      if (mounted.current && owner === scopeGeneration())
        setError(cause instanceof Error ? cause.message : 'Your practice could not be linked yet.');
    } finally {
      operation.current = false;
      if (mounted.current && owner === scopeGeneration()) setBusy(false);
    }
  };
  const finish = async () => {
    if (!user || operation.current || finished.current || !guest) return;
    operation.current = true;
    const owner = scopeGeneration();
    setBusy(true);
    setError('');
    try {
      // The usage transfer is required even when the learner declines to import
      // their phrase. Declining an import cannot reset a one-time allowance.
      // A claim that can never succeed (kept by another account, or expired)
      // still lets Start fresh finish; anything else keeps the practice here.
      if (!saved) {
        try { await adoptGuestUsage(guest, user.id); }
        catch (cause) { if (!(cause instanceof GuestClaimRefused && claimRefusalIsFinal(cause.code))) throw cause; }
      }
      if (!mounted.current || owner !== scopeGeneration()) return;
      await clearGuestPractice();
      if (!mounted.current || owner !== scopeGeneration() || activeUserId() !== user.id) return;
      finished.current = true;
      if (newlyCreated || resumeAdoption) setWelcoming(true);
      setGuest(null);
      onDone(saved, !newlyCreated && !resumeAdoption);
    } catch {
      if (mounted.current && owner === scopeGeneration())
        setError('Your minutes could not be checked. Try again. Your practice is still here.');
    } finally {
      operation.current = false;
      if (mounted.current && owner === scopeGeneration()) setBusy(false);
    }
  };
  if (readError) return <OnboardingLayout page="account-welcome" footer={<PillButton label="Try again" onPress={() => setReadAttempt(n => n + 1)} />}><Text accessibilityRole="alert" style={type.body}>{error}</Text></OnboardingLayout>;
  if (guest === null && !welcoming) return <HomeArrivalAllowed.Provider value={true}><View style={{ flex: 1 }}><View style={StyleSheet.absoluteFill}>{children}</View>{error ? <Text accessibilityRole="alert">{error}</Text> : null}</View></HomeArrivalAllowed.Provider>;
  if (guest === undefined) return <View />;
  const progress = onboardingProgress({
    page: 'account-welcome',
    five: journey.current?.onboardingVariant === 'five' || (journey.current?.onboardingVariant == null && process.env.EXPO_PUBLIC_ONBOARDING_VARIANT === 'five'),
    completed: journey.current?.onboardingCompletedSteps,
    skipped: [...(journey.current?.onboardingSkippedSteps ?? []), ...(journey.current?.quickStart ? ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time'] : [])],
  });
  if (welcoming) return <HomeArrivalAllowed.Provider value={false}><View style={{ flex: 1 }}>
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">{children}</View>
    <FadeOverlay leaving={welcomeLeaving} onHidden={() => { setWelcoming(false); onWelcomeDone?.(); }}>
    <OnboardingFrame initialProgress={progress}>
      <AccountWelcome progress={progress} onDone={async () => {
        const arrival = await loadArrival();
        await saveArrival({ ...(arrival ?? { sessionId: 'account-welcome', finishedAt: [], streakSeen: true }), welcomeSeen: true });
        setWelcomeLeaving(true);
      }} />
    </OnboardingFrame>
    </FadeOverlay>
  </View></HomeArrivalAllowed.Provider>;
  if (guest === null) return <>{children}</>;
  // The time with the tutor, once saved: free on the free allowance (and on a
  // lapsed plan, which the server holds as that), on a plan otherwise, and in
  // plain minutes when only the claim's balance is known.
  const timeLine = !saved
    ? null
    : status !== null
      ? tutorTimeLine(status.secondsRemaining, status.plan === 'trial' || status.lapsed)
      : remaining !== null
        ? tutorTimeLine(remaining, null)
        : null;
  // The phrase the card names is the newest one the save writes, or none.
  const shown = savedPhraseTasks(guest).at(-1);
  const shownLine = guest.live?.scene ? guestScenePhrases(guest.live.sceneTurns ?? []).at(-1)?.fr : shown ? keptPhrase(shown) : undefined;
  return (
    <OnboardingFrame initialProgress={progress}>
    <OnboardingLayout page="account-welcome" progress={progress}
      footer={
        <PillButton
          label={saved ? 'Continue' : busy ? 'Saving…' : 'Keep this practice'}
          disabled={busy}
          onPress={() => {
            void (saved ? finish() : keep());
          }}
        />
      }
    >
      <Text accessibilityRole="header" style={[type.title, { textAlign: 'center', marginBottom: 16 }]}>
        {saved ? (shownLine ? 'Your phrase is saved.' : 'Your practice is saved.') : 'Keep this practice?'}
      </Text>
      <BoldScene kind={saved ? 'save' : busy ? 'saving' : error ? 'retry' : 'save'} width={220} />
      <Text style={[type.body, { textAlign: 'center' }]}>Signed in as {user?.email ?? 'your account'}.</Text>
      <Card style={{ marginTop: 20, gap: 16 }}>
        {shownLine ? <Text style={[type.heading, { textAlign: 'center' }]}>{shownLine}</Text> : null}
        <Text style={[type.body, { textAlign: 'center' }]}>
          {saved
            ? shownLine
              ? 'Your phrase is in Practice. Your account can sync it to another device.'
              : 'Your practice from this phone is kept with your account.'
            : shownLine
              ? 'Keep the phrase from this phone. Your account’s existing learning and preferences stay yours.'
              : 'Keep the practice from this phone. Your account’s existing learning and preferences stay yours.'}
        </Text>
        {timeLine !== null && <Text style={[type.bodyStrong, { textAlign: 'center' }]}>{timeLine}</Text>}
      </Card>
      {!saved && (
        <GhostButton
          label="Start fresh"
          disabled={busy}
          onPress={() => {
            void finish();
          }}
        />
      )}
      <GhostButton
        label="Sign out"
        disabled={busy}
        onPress={() => {
          void adapter.signOut();
        }}
      />
      {error !== '' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[type.body, { color: paper.ink, marginTop: 20 }]}
        >
          {error}
        </Text>
      ) : null}
    </OnboardingLayout>
    </OnboardingFrame>
  );
}
