/** The choose kinds: which would you say, and choose a reply. Moved from DrillScreen with no change. */
import { Text, View } from 'react-native';
import type { AppropriateReplyExercise, BestSentenceExercise } from '@luvani/core';
import { space, type } from '../../theme.ts';
import { useB } from '../../main/bTheme.tsx';
import { Card, Label, OptionCard } from '../../components.tsx';
import { HearRow, kindTag } from './shared.tsx';

export function BestSentenceView({
  exercise,
  onAnswer,
  locked,
}: {
  exercise: BestSentenceExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
}) {
  const bt = useB();
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>{kindTag(exercise)}</Label>
        <Text style={[type.heading, { color: bt.text, marginTop: space(3) }]}>{exercise.prompt}</Text>
      </Card>
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
    </View>
  );
}

export function AppropriateReplyView({
  exercise,
  onAnswer,
  locked,
}: {
  exercise: AppropriateReplyExercise;
  onAnswer: (i: number) => void;
  locked: boolean;
}) {
  const bt = useB();
  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>{kindTag(exercise)}</Label>
        <View style={{ marginTop: space(3) }}>
          <Label color={bt.text}>{exercise.line.speaker}</Label>
          <Text style={[type.french, { color: bt.text, marginTop: space(1.5) }]}>{exercise.line.fr}</Text>
        </View>
        <HearRow text={exercise.line.fr} />
      </Card>
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
    </View>
  );
}
