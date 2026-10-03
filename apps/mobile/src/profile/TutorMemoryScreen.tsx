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

import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Field, GhostButton, Label, OutlineButton } from '../components.tsx';
import { ConfirmSheet, ScreenHeader, ScrollScreen } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { paper, space, type, HIT } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { memoryPaused } from '@luvani/brain/profile';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { ChoiceRow } from '../settings/ChoiceRow.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { STRICTNESS_OPTIONS, STRICTNESS_ROW, strictnessOf, withStrictness, type Strictness } from '../tutor/strictness.ts';
import {
  withMemoryPaused,
  MAX_GOAL_CHARS,
  MAX_LEARNER_GOALS,
  visibleFacts,
  withFactForgotten,
  withFactEdited,
  withGoalEdited,
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
  MEMORY_PAUSE_TITLE,
  MEMORY_PAUSE_SUB,
  memoryEmptyLine,
  REMOVE_GOAL,
  WHAT_LEAVES,
  MEMORY_SCOPE,
  memoryLabel,
  memorySummary,
} from './tutorMemory.ts';

export function TutorMemoryScreen({ onBack }: { onBack: () => void }) {
  const { profile, update, updateMemory } = useProfile();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ kind: 'fact' | 'goal'; original: string; text: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useHardwareBack(clearing || editing !== null, () => { setClearing(false); setEditing(null); });
  const name = tutorNameOf(profile);
  const facts = visibleFacts(profile);
  const room = profile.learnerGoals.length < MAX_LEARNER_GOALS;

  const commitMemory = async (edit: Parameters<typeof updateMemory>[0]): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setMemoryError(null);
    const ok = await updateMemory(edit).catch(() => false);
    savingRef.current = false;
    if (!alive.current) return false;
    setSaving(false);
    if (!ok) setMemoryError('Your memory change could not be saved. It has not been applied. Try again.');
    return ok;
  };
  const addGoal = async () => {
    const text = draft;
    if (await commitMemory((current) => withLearnerGoal(current, text))) setDraft('');
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollScreen avoidKeyboard header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>{memoryLabel(name)}</Text>
      {/* How much is held, in words and never a count, from the same module the
          Profile card used to show it on. It sits under the title because that
          is the question somebody arriving here is asking. */}
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{memorySummary(profile, name)}</Text>
      <Card style={st.card}>
        <SwitchRow first title={MEMORY_PAUSE_TITLE} accessibilityLabel={MEMORY_PAUSE_TITLE} value={memoryPaused(profile.brain)} disabled={saving} onChange={(paused) => { void commitMemory((current) => withMemoryPaused(current, paused)); }} sub={MEMORY_PAUSE_SUB} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Edit or forget a remembered detail below. Changes apply to your next conversation.</Text>
        <GhostButton label={detailsOpen ? 'Hide memory details' : 'What memory uses'} onPress={() => setDetailsOpen(!detailsOpen)} />
        {detailsOpen && <View>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{WHAT_LEAVES}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{MEMORY_SCOPE}</Text>
        </View>}
      </Card>
      {(saving || memoryError) && <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink, marginTop: space(3) }]}>{memoryError ?? 'Saving your memory change.'}</Text>}
      <Card tone="journal" style={st.card}>
        {facts.length === 0 ? (
          <Text style={[type.body, { color: paper.ink }]}>{memoryEmptyLine(profile)}</Text>
        ) : (
          facts.map((fact, index) => (
            <View key={`${fact.notedAt}:${fact.en}`} style={[st.fact, index > 0 && st.divided]}>
              <View style={st.factWords}>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{fact.en}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{KIND_GLOSS[fact.kind]}</Text>
              </View>
              <GhostButton
                label="Edit"
                accessibilityLabel={`Edit: ${fact.en}`}
                onPress={() => setEditing({ kind: 'fact', original: fact.en, text: fact.en })}
              />
              <GhostButton
                label={FORGET_ONE}
                color={paper.ink}
                accessibilityLabel={`${FORGET_ONE}: ${fact.en}`}
                onPress={() => { void commitMemory((current) => withFactForgotten(current, fact.en)); }}
              />
            </View>
          ))
        )}
      </Card>
      {facts.length > 0 && (
        <View style={st.all}>
          <GhostButton label={FORGET_ALL} onPress={() => setClearing(true)} />
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
                label="Edit"
                accessibilityLabel={`Edit goal: ${goal}`}
                onPress={() => setEditing({ kind: 'goal', original: goal, text: goal })}
              />
              <GhostButton
                label={REMOVE_GOAL}
                color={paper.ink}
                accessibilityLabel={`${REMOVE_GOAL}: ${goal}`}
                onPress={() => { void commitMemory((current) => withoutLearnerGoal(current, goal)); }}
              />
            </View>
          ))}
          {room && (
            <View style={st.add}>
              <Field
                label="Your next goal"
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
        <Text style={[type.small, { color: paper.inkSoft }]}>The same correction style is shown in Profile. Changes apply to your next conversation.</Text>
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
      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(6) }]}>Changes apply to your next conversation. Clearing details keeps your goals, correction preferences and saved conversations.</Text>
      {editing !== null && <Card style={st.section}>
        <Field label={editing.kind === 'fact' ? 'Edit remembered detail' : 'Edit your goal'} placeholder={editing.kind === 'fact' ? 'e.g. I am learning French for travel' : GOAL_PLACEHOLDER} value={editing.text} maxLength={MAX_GOAL_CHARS} onChangeText={(text) => setEditing({ ...editing, text })} autoFocus />
        <OutlineButton label="Save changes" disabled={editing.text.trim().length === 0} onPress={() => {
          const choice = editing;
          void commitMemory((current) => choice.kind === 'fact' ? withFactEdited(current, choice.original, choice.text) : withGoalEdited(current, choice.original, choice.text)).then((ok) => { if (ok && alive.current) setEditing(null); });
        }} />
        <GhostButton label="Cancel edit" onPress={() => setEditing(null)} />
      </Card>}
    </ScrollScreen>
    <ConfirmSheet visible={clearing} title="Clear remembered details?" body="Your tutor will stop using the details listed here and its remembered greeting. Your goals, learning progress and saved conversations will stay." confirmLabel={FORGET_ALL} cancelLabel="Keep details" onConfirm={() => { void commitMemory(withMemoryCleared).then(() => { if (alive.current) setClearing(false); }); }} onCancel={() => setClearing(false)} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(4) },
  section: { marginTop: space(6) },
  fact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), minHeight: HIT, paddingVertical: space(2) },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: paper.lineOnCard },
  factWords: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  all: { marginTop: space(4) },
  add: { marginTop: space(3), gap: space(3) },
});
