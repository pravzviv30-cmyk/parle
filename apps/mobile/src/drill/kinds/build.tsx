/**
 * The build kinds: fill the blank and tap to translate (drill B v2, UI-016;
 * drill-b.md "Build"). Word chips are `LipTile` chips. A fill-blank chip flies
 * into the sentence's gap (`TokenFlight`) and leaves a dashed slot; the landed
 * word is a brand pill that sends itself back. Tap-translate fills its answer
 * box in place. Under reduced motion nothing flies: the word is in the gap at once.
 */
import { useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FillBlankExercise, TapTranslateExercise } from '@luvani/core';
import { bType, decorative, frenchText } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { LipTile, PillButton, Press } from '../../components.tsx';
import { useTokenFlight } from '../../motion/TokenFlight.tsx';
import { DrillFrame, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { SEND_BACK_LINE, flightMayLand, sendBackLabel, splitBlank } from '../tileLook.ts';
import { CheckPill, DrillClock, TAP_LINE, TypedAnswer, kindTag } from './shared.tsx';
import { makeDs } from './styles.ts';

/** A landed word as the board draws it (`.landed`): the brand fill, onBrand ink and a soft brand halo. */
function LandedWord({ word, big = false }: { word: string; big?: boolean }) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  return (
    <View style={[ds.landed, big && ds.landedBig]}>
      <View {...decorative} pointerEvents="none" style={ds.landedHalo} />
      <Text {...frenchText} style={[bType.bold17, { color: bt.onBrand }]}>{word}</Text>
    </View>
  );
}

/** A word chip in the bank: a `LipTile` chip, or the dashed slot it leaves once placed. */
function BankChip({ word, placed, locked, onPress, chipRef, label }: {
  word: string;
  placed: boolean;
  locked: boolean;
  onPress: () => void;
  chipRef?: RefObject<View | null>;
  label?: string;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  if (placed) {
    // The slot keeps the word's own width (its text drawn clear), so the bank never jumps.
    return (
      <View style={ds.slot} accessible accessibilityRole="button" accessibilityLabel={`${word}, placed`} accessibilityState={{ disabled: true }}>
        <Text {...decorative} style={[bType.bold17, { color: 'transparent' }]}>{word}</Text>
      </View>
    );
  }
  return (
    <View ref={chipRef} collapsable={false}>
      <LipTile size="chip" onPress={onPress} disabled={locked} accessibilityLabel={label ?? word} style={ds.chip}>
        <Text {...frenchText} style={[bType.bold17, { color: bt.text }]}>{word}</Text>
      </LipTile>
    </View>
  );
}

export function FillBlankView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
  shell,
}: {
  exercise: FillBlankExercise;
  /** The typed answer, or with options, the word in the gap ('' while the gap is empty). */
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const clock = useContext(DrillClock);
  const flight = useTokenFlight();
  const gapRef = useRef<View | null>(null);
  const chipRefs = useRef<Record<string, { current: View | null }>>({});
  // The word in the air, so its chip leaves its slot the moment it is tapped.
  const [flying, setFlying] = useState<string | null>(null);
  const options = exercise.options;
  const split = options ? splitBlank(exercise.sentence) : null;
  const landed = options && typed !== '' ? typed : null;
  // Live facts a landing reads, since the flight lands after the render that launched it.
  const live = useRef({ mounted: true, locked, exerciseId: exercise.id });
  live.current.locked = locked;
  live.current.exerciseId = exercise.id;
  useEffect(() => {
    live.current.mounted = true;
    return () => { live.current.mounted = false; };
  }, []);

  const place = (word: string) => {
    if (locked || flying !== null) return;
    clock.touch();
    const from = (chipRefs.current[word] ??= { current: null });
    setFlying(word);
    const launchedFor = exercise.id;
    flight.launch({
      from,
      to: gapRef,
      token: <LandedWord word={word} />,
      onLand: () => {
        // Checked, moved on or gone while the word was in the air: the word is dropped.
        if (!live.current.mounted) return;
        setFlying(null);
        if (flightMayLand({ ...live.current, launchedFor })) onChange(word);
      },
    });
  };
  const sendBack = () => {
    if (locked) return;
    clock.touch();
    onChange('');
  };

  // The sentence with its gap, word by word so the gap sits in the line and wraps with it.
  const prompt = split === null ? exercise.sentence : (
    <View style={st.sentence} accessibilityRole="header">
      {split.before.split(/\s+/).filter(Boolean).map((word, i) => <Text key={`b${i}`} {...frenchText} style={[bType.prompt23, { color: bt.text }]}>{word}</Text>)}
      <View ref={gapRef} collapsable={false} style={landed === null ? [ds.gap, { borderBottomColor: bt.link }] : null}>
        {landed !== null ? (
          <Press haptic="light" onPress={sendBack} disabled={locked} accessibilityRole="button" accessibilityLabel={sendBackLabel(landed)} style={ds.landedPress}>
            <LandedWord word={landed} />
          </Press>
        ) : null}
      </View>
      {split.after.split(/\s+/).filter(Boolean).map((word, i) => <Text key={`a${i}`} {...frenchText} style={[bType.prompt23, { color: bt.text }]}>{word}</Text>)}
    </View>
  );

  return (
    <DrillFrame {...shell} stage={drillStage(exercise.kind, bt.mode)} eyebrow={kindTag(exercise)} prompt={prompt} english={exercise.en}
      primary={<CheckPill typed={typed} locked={locked || flying !== null} onSubmit={() => onAnswer(typed)} />}>
      {options ? (
        <View style={ds.build}>
          <View style={ds.bank}>
            {options.map((option) => (
              <BankChip key={option} word={option} placed={option === landed || option === flying} locked={locked}
                chipRef={(chipRefs.current[option] ??= { current: null })} onPress={() => place(option)} />
            ))}
          </View>
          {landed !== null ? <Text style={[bType.line15, st.centred, { color: bt.muted }]}>{SEND_BACK_LINE}</Text> : null}
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

const st = StyleSheet.create({
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4 },
  centred: { textAlign: 'center' },
});

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

      {/* The answer box: a white lip tile, filled in place with the placed
          words as brand pills, and a dashed slot where the next word goes.
          Tap a word to put it back. */}
      <View accessibilityLabel="Your sentence so far">
        <LipTile style={ds.answerBox}>
          {assembled.map((tokenIndex, position) => (
            <Press
              key={tokenIndex}
              haptic="light"
              onPress={() => onAssembled(assembled.filter((_, p) => p !== position))}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${exercise.tokens[tokenIndex]}`}
              style={ds.landedPress}
            >
              <LandedWord big word={exercise.tokens[tokenIndex] ?? ''} />
            </Press>
          ))}
          {!locked && assembled.length < exercise.tokens.length ? <View {...decorative} style={[ds.slot, ds.nextSlot]} /> : null}
        </LipTile>
      </View>

      {/* The bank. A placed word leaves a dashed slot its own size, so nothing
          jumps; the distractors stay white chips until they are placed too. */}
      <View style={ds.bank}>
        {exercise.tokens.map((token, i) => (
          <BankChip key={i} word={token} placed={assembled.includes(i)} locked={locked} label={`Add ${token}`} onPress={() => onAssembled([...assembled, i])} />
        ))}
      </View>
    </View>
    </DrillFrame>
  );
}
