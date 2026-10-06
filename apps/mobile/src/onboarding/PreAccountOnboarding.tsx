import { offlineContinuation, continuingTask } from './guestModel.ts';
import { tutorSampleLine } from '@luvani/core';
import { STARTER_AI, STARTER_PROCESSING, STARTER_LOCAL } from './disclosure.ts';
/** First value before registration. Answers are deliberate; local choices never wait for a service. */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
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
import { starterTasks, tutorVoice } from '@luvani/core';
import { NextButton } from './NextButton.tsx';
import { FULL_SETUP, FIVE_SETUP, earnedChoices } from './flow.ts';
import { Card, GhostButton, Highlight, PillButton, Press, Sheet } from '../components.tsx';
import { Screen, ScrollScreen, useCompactPhone } from '../layout.tsx';
import { colour, frenchText, paper, type } from '../theme.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { tutorAudioForFrench } from '../daily/tutorAudio.ts';
import { arrived, soft } from '../motion/haptics.ts';
import { consumeRecording } from '../speech/discardRecording.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_TIMES,
  type ReminderTimeId,
} from '../reminders/reminder.ts';
import {
  REMINDERS_AVAILABLE,
  askReminderPermission,
  scheduleReminder,
} from '../reminders/schedule.ts';
import { POLICY_SECTIONS, POLICY_TITLE } from '../legal/policy.ts';
import { FIRST_LINE } from './firstRun.ts';
import { clipFor } from './exchangeAudio.ts';
import { REASONS, START_LEVELS } from './plan.ts';
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
const times = [5, 10, 15] as const;
const frequencies = [3, 5, 7] as const;
const goals = [...REASONS].sort(
  (a, b) =>
    ['food', 'family', 'trip', 'moving', 'work', 'because'].indexOf(a.key) -
    ['food', 'family', 'trip', 'moving', 'work', 'because'].indexOf(b.key),
);
const frequencyText = (value: PreAccountOnboardingDraft['frequency']) =>
  value === 'none' ? 'No schedule' : value === 7 ? 'Every day' : `${value ?? 3} days a week`;
const routine = (draft: PreAccountOnboardingDraft) =>
  `${draft.minutes === 'none' ? 'Choose each time' : `${draft.minutes ?? 5} minutes`}, ${frequencyText(draft.frequency).toLowerCase()}`;
