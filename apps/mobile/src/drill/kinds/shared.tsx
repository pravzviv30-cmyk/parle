/**
 * The small pieces every drill kind view shares, moved out of DrillScreen
 * with no change: the kind's plain tag, the hear-it row, the typed field
 * (now the lip field, drill B v2), the build's head, and the clock the inputs
 * touch. The word chip is a `LipTile` chip in build.tsx.
 */
import { createContext, useContext } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { RecordingPresets } from 'expo-audio';
import type { DrillExercise } from '@luvani/core';
import { bType, frenchText, type } from '../../theme.ts';
import { useB, useThemedStyles, type B } from '../../main/bTheme.tsx';
import { EarGlyph, LipTile, PillButton } from '../../components.tsx';
import * as tutorVoice from '../../speech/tutorVoice.ts';
import type { SheetTone } from '../answerSheet.ts';
import type { LitAnswer } from '../litLetters.ts';
import { OWN_WORDS_LABEL } from '../ownWordsCopy.ts';
import { makeDs } from './styles.ts';

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
 * The own-words outcome card's ground, by the same themed tones the answer
 * sheet uses (`drill/AnswerSheet.tsx`, drill B v2): the mint wash for "That
 * works.", the butter for "Nearly there.", and the plain card (null) for the
 * reveal and for a tutor nobody could reach. The theme's text on every one;
 * the softer line takes a colour that clears the floor on its own ground:
 * the green words on the mint wash, the secondary ink on the butter.
 */
export function outcomeGround(tone: SheetTone, t: B): { fill: string; ink: string; soft: string } | null {
  if (tone === 'good') return { fill: t.mintWash, ink: t.text, soft: t.mintWords };
  if (tone === 'nearly') return { fill: t.butter, ink: t.text, soft: t.secondary };
  return null;
}

/**
 * The lit letters of a nearly-right answer (`drill/litLetters.ts`), handed to
 * the field by the drill while its nearly sheet is up, else null. A context,
 * like the clock below, so no prop is threaded through every kind.
 */
export const LitField = createContext<LitAnswer | null>(null);

/** Whether a typed answer can be checked: some words, and nothing settling. */
export function canCheck(typed: string, locked: boolean): boolean {
  return typed.trim() !== '' && !locked;
}

/**
 * The typed kinds' Check, pinned at the frame's foot (drill B v2): the lip
 * primary, off until there is something to check.
 */
export function CheckPill({ typed, locked, onSubmit }: { typed: string; locked: boolean; onSubmit: () => void }) {
  return <PillButton label="Check" disabled={!canCheck(typed, locked)} accessibilityLabel="Check your answer" onPress={onSubmit} lip />;
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

/**
 * The app's first text input, as the lip field (drill B v2, UI-016;
 * drill-b.md "Field"): a white `LipTile` (radius 18 on a 4pt `line` lip)
 * holding the TextInput, bold 18, the placeholder muted.
 */
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
  const canSubmit = canCheck(typed, locked);
  const clock = useContext(DrillClock);
  const lit = useContext(LitField);
  if (lit !== null && locked) {
    // Nearly: the field holds the right spelling with the missed letters lit
    // in the sun, ink on it in both modes. Read as one line.
    let at = 0;
    const runs: { text: string; lit: boolean }[] = [];
    for (const [start, end] of lit.lit) {
      if (start > at) runs.push({ text: lit.text.slice(at, start), lit: false });
      runs.push({ text: lit.text.slice(start, end), lit: true });
      at = end;
    }
    if (at < lit.text.length) runs.push({ text: lit.text.slice(at), lit: false });
    return (
      <LipTile accessibilityLabel={`${accessibilityLabel}: ${lit.text}`} style={[ds.fieldFace, ds.litField]}>
        <Text {...frenchText} style={[bType.bold18, { color: bt.text }]}>
          {runs.map((run, i) => (run.lit ? <Text key={i} style={{ backgroundColor: bt.sun, color: bt.onSun }}>{run.text}</Text> : run.text))}
        </Text>
      </LipTile>
    );
  }
  return (
    <LipTile style={ds.fieldFace}>
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
    </LipTile>
  );
}

/** The build's one instruction (B-Drill). */
export const TAP_LINE = 'Tap the words in order.';
