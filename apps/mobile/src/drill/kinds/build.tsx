/** The build kinds: fill the blank and tap to translate. Moved from DrillScreen with no change. */
import { Pressable, Text, View } from 'react-native';
import type { FillBlankExercise, TapTranslateExercise } from '@luvani/core';
import { bType, frenchText, space, type } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { Card, Label, PillButton, fitDisplay } from '../../components.tsx';
import { DrillHead, TAP_LINE, TypedAnswer, WordChoice, kindTag } from './shared.tsx';
import { makeDs } from './styles.ts';

export function FillBlankView({
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
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  return (
    <View style={{ gap: space(4) }}>
      <Card style={ds.exCard}>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[fitDisplay(exercise.sentence), { color: bt.text, textAlign: 'center', marginTop: space(4) }]}>
          {exercise.sentence}
        </Text>
        <Text style={[type.small, { color: bt.muted, textAlign: 'center', marginTop: space(2.5) }]}>{exercise.en}</Text>
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

export function TapTranslateView({
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
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const answerText = assembled.map((i) => exercise.tokens[i]).join(' ');
  const canCheck = assembled.length > 0 && !locked;
  return (
    <View style={ds.build}>
      {/* 2026-10-21 UI-008, artboard B-Drill: the eyebrow, the English as the
          screen's title, and the one instruction. */}
      <DrillHead eyebrow={kindTag(exercise)} title={exercise.en} line={TAP_LINE} />

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

      <PillButton
        label="Check"
        disabled={!canCheck}
        accessibilityLabel="Check your sentence"
        onPress={() => onAnswer(answerText)}
      />
    </View>
  );
}