const headingFor = (page: PreAccountPage) =>
  (
    ({
      'hear-it': 'Try a little French.',
      reason: 'Where will you use French first?',
      'start-level': 'What can you do in French today?',
      time: 'How long would you like to practise?',
      frequency: 'How many days a week?',
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
  const [draft, setDraft] = useState(() => initialDraft ?? freshPreAccountDraft());
  const [page, setPage] = useState<PreAccountPage>(() =>
    initialDraft?.page === 'first-line' || initialDraft?.page === 'save'
      ? 'hear-it'
      : (initialDraft?.page ?? 'hear-it'),
  );
  const [surface, setSurface] = useState<Surface>(null);
  const [edit, setEdit] = useState(draft);
  const [planField, setPlanField] = useState<
    'reason' | 'start-level' | 'time' | 'frequency' | null
  >(null);
  const [pose, setPose] = useState<ArtworkResponse>('welcome');
  const [event, setEvent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [guest, setGuest] = useState<GuestPractice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'typed' | 'spoken'>('typed');
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [issue, setIssue] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [remember, setRemember] = useState(draft.rememberLearning === true);
  const [reminderTime, setReminderTime] = useState<ReminderTimeId>(
    draft.reminderTime ?? DEFAULT_REMINDER_TIME,
  );
  const [reminderDays, setReminderDays] = useState<number[]>(
    draft.reminderDays?.length
      ? draft.reminderDays
      : draft.frequency === 5
        ? [2, 3, 4, 5, 6]
        : draft.frequency === 7
          ? [1, 2, 3, 4, 5, 6, 7]
          : [2, 4, 6],
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const current = useRef(true);
  const operation = useRef(false);
  const generation = useRef(0);
  const navigationAt = useRef(0);
  const heading = useRef<Text>(null);
  const scroll = useRef<ScrollViewHandle>(null);
  const offsets = useRef<Record<string, number>>({});
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
    setDirection(backward ? -1 : 1);
    setPage(next);
    pulse(next === 'plan' ? 'ready' : 'next');
    if (!refused) onDraftChange({ ...draftRef.current, page: next });
    return true;
  };
  const activePlan = ['practice', 'recap', 'home'].includes(page) && guest ? guest.plan : draft;
  const tasks = starterTasks(
    activePlan.reason,
    activePlan.drink ?? 'coffee',
    activePlan.minutes ?? 5,
  );
  const task = tasks[Math.min(taskIndex, tasks.length - 1)]!;
  const attempts = guest?.attempts.filter((a) => a.taskId === task.id) ?? [];
  const serviceAttempts = attempts.filter((attempt) => !attempt.offline).length;
  const last = guest?.attempts.at(-1);
  useEffect(() => {
    current.current = true;
    void loadGuestPractice().then((value) => {
      if (!current.current) return;
      setGuest(value);
      if (value && ['practice', 'recap', 'home'].includes(page)) {
        setReply(value.attempts.at(-1)?.reply ?? '');
        setTaskIndex(
          Math.max(
            0,
            starterTasks(
              value.plan.reason,
              value.plan.drink ?? 'coffee',
              value.plan.minutes ?? 5,
            ).findIndex((t) => t.id === value.attempts.at(-1)?.taskId),
          ),
        );
      } else if (!value && ['practice', 'recap', 'home'].includes(page)) setPage('plan');
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
    const index = questionOrder.indexOf(page);
    if (index > 0) go(questionOrder[index - 1]!, true);
    else if (page === 'home') go('recap', true);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [page, surface, busy, capturing]);
  const choose = (change: Partial<PreAccountOnboardingDraft>) => {
    patch(change);
    pulse('choice');
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
    setGuest({ ...next, kept: prior?.kept ?? false, completed: prior?.completed ?? false });
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
  const start = async (speaking: boolean, offline = false) => {
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
      const next = offline
        ? offlineContinuation(draft, guest)
        : same && guest.token && guest.expiresAt > Date.now()
          ? guest
          : await startGuestPractice(draft);
      if (!current.current || ticket !== generation.current) return;
      if (!(await persist(next))) {
        setIssue('Your practice could not be saved. Try again before starting.');
        return;
      }
      if (!current.current || ticket !== generation.current) return;
      metric('practice_started', 'none', next);
      setMode(speaking && !offline && next.speechAvailable === true ? 'spoken' : 'typed');
      setTaskIndex(0);
      setReply('');
      setSurface(null);
      setPage('practice');
      setIssue(speaking && !offline && next.speechAvailable !== true
        ? 'Speaking is unavailable right now. Type your reply below.' : '');
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
      if (result.feedback.accepted && result.feedback.evidence !== 'model') arrived();
    } catch (error) {
      if (current.current && ticket === generation.current) {
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
    if (!(await persist({ ...guest, completed: true }))) return;
    metric('practice_finished');
    go('home');
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
      setStorageNote('Phrase kept on this device.');
    }
  };
  const nextQuestion = () => {
    const index = questionOrder.indexOf(page);
    if (index >= 0 && index < questionOrder.length - 1) return go(questionOrder[index + 1]!);
    return false;
  };
  const completed = earnedChoices(draft, questionOrder === FIVE_SETUP);
  const question = ['reason', 'start-level', 'time', 'frequency'].includes(page);
  const answer =
    page === 'reason'
      ? draft.reason
      : page === 'start-level'
        ? draft.startLevel
        : page === 'time'
          ? draft.minutes
          : draft.frequency;
  const blue = page === 'hear-it';
  const coral = page === 'recap';
  const ground = blue
    ? colour.blue
    : coral
      ? colour.coral
      : page === 'plan'
        ? colour.sun
        : paper.ground;
  const ink = blue || coral ? paper.card : paper.ink;
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
        ? `${task.title}.`
        : page === 'practice'
          ? task.title
          : page === 'recap'
            ? last?.feedback.accepted
              ? 'That reply works.'
              : 'Try this small change.'
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
    <View style={{ gap: 4 }}>
      <PillButton
        label="Make my plan"
        tone="white"
        disabled={!draft.drink}
        onPress={() => go('reason')}
      />
      <GhostButton
        color={paper.card}
        label="Try a practice now"
        onPress={() => {
          const next = patch({
            quickStart: true,
            reason: 'food',
            startLevel: 'zero',
            minutes: 5,
            frequency: 3,
          });
          setEdit(next);
          go('plan');
        }}
      />
    </View>
  ) : question ? (
    <View>
      <NextButton disabled={answer == null} onPress={nextQuestion} />
      <GhostButton
        label={
          page === 'reason'
            ? 'I’m exploring'
            : page === 'start-level'
              ? 'I’m not sure'
              : page === 'time'
                ? 'Choose each time'
                : 'No schedule'
        }
        onPress={() => {
          const change =
            page === 'reason'
              ? { reason: 'because' as const }
              : page === 'start-level'
                ? { startLevel: 'zero' as const }
                : page === 'time'
                  ? { minutes: 'none' as const }
                  : { frequency: 'none' as const };
          if (operation.current || Date.now() - navigationAt.current < 180) return false;
          patch(change);
          return nextQuestion();
        }}
      />
    </View>
  ) : page === 'plan' ? (
    <PillButton label="Try this practice" onPress={() => open('start')} />
  ) : page === 'practice' ? (
    mode === 'typed' ? (
      <PillButton
        label={busy ? 'Checking your reply…' : 'Send reply'}
        disabled={
          busy || !reply.trim() || (guest?.token != null && !guest.offline && serviceAttempts >= 2)
        }
        onPress={() => void submit()}
      />
    ) : null
  ) : page === 'recap' ? (
    <PillButton tone="white" label="Finish" disabled={busy} onPress={() => void finish()} />
  ) : (
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
  );
  const sheetFooter =
    surface === 'plan' || surface === 'voice' ? (
      <View style={{ gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: paper.line }}>
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
                frequency: edit.frequency,
                quickStart: false,
              });
              setSurface(null);
              pulse('ready');
            }
          }}
        />
        <GhostButton label="Cancel" onPress={closeSheet} />
      </View>
    ) : surface === 'start' ? (
      <View style={{ gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: paper.line }}>
        <PillButton
          label={busy ? 'Connecting…' : 'Start speaking'}
          disabled={busy || !draft.eligibilityConfirmed}
          onPress={() => void start(true)}
        />
        <GhostButton
          label="Type instead"
          disabled={busy || !draft.eligibilityConfirmed}
          onPress={() => void start(false)}
        />
        <GhostButton
          label="Practise offline"
          disabled={busy || !draft.eligibilityConfirmed}
          onPress={() => void start(false, true)}
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
          page === 'hear-it' || refused ? undefined : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 44,
                marginBottom: compact ? 8 : 12,
              }}
            >
              <GhostButton label="Back" color={ink} disabled={busy || capturing} onPress={back} />
              {question && !draft.quickStart ? (
                <SetupProgress completed={completed} total={questionOrder === FIVE_SETUP ? 4 : 5} />
              ) : null}
            </View>
          )
        }
        footer={footer}
      >
        <View style={{ paddingBottom: 20 }}>
          <PageArrival page={page} direction={direction} gap={question && compact ? 16 : 20}>
            {!refused && (blue || page === 'plan' || page === 'recap') && (
              <OnboardingArtwork
                name={
                  page === 'recap'
                    ? last?.feedback.accepted
                      ? 'celebrate-first-line'
                      : 'state-notebook'
                    : draft.reason === 'trip'
                      ? 'place-directions'
                      : draft.reason === 'family' || draft.reason === 'work'
                        ? 'place-apero'
                        : draft.reason === 'moving'
                          ? 'place-market'
                          : 'place-cafe-counter'
                }
                response={pose}
                event={event}
              />
            )}
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
                    <Text style={[type.bodyStrong, { color: ink }]}>Choose your drink.</Text>
                    <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
                      <Choice
                        ground="blue"
                        title="Coffee"
                        selected={draft.drink === 'coffee'}
                        onPress={() => choose({ drink: 'coffee' })}
                        glyph={<ChoiceArt kind="coffee" />}
                      />
                      <Choice
                        ground="blue"
                        title="Tea"
                        selected={draft.drink === 'tea'}
                        onPress={() => choose({ drink: 'tea' })}
                        glyph={<ChoiceArt kind="tea" />}
                      />
                    </View>
                    {draft.drink && (
                      <Card style={{ gap: 10 }}>
                        <Text {...frenchText} style={type.frenchLg}>
                          Bonjour, je vais prendre un {draft.drink === 'tea' ? 'thé' : 'café'}.
                        </Text>
                        <Text style={type.body}>Hello, I will have a {draft.drink}.</Text>
                        {draft.drink === 'coffee' && (
                          <GhostButton
                            label={playing ? 'Stop' : 'Hear'}
                            onPress={() => hear(clipFor(FIRST_LINE.reply))}
                          />
                        )}
                      </Card>
                    )}
                  </>
                )}
                {question && (
                  <View accessibilityRole="radiogroup" style={{ gap: compact ? 8 : 10 }}>
                    {page === 'reason' &&
                      goals
                        .filter((v) => v.key !== 'because')
                        .map((v) => (
                          <Choice
                            compact={compact}
                            key={v.key}
                            title={v.title}
                            glyph={<ChoiceArt kind={v.key === 'because' ? 'food' : v.key} />}
                            selected={draft.reason === v.key}
                            onPress={() => choose({ reason: v.key })}
                          />
                        ))}
                    {page === 'start-level' &&
                      START_LEVELS.map((v) => (
                        <Choice
                          compact={compact}
                          key={v.key}
                          title={v.title}
                          glyph={<ChoiceArt kind="ability" />}
                          selected={draft.startLevel === v.key}
                          onPress={() => choose({ startLevel: v.key })}
                        />
                      ))}
                    {page === 'time' &&
                      times.map((v) => (
                        <Choice
                          compact={compact}
                          key={v}
                          title={`${v} minutes`}
                          glyph={<ChoiceArt kind="time" />}
                          selected={draft.minutes === v}
                          onPress={() => choose({ minutes: v })}
                        />
                      ))}
                    {page === 'frequency' &&
                      frequencies.map((v) => (
                        <Choice
                          compact={compact}
                          key={v}
                          title={v === 7 ? 'Every day' : `${v} days`}
                          glyph={<ChoiceArt kind="days" />}
                          selected={draft.frequency === v}
                          onPress={() => choose({ frequency: v })}
                        />
                      ))}
                  </View>
                )}
                {page === 'plan' && (
                  <>
                    <Text style={type.body}>{task.translation} Start with one reply.</Text>
                    <Text style={type.body}>{STARTER_AI}</Text>
                    <Text style={type.bodyStrong}>{routine(draft)}</Text>
                    {draft.quickStart && (
                      <Text style={type.small}>A suggested beginner café practice.</Text>
                    )}
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 16,
                      }}
                    >
                      <GhostButton label="Change plan" onPress={() => open('plan')} />
                      <GhostButton label="Choose tutor" onPress={() => open('voice')} />
                    </View>
                  </>
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
                    <Press
                      haptic="none"
                      disabled={busy || capturing}
                      accessibilityLabel="Help"
                      onPress={() => {
                        open('help');
                        soft();
                      }}
                      style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text
                        style={[type.label, { color: paper.ink, textDecorationLine: 'underline' }]}
                      >
                        Help
                      </Text>
                    </Press>
                  </>
                )}
                {page === 'recap' && last && (
                  <>
                    <Card style={{ gap: 16 }}>
                      <Text {...frenchText} style={type.frenchLg}>
                        {last.reply}
                      </Text>
                      <Text style={type.body}>{last.feedback.text}</Text>
                      {!last.feedback.accepted && <Highlight text={last.feedback.model} />}
                    </Card>
                    {(!guest?.token || guest.offline || attempts.length < 2) && (
                      <GhostButton
                        label="Retry this line"
                        color={ink}
                        onPress={() => {
                          metric('retry');
                          setReply('');
                          go('practice');
                        }}
                      />
                    )}
                    {taskIndex < tasks.length - 1 && (
                      <GhostButton
                        label="Try the next exchange"
                        color={ink}
                        onPress={() => {
                          setTaskIndex((i) => i + 1);
                          setReply('');
                          go('practice');
                        }}
                      />
                    )}
                    <GhostButton
                      label={
                        guest?.kept
                          ? 'Phrase kept on this device'
                          : last.feedback.accepted
                            ? 'Keep this phrase'
                            : 'Keep the example'
                      }
                      color={ink}
                      onPress={() => void keepPhrase()}
                    />
                    <GhostButton
                      label="Feedback details"
                      color={ink}
                      onPress={() => open('feedback')}
                    />
                    <GhostButton
                      label="Save progress"
                      color={ink}
                      disabled={busy}
                      onPress={() => {
                        void saveAccount();
                      }}
                    />
                  </>
                )}
                {page === 'home' && (
                  <>
                    {last && (
                      <Card style={{ gap: 10 }}>
                        <Text {...frenchText} style={type.frenchLg}>
                          {last.feedback.accepted ? last.reply : last.feedback.model}
                        </Text>
                        <Text style={type.body}>Come back to this phrase whenever you like.</Text>
                      </Card>
                    )}
                    <GhostButton
                      label="Retry this line"
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
                    <GhostButton
                      label="Save progress"
                      disabled={busy}
                      onPress={() => {
                        void saveAccount();
                      }}
                    />
                    {!signedIn && (
                      <GhostButton
                        label="Sign in"
                        onPress={() => {
                          stopSound();
                          onSignIn();
                        }}
                      />
                    )}
                    {REMINDERS_AVAILABLE && (
                      <GhostButton label="Set a reminder" onPress={() => open('reminder')} />
                    )}
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
                  <>
                    <GhostButton
                      color={ink}
                      label="Practise this offline"
                      onPress={() => {
                        if (page === 'practice') {
                          setGuest(
                            guest ? { ...guest, offline: true } : offlineContinuation(draft, null),
                          );
                          setIssue('');
                        } else void start(false, true);
                      }}
                    />
                    <GhostButton
                      color={ink}
                      label="Try again"
                      onPress={() =>
                        page === 'practice' ? void submit() : void start(mode === 'spoken')
                      }
                    />
                  </>
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
                  label="Practice length"
                  value={
                    edit.minutes === 'none' ? 'Choose each time' : `${edit.minutes ?? 5} minutes`
                  }
                  onPress={() => setPlanField('time')}
                />
                <PlanEditRow
                  label="Routine"
                  value={frequencyText(edit.frequency)}
                  onPress={() => setPlanField('frequency')}
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
                      glyph={v.key === 'because' ? undefined : <ChoiceArt kind={v.key} />}
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
                      glyph={<ChoiceArt kind="ability" />}
                    />
                  ))}
                {planField === 'time' &&
                  [...times, 'none' as const].map((v) => (
                    <Choice
                      ground={paper.ground}
                      key={v}
                      title={v === 'none' ? 'Choose each time' : `${v} minutes`}
                      selected={edit.minutes === v}
                      onPress={() => setEdit({ ...edit, minutes: v })}
                      glyph={<ChoiceArt kind="time" />}
                    />
                  ))}
                {planField === 'frequency' &&
                  [...frequencies, 'none' as const].map((v) => (
                    <Choice
                      ground={paper.ground}
                      key={v}
                      title={frequencyText(v)}
                      selected={edit.frequency === v}
                      onPress={() => setEdit({ ...edit, frequency: v })}
                      glyph={<ChoiceArt kind="days" />}
                    />
                  ))}
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
                    <GhostButton
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
            <Text style={type.body}>
              {STARTER_AI} {STARTER_PROCESSING}
            </Text>
            <Text style={type.body}>{STARTER_LOCAL}</Text>
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
            <GhostButton label="Privacy details" onPress={() => setSurface('privacy')} />
            {issue !== '' ? (
              <>
                <Text accessibilityLiveRegion="polite" style={type.body}>
                  {issue}
                </Text>
                <GhostButton label="Try again" disabled={busy} onPress={() => void start(false)} />
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
          <>
            <Text style={type.body}>Choose the days and time that suit you.</Text>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <Choice
                key={day}
                title={day}
                selected={reminderDays.includes(index + 1)}
                onPress={() =>
                  setReminderDays((days) =>
                    days.includes(index + 1)
                      ? days.filter((d) => d !== index + 1)
                      : [...days, index + 1],
                  )
                }
              />
            ))}
            {REMINDER_TIMES.map((time) => (
              <Choice
                key={time.value}
                title={time.gloss}
                selected={reminderTime === time.value}
                onPress={() => setReminderTime(time.value)}
              />
            ))}
            <PillButton
              label="Enable reminder"
              disabled={!reminderDays.length || busy}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const permission = await askReminderPermission();
                    if (permission !== 'granted') {
                      setIssue('Reminders are off. You can continue without them.');
                      return;
                    }
                    const result = await scheduleReminder(reminderTime, reminderDays);
                    if (result !== 'done') {
                      setIssue('The reminder could not be scheduled.');
                      return;
                    }
                    patch({
                      reminderTime,
                      reminderDays,
                      reminderEnabled: true,
                    });
                    setIssue('Reminder set.');
                    setSurface(null);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
            <GhostButton label="Not now" onPress={closeSheet} />
          </>
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
