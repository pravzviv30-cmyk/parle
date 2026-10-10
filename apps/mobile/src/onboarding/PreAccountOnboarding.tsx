import { offlineContinuation, continuingTask, finishGuestPractice, guestPracticeDays } from './guestModel.ts';
import { dayKeyOf, tutorSampleLine } from '@luvani/core';
import { STARTER_AI, STARTER_PROCESSING, STARTER_LOCAL } from './disclosure.ts';
/**
 * First value before registration. Answers are deliberate; local choices never wait for a service.
 *
 * Purpose, level, confidence, practice focus and daily goal create a personal
 * plan. A deliberate tutor choice precedes the eligibility and privacy sheet.
 * The first practice only offers speaking when the service permits it; a real
 * completed practice earns the streak and saved achievements. New accounts
 * receive their celebration after the progress handoff is durable. Decorative
 * animation never creates learning activity or answers on the user's behalf.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  BackHandler,
  type ScrollView as ScrollViewHandle,
  Text,
  TextInput,
  View,
  Platform,
  findNodeHandle,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { play as playSfx } from '../sound/sfx.ts';
import { starterTasks, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { useReduceMotion } from '../motion.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';
import { ChoiceNudge } from './firstRun/ChoiceNudge.tsx';
import { NextButton } from './NextButton.tsx';
import { FULL_SETUP, FIVE_SETUP, nextSetupLabel } from './flow.ts';
import { Card, GhostButton, IconAction, IconActionRow, IconButton, PillButton, Sheet } from '../components.tsx';
import { Screen, readingColumn, useCompactPhone, useFontScale, useLayoutClass } from '../layout.tsx';
import { colour, decorative, frenchText, onColour, paper, radius, space, type } from '../theme.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { tutorAudioForFrench } from '../daily/tutorAudio.ts';
import { arrived, celebrate, soft, tapSettled } from '../motion/haptics.ts';
import { Glint } from '../motion/Glint.tsx';
import { MorphButton } from '../motion/MorphButton.tsx';
import { DUR } from '../motion/tokens.ts';
import type { Box } from '../motion/flights.ts';
import { IconTile } from '../icons/IconTile.tsx';
import { consumeRecording } from '../speech/discardRecording.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { DEFAULT_REMINDER_TIME } from '../reminders/reminder.ts';
import { REMINDERS_AVAILABLE, cancelReminder } from '../reminders/schedule.ts';
import { ReminderAsk, type ReminderAnswer } from '../reminders/ReminderAsk.tsx';
import { celebrationKey } from '../celebrate/events.ts';
import { GAME_COPY } from '../game/copy.ts';
import { POLICY_SECTIONS, POLICY_TITLE } from '../legal/policy.ts';
import { FIRST_LINE } from './firstRun.ts';
import { clipFor } from './exchangeAudio.ts';
import { REASONS, START_LEVELS, CONFIDENCE_OPTIONS, FOCUS_OPTIONS, initialPracticeMode, minutesOf, practiceForecast } from './plan.ts';
import { personalPlanTitle, REASON_LABELS } from './story.ts';
import { GUEST_PAGES, guestInvestment, guestStreak, keptPhrase, resumePage, savedPhraseTasks, starterMinutes } from './guestProgress.ts';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
  type PreAccountPage,
} from './preAccountDraft.ts';
import {
  trackGuestMetric,
  clearGuestPractice,
  loadGuestPractice,
  saveGuestPractice,
  sendGuestAttempt,
  startGuestPractice,
  type GuestPractice,
} from './guestPractice.ts';
import { Choice } from './ChoiceCard.tsx';
import { ChoiceArt } from './ChoiceArt.tsx';
import { PlanEditRow } from './PlanEditRow.tsx';
import { GuestRecording } from './GuestRecording.tsx';
import { setLaunchWelcome, useLaunchHold } from '../launch/useLaunch.ts';
import {
  OnboardingArtwork,
  type ArtworkResponse,
} from './OnboardingMotion.tsx';
import { FIRST_RUN_COPY, SLOW_CHECK_MS, issueActions } from './firstRun/copy.ts';
import { GOAL_TIERS, slotFor, suggestedMinutes } from './firstRun/planModel.ts';
import { PlanCard, type FlyFrom } from './firstRun/PlanCard.tsx';
import { TILES_WRAP_AT } from './firstRun/PlanReveal.tsx';
import { PersonalPlan } from './PersonalPlan.tsx';
import { TutorSelection } from './TutorSelection.tsx';
import { useTutorPreview } from '../tutor/useTutorPreview.ts';
import { OnboardingLayout, useOnboardingTransition } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { loadSetupDraft, saveSetupDraft, clearSetupDraft } from './onboardingDraftStore.ts';
import { GlowAction, OnboardingScene, RevealItem } from './motion/OnboardingScenes.tsx';
import { Enter } from '../motion/layout.tsx';
import { GoalTile } from './firstRun/GoalTile.tsx';
import { ConsentFacts } from './firstRun/ConsentFacts.tsx';
import { WinArt, WinCard } from './firstRun/WinCard.tsx';
import { ExchangeSteps } from './firstRun/ExchangeSteps.tsx';
import { winEffects, winView } from './firstRun/winModel.ts';
import { speakingOffered, speechRefused, startMode } from './firstRun/speech.ts';
import { StreakCard } from './firstRun/StreakCard.tsx';
import { StreakCelebrationScreen } from './firstRun/StreakCelebrationScreen.tsx';
import { InvestmentList } from './firstRun/InvestmentList.tsx';

type Surface =
  | 'plan'
  | 'voice'
  | 'start'
  | 'help'
  | 'feedback'
  | 'privacy'
  | 'reminder'
  | 'exit'
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
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void | Promise<boolean>;
  onSignIn: () => void;
  refused?: boolean;
  onRefuse?: () => void;
  signedIn?: boolean;
  active?: boolean;
}) {
  const reduced = useReduceMotion();
  const compact = useCompactPhone();
  const regular = useLayoutClass() === 'regular';
  useLayoutEffect(() => {
    setLaunchWelcome(initialDraft === null);
    return () => setLaunchWelcome(false);
  }, []);
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
  const [planField, setPlanField] = useState<'reason' | 'start-level' | 'time' | null>(null);
  const [pose, setPose] = useState<ArtworkResponse>('welcome');
  const [event, setEvent] = useState(0);
  const pageMotion = useOnboardingTransition();
  const preview = useTutorPreview({ active: active && page === 'choose-tutor' });
  const [guest, setGuest] = useState<GuestPractice | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Reading the guest's practice shows a loading line, so the launch screen
  // stays up over it and fades onto the welcome itself.
  useLaunchHold(!loaded);
  const [taskIndex, setTaskIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'typed' | 'spoken'>('typed');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [issue, setIssue] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [remember, setRemember] = useState(draft.rememberLearning === true);
  // The reminder ask on day one was answered on this visit (Not now, or after
  // a refusal), so it is not asked again on the way back.
  const [reminderAnswered, setReminderAnswered] = useState(false);
  // The plan card's flight: where the last answer was chosen (README Part 6, Flight).
  const [flight, setFlight] = useState<FlyFrom | null>(null);
  // The win that has just arrived from a real submit, so it plays once; a
  // return to the page shows its final frame.
  const [moment, setMoment] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = useRef(true);
  const operation = useRef(false);
  const generation = useRef(0);
  const navigationAt = useRef(0);
  const heading = useRef<Text>(null);
  const scroll = useRef<ScrollViewHandle>(null);
  const offsets = useRef<Record<string, number>>({});
  const rows = useRef<Record<string, View | null>>({});
  const rowRef = (id: string) => (node: View | null) => {
    rows.current[id] = node;
  };
  const activeClock = useRef({ since: 0, milliseconds: 0 });
  useEffect(() => {
    const clock = activeClock.current;
    clock.since = page === 'practice' && AppState.currentState === 'active' ? Date.now() : 0;
    clock.milliseconds = 0;
    const app = AppState.addEventListener('change', (state) => {
      if (clock.since) clock.milliseconds += Date.now() - clock.since;
      clock.since = state === 'active' && page === 'practice' ? Date.now() : 0;
      if (state !== 'active') { hearTicket.current += 1; player.pause(); }
    });
    return () => {
      app.remove();
      clock.since = 0;
    };
  }, [page]);
  const activeSeconds = () =>
    Math.min(
      120,
      Math.round(
        (activeClock.current.milliseconds +
          (activeClock.current.since ? Date.now() - activeClock.current.since : 0)) /
          1000,
      ),
    );
  const player = useAudioPlayer();
  const playback = useAudioPlayerStatus(player);
  const playing = playback.playing;
  useVoiceHold(playing);
  // Every Hear and every stop spends the ticket, so a stop during the mode change wins.
  const hearTicket = useRef(0);
  const pulse = (next: ArtworkResponse) => {
    setPose(next);
    setEvent((value) => value + 1);
  };
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
    navigationAt.current = Date.now();
    stopSound();
    generation.current++;
    setSurface(null);
    setIssue('');
    setMoment(null);
    setFlight(null);
    pulse(next === 'plan' ? 'ready' : 'next');
    return showPage(next, backward);
  };
  const activePlan = GUEST_PAGES.includes(page) && guest ? guest.plan : draft;
  const tasks = starterTasks(
    activePlan.reason,
    activePlan.drink ?? 'coffee',
    starterMinutes(activePlan.minutes),
  );
  const task = tasks[Math.min(taskIndex, tasks.length - 1)]!;
  // The plan page always shows where the practice starts, even when Back
  // reaches it from a later exchange.
  const firstTask = tasks[0]!;
  const attempts = guest?.attempts.filter((a) => a.taskId === task.id) ?? [];
  const serviceAttempts = attempts.filter((attempt) => !attempt.offline).length;
  const last = guest?.attempts.at(-1);
  // Day one and the save card read the days this phone saw a practice
  // finished, and nothing else (F751, F754).
  const today = dayKeyOf(Date.now());
  useHomeRefresh(active && (page === 'remind' || page === 'home'));
  const days = guestPracticeDays(guest);
  const streak = guestStreak(days, today);
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
      const resumed = resumePage(savedPage ?? page, value !== null, guestPracticeDays(value), dayKeyOf(Date.now()));
      if (resumed !== page) setPage(resumed);
      if ((savedPage ?? page) === 'remind' && resumed === 'keep') {
        const restored = { ...draftRef.current, page: resumed, onboardingSkippedSteps: [...new Set([...(draftRef.current.onboardingSkippedSteps ?? []), 'remind'])] };
        draftRef.current = restored; setDraft(restored);
        if (!refused) { onDraftChange(restored); if (signedIn) void saveSetupDraft(restored); }
      }
      if (value && GUEST_PAGES.includes(resumed)) {
        setReply(value.attempts.at(-1)?.reply ?? '');
        setTaskIndex(
          Math.max(
            0,
            starterTasks(
              value.plan.reason,
              value.plan.drink ?? 'coffee',
              starterMinutes(value.plan.minutes),
            ).findIndex((t) => t.id === value.attempts.at(-1)?.taskId),
          ),
        );
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
  useEffect(() => {
    if (playing) setPose('speaking');
    else setPose(page === 'practice' ? 'attentive' : 'neutral');
  }, [playing]);
  // A reply that takes a while says so, once, after a real wait (no fake progress).
  useEffect(() => {
    if (!busy || page !== 'practice') {
      setSlow(false);
      return undefined;
    }
    const wait = setTimeout(() => setSlow(true), SLOW_CHECK_MS);
    return () => clearTimeout(wait);
  }, [busy, page]);
  const back = () => {
    if (surface) {
      setSurface(null);
      stopSound();
      return;
    }
    if (busy || capturing) return;
    if (page === 'practice') {
      if (reply.trim()) setSurface('exit');
      else go(guest?.attempts.length ? 'recap' : 'plan', true);
      return;
    }
    if (page === 'recap') {
      go('plan', true);
      return;
    }
    // After the win: day one goes back to the win, the save card to day one
    // (or to the win when the run has lapsed), the guest home to the save card.
    if (page === 'remind') {
      go('recap', true);
      return;
    }
    if (page === 'keep') {
      go(streak !== null ? 'remind' : 'recap', true);
      return;
    }
    if (page === 'home') {
      go(days.length > 0 ? 'keep' : 'recap', true);
      return;
    }
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
  }, [page, surface, busy, capturing]);
  const choose = (change: Partial<PreAccountOnboardingDraft>) => {
    const [field, value] = Object.entries(change)[0] ?? [];
    const empty = field === undefined || draftRef.current[field as keyof PreAccountOnboardingDraft] == null;
    patch(change);
    pulse('choice');
    // The answer's token flies from the row it was chosen on into its empty
    // slot; changing an answer swaps the token in place, with no second flight.
    const slot = field === undefined ? null : slotFor(field as keyof PreAccountOnboardingDraft);
    if (slot !== null && slot !== 'drink' && empty)
      setFlight({ slot, from: { current: rows.current[`${field}:${String(value)}`] ?? null }, id: Date.now() });
  };
  const open = (next: Surface) => {
    if (pageMotion.locked.current || operation.current) return;
    stopSound();
    setEdit(draft);
    setPlanField(null);
    setSurface(next);
    setIssue('');
    if (next === 'help') {
      metric('help_used');
      pulse('help');
    }
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
  const start = async (offline = false) => {
    if (operation.current || !draft.eligibilityConfirmed || refused) return;
    if (pageMotion.locked.current) return;
    operation.current = true;
    setBusy(true);
    const ticket = generation.current;
    try {
      const same =
        guest &&
        !guest.completed &&
        JSON.stringify([guest.plan.reason, guest.plan.drink, guest.plan.minutes]) ===
          JSON.stringify([draft.reason, draft.drink, draft.minutes]);
      // A new practice keeps the days already finished on this phone (F751).
      const next = offline
        ? offlineContinuation(draft, guest)
        : same && guest.token && guest.expiresAt > Date.now()
          ? { ...guest, plan: draft }
          : await startGuestPractice(draft, guest);
      if (!current.current || ticket !== generation.current) return;
      if (!(await persist(next))) {
        setIssue('Your practice could not be saved. Try again before starting.');
        return;
      }
      if (!current.current || ticket !== generation.current) return;
      metric('practice_started', 'none', next);
      // Speaking leads only where the server said guest speech is available (F756).
      setMode(initialPracticeMode(draft) === 'spoken' && speakingOffered(next) ? 'spoken' : 'typed');
      setTaskIndex(0);
      setReply('');
      setSurface(null);
      showPage('practice');
      setIssue('');
      pulse('attentive');
    } catch (error) {
      if (current.current && ticket === generation.current) {
        setIssue(
          error instanceof Error && error.message === 'limit'
            ? 'Your guest practice is already in use or finished. You can practise this offline.'
            : 'The tutor can’t connect.',
        );
        pulse('connection');
      }
    } finally {
      operation.current = false;
      if (current.current) setBusy(false);
    }
  };
  const submit = async (uri?: string) => {
    if (
      !guest ||
      operation.current ||
      pageMotion.locked.current ||
      (guest.token && !guest.offline && serviceAttempts >= 2) ||
      (!uri && !reply.trim())
    )
      return;
    operation.current = true;
    setBusy(true);
    stopSound();
    const ticket = generation.current;
    try {
      const result = uri
        ? await consumeRecording(uri, (take) =>
            sendGuestAttempt(guest, task, '', take, activeSeconds()),
          )
        : await sendGuestAttempt(guest, task, reply.trim(), undefined, activeSeconds());
      if (!result || !current.current || ticket !== generation.current) return;
      const next = {
        ...guest,
        attempts: [...guest.attempts, result].slice(-100),
        kept: false,
        secondsUsed: result.secondsUsed,
      };
      await persist(next);
      if (!current.current || ticket !== generation.current) return;
      if (result.feedback.accepted) metric('useful_reply', uri ? 'spoken' : 'typed', next);
      metric('feedback_seen', uri ? 'spoken' : 'typed', next);
      showPage('recap');
      setIssue('');
      pulse(result.feedback.accepted ? 'success' : 'help');
      // Only an accepted reply the learner gave is celebrated; anything else is calm (README Part 5.A).
      const real = result.feedback.accepted && result.feedback.evidence !== 'model';
      const effects = winEffects({ celebrate: real });
      if (real) setMoment(`guest-win:${result.at}`);
      playSfx(effects.sound);
      if (effects.haptic === 'celebrate') celebrate();
      else soft();
    } catch (error) {
      if (current.current && ticket === generation.current) {
        if (speechRefused(error)) {
          // The service said guest speech is closed: the take was never
          // transcribed and no attempt was spent (F756).
          setMode('typed');
          setGuest((value) => (value ? { ...value, speechAvailable: false } : value));
          setIssue(FIRST_RUN_COPY.speechPaused);
          return;
        }
        // A spoken take is discarded once sent, so its failure (a failed
        // transcription, 'unavailable', or a dropped connection) never says a
        // reply is still here: it offers a new take or typing (F776).
        setIssue(
          error instanceof Error && error.message === 'expired'
            ? 'Your guest practice has expired. Your phrase is still here. You can practise this offline.'
            : error instanceof Error && error.message === 'limit'
              ? 'This starter has used its two attempts. You can practise this offline or finish.'
              : uri
                ? FIRST_RUN_COPY.takeUnheard
                : 'The tutor can’t connect. Your reply is still here.',
        );
        pulse('connection');
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
  const finish = async () => {
    if (!guest || operation.current || pageMotion.locked.current) return;
    operation.current = true; setBusy(true);
    try {
      const at = Date.now();
      const day = dayKeyOf(at);
      const fresh = !guestPracticeDays(guest).includes(day);
      const finished = finishGuestPractice(guest, at);
      // A real finish must reach disk before the streak introduction opens.
      if (!(await persist(finished))) return;
      metric('practice_finished');
      operation.current = false;
      if (!go('remind')) return;
      if (fresh) {
        setMoment(celebrationKey.streak(day));
      }
    } finally {
      operation.current = false;
      if (current.current) setBusy(false);
    }
  };
  /** The reminder ask's answer: on only once the OS took it, every day, at the time chosen. */
  const answerReminder = (answer: ReminderAnswer) => {
    setReminderAnswered(true);
    if (answer.enabled) patch({ reminderEnabled: true, reminderTime: answer.time, reminderDays: [] });
  };
  const keepPhrase = async () => {
    if (!guest) return;
    const saved = await persist({
      ...guest,
      kept: true,
      attempts: guest.attempts.map((attempt, index) =>
        index === guest.attempts.length - 1 ? { ...attempt, kept: true } : attempt,
      ),
    });
    if (saved) {
      metric('phrase_kept');
      playSfx('save');
      arrived();
      setStorageNote('Phrase kept on this device.');
    }
  };
  const nextExchange = () => {
    setTaskIndex((i) => i + 1);
    setReply('');
    go('practice');
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
  const question = ['reason', 'start-level', 'confidence', 'focus', 'time'].includes(page);
  const answer =
    page === 'reason'
      ? draft.reason
      : page === 'start-level'
        ? draft.startLevel
        : page === 'confidence'
          ? draft.speakingConfidence
          : page === 'focus'
            ? draft.practiceFocus
            : draft.minutes;
  const suggested = suggestedMinutes(draft);
  const lastTask = last ? (tasks.find((t) => t.id === last.taskId) ?? task) : task;
  // The guest home names only a phrase the hand-off would save: the natural
  // line of the newest accepted or kept reply, never a refused one (F757).
  const homePhrase = page === 'home' ? (savedPhraseTasks(guest).at(-1) ?? null) : null;
  const win = page === 'recap' && last ? winView(last, lastTask.model, taskIndex < tasks.length - 1) : null;
  const modelAudio = tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, lastTask.model, draft.tutorVoice);
  const drinksWrap = useFontScale() >= TILES_WRAP_AT;
  const blue = page === 'hear-it';
  const coral = page === 'recap' && win?.celebrate === true;
  const ground = paper.ground;
  const ink = paper.ink;
  const progress = onboardingProgress({ page, completed: draft.onboardingCompletedSteps, five, signedIn, skipped: [...(draft.onboardingSkippedSteps ?? []), ...(draft.quickStart ? ['reason', 'start-level', 'confidence', 'focus', 'time'] : [])] });
  const reasonGrid = !drinksWrap;
  const goalGrid = !drinksWrap;
  // The reminder is asked once on day one, only where a reminder can be given
  // and is not already set, and not again once answered on this visit.
  const askShown = REMINDERS_AVAILABLE && draft.reminderEnabled !== true && !reminderAnswered;
  const tutorName = tutorVoice(draft.tutorVoice).persona.name;
  // What the row under a failed start or reply offers: a reply is retried only when it was typed (F776).
  const actions = issueActions(issue, page !== 'practice' ? 'start' : mode);
  const closeSheet = () => {
    if (busy) return false;
    stopSound();
    setSurface(null);
    return true;
  };
  const title = refused
    ? 'Luvani is for learners thirteen and up.'
    : (headingFor(page) ??
      (page === 'plan'
        ? 'Your plan is ready.'
        : page === 'practice'
          ? task.title
          : page === 'recap'
            ? last?.feedback.accepted
              ? 'That reply works.'
              : 'Try this small change.'
            : page === 'remind'
              ? (streak?.current && streak.current > 1 ? 'Your streak continues.' : 'Your streak has started.')
              : page === 'keep'
                ? FIRST_RUN_COPY.keepTitle
                : 'Keep going with your French.'));
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
      <GlowAction tone="sun"><PillButton label="Start your personal plan" tone="sun" onPress={() => go('reason')} /></GlowAction>
      {!signedIn && <IconAction icon="forward" layout="inline" ground="blue" label="I already have an account" onPress={onSignIn} />}
    </View>
  ) : question ? (
    <View style={readingColumn}>
      {/* Keyed by page, so each question responds once when its answer is chosen. */}
      <NextButton disabled={answer == null} label={nextSetupLabel(page, five)} onPress={nextQuestion} key={page} onDisabledPress={() => {
        if (!reduced) soft();
        setChoiceNudge((prior) => ({ page, event: prior.event + 1 }));
      }} />
      {choiceNudge.page === page && answer == null && <Text key={choiceNudge.event} accessibilityLiveRegion="polite" style={[type.small, { color: ink, textAlign: 'center' }]}>Choose one to continue.</Text>}
    </View>
  ) : page === 'plan' ? (
    <View style={readingColumn}>
      <GlowAction tone="blue"><PillButton label="Next: Choose your tutor" onPress={() => go('choose-tutor')} icon={<Glint when radius={radius.control} />} /></GlowAction>
    </View>
  ) : page === 'choose-tutor' ? (
    <View style={[readingColumn, { gap: space(2) }]}><Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{draft.tutorChosen ? `Selected: ${tutorName}.` : 'Choose a tutor to continue.'}</Text><PillButton label="Start your first practice" disabled={draft.tutorChosen !== true || busy} onPress={() => open('start')} /></View>
  ) : page === 'practice' ? (
    mode === 'typed' ? (
      <View style={readingColumn}>
        <MorphButton
          label={FIRST_RUN_COPY.sendReply}
          busyLabel={FIRST_RUN_COPY.checking}
          doneLabel={FIRST_RUN_COPY.checked}
          state={busy ? 'busy' : 'idle'}
          disabled={!reply.trim() || (guest?.token != null && !guest.offline && serviceAttempts >= 2)}
          onPress={() => void submit()}
        />
      </View>
    ) : null
  ) : page === 'recap' ? (
    <View style={readingColumn}>
      <PillButton
        tone="ink"
        label={win?.primary ?? FIRST_RUN_COPY.continue}
        disabled={busy}
        onPress={() => {
          if (taskIndex < tasks.length - 1) nextExchange();
          else void finish();
        }}
      />
    </View>
  ) : page === 'remind' ? (
    null
  ) : page === 'keep' ? (
    <View style={readingColumn}><RevealItem index={5}><PillButton label={FIRST_RUN_COPY.saveMyProgress} disabled={busy} onPress={() => void saveAccount()} /></RevealItem></View>
  ) : (
    <View style={readingColumn}>
      <PillButton
        label="Continue practice"
        onPress={() => {
          setTaskIndex(
            guest
              ? Math.max(
                  0,
                  tasks.findIndex((t) => t.id === continuingTask(guest).id),
                )
              : 0,
          );
          setReply('');
          setGuest(
            guest ? { ...guest, offline: true, completed: false } : offlineContinuation(draft, null),
          );
          go('practice');
        }}
      />
    </View>
  );
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
                startLevel: edit.startLevel,
                minutes: edit.minutes,
                quickStart: false,
              });
              setSurface(null);
              pulse('ready');
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
          disabled={!draft.eligibilityConfirmed}
          onPress={() => void start()}
        />
        <IconAction
          icon="cloud-off"
          layout="inline"
          label="Practise offline"
          disabled={busy || !draft.eligibilityConfirmed}
          onPress={() => void start(true)}
        />
      </View>
    ) : undefined;
  return (
    <>
      {page === 'remind' ? <StreakCelebrationScreen
        streak={streak}
        today={today}
        moment={moment}
        progress={progress}
        headingRef={heading}
        active={active && surface === null}
        onBack={back}
        onContinue={() => go(streak === null ? 'practice' : 'keep')}
        onReminder={REMINDERS_AVAILABLE && draft.reminderEnabled !== true ? () => open('reminder') : undefined}
        notice={issue || storageNote}
      /> : (
      <OnboardingLayout
        active={active}
        page={page}
        progress={progress}
        avoidKeyboard
        scrollRef={scroll}
        onScroll={(e) => { offsets.current[page] = e.nativeEvent.contentOffset.y; }}
        footer={footer}
      >
        <View style={[readingColumn, { paddingBottom: compact ? 8 : 16 }]}>
          <Animated.View style={[{ gap: compact ? 12 : 16 }, pageMotion.style]}>

            {<Text
              ref={heading}
              {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
              accessibilityRole="header"
              style={[!compact && (blue || question || page === 'plan') ? type.display : type.title, { color: ink, textAlign: 'center' }]}
              nativeID={`onboarding-${page}-heading`}
            >
              {title}
            </Text>}
            {!refused && page === 'recap' && (
              <WinArt celebrate={coral} moment={moment}>
                <OnboardingArtwork
                  name={
                    page === 'recap'
                      ? last?.feedback.accepted
                        ? 'celebrate-first-line'
                        : 'state-notebook'
                      : 'place-cafe-counter'
                  }
                  response={pose}
                  event={event}
                />
              </WinArt>
            )}
            {refused ? (
              <View style={{ gap: 16 }}>
                <Illustration name="state-postcard-frame" fit="small" />
                <Text style={type.body}>Please come back when it is the right time.</Text>
              </View>
            ) : (
              <>
                {blue && (
                  <>
                    <OnboardingScene kind="welcome" size={compact ? 180 : 240} />
                    <Text style={[type.body, { color: ink, textAlign: 'center' }]}>French for the moments that matter to you.</Text>
                    <View style={{ gap: 14 }}>
                      {['A plan built around your goals', 'An AI tutor you can talk to', 'Small daily steps. Real practice.'].map((line, index) => <RevealItem key={line} index={index}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconTile name={index === 0 ? 'calendar' : index === 1 ? 'chat' : 'flame'} ground={index === 0 ? 'sun' : index === 1 ? 'mint' : 'coral'} size={36} /><Text style={[type.bodyStrong, { color: ink, flex: 1 }]}>{line}</Text></View></RevealItem>)}
                    </View>
                  </>
                )}
                {question && (
                  <>
                    {page === 'start-level' && <OnboardingScene kind="level" size={compact ? 84 : 116} />}
                    {page === 'confidence' && <OnboardingScene kind="level" size={compact ? 90 : 140} />}
                    {page === 'focus' && <OnboardingScene kind="welcome" size={compact ? 90 : 140} />}
                    {page === 'time' && <OnboardingScene kind="plan" size={compact ? 90 : 140} />}
                    <View accessibilityRole="radiogroup" style={{ gap: compact ? 8 : 10, flexDirection: regular || (page === 'reason' && reasonGrid) || (page === 'time' && goalGrid) ? 'row' : 'column', flexWrap: 'wrap' }}>
                      {page === 'reason' &&
                        goals.map((v, index) => (
                          <ChoiceNudge key={v.key} event={choiceNudge.page === page ? choiceNudge.event : 0} index={index} width={regular ? '31%' : reasonGrid ? '48%' : undefined}><View ref={rowRef(`reason:${v.key}`)} collapsable={false}>
                            <Choice
                              compact={compact}
                              layout={regular || reasonGrid ? 'tile' : 'row'}
                              title={REASON_LABELS[v.key]}
                              glyph={<ChoiceArt kind={v.key} />}
                              selected={draft.reason === v.key}
                              onPress={() => choose({ reason: v.key })}
                            />
                          </View></ChoiceNudge>
                        ))}
                      {page === 'start-level' &&
                        START_LEVELS.map((v, index) => (
                          <ChoiceNudge key={v.key} event={choiceNudge.page === page ? choiceNudge.event : 0} index={index} width="100%"><View ref={rowRef(`startLevel:${v.key}`)} collapsable={false}>
                            <Choice
                              compact={compact}
                              layout="row"
                              title={v.title}
                              detail={undefined}
                              glyph={<ChoiceArt kind={v.key} />}
                              selected={draft.startLevel === v.key}
                              onPress={() => choose({ startLevel: v.key })}
                            />
                          </View></ChoiceNudge>
                        ))}
                      {(page === 'confidence' || page === 'focus') &&
                        (page === 'confidence' ? CONFIDENCE_OPTIONS : FOCUS_OPTIONS).map((option, index) => (
                          <ChoiceNudge key={option.key} event={choiceNudge.page === page ? choiceNudge.event : 0} index={index} width="100%">
                            <Choice compact={compact} ground={page === 'focus' ? 'blue' : 'sun'} title={option.title}
                              glyph={<IconTile name={page === 'confidence' ? 'chat' : index === 0 ? 'speaker' : index === 1 ? 'microphone' : 'bubble-line'} ground={index === 0 ? 'mint' : index === 1 ? 'sun' : 'coral'} size={36} />}
                              selected={page === 'confidence' ? draft.speakingConfidence === option.key : draft.practiceFocus === option.key}
                              onPress={() => choose(page === 'confidence' ? { speakingConfidence: option.key as PreAccountOnboardingDraft['speakingConfidence'] } : { practiceFocus: option.key as PreAccountOnboardingDraft['practiceFocus'] })} />
                          </ChoiceNudge>
                        ))}
                      {page === 'time' &&
                        GOAL_TIERS.map((tier, index) => (
                          <ChoiceNudge key={tier.minutes} event={choiceNudge.page === page ? choiceNudge.event : 0} index={index} width={regular ? '23%' : goalGrid ? '48%' : undefined}><View ref={rowRef(`minutes:${tier.minutes}`)} collapsable={false}>
                            <GoalTile
                              tier={tier}
                              suggested={tier.minutes === suggested}
                              selected={draft.minutes === tier.minutes}
                              compact={compact}
                              layout={regular || goalGrid ? 'tile' : 'row'}
                              onPress={() => choose({ minutes: tier.minutes })}
                            />
                          </View></ChoiceNudge>
                        ))}
                    </View>
                    {page === 'time' ? (
                      <View ref={rowRef('minutes:none')} collapsable={false}>
                        <IconAction
                          icon="clock"
                          layout="inline"
                          label={FIRST_RUN_COPY.chooseEachTime}
                          selected={draft.minutes === 'none'}
                          onPress={() => choose({ minutes: 'none' })}
                        />
                      </View>
                    ) : null}
                  </>
                )}
                {page === 'plan' && <PersonalPlan draft={draft} compact={compact} onEdit={() => open('plan')} />}
                {page === 'choose-tutor' && <TutorSelection
                  chosen={draft.tutorChosen ? draft.tutorVoice : null}
                  preview={preview}
                  onChoose={(voice) => choose({ tutorVoice: voice, tutorChosen: true })} />}
                {page === 'practice' && (
                  <>
                    <Card style={{ gap: 12 }}>
                      <Text {...frenchText} style={type.frenchLg}>
                        {task.prompt}
                      </Text>
                      {(draft.startLevel !== 'getby' && draft.startLevel !== 'confident' || draft.speakingConfidence === 'hesitant') && (
                        <Text style={type.body}>{task.translation}</Text>
                      )}
                    </Card>
                    {(!guest?.token || guest.offline) && (
                      <Text style={type.small}>
                        Offline practice. This checks the phrases for this task and cannot assess
                        pronunciation.
                      </Text>
                    )}
                    {guest?.token != null && guest.offline !== true && !speakingOffered(guest) ? (
                      <Text style={type.small}>{FIRST_RUN_COPY.typedOnly}</Text>
                    ) : null}
                    {(draft.startLevel === 'zero' || draft.speakingConfidence === 'hesitant') && attempts.length === 0 && (
                      <Text {...frenchText} style={type.bodyStrong}>
                        {task.starter}
                      </Text>
                    )}
                    {mode === 'typed' ? (
                      <TextInput
                        value={reply}
                        onChangeText={setReply}
                        editable={!busy}
                        maxLength={600}
                        multiline
                        autoCapitalize="sentences"
                        accessibilityLabel="Your French reply"
                        placeholder="Your reply in French"
                        placeholderTextColor={paper.inkSoft}
                        style={{
                          ...type.body,
                          minHeight: 110,
                          padding: 18,
                          borderWidth: 2,
                          borderColor: colour.blue,
                          borderRadius: 20,
                          backgroundColor: paper.card,
                          color: paper.ink,
                        }}
                      />
                    ) : (
                      <GuestRecording
                        onRecordingChange={setCapturing}
                        busy={busy}
                        onTake={(uri) => submit(uri)}
                        onTyping={() => {
                          setMode('typed');
                          setIssue('You can type the same reply.');
                        }}
                      />
                    )}
                    {slow ? (
                      <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>
                        {FIRST_RUN_COPY.stillChecking}
                      </Text>
                    ) : null}
                    <IconActionRow>
                      {draft.practiceFocus === 'listening' && tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, task.model, draft.tutorVoice) != null ? (
                        <IconAction icon="speaker" label={playing ? 'Stop model' : 'Hear the model'} disabled={busy || capturing}
                          onPress={() => hear(tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, task.model, draft.tutorVoice))} />
                      ) : null}
                      {mode === 'typed' && speakingOffered(guest) ? (
                        <IconAction
                          icon="microphone"
                          label={FIRST_RUN_COPY.speakInstead}
                          disabled={busy}
                          onPress={() => {
                            setMode('spoken');
                            setIssue('');
                          }}
                        />
                      ) : null}
                      <IconAction
                        icon="help"
                        label="Help"
                        disabled={busy || capturing}
                        onPress={() => {
                          open('help');
                          soft();
                        }}
                      />
                    </IconActionRow>
                  </>
                )}
                {page === 'recap' && last && win && (
                  <>
                    <WinCard
                      view={win}
                      feedback={last.feedback.text}
                      onHear={modelAudio != null ? () => hear(modelAudio) : undefined}
                      playing={playing}
                    />
                    <IconActionRow>
                      <IconAction
                        icon="bookmark"
                        label={guest?.kept ? FIRST_RUN_COPY.phraseKept : win.keepLabel}
                        selected={guest?.kept === true}
                        animate="bookmark-fill"
                        onPress={() => void keepPhrase()}
                      />
                      {(!guest?.token || guest.offline || attempts.length < 2) && (
                        <IconAction
                          icon="refresh"
                          label={FIRST_RUN_COPY.retry}
                          accessibilityLabel="Retry this line"
                          onPress={() => {
                            metric('retry');
                            setReply('');
                            go('practice');
                          }}
                        />
                      )}
                      <IconAction
                        icon="info"
                        label={FIRST_RUN_COPY.details}
                        accessibilityLabel="Feedback details"
                        onPress={() => open('feedback')}
                      />
                    </IconActionRow>
                  </>
                )}
                {page === 'keep' && (
                  <>
                    <InvestmentList rows={guestInvestment({ practice: guest, days, today, draft })} />
                    {practiceForecast(minutesOf(activePlan)) && <RevealItem index={4}><Card style={{ gap: 6, backgroundColor: colour.sun }}>
                      <Text style={[type.heading, { color: paper.ink }]}>{practiceForecast(minutesOf(activePlan))!.line}</Text>
                      <Text style={[type.small, { color: paper.ink }]}>More time to listen, speak and build your confidence. Your pace will be your own.</Text>
                    </Card></RevealItem>}
                  </>
                )}
                {page === 'home' && (
                  <>
                    {streak !== null ? <StreakCard streak={streak} today={today} /> : null}
                    {homePhrase && (
                      <Card style={{ gap: 10 }}>
                        <Text {...frenchText} style={type.frenchLg}>
                          {keptPhrase(homePhrase)}
                        </Text>
                        <Text style={type.body}>Come back to this phrase whenever you like.</Text>
                      </Card>
                    )}
                    <IconActionRow>
                      <IconAction
                        icon="refresh"
                        label={FIRST_RUN_COPY.retry}
                        accessibilityLabel="Retry this line"
                        onPress={() => {
                          setReply('');
                          setGuest(
                            guest
                              ? { ...guest, offline: true, completed: false }
                              : offlineContinuation(draft, null),
                          );
                          go('practice');
                        }}
                      />
                      <IconAction
                        icon="cloud-add"
                        label="Save progress"
                        disabled={busy}
                        onPress={() => {
                          void saveAccount();
                        }}
                      />
                      {!signedIn ? (
                        <IconAction
                          icon="login"
                          label="Sign in"
                          onPress={() => {
                            stopSound();
                            onSignIn();
                          }}
                        />
                      ) : null}
                      {REMINDERS_AVAILABLE && draft.reminderEnabled !== true ? (
                        <IconAction icon="bell" label={FIRST_RUN_COPY.setReminder} onPress={() => open('reminder')} />
                      ) : null}
                    </IconActionRow>
                  </>
                )}
              </>
            )}
            {issue !== '' ? (
              <View style={{ gap: 8 }}>
                <Text accessibilityLiveRegion="polite" style={[type.body, { color: ink }]}>
                  {issue}
                </Text>
                {actions.offline && (
                  <IconActionRow>
                    <IconAction
                      icon="cloud-off"
                      label="Practise this offline"
                      onPress={() => {
                        if (page === 'practice') {
                          setGuest(
                            guest ? { ...guest, offline: true } : offlineContinuation(draft, null),
                          );
                          // Offline checks typed words only, so a spoken page turns to typing.
                          setMode('typed');
                          setIssue('');
                        } else void start(true);
                      }}
                    />
                    {/* Only where it sends something: a typed reply, or the start (F776). */}
                    {actions.retry ? (
                      <IconAction
                        icon="refresh"
                        label="Try again"
                        onPress={() => (page === 'practice' ? void submit() : void start())}
                      />
                    ) : null}
                  </IconActionRow>
                )}
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
              ? headingFor(planField)!
              : 'Change plan'
            : surface === 'voice'
              ? 'Choose tutor'
              : surface === 'start'
                ? 'Start your practice'
                : surface === 'help'
                  ? 'A little help'
                  : surface === 'feedback'
                    ? 'About this feedback'
                    : surface === 'reminder'
                      ? 'Set a reminder'
                      : surface === 'exit'
                        ? 'Leave this practice?'
                        : surface === 'policy'
                          ? POLICY_TITLE
                          : 'Your practice and privacy'
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
                {planField === 'reason' &&
                  goals.map((v) => (
                    <Choice
                      ground={paper.ground}
                      key={v.key}
                      title={v.title}
                      selected={edit.reason === v.key}
                      onPress={() => setEdit({ ...edit, reason: v.key })}
                      glyph={<ChoiceArt kind={v.key} />}
                    />
                  ))}
                {planField === 'start-level' &&
                  START_LEVELS.map((v) => (
                    <Choice
                      ground={paper.ground}
                      key={v.key}
                      title={v.title}
                      selected={edit.startLevel === v.key}
                      onPress={() => setEdit({ ...edit, startLevel: v.key })}
                      glyph={<ChoiceArt kind={v.key} />}
                    />
                  ))}
                {planField === 'time' && (
                  <>
                    {GOAL_TIERS.map((tier) => (
                      <Choice
                        ground={paper.ground}
                        key={tier.minutes}
                        title={tier.title}
                        detail={`${tier.minutes} ${FIRST_RUN_COPY.minutesUnit}`}
                        selected={edit.minutes === tier.minutes}
                        onPress={() => setEdit({ ...edit, minutes: tier.minutes })}
                        glyph={<IconTile ground="sun" dial={tier.quarters} size={40} />}
                      />
                    ))}
                    <Choice
                      ground={paper.ground}
                      title={FIRST_RUN_COPY.chooseEachTime}
                      selected={edit.minutes === 'none'}
                      onPress={() => setEdit({ ...edit, minutes: 'none' })}
                      glyph={<ChoiceArt kind="time" />}
                    />
                  </>
                )}
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
              Your tutor is AI. This starter uses authored task checks, not a proficiency or
              pronunciation score. Speech is sent to the Deepgram transcription service; typing
              stays within Luvani’s task service. The service stores only a temporary guest
              capability, attempt counts and usage, not your reply or recording. Your practice text
              is kept locally. Creating an account can transfer it with your agreement. Guest usage
              comes out of the account’s one-time allowance.
            </Text>
            <Text style={type.body}>
              You can use offline typing without sending a reply. Detailed processor and retention
              information is in the app’s privacy policy.
            </Text>
            <GhostButton label="Read privacy policy" onPress={() => setSurface('policy')} />
            <PillButton label="Choose how to practise" onPress={() => setSurface('start')} />
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
        {surface === 'help' && (
          <>
            <Text style={type.body}>{task.translation}</Text>
            <Text {...frenchText} style={type.frenchLg}>
              {draft.startLevel === 'getby' && attempts.length === 0 ? task.starter : task.model}
            </Text>
            <Text style={type.body}>{task.meaning}</Text>
            <IconButton icon="speaker"
              label={playing ? 'Stop' : 'Hear'}
              onPress={() =>
                hear(
                  tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, task.model, draft.tutorVoice),
                )
              }
            />
            <PillButton label="Try it" onPress={closeSheet} />
          </>
        )}
        {surface === 'feedback' && (
          <>
            <Text style={type.body}>
              {last?.offline
                ? 'Offline: this task checks for its authored target phrases.'
                : 'This task checks for its authored target phrases. It does not judge every possible way of saying this.'}
            </Text>
            <Text style={type.body}>
              {last?.feedback.evidence === 'spoken'
                ? 'Feedback uses the words recognised in your recording. It does not measure pronunciation.'
                : 'Feedback uses your typed reply. It cannot measure pronunciation.'}
            </Text>
            <PillButton label="Done" onPress={closeSheet} />
          </>
        )}
        {surface === 'reminder' && (
          // The guest home's Set a reminder: the same one ask as day one.
          <ReminderAsk
            time={draft.reminderTime ?? DEFAULT_REMINDER_TIME}
            tutor={tutorName}
            onDone={(answer) => {
              answerReminder(answer);
              closeSheet();
              if (answer.enabled) setIssue(FIRST_RUN_COPY.reminderSet);
            }}
          />
        )}
        {surface === 'exit' && (
          <>
            <Text style={type.body}>
              Your finished replies stay on this device. This unsent reply will be cleared.
            </Text>
            <PillButton label="Keep practising" onPress={closeSheet} />
            <GhostButton
              label="Leave practice"
              onPress={() => {
                setReply('');
                go(guest?.attempts.length ? 'recap' : 'plan', true);
              }}
            />
          </>
        )}
      </Sheet>
    </>
  );
}
