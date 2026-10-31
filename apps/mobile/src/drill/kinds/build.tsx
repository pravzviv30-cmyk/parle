/** The build kinds: fill the blank and tap to translate. Moved from DrillScreen with no change. */
import { Pressable, Text, View } from 'react-native';
import type { FillBlankExercise, TapTranslateExercise } from '@luvani/core';
import { bType, frenchText } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { PillButton } from '../../components.tsx';
import { DrillFrame, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { CheckPill, TAP_LINE, TypedAnswer, WordChoice, kindTag } from './shared.tsx';
import { makeDs } from './styles.ts';

export function FillBlankView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
  shell,
}: {
  exercise: FillBlankExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  return (
    <DrillFrame {...shell} stage={drillStage(exercise.kind, bt.mode)} eyebrow={kindTag(exercise)} prompt={exercise.sentence} english={exercise.en}
      primary={exercise.options ? undefined : <CheckPill typed={typed} locked={locked} onSubmit={() => onAnswer(typed)} />}>
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
    </DrillFrame>
  );
}

export function TapTranslateView({
  exercise,
  assembled,
  onAssembled,
  onAnswer,
  locked,
  shell,
}: {
  exercise: TapTranslateExercise;
  /** Indexes into `exercise.tokens`, in tap order. Indexes, because a bank may offer the same word twice. */
  assembled: number[];
  onAssembled: (next: number[]) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const answerText = assembled.map((i) => exercise.tokens[i]).join(' ');
  const canCheck = assembled.length > 0 && !locked;
  return (
    // Drill B v2 (UI-016): the eyebrow, the English as the stage's header,
    // and the one instruction, on the build's butter stage.
    <DrillFrame {...shell} stage={drillStage(exercise.kind, bt.mode)} eyebrow={kindTag(exercise)} prompt={exercise.en} promptIsHeader english={TAP_LINE}
      primary={
        <PillButton
          label="Check"
          disabled={!canCheck}
          accessibilityLabel="Check your sentence"
          onPress={() => onAnswer(answerText)}
          lip
        />
      }>
    <View style={ds.build}>

      {/* The answer box: the words placed so far, in brand tiles. Tap a word to put it back. */}
      <View style={ds.answerBox} accessibilityLabel="Your sentence so far">
        {assembled.map((tokenIndex, position) => (
          <Pressable
            key={tokenIndex}
            onPress={() => onAssembled(assembled.filter((_, p) => p !== position))}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.tokens[tokenIndex]}`}
            style={({ pressed }) => [ds.placed, pressed && { opacity: 0.7 }]}
          >
            <Text {...frenchText} style={[bType.bold17, { color: bt.onBrand }]}>{exercise.tokens[tokenIndex]}</Text>
          </Pressable>
        ))}
      </View>

      {/* The bank. A placed word leaves a dashed slot its own size, so nothing
          jumps; the distractors stay white tiles until they are placed too. */}
      <View style={ds.bank}>
        {exercise.tokens.map((token, i) => {
          const used = assembled.includes(i);
          return (
            <Pressable
              key={i}
              onPress={() => onAssembled([...assembled, i])}
              disabled={used || locked}
              accessibilityRole="button"
              accessibilityLabel={used ? `${token}, placed` : `Add ${token}`}
              accessibilityState={{ disabled: used }}
              style={({ pressed }) => pressed && !used && ds.chipPressed}
            >
              {used ? (
                <View style={ds.slot}>
                  <Text style={[bType.semi17, { color: 'transparent' }]}>{token}</Text>
                </View>
              ) : (
                <View style={ds.tileLip}>
                  <View style={ds.tile}>
                    <Text {...frenchText} style={[bType.semi17, { color: bt.text }]}>{token}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
    </DrillFrame>
  );
}
