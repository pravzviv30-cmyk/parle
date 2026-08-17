/**
 * The drill sitting — the review deck made active.
 *
 * One exercise per screen, calm. The screen renders engine state and calls the
 * pure functions in @parle/core/drill; every pedagogical decision (what to ask,
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
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import {
  answerCurrent,
  buildDrillSession,
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
  type SessionPhonemeReport,
  type TapTranslateExercise,
} from '@parle/core';
import { paper, signal, space, type, radius, font, HAIRLINE, HIT } from './theme.ts';
import { Card, Label, OptionCard, PillButton, SpeakCircle, ArrowRight, EarGlyph, fitDisplay } from './components.tsx';
import { loadDeck, gradeCard } from './review/store.ts';
import { loadDrillBank, getMicSuppressedUntil, setMicSuppressed } from './drill/store.ts';
import * as tutorVoice from './speech/tutorVoice.ts';

/** How long a feedback line holds the floor before the next exercise deals. */
const FEEDBACK_MS = 1600;
/** "Can't speak now" holds for an hour, then spoken drills quietly return. */
const MIC_SUPPRESS_MS = 60 * 60 * 1000;

/** The same server, and the same default, that useLiveSession reaches for. */
const TOKEN_SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL ?? 'http://localhost:8787';
/**
 * The scoring budget is per-user-per-day on the server, and accounts don't
 * exist yet, so every install shares one drill identity. TODO(auth): replace
 * with the real user id once there is one.
 */
