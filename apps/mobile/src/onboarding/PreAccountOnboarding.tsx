import { briefFromDraft } from './firstLiveModel.ts';
import { FirstLivePractice } from './FirstLivePractice.tsx';
import { FirstSessionCelebration, FirstSessionSummary } from './FirstSessionResult.tsx';
import { guestPracticeDays } from './guestModel.ts';
import { dayKeyOf, tutorSampleLine } from '@luvani/core';
import { STARTER_AI, STARTER_LOCAL } from './disclosure.ts';
import { TermsAcceptance } from '../legal/TermsAcceptance.tsx';
import { TermsScreen } from '../legal/TermsScreen.tsx';
import type { C2QuestionPage } from './c2QuestionScenes.ts';
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
import { BOLD_QUESTIONS, BOLD_GOALS, INTERESTS, boldChoiceTone } from './boldChoices.ts';
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
import { useB } from '../main/bTheme.tsx';
import { bType } from '../theme.ts';
import { BArt } from '../art/BArt.tsx';
import { BBand, BBandDisc, BBandOrb, BCard, BInfoRow, BMicThin, BOption, BQuestionBand, BShield, BSunButton, BSwitchCard, BTextLink, BTopSpace, BTutorOrb, BVoiceOff, BWelcomeArt, BWelcomeChip, BPlanChip, QUESTION_BANDS, REASON_ICONS, bandColours } from './BOnboardingParts.tsx';
import { planChips } from './planChips.ts';

