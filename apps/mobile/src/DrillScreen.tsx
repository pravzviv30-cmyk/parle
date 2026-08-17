/**
 * The drill sitting — the review deck made active.
 *
 * One exercise per screen, calm. The screen renders engine state and calls the
 * pure functions in @parle/core/drill; every pedagogical decision (what to ask,
 * how to grade, what a miss costs) already happened there. If logic that looks
 * like grading or selection appears in this file, it is in the wrong file.
 *
 * Feedback follows the signal vocabulary: `signal.good` for a phrase that came
 * out, `signal.correspondance` for the change-here correction, enamel white for
 * a spelling pointed at. Never a number and never a scold mid-session; the end
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
import { enamel, signal, space, type, radius, font, HIT } from './theme.ts';
import { Plaque, Tag, LabeledTag, DirectionPlaque, ArrowRight, MicGlyph, EarGlyph } from './components.tsx';
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

/** Signage lettering has to fit its plaque — a real sign is cut to its longest word. */
function plaqueType(text: string) {
  const n = text.length;
  if (n <= 16) return type.plaque;
  if (n <= 32) return { ...type.plaque, fontSize: 24, lineHeight: 31, letterSpacing: 1.1 };
  return { ...type.plaque, fontSize: 19, lineHeight: 26, letterSpacing: 0.7 };
}

/** What this exercise asks for, in the plaque's own vocabulary. */
function kindTag(exercise: DrillExercise): string {
  switch (exercise.kind) {
    case 'fill-blank':
      return 'COMPLÉTEZ · FILL THE BLANK';
    case 'best-sentence':
      return 'LA BONNE PHRASE · WHICH WOULD YOU SAY?';
    case 'appropriate-reply':
      return 'RÉPONDEZ · CHOOSE A REPLY';
    case 'tap-translate':
      return 'TRADUISEZ · BUILD IT IN FRENCH';
    case 'listen-type':
      return 'DICTÉE · LISTEN AND TYPE';
    case 'repeat-this':
      return 'RÉPÉTEZ · SAY IT ALOUD';
  }
}

/**
 * The verdict's colour, by the signals' fixed meanings: good is a sound that
 * worked, correspondance is "change here" (the recast in ConvoScreen uses the
 * same colour for the same reason), and a typo is neutral enamel — accepted,
 * with the spelling merely kept in view.
 */
