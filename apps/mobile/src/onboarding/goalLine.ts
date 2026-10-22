/**
 * The one line that says a suggested scene was chosen for the learner's
 * onboarding goal. Shared by Today's hero, Speak's Start and the empty Journey
 * card, so the three say it the same way.
 *
 * Only drawn when core's `nextScene` reports `picked: 'goal'`. A learner
 * learning just because, or with no goal on file, walks the spine and is told
 * nothing extra.
 */
import { isLearnerGoal, type LearnerGoal } from '@luvani/core';

export const GOAL_PICK_LINES: Readonly<Record<Exclude<LearnerGoal, 'because'>, string>> = {
  food: 'Picked for ordering food and drinks',
  trip: 'Picked for your trip',
  family: 'Picked for talking with family',
  moving: 'Picked for your move',
  work: 'Picked for French at work',
};

export function goalPickLine(goal: LearnerGoal | null | undefined): string | null {
  if (!isLearnerGoal(goal) || goal === 'because') return null;
  return GOAL_PICK_LINES[goal];
}

/** The goal a stored profile carries, or null when it is missing or unknown. */
export function goalOf(profile: { onboardingGoal?: unknown } | null | undefined): LearnerGoal | null {
  const goal = profile?.onboardingGoal;
  return isLearnerGoal(goal) ? goal : null;
}
