/**
 * The drill sitting — the review deck made active.
 *
 * One exercise per screen, calm. The screen renders engine state and calls the
 * pure functions in @luvani/core/drill; every pedagogical decision (what to ask,
 * how to grade, what a miss costs) already happened there. If logic that looks
 * like grading or selection appears in this file, it is in the wrong file.
 *
 * Feedback follows the signal vocabulary: `signal.good` for a phrase that came
 * out, `signal.correspondance` for the change-here correction, plain ink for a
 * spelling pointed at. Never a number and never a scold mid-session; the end
 * card is the one place counts are allowed, where they can be given context.
 *
 * Leaving early is honest and cheap: every exercise answered so far grades its
 * review card on the way out, and the unanswered rest simply stay due — nothing
 * is lost, counted, or held against the learner.
 *
 * Spoken drills may also consult the pronunciation scorer, but the grade is the
 * learner's word, banked before the scorer is asked. Scoring can only ever add
 * one calm line; it has no way to slow, block, or punish.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import {
  answerCurrent,
  buildDrillSession,
  mixQueue,
  suppressMic,
  summariseDrill,
  type AppropriateReplyExercise,
  type BestSentenceExercise,
  type DrillExercise,
  type DrillFeedback,
  type DrillSessionState,
  type DrillVerdict,
  type FillBlankExercise,
  type ListenTypeExercise,
  type RepeatThisExercise,
  type TapTranslateExercise,
  type TranslationExercise,
  drillXp,
} from '@luvani/core';
import { HAIRLINE, HIT, font, paper, radius, signal, space, type } from './theme.ts';
import { recordActivity } from './progress/activity.ts';
import { Card, Label, OptionCard, PillButton, SpeakCircle, ArrowRight, EarGlyph, fitDisplay } from './components.tsx';
import { Screen, ScrollScreen, ScreenHeader } from './layout.tsx';
import { gradeCards, loadDeck } from './review/store.ts';
import { NothingDue, RewardMark } from './illustrations.tsx';
import { loadDrillBank, getMicSuppressedUntil, setMicSuppressed } from './drill/store.ts';
import { MomentCard, type DrillMoment } from './drill/MomentCard.tsx';
import { loadTopics } from './topics/store.ts';
import { DRILL_UNREAD, sittingTitle, topicGroups } from './practice/mix.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { scoreRecordedAttempt } from './speech/scoreAttempt.ts';
import { consumeRecording, discardRecording } from './speech/discardRecording.ts';

/** How long a feedback line holds the floor before the next exercise deals. */
const FEEDBACK_MS = 1600;
/** "Can't speak now" holds for an hour, then spoken drills quietly return. */
const MIC_SUPPRESS_MS = 60 * 60 * 1000;

/**
 * Web records only on a secure origin with MediaRecorder present; native Expo
 * always ships the recorder. A failed probe is not an error — it just means
 * the honest self-report control stays in charge.
 */
const CAN_RECORD =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

/** What this exercise asks for, said plainly. */
function kindTag(exercise: DrillExercise): string {
  switch (exercise.kind) {
    case 'fill-blank':
      return 'Fill the blank';
    case 'best-sentence':
      return 'Which would you say?';
    case 'appropriate-reply':
      return 'Choose a reply';
    case 'tap-translate':
      return 'Build it in French';
    case 'translate':
      return exercise.direction === 'fr-en' ? 'Translate into English' : 'Translate into French';
    case 'listen-type':
      return 'Listen and type';
    case 'repeat-this':
      return 'Say it aloud';
  }
}

/**
 * The verdict's colour, by the signals' fixed meanings: good is a sound that
 * worked, correspondance is "change here" (the recast in ConvoScreen uses the
 * same colour for the same reason), and a typo is plain ink — accepted, with
 * the spelling merely kept in view.
 */
function verdictColor(verdict: DrillVerdict): string {
  switch (verdict) {
    case 'good':
      return signal.good;
    case 'typo':
      return paper.ink;
    case 'miss':
      return signal.correspondance;
  }
}

