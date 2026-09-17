/**
 * What the tutor remembers, edited (F562).
 *
 * Every fact the brain holds about the learner's life, each with what kind of
 * thing it is and a way to forget it; a way to forget everything; up to three
 * goals in the learner's own words; the correction dial, because how the
 * tutor treats you belongs beside what it knows about you; and one plain
 * sentence on what leaves the phone.
 *
 * Every write goes through `profile/memory.ts` and the profile context's
 * ordinary `update`, so a forget is on the disk and in the next snapshot
 * before this screen has redrawn. Nothing here reads the disk itself.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Field, GhostButton, Label, OutlineButton } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { paper, space, type, HIT } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { ChoiceRow } from '../settings/ChoiceRow.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { STRICTNESS_OPTIONS, STRICTNESS_ROW, strictnessOf, withStrictness, type Strictness } from '../tutor/strictness.ts';
import {
  MAX_GOAL_CHARS,
  MAX_LEARNER_GOALS,
  visibleFacts,
  withFactForgotten,
  withLearnerGoal,
  withMemoryCleared,
  withoutLearnerGoal,
} from './memory.ts';
import {
  ADD_GOAL,
  FORGET_ALL,
  FORGET_ONE,
  GOALS_LABEL,
  GOALS_SUB,
  GOAL_PLACEHOLDER,
  KIND_GLOSS,
  NOTHING_YET,
  REMOVE_GOAL,
  WHAT_LEAVES,
  memoryLabel,
  memorySummary,
} from './tutorMemory.ts';

export function TutorMemoryScreen({ onBack }: { onBack: () => void }) {
  const { profile, update } = useProfile();
  const [draft, setDraft] = useState('');
  const name = tutorNameOf(profile);
  const facts = visibleFacts(profile);
  const room = profile.learnerGoals.length < MAX_LEARNER_GOALS;

  const addGoal = () => {
    update(withLearnerGoal(profile, draft));
    setDraft('');
  };

  return (
    <ScrollScreen avoidKeyboard header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>{memoryLabel(name)}</Text>
      {/* How much is held, in words and never a count, from the same module the
          Profile card used to show it on. It sits under the title because that
          is the question somebody arriving here is asking. */}
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{memorySummary(profile, name)}</Text>

      <Card style={st.card}>
        {facts.length === 0 ? (
          <Text style={[type.body, { color: paper.ink }]}>{NOTHING_YET}</Text>
        ) : (
          facts.map((fact, index) => (
            <View key={`${fact.notedAt}:${fact.en}`} style={[st.fact, index > 0 && st.divided]}>
              <View style={st.factWords}>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{fact.en}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{KIND_GLOSS[fact.kind]}</Text>
              </View>
              <GhostButton
                label={FORGET_ONE}
                color={paper.ink}
                accessibilityLabel={`${FORGET_ONE}: ${fact.en}`}
                onPress={() => update(withFactForgotten(profile, fact.en))}
              />
            </View>
          ))
        )}
      </Card>
      {facts.length > 0 && (
        <View style={st.all}>
          <OutlineButton label={FORGET_ALL} onPress={() => update(withMemoryCleared(profile))} />
        </View>
      )}

      <View style={st.section}>
        <Label>{GOALS_LABEL}</Label>
        <Card style={st.card}>
          <Text style={[type.small, { color: paper.inkSoft }]}>{GOALS_SUB}</Text>
          {profile.learnerGoals.map((goal) => (
            <View key={goal} style={[st.fact, st.divided]}>
              <View style={st.factWords}>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{goal}</Text>
              </View>
              <GhostButton
                label={REMOVE_GOAL}
                color={paper.ink}
                accessibilityLabel={`${REMOVE_GOAL}: ${goal}`}
                onPress={() => update(withoutLearnerGoal(profile, goal))}
              />
            </View>
          ))}
          {room && (
            <View style={st.add}>
              <Field
                value={draft}
                onChangeText={setDraft}
                placeholder={GOAL_PLACEHOLDER}
                autoCapitalize="sentences"
                maxLength={MAX_GOAL_CHARS}
                returnKeyType="done"
                onSubmitEditing={addGoal}
              />
              <OutlineButton label={ADD_GOAL} disabled={draft.trim().length === 0} onPress={addGoal} />
            </View>
          )}
        </Card>
      </View>

      {/* How the tutor treats you, beside what it knows about you. The same dial
          as the one on Profile's learning card, through the same door. */}
      <Card style={st.section}>
        <ChoiceRow<Strictness>
          first
          title={STRICTNESS_ROW}
          options={STRICTNESS_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
          active={strictnessOf(profile)}
          onChange={(value) => update(withStrictness(profile, value))}
          gloss={STRICTNESS_OPTIONS.find((option) => option.value === strictnessOf(profile))?.gloss ?? ''}
          accessibilityLabel={STRICTNESS_ROW}
        />
      </Card>

      {/* One plain sentence on what leaves the phone, at the foot, where a
          footnote belongs. It names the slice the agent actually sends. */}
      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(6) }]}>{WHAT_LEAVES}</Text>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
  section: { marginTop: space(6) },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2) },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paper.lineOnCard },
  factWords: { flex: 1, minWidth: 0 },
  all: { marginTop: space(4) },
  add: { marginTop: space(3), gap: space(3) },
});