type Surface =
  | 'plan'
  | 'voice'
  | 'start'
  | 'privacy'
  | 'policy'
  | 'terms'
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
  onSignIn: (draft: PreAccountOnboardingDraft) => void;
  refused?: boolean;
  onRefuse?: () => void;
  signedIn?: boolean;
  active?: boolean;
  /** Development preview: renders the real flow without guest admission. */
  previewOnly?: boolean;
}) {
  const reduced = useReduceMotion();
  // 2026-10-21 UI-008, artboards B-OB-*: onboarding is pinned light, so these are b.light.
  const t = useB();
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
  const [needsAccount, setNeedsAccount] = useState(false);
  const [storageNote, setStorageNote] = useState('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = useRef(true);
  const operation = useRef(false);
  const generation = useRef(0);
  const refusedRef = useRef(refused);
  refusedRef.current = refused;
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
  useEffect(() => {
    if (!refused) return;
    generation.current++;
    stopSound();
    if (draftRef.current.reminderEnabled === true) void cancelReminder();
    void clearGuestPractice();
    if (signedIn) void clearSetupDraft();
    setGuest(null);
    const fresh = freshPreAccountDraft();
    draftRef.current = fresh;
    setDraft(fresh);
  }, [refused]);
  const showPage = (next: PreAccountPage, backward = false) => {
    const completedSteps = backward ? (draftRef.current.onboardingCompletedSteps ?? [])
      : [...new Set([...(draftRef.current.onboardingCompletedSteps ?? []), page])];
    return pageMotion.transition(() => {
      setSurface(null);
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
    if (Platform.OS === 'web') (node as unknown as { focus?: (options: { preventScroll: boolean }) => void })?.focus?.({ preventScroll: true });
    else {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [page, active]);
  const back = () => {
    // Admission acquires this ref synchronously, before busy can rerender.
    // Hardware Back must not dismiss consent while that request is settling.
    if (operation.current || busy || pageMotion.locked.current) return;
    if (surface) {
      if (surface === 'start') {
        stopSound();
        pageMotion.transition(() => setSurface(null), true);
        return;
      }
      setSurface(['privacy', 'policy', 'terms'].includes(surface) ? 'start' : null);
      stopSound();
      return;
    }
    if (GUEST_PAGES.includes(page)) return;
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
  const choose = (change: Partial<PreAccountOnboardingDraft>) => { if (!operation.current && !pageMotion.locked.current) patch(change); };
  const toggleRemember = () => {
    if (busy || operation.current || pageMotion.locked.current) return;
    choose({ rememberLearning: draftRef.current.rememberLearning !== true });
  };
  const open = (next: Surface) => {
    if (pageMotion.locked.current || operation.current) return;
    stopSound();
    setEdit(draft);
    setPlanField(null);
    const reveal = () => { setSurface(next); setIssue(''); };
    if (next === 'start') pageMotion.transition(reveal);
    else reveal();
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
  const continueWithAccount = async (basis = draftRef.current) => {
    if (operation.current || pageMotion.locked.current || refused || previewOnly || !basis.eligibilityConfirmed) return;
    operation.current = true; setBusy(true); stopSound();
    const ticket = generation.current;
    const owner = scopeGeneration();
    try {
      const saved = await onCreateAccount({ ...basis, page: 'choose-tutor' });
      if (owner !== scopeGeneration()) return;
      // Successful profile setup may unmount this screen before returning.
      // Clear only its captured account's setup draft after that durable save.
      if (saved !== false && signedIn) await clearSetupDraft();
      if (!current.current || ticket !== generation.current || owner !== scopeGeneration()) return;
      if (saved === false) setIssue('Your plan could not be saved. Your choices are still here. Try again.');
    } catch {
      if (current.current && ticket === generation.current && owner === scopeGeneration()) setIssue('Your plan could not be saved. Your choices are still here. Try again.');
    } finally {
      operation.current = false;
      if (current.current && ticket === generation.current && owner === scopeGeneration()) setBusy(false);
    }
  };
  const start = async () => {
    if (operation.current || refused) return;
    if (previewOnly) return;
    if (pageMotion.locked.current) return;
    // The visible Terms notice is accepted only by this deliberate Start tap.
    // Persist the declaration before invoking the existing eligible-only service.
    const acceptedDraft = patch({ eligibilityConfirmed: true });
    if (signedIn) { await continueWithAccount(acceptedDraft); return; }
    operation.current = true;
    setBusy(true);
    setNeedsAccount(false);
    const ticket = generation.current;
    try {
      const same =
        guest &&
        guest.live?.outcome === 'active' &&
        JSON.stringify(guest.live.brief) === JSON.stringify(briefFromDraft(acceptedDraft));
      // A new practice keeps the days already finished on this phone (F751).
      const next = same && guest.live && guest.token && guest.expiresAt > Date.now()
          ? { ...guest, plan: acceptedDraft }
          : await startGuestPractice(acceptedDraft, guest);
      if (!current.current || ticket !== generation.current || refusedRef.current) return;
      if (!(await persist(next))) {
        setIssue('Your practice could not be saved. Try again before starting.');
        return;
      }
      if (!current.current || ticket !== generation.current) return;
      metric('practice_started', 'none', next);
      showPage('practice');
      setIssue('');

    } catch (error) {
      if (current.current && ticket === generation.current) {
        if (error instanceof Error && error.message === 'guest-live-unavailable') {
          setNeedsAccount(true);
          setIssue('Create an account to start live practice. Your plan and chosen tutor are ready.');
          return;
        }
        if (error instanceof Error && error.message === 'voice-unavailable') {
          setIssue('Speaking is unavailable right now. Try again later.');
          return;
        }
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
  // 2026-10-21 UI-008, artboard B-OB-Welcome: the welcome is the brand page; the plan is cream under its sun band (B-OB-Plan).
  const ground = refused ? c.paper : blue ? t.brand : c.paper;
  const ink = blue && !refused ? t.onBrand : c.ink;
  const questionPages = questionOrder.filter(p => p !== 'hear-it' && p !== 'plan');
  const questionStep = (questionPages as readonly PreAccountPage[]).indexOf(page) + 1;
  const band = question && !refused ? bandColours(t, QUESTION_BANDS[page as C2QuestionPage].tone) : null;
  const statusBar = refused ? 'dark' : blue ? 'light' : band ? band.statusBar : page === 'choose-tutor' ? 'light' : 'dark';
  const progress = onboardingProgress({ page, completed: draft.onboardingCompletedSteps, five, signedIn, skipped: [...(draft.onboardingSkippedSteps ?? []), ...(draft.quickStart ? ['reason', 'interests', 'start-level', 'confidence', 'focus', 'time'] : [])] });
  const reasonGrid = !drinksWrap;
  const goalGrid = !drinksWrap;
  const tutorName = tutorVoice(draft.tutorVoice).persona.name;
  const closeSheet = () => {
    if (busy) return false;
    stopSound();
    setSurface(['privacy', 'policy', 'terms'].includes(surface ?? '') ? 'start' : null);
    return true;
  };
  const title = refused
    ? 'Luvani is for learners thirteen and up.'
    : (BOLD_QUESTIONS[page]?.title ?? (page === 'choose-tutor' ? 'Meet your tutor' : blue ? 'A little French.\nA bigger world.' : headingFor(page)) ??
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
      <GhostButton label="Sign out" onPress={() => onSignIn(draftRef.current)} />
    ) : null
  ) : blue ? (
    <View style={[readingColumn, { gap: space(2) }]}>
      <BSunButton label="Start your personal plan" onPress={() => go('reason')} />
      {!signedIn && <Press accessibilityLabel="I already have an account" onPress={() => onSignIn(draftRef.current)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[bType.bold15, { color: t.onBrand, textAlign: 'center' }]}>I already have an account</Text></Press>}
    </View>
  ) : question ? (
    <View style={readingColumn}>
      <NextButton bold disabled={answer == null} label={nextSetupLabel(page, five)} key={page} onPress={nextQuestion}
        disabledHint="Choose one to continue." showDisabledHint={choiceNudge.page === page && answer == null}
        onDisabledPress={() => { if (!reduced) soft(); setChoiceNudge(v => ({ page, event: v.event + 1 })); }} />
    </View>
  ) : page === 'plan' ? (
    <View style={readingColumn}>
      <BoldButton label="Choose your tutor" onPress={() => go('choose-tutor')} /><Press accessibilityLabel="Adjust my plan" onPress={() => open('plan')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[bType.bold15, { color: t.link, textAlign: 'center' }]}>Adjust my plan</Text></Press>
    </View>
  ) : page === 'choose-tutor' ? (
    <View style={[readingColumn, { gap: 10 }]}><Text style={[bType.note, { color: t.muted, textAlign: 'center' }]}>You can change voice any time in Settings.</Text><BoldButton label={draft.tutorChosen ? `Continue with ${tutorName}` : 'Choose a tutor'} disabled={draft.tutorChosen !== true || busy} onPress={() => open('start')} /></View>
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
    ) : undefined;
  const consentVisible = !refused && ['start', 'privacy', 'policy', 'terms'].includes(surface ?? '');
  const consentBody = (
          <>
            {/* 2026-10-21 UI-008, artboard B-OB-Ready: the info card. The pinned disclosure copy stays (STARTER_AI, STARTER_LOCAL). */}
            <BCard>
              <BInfoRow ground={t.lavender} icon={<BShield size={20} color={t.text} />} title={STARTER_AI.replace(/\.$/, '')} body="It can help you practise, and it can make mistakes." />
              <BInfoRow ground={t.butter} icon={<BMicThin size={20} color={t.text} />} title="Speak when you choose" body="We ask for the microphone only when you start. You can type instead." />
              <BInfoRow ground={t.sage} icon={<BVoiceOff size={20} color={t.text} />} title="What is kept" body={STARTER_LOCAL} />
              <BTextLink label="Privacy details" onPress={() => setSurface('privacy')} />
            </BCard>
            <Text style={[bType.eyebrow, { color: t.muted, paddingHorizontal: 4 }]}>Optional, off by default</Text>
            <BSwitchCard title="Share usage analytics" detail="Help improve Luvani. Your words and audio are excluded." selected={draft.analyticsConsent}
              onPress={() => choose({ analyticsConsent: !draft.analyticsConsent })} />
            <BSwitchCard title="Remember my learning" detail="Use learning memory for future practice" selected={draft.rememberLearning === true}
              onPress={toggleRemember} />
            {issue !== '' ? (
              <>
                <Text accessibilityLiveRegion="polite" style={type.body}>
                  {issue}
                </Text>
                <IconAction layout="inline" icon="refresh" busy={busy} label="Try again" disabled={busy} onPress={() => void start()} />
                {needsAccount && !signedIn && <GhostButton label="I already have an account" disabled={busy} onPress={() => onSignIn(draftRef.current)} />}
              </>
            ) : null}
          </>
  );
  return (
    <>
      <Animated.View style={[{ flex: 1, minHeight: 0 }, pageMotion.style]}>
      {consentVisible ? <OnboardingLayout page="before-practice" showScrollCue active={active} bleedTop statusBar="light" progress={{ ...progress, stageFraction: (1 + 2 / 3) / 4 }}
        hero={<BBand tone="brand" art={<><BBandDisc size={150} right={-36} top={-14} color={t.violet2} /><BBandOrb size={70} right={18} top={22} /></>}>
          <Text ref={heading} accessibilityRole="header" style={[bType.band32, { color: t.onBrand, marginTop: 12, maxWidth: '75%' }]}>Before we start.</Text>
          <Text style={[bType.para16, { color: t.onBrandSoft, maxWidth: '64%' }]}>A few things to know about your practice.</Text>
        </BBand>}
        footer={<View style={{ gap: 8 }}>
        <TermsAcceptance context="practice" onTerms={() => { if (!busy) setSurface('terms'); }} onPrivacy={() => { if (!busy) setSurface('policy'); }} />
        <BoldButton label={needsAccount ? 'Create account to start' : 'Start live practice'} state={busy ? 'busy' : 'idle'} disabled={busy || previewOnly} onPress={() => void (needsAccount ? continueWithAccount() : start())} />
        {previewOnly && <Text style={[type.small, { color: c.muted }]}>Practice is unavailable in this screen preview.</Text>}
      </View>}><View style={{ gap: 14, paddingTop: 20 }}>{consentBody}</View></OnboardingLayout>
      : !refused && page === 'practice' && guest?.live ? <FirstLivePractice guest={guest} progress={progress} active={active && surface === null}
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
        // 2026-10-21 UI-008, artboards B-Question, B-OB-Q2 to Q6, B-OB-Plan, B-OB-Tutor: each page draws its own band under the clock.
        bleedTop={!refused}
        statusBar={statusBar}
        hero={refused ? undefined
          : question ? <BQuestionBand page={page as C2QuestionPage} step={questionStep} total={questionPages.length} />
          : page === 'plan' ? <BBand tone="sun" art={<BArt name="map-route" width={176} height={161} style={{ position: 'absolute', right: -14, top: 20 }} />}>
              <Text style={[bType.eyebrow, { color: t.text, marginTop: 8 }]}>Your plan</Text>
              <Text ref={heading} accessibilityRole="header" nativeID="onboarding-plan-heading" style={[bType.band32, { color: t.text, maxWidth: '50%' }]}>{title.replace('\n', ' ')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, maxWidth: '62%' }}>{planChips(draft).map(chip => <BPlanChip key={chip} label={chip} />)}</View>
            </BBand>
          : page === 'choose-tutor' ? <BBand tone="brand" style={{ paddingBottom: 24, gap: 10 }}>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <BTutorOrb />
                <Text ref={heading} accessibilityRole="header" nativeID="onboarding-choose-tutor-heading" style={[bType.band32, { color: t.onBrand, textAlign: 'center' }]}>{title}</Text>
                <Text style={[bType.para16, { color: t.onBrandSoft, textAlign: 'center' }]}>Listen, then choose a voice. Your tutor is AI, with a character we wrote.</Text>
              </View>
            </BBand>
          : blue ? <BTopSpace extra={26} /> : undefined}
        footer={footer}
      >
        <View style={[readingColumn, { paddingBottom: question && !refused ? 0 : 16, ...(question && !refused ? { paddingTop: 18 } : null), ...(page === 'plan' || page === 'choose-tutor' ? { paddingTop: 20 } : null) }]}>
          <View style={{ gap: question ? 6 : compact ? 12 : 16 }}>
            {blue && !refused && <BWelcomeArt />}

            {/* 2026-10-21 UI-008: the welcome's display (B-OB-Welcome, second line in sun) and the 30/800 question title (B-Question). The plan and tutor titles sit in their bands. */}
            {page !== 'plan' && page !== 'choose-tutor' || refused ? <Text
              ref={heading}
              {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
              accessibilityRole="header"
              style={[blue && !refused ? bType.welcome40 : refused ? type.display : bType.title30, { color: ink, textAlign: 'center' }]}
              nativeID={`onboarding-${page}-heading`}
            >
              {blue && !refused ? <>{title.split('\n')[0]}{'\n'}<Text style={{ color: t.sun }}>{title.split('\n')[1]}</Text></> : question ? title.replace('\n', ' ') : title}
            </Text> : null}
            {refused ? (
              <View style={{ gap: 16 }}>
                <Illustration name="state-postcard-frame" fit="small" />
                <Text style={type.body}>Please come back when it is the right time.</Text>
              </View>
            ) : (
              <>
                {blue && <>
                  <Text style={[bType.para17, { color: t.onBrandSoft, textAlign: 'center' }]}>Real conversations with your own tutor, from your very first try.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                    {['Speak or type', 'Help when you stall', 'A few minutes a day'].map(chip => <BWelcomeChip key={chip} label={chip} />)}
                  </View>
                </>}
                {question && <>
                  <Text style={[bType.para16, { color: t.muted, textAlign: 'center' }]}>{BOLD_QUESTIONS[page]?.detail}</Text>
                  {/* 2026-10-21 UI-008, artboards B-Question and B-OB-Q2 to Q6: the B answer rows. Q1 has drawings and no sublines. */}
                  <View accessibilityRole={page === 'interests' ? undefined : 'radiogroup'} style={{ gap: 8, paddingTop: 10 }}>
                    {page === 'reason' && BOLD_GOALS.map((v) => <BOption key={v.key} title={v.title} icon={REASON_ICONS[v.key]} selected={draft.reason === v.key} onPress={() => choose({ reason: v.key })} />)}
                    {page === 'interests' && INTERESTS.map((v) => <BOption key={v.key} title={v.title} detail={v.detail} multiple selected={draft.interests?.includes(v.key) ?? false}
                      onPress={() => choose({ interests: draft.interests?.includes(v.key) ? draft.interests.filter(i => i !== v.key) : [...(draft.interests ?? []), v.key] })} />)}
                    {page === 'start-level' && START_LEVELS.map((v) => <BOption key={v.key} title={v.title} detail={v.gloss} selected={draft.startLevel === v.key} onPress={() => choose({ startLevel: v.key })} />)}
                    {page === 'confidence' && CONFIDENCE_OPTIONS.map((v) => <BOption key={v.key} title={v.title} detail={v.gloss} selected={draft.speakingConfidence === v.key} onPress={() => choose({ speakingConfidence: v.key })} />)}
                    {page === 'focus' && FOCUS_OPTIONS.map((v) => <BOption key={v.key} title={v.title} detail={v.gloss} selected={draft.practiceFocus === v.key} onPress={() => choose({ practiceFocus: v.key })} />)}
                    {page === 'time' && ([5, 10, 15, 20, 'none'] as const).map((minutes, index) => <BOption key={minutes}
                      title={minutes === 'none' ? FIRST_RUN_COPY.chooseEachTime : `${minutes} minutes`}
                      detail={['A small start', 'Room for a conversation', 'A little more depth', 'Make it a daily ritual', 'No fixed daily goal'][index]}
                      selected={draft.minutes === minutes} onPress={() => choose({ minutes })} />)}
                  </View>
                </>}
                {page === 'plan' && <PersonalPlan draft={draft} compact={compact} active={active && surface === null} onEdit={() => open('plan')} />}
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
          </View>
        </View>
      </OnboardingLayout>
      )}
      </Animated.View>
      <Sheet
        reading
        returnFocus={heading}
        visible={surface !== null && surface !== 'start'}
        title={
          surface === 'plan'
            ? planField
              ? BOLD_QUESTIONS[planField]?.title ?? headingFor(planField)!
              : 'Change plan'
            : surface === 'voice'
              ? 'Choose tutor'
              : surface === 'start'
                ? 'Start your practice'
                : surface === 'terms' ? 'Terms of Use' : surface === 'policy' ? POLICY_TITLE : 'Your practice and privacy'
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
                {planField === 'reason' && BOLD_GOALS.map((v, index) => <BoldChoice key={v.key} tone={boldChoiceTone(index)} title={v.title} detail={v.detail} selected={edit.reason === v.key} onPress={() => setEdit({ ...edit, reason: v.key })} />)}
                {planField === 'interests' && INTERESTS.map((v, index) => <BoldChoice key={v.key} tone={boldChoiceTone(index)} title={v.title} multiple selected={edit.interests?.includes(v.key) ?? false} onPress={() => setEdit({ ...edit, interests: edit.interests?.includes(v.key) ? edit.interests.filter(i => i !== v.key) : [...(edit.interests ?? []), v.key] })} />)}
                {planField === 'start-level' && START_LEVELS.map((v, index) => <BoldChoice key={v.key} tone={boldChoiceTone(index)} title={v.title} detail={v.gloss} selected={edit.startLevel === v.key} onPress={() => setEdit({ ...edit, startLevel: v.key })} />)}
                {planField === 'confidence' && CONFIDENCE_OPTIONS.map((v, index) => <BoldChoice key={v.key} tone={boldChoiceTone(index)} title={v.title} detail={v.gloss} selected={edit.speakingConfidence === v.key} onPress={() => setEdit({ ...edit, speakingConfidence: v.key })} />)}
                {planField === 'focus' && FOCUS_OPTIONS.map((v, index) => <BoldChoice key={v.key} tone={boldChoiceTone(index)} title={v.title} detail={v.gloss} selected={edit.practiceFocus === v.key} onPress={() => setEdit({ ...edit, practiceFocus: v.key })} />)}
                {planField === 'time' && ([5, 10, 15, 20, 'none'] as const).map((minutes, index) => <BoldChoice key={minutes} tone={boldChoiceTone(index)} title={minutes === 'none' ? FIRST_RUN_COPY.chooseEachTime : `${minutes} minutes a day`} selected={edit.minutes === minutes} onPress={() => setEdit({ ...edit, minutes })} />)}

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
        {surface === 'terms' && <TermsScreen onBack={() => setSurface('start')} />}
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