// ─────────────────────────────────────────────── the pronunciation side-channel

/**
 * Ask the scorer about one recorded attempt. The grade is already banked
 * before this fires, so every outcome here — vendor down, budget spent (429),
 * permissionless blob, network gone — resolves to null and the sitting looks
 * exactly like the self-report flow. At most one learner-safe sentence comes
 * back: the reason behind core's single focus point, never a number.
 */
// ──────────────────────────────────────────────────────── local card pieces
// Composed here rather than added to components.tsx: OptionCard wants a gloss,
// and fill-blank options are bare words by authored design.

/** A single-word option, in the option-card anatomy without the gloss line. */
function WordChoice({ word, onPress, locked }: { word: string; onPress: () => void; locked: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={word}
      style={({ pressed }) => [ds.choice, pressed && ds.choicePressed]}
    >
      <Text style={[type.french, { color: paper.ink, flex: 1 }]}>{word}</Text>
      <ArrowRight size={18} color={paper.inkFaint} />
    </Pressable>
  );
}

/** The hear-it affordance ReviewScreen uses, for hearing a French line again. */
function HearRow({ text }: { text: string }) {
  return (
    <Pressable
      onPress={() => tutorVoice.speak(text)}
      accessibilityRole="button"
      accessibilityLabel="Hear it in French"
      style={({ pressed }) => [ds.hear, pressed && { opacity: 0.6 }]}
    >
      <EarGlyph size={15} color={paper.inkSoft} />
      <Text style={[type.small, { color: paper.inkSoft }]}>Hear it</Text>
    </Pressable>
  );
}

/** The app's first text input: a paper field in the Field anatomy. */
function TypedAnswer({
  typed,
  onChange,
  onSubmit,
  locked,
  placeholder,
  accessibilityLabel = 'Your answer',
}: {
  typed: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
  locked: boolean;
  placeholder: string;
  accessibilityLabel?: string;
}) {
  const canSubmit = typed.trim() !== '' && !locked;
  return (
    <View style={{ gap: space(2.5) }}>
      <TextInput
        value={typed}
        onChangeText={onChange}
        editable={!locked}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSubmit) onSubmit();
        }}
        placeholder={placeholder}
        placeholderTextColor={paper.inkFaint}
        accessibilityLabel={accessibilityLabel}
        style={ds.input}
      />
      <PillButton label="Check" disabled={!canSubmit} accessibilityLabel="Check your answer" onPress={onSubmit} />
    </View>
  );
}

// ──────────────────────────────────────────────────────── per-kind renderers

function FillBlankView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
}: {
  exercise: FillBlankExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
}) {
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[fitDisplay(exercise.sentence), { color: paper.ink, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.sentence}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>{exercise.en}</Text>
      </Card>
      {exercise.options ? (
        <View style={{ gap: space(2.5) }}>
          {exercise.options.map((option) => (
            <WordChoice key={option} word={option} onPress={() => onAnswer(option)} locked={locked} />
          ))}
        </View>
      ) : (
        <TypedAnswer
          typed={typed}
          onChange={onChange}
          onSubmit={() => onAnswer(typed)}
          locked={locked}
          placeholder="The missing word"
        />
      )}
    </View>
  );
}

