/**
 * The small pieces every drill kind view shares, moved out of DrillScreen
 * with no change: the kind's plain tag, the hear-it row, the typed field,
 * the word chip, the build's head, and the clock the inputs touch.
 */
import { createContext, useContext } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { RecordingPresets } from 'expo-audio';
import type { DrillExercise } from '@luvani/core';
import { colour, onColour, type } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { EarGlyph, PillButton } from '../../components.tsx';
import * as tutorVoice from '../../speech/tutorVoice.ts';
import type { SheetTone } from '../answerSheet.ts';
import { OWN_WORDS_LABEL } from '../ownWordsCopy.ts';
import { makeDs } from './styles.ts';
import { space } from '../../theme.ts';

/** The usual preset, metered, so the ring follows the learner's real voice. */
export const METERED_TAKE = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * Web records only on a secure origin with MediaRecorder present; native Expo
 * always ships the recorder. A failed probe is not an error — it just means
 * the honest self-report control stays in charge.
 */
export const CAN_RECORD =
  Platform.OS !== 'web' ||
  (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');

/** What this exercise asks for, said plainly. */
export function kindTag(exercise: DrillExercise): string {
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
export const OUTCOME_GROUND: Readonly<Record<SheetTone, { fill: string; soft: string } | null>> = {
  good: { fill: colour.mint, soft: onColour.mint },
  nearly: { fill: colour.sun, soft: onColour.sun },
  calm: null,
};

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
export function WordChoice({ word, onPress, locked }: { word: string; onPress: () => void; locked: boolean }) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={word}
      style={({ pressed }) => pressed && ds.chipPressed}
    >
      <View style={ds.choice}>
        <Text style={[type.french, { color: bt.text }]}>{word}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The sitting's active learning clock, reached by the small input pieces below
 * without threading a prop through every exercise view. Outside a drill it is
 * inert, so nothing a piece does there is ever counted.
 */
export const DrillClock = createContext<{ touch: () => void }>({ touch: () => undefined });

/** The hear-it affordance ReviewScreen uses, for hearing a French line again. */
export function HearRow({ text }: { text: string }) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
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
      <EarGlyph size={15} color={bt.muted} />
      <Text style={[type.small, { color: bt.muted }]}>Hear it</Text>
    </Pressable>
  );
}

/** The app's first text input: a paper field in the Field anatomy. */
export function TypedAnswer({
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
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const canSubmit = typed.trim() !== '' && !locked;
  const clock = useContext(DrillClock);
  return (
    <View style={{ gap: space(2.5) }}>
      <TextInput
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
        placeholderTextColor={bt.muted}
        accessibilityLabel={accessibilityLabel}
        style={ds.input}
      />
      <PillButton label="Check" disabled={!canSubmit} accessibilityLabel="Check your answer" onPress={onSubmit} lip />
    </View>
  );
}

/** The build's one instruction (B-Drill). */
export const TAP_LINE = 'Tap the words in order.';
