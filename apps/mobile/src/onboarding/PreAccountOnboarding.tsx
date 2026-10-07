import { offlineContinuation, continuingTask, finishGuestPractice, guestPracticeDays } from './guestModel.ts';
import { dayKeyOf, tutorSampleLine } from '@luvani/core';
import { STARTER_AI, STARTER_PROCESSING, STARTER_LOCAL } from './disclosure.ts';
/**
 * First value before registration. Answers are deliberate; local choices never wait for a service.
 *
 * Come alive (README Part 5.C rows 1 to 10): the promise, where, level and the
 * daily goal build a visible plan card; the plan is revealed with the real
 * minutes; the start sheet keeps the legal order; the practice offers speaking
 * only where the server says it is available; and the first reply is
 * celebrated only when it is accepted and really the learner's. Only once a
 * finished practice is on the phone does day one light, with the one reminder
 * ask; then the save card lists what the phone holds, and Not now leads to the
 * guest home. The new parts live in `firstRun/` and take values by props; the
 * literals tests pin stay here. Nothing on these pages sends, stores or records
 * activity by itself.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  type ScrollView as ScrollViewHandle,
  Text,
  TextInput,
  View,
  PixelRatio,
  Platform,
  findNodeHandle,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { enterVoicePlayback } from '../sound/audioSession.ts';
import { useVoiceHold } from '../sound/useVoiceHold.ts';
import { startVoiceLine } from '../sound/voiceLine.ts';
import { play as playSfx } from '../sound/sfx.ts';
import { starterTasks, tutorVoice } from '@luvani/core';
import { NextButton } from './NextButton.tsx';
import { FULL_SETUP, FIVE_SETUP, earnedChoices } from './flow.ts';
import { Card, GhostButton, IconAction, IconActionRow, IconButton, PillButton, Sheet } from '../components.tsx';
import { Screen, ScrollScreen, readingColumn, useCompactPhone } from '../layout.tsx';
import { colour, decorative, frenchText, onColour, paper, radius, space, type } from '../theme.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { OrbGlyph } from '../tutor/OrbGlyph.tsx';
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
import { REASONS, START_LEVELS, minutesOf, planFor } from './plan.ts';
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
import {
  OnboardingArtwork,
  PageArrival,
  SetupProgress,
  type ArtworkResponse,
} from './OnboardingMotion.tsx';
import { FIRST_RUN_COPY, SLOW_CHECK_MS } from './firstRun/copy.ts';
import { GOAL_TIERS, slotFor, suggestedMinutes } from './firstRun/planModel.ts';
import { PlanCard, type FlyFrom } from './firstRun/PlanCard.tsx';
import { PlanReveal, TILES_WRAP_AT } from './firstRun/PlanReveal.tsx';
import { GoalTile } from './firstRun/GoalTile.tsx';
import { ConsentFacts } from './firstRun/ConsentFacts.tsx';
import { WinArt, WinCard } from './firstRun/WinCard.tsx';
import { ExchangeSteps } from './firstRun/ExchangeSteps.tsx';
import { winEffects, winView } from './firstRun/winModel.ts';
import { speakingOffered, speechRefused, startMode } from './firstRun/speech.ts';
import { DayOne, StreakCard } from './firstRun/DayOne.tsx';
import { WeekStrip } from './firstRun/WeekStrip.tsx';
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
      'hear-it': 'Try a little French.',
      reason: 'Where will you use French first?',
      'start-level': 'What can you do in French today?',
      time: FIRST_RUN_COPY.goalTitle,
    }) as Partial<Record<PreAccountPage, string>>
  )[page];
/** What each question is for, said under its title. */
const whyFor = (page: PreAccountPage) =>
  page === 'reason' ? FIRST_RUN_COPY.reasonWhy : page === 'start-level' ? FIRST_RUN_COPY.levelWhy : FIRST_RUN_COPY.goalWhy;