function verdictColor(verdict: DrillVerdict): string {
  switch (verdict) {
    case 'good':
      return signal.good;
    case 'typo':
      return enamel.white;
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

// ─────────────────────────────────────────────────────── local plaque pieces
// Composed here rather than added to components.tsx: DirectionPlaque wants a
// gloss, and fill-blank options are bare words by authored design.

/** A single-word option, in the direction-plaque anatomy without the gloss line. */
function WordChoice({ word, onPress, locked }: { word: string; onPress: () => void; locked: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={word}
      style={({ pressed }) => [ds.choice, pressed && ds.choicePressed]}
    >
      <Text style={[type.bodyStrong, { color: enamel.white, flex: 1 }]}>{word}</Text>
      <ArrowRight size={20} color={enamel.white} />
    </Pressable>
  );
}

/** The écouter affordance ReviewScreen uses, for hearing a French line again. */
function HearRow({ text }: { text: string }) {
  return (
    <Pressable
      onPress={() => tutorVoice.speak(text)}
      accessibilityRole="button"
      accessibilityLabel="Hear it in French"
      style={({ pressed }) => [ds.hear, pressed && { opacity: 0.6 }]}
    >
      <EarGlyph size={15} color={enamel.whiteMuted} />
      <Text style={[type.small, { color: enamel.whiteMuted }]}>écouter · hear it</Text>
    </Pressable>
  );
}

/** The app's first text input: an enamel field with the plaque's own anatomy. */
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
        placeholderTextColor={enamel.whiteFaint}
        accessibilityLabel="Your answer in French"
        style={ds.input}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Check your answer"
        style={({ pressed }) => [ds.valider, pressed && { opacity: 0.85 }, !canSubmit && { opacity: 0.4 }]}
      >
        <Text style={[type.tag, { color: enamel.field }]}>VALIDER · CHECK</Text>
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
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        <Text style={[plaqueType(exercise.sentence), { color: enamel.white, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.sentence}
        </Text>
        <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2.5) }]}>{exercise.en}</Text>
      </Plaque>
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
          placeholder="le mot qui manque · the missing word"
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
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        <Text style={[type.heading, { color: enamel.white, marginTop: space(3) }]}>{exercise.prompt}</Text>
      </Plaque>
      <View style={{ gap: space(2.5) }}>
        {exercise.candidates.map((candidate, i) => (
          <DirectionPlaque
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
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        <View style={{ marginTop: space(3) }}>
          <Tag color={enamel.white}>{exercise.line.speaker.toUpperCase()}</Tag>
          <Text style={[type.bodyStrong, { color: enamel.white, marginTop: space(1.5) }]}>{exercise.line.fr}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(0.5) }]}>{exercise.line.en}</Text>
        </View>
        <HearRow text={exercise.line.fr} />
      </Plaque>
      <View style={{ gap: space(2.5) }}>
        {exercise.options.map((option, i) => (
          <DirectionPlaque
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
  return (
    <View style={{ gap: space(4) }}>
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        <Text style={[type.heading, { color: enamel.white, textAlign: 'center', marginTop: space(3) }]}>{exercise.en}</Text>
      </Plaque>

      {/* The answer line being assembled. Tap a word to put it back. */}
      <View style={ds.answerLine} accessibilityLabel="Your sentence so far">
        {assembled.length === 0 ? (
          <Text style={[type.small, { color: enamel.whiteFaint }]}>touchez les mots · tap the words in order</Text>
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
              <Text style={[type.bodyStrong, { color: enamel.white }]}>{exercise.tokens[tokenIndex]}</Text>
            </Pressable>
          ))
        )}
      </View>

      {/* The pool. Used tiles stay in place and grey out, so nothing jumps. */}
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
              <Text style={[type.bodyStrong, { color: used ? enamel.whiteFaint : enamel.white }]}>{token}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => onAnswer(answerText)}
        disabled={assembled.length === 0 || locked}
        accessibilityRole="button"
        accessibilityLabel="Check your sentence"
        style={({ pressed }) => [ds.valider, pressed && { opacity: 0.85 }, (assembled.length === 0 || locked) && { opacity: 0.4 }]}
      >
        <Text style={[type.tag, { color: enamel.field }]}>VALIDER · CHECK</Text>
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
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        {/* Replayable freely — dictation is a listening exercise, not a memory test. */}
        <Pressable
          onPress={() => tutorVoice.speak(exercise.fr)}
          accessibilityRole="button"
          accessibilityLabel="Play the French line"
          style={({ pressed }) => [ds.listenButton, pressed && { opacity: 0.8 }]}
        >
          <EarGlyph size={22} color={enamel.white} />
          <Text style={[type.tag, { color: enamel.white }]}>ÉCOUTER · HEAR IT</Text>
        </Pressable>
        <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2.5) }]}>
          Écoutez, puis écrivez ce que vous entendez. · Listen, then type what you hear.
        </Text>
      </Plaque>
      <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={() => onAnswer(typed)}
        locked={locked}
        placeholder="ce que vous entendez · what you hear"
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
        // Hand the audio session back to playback, so écouter keeps its volume.
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
      <Plaque raised>
        <Tag color={enamel.whiteFaint}>{kindTag(exercise)}</Tag>
        <Text style={[plaqueType(exercise.reference), { color: enamel.white, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.reference}
        </Text>
        <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2.5) }]}>
          {exercise.referenceEn}
        </Text>
        {exercise.ipa !== null && (
          <Text style={[type.notation, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(2) }]}>
            /{exercise.ipa}/
          </Text>
        )}
        <HearRow text={exercise.reference} />
      </Plaque>

      <View style={{ alignItems: 'center', gap: space(3) }}>
        {mic === 'silent' ? (
          <>
            {/* The SpeakControl's geometry, in the invitation state: hollow,
                white, never live-red — nothing is recording here, and the red
                circle must keep meaning "the microphone is on". */}
            <View style={ds.micCircle} accessibilityLabel="Say the line out loud">
              <MicGlyph size={28} color={enamel.white} />
              <Text style={[type.tag, { color: enamel.white, marginTop: space(1) }]}>PARLEZ · SPEAK</Text>
            </View>

            {/* Without a microphone the learner's word is the grade. Saying so
                out loud in the control's own copy keeps the report honest. */}
            <Pressable
              onPress={() => onAnswer(exercise.reference)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel="I said it"
              style={({ pressed }) => [ds.valider, ds.saidIt, pressed && { opacity: 0.85 }, locked && { opacity: 0.4 }]}
            >
              <Text style={[type.tag, { color: enamel.field }]}>JE L'AI DIT · I SAID IT</Text>
            </Pressable>
          </>
        ) : (
          /* The same geometry made real: hollow white at rest, and signal.live
             red only while the microphone is actually on — the red circle keeps
             its one meaning, here as in ConvoScreen. Tapping TERMINÉ grades
             exactly as JE L'AI DIT does; the recording only ever adds a line. */
          <Pressable
            onPress={() => void toggleRecord()}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={mic === 'live' ? "I've said it — stop recording" : 'Record yourself saying it'}
            style={({ pressed }) => [ds.micCircle, mic === 'live' && ds.micCircleLive, pressed && !locked && { opacity: 0.85 }]}
          >
            <MicGlyph size={28} color={enamel.white} />
            <Text style={[type.tag, { color: enamel.white, marginTop: space(1) }]}>
              {mic === 'live' ? 'TERMINÉ · DONE' : 'PARLEZ · SPEAK'}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onNoMic}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="I can't speak right now"
          style={({ pressed }) => [ds.noMic, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.small, { color: enamel.whiteMuted }]}>SANS MICRO · can't speak now</Text>
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
  // Grades leave this screen exactly once, whether by finishing or by SORTIE.
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
        <ActivityIndicator color={enamel.whiteMuted} />
      </View>
    );
  }

  // Built empty: nothing due right now. One calm plaque and the way out.
  if (session.finished && session.answered.length === 0) {
    return (
      <View style={[ds.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <LabeledTag fr="ENTRAÎNEMENT" en="Drills" />
        <View style={ds.centerFill}>
          <Plaque raised>
            <LabeledTag fr="RIEN À RÉVISER" en="Nothing due right now" color={enamel.whiteMuted} />
            <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(2.5) }]}>Rien à réviser.</Text>
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(2) }]}>
              Nothing due right now. Your next session adds more.
            </Text>
          </Plaque>
        </View>
        <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => [ds.done, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>SORTIE · DONE</Text>
        </Pressable>
      </View>
    );
  }

  // The end card — the one place numbers are allowed, where they have context.
  if (session.finished) {
    const s = summariseDrill(session);
    return (
      <View style={[ds.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
        <LabeledTag fr="ENTRAÎNEMENT" en="Drills" />
        <View style={ds.centerFill}>
          <Plaque raised>
            <LabeledTag fr="TERMINÉ" en="Session done" color={signal.good} />
            <View style={ds.stats}>
              <View style={ds.stat}>
                <Text style={[type.plaqueSmall, { color: enamel.white }]}>{s.total}</Text>
                <Text style={[type.tag, { color: enamel.whiteFaint, marginTop: space(1) }]}>EXERCICES · DRILLS</Text>
              </View>
              <View style={ds.stat}>
                <Text style={[type.plaqueSmall, { color: enamel.white }]}>{s.resolved}</Text>
                <Text style={[type.tag, { color: enamel.whiteFaint, marginTop: space(1) }]}>RÉUSSIS · GOT RIGHT</Text>
              </View>
              {s.typos > 0 && (
                <View style={ds.stat}>
                  <Text style={[type.plaqueSmall, { color: enamel.white }]}>{s.typos}</Text>
                  <Text style={[type.tag, { color: enamel.whiteFaint, marginTop: space(1) }]}>ORTHOGRAPHE · SPELLING SLIPS</Text>
                </View>
              )}
              {s.unresolved > 0 && (
                <View style={ds.stat}>
                  <Text style={[type.plaqueSmall, { color: enamel.white }]}>{s.unresolved}</Text>
                  <Text style={[type.tag, { color: enamel.whiteFaint, marginTop: space(1) }]}>À REVOIR · COMING BACK</Text>
                </View>
              )}
            </View>
            <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(3) }]}>
              Le carnet reprend la suite. · Your review deck takes it from here.
            </Text>
          </Plaque>
        </View>
        <Pressable onPress={leave} accessibilityRole="button" style={({ pressed }) => [ds.done, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>SORTIE · DONE</Text>
        </Pressable>
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
          <LabeledTag fr="ENTRAÎNEMENT" en="Drills" />
          {/* A sitting is an offer, not an obligation. Leaving persists what
              was answered; the rest simply stays due. Never a count up here. */}
          <Pressable
            onPress={leave}
            accessibilityRole="button"
            accessibilityLabel="Leave the drills"
            style={({ pressed }) => [ds.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.tag, { color: enamel.whiteMuted }]}>SORTIE · LEAVE</Text>
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

        {/* Reserved height, so the plaque never jumps when a line arrives. */}
        <View style={ds.feedbackArea}>
          {feedback && (
            <Text style={[type.bodyStrong, { color: verdictColor(feedback.verdict), textAlign: 'center' }]}>
              {feedback.message}
            </Text>
          )}
          {/* The scorer's whole say is this one muted line — core's focus
              reason, already learner-safe. Never a score, never a bar. */}
          {feedback && focusLine !== null && (
            <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(1.5) }]}>
              {focusLine}
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: enamel.ground, alignItems: 'center', justifyContent: 'center' },
  centerFill: { flex: 1, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  feedbackArea: { minHeight: HIT + 8, justifyContent: 'center', paddingHorizontal: space(2) },

  // The direction-plaque anatomy, for choices that are bare words.
  choice: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: enamel.fieldRaised,
    borderWidth: 2,
    borderColor: 'rgba(242,239,228,0.55)',
    borderRadius: radius.plaque,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3.5),
  },
  choicePressed: { backgroundColor: '#1B5742', borderColor: enamel.white },

  // The enamel text field. Type styles from the theme, minus lineHeight, which
  // clips single-line TextInputs on iOS.
  input: {
    minHeight: HIT + 8,
    backgroundColor: enamel.field,
    borderWidth: 2,
    borderColor: 'rgba(242,239,228,0.55)',
    borderRadius: radius.plaque,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3.5),
    color: enamel.white,
    fontFamily: font.semibold,
    fontSize: 16,
  },
  valider: {
    minHeight: HIT + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: enamel.white,
    borderRadius: radius.plaque,
  },

  answerLine: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.35)',
    borderRadius: radius.plaque,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  assembledWord: {
    minHeight: HIT - 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: enamel.fieldRaised,
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.55)',
    borderRadius: 3,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  token: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.35)',
    borderRadius: 3,
    paddingVertical: space(2),
    paddingHorizontal: space(3),
  },
  tokenUsed: { borderColor: 'rgba(242,239,228,0.14)' },

  listenButton: {
    marginTop: space(3.5),
    minHeight: HIT + 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2.5),
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },

  micCircle: {
    width: 108,
    height: 108,
    borderRadius: radius.bullet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: enamel.white,
  },
  // ConvoScreen's speakLive, verbatim: red means the microphone is on, and
  // that meaning must not drift between screens.
  micCircleLive: {
    backgroundColor: signal.live,
    borderColor: enamel.white,
    shadowColor: signal.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  saidIt: { alignSelf: 'stretch' },
  noMic: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },

  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3) },
  stat: { width: '50%', paddingVertical: space(2.5) },
  done: {
    minHeight: HIT + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
