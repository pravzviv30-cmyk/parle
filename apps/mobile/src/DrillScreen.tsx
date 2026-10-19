import { Feedback } from './motion/Feedback.tsx';
import { FocusedFieldGroup, FocusedKeyboardContext } from './layout/focusedFieldGroup.tsx';
/**
 * The drill sitting — the review deck made active.
 *
 * One exercise per screen, calm. The screen renders engine state and calls the
 * pure functions in @luvani/core/drill; every pedagogical decision (what to ask,
 * how to grade, what a miss costs) already happened there. If logic that looks
 * like grading or selection appears in this file, it is in the wrong file.
 *
 * Every answer gets its own sheet (`drill/answerSheet.ts`, F759): mint for a
 * pass, sun for a typo the drill accepted, calm white paper for a miss, with
 * no mark, sound or haptic on a miss. The living bar under the header says
 * where the learner is, never how it is going. Never a number and never a
 * scold mid-session; the end card is the one place counts are allowed, where
 * they can be given context, and every count on it is the settle's read-back.
 *
 * Leaving early is honest and cheap: every exercise answered so far grades its
 * review card on the way out, and the unanswered rest simply stay due — nothing
 * is lost, counted, or held against the learner.
 *
 * Spoken drills may also consult the pronunciation scorer, but the grade is the
 * learner's word, banked before the scorer is asked. Scoring can only ever add
 * one calm line; it has no way to slow, block, or punish.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import {
  answerCurrent,
  buildDrillSession,
  buildPracticeSession,
  decideOwnWords,
  mixQueue,
  phraseKeyOf,
  scopedOwnWordsSession,
  suppressMic,
  summariseDrill,
  type AppropriateReplyExercise,
  type BestSentenceExercise,
  type DrillExercise,
  type DrillFeedback,
  type DrillSessionState,
  type FillBlankExercise,
  type ListenTypeExercise,
  type OwnWordsExercise,
  type PracticeTarget,
  type RepeatThisExercise,
  type SettledVerdict,
  type TapTranslateExercise,
  type TranslationExercise,
  drillXp,
} from '@luvani/core';
import { HAIRLINE, HIT, colour, font, onColour, paper as basePaper, radius, space, type } from './theme.ts';
import { tapSettled } from './motion/haptics.ts';
import { useMainAppearance } from './main/MainAppearance.tsx';
import { Icon } from './icons/Icon.tsx';
import { AnimatedIcon } from './icons/AnimatedIcon.tsx';
import { OrbGlyph } from './tutor/OrbGlyph.tsx';
import { recordActivity } from './progress/activity.ts';
import { settleSitting } from './game/settle.ts';
import { useActiveClock } from './progress/useActiveClock.ts';
import { Card as BaseCard, GhostButton as BaseGhostButton, IconAction as BaseIconAction, Label as BaseLabel, OptionCard as BaseOptionCard, PillButton as BasePillButton, Press, SpeakCircle, EarGlyph, fitDisplay } from './components.tsx';
import { Screen as BaseScreen, ScrollScreen as BaseScrollScreen, ScreenHeader as BaseScreenHeader } from './layout.tsx';
import { gradeCards, loadDeck } from './review/store.ts';
import { keepPhrase as keepInPhrasebook } from './review/phraseSaved.ts';
import { AnswerSheet } from './drill/AnswerSheet.tsx';
import { ownWordsLook, sheetFor, type SheetTone } from './drill/answerSheet.ts';
import { comboAfter, comboGlows, type OwnWordsDecided } from './drill/combo.ts';
import { fireSheet } from './drill/sheetEffects.ts';
import { DRILL_END } from './drill/endCopy.ts';
import { SittingBar } from './drill/SittingBar.tsx';
import { EndCard } from './celebrate/EndCard.tsx';
import { useScreenReader } from './celebrate/useScreenReader.ts';
import { useSittingEnd } from './practice/useSittingEnd.ts';
import { LevelRing } from './motion/LevelRing.tsx';
import { useRecorderLevel } from './speech/useRecorderLevel.ts';
import { Illustration } from './art/flat/Illustration.tsx';
import { CheckGlyph } from './components.tsx';
import { loadDrillBank, getMicSuppressedUntil, setMicSuppressed } from './drill/store.ts';
import { MomentCard, type DrillMoment } from './drill/MomentCard.tsx';
import { loadTopics } from './topics/store.ts';
import { drillTitle } from './drill/title.ts';
import { DRILL_UNREAD, sittingTitle, topicGroups } from './practice/mix.ts';
import * as tutorVoice from './speech/tutorVoice.ts';
import { scoreRecordedAttempt } from './speech/scoreAttempt.ts';
import { consumeRecording, discardRecording } from './speech/discardRecording.ts';
import { transcribeRecordedAttempt } from './speech/transcribeAttempt.ts';
import { SpokenAttempt } from './drill/SpokenAttempt.tsx';
import { judgeOwnWords } from './speech/judgeAttempt.ts';
import { MADE_FROM } from './practice/madeFrom.ts';
import { hasAnsweredWork, sittingStatement } from './practice/sittingOutcome.ts';
import { PRACTICE_END, PRACTICE_HELP } from './practice/copy.ts';
import { practiceEndCard, saveStateOfResult, type SaveState } from './practice/saveState.ts';
import { completePracticeSitting, practiceOutcomes, recoverPracticeCompletion } from './practice/completion.ts';
import { clearPracticeSession, loadPracticeSession, mintSittingId, savePracticeSession } from './practice/sessionStore.ts';
import { practiceOpening } from './practice/opening.ts';
import { sittingProgress } from './practice/sittingProgress.ts';
import { queueFill, sittingFill } from './practice/sittingProgress.ts';
import { scopeGeneration } from './storage/scope.ts';
import { holdMic } from './sound/audioFocus.ts';
import { enterRecording, leaveRecording } from './sound/audioSession.ts';
import { loadConversationPacks } from './conversationPacks/store.ts';
import type { PracticeRoute } from './practice/practiceRoute.ts';
import {
  JUDGE_UNAVAILABLE,
  OWN_WORDS_ANOTHER,
  OWN_WORDS_FIELD_LABEL,
  OWN_WORDS_HINT,
  TRANSCRIPTION_UNAVAILABLE,
  OWN_WORDS_LABEL,
  OWN_WORDS_PROMPT,
  OWN_WORDS_NOT_KEPT,
} from './drill/ownWordsCopy.ts';


/** The existing exercise views share the selected main-page colours. */
type DrillPaper = { [K in keyof typeof basePaper]: string };
function useDrillPresentation() {
  const { colors } = useMainAppearance();
  const keyboardEditing = useContext(FocusedKeyboardContext);
  return useMemo(() => {
    const paper: DrillPaper = { ...basePaper, ground: colors.background, card: colors.surface, groundDeep: colors.inset, skeleton: colors.inset, ink: colors.text, inkSoft: colors.muted, inkFaint: colors.muted, line: colors.border, lineOnCard: colors.border, field: colors.muted };
    return { paper, keyboardEditing, ds: makeDrillStyles(paper, keyboardEditing) };
  }, [colors, keyboardEditing]);
}