function BestSentenceView({
  exercise,
  onAnswer,
  locked,
}: {
  exercise: BestSentenceExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
}) {
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[type.heading, { color: paper.ink, marginTop: space(3) }]}>{exercise.prompt}</Text>
      </Card>
      <View style={{ gap: space(2.5) }}>
        {exercise.candidates.map((candidate, i) => (
          <OptionCard
            key={candidate.fr}
            text={candidate.fr}
            gloss={candidate.en}
            onPress={() => {
              if (!locked) onAnswer(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function AppropriateReplyView({
  exercise,
  onAnswer,
  locked,
}: {
  exercise: AppropriateReplyExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
}) {
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>{kindTag(exercise)}</Label>
        <View style={{ marginTop: space(3) }}>
          <Label color={paper.ink}>{exercise.line.speaker}</Label>
          <Text style={[type.french, { color: paper.ink, marginTop: space(1.5) }]}>{exercise.line.fr}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{exercise.line.en}</Text>
        </View>
        <HearRow text={exercise.line.fr} />
      </Card>
      <View style={{ gap: space(2.5) }}>
        {exercise.options.map((option, i) => (
          <OptionCard
            key={option.fr}
            text={option.fr}
            gloss={option.en}
            onPress={() => {
              if (!locked) onAnswer(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TapTranslateView({
  exercise,
  assembled,
  onAssembled,
  onAnswer,
  locked,
}: {
  exercise: TapTranslateExercise;
  /** Indexes into `exercise.tokens`, in tap order. Indexes, because a bank may offer the same word twice. */
  assembled: number[];
  onAssembled: (next: number[]) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
}) {
  const answerText = assembled.map((i) => exercise.tokens[i]).join(' ');
  const canCheck = assembled.length > 0 && !locked;
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[type.heading, { color: paper.ink, textAlign: 'center', marginTop: space(3) }]}>{exercise.en}</Text>
      </Card>

      {/* The answer line being assembled. Tap a word to put it back. */}
      <View style={ds.answerLine} accessibilityLabel="Your sentence so far">
        {assembled.length === 0 ? (
          <Text style={[type.small, { color: paper.inkSoft }]}>Tap the words in order</Text>
        ) : (
          assembled.map((tokenIndex, position) => (
            <Pressable
              key={tokenIndex}
              onPress={() => onAssembled(assembled.filter((_, p) => p !== position))}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${exercise.tokens[tokenIndex]}`}
              style={({ pressed }) => [ds.assembledWord, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.french, { color: paper.ink }]}>{exercise.tokens[tokenIndex]}</Text>
            </Pressable>
          ))
        )}
      </View>

      {/* The pool. Used tiles stay in place and fade out, so nothing jumps. */}
      <View style={ds.tokenPool}>
        {exercise.tokens.map((token, i) => {
          const used = assembled.includes(i);
          return (
            <Pressable
              key={i}
              onPress={() => onAssembled([...assembled, i])}
              disabled={used || locked}
              accessibilityRole="button"
              accessibilityLabel={`Add ${token}`}
              accessibilityState={{ disabled: used }}
              style={({ pressed }) => [ds.token, used && ds.tokenUsed, pressed && !used && ds.choicePressed]}
            >
              <Text style={[type.french, { color: used ? paper.inkFaint : paper.ink }]}>{token}</Text>
            </Pressable>
          );
        })}
      </View>

      <PillButton
        label="Check"
        disabled={!canCheck}
        accessibilityLabel="Check your sentence"
        onPress={() => onAnswer(answerText)}
      />
    </View>
  );
}

function ListenTypeView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
}: {
  exercise: ListenTypeExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
}) {
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        {/* Replayable freely — dictation is a listening exercise, not a memory test. */}
        <Pressable
          onPress={() => tutorVoice.speak(exercise.fr)}
          accessibilityRole="button"
          accessibilityLabel="Play the French line"
          style={({ pressed }) => [ds.listenButton, pressed && { backgroundColor: paper.groundDeep }]}
        >
          <EarGlyph size={22} color={paper.ink} />
          <Text style={[type.button, { color: paper.ink }]}>Hear it</Text>
        </Pressable>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>
          Listen, then type what you hear.
        </Text>
      </Card>
      <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={() => onAnswer(typed)}
        locked={locked}
        placeholder="What you hear"
      />
    </View>
  );
}

function TranslationView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
}: {
  exercise: TranslationExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
}) {
  const isFrenchPrompt = exercise.direction === 'fr-en';
  const prompt = isFrenchPrompt ? exercise.fr : exercise.en;
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[isFrenchPrompt ? type.french : type.heading, { color: paper.ink, textAlign: 'center', marginTop: space(4) }]}>
          {prompt}
        </Text>
        {isFrenchPrompt && <HearRow text={exercise.fr} />}
      </Card>
      <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={() => onAnswer(typed)}
        locked={locked}
        placeholder={isFrenchPrompt ? 'Meaning in English' : 'Answer in French'}
        accessibilityLabel={isFrenchPrompt ? 'Your answer in English' : 'Your answer in French'}
      />
    </View>
  );
}

function RepeatThisView({
  exercise,
  onAnswer,
  onSpoke,
  onNoMic,
  locked,
}: {
  exercise: RepeatThisExercise;
  onAnswer: (a: string) => void;
  /** A finished take: its uri, or null when the recorder lost it. Grading either way is the callee's law. */
  onSpoke: (uri: string | null) => void;
  onNoMic: () => void;
  locked: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // 'armed': the circle records on tap. 'live': the microphone is on. 'silent':
  // the platform said no — recorder missing, permission refused, or a start
  // that threw — and the honest self-report control is back in charge, because
  // refusing the microphone must cost the learner nothing.
  const [mic, setMic] = useState<'armed' | 'live' | 'silent'>(CAN_RECORD ? 'armed' : 'silent');
  // The recorder's async edges must run one at a time; a double-tap cannot be
  // allowed to race prepare against stop.
  const busyRef = useRef(false);

  const toggleRecord = useCallback(async () => {
    if (busyRef.current || locked) return;
    busyRef.current = true;
    try {
      if (mic === 'live') {
        let lost = false;
        try {
          await recorder.stop();
        } catch {
          // A take the recorder lost was still spoken; only scoring goes without.
          lost = true;
        }
        // Where it was written, asked for on its own. A stop that threw can
        // still have left bytes on disk, and reading the path is the only way
        // to reach them; if even that fails there is nothing to name.
        let uri: string | null = null;
        try {
          uri = recorder.uri;
        } catch {
          uri = null;
        }
        if (lost) {
          // Unscorable, so it travels no further, and unscorable is exactly
          // when a file would otherwise be left behind for good.
          discardRecording(uri);
          uri = null;
        }
        // Hand the audio session back to playback, so Hear it keeps its volume.
        void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
        setMic('armed');
        onSpoke(uri);
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setMic('silent');
          return;
        }
        tutorVoice.stop(); // the reference playing into the microphone scores nobody
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setMic('live');
      }
    } catch {
      setMic('silent');
    } finally {
      busyRef.current = false;
    }
  }, [mic, locked, recorder, onSpoke]);

  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[fitDisplay(exercise.reference), { color: paper.ink, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.reference}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>
          {exercise.referenceEn}
        </Text>
        {exercise.ipa !== null && (
          <Text style={[type.notation, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}>
            /{exercise.ipa}/
          </Text>
        )}
        <HearRow text={exercise.reference} />
      </Card>

      <View style={{ alignItems: 'center', gap: space(3) }}>
        {mic === 'silent' ? (
          <>
            {/* The speak circle in its muted state: nothing records here, and
                the red fill must keep meaning "the microphone is on". */}
            <View style={ds.speakBlock}>
              <SpeakCircle muted accessibilityLabel="Say the line out loud" />
              <Text style={[type.label, { color: paper.ink }]}>Speak</Text>
            </View>

            {/* Without a microphone the learner's word is the grade. Saying so
                out loud in the control's own copy keeps the report honest. */}
            <View style={ds.saidIt}>
              <PillButton label="I said it" onPress={() => onAnswer(exercise.reference)} disabled={locked} />
            </View>
          </>
        ) : (
          /* The one speak control made real: hollow at rest, and filled green
             only while the microphone is actually on. Green means you speak,
             here as in ConvoScreen; red belongs to the tutor's own voice and
             never marks the learner's microphone. Tapping Done grades exactly
             as I said it does; the recording only ever adds a line. */
          <View style={ds.speakBlock}>
            <SpeakCircle
              onPress={() => void toggleRecord()}
              active={mic === 'live'}
              disabled={locked}
              accessibilityLabel={mic === 'live' ? 'Stop recording' : 'Record yourself saying it'}
            />
            <Text style={[type.label, { color: paper.ink }]}>{mic === 'live' ? 'Done' : 'Speak'}</Text>
          </View>
        )}

        <Pressable
          onPress={onNoMic}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="I can't speak right now"
          style={({ pressed }) => [ds.noMic, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.small, { color: paper.inkSoft }]}>Unable to speak right now?</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────── the screen

export function DrillScreen({
  userId,
  onDone,
  node,
  mix = false,
  onFinished,
}: {
  userId: string;
  onDone: () => void;
  /**
   * The sitting finished, as distinct from Done: Done also fires on Leave, and
   * a pack must not be marked practised by a sitting that was abandoned (F550).
   */
  onFinished?: (nodeId: string) => void;
  /**
   * One node of the practice path. Omitted, the whole deck plays, which is
   * what "Start practice" has always done and still does.
   */
  node?: { id: string; title: string; phraseKeys: readonly string[]; moment?: DrillMoment };
  /**
   * Today's mix: the same unscoped sitting, reordered so it moves between
   * topics instead of playing one conversation's worth and then the next.
   * Order only. Who plays is still buildDrillSession's decision alone.
   */
  mix?: boolean;
}) {
  // The sitting. Null while the deck and bank load.
  const [session, setSession] = useState<DrillSessionState | null>(null);
  // The line on the floor. While one shows, inputs are locked and the next
  // state waits in pendingRef; the beat ends and the queue's head deals.
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const pendingRef = useRef<DrillSessionState | null>(null);
  // The scorer's one calm line, when it arrives in time. A focus reason may
  // only land in the beat its recording earned — beatRef numbers the beats so
  // a late answer from the scorer is dropped unseen, never shown out of place.
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const beatRef = useRef(0);
  // Grades leave this screen exactly once, whether by finishing or by Leave.
  const persistedRef = useRef(false);
  // The finished signal leaves exactly once too, and only on a finished sitting.
  const finishedRef = useRef(false);
  const gradeWritesRef = useRef<Promise<void>>(Promise.resolve());
  // When the sitting started. Wall clock on the device, which is what Home's
  // speaking goal measures; it is not the metered minutes and must never be
  // shown as those.
  const openedAt = useRef(Date.now());

  // Per-exercise input state, cleared on every advance.
  const [typed, setTyped] = useState('');
  const [assembled, setAssembled] = useState<number[]>([]);

  // The sitting could not be read. Told, rather than shown as a spinner that
  // never resolves.
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Topics are read only for the mix: they are the lanes the round robin runs
    // over, and an ordinary sitting has no use for them.
    const topicsSoon = mix ? loadTopics() : Promise.resolve([]);
    void Promise.all([loadDeck(), loadDrillBank(), getMicSuppressedUntil(), topicsSoon])
      .then(
      ([deck, bank, until, topics]) => {
        if (cancelled) return;
        const now = Date.now();
        let built = buildDrillSession(deck, bank, now, node ? { only: node.phraseKeys } : undefined);
        // Reorder, never re-pick: the cap, the earned stage and the newcomer
        // rule were all applied above, and are not this screen's to argue with.
        if (mix) built = { ...built, queue: mixQueue(built.queue, topicGroups(topics)) };
        if (until !== null && Date.parse(until) > now) {
          // Still inside the "can't speak now" hour: open silent, unasked.
          built = suppressMic(built);
        } else if (until !== null) {
          // The window lapsed; clear it so spoken drills return next sitting.
          void setMicSuppressed(null);
        }
        setSession(built);
      },
    )
      .catch(() => {
        // A disk that will not answer is not a reason to strand somebody on a
        // spinner. The screen below draws a way out instead, which is the same
        // treatment the Practice tab got in F449 and for the same reason: a
        // loading state that is also the failure state says nothing at all.
        if (!cancelled) setUnread(true);
      });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, [node, mix]);

  /**
   * Feed outcomes to the one memory system, through the review store's own
   * write path: each drilled phrase's key IS its review card's id, so
   * `gradeCard` applies exactly the reschedule `applyDrillResults` describes,
   * on the store's serialized chain. Answered exercises only — the unanswered
   * rest simply stay due.
   */
  const persistGrades = useCallback((state: DrillSessionState) => {
    if (persistedRef.current) return;
    persistedRef.current = true;
    const summary = summariseDrill(state);
    // Collected rather than fired and forgotten: the caller awaits these before
    // navigating, because loadDeck reads storage directly and is not on the
    // review store's write chain. Without it, the screen that comes next can
    // read a deck that predates this sitting.
    // `transfer` rides along rather than being destructured away. Core marks a
    // grade as transfer when the same phrase was asked in a changed situation,
    // and it is the one thing a drill knows that a review sitting cannot: the
    // store drops it on the floor if this map does not carry it, and the
    // learner's evidence record never hears about a drill they got right.
    gradeWritesRef.current = gradeCards(
      summary.grades.map(({ phraseKey, grade, transfer }) => ({
        id: phraseKey,
        grade,
        ...(transfer === true ? { transfer: true } : {}),
      })),
    ).then(() => undefined);
    // What the sitting was worth. Clean answers count double, because getting
    // it right without being shown the spelling is the harder thing.
    void recordActivity(
      'drill',
      drillXp({ clean: summary.resolved - summary.typos, typoCorrected: summary.typos }),
      Date.now(),
      { durationMs: Date.now() - openedAt.current },
    );
  }, []);

  const answer = useCallback(
    (value: string | number) => {
      if (!session || session.finished || feedback) return;
      const { state: next, feedback: fb } = answerCurrent(session, value);
      if (!fb) return;
      tutorVoice.stop();
      pendingRef.current = next;
      setFeedback(fb);
    },
    [session, feedback],
  );

  // A spoken attempt. The grade is the self-report's, banked before the scorer
  // is even asked — scoring can add one line to the beat, never subtract.
  const spoke = useCallback(
    (uri: string | null) => {
      // Both of these mean the take arrived after the beat it belonged to. The
      // grade is gone either way; the file must not be.
      if (!session || session.finished || feedback) return discardRecording(uri);
      const current = session.queue[0];
      if (!current || current.kind !== 'repeat-this') return discardRecording(uri);
      const beat = beatRef.current;
      answer(current.reference);
      void consumeRecording(uri, (recorded) => scoreRecordedAttempt(userId, recorded, current.reference)).then(
        (score) => {
          const reason = score?.report.focus?.reason ?? null;
          if (reason !== null && beatRef.current === beat) setFocusLine(reason);
        },
      );
    },
    [session, feedback, answer, userId],
  );

  // The feedback beat: hold the line, then deal the next exercise. A missed
  // exercise is already at the back of the queue and comes around unannounced.
  // A focus line landing mid-beat restarts the clock, so the one sentence the
  // scorer gets to say also gets a full beat to be read.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => {
      const next = pendingRef.current;
      pendingRef.current = null;
      beatRef.current += 1;
      setFeedback(null);
      setFocusLine(null);
      setTyped('');
      setAssembled([]);
      if (next) {
        if (next.finished) persistGrades(next);
        setSession(next);
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [feedback, focusLine, persistGrades]);

  /**
   * Leave, once this sitting is actually on disk.
   *
   * The wait matters because the screen behind this one re-reads the deck the
   * moment it regains focus, and `loadDeck` bypasses the review store's write
   * chain. Navigating first meant the practice map could show a node that had
   * plainly just been finished as untouched.
   */
  useEffect(() => {
    if (!session?.finished || !node || finishedRef.current) return;
    finishedRef.current = true;
    onFinished?.(node.id);
  }, [session, node, onFinished]);

  const finishAndLeave = useCallback(() => {
    tutorVoice.stop();
    // Mid-beat, the answered exercise lives in pendingRef; count it.
    const state = pendingRef.current ?? session;
    if (state) persistGrades(state);
    void gradeWritesRef.current.finally(onDone);
  }, [session, persistGrades, onDone]);

  const leave = finishAndLeave;

  const goSilent = useCallback(() => {
    if (!session || feedback) return;
    setSession(suppressMic(session));
    setTyped('');
    setAssembled([]);
    void setMicSuppressed(new Date(Date.now() + MIC_SUPPRESS_MS).toISOString());
  }, [session, feedback]);

  // What this sitting calls itself. A learner who opened Today's mix and landed
  // on a screen headed "Drills" would have no way to tell the two apart.
  const heading = sittingTitle({ mix });

  if (unread) {
    return (
      <ScrollScreen center footer={<PillButton label="Done" onPress={finishAndLeave} />}>
        <Text style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{DRILL_UNREAD.title}</Text>
        <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(3) }]}>
          {DRILL_UNREAD.body}
        </Text>
      </ScrollScreen>
    );
  }

  if (session === null) {
    return (
      <Screen>
        <View style={ds.loading}>
          <ActivityIndicator color={paper.inkSoft} />
        </View>
      </Screen>
    );
  }

  // Built empty: nothing due right now. One calm card and the way out. A
  // terminal card, so Done is its one door and it carries no back header.
  if (session.finished && session.answered.length === 0) {
    return (
      <ScrollScreen center footer={<PillButton label="Done" onPress={finishAndLeave} />}>
        {/* An empty bank is the good outcome, not a dead end, so it gets the
            cleared table — the same scene, width and spacing the review deck
            uses, because these two screens say the same thing. No `paused`:
            this is a stack route above the tabs with nothing pushed over it,
            so unlike a tab it is either focused or unmounted. */}
        <View style={{ alignItems: 'center', marginBottom: space(5) }}>
          <NothingDue width={190} />
        </View>
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>Nothing to review.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
            Your next session adds more.
          </Text>
        </Card>
      </ScrollScreen>
    );
  }

  // The end card — the one place numbers are allowed, where they have context.
  // Terminal, so Done alone, no back header.
  if (session.finished) {
    const s = summariseDrill(session);
    return (
      <ScrollScreen center footer={<PillButton label="Done" onPress={leave} />}>
        <Card>
          <View style={ds.stats}>
            <View style={ds.stat}>
              <Text style={[type.title, { color: paper.ink }]}>{s.total}</Text>
              <Text style={[type.label, { color: paper.inkSoft, marginTop: space(1) }]}>Drills</Text>
            </View>
            <View style={ds.stat}>
              <Text style={[type.title, { color: paper.ink }]}>{s.resolved}</Text>
              <Text style={[type.label, { color: paper.inkSoft, marginTop: space(1) }]}>Got right</Text>
            </View>
            {s.typos > 0 && (
              <View style={ds.stat}>
                <Text style={[type.title, { color: paper.ink }]}>{s.typos}</Text>
                <Text style={[type.label, { color: paper.inkSoft, marginTop: space(1) }]}>Spelling slips</Text>
              </View>
            )}
            {s.unresolved > 0 && (
              <View style={ds.stat}>
                <Text style={[type.title, { color: paper.ink }]}>{s.unresolved}</Text>
                <Text style={[type.label, { color: paper.inkSoft, marginTop: space(1) }]}>Coming back</Text>
              </View>
            )}
          </View>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>
            Your review deck takes it from here.
          </Text>
        </Card>
      </ScrollScreen>
    );
  }

  const exercise = session.queue[0];
  if (!exercise) return null; // Unreachable: an unfinished session has a head.
  const locked = feedback !== null;

  return (
    <ScrollScreen
      avoidKeyboard
      center
      // A sitting is an offer, not an obligation. Leaving persists what was
      // answered; the rest simply stays due. Never a count up here.
      header={<ScreenHeader leave={{ onPress: leave, label: 'Leave', accessibilityLabel: 'Leave the drills' }} />}
      footer={
        // Reserved height, so the card never jumps when a line arrives.
        <View style={ds.feedbackArea}>
          {feedback && (
            <View style={ds.verdictRow}>
              {/* No mark on a miss, and that is the rule rather than an
                  oversight: a mid-session message may not scold, and a drawing
                  scolds louder than a word. A miss keeps the line it always
                  had, alone. The mark unmounts between beats, so its arrival
                  replays on every verdict without a key to force it. */}
              {feedback.verdict !== 'miss' && <RewardMark size={26} kind={feedback.verdict} />}
              <Text style={[type.bodyStrong, { color: verdictColor(feedback.verdict), textAlign: 'center' }]}>
                {feedback.message}
              </Text>
            </View>
          )}
          {/* The scorer's whole say is this one muted line — core's focus
              reason, already learner-safe. Never a score, never a bar. */}
          {feedback && focusLine !== null && (
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1.5) }]}>
              {focusLine}
            </Text>
          )}
        </View>
      }
    >
      {node?.moment !== undefined && <MomentCard moment={node.moment} />}
      {exercise.kind === 'fill-blank' && (
        <FillBlankView exercise={exercise} typed={typed} onChange={setTyped} onAnswer={answer} locked={locked} />
      )}
      {exercise.kind === 'best-sentence' && <BestSentenceView exercise={exercise} onAnswer={answer} locked={locked} />}
      {exercise.kind === 'appropriate-reply' && (
        <AppropriateReplyView exercise={exercise} onAnswer={answer} locked={locked} />
      )}
      {exercise.kind === 'tap-translate' && (
        <TapTranslateView
          exercise={exercise}
          assembled={assembled}
          onAssembled={setAssembled}
          onAnswer={answer}
          locked={locked}
        />
      )}
      {exercise.kind === 'listen-type' && (
        <ListenTypeView exercise={exercise} typed={typed} onChange={setTyped} onAnswer={answer} locked={locked} />
      )}
      {exercise.kind === 'translate' && (
        <TranslationView exercise={exercise} typed={typed} onChange={setTyped} onAnswer={answer} locked={locked} />
      )}
      {exercise.kind === 'repeat-this' && (
        <RepeatThisView exercise={exercise} onAnswer={answer} onSpoke={spoke} onNoMic={goSilent} locked={locked} />
      )}
    </ScrollScreen>
  );
}

const ds = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedbackArea: { minHeight: HIT + 8, justifyContent: 'center', paddingHorizontal: space(2) },
  verdictRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2) },

  // The exercise card: the SessionView main-card anatomy, content centred.
  exCard: { alignItems: 'center' },

  // The option-card anatomy, for choices that are bare words.
  choice: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  choicePressed: { backgroundColor: paper.groundDeep },

  // The paper text field, in the Field anatomy. Type styles from the theme,
  // minus lineHeight, which clips single-line TextInputs on iOS.
  input: {
    minHeight: HIT + 8,
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    color: paper.ink,
    fontFamily: font.sans,
    fontSize: 16,
  },

  answerLine: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  assembledWord: {
    // A Pressable with a button role that removes the word you tap. It is a
    // control, so it gets the floor every control gets.
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.groundDeep,
    borderRadius: radius.chip,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  token: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  tokenUsed: { backgroundColor: 'transparent' },

  listenButton: {
    marginTop: space(3.5),
    minHeight: HIT + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2.5),
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space(5),
  },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },

  speakBlock: { alignItems: 'center', gap: space(2) },
  saidIt: { alignSelf: 'stretch' },
  noMic: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },

  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3) },
  stat: { width: '50%', paddingVertical: space(2.5) },
});