export function PreAccountOnboarding({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
  refused = false,
  onRefuse,
  signedIn = false,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void | Promise<boolean>;
  onSignIn: () => void;
  refused?: boolean;
  onRefuse?: () => void;
  signedIn?: boolean;
}) {
  const compact = useCompactPhone();
  const questionOrder =
    process.env.EXPO_PUBLIC_ONBOARDING_VARIANT === 'five' ? FIVE_SETUP : FULL_SETUP;
  const five = questionOrder === FIVE_SETUP;
  const [draft, setDraft] = useState(() => initialDraft ?? freshPreAccountDraft());
  // The retired demo and save pages open the promise again; the retired
  // days-a-week page resumes on the daily goal that replaced it (D5).
  const [page, setPage] = useState<PreAccountPage>(() =>
    initialDraft?.page === 'first-line' || initialDraft?.page === 'save'
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
  const [direction, setDirection] = useState(1);
  const [guest, setGuest] = useState<GuestPractice | null>(null);
  const [loaded, setLoaded] = useState(false);
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
      if (state !== 'active') player.pause();
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
    if (!refused) onDraftChange({ ...next, page });
    return next;
  };
  const stopSound = () => {
    hearTicket.current += 1;
    player.pause();
  };
  const go = (next: PreAccountPage, backward = false) => {
    if (operation.current || (!backward && Date.now() - navigationAt.current < 180)) return false;
    navigationAt.current = Date.now();
    stopSound();
    generation.current++;
    setSurface(null);
    setIssue('');
    setMoment(null);
    // A flight belongs to the page it was chosen on; a card met again shows its tokens in place.
    setFlight(null);
    setDirection(backward ? -1 : 1);
    setPage(next);
    pulse(next === 'plan' ? 'ready' : 'next');
    if (!refused) onDraftChange({ ...draftRef.current, page: next });
    return true;
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
  const days = guestPracticeDays(guest);
  const streak = guestStreak(days, today);
  useEffect(() => {
    current.current = true;
    void loadGuestPractice().then((value) => {
      if (!current.current) return;
      setGuest(value);
      // A guest page needs its record, and day one and the save card a
      // finished practice on this phone (F754); otherwise an earlier page opens.
      const resumed = resumePage(page, value !== null, guestPracticeDays(value), dayKeyOf(Date.now()));
      if (resumed !== page) setPage(resumed);
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
    return () => {
      current.current = false;
      generation.current++;
      player.pause();
    };
  }, []);
  useEffect(() => {
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
  }, [page]);
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
    const index = questionOrder.indexOf(page);
    if (index > 0) go(questionOrder[index - 1]!, true);
  };
  useEffect(() => {
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
  const hear = (asset: number | undefined) => {
    if (playing) {
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
      if (ticket !== hearTicket.current || !current.current || AppState.currentState === 'background') return;
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
          ? guest
          : await startGuestPractice(draft, guest);
      if (!current.current || ticket !== generation.current) return;
      if (!(await persist(next))) {
        setIssue('Your practice could not be saved. Try again before starting.');
        return;
      }
      if (!current.current || ticket !== generation.current) return;
      metric('practice_started', 'none', next);
      // Speaking leads only where the server said guest speech is available (F756).
      setMode(startMode(next));
      setTaskIndex(0);
      setReply('');
      setSurface(null);
      setPage('practice');
      setIssue('');
      pulse('attentive');
      onDraftChange({ ...draft, page: 'practice' });
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
      setPage('recap');
      onDraftChange({ ...draft, page: 'recap' });
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
        setIssue(
          error instanceof Error && error.message === 'expired'
            ? 'Your guest practice has expired. Your phrase is still here. You can practise this offline.'
            : error instanceof Error && error.message === 'limit'
              ? 'This starter has used its two attempts. You can practise this offline or finish.'
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
    if (operation.current || refused || !draft.eligibilityConfirmed) return;
    operation.current = true;
    setBusy(true);
    stopSound();
    metric('save_progress');
    try {
      if ((await onCreateAccount({ ...draft, page })) === false)
        setIssue('Your plan could not be saved. Try again.');
    } catch {
      setIssue('Your plan could not be saved. Your practice is still here. Try again.');
    } finally {
      operation.current = false;
      if (current.current) setBusy(false);
    }
  };
  const finish = async () => {
    if (!guest) return;
    const at = Date.now();
    const day = dayKeyOf(at);
    // The day is new only if this finish adds it: a second practice the same
    // day is still a finish, and lights nothing again.
    const fresh = !guestPracticeDays(guest).includes(day);
    const finished = finishGuestPractice(guest, at);
    // The finish, and its day, reach the disk first (F751); day one and the
    // reminder ask come only after that (F754).
    if (!(await persist(finished))) return;
    metric('practice_finished');
    if (!go('remind')) return;
    if (fresh) {
      // The guest's day one lights once, here, in memory; the hand-off marks
      // it seen before the account records it (README Part 6).
      setMoment(celebrationKey.streak(day));
      playSfx('streak');
      celebrate();
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
  /** Make my plan: measure the chosen drink before the page moves on, so its token can fly to the plan card. */
  const makePlan = () => {
    const tile = rows.current[`drink:${draft.drink}`];
    let said = false;
    const leave = (box: Box | null) => {
      if (said) return;
      said = true;
      if (go('reason') && box !== null) setFlight({ slot: 'drink', from: box, id: Date.now() });
    };
    if (!tile) {
      leave(null);
      return;
    }
    setTimeout(() => leave(null), DUR.micro);
    try {
      tile.measureInWindow((x, y, width, height) => leave({ x, y, width, height }));
    } catch {
      leave(null);
    }
  };
  const completed = earnedChoices(draft, five);
  const question = ['reason', 'start-level', 'time'].includes(page);
  const answer =
    page === 'reason'
      ? draft.reason
      : page === 'start-level'
        ? draft.startLevel
        : draft.minutes;
  const suggested = suggestedMinutes(draft);
  const lastTask = last ? (tasks.find((t) => t.id === last.taskId) ?? task) : task;
  // The guest home names only a phrase the hand-off would save: the natural
  // line of the newest accepted or kept reply, never a refused one (F757).
  const homePhrase = page === 'home' ? (savedPhraseTasks(guest).at(-1) ?? null) : null;
  const win = page === 'recap' && last ? winView(last, lastTask.model, taskIndex < tasks.length - 1) : null;
  const modelAudio = tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, lastTask.model, draft.tutorVoice);
  const drinksWrap = PixelRatio.getFontScale() >= TILES_WRAP_AT;
  const blue = page === 'hear-it';
  const coral = page === 'recap' && win?.celebrate === true;
  const ground = blue
    ? colour.blue
    : coral
      ? colour.coral
      : page === 'plan'
        ? colour.sun
        : paper.ground;
  const ink = blue || coral ? paper.card : paper.ink;
  // The reminder is asked once on day one, only where a reminder can be given
  // and is not already set, and not again once answered on this visit.
  const askShown = REMINDERS_AVAILABLE && draft.reminderEnabled !== true && !reminderAnswered;
  const tutorName = tutorVoice(draft.tutorVoice).persona.name;
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
        ? `${firstTask.title}.`
        : page === 'practice'
          ? task.title
          : page === 'recap'
            ? last?.feedback.accepted
              ? 'That reply works.'
              : 'Try this small change.'
            : page === 'remind'
              ? (streak?.title ?? GAME_COPY.streak.started)
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
    <View style={[readingColumn, { gap: space(1) }]}>
      <PillButton
        label="Make my plan"
        tone="white"
        disabled={!draft.drink}
        onPress={makePlan}
        icon={<Glint when={draft.drink != null} radius={radius.control} />}
      />
      <IconAction
        icon="forward"
        layout="inline"
        ground="blue"
        label="Try a practice now"
        onPress={() => {
          const next = patch({
            quickStart: true,
            reason: 'food',
            startLevel: 'zero',
            minutes: 5,
          });
          setEdit(next);
          if (go('plan')) planReady();
        }}
      />
    </View>
  ) : question ? (
    <View style={readingColumn}>
      {/* Keyed by page, so each question's Continue glints once when its answer is chosen. */}
      <NextButton disabled={answer == null} onPress={nextQuestion} key={page} />
    </View>
  ) : page === 'plan' ? (
    <View style={readingColumn}>
      <PillButton label="Try this practice" onPress={() => open('start')} icon={<Glint when radius={radius.control} />} />
    </View>
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
        tone={coral ? 'white' : 'ink'}
        label={win?.primary ?? FIRST_RUN_COPY.continue}
        disabled={busy}
        onPress={() => {
          if (taskIndex < tasks.length - 1) nextExchange();
          else void finish();
        }}
      />
    </View>
  ) : page === 'remind' ? (
    // While the ask is on the page its own Remind me and Not now are the
    // actions; without one (the web, a reminder already set, an answer
    // given) Continue leads on.
    askShown ? null : (
      <View style={readingColumn}>
        <PillButton label={FIRST_RUN_COPY.continue} onPress={() => go('keep')} />
      </View>
    )
  ) : page === 'keep' ? (
    <View style={[readingColumn, { gap: space(1) }]}>
      <PillButton label={FIRST_RUN_COPY.saveMyProgress} disabled={busy} onPress={() => void saveAccount()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space(4) }}>
        {!signedIn ? (
          <IconAction
            icon="login"
            layout="inline"
            label="Sign in"
            onPress={() => {
              stopSound();
              onSignIn();
            }}
          />
        ) : null}
        <GhostButton label={FIRST_RUN_COPY.notNow} disabled={busy} onPress={() => go('home')} />
      </View>
    </View>
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
      <ScrollScreen
        ground={ground}
        avoidKeyboard
        scrollRef={scroll}
        onScroll={(e) => {
          offsets.current[page] = e.nativeEvent.contentOffset.y;
        }}
        header={
          page === 'hear-it' || page === 'recap' || refused ? undefined : (
            <View style={[readingColumn, { gap: compact ? 8 : 12, marginBottom: compact ? 8 : 12 }]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 44,
                }}
              >
                <IconButton icon="back" tone="disc" label="Back" disabled={busy || capturing} onPress={back} />
                {question && !draft.quickStart ? (
                  <SetupProgress completed={completed} total={five ? 3 : 4} />
                ) : null}
                {page === 'practice' ? <ExchangeSteps index={taskIndex} total={tasks.length} /> : null}
              </View>
              {question ? <PlanCard draft={draft} five={five} flyFrom={flight} /> : null}
            </View>
          )
        }
        footer={footer}
      >
        <View style={[readingColumn, { paddingBottom: 20 }]}>
          <PageArrival page={page} direction={direction} gap={question && compact ? 16 : 20}>
            {!refused && (blue || page === 'recap') && (
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
            {!refused && page === 'remind' && streak !== null ? <DayOne streak={streak} moment={moment} /> : null}
            <Text
              ref={heading}
              {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})}
              accessibilityRole="header"
              style={[blue ? type.display : type.title, { color: ink }]}
            >
              {title}
            </Text>
            {refused ? (
              <View style={{ gap: 16 }}>
                <Illustration name="state-postcard-frame" fit="small" />
                <Text style={type.body}>Please come back when it is the right time.</Text>
              </View>
            ) : (
              <>
                {blue && (
                  <>
                    <Text style={[type.bodyStrong, { color: ink }]}>{FIRST_RUN_COPY.promiseLead}</Text>
                    <View
                      accessibilityRole="radiogroup"
                      style={{ flexDirection: drinksWrap ? 'column' : 'row', gap: space(3) }}
                    >
                      <View ref={rowRef('drink:coffee')} collapsable={false} style={{ flex: drinksWrap ? undefined : 1 }}>
                        <Choice
                          ground="blue"
                          layout="tile"
                          title="Coffee"
                          selected={draft.drink === 'coffee'}
                          onPress={() => choose({ drink: 'coffee' })}
                          glyph={<ChoiceArt kind="coffee" />}
                        />
                      </View>
                      <View ref={rowRef('drink:tea')} collapsable={false} style={{ flex: drinksWrap ? undefined : 1 }}>
                        <Choice
                          ground="blue"
                          layout="tile"
                          title="Tea"
                          selected={draft.drink === 'tea'}
                          onPress={() => choose({ drink: 'tea' })}
                          glyph={<ChoiceArt kind="tea" />}
                        />
                      </View>
                    </View>
                    {draft.drink ? (
                      <Card style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View style={{ flex: 1, gap: 10 }}>
                            <Text {...frenchText} style={type.frenchLg}>
                              Bonjour, je vais prendre un {draft.drink === 'tea' ? 'thé' : 'café'}.
                            </Text>
                            <Text style={type.body}>Hello, I will have a {draft.drink}.</Text>
                          </View>
                          {draft.drink === 'coffee' && (
                            <IconButton
                              icon="speaker"
                              tone="ink"
                              label={playing ? 'Stop' : 'Hear'}
                              animate="speaker-waves"
                              active={playing}
                              onPress={() => hear(clipFor(FIRST_LINE.reply))}
                            />
                          )}
                        </View>
                      </Card>
                    ) : (
                      <View
                        style={{
                          minHeight: 96,
                          borderRadius: radius.card,
                          borderWidth: 1.5,
                          borderStyle: 'dashed',
                          borderColor: onColour.blue,
                          padding: space(5),
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={[type.body, { color: onColour.blue }]}>{FIRST_RUN_COPY.phrasePlaceholder}</Text>
                      </View>
                    )}
                  </>
                )}
                {question && (
                  <>
                    <Text style={[type.body, { color: paper.inkSoft }]}>{whyFor(page)}</Text>
                    <View accessibilityRole="radiogroup" style={{ gap: compact ? 8 : 10 }}>
                      {page === 'reason' &&
                        goals.map((v) => (
                          <View key={v.key} ref={rowRef(`reason:${v.key}`)} collapsable={false}>
                            <Choice
                              compact={compact}
                              title={v.title}
                              glyph={<ChoiceArt kind={v.key} />}
                              selected={draft.reason === v.key}
                              onPress={() => choose({ reason: v.key })}
                            />
                          </View>
                        ))}
                      {page === 'start-level' &&
                        START_LEVELS.map((v) => (
                          <View key={v.key} ref={rowRef(`startLevel:${v.key}`)} collapsable={false}>
                            <Choice
                              compact={compact}
                              title={v.title}
                              detail={v.gloss === '' ? undefined : v.gloss}
                              glyph={<ChoiceArt kind={v.key} />}
                              selected={draft.startLevel === v.key}
                              onPress={() => choose({ startLevel: v.key })}
                            />
                          </View>
                        ))}
                      {page === 'time' &&
                        GOAL_TIERS.map((tier) => (
                          <View key={tier.minutes} ref={rowRef(`minutes:${tier.minutes}`)} collapsable={false}>
                            <GoalTile
                              tier={tier}
                              suggested={tier.minutes === suggested}
                              selected={draft.minutes === tier.minutes}
                              compact={compact}
                              onPress={() => choose({ minutes: tier.minutes })}
                            />
                          </View>
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
                {page === 'plan' && (
                  <PlanReveal
                    minutes={minutesOf(draft)}
                    exchanges={tasks.length}
                    sceneTitle={planFor(draft).scenes[0]?.titleEn ?? null}
                    tutorName={tutorVoice(draft.tutorVoice).persona.name}
                    card={
                      <PlanCard
                        draft={draft}
                        five={five}
                        expanded
                        trailing={<IconAction icon="edit" layout="inline" ground="sun" label="Change plan" onPress={() => open('plan')} />}
                      />
                    }
                    tutorAction={<IconAction icon="orb" layout="inline" label="Choose tutor" onPress={() => open('voice')} />}
                  >
                    <Card style={{ gap: 10 }}>
                      <Text style={[type.small, { color: paper.inkSoft }]}>{FIRST_RUN_COPY.firstExchange}</Text>
                      <Text {...frenchText} style={type.frenchLg}>
                        {firstTask.prompt}
                      </Text>
                      <Text style={type.body}>{firstTask.translation} Start with one reply.</Text>
                    </Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View {...decorative}>
                        <OrbGlyph color={paper.ink} size={28} />
                      </View>
                      <Text style={[type.body, { flex: 1 }]}>{STARTER_AI}</Text>
                    </View>
                    {draft.quickStart ? (
                      <Text style={type.small}>A suggested beginner café practice.</Text>
                    ) : null}
                  </PlanReveal>
                )}
                {page === 'practice' && (
                  <>
                    <Card style={{ gap: 12 }}>
                      <Text {...frenchText} style={type.frenchLg}>
                        {task.prompt}
                      </Text>
                      {draft.startLevel !== 'getby' && (
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
                    {draft.startLevel === 'zero' && attempts.length === 0 && (
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
                {page === 'remind' && (
                  <>
                    {streak !== null ? <WeekStrip week={streak.week} today={today} moment={moment} /> : null}
                    <Text style={[type.body, { color: paper.ink }]}>{FIRST_RUN_COPY.remindLine}</Text>
                    {askShown ? (
                      <ReminderAsk
                        time={draft.reminderTime ?? DEFAULT_REMINDER_TIME}
                        tutor={tutorName}
                        onDone={(answer) => {
                          answerReminder(answer);
                          go('keep');
                        }}
                      />
                    ) : null}
                  </>
                )}
                {page === 'keep' && (
                  <>
                    <InvestmentList rows={guestInvestment({ practice: guest, days, today, draft })} />
                    <Text style={[type.body, { color: paper.ink }]}>
                      {signedIn ? FIRST_RUN_COPY.keepLineSignedIn : FIRST_RUN_COPY.keepLine}
                    </Text>
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
                {(issue.includes('connect') ||
                  issue.includes('expired') ||
                  issue.includes('attempts') ||
                  issue.includes('offline')) && (
                  <IconActionRow>
                    <IconAction
                      icon="cloud-off"
                      label="Practise this offline"
                      onPress={() => {
                        if (page === 'practice') {
                          setGuest(
                            guest ? { ...guest, offline: true } : offlineContinuation(draft, null),
                          );
                          setIssue('');
                        } else void start(true);
                      }}
                    />
                    <IconAction
                      icon="refresh"
                      label="Try again"
                      onPress={() => (page === 'practice' ? void submit() : void start())}
                    />
                  </IconActionRow>
                )}
              </View>
            ) : null}
            {storageNote !== '' ? (
              <Text accessibilityLiveRegion="polite" style={[type.small, { color: ink }]}>
                {storageNote}
              </Text>
            ) : null}
          </PageArrival>
        </View>
      </ScrollScreen>
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
                <GhostButton label="Back to plan choices" onPress={() => setPlanField(null)} />
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
                <GhostButton label="Try again" disabled={busy} onPress={() => void start()} />
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
            <PillButton label="Back to practice choices" onPress={() => setSurface('start')} />
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
            <GhostButton
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