function DrillFeedbackArea({ children, hasFeedback }: { children: React.ReactNode; hasFeedback: boolean }) {
  const { ds, keyboardEditing } = useDrillPresentation();
  // The answer remains visible while editing; a real feedback sheet keeps its slot.
  if (keyboardEditing && !hasFeedback) return null;
  return <View style={ds.feedbackArea}>{children}</View>;
}
function Card({ style, ...props }: ComponentProps<typeof BaseCard>) {
  const { paper } = useDrillPresentation();
  return <BaseCard {...props} style={[{ backgroundColor: paper.card }, style]} />;
}
function Label({ color, ...props }: ComponentProps<typeof BaseLabel>) {
  const { paper } = useDrillPresentation();
  return <BaseLabel {...props} color={color ?? paper.inkSoft} />;
}
function PillButton(props: ComponentProps<typeof BasePillButton>) {
  return <BasePillButton {...props} tone={props.tone ?? 'brand'} />;
}
function GhostButton(props: ComponentProps<typeof BaseGhostButton>) {
  const { paper } = useDrillPresentation();
  return <BaseGhostButton {...props} color={props.color ?? paper.ink} />;
}
function IconAction(props: ComponentProps<typeof BaseIconAction>) {
  const { mode, colors } = useMainAppearance();
  if (mode !== 'dark') return <BaseIconAction {...props} />;
  const color = props.disabled ? colors.muted : colors.text;
  return <Press accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? props.label} accessibilityHint={props.accessibilityHint}
    accessibilityState={{ selected: props.selected, busy: props.busy, disabled: props.disabled }} disabled={props.disabled || props.busy} onPress={props.onPress}
    style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), paddingVertical: space(2), paddingHorizontal: space(3) }}>
    {props.busy ? <AnimatedIcon kind="refresh-spin" color={color} active /> : props.icon === 'orb' ? <OrbGlyph color={color} size={20} />
      : props.animate ? <AnimatedIcon kind={props.animate} color={color} state={props.selected ? 'on' : 'off'} trigger={props.trigger} /> : <Icon name={props.icon} color={color} size={20} />}
    <Text style={[type.label, { color }]}>{props.label}</Text>
  </Press>;
}
function OptionCard({ text, gloss, onPress, selected = false, disabled = false }: ComponentProps<typeof BaseOptionCard> & { disabled?: boolean }) {
  const { colors } = useMainAppearance();
  return <Press accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: HIT, padding: space(4), gap: space(1), backgroundColor: selected ? colors.inset : colors.surface, borderColor: selected ? colors.text : colors.border, borderWidth: selected ? 2 : 1, borderRadius: radius.card }}><Text style={[type.french, { color: colors.text }]}>{text}</Text>{gloss ? <Text style={[type.small, { color: colors.muted }]}>{gloss}</Text> : null}</Press>;
}
function Screen(props: ComponentProps<typeof BaseScreen>) {
  const { colors } = useMainAppearance();
  return <BaseScreen {...props} ground={props.ground ?? colors.background} />;
}
function ScrollScreen(props: ComponentProps<typeof BaseScrollScreen>) {
  const { colors } = useMainAppearance();
  return <BaseScrollScreen {...props} ground={props.ground ?? colors.background} />;
}
function ScreenHeader(props: ComponentProps<typeof BaseScreenHeader>) {
  const { colors } = useMainAppearance();
  return <View style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(4) }}>
    {props.back && <Press accessibilityRole="button" accessibilityLabel={props.back.label ?? 'Back'} onPress={props.back.onPress} disabled={props.back.disabled} style={{ minHeight: HIT, minWidth: HIT, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={colors.text} /></Press>}
    <View style={{ flex: 1, minWidth: 0, gap: space(1) }}>{typeof props.title === 'string' ? <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>{props.title}</Text> : props.title}{props.trailing}</View>
    {props.leave && <Press accessibilityRole="button" accessibilityLabel={props.leave.accessibilityLabel ?? props.leave.label ?? 'Leave'} onPress={props.leave.onPress} style={{ minHeight: HIT, justifyContent: 'center', paddingHorizontal: space(2) }}><Text style={[type.label, { color: colors.text }]}>{props.leave.label ?? 'Leave'}</Text></Press>}
  </View>;
}

/** "Can't speak now" holds for an hour, then spoken drills quietly return. */
const MIC_SUPPRESS_MS = 60 * 60 * 1000;
/** The speak circle's size, which the level ring around it matches. */
const SPEAK = 108;
/** The usual preset, metered, so the ring follows the learner's real voice. */
const METERED_TAKE = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

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
    case 'own-words':
      return OWN_WORDS_LABEL;
  }
}

/**
 * The own-words outcome card's ground, by the same tones the answer sheet
 * uses (`drill/answerSheet.ts`): mint for "That works.", sun for "Nearly
 * there.", and the plain white card for the reveal and for a tutor nobody
 * could reach. Ink on every one; the softer line takes its ground's own soft
 * colour, because soft ink is never set on a colour.
 */
const OUTCOME_GROUND: Readonly<Record<SheetTone, { fill: string; soft: string } | null>> = {
  good: { fill: colour.mint, soft: onColour.mint },
  nearly: { fill: colour.sun, soft: onColour.sun },
  calm: null,
};

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

/**
 * A single-word option, as a chip.
 *
 * It was a full-width row with a chevron, which read as navigation: four doors
 * stacked down the screen rather than four words to choose between. Revamp A
 * draws the bare-word options as chips in the tap-translate pool's anatomy,
 * because they are the same thing: a word you put into a sentence.
 *
 * Notebook Phase 4 (2026-09-27): the chip is plain white paper under a paper
 * hairline, with no tint, and the press is an opacity step.
 */
