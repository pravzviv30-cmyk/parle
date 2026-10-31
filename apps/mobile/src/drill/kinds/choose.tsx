/**
 * The choose kinds: which would you say, and choose a reply. Each option is a
 * `LipTile` (drill B v2, UI-016; drill-b.md "Tile"): at rest, picked, right
 * with one pop and one sparkle, or set aside (`drill/tileLook.ts`).
 */
import { Text, View } from 'react-native';
import type { AppropriateReplyExercise, BestSentenceExercise } from '@luvani/core';
import { bType, frenchText, space } from '../../theme.ts';
import { useB } from '../../main/bTheme.tsx';
import { Label, LipTile } from '../../components.tsx';
import { PopOnce } from '../../motion/PopOnce.tsx';
import { Sparkle } from '../../art/Sparkle.tsx';
import { ASIDE_OPACITY, tileLook, type TilePick } from '../tileLook.ts';
import { DrillFrame, DrillPrompt, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { HearRow, kindTag } from './shared.tsx';

export function BestSentenceView({
  exercise,
  onAnswer,
  locked,
  pick = null,
  shell,
}: {
  exercise: BestSentenceExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
  /** The pick while its sheet is up (`choosePick`), else null. */
  pick?: TilePick | null;
  shell: DrillShell;
}) {
  const bt = useB();
  return (
    <DrillFrame {...shell} stage={drillStage(exercise.kind, bt.mode)} eyebrow={kindTag(exercise)} prompt={exercise.prompt}>
      <View style={{ gap: space(2.5) }}>
        {exercise.candidates.map((candidate, i) => (
          <ChoiceTile
            key={candidate.fr}
            text={candidate.fr}
            look={tileLook(i, pick)}
            onPress={() => {
              if (!locked) onAnswer(i);
            }}
          />
        ))}
      </View>
    </DrillFrame>
  );
}

export function AppropriateReplyView({
  exercise,
  onAnswer,
  locked,
  pick = null,
  shell,
}: {
  exercise: AppropriateReplyExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
  /** The pick while its sheet is up (`choosePick`), else null. */
  pick?: TilePick | null;
  shell: DrillShell;
}) {
  const bt = useB();
  return (
    <DrillFrame
      {...shell}
      stage={drillStage(exercise.kind, bt.mode)}
      eyebrow={kindTag(exercise)}
      prompt={
        <View style={{ gap: space(1.5) }}>
          <Label color={bt.text}>{exercise.line.speaker}</Label>
          <DrillPrompt>{exercise.line.fr}</DrillPrompt>
        </View>
      }
      stageExtra={<HearRow text={exercise.line.fr} />}
    >
      <View style={{ gap: space(2.5) }}>
        {exercise.options.map((option, i) => (
          <ChoiceTile
            key={option.fr}
            text={option.fr}
            look={tileLook(i, pick)}
            onPress={() => {
              if (!locked) onAnswer(i);
            }}
          />
        ))}
      </View>
    </DrillFrame>
  );
}

/** The tile's own layout (V2-Choose `.tile`): min height 58, padding 16, the words bold 16. */
const TILE = { minHeight: 58, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' } as const;

/**
 * One option as a lip tile. Right: the mint wash on a darker mint lip, one pop
 * (`PopOnce`) and one sparkle, both absent under reduced motion. Aside: faded,
 * still readable, and still taking the press it took before (which the view
 * ignores while a pick settles).
 */
function ChoiceTile({ text, look, onPress }: { text: string; look: ReturnType<typeof tileLook>; onPress: () => void }) {
  const bt = useB();
  const right = look === 'right';
  return (
    <View style={look === 'aside' ? { opacity: ASIDE_OPACITY } : undefined}>
      <PopOnce play={right}>
        <LipTile
          tone={right ? 'mintWash' : 'card'}
          lip={right ? bt.mintWords : undefined}
          selected={look === 'picked'}
          onPress={onPress}
          accessibilityLabel={text}
          style={TILE}
        >
          <Text {...frenchText} style={[bType.bold16, { color: right ? bt.mintWords : bt.text }]}>{text}</Text>
          {right ? <Sparkle /> : null}
        </LipTile>
      </PopOnce>
    </View>
  );
}
