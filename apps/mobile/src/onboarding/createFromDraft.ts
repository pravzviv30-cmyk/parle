/**
 * The pre-account draft, written into a brand-new account (spine contract
 * section 3). Pure: `App.tsx`'s `PreAccountProfileBootstrap` calls these and
 * does the writing, in order, once there is an account to write under.
 *
 * Every answer goes through a door that already exists, and no field is new:
 *   - the reason becomes `motivation`, the tag the old why page wrote;
 *   - the minutes become `dailyGoalMin` via `OnboardingAnswers`;
 *   - the starting level becomes `brain.cefr.estimate`, low confidence, which
 *     `openingRungFor` already turns into a first rung (the ladder gains no input);
 *   - the seeded goal is written through `withLearnerGoal`;
 *   - the voice through `withChosenVoice`, so a default nobody changed still
 *     reads "never chosen" only if nobody touched it;
 *   - the first name becomes the profile name;
 *   - the reminder goes through `saveReminder`, always `enabled: false`, because
 *     no notification permission has been asked for.
 *
 * Kept apart from `plan.ts` on purpose: this module reaches the profile store,
 * and the plan page must not load anything that can (`disclosure.test.ts`).
 */

import { carryPreferenceEdits, createStoredProfile, type StoredProfile } from '../profile/store.ts';
import { withLearnerGoal, withMemoryPaused } from '../profile/memory.ts';
import type { StoredReminder } from '../reminders/reminder.ts';
import { withChosenVoice } from './voiceStep.ts';
import { SEEDED_GOAL, levelOf, minutesOf, reminderOf, startEstimate } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

export function profileFromDraft(draft: PreAccountOnboardingDraft, now = Date.now()): StoredProfile {
  const minutes = minutesOf(draft);
  const built = createStoredProfile(
    {
      name: draft.firstName,
      ageConfirmed: draft.ageConfirmed,
      motivation: draft.reason,
      dailyGoalMin: minutes === 'none' ? null : minutes,
    },
    now,
  );
  // Days a week is no longer asked (founder decision D5, F752): the daily goal
  // replaced it, so a new profile carries no days-a-week answer at all.
  const placed: StoredProfile = {
    ...built,
    onboardingGoal: draft.reason, onboardingDrink: draft.drink ?? null,
    brain: { ...built.brain, cefr: { ...built.brain.cefr, ...startEstimate(levelOf(draft)) } },
  };
  const chosen = withChosenVoice(placed, draft.tutorVoice);
  const voiced = carryPreferenceEdits(chosen, withMemoryPaused(chosen, draft.rememberLearning !== true, now));
  return draft.reason === null ? voiced : carryPreferenceEdits(voiced, withLearnerGoal(voiced, SEEDED_GOAL[draft.reason]));
}

/** The reminder time chosen on the plan, saved off until the OS has said yes. */
export function reminderFromDraft(draft: PreAccountOnboardingDraft): StoredReminder {
  return { enabled: draft.reminderEnabled === true, time: reminderOf(draft), ...(draft.reminderDays?.length ? { days: draft.reminderDays } : {}) };
}