const DRILL_USER_ID = 'drill-user';
/** The server refuses larger bodies; sending one would only waste the upload. */
const MAX_SCORE_BYTES = 2 * 1024 * 1024;
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
async function scoreAttempt(uri: string, reference: string): Promise<string | null> {
  try {
    // The recorder hands back a file:// path on native and a blob: URL on the
    // web; expo-file-system's File is native-only, so each side reads its own.
    const body = Platform.OS === 'web' ? await (await fetch(uri)).blob() : await new File(uri).bytes();
    const size = body instanceof Uint8Array ? body.byteLength : body.size;
    if (size === 0 || size > MAX_SCORE_BYTES) return null;
    const res = await fetch(
      `${TOKEN_SERVER}/drill/score?userId=${encodeURIComponent(DRILL_USER_ID)}&reference=${encodeURIComponent(reference)}`,
      { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { report?: SessionPhonemeReport };
    return data.report?.focus?.reason ?? null;
  } catch {
    return null;
  }
}

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
}: {
  typed: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
  locked: boolean;
  placeholder: string;
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
        accessibilityLabel="Your answer in French"
        style={ds.input}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Check your answer"
        style={({ pressed }) => [ds.check, !canSubmit && ds.checkDisabled, pressed && canSubmit && { opacity: 0.88 }]}
      >
        <Text style={[type.button, { color: paper.onInk }]}>Check</Text>
      </Pressable>
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
        <Text style={[type.heading, { color: paper.ink, textAlign: 'center', marginTop: space(3) }]}>{exercise.en}</Text>
      </Card>

      {/* The answer line being assembled. Tap a word to put it back. */}
      <View style={ds.answerLine} accessibilityLabel="Your sentence so far">
        {assembled.length === 0 ? (
          <Text style={[type.small, { color: paper.inkFaint }]}>Tap the words in order</Text>
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

      <Pressable
        onPress={() => onAnswer(answerText)}
        disabled={!canCheck}
        accessibilityRole="button"
        accessibilityLabel="Check your sentence"
        style={({ pressed }) => [ds.check, !canCheck && ds.checkDisabled, pressed && canCheck && { opacity: 0.88 }]}
      >
        <Text style={[type.button, { color: paper.onInk }]}>Check</Text>
      </Pressable>
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
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
        let uri: string | null = null;
        try {
          await recorder.stop();
          uri = recorder.uri;
        } catch {
          // A take the recorder lost was still spoken; only scoring goes without.
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
        <Label color={paper.inkFaint}>{kindTag(exercise)}</Label>
        <Text style={[fitDisplay(exercise.reference), { color: paper.ink, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.reference}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2.5) }]}>
          {exercise.referenceEn}
        </Text>
        {exercise.ipa !== null && (
          <Text style={[type.notation, { color: paper.inkFaint, textAlign: 'center', marginTop: space(2) }]}>
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
          /* The one speak control made real: hollow at rest, and signal.live
             red only while the microphone is actually on — the red circle keeps
             its one meaning, here as in ConvoScreen. Tapping Done grades
             exactly as I said it does; the recording only ever adds a line. */
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

export function DrillScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();

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

  // Per-exercise input state, cleared on every advance.
  const [typed, setTyped] = useState('');
  const [assembled, setAssembled] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadDeck(), loadDrillBank(), getMicSuppressedUntil()]).then(([deck, bank, until]) => {
      if (cancelled) return;
      const now = Date.now();
      let built = buildDrillSession(deck, bank, now);
      if (until !== null && Date.parse(until) > now) {
        // Still inside the "can't speak now" hour: open silent, unasked.
        built = suppressMic(built);
      } else if (until !== null) {
        // The window lapsed; clear it so spoken drills return next sitting.
        void setMicSuppressed(null);
      }
      setSession(built);
    });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, []);

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
    for (const { phraseKey, grade } of summariseDrill(state).grades) {
      void gradeCard(phraseKey, grade);
    }
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
      if (!session || session.finished || feedback) return;
      const current = session.queue[0];
      if (!current || current.kind !== 'repeat-this') return;
      const beat = beatRef.current;
      answer(current.reference);
      if (uri === null) return;
      void scoreAttempt(uri, current.reference).then((reason) => {
        if (reason !== null && beatRef.current === beat) setFocusLine(reason);
      });
    },
    [session, feedback, answer],
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

  const leave = useCallback(() => {
    tutorVoice.stop();
    // Mid-beat, the answered exercise lives in pendingRef; count it.
    const state = pendingRef.current ?? session;
    if (state) persistGrades(state);
    onDone();
  }, [session, persistGrades, onDone]);

  const goSilent = useCallback(() => {
    if (!session || feedback) return;
    setSession(suppressMic(session));
    setTyped('');
    setAssembled([]);
    void setMicSuppressed(new Date(Date.now() + MIC_SUPPRESS_MS).toISOString());
  }, [session, feedback]);

  if (session === null) {
    return (
      <View style={ds.center}>
        <ActivityIndicator color={paper.inkSoft} />
      </View>
    );
  }

  // Built empty: nothing due right now. One calm card and the way out.
  if (session.finished && session.answered.length === 0) {
    return (
      <View style={[ds.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <Label>Drills</Label>
        <View style={ds.centerFill}>
          <Card>
            <Label>Nothing due right now</Label>
            <Text style={[type.title, { color: paper.ink, marginTop: space(2.5) }]}>Nothing to review.</Text>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
              Your next session adds more.
            </Text>
          </Card>
        </View>
        <PillButton label="Done" onPress={onDone} />
      </View>
    );
  }

  // The end card — the one place numbers are allowed, where they have context.
  if (session.finished) {
    const s = summariseDrill(session);
    return (
      <View style={[ds.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <Label>Drills</Label>
        <View style={ds.centerFill}>
          <Card>
            <Label color={signal.good}>Session done</Label>
            <View style={ds.stats}>
              <View style={ds.stat}>
                <Text style={[type.title, { color: paper.ink }]}>{s.total}</Text>
                <Text style={[type.label, { color: paper.inkFaint, marginTop: space(1) }]}>Drills</Text>
              </View>
              <View style={ds.stat}>
                <Text style={[type.title, { color: paper.ink }]}>{s.resolved}</Text>
                <Text style={[type.label, { color: paper.inkFaint, marginTop: space(1) }]}>Got right</Text>
              </View>
              {s.typos > 0 && (
                <View style={ds.stat}>
                  <Text style={[type.title, { color: paper.ink }]}>{s.typos}</Text>
                  <Text style={[type.label, { color: paper.inkFaint, marginTop: space(1) }]}>Spelling slips</Text>
                </View>
              )}
              {s.unresolved > 0 && (
                <View style={ds.stat}>
                  <Text style={[type.title, { color: paper.ink }]}>{s.unresolved}</Text>
                  <Text style={[type.label, { color: paper.inkFaint, marginTop: space(1) }]}>Coming back</Text>
                </View>
              )}
            </View>
            <Text style={[type.small, { color: paper.inkFaint, marginTop: space(3) }]}>
              Your review deck takes it from here.
            </Text>
          </Card>
        </View>
        <PillButton label="Done" onPress={leave} />
      </View>
    );
  }

  const exercise = session.queue[0];
  if (!exercise) return null; // Unreachable: an unfinished session has a head.
  const locked = feedback !== null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={[ds.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(4) }]}>
        <View style={ds.headerRow}>
          <Label>Drills</Label>
          {/* A sitting is an offer, not an obligation. Leaving persists what
              was answered; the rest simply stays due. Never a count up here. */}
          <Pressable
            onPress={leave}
            accessibilityRole="button"
            accessibilityLabel="Leave the drills"
            style={({ pressed }) => [ds.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={ds.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
          {exercise.kind === 'repeat-this' && (
            <RepeatThisView exercise={exercise} onAnswer={answer} onSpoke={spoke} onNoMic={goSilent} locked={locked} />
          )}
        </ScrollView>

        {/* Reserved height, so the card never jumps when a line arrives. */}
        <View style={ds.feedbackArea}>
          {feedback && (
            <Text style={[type.bodyStrong, { color: verdictColor(feedback.verdict), textAlign: 'center' }]}>
              {feedback.message}
            </Text>
          )}
          {/* The scorer's whole say is this one muted line — core's focus
              reason, already learner-safe. Never a score, never a bar. */}
          {feedback && focusLine !== null && (
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1.5) }]}>
              {focusLine}
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center' },
  centerFill: { flex: 1, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  feedbackArea: { minHeight: HIT + 8, justifyContent: 'center', paddingHorizontal: space(2) },

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
  // The one primary action, in the PillButton anatomy.
  check: {
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space(6),
  },
  checkDisabled: { backgroundColor: paper.inkFaint },

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
    minHeight: HIT - 8,
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