function WordChoice({ word, onPress, locked }: { word: string; onPress: () => void; locked: boolean }) {
  const { paper, ds } = useDrillPresentation();
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={word}
      style={({ pressed }) => pressed && ds.chipPressed}
    >
      <View style={ds.choice}>
        <Text style={[type.french, { color: paper.ink }]}>{word}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The sitting's active learning clock, reached by the small input pieces below
 * without threading a prop through every exercise view. Outside a drill it is
 * inert, so nothing a piece does there is ever counted.
 */
const DrillClock = createContext<{ touch: () => void }>({ touch: () => undefined });

/** The hear-it affordance ReviewScreen uses, for hearing a French line again. */
function HearRow({ text }: { text: string }) {
  const { paper, ds } = useDrillPresentation();
  const clock = useContext(DrillClock);
  return (
    <Pressable
      onPress={() => {
        clock.touch();
        tutorVoice.speak(text);
      }}
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
  const { paper, ds } = useDrillPresentation();
  const canSubmit = typed.trim() !== '' && !locked;
  const clock = useContext(DrillClock);
  return (
    <FocusedFieldGroup style={{ gap: space(2.5) }}>{focus => <>
      <TextInput
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        value={typed}
        onChangeText={(text) => {
          clock.touch();
          onChange(text);
        }}
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
    </>}</FocusedFieldGroup>
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
  const { paper, ds } = useDrillPresentation();
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
        <View style={ds.tokenPool}>
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
  const { paper, ds } = useDrillPresentation();
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
            disabled={locked}
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
  const { paper, ds } = useDrillPresentation();
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>{kindTag(exercise)}</Label>
        <View style={{ marginTop: space(3) }}>
          <Label color={paper.ink}>{exercise.line.speaker}</Label>
          <Text style={[type.french, { color: paper.ink, marginTop: space(1.5) }]}>{exercise.line.fr}</Text>
        </View>
        <HearRow text={exercise.line.fr} />
      </Card>
      <View style={{ gap: space(2.5) }}>
        {exercise.options.map((option, i) => (
          <OptionCard
            key={option.fr}
            text={option.fr}
            disabled={locked}
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
  const { paper, ds } = useDrillPresentation();
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
              style={({ pressed }) => pressed && !used && ds.chipPressed}
            >
              <View style={[ds.token, used && ds.tokenUsed]}>
                <Text style={[type.french, { color: used ? paper.inkSoft : paper.ink }]}>{token}</Text>
              </View>
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
  const { paper, ds } = useDrillPresentation();
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
  help,
}: {
  exercise: TranslationExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
  /**
   * Help for a practice sitting only: show the known French line on request.
   * Absent for an ordinary drill, which is unchanged. `shown` is whether the
   * learner has already asked, so the line stays up after a reload.
   */
  help?: { shown: boolean; onShow: () => void };
}) {
  const { paper, ds, keyboardEditing } = useDrillPresentation();
  const isFrenchPrompt = exercise.direction === 'fr-en';
  const prompt = isFrenchPrompt ? exercise.fr : exercise.en;
  // Only an English-to-French ask hides the French, so only it has anything to
  // show. The reference is the exercise's own line, never generated.
  const canHelp = help !== undefined && !isFrenchPrompt;
  return (
    <View style={{ gap: keyboardEditing ? space(2) : space(4) }}>
      <Card style={ds.exCard}>
        {!keyboardEditing && <Label>{kindTag(exercise)}</Label>}
        <Text style={[isFrenchPrompt ? type.french : type.heading, { color: paper.ink, textAlign: 'center', marginTop: keyboardEditing ? 0 : space(4) }]}>
          {prompt}
        </Text>
        {isFrenchPrompt && <HearRow text={exercise.fr} />}
        {canHelp && help.shown && (
          <Feedback kind="help" active appear>
            <Text style={[type.french, { color: paper.inkSoft, textAlign: 'center', marginTop: space(3) }]}>{exercise.fr}</Text>
            <HearRow text={exercise.fr} />
            <Text style={[type.small, { color: paper.inkSoft }]}>With help</Text>
          </Feedback>
        )}
        {canHelp && !help.shown && (
          <View style={{ marginTop: keyboardEditing ? space(1) : space(3) }}>
            <IconAction layout="inline" icon="hint" label={PRACTICE_HELP.show} accessibilityLabel={PRACTICE_HELP.showLabel} disabled={locked} onPress={help.onShow} />
          </View>
        )}
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
  const { paper, ds } = useDrillPresentation();
  const recorder = useAudioRecorder(METERED_TAKE);
  // 'armed': the circle records on tap. 'live': the microphone is on. 'silent':
  // the platform said no — recorder missing, permission refused, or a start
  // that threw — and the honest self-report control is back in charge, because
  // refusing the microphone must cost the learner nothing.
  const [mic, setMic] = useState<'armed' | 'live' | 'silent'>(CAN_RECORD ? 'armed' : 'silent');
  // The ring around the live circle, from the recorder's real level; none is
  // drawn until a level has been heard.
  const voice = useRecorderLevel(recorder, mic === 'live');
  // The recorder's async edges must run one at a time; a double-tap cannot be
  // allowed to race prepare against stop.
  const busyRef = useRef(false);
  // The microphone focus, held from before the mode change until the take
  // ends, fails or the view goes, so no haptic or sound effect lands on it (F724).
  const micHold = useRef<(() => void) | null>(null);
  const letGoOfMic = useCallback(() => {
    const release = micHold.current;
    micHold.current = null;
    if (!release) return false;
    release();
    return true;
  }, []);
  useEffect(() => () => {
    if (letGoOfMic()) void leaveRecording().catch(() => undefined);
  }, [letGoOfMic]);

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
        letGoOfMic();
        void leaveRecording().catch(() => undefined);
        setMic('armed');
        onSpoke(uri);
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setMic('silent');
          return;
        }
        tutorVoice.stop(); // the reference playing into the microphone scores nobody
        letGoOfMic();
        micHold.current = holdMic();
        await enterRecording();
        await recorder.prepareToRecordAsync();
        recorder.record();
        setMic('live');
      }
    } catch {
      setMic('silent');
      if (letGoOfMic()) void leaveRecording().catch(() => undefined);
    } finally {
      busyRef.current = false;
    }
  }, [mic, locked, recorder, onSpoke, letGoOfMic]);

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
              <Illustration name="state-microphone" fit="small" />
              <Text style={[type.label, { color: paper.ink }]}>Speak</Text>
            </View>

            {/* Without a microphone the learner's word is the grade. Saying so
                out loud in the control's own copy keeps the report honest. */}
            <View style={ds.saidIt}>
              <PillButton label="Type instead" onPress={onNoMic} disabled={locked} />
              <IconAction layout="inline" icon="tick-circle" label="I said it" onPress={() => onAnswer(exercise.reference)} disabled={locked} />
            </View>
          </>
        ) : (
          /* The one speak control made real: hollow at rest, and filled green
             only while the microphone is actually on. Green means you speak,
             here as in ConvoScreen; red belongs to the tutor's own voice and
             never marks the learner's microphone. Tapping Done grades exactly
             as I said it does; the recording only ever adds a line. */
          <View style={ds.speakBlock}>
            <View style={ds.speakCircle}>
              {mic === 'live' && voice.metered && (
                <View style={ds.speakRing}>
                  <LevelRing level={voice.level} size={SPEAK} color={colour.mint} />
                </View>
              )}
              <SpeakCircle
                onPress={() => void toggleRecord()}
                active={mic === 'live'}
                disabled={locked}
                size={SPEAK}
                accessibilityLabel={mic === 'live' ? 'Stop recording' : 'Record yourself saying it'}
              />
            </View>
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

/**
 * What one own-words attempt came back with.
 *
 * Held as a value rather than as the timed feedback beat every other kind
 * uses, because there is more to read here than a word: a second way to say
 * it, or the judge's own sentence, or the line itself when nobody could read
 * the attempt. A 1.6 second beat would take all three away mid-sentence.
 */
interface OwnWordsOutcome {
  /** The exercise it belongs to, so the card survives the sitting finishing. */
  exercise: OwnWordsExercise;
  /** Core's settled verdict, or null when nobody judged it and nothing moved. */
  verdict: SettledVerdict | null;
  /** How core decided it, which sets the card's tone; null when nobody judged it. */
  decided: OwnWordsDecided | null;
  /** Core's own feedback line, or the line that says the tutor is unreachable. */
  message: string;
  /** The judge's sentence, before a second go. */
  note: string | null;
  /** A better way, offered after a success and never instead of one. */
  another: string | null;
  /** The taught line, when the attempt is let go or nobody could read it. */
  reveal: string | null;
  /** They said it their own way: offer to keep the phrase. */
  keep: boolean;
  /** The learner's checked words, held only on this screen for comparison. */
  attempt: string | null;
}

/**
 * Say it your own way.
 *
 * The one drill kind with no right string. The situation sets the scene, the
 * English says what has to get across, and the field takes whatever French the
 * learner has. A temporary take can supply editable text. Checking meaning
 * still uses the text judge, and never claims a pronunciation score.
 *
 * It borrows `TypedAnswer` rather than growing a field of its own, which is
 * also what keeps the drill's Check at exactly two shared pills.
 */
function OwnWordsView({
  exercise,
  typed,
  onChange,
  onCheck,
  onTake,
  quiet = false,
  busy,
  outcome,
  onKeep,
  keeping,
  kept,
  keepFailed,
}: {
  exercise: OwnWordsExercise;
  typed: string;
  onChange: (t: string) => void;
  onCheck: () => void;
  onTake: (uri: string | null) => void;
  quiet?: boolean;
  /** A judge is reading it. The field and the pill are off until it answers. */
  busy: boolean;
  outcome: OwnWordsOutcome | null;
  onKeep: () => void;
  keeping: boolean;
  /** The phrasebook said its write is durable. Only then is it called saved. */
  kept: boolean;
  /** The last keep was refused; it can be tried again. */
  keepFailed: boolean;
}) {
  const { paper, ds } = useDrillPresentation();
  const [typing, setTyping] = useState(!CAN_RECORD || quiet);
  const typeInstead = useCallback(() => setTyping(true), []);
  const look = ownWordsLook(outcome?.decided ?? null);
  const { colors, mode } = useMainAppearance();
  const authoredGround = look.tone === null ? null : OUTCOME_GROUND[look.tone];
  const ground = authoredGround !== null && mode === 'dark' ? { fill: look.tone === 'good' ? colors.teal : colors.ochre, soft: colors.muted } : authoredGround;
  const soft = ground === null ? paper.inkSoft : ground.soft;
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.promptCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{exercise.situation}</Text>
        <Text style={[type.title, { color: paper.ink, marginTop: space(5), marginBottom: space(5) }]}>{exercise.en}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{OWN_WORDS_HINT}</Text>
      </Card>
      {!typing && typed === '' && outcome === null && <SpokenAttempt onTake={onTake} onTyping={typeInstead} busy={busy} />}
      {(typing || typed !== '' || outcome !== null) && <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={onCheck}
        locked={busy}
        placeholder={OWN_WORDS_PROMPT}
        accessibilityLabel={OWN_WORDS_FIELD_LABEL}
      />}
      {busy && <ActivityIndicator color={paper.inkSoft} />}
      {outcome !== null && (
        <Card style={[ds.outcome, ground !== null && { backgroundColor: ground.fill }]}>
          {outcome.attempt !== null && <View style={{ gap: space(1) }}>
            <Label color={soft}>Your words</Label>
            <Text style={[type.body, { color: paper.ink }]}>{outcome.attempt}</Text>
          </View>}
          <View style={ds.outcomeRow} accessibilityLiveRegion="polite">
            {/* Same rule as the answer sheet: no mark on a miss, and a retry
                is not a pass. A drawing scolds louder than a word, and this
                card is read for longer. */}
            {look.mark && (
              <View style={ds.verdictMark}><CheckGlyph size={18} color={paper.ink} /></View>
            )}
            <Text style={[type.bodyStrong, { color: paper.ink, flex: 1 }]}>
              {outcome.message}
            </Text>
          </View>
          {outcome.note !== null && <Text style={[type.body, { color: paper.ink }]}>{outcome.note}</Text>}
          {outcome.another !== null && (
            <Text style={[type.body, { color: paper.ink }]}>{OWN_WORDS_ANOTHER(outcome.another)}</Text>
          )}
          {outcome.reveal !== null && <Text style={[type.french, { color: paper.ink }]}>{outcome.reveal}</Text>}
          {/* Kept means the phrasebook's write came back durable, and only
              then does the bookmark fill and the label say so (F762). A
              refused write says it plainly and leaves the way to try again. */}
          {outcome.keep && (
            <IconAction
              layout="inline"
              ground={look.tone === 'good' ? 'mint' : 'paper'}
              icon="bookmark"
              animate="bookmark-fill"
              selected={kept}
              busy={keeping}
              label={kept ? MADE_FROM.phrase.saved : MADE_FROM.phrase.save}
              onPress={onKeep}
            />
          )}
          {outcome.keep && keepFailed && !kept && (
            <Text accessibilityLiveRegion="polite" style={[type.small, { color: soft }]}>{OWN_WORDS_NOT_KEPT}</Text>
          )}
        </Card>
      )}
    </View>
  );
}

/**
 * A finish with no end card to celebrate it is still felt: one settled tap,
 * once, as every finished drill was before end cards. The end card gives its
 * own `celebrate()` when the settle read the sitting back, so the two never
 * both play for one finish. Draws nothing.
 */
function FinishFelt() {
  useEffect(() => {
    tapSettled();
  }, []);
  return null;
}

// ───────────────────────────────────────────────────────────────── the screen

export function DrillScreen({
  userId,
  onDone,
  node,
  mix = false,
  onFinished,
  practice,
  onPracticeFinished,
}: {
  userId: string;
  onDone: () => void;
  /**
   * A practice-now sitting: chosen targets, not the due deck. Absent, this is
   * the ordinary scheduled sitting and nothing below changes for it.
   */
  practice?: PracticeRoute | 'invalid';
  /**
   * A practice sitting with answered work, persisted. Named with the pack it
   * practised when one of its own targets was answered, else null.
   */
  onPracticeFinished?: (packId: string | null) => void;
  /**
   * The sitting finished, as distinct from Done: Done also fires on Leave, and
   * a pack must not be marked practised by a sitting that was abandoned (F550).
   */
  onFinished?: (nodeId: string) => void;
  /**
   * One node of the practice path. Omitted, the whole deck plays, which is
   * what "Start practice" has always done and still does.
   */
  node?: {
    id: string;
    title: string;
    phraseKeys: readonly string[];
    moment?: DrillMoment;
    /**
     * Ask for the phrase in the learner's own words instead of dealing the
     * bank. Authored here rather than generated: this kind has no right
     * string, so there is nothing for the generator to have written down.
     */
    ownWords?: { fr: string; en: string; situation: string };
  };
  /**
   * Today's mix: the same unscoped sitting, reordered so it moves between
   * topics instead of playing one conversation's worth and then the next.
   * Order only. Who plays is still buildDrillSession's decision alone.
   */
  mix?: boolean;
}) {
  const { paper, ds } = useDrillPresentation();
  // The sitting. Null while the deck and bank load.
  const [session, setSession] = useState<DrillSessionState | null>(null);
  // The line on the floor. While one shows, inputs are locked and the next
  // state waits in pendingRef; the beat ends and the queue's head deals.
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const pendingRef = useRef<DrillSessionState | null>(null);
  // What the answer sheet needs beside core's feedback: the kind it answered,
  // the run of real passes after it, and its place in the sitting, which the
  // good lines rotate by. Set with the feedback and cleared with it.
  const [sheetFacts, setSheetFacts] = useState<{ kind: DrillExercise['kind']; combo: number; turn: number } | null>(null);
  // The run of real passes (drill/combo.ts): a ref for the answer that reads it
  // and state for the bar that glows by it. Never a number on screen.
  const comboRef = useRef(0);
  const [combo, setCombo] = useState(0);
  // A screen reader decides its own pace: with one on, or not yet known to be
  // off, no sheet moves on by itself.
  const screenReader = useScreenReader();
  // The finished sitting's end card waits for the settle pipeline's own delta.
  // While this screen is up the celebration queue is held, and the hold taken
  // before the sitting settles is handed to its end card (F766).
  const { end, holdForSettle, expect, dropSettleHold, release } = useSittingEnd();
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
  // Active learning time (Practice time): only the gaps between the learner's
  // own actions that are short enough to be one stretch of work. Opening the
  // sitting adds nothing, and a resume carries its saved total with no anchor,
  // so the time away is never credited. Never derived from openedAt.
  const clock = useActiveClock('drill');

  // Per-exercise input state, cleared on every advance.
  const [typed, setTyped] = useState('');
  const [assembled, setAssembled] = useState<number[]>([]);

  // The own-words side of the sitting: what a judge said about the last
  // attempt, whether one is being read right now, and whether the phrase has
  // been kept. Separate from `feedback` because this card is read, not flashed.
  const [ownWords, setOwnWords] = useState<OwnWordsOutcome | null>(null);
  const [judging, setJudging] = useState(false);
  const attemptBusy = useRef(false);
  const attemptAlive = useRef(true);
  useEffect(() => { attemptAlive.current = true; return () => { attemptAlive.current = false; }; }, []);
  const [keeping, setKeeping] = useState(false);
  const [kept, setKept] = useState(false);
  const [keepFailed, setKeepFailed] = useState(false);

  // The sitting could not be read. Told, rather than shown as a spinner that
  // never resolves.
  const [unread, setUnread] = useState(false);

  // A practice sitting's identity and plan: its stable sitting id, when it
  // started, where it came from, its resolved targets, every exercise it has
  // played (twins as played, and those answered before a reload), and whether
  // the French was just shown. Held in a ref because saving and completion read
  // it after the render that built it, and none of it changes mid-sitting.
  const practiceRef = useRef<{
    sittingId: string;
    startedAt: number;
    origin: 'recommended' | 'pack';
    packId: string | null;
    targets: PracticeTarget[];
    exercises: DrillExercise[];
    exposed: boolean;
    /** The account this sitting belongs to; a save or completion for another is refused. */
    scope: number;
  } | null>(null);
  // A practice sitting's end card waits for completion to answer, and then says
  // exactly what its status supports.
  const [practiceSaved, setPracticeSaved] = useState<'waiting' | SaveState>('waiting');
  const [practiceRetrying, setPracticeRetrying] = useState(false);
  const completionRef = useRef<Promise<SaveState> | null>(null);
  // A resume that has nothing to open. 'none': no unfinished sitting is saved
  // (it was already finished, or never started). 'gone': one was saved but its
  // exercises are no longer on this phone, so it is cleared. Either way it is
  // said plainly, and never replaced by a sitting the learner did not start.
  const [cannotResume, setCannotResume] = useState<'none' | 'gone' | null>(null);
  // Whether this sitting went quiet, known rather than inferred: set where the
  // screen applies `suppressMic`, and carried by the resume record.
  const micSuppressedRef = useRef(false);
  // Exercises where the learner asked to see the phrase. Kept in state for the
  // render and in a ref for the saves, restored from the resume record, and
  // handed to completion, which never lets one become recall or a spaced
  // return. Only ever added to: help once asked for stays asked for.
  const [assisted, setAssisted] = useState<string[]>([]);
  const assistedRef = useRef<string[]>([]);

  useEffect(() => {
    if (practice === undefined || practice === 'invalid') return;
    let cancelled = false;
    const scope = scopeGeneration();
    // A completion a previous launch left half-done lands first, so the saved
    // sitting this reads is never one whose grades are still in flight.
    void recoverPracticeCompletion()
      .catch(() => null)
      .then(() => Promise.all([loadDeck(), loadDrillBank(), getMicSuppressedUntil(), loadConversationPacks(), loadPracticeSession()]))
      .then(([deck, bank, until, packs, record]) => {
        if (cancelled || scopeGeneration() !== scope) return;
        const now = Date.now();
        const opening = practiceOpening({ route: practice, record, deck, bank, packs, now });
        if (opening.kind === 'cannot-resume') {
          if (opening.sittingId !== null) void clearPracticeSession(opening.sittingId);
          setCannotResume(opening.sittingId === null ? 'none' : 'gone');
          return;
        }
        if (opening.kind === 'resume') {
          // The same sitting, from the record: its id, targets, answers, queue
          // position and warm-up flag. Nothing is re-graded: completion is keyed
          // on this id, and answers already settled are carried, not replayed.
          const { record: held, restored, answeredExercises } = opening;
          practiceRef.current = {
            sittingId: held.sittingId,
            startedAt: held.startedAt,
            origin: held.origin === 'pack' ? 'pack' : 'recommended',
            packId: held.packId,
            targets: restored.targets,
            exercises: [...answeredExercises, ...restored.state.queue],
            exposed: held.exposed,
            scope,
          };
          openedAt.current = held.startedAt;
          clock.restore(held.activeMs ?? 0);
          micSuppressedRef.current = held.micSuppressed;
          assistedRef.current = [...held.assisted];
          setAssisted([...held.assisted]);
          setSession(restored.state);
          return;
        }
        const built = buildPracticeSession(opening.targets, bank, deck, now);
        const origin = practice.origin === 'pack' ? 'pack' : 'recommended';
        practiceRef.current = {
          sittingId: mintSittingId(now),
          startedAt: now,
          origin,
          packId: origin === 'pack' ? practice.packId : null,
          targets: built.targets,
          exercises: [...built.state.queue],
          exposed: practice.exposed,
          scope,
        };
        let state = built.state;
        if (until !== null && Date.parse(until) > now) {
          state = suppressMic(state);
          micSuppressedRef.current = true;
        } else if (until !== null) void setMicSuppressed(null);
        setSession(state);
      })
      .catch(() => {
        if (!cancelled) setUnread(true);
      });
    return () => {
      cancelled = true;
      tutorVoice.stop();
    };
  }, [practice, clock]);

  /**
   * Save the unfinished sitting: ids and settled facts only, no grade, no XP.
   * Called after every settled answer (a miss that will come round again
   * included) and on Leave, so a reload resumes the same queue and answers.
   * A write for an account that has since changed is refused by the store.
   */
  const savePractice = useCallback((state: DrillSessionState) => {
    const held = practiceRef.current;
    if (held === null || scopeGeneration() !== held.scope) return;
    for (const exercise of state.queue) if (!held.exercises.some((e) => e.id === exercise.id)) held.exercises.push(exercise);
    void savePracticeSession({
      sittingId: held.sittingId,
      startedAt: held.startedAt,
      origin: held.origin,
      packId: held.packId,
      exposed: held.exposed,
      micSuppressed: micSuppressedRef.current,
      targets: held.targets,
      state,
      assisted: assistedRef.current,
      activeMs: clock.read(),
    });
  }, [clock]);

  /**
   * Finish the sitting through `completePracticeSitting`, and nothing else:
   * it alone grades, earns XP, records history and clears the resume record,
   * at most once per sitting id. Safe to call again for a retry. The end card
   * shows exactly what its status supports.
   */
  const finishPractice = useCallback((state: DrillSessionState): Promise<SaveState> => {
    const held = practiceRef.current;
    if (held === null) return Promise.resolve('not-saved');
    const now = Date.now();
    // The plan settles inside completion, which publishes before the end card
    // can mount: the queue is held first, and let go if nothing settled.
    holdForSettle();
    const run = completePracticeSitting({
      sittingId: held.sittingId,
      state,
      targets: held.targets,
      exercises: held.exercises,
      exposed: held.exposed,
      assisted: assistedRef.current,
      durationMs: Math.max(0, now - held.startedAt),
      activeMs: clock.read(),
      now,
    })
      // A plan this call completed settled at its frozen instant; the end card
      // waits for exactly that sitting's delta, never a number worked out here.
      .then((done) => {
        if (done.settlesAt !== null) expect({ source: 'drill', at: done.settlesAt });
        else dropSettleHold();
        return done;
      })
      .then((done) => saveStateOfResult(done))
      .catch((): SaveState => {
        dropSettleHold();
        return 'not-saved';
      });
    completionRef.current = run;
    return run;
  }, [clock, holdForSettle, expect, dropSettleHold]);

  useEffect(() => {
    // A practice sitting is built by the effect above and never by this one.
    if (practice !== undefined) return;
    let cancelled = false;
    const asked = node?.ownWords;
    if (node !== undefined && asked !== undefined) {
      // One exercise, authored on the spot from the phrase the row carried.
      // No deck read and no bank read: an own-words sitting asks for something
      // the learner has never been drilled on, so there is nothing to look up.
      const key = node.phraseKeys[0] ?? phraseKeyOf(asked.fr);
      setSession(scopedOwnWordsSession({ fr: asked.fr, en: asked.en, key }, asked.situation, Date.now()));
      return () => {
        cancelled = true;
        tutorVoice.stop();
      };
    }
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
          micSuppressedRef.current = true;
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
  }, [node, mix, practice]);

  /**
   * Feed outcomes to the one memory system, through the review store's own
   * write path: each drilled phrase's key IS its review card's id, so
   * `gradeCard` applies exactly the reschedule `applyDrillResults` describes,
   * on the store's serialized chain. Answered exercises only — the unanswered
   * rest simply stay due.
   */
  const persistGrades = useCallback((state: DrillSessionState) => {
    if (persistedRef.current) return;
    const held = practiceRef.current;
    if (held !== null) {
      // A practice sitting that is not finished is saved, never graded: Leave
      // keeps the queue and the answers for resume, and awards nothing. Only a
      // finished sitting with answered work completes, through the one owner of
      // practice grades, XP and history.
      if (!state.finished) {
        savePractice(state);
        return;
      }
      if (!hasAnsweredWork(state)) return;
      persistedRef.current = true;
      const completion = finishPractice(state);
      gradeWritesRef.current = completion.then(() => undefined);
      return;
    }
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
    const xp = drillXp({ clean: summary.resolved - summary.typos, typoCorrected: summary.typos });
    const endedAt = Date.now();
    const activeMs = clock.read();
    // Only a set worked to its end says it finished, and only that settles
    // (F744); one left from the header banks what it earned and nothing more.
    const bank = () => recordActivity(
      'drill',
      xp,
      endedAt,
      { durationMs: endedAt - openedAt.current, activeMs: activeMs, ...(state.finished ? { finished: true } : {}) },
    );
    // The end card waits for this sitting's delta, read back by the settle,
    // and the queue is held from before the settle until that card goes.
    if (state.finished) expect({ source: 'drill', at: endedAt });
    if (state.finished) void settleSitting({ source: 'drill', at: endedAt, xpEarned: xp, activeMs, write: bank });
    else void bank();
  }, [savePractice, finishPractice, clock, expect]);

  const answer = useCallback(
    (value: string | number) => {
      if (!session || session.finished || feedback) return;
      const current = session.queue[0];
      if (!current) return;
      clock.touch();
      const { state: next, feedback: fb } = answerCurrent(session, value);
      if (!fb) return;
      tutorVoice.stop();
      pendingRef.current = next;
      // Saved the moment it settles, not after the feedback beat: a reload in
      // the beat must not lose an answer the learner already gave, a miss that
      // will come round again included. A finished sitting completes instead.
      if (!next.finished) savePractice(next);
      setFeedback(fb);
      const facts = { kind: current.kind, combo: comboAfter(comboRef.current, fb.verdict, current.kind), turn: session.answered.length };
      comboRef.current = facts.combo;
      setCombo(facts.combo);
      setSheetFacts(facts);
      // The sheet's one sound and haptic, now, from the tap that answered: a
      // pass `correct` and `arrived()`, a typo `nearly` and `soft()`, a miss
      // nothing. The seams stay silent while a microphone or a voice holds on.
      fireSheet(sheetFor({ verdict: fb.verdict, closest: fb.closest, advanced: fb.advanced, ...facts, screenReader }));
    },
    [session, feedback, savePractice, clock, screenReader],
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

  /**
   * Check one own-words attempt.
   *
   * The only place in this screen where an outcome comes from outside, and the
   * three rules that make that safe are all here.
   *
   * The judge is asked exactly once per Check: `judging` closes the door for
   * the round trip, so a double tap, a return key and a tapped pill together
   * are still one call and one grade.
   *
   * A null verdict is the tutor being unreachable, never a miss. Nothing is
   * handed to `answerCurrent`, so the queue does not move, nothing is recorded
   * as answered, and the summary this screen persists has nothing in it. The
   * learner is shown the line and leaves with their card exactly as it was.
   *
   * And the attempt itself goes no further than the request. It is not put in
   * state that outlives the beat, not written to the deck, and not carried
   * into the summary: core records an id, a phrase key and an outcome.
   */
  const checkOwnWords = useCallback(() => {
    if (!session || session.finished || judging || attemptBusy.current) return;
    const current = session.queue[0];
    if (!current || current.kind !== 'own-words') return;
    const attempt = typed.trim();
    if (attempt === '') return;
    clock.touch();
    const owner = scopeGeneration();
    const beat = beatRef.current;
    attemptBusy.current = true;
    setJudging(true);
    void judgeOwnWords(userId, current, attempt, owner).then((verdict) => {
      attemptBusy.current = false;
      if (!attemptAlive.current || owner !== scopeGeneration() || beat !== beatRef.current) return;
      setJudging(false);
      if (verdict === null) {
        setOwnWords({
          exercise: current,
          verdict: null,
          decided: null,
          message: JUDGE_UNAVAILABLE,
          note: null,
          another: null,
          reveal: current.fr,
          keep: false,
          attempt,
        });
        return;
      }
      // The model observed; this decides. `decideOwnWords` is core's, and the
      // miss count it reads is the same one every other kind is bounded by.
      const decided = decideOwnWords(verdict, session.missesById[current.id] ?? 0);
      const { state: next, feedback: fb } = answerCurrent(session, attempt, decided);
      if (!fb) return;
      // The line and its tone are keyed on the decision (core's
      // ownWordsFeedback): "That works.", "Nearly there." in the nearly tone
      // (D21), or the calm reveal.
      const look = ownWordsLook(decided);
      setOwnWords({
        exercise: current,
        verdict: fb.verdict,
        decided,
        message: look.headline ?? fb.message,
        note: decided === 'retry' ? verdict.note : null,
        another: decided === 'good' ? verdict.betterLine : null,
        reveal: decided === 'reveal' ? current.fr : null,
        keep: decided === 'good',
        attempt,
      });
      comboRef.current = comboAfter(comboRef.current, fb.verdict, 'own-words', decided);
      setCombo(comboRef.current);
      fireSheet(look);
      setTyped('');
      if (next.finished) persistGrades(next);
      else savePractice(next);
      setSession(next);
    });
  }, [session, judging, typed, userId, persistGrades, savePractice, clock]);

  const recordOwnWords = useCallback((uri: string | null) => {
    if (attemptBusy.current || !session || session.finished || session.queue[0]?.kind !== 'own-words') return discardRecording(uri);
    const owner = scopeGeneration();
    const exercise = session.queue[0];
    const beat = beatRef.current;
    attemptBusy.current = true;
    setJudging(true);
    void consumeRecording(uri, path => transcribeRecordedAttempt(userId, path, owner)).then(transcript => {
      if (!attemptAlive.current || owner !== scopeGeneration() || beat !== beatRef.current) return;
      if (transcript !== null) setTyped(transcript);
      else setOwnWords({ exercise, verdict: null, decided: null, message: TRANSCRIPTION_UNAVAILABLE, note: null, another: null, reveal: null, keep: false, attempt: null });
    }).catch(() => {
      if (attemptAlive.current && owner === scopeGeneration() && beat === beatRef.current) setOwnWords({ exercise, verdict: null, decided: null, message: TRANSCRIPTION_UNAVAILABLE, note: null, another: null, reveal: null, keep: false, attempt: null });
    }).finally(() => {
      attemptBusy.current = false;
      if (attemptAlive.current && owner === scopeGeneration() && beat === beatRef.current) setJudging(false);
    });
  }, [session, userId]);

  /**
   * Keep the phrase they just said their own way. The one write this card
   * makes, and it is called saved only when the phrasebook answers durable:
   * then the bookmark fills, the label says so and the saved moment is handed
   * to the host (`review/phraseSaved.ts`). A refused write says so and can be
   * tried again (F762).
   */
  const keepPhrase = useCallback(
    (exercise: OwnWordsExercise) => {
      if (keeping || kept) return;
      setKeeping(true);
      setKeepFailed(false);
      void keepInPhrasebook({ fr: exercise.fr, frWritten: null, en: exercise.en, enLiteral: null, register: 'courant', note: null })
        .then((saved) => {
          if (!attemptAlive.current) return;
          if (saved) setKept(true);
          else setKeepFailed(true);
        })
        .finally(() => {
          if (attemptAlive.current) setKeeping(false);
        });
    },
    [keeping, kept],
  );

  // The sheet on screen, from core's feedback and the facts beside it. A
  // screen reader that turns on mid-sheet stops it moving on by itself.
  const sheet = feedback !== null && sheetFacts !== null
    ? sheetFor({ verdict: feedback.verdict, closest: feedback.closest, advanced: feedback.advanced, ...sheetFacts, screenReader })
    : null;

  /**
   * Leave the sheet and deal the next exercise. A missed exercise is already at
   * the back of the queue and comes round unannounced. Called once per sheet,
   * by its Continue, a tap on it, or its timer, whichever is first.
   */
  const advance = useCallback(() => {
    const next = pendingRef.current;
    if (next === null) return;
    pendingRef.current = null;
    beatRef.current += 1;
    setFeedback(null);
    setSheetFacts(null);
    setFocusLine(null);
    setTyped('');
    setAssembled([]);
    if (next.finished) persistGrades(next);
    setSession(next);
  }, [persistGrades]);

  // A sheet that moves on by itself does so after its own time. A focus line
  // landing mid-sheet restarts the clock, so the one sentence the scorer gets
  // to say also gets a full beat to be read. A sheet that waits has no timer.
  const autoAdvanceMs = sheet?.autoAdvanceMs ?? null;
  useEffect(() => {
    if (!feedback || autoAdvanceMs === null) return;
    const t = setTimeout(advance, autoAdvanceMs);
    return () => clearTimeout(t);
  }, [feedback, focusLine, autoAdvanceMs, advance]);

  /**
   * Leave, once this sitting is actually on disk.
   *
   * The wait matters because the screen behind this one re-reads the deck the
   * moment it regains focus, and `loadDeck` bypasses the review store's write
   * chain. Navigating first meant the practice map could show a node that had
   * plainly just been finished as untouched.
   */
  //
  // Core builds an empty queue already finished. That is nothing answered, and
  // nothing answered is not a sitting that marks a pack practised, so the
  // signal also waits for answered work. The finish itself is felt on the end
  // card, which gives one celebrate() once its numbers are read back.
  useEffect(() => {
    if (!session?.finished || !node || finishedRef.current) return;
    if (!hasAnsweredWork(session)) return;
    finishedRef.current = true;
    onFinished?.(node.id);
  }, [session, node, onFinished]);

  // A practice sitting says it finished only once its writes have come back,
  // and only with answered work behind it. The pack it names is the one its
  // own answered targets came from; review alone names none.
  useEffect(() => {
    const held = practiceRef.current;
    if (!session?.finished || held === null || finishedRef.current) return;
    if (!hasAnsweredWork(session)) return;
    finishedRef.current = true;
    const answeredKeys = new Set(session.answered.map((a) => a.phraseKey));
    const packTarget = held.targets.find((t) => t.source.kind === 'pack' && answeredKeys.has(t.phraseKey));
    const packId = packTarget !== undefined && packTarget.source.kind === 'pack' ? packTarget.source.packId : null;
    const written = completionRef.current;
    if (written === null) return;
    void written.then((saved) => {
      setPracticeSaved(saved);
      // The phone-only mark follows only a completion that is safe on this
      // phone: saved, or kept to finish later. Never one that was not saved.
      if (saved === 'not-saved') return;
      onPracticeFinished?.(packId);
    });
  }, [session, onPracticeFinished]);

  /**
   * Try the completion again, for the same sitting id. The store replays a
   * frozen plan rather than recomputing it, so nothing is awarded twice.
   */
  const retryPractice = useCallback(() => {
    if (!session || practiceRetrying) return;
    setPracticeRetrying(true);
    void finishPractice(session)
      .then((saved) => {
        setPracticeSaved(saved);
        const held = practiceRef.current;
        if (saved === 'not-saved' || held === null) return;
        const answeredKeys = new Set(session.answered.map((a) => a.phraseKey));
        const packTarget = held.targets.find((t) => t.source.kind === 'pack' && answeredKeys.has(t.phraseKey));
        onPracticeFinished?.(packTarget !== undefined && packTarget.source.kind === 'pack' ? packTarget.source.packId : null);
      })
      .finally(() => setPracticeRetrying(false));
  }, [session, practiceRetrying, finishPractice, onPracticeFinished]);

  const finishAndLeave = useCallback(() => {
    tutorVoice.stop();
    // Mid-beat, the answered exercise lives in pendingRef; count it.
    const state = pendingRef.current ?? session;
    if (state) persistGrades(state);
    void gradeWritesRef.current.finally(onDone);
  }, [session, persistGrades, onDone]);

  const leave = finishAndLeave;

  /**
   * Show the phrase for a practice exercise. The learner has now seen the
   * answer, so the exercise is recorded as assisted and saved at once, before
   * they answer: a reload keeps the line on screen and keeps the mark, and
   * completion reads it, so a right answer after help is practised, never
   * recalled, and never a spaced return.
   */
  const showPhrase = useCallback(
    (exerciseId: string) => {
      if (!session || feedback || assistedRef.current.includes(exerciseId)) return;
      clock.touch();
      assistedRef.current = [...assistedRef.current, exerciseId];
      setAssisted(assistedRef.current);
      savePractice(session);
    },
    [session, feedback, savePractice, clock],
  );

  const goSilent = useCallback(() => {
    if (!session || feedback) return;
    const quiet = suppressMic(session);
    setSession(quiet);
    setTyped('');
    setAssembled([]);
    void setMicSuppressed(new Date(Date.now() + MIC_SUPPRESS_MS).toISOString());
    // A practice sitting that went quiet resumes quiet, on its twins' ids.
    micSuppressedRef.current = true;
    savePractice(quiet);
  }, [session, feedback, savePractice]);

  // What this sitting calls itself. A learner who opened Today's mix and landed
  // on a screen headed "Drills" would have no way to tell the two apart.
  const heading = sittingTitle({ mix });

  // A sitting is an offer, not an obligation. Leaving persists what was
  // answered; the rest simply stays due. Never a count up here. Built once
  // and used by both branches below, because a pushed screen shows exactly
  // one way back and it is this one.
  // Where the learner is in a bounded practice sitting, in words, in the
  // header's quiet centre slot: never a score, a fraction or a bar, and never
  // drawn for an ordinary review sitting, whose queue is not bounded this way.
  const progress = practice !== undefined && practiceRef.current !== null ? sittingProgress(session, practiceRef.current.targets) : null;
  // The living bar: position only, never a digit, filled by phrases settled.
  // During a sheet it reads the state the answer just made, so the bar moves
  // with the answer rather than after it.
  const placed = pendingRef.current ?? session;
  const fill = practice !== undefined && practiceRef.current !== null ? sittingFill(placed, practiceRef.current.targets) : queueFill(placed);
  const header = (
    <ScreenHeader
      leave={{ onPress: leave, label: 'Leave', accessibilityLabel: 'Leave the drills' }}
      title={session?.queue[0]?.kind ? drillTitle(session.queue[0].kind) : heading}
      trailing={progress !== null ? (
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{progress.label}</Text>
      ) : undefined}
    />
  );
  // The one door on every terminal card, built once for the same reason as
  // the header: each terminal branch shows exactly one way out, and it is this
  // one. `finishAndLeave` and `leave` are the same callback.
  const doneFooter = <PillButton label="Done" onPress={finishAndLeave} />;

  /**
   * An own-words sitting that has been answered, still holding its outcome.
   *
   * It is drawn instead of the end card, and that is the point: a card of
   * counts would take away the better way to say it a second after it arrived,
   * and counts are not what this kind proves anyway. The way out is the
   * header's Leave, which persists the grade exactly as finishing does.
   */
  const holding = session !== null && session.finished && ownWords !== null ? ownWords : null;

  // A resume with nothing to open. The two reasons read differently, because
  // only one of them is about phrases being gone.
  if (cannotResume !== null) {
    const copy = cannotResume === 'none'
      ? { title: PRACTICE_END.nothingToResume, body: PRACTICE_END.nothingToResumeBody }
      : { title: PRACTICE_END.cannotResume, body: PRACTICE_END.cannotResumeBody };
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>{copy.title}</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{copy.body}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  // A practice link that could not be read: a reload of an old address, or one
  // typed by hand. Said plainly, and never opened as a different sitting.
  if (practice === 'invalid') {
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>{PRACTICE_END.unreadable}</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{PRACTICE_END.unreadableBody}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  if (unread) {
    return (
      <ScrollScreen footer={doneFooter}>
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

  if (holding !== null) {
    return (
      <DrillClock.Provider value={clock}>
      <ScrollScreen avoidKeyboard header={header}>
        <OwnWordsView
          key={holding.exercise.id}
          exercise={holding.exercise}
          typed={typed}
          onChange={setTyped}
          onCheck={checkOwnWords}
          onTake={recordOwnWords}
          quiet={micSuppressedRef.current}
          busy={judging}
          outcome={holding}
          onKeep={() => keepPhrase(holding.exercise)}
          keeping={keeping}
          kept={kept}
          keepFailed={keepFailed}
        />
      </ScrollScreen>
      </DrillClock.Provider>
    );
  }

  // A practice sitting with nothing playable. Said as a fact with a real way
  // forward, never as a finish: nothing was answered, so nothing is recorded.
  if (practice !== undefined && session.finished && !hasAnsweredWork(session)) {
    return (
      <ScrollScreen footer={doneFooter}>
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>{PRACTICE_END.empty}</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{PRACTICE_END.emptyBody}</Text>
        </Card>
      </ScrollScreen>
    );
  }

  // A finished practice sitting. It waits for its grades to come back before it
  // says anything, and then says only what the outcomes support. A plan this
  // screen completed also waits, briefly, for the settle to read the sitting
  // back, so the end card's numbers arrive with the card and never after it.
  // The wait is drawn inside the screen with its Done, so there is a way out
  // while it lasts (F775).
  if (practice !== undefined && session.finished) {
    const held = practiceRef.current;
    if (practiceSaved === 'waiting' || held === null || end.state === 'waiting') {
      return (
        <ScrollScreen footer={doneFooter}>
          <View style={ds.ending}>
            <ActivityIndicator color={paper.inkSoft} />
          </View>
        </ScrollScreen>
      );
    }
    // What the sitting showed, read by the data store's own rule, so the card
    // and the history can never disagree about a recall.
    const statement = sittingStatement(
      practiceOutcomes({ state: session, targets: held.targets, exercises: held.exercises, exposed: held.exposed, assisted }),
    );
    const card = practiceEndCard(practiceSaved, statement);
    return (
      <ScrollScreen footer={doneFooter}>
        <View style={ds.ending}>
          {/* The end card in place, only from the delta the settle read back.
              A sitting kept to finish saving, or not saved, has no delta and
              shows none: its statement below says what is true. */}
          {end.state === 'settled' ? <EndCard delta={end.delta} release={release} /> : !card.retry && <FinishFelt />}
          <Card>
            <Text style={[type.title, { color: paper.ink }]}>{card.title}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{card.body}</Text>
            {/* Nothing is safe yet, so the one thing to offer is the same save
                again. The store replays the frozen plan, so it awards nothing twice. */}
            {card.retry && (
              <View style={{ marginTop: space(3), alignItems: 'flex-start' }}>
                <IconAction layout="inline" icon="refresh" busy={practiceRetrying}
                  label={practiceRetrying ? PRACTICE_END.retrying : PRACTICE_END.retry}

                  disabled={practiceRetrying}
                  onPress={retryPractice}
                />
              </View>
            )}
          </Card>
        </View>
      </ScrollScreen>
    );
  }

  // Built empty: nothing due right now. One calm card and the way out. A
  // terminal card, so Done is its one door and it carries no back header.
  if (session.finished && session.answered.length === 0) {
    return (
      <ScrollScreen footer={doneFooter}>
        {/* An empty bank is the good outcome, not a dead end, so it gets the
            cleared table — the same scene and spacing the review deck uses,
            because these two screens say the same thing. The size is the art
            registry's, never a width written here. */}
        <Card>
          <Text style={[type.title, { color: paper.ink }]}>Nothing to review.</Text>
          <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>
            Your next session adds more.
          </Text>
        </Card>
      </ScrollScreen>
    );
  }

  // The end card: the one place numbers are allowed, where they have context,
  // and every one of them is the settle's read-back of this sitting (the
  // count of answers it got right is the sitting's own). While the settle is
  // still reading it back, the card waits inside the screen with its Done; if
  // it never answers, the finish stands in words with no number at all, felt
  // once, and a delta that lands after that is not drawn (`sittingEnd`,
  // F775). Terminal, so Done alone, no back header.
  if (session.finished) {
    const s = summariseDrill(session);
    return (
      <ScrollScreen footer={doneFooter}>
        <View style={ds.ending}>
          {end.state === 'settled' ? (
            <EndCard delta={end.delta} count={s.resolved} release={release} />
          ) : end.state === 'waiting' ? (
            <ActivityIndicator color={paper.inkSoft} />
          ) : (
            <Card>
              <FinishFelt />
              <Text style={[type.title, { color: paper.ink }]}>{DRILL_END.finished}</Text>
            </Card>
          )}
          <Text style={[type.small, { color: paper.inkSoft }]}>
            {s.unresolved > 0 ? DRILL_END.comingBack : DRILL_END.deck}
          </Text>
        </View>
      </ScrollScreen>
    );
  }

  const exercise = session.queue[0];
  if (!exercise) return null; // Unreachable: an unfinished session has a head.
  const locked = feedback !== null;

  return (
    <DrillClock.Provider value={clock}>
    <ScrollScreen
      avoidKeyboard
      header={
        fill === null ? header : (
          <View>
            {header}
            <SittingBar fill={fill} glow={comboGlows(combo)} />
          </View>
        )
      }
      footer={
        // Reserved height, so the card never jumps when a sheet arrives. The
        // sheet draws no mark on a miss, and that is the rule rather than an
        // oversight: a mid-session message may not scold, and a drawing scolds
        // louder than a word. The scorer's whole say is its one muted line,
        // core's focus reason, already learner-safe: never a score.
        <DrillFeedbackArea hasFeedback={sheet !== null}>
          {sheet !== null && <AnswerSheet key={beatRef.current} sheet={sheet} note={focusLine} onContinue={advance} />}
        </DrillFeedbackArea>
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
        <TranslationView
          exercise={exercise}
          typed={typed}
          onChange={setTyped}
          onAnswer={answer}
          locked={locked}
          help={practice !== undefined ? { shown: assisted.includes(exercise.id), onShow: () => showPhrase(exercise.id) } : undefined}
        />
      )}
      {exercise.kind === 'repeat-this' && (
        <RepeatThisView exercise={exercise} onAnswer={answer} onSpoke={spoke} onNoMic={goSilent} locked={locked} />
      )}
      {exercise.kind === 'own-words' && (
        <OwnWordsView
          key={exercise.id}
          exercise={exercise}
          typed={typed}
          onChange={setTyped}
          onCheck={checkOwnWords}
          onTake={recordOwnWords}
          quiet={micSuppressedRef.current}
          busy={judging}
          outcome={ownWords}
          onKeep={() => keepPhrase(exercise)}
          keeping={keeping}
          kept={kept}
          keepFailed={keepFailed}
        />
      )}
    </ScrollScreen>
    </DrillClock.Provider>
  );
}

function makeDrillStyles(paper: DrillPaper, keyboardEditing = false) { return StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedbackArea: { minHeight: HIT + 8, justifyContent: 'flex-end' },
  // The own-words outcome's check: a white disc, so it reads on the mint card
  // as well as on paper.
  verdictMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: paper.card, alignItems: 'center', justifyContent: 'center' },
  // A finished sitting's end card and the words under it.
  ending: { gap: space(4) },

  // The exercise card: the SessionView main-card anatomy, content centred.
  exCard: { alignItems: 'center', minHeight: keyboardEditing ? 0 : 220, paddingVertical: keyboardEditing ? space(2) : undefined, justifyContent: 'center' },
  promptCard: { minHeight: keyboardEditing ? 0 : 260, justifyContent: 'space-between' },

  // The chip anatomy, for choices that are bare words: white paper under a
  // paper hairline, the notebook's one surface, with no tint.
  choice: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
  },
  chipPressed: { opacity: 0.6 },

  // The own-words outcome: the verdict beside its mark, then whatever the
  // judge gave the learner to read. It is a card rather than a timed line
  // because a better way to say something is worth more than 1.6 seconds.
  outcome: { gap: space(2.5) },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },

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
    fontFamily: font.regular,
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
    // A paper hairline, not an ink outline (notebook Phase 4, 2026-09-27):
    // the ink is kept for the one primary pill.
    borderWidth: HAIRLINE,
    borderColor: paper.line,
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
  speakCircle: { width: SPEAK, height: SPEAK, alignItems: 'center', justifyContent: 'center' },
  speakRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  saidIt: { alignSelf: 'stretch' },
  noMic: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },
}); }
