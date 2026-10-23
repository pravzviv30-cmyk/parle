/**
 * Learning preferences: the standing choices about how a conversation goes
 * (P2 · Luvani, 2026-10-19). A root stack sibling pushed from Profile.
 *
 * Everything here used to be inline on Profile: the daily goal, the correction
 * style and Prefer typing on the learning card, and Simpler French at the foot
 * of the voice sheet. They moved together, unchanged in what they read and
 * write, and the conversation starting point joined them.
 *
 * ## One stored value, one way of saying it
 *
 * Correction style is edited here and on the tutor memory screen, on purpose,
 * and both rows are the same `ChoiceRow` over `withStrictness`, word for word:
 * `settings/responsibilities.test.ts` holds them to it. The speaking target has
 * exactly one editor, and it is this screen.
 *
 * ## The starting point never moves the earned level
 *
 * `withStatedLevel` writes `practicePreferences.level` alone. It steers which
 * conversations are suggested and never touches the brain's estimate, the
 * stats or a mission's independence, which `profile/store.ts` guarantees. The
 * footer says so in the learner's terms.
 *
 * ## The goal reorders suggestions, never the earned level
 *
 * `withOnboardingGoal` changes or clears the onboarding goal. It puts that
 * goal's scenes first in what Home and Speak suggest and frames the tutor, and
 * moves nothing else. It is clocked like the other preferences, so a newer
 * change or clear wins across devices.
 *
 * Layout only. Every word is a module's and every write goes through the
 * store's own `with*` door.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Choice, OptionRow, PillButton, Sheet as BottomSheet } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { withDailyGoal, withOnboardingGoal, withPreferTyping, withStatedLevel } from '../profile/store.ts';
import { goalOf } from '../onboarding/goalLine.ts';
import { DAILY_GOAL_ROW, dailyGoalOf, goalLine } from '../profile/dailyGoal.ts';
import { GOAL_CHOICES, goalChoiceOf } from '../game/profileStatsView.ts';
import { PREFER_TYPING_ROW, PREFER_TYPING_SUB, prefersTyping } from '../profile/typing.ts';
import { STATED_LEVEL_FOOTER, STATED_LEVEL_OPTIONS, practicePreferencesOf } from '../profile/practicePreferences.ts';
import { PACE_ROW, PACE_SUB, paceOf, withPace } from '../tutor/pace.ts';
import {
  STRICTNESS_OPTIONS,
  STRICTNESS_ROW,
  strictnessOf,
  withStrictness,
  type Strictness,
} from '../tutor/strictness.ts';
import { ChoiceRow } from './ChoiceRow.tsx';
import { SettingsAppearance } from './SettingsAppearance.tsx';
import { SettingsGroup } from './SettingsGroup.tsx';
import { SettingsRow } from './SettingsRow.tsx';
import { SwitchRow } from './SwitchRow.tsx';
import {
  GOAL_FOOTER,
  GOAL_GROUP,
  GOAL_OPTIONS,
  GOAL_ROW,
  GOAL_SHEET_TITLE,
  LEARNING_PREFERENCES_INTRO,
  LEARNING_PREFERENCES_TITLE,
  ROUTINE_GROUP,
  STARTING_POINT_GROUP,
  STARTING_POINT_ROW,
  STARTING_POINT_SHEET_TITLE,
  TUTOR_HELPS_GROUP,
  onboardingGoalTitle,
  statedLevelTitle,
} from './profileView.ts';

export function LearningPreferencesScreen() {
  const { colors } = useMainAppearance();
  const nav = useNavigation<{ goBack: () => void; canGoBack: () => boolean; navigate: (screen: string, params?: object) => void }>();
  const { profile, update } = useProfile();
  const [choosing, setChoosing] = useState(false);
  const [choosingGoal, setChoosingGoal] = useState(false);
  const stated = practicePreferencesOf(profile).level;
  const goal = goalOf(profile);

  // Android's hardware back closes the chooser in place rather than leaving.
  useHardwareBack(choosing, () => setChoosing(false));
  useHardwareBack(choosingGoal, () => setChoosingGoal(false));

  return (
    <SettingsAppearance>
    <ScrollScreen
      ground={colors.background}
      bottom="inset"
      header={<ScreenHeader back={{ onPress: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Profile')), label: 'Back to Profile' }} title={LEARNING_PREFERENCES_TITLE} ink={colors.text} muted={colors.muted} backAppearance={{ disc: colors.surface, mark: colors.text }} />}
    >
      <Text style={[type.small, { color: colors.muted, paddingHorizontal: space(4), marginBottom: space(5) }]}>{LEARNING_PREFERENCES_INTRO}</Text>

      <SettingsGroup first title={ROUTINE_GROUP}>
        {/* The daily goal as five choices (D5): none, then the four tiers,
            gentlest first, each saying its size in words. What the chosen
            one means is written beneath. */}
        <View style={st.goal} accessibilityRole="radiogroup" accessibilityLabel={DAILY_GOAL_ROW}>
          <Text accessibilityRole="header" style={[type.body, { color: colors.text }]}>{DAILY_GOAL_ROW}</Text>
          {GOAL_CHOICES.map((choice) => (
            <Choice
              key={choice.key}
              compact
              ground="card"
              title={choice.title}
              detail={choice.detail}
              selected={goalChoiceOf(dailyGoalOf(profile)) === choice.key}
              onPress={() => update(withDailyGoal(profile, choice.minutes))}
            />
          ))}
          <Text style={[type.small, { color: colors.muted }]}>{goalLine(profile)}</Text>
        </View>
      </SettingsGroup>

      <SettingsGroup title={TUTOR_HELPS_GROUP}>
        <ChoiceRow<Strictness>
          first
          title={STRICTNESS_ROW}
          options={STRICTNESS_OPTIONS.map((option) => ({ key: option.value, label: option.label }))}
          active={strictnessOf(profile)}
          onChange={(value) => update(withStrictness(profile, value))}
          gloss={STRICTNESS_OPTIONS.find((option) => option.value === strictnessOf(profile))?.gloss ?? ''}
          accessibilityLabel={STRICTNESS_ROW}
        />
        <SwitchRow
          title={PACE_ROW}
          sub={PACE_SUB}
          value={paceOf(profile) === 'slow'}
          onChange={(next) => update(withPace(profile, next ? 'slow' : 'normal'))}
          accessibilityLabel={PACE_ROW}
        />
        {/* It keeps every spoken path open: the circle is still there, and
            the tutor still speaks. */}
        <SwitchRow
          title={PREFER_TYPING_ROW}
          sub={PREFER_TYPING_SUB}
          value={prefersTyping(profile)}
          onChange={(next) => update(withPreferTyping(profile, next))}
          accessibilityLabel={PREFER_TYPING_ROW}
        />
      </SettingsGroup>

      <SettingsGroup title={GOAL_GROUP} footer={GOAL_FOOTER}>
        <SettingsRow first label={GOAL_ROW} sub={onboardingGoalTitle(goal)} onPress={() => setChoosingGoal(true)} />
      </SettingsGroup>

      <SettingsGroup title={STARTING_POINT_GROUP} footer={STATED_LEVEL_FOOTER} style={st.last}>
        <SettingsRow first label={STARTING_POINT_ROW} sub={statedLevelTitle(stated)} onPress={() => setChoosing(true)} />
      </SettingsGroup>
    </ScrollScreen>
    <BottomSheet visible={choosing} title={STARTING_POINT_SHEET_TITLE} onClose={() => setChoosing(false)} surface={colors.surface} ink={colors.text} footer={<PillButton label="Done" tone="brand" onPress={() => setChoosing(false)} />}>
      <Text style={[type.body, { color: colors.muted }]}>{STATED_LEVEL_FOOTER}</Text>
      {STATED_LEVEL_OPTIONS.map((option) => (
        <OptionRow key={option.key} title={option.title} selected={stated === option.key}
          onPress={() => update(withStatedLevel(profile, option.key))} />
      ))}
    </BottomSheet>
    <BottomSheet visible={choosingGoal} title={GOAL_SHEET_TITLE} onClose={() => setChoosingGoal(false)} surface={colors.surface} ink={colors.text} footer={<PillButton label="Done" tone="brand" onPress={() => setChoosingGoal(false)} />}>
      <Text style={[type.body, { color: colors.muted }]}>{GOAL_FOOTER}</Text>
      {GOAL_OPTIONS.map((option) => (
        <OptionRow key={option.title} title={option.title} selected={goal === option.key}
          onPress={() => update(withOnboardingGoal(profile, option.key))} />
      ))}
    </BottomSheet>
    </SettingsAppearance>
  );
}

const st = StyleSheet.create({
  goal: { paddingHorizontal: space(4), paddingVertical: space(3.25), gap: space(2) },
  last: { paddingBottom: space(6) },
});
