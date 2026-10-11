import { briefFromDraft } from './firstLiveModel.ts';
import { FirstLivePractice } from './FirstLivePractice.tsx';
import { FirstSessionCelebration, FirstSessionSummary } from './FirstSessionResult.tsx';
import { guestPracticeDays } from './guestModel.ts';
import { dayKeyOf, tutorSampleLine } from '@luvani/core';
import { STARTER_AI, STARTER_PROCESSING, STARTER_LOCAL } from './disclosure.ts';
/** Personal answers lead into one live session; recorded results drive the summary and account handoff. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, type ScrollView as ScrollViewHandle, Text, View, Platform, findNodeHandle } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { play as playSfx } from '../sound/sfx.ts';
import { tutorVoice } from '@luvani/core';
import { useReduceMotion } from '../motion.ts';

import { ChoiceNudge } from './firstRun/ChoiceNudge.tsx';
import { NextButton } from './NextButton.tsx';
import { FULL_SETUP, FIVE_SETUP, nextSetupLabel } from './flow.ts';
import { GhostButton, IconAction, IconActionRow, PillButton, Press, Sheet } from '../components.tsx';
import { Screen, readingColumn, useCompactPhone, useFontScale, useLayoutClass } from '../layout.tsx';
import { paper, radius, space } from '../theme.ts';
import { boldType as type, c } from './boldRhythm.ts';
import { BoldButton } from './BoldButton.tsx';
import { BoldChoice } from './BoldChoice.tsx';
import { BOLD_QUESTIONS, BOLD_GOALS, INTERESTS } from './boldChoices.ts';
import { BoldScene } from './motion/BoldScene.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';

import { soft, tapSettled } from '../motion/haptics.ts';
import { Glint } from '../motion/Glint.tsx';
import { MorphButton } from '../motion/MorphButton.tsx';

import { IconTile } from '../icons/IconTile.tsx';

import { SwitchRow } from '../settings/SwitchRow.tsx';

import { cancelReminder } from '../reminders/schedule.ts';

import { POLICY_SECTIONS, POLICY_TITLE } from '../legal/policy.ts';

import { REASONS, START_LEVELS, CONFIDENCE_OPTIONS, FOCUS_OPTIONS, minutesOf } from './plan.ts';
import { REASON_LABELS } from './story.ts';
import { GUEST_PAGES, resumePage } from './guestProgress.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft, type PreAccountPage } from './preAccountDraft.ts';
import { trackGuestMetric, clearGuestPractice, loadGuestPractice, saveGuestPractice, startGuestPractice, type GuestPractice } from './guestPractice.ts';
import { Choice } from './ChoiceCard.tsx';
import { ChoiceArt } from './ChoiceArt.tsx';
import { PlanEditRow } from './PlanEditRow.tsx';

import { useLaunchHold } from '../launch/useLaunch.ts';

import { FIRST_RUN_COPY } from './firstRun/copy.ts';
import { GOAL_TIERS, suggestedMinutes } from './firstRun/planModel.ts';

import { TILES_WRAP_AT } from './firstRun/PlanReveal.tsx';
import { PersonalPlan } from './PersonalPlan.tsx';
import { TutorSelection } from './TutorSelection.tsx';
import { useTutorPreview } from '../tutor/useTutorPreview.ts';
import { OnboardingLayout, useOnboardingTransition } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { loadSetupDraft, saveSetupDraft, clearSetupDraft } from './onboardingDraftStore.ts';
import { GlowAction, OnboardingScene, RevealItem } from './motion/OnboardingScenes.tsx';

import { GoalTile } from './firstRun/GoalTile.tsx';
import { ConsentFacts } from './firstRun/ConsentFacts.tsx';

type Surface =
  | 'plan'
  | 'voice'
  | 'start'
  | 'privacy'
  | 'policy'
  | null;
const goals = [...REASONS].sort(
  (a, b) =>
    ['food', 'family', 'trip', 'moving', 'work', 'because'].indexOf(a.key) -
    ['food', 'family', 'trip', 'moving', 'work', 'because'].indexOf(b.key),
);
const headingFor = (page: PreAccountPage) =>
  (
    ({
      'hear-it': 'Welcome to Luvani',
      reason: 'Make French yours.',
      'start-level': 'How’s your French?',
      confidence: 'How does speaking feel?',
      focus: 'What would help you most?',
      time: 'Your daily French moment.',
      'choose-tutor': 'Choose your tutor',
    }) as Partial<Record<PreAccountPage, string>>
  )[page];
export function PreAccountOnboarding({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
  refused = false,
  onRefuse,
  signedIn = false,
  active = true,
  previewOnly = false,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void | Promise<boolean>;
  onSignIn: () => void;
  refused?: boolean;
  onRefuse?: () => void;
  signedIn?: boolean;
  active?: boolean;
  /** Development preview: renders the real flow without guest admission. */
  previewOnly?: boolean;
}) {
  const reduced = useReduceMotion();
  const compact = useCompactPhone();
  const regular = useLayoutClass() === 'regular';
  const [choiceNudge, setChoiceNudge] = useState({ page: '', event: 0 });
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => ({ ...(initialDraft ?? freshPreAccountDraft()), onboardingVariant: initialDraft?.onboardingVariant ?? (process.env.EXPO_PUBLIC_ONBOARDING_VARIANT === 'five' ? 'five' : 'full') }));
  const questionOrder = draft.onboardingVariant === 'five' ? FIVE_SETUP : FULL_SETUP;
  const five = questionOrder === FIVE_SETUP;
  // The retired demo and save pages open the promise again; the retired
  // days-a-week page resumes on the daily goal that replaced it (D5).
  const [page, setPage] = useState<PreAccountPage>(() =>
    initialDraft?.page === 'account' ? initialDraft.accountReturnPage ?? 'keep' : initialDraft?.page === 'first-line' || initialDraft?.page === 'save'
      ? 'hear-it'
      : initialDraft?.page === 'frequency'
        ? 'time'
        : (initialDraft?.page ?? 'hear-it'),
  );
  const [surface, setSurface] = useState<Surface>(null);
  const [edit, setEdit] = useState(draft);
  const [planField, setPlanField] = useState<'reason' | 'interests' | 'start-level' | 'confidence' | 'focus' | 'time' | null>(null);
  const pageMotion = useOnboardingTransition();
  const preview = useTutorPreview({ active: active && page === 'choose-tutor' });
  const [guest, setGuest] = useState<GuestPractice | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Reading the guest's practice shows a loading line, so the launch screen
  // stays up over it and fades onto the welcome itself.
  useLaunchHold(!loaded);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [remember, setRemember] = useState(draft.rememberLearning === true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = useRef(true);
  const operation = useRef(false);
  const generation = useRef(0);
  const heading = useRef<Text>(null);
  const scroll = useRef<ScrollViewHandle>(null);
  const offsets = useRef<Record<string, number>>({});
  useEffect(() => {
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') { hearTicket.current += 1; player.pause(); }
    });
    return () => app.remove();
  }, []);
  const player = useAudioPlayer();
  const playback = useAudioPlayerStatus(player);
  const playing = playback.playing;
  useVoiceHold(playing);
  // Every Hear and every stop spends the ticket, so a stop during the mode change wins.
  const hearTicket = useRef(0);
  const patch = (change: Partial<PreAccountOnboardingDraft>) => {
    const next = { ...draftRef.current, ...change };
    draftRef.current = next;
    setDraft(next);
    if (!refused) {
      const persisted = { ...next, page };
      onDraftChange(persisted);
      if (signedIn) void saveSetupDraft(persisted);
    }
    return next;
  };
  const stopSound = () => {
    hearTicket.current += 1;
    player.pause();
    preview.stop();
  };
  const showPage = (next: PreAccountPage, backward = false) => {
    const completedSteps = backward ? (draftRef.current.onboardingCompletedSteps ?? [])
      : [...new Set([...(draftRef.current.onboardingCompletedSteps ?? []), page])];
    return pageMotion.transition(() => {
      setPage(next);
      const persisted = { ...draftRef.current, page: next, onboardingCompletedSteps: completedSteps };
      draftRef.current = persisted;
      setDraft(persisted);
      if (!refused) {
        onDraftChange(persisted);
        if (signedIn) void saveSetupDraft(persisted);
      }
    }, backward);
  };
  const go = (next: PreAccountPage, backward = false) => {
    if (operation.current || pageMotion.locked.current) return false;

    stopSound();
    generation.current++;
    setSurface(null);
    setIssue('');

    return showPage(next, backward);
  };
  useEffect(() => {
    current.current = true;
    void Promise.all([loadGuestPractice(), signedIn ? loadSetupDraft() : Promise.resolve(null)]).then(([value, savedDraft]) => {
      if (!current.current) return;
      setGuest(value);
      const savedPage = savedDraft?.page === 'account' ? savedDraft.accountReturnPage ?? 'keep' : savedDraft?.page === 'frequency' ? 'time' : savedDraft?.page === 'save' || savedDraft?.page === 'first-line' ? 'hear-it' : savedDraft?.page;
      if (savedDraft && !refused) {
        const restored = { ...savedDraft, onboardingVariant: savedDraft.onboardingVariant ?? draftRef.current.onboardingVariant };
        setDraft(restored);
        draftRef.current = restored;
        setRemember(restored.rememberLearning === true);
      }
      // A guest page needs its record, and day one and the save card a
      // finished practice on this phone (F754); otherwise an earlier page opens.
      const resumed = (savedPage ?? page) === 'remind' ? 'keep' : value && !value.live && GUEST_PAGES.includes(savedPage ?? page) ? (value.finishedAt?.length ? 'keep' : 'plan') : value?.live && GUEST_PAGES.includes(savedPage ?? page) ? (value.live.outcome === 'active' ? 'practice' : 'keep') : resumePage(savedPage ?? page, value !== null, guestPracticeDays(value), dayKeyOf(Date.now()));
      if (resumed !== page) setPage(resumed);
      if ((savedPage ?? page) === 'remind' && resumed === 'keep') {
        const restored = { ...draftRef.current, page: resumed, onboardingSkippedSteps: [...new Set([...(draftRef.current.onboardingSkippedSteps ?? []), 'remind'])] };
        draftRef.current = restored; setDraft(restored);
        if (!refused) { onDraftChange(restored); if (signedIn) void saveSetupDraft(restored); }
      }
      setLoaded(true);
    });
    // The player is left alone on the way out. useAudioPlayer's own cleanup
    // runs before this one, and it has already stopped and released the
    // player, so a call here throws on iOS and empties the screen (F792).
    return () => {
      current.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    scroll.current?.scrollTo({
      y: offsets.current[page] ?? 0,
      animated: false,
    });
    const node = heading.current;
    if (Platform.OS === 'web') (node as unknown as { focus?: () => void })?.focus?.();
    else {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [page, active]);
  const back = () => {
    if (surface) {
      setSurface(null);
      stopSound();
      return;
    }
    if (busy || GUEST_PAGES.includes(page)) return;
    if (page === 'choose-tutor') { go('plan', true); return; }
    const index = questionOrder.indexOf(page);
    if (index > 0) go(questionOrder[index - 1]!, true);
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [page, surface, busy]);
  const choose = (change: Partial<PreAccountOnboardingDraft>) => { patch(change); };
  const open = (next: Surface) => {
    if (pageMotion.locked.current || operation.current) return;
    stopSound();
    setEdit(draft);
    setPlanField(null);
    setSurface(next);
    setIssue('');
  };
  const hear = (asset: number | undefined, replace = false) => {
    if (playing && !replace) {
      stopSound();
      return;
    }
    if (asset == null) {
      setIssue('This phrase has no recording yet. You can still read it and practise.');
      return;
    }
    const ticket = ++hearTicket.current;
    // A full voice mode first, so the line is heard with the silent switch on (F723). The web has
    // no modes and plays only inside the tap, so there it starts at once (sound/voiceLine.ts).
    startVoiceLine(enterVoicePlayback().catch(() => undefined), () => {
      if (ticket !== hearTicket.current || !current.current || (Platform.OS !== 'web' && AppState.currentState !== 'active' && AppState.currentState !== null)) return;
      try {
        player.replace(asset);
        player.play();
      } catch {
        setIssue('Audio could not play. The words are still here.');
      }
    }, Platform.OS === 'web');
  };
  const metric = (
    name: Parameters<typeof trackGuestMetric>[2],
    evidence: 'typed' | 'spoken' | 'none' = 'none',
    record = guest,
  ) => {
    void trackGuestMetric(record, draftRef.current.analyticsConsent, name, evidence);
  };
  const persist = async (next: GuestPractice) => {
    const ticket = generation.current;
    const prior = guest;
    // Shown at once, except what only a save may claim: kept, finished, and
    // the finish days, which stay as they were until the write lands (F751).
    const shown: GuestPractice = { ...next, kept: prior?.kept ?? false, completed: prior?.completed ?? false };
    if (prior?.finishedAt) shown.finishedAt = prior.finishedAt;
    else delete shown.finishedAt;
    setGuest(shown);
    try {
      await saveGuestPractice(next);
      if (!current.current || ticket !== generation.current) return false;
      setGuest(next);
      setStorageNote('');
      return true;
    } catch {
      if (!current.current || ticket !== generation.current) return false;
      setStorageNote(
        'This device could not save your practice. Keep this page open and try saving again.',
      );
      return false;
    }
  };
  /** The plan is ready: one select sound and one settled tap. Setup is not learning, so nothing louder. */
  const planReady = () => {
    playSfx('select');
    tapSettled();
  };
  const start = async () => {
    if (operation.current || !draft.eligibilityConfirmed || refused) return;
    if (previewOnly) return;
    if (pageMotion.locked.current) return;
    operation.current = true;
    setBusy(true);
    const ticket = generation.current;
    try {
      const same =
        guest &&
        guest.live?.outcome === 'active' &&
        JSON.stringify(guest.live.brief) === JSON.stringify(briefFromDraft(draft));
      // A new practice keeps the days already finished on this phone (F751).
      const next = same && guest.live && guest.token && guest.expiresAt > Date.now()
          ? { ...guest, plan: draft }
          : await startGuestPractice(draft, guest);
      if (!current.current || ticket !== generation.current) return;
      if (!(await persist(next))) {
        setIssue('Your practice could not be saved. Try again before starting.');
        return;
      }
      if (!current.current || ticket !== generation.current) return;
      metric('practice_started', 'none', next);
      setSurface(null);
      showPage('practice');
      setIssue('');

    } catch (error) {
      if (current.current && ticket === generation.current) {
        setIssue(
          error instanceof Error && error.message === 'limit'
            ? 'Your guest practice is already in use or finished. Please try connecting again.'
            : 'The tutor can’t connect.',
        );

      }
    } finally {
      operation.current = false;
      if (current.current) setBusy(false);
    }
  };
  const saveAccount = async () => {
    if (operation.current || pageMotion.locked.current || refused || !draft.eligibilityConfirmed) return;
    operation.current = true;
    setBusy(true);
    stopSound();
    metric('save_progress');
    const owner = scopeGeneration();
    try {
      const saved = await onCreateAccount({ ...draftRef.current, page });
      if (owner !== scopeGeneration()) return;
      if (saved === false) { if (current.current) setIssue('Your plan could not be saved. Try again.'); }
      else if (signedIn) await clearSetupDraft();
    } catch {
      if (current.current && owner === scopeGeneration()) setIssue('Your plan could not be saved. Your practice is still here. Try again.');
    } finally {
      operation.current = false;
      if (current.current && owner === scopeGeneration()) setBusy(false);
    }
  };
  const nextQuestion = () => {
    const index = questionOrder.indexOf(page);
    if (index >= 0 && index < questionOrder.length - 1) {
      const next = questionOrder[index + 1]!;
      const moved = go(next);
      if (moved && next === 'plan') planReady();
      return moved;
    }
    return false;
  };
  const question = ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time'].includes(page);
  const answer =
    page === 'reason'
      ? draft.reason
      : page === 'interests' ? (draft.interests?.length ? draft.interests : null)
      : page === 'start-level'
        ? draft.startLevel
        : page === 'confidence'
          ? draft.speakingConfidence
          : page === 'focus'
            ? draft.practiceFocus
            : draft.minutes;
  const suggested = suggestedMinutes(draft);
  const drinksWrap = useFontScale() >= TILES_WRAP_AT;
  const blue = page === 'hear-it';
  const ground = blue && !refused ? c.violet : c.paper;
  const ink = blue && !refused ? c.white : c.ink;
  const progress = onboardingProgress({ page, completed: draft.onboardingCompletedSteps, five, signedIn, skipped: [...(draft.onboardingSkippedSteps ?? []), ...(draft.quickStart ? ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time'] : [])] });
  const reasonGrid = !drinksWrap;
  const goalGrid = !drinksWrap;
  const tutorName = tutorVoice(draft.tutorVoice).persona.name;
  const closeSheet = () => {
    if (busy) return false;
    stopSound();
    setSurface(null);
    return true;
  };
  const title = refused
    ? 'Luvani is for learners thirteen and up.'
    : (BOLD_QUESTIONS[page]?.title ?? (page === 'choose-tutor' ? 'Find your\nFrench voice.' : headingFor(page)) ??
      (page === 'plan'
        ? 'Your French,\nyour way.'
        : page === 'keep' ? 'Your saved practice is ready.' : 'Your first conversation'));
  if (!loaded)
    return (
      <Screen>
        <Text style={type.body}>Loading your practice…</Text>
      </Screen>
    );
  const footer = refused ? (
    signedIn ? (
      <GhostButton label="Sign out" onPress={onSignIn} />
    ) : null
  ) : blue ? (
    <View style={[readingColumn, { gap: space(2) }]}>
      <BoldButton label="Start your personal plan" onPress={() => go('reason')} />
      {!signedIn && <Press accessibilityLabel="I already have an account" onPress={onSignIn} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.label, { color: c.white, textAlign: 'center' }]}>I already have an account</Text></Press>}
    </View>
  ) : question ? (
    <View style={readingColumn}>
      <NextButton bold disabled={answer == null} label={nextSetupLabel(page, five)} key={page} onPress={nextQuestion} onDisabledPress={() => { if (!reduced) soft(); setChoiceNudge(v => ({ page, event: v.event + 1 })); }} />
      {choiceNudge.page === page && answer == null && <Text key={choiceNudge.event} accessibilityLiveRegion="polite" style={[type.small, { color: ink, textAlign: 'center' }]}>Choose one to continue.</Text>}
    </View>
  ) : page === 'plan' ? (
    <View style={readingColumn}>
      <BoldButton label="Choose your tutor" onPress={() => go('choose-tutor')} />
    </View>
  ) : page === 'choose-tutor' ? (
    <View style={[readingColumn, { gap: space(2) }]}><Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{draft.tutorChosen ? `Selected: ${tutorName}.` : 'Choose a tutor to continue.'}</Text><BoldButton label="Start your first practice" disabled={draft.tutorChosen !== true || busy} onPress={() => open('start')} /></View>
  ) : page === 'keep' ? (
    <PillButton label={FIRST_RUN_COPY.saveMyProgress} disabled={busy} onPress={() => void saveAccount()} />
  ) : null;
  const sheetFooter =
    surface === 'plan' || surface === 'voice' ? (
      <View style={{ gap: 4, paddingTop: 12 }}>
        <PillButton
          label="Done"
          onPress={() => {
            if (surface === 'voice') {
              patch({ tutorVoice: edit.tutorVoice });
              closeSheet();
            } else {
              patch({
                reason: edit.reason,
                interests: [...(edit.interests ?? [])],
                speakingConfidence: edit.speakingConfidence,
                practiceFocus: edit.practiceFocus,
                startLevel: edit.startLevel,
                minutes: edit.minutes,
                quickStart: false,
              });
              setSurface(null);

              planReady();
            }
          }}
        />
        <GhostButton label="Cancel" onPress={closeSheet} />
      </View>
    ) : surface === 'start' ? (
      <View style={{ gap: space(2), paddingTop: space(3) }}>
        <MorphButton
          label="Start practice"
          busyLabel={FIRST_RUN_COPY.connecting}
          doneLabel={FIRST_RUN_COPY.connected}
          state={busy ? 'busy' : 'idle'}
          disabled={!draft.eligibilityConfirmed || previewOnly}
          onPress={() => void start()}
        />

      </View>
    ) : undefined;
  return (
    <>
      {page === 'practice' && guest?.live ? <FirstLivePractice guest={guest} progress={progress} active={active && surface === null}
        onSafetyExit={() => showPage('plan')} onFinished={next => { setGuest(next); showPage(next.live?.outcome === 'completed' ? 'recap' : 'keep'); }} />
      : page === 'recap' && guest?.live ? <FirstSessionCelebration record={guest.live} progress={progress} onDone={() => showPage('keep')} />
      : page === 'keep' && guest?.live ? <FirstSessionSummary record={guest.live} progress={progress} busy={busy} issue={issue || storageNote} onSave={() => void saveAccount()} />
      : (
      <OnboardingLayout
        active={active}
        page={page}
        ground={ground}
        progress={progress}
        avoidKeyboard
        scrollRef={scroll}
        onScroll={(e) => { offsets.current[page] = e.nativeEvent.contentOffset.y; }}
        footer={footer}
      >
        <View style={[readingColumn, { paddingTop: blue ? 38 : 0, paddingBottom: 16 }]}>
          <Animated.View style={[{ gap: compact ? 12 : 16 }, pageMotion.style]}>

            {<Text
              ref={heading}
              {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
              accessibilityRole="header"
              style={[blue ? type.display : type.title, { color: ink, textAlign: 'center' }]}
              nativeID={`onboarding-${page}-heading`}
            >
              {title}
            </Text>}
            {refused ? (
              <View style={{ gap: 16 }}>
                <Illustration name="state-postcard-frame" fit="small" />
                <Text style={type.body}>Please come back when it is the right time.</Text>
              </View>
            ) : (
              <>
                {blue && <>
                  <BoldScene kind="welcome" width={280} active={active} />
                  <Text style={[type.heading, { color: ink, textAlign: 'center' }]}>Real conversations. Your own words.</Text>
                </>}
                {question && <>
                  <Text style={[type.body, { color: c.muted, textAlign: 'center' }]}>{BOLD_QUESTIONS[page]?.detail}</Text>
                  {page === 'confidence' && <BoldScene kind="confidence" width={185} active={active} />}
                  {page === 'focus' && <BoldScene kind="focus" width={185} active={active} />}
                  <View accessibilityRole={page === 'interests' ? undefined : 'radiogroup'} style={{ gap: 8 }}>
                    {page === 'reason' && BOLD_GOALS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.detail} selected={draft.reason === v.key} onPress={() => choose({ reason: v.key })} />)}
                    {page === 'interests' && INTERESTS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.detail} multiple selected={draft.interests?.includes(v.key) ?? false}
                      onPress={() => choose({ interests: draft.interests?.includes(v.key) ? draft.interests.filter(i => i !== v.key) : [...(draft.interests ?? []), v.key] })} />)}
                    {page === 'start-level' && START_LEVELS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={draft.startLevel === v.key} onPress={() => choose({ startLevel: v.key })} />)}
                    {page === 'confidence' && CONFIDENCE_OPTIONS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={draft.speakingConfidence === v.key} onPress={() => choose({ speakingConfidence: v.key })} />)}
                    {page === 'focus' && FOCUS_OPTIONS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={draft.practiceFocus === v.key} onPress={() => choose({ practiceFocus: v.key })} />)}
                    {page === 'time' && ([5, 10, 15, 20, 'none'] as const).map((minutes, index) => <BoldChoice key={minutes}
                      title={minutes === 'none' ? 'Choose each time' : `${minutes} minutes`}
                      detail={['A small start', 'Room for a conversation', 'A little more depth', 'Make a daily ritual', 'No fixed daily goal'][index]}
                      selected={draft.minutes === minutes} onPress={() => choose({ minutes })} />)}
                  </View>
                </>}
                {page === 'plan' && <PersonalPlan draft={draft} compact={compact} active={active} onEdit={() => open('plan')} />}
                {page === 'choose-tutor' && <TutorSelection
                  chosen={draft.tutorChosen ? draft.tutorVoice : null}
                  preview={preview}
                  onChoose={(voice) => choose({ tutorVoice: voice, tutorChosen: true })} />}
                {page === 'keep' && <Text style={type.body}>Save the practice already completed on this device to your account.</Text>}
              </>
            )}
            {issue !== '' ? (
              <View style={{ gap: 8 }}>
                <Text accessibilityLiveRegion="polite" style={[type.body, { color: ink }]}>
                  {issue}
                </Text>
                <IconActionRow><IconAction icon="refresh" label="Try again" onPress={() => void start()} /></IconActionRow>
              </View>
            ) : null}
            {storageNote !== '' ? (
              <Text accessibilityLiveRegion="polite" style={[type.small, { color: ink }]}>
                {storageNote}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </OnboardingLayout>
      )}
      <Sheet
        reading
        returnFocus={heading}
        visible={surface !== null}
        title={
          surface === 'plan'
            ? planField
              ? BOLD_QUESTIONS[planField]?.title ?? headingFor(planField)!
              : 'Change plan'
            : surface === 'voice'
              ? 'Choose tutor'
              : surface === 'start'
                ? 'Start your practice'
                : surface === 'policy' ? POLICY_TITLE : 'Your practice and privacy'
        }
        onClose={closeSheet}
        footer={sheetFooter}
      >
        {surface === 'plan' && (
          <>
            {planField === null ? (
              <>
                <PlanEditRow
                  label="Goal"
                  value={REASONS.find((v) => v.key === edit.reason)?.title ?? 'Choose a goal'}
                  onPress={() => setPlanField('reason')}
                />
                <PlanEditRow label="Interests" value={edit.interests?.map(key => INTERESTS.find(i => i.key === key)?.title).join(', ') || 'Choose interests'} onPress={() => setPlanField('interests')} />
                <PlanEditRow label="Speaking confidence" value={CONFIDENCE_OPTIONS.find(v => v.key === edit.speakingConfidence)?.title ?? 'Choose confidence'} onPress={() => setPlanField('confidence')} />
                <PlanEditRow label="Practice focus" value={FOCUS_OPTIONS.find(v => v.key === edit.practiceFocus)?.title ?? 'Choose focus'} onPress={() => setPlanField('focus')} />
                <PlanEditRow
                  label="French today"
                  value={
                    START_LEVELS.find((v) => v.key === edit.startLevel)?.title ??
                    'Choose your starting point'
                  }
                  onPress={() => setPlanField('start-level')}
                />
                <PlanEditRow
                  label="Daily goal"
                  value={
                    minutesOf(edit) === 'none'
                      ? FIRST_RUN_COPY.chooseEachTime
                      : `${minutesOf(edit)} ${FIRST_RUN_COPY.minutesUnit}`
                  }
                  onPress={() => setPlanField('time')}
                />
              </>
            ) : (
              <>
                {planField === 'reason' && BOLD_GOALS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.detail} selected={edit.reason === v.key} onPress={() => setEdit({ ...edit, reason: v.key })} />)}
                {planField === 'interests' && INTERESTS.map(v => <BoldChoice key={v.key} title={v.title} multiple selected={edit.interests?.includes(v.key) ?? false} onPress={() => setEdit({ ...edit, interests: edit.interests?.includes(v.key) ? edit.interests.filter(i => i !== v.key) : [...(edit.interests ?? []), v.key] })} />)}
                {planField === 'start-level' && START_LEVELS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={edit.startLevel === v.key} onPress={() => setEdit({ ...edit, startLevel: v.key })} />)}
                {planField === 'confidence' && CONFIDENCE_OPTIONS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={edit.speakingConfidence === v.key} onPress={() => setEdit({ ...edit, speakingConfidence: v.key })} />)}
                {planField === 'focus' && FOCUS_OPTIONS.map(v => <BoldChoice key={v.key} title={v.title} detail={v.gloss} selected={edit.practiceFocus === v.key} onPress={() => setEdit({ ...edit, practiceFocus: v.key })} />)}
                {planField === 'time' && ([5, 10, 15, 20, 'none'] as const).map(minutes => <BoldChoice key={minutes} title={minutes === 'none' ? FIRST_RUN_COPY.chooseEachTime : `${minutes} minutes a day`} selected={edit.minutes === minutes} onPress={() => setEdit({ ...edit, minutes })} />)}

              </>
            )}
          </>
        )}
        {surface !== 'start' && issue !== '' ? (
          <Text accessibilityLiveRegion="polite" style={type.body}>
            {issue}
          </Text>
        ) : null}
        {surface === 'voice' && (
          <>
            {TUTOR_VOICE_OPTIONS.map((v) => (
              <View key={v.value} style={{ gap: 4 }}>
                <Choice
                  ground={paper.ground}
                  title={tutorVoice(v.value).persona.name}
                  selected={edit.tutorVoice === v.value}
                  onPress={() => {
                    stopSound();
                    setEdit({ ...edit, tutorVoice: v.value });
                  }}
                />
                {edit.tutorVoice === v.value && (
                  <>
                    <Text style={type.small}>{tutorSampleLine(v.value)}</Text>
                    <IconAction
                      icon="speaker"
                      layout="inline"
                      label={playing ? 'Stop' : `Hear ${tutorVoice(v.value).persona.name}`}
                      onPress={() => hear(voiceSample(v.value))}
                    />
                  </>
                )}
              </View>
            ))}
          </>
        )}
        {surface === 'start' && (
          <>
            <ConsentFacts ai={STARTER_AI} processing={STARTER_PROCESSING} local={STARTER_LOCAL} />
            <IconAction icon="privacy" layout="inline" label="Privacy details" onPress={() => setSurface('privacy')} />
            <Choice
              ground={paper.ground}
              title="I am 13 or older"
              selected={draft.eligibilityConfirmed === true}
              onPress={() => choose({ eligibilityConfirmed: true })}
            />
            <GhostButton
              label="I am younger than that"
              onPress={() => {
                stopSound();
                // A reminder set on day one goes with the plan it belongs to.
                if (draftRef.current.reminderEnabled === true) void cancelReminder();
                void clearGuestPractice();
                if (signedIn) void clearSetupDraft();
                onRefuse?.();
                generation.current++;
                setSurface(null);
                setGuest(null);
                const fresh = freshPreAccountDraft();
                draftRef.current = fresh;
                setDraft(fresh);
              }}
            />
            <SwitchRow
              title="Optional usage data"
              sub="Help improve the app. Your words and audio are excluded."
              value={draft.analyticsConsent}
              accessibilityLabel="Optional usage data"
              onChange={(value) => patch({ analyticsConsent: value })}
            />
            <SwitchRow
              title="Remember my learning"
              sub="Let the tutor keep learning notes after you create an account."
              accessibilityLabel="Remember my learning"
              value={remember}
              onChange={(value) => {
                setRemember(value);
                patch({ rememberLearning: value });
              }}
            />
            {issue !== '' ? (
              <>
                <Text accessibilityLiveRegion="polite" style={type.body}>
                  {issue}
                </Text>
                <IconAction layout="inline" icon="refresh" busy={busy} label="Try again" disabled={busy} onPress={() => void start()} />
              </>
            ) : null}
          </>
        )}
        {surface === 'privacy' && (
          <>
            <Text style={type.body}>
              Your tutor is AI. Live audio uses LiveKit, Deepgram for transcription, and ElevenLabs for the tutor’s voice.
              Your replies and selected plan go to the configured AI provider to continue this conversation.
              Confirmed replies stay on this device. The service keeps a temporary session summary for up to 30 days so you can save it to your account. Guest usage comes out of the account’s one-time allowance.
            </Text>
            <Text style={type.body}>
              Speaking and typing use the same live conversation. Detailed processor and retention
              information is in the app’s privacy policy.
            </Text>
            <GhostButton label="Read privacy policy" onPress={() => setSurface('policy')} />
            <PillButton label="Start your conversation" onPress={() => setSurface('start')} />
          </>
        )}
        {surface === 'policy' && (
          <>
            {POLICY_SECTIONS.map((section) => (
              <View key={section.heading} style={{ gap: 12 }}>
                <Text accessibilityRole="header" style={type.heading}>
                  {section.heading}
                </Text>
                {section.body.map((paragraph, index) => (
                  <Text key={index} style={type.body}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
            <PillButton label="Done" onPress={() => setSurface('privacy')} />
          </>
        )}
      </Sheet>
    </>
  );
}
