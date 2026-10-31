/** The write kinds: listen and type, and translate. Moved from DrillScreen with no change. */
import { Pressable, Text, View } from 'react-native';
import type { ListenTypeExercise, TranslationExercise } from '@luvani/core';
import { bType, space, type } from '../../theme.ts';
import { useB, useThemedStyles } from '../../main/bTheme.tsx';
import { EarGlyph, IconAction } from '../../components.tsx';
import { DrillFrame, DrillPrompt, type DrillShell } from '../DrillFrame.tsx';
import { drillStage } from '../drillStage.ts';
import { Feedback } from '../../motion/Feedback.tsx';
import * as tutorVoice from '../../speech/tutorVoice.ts';
import { PRACTICE_HELP } from '../../practice/copy.ts';
import { HearRow, TypedAnswer, kindTag } from './shared.tsx';
import { makeDs } from './styles.ts';

export function ListenTypeView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
  shell,
}: {
  exercise: ListenTypeExercise;
  typed: string;
  onChange: (t: string) => void;
  onAnswer: (a: string) => void;
  locked: boolean;
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  return (
    <DrillFrame
      {...shell}
      stage={drillStage(exercise.kind, bt.mode)}
      eyebrow={kindTag(exercise)}
      stageExtra={<>
        {/* Replayable freely — dictation is a listening exercise, not a memory test. */}
        <Pressable
          onPress={() => tutorVoice.speak(exercise.fr)}
          accessibilityRole="button"
          accessibilityLabel="Play the French line"
          style={({ pressed }) => [ds.listenButton, pressed && { backgroundColor: bt.skeleton }]}
        >
          <EarGlyph size={22} color={bt.text} />
          <Text style={[type.button, { color: bt.text }]}>Hear it</Text>
        </Pressable>
        <Text style={[bType.line15, { color: bt.muted }]}>Listen, then type what you hear.</Text>
      </>}
    >
      <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={() => onAnswer(typed)}
        locked={locked}
        placeholder="What you hear"
      />
    </DrillFrame>
  );
}

export function TranslationView({
  exercise,
  typed,
  onChange,
  onAnswer,
  locked,
  help,
  shell,
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
  shell: DrillShell;
}) {
  const bt = useB();
  const ds = useThemedStyles(makeDs);
  const isFrenchPrompt = exercise.direction === 'fr-en';
  const prompt = isFrenchPrompt ? exercise.fr : exercise.en;
  // Only an English-to-French ask hides the French, so only it has anything to
  // show. The reference is the exercise's own line, never generated.
  const canHelp = help !== undefined && !isFrenchPrompt;
  return (
    <DrillFrame
      {...shell}
      stage={drillStage(exercise.kind, bt.mode)}
      eyebrow={kindTag(exercise)}
      prompt={<DrillPrompt>{prompt}</DrillPrompt>}
      stageExtra={<>
        {isFrenchPrompt && <HearRow text={exercise.fr} />}
        {canHelp && help.shown && (
          <Feedback kind="help" active appear>
            <Text style={[type.french, { color: bt.muted, textAlign: 'center', marginTop: space(3) }]}>{exercise.fr}</Text>
            <HearRow text={exercise.fr} />
            <Text style={[type.small, { color: bt.muted }]}>With help</Text>
          </Feedback>
        )}
        {canHelp && !help.shown && (
          <View style={{ marginTop: space(3) }}>
            <IconAction layout="inline" icon="hint" label={PRACTICE_HELP.show} accessibilityLabel={PRACTICE_HELP.showLabel} disabled={locked} onPress={help.onShow} />
          </View>
        )}
      </>}
    >
      <TypedAnswer
        typed={typed}
        onChange={onChange}
        onSubmit={() => onAnswer(typed)}
        locked={locked}
        placeholder={isFrenchPrompt ? 'Meaning in English' : 'Answer in French'}
        accessibilityLabel={isFrenchPrompt ? 'Your answer in English' : 'Your answer in French'}
      />
    </DrillFrame>
  );
}
