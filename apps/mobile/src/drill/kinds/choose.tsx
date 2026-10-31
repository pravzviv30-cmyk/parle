/** The choose kinds: which would you say, and choose a reply. Moved from DrillScreen with no change. */
import { View } from 'react-native';
import type { AppropriateReplyExercise, BestSentenceExercise } from '@luvani/core';
import { space } from '../../theme.ts';
import { useB } from '../../main/bTheme.tsx';
import { Label, OptionCard } from '../../components.tsx';
import { DrillFrame, DrillPrompt, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { HearRow, kindTag } from './shared.tsx';

export function BestSentenceView({
  exercise,
  onAnswer,
  locked,
  shell,
}: {
  exercise: BestSentenceExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  return (
    <DrillFrame {...shell} stage={drillStage(exercise.kind, bt.mode)} eyebrow={kindTag(exercise)} prompt={exercise.prompt}>
      <View style={{ gap: space(2.5) }}>
        {exercise.candidates.map((candidate, i) => (
          <OptionCard
            key={candidate.fr}
            text={candidate.fr}
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
  shell,
}: {
  exercise: AppropriateReplyExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
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
          <OptionCard
            key={option.fr}
            text={option.fr}
            onPress={() => {
              if (!locked) onAnswer(i);
            }}
          />
        ))}
      </View>
    </DrillFrame>
  );
}
