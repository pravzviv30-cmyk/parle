/**
 * The white chips on the plan band (DECISIONS.md UI-008, 2026-10-21, artboard
 * B-OB-Plan): the learner's own answers, in the artboard's order: goal,
 * interests, starting level, daily minutes, focus. A question left unanswered
 * adds no chip, a title already shown is not repeated, and nothing is invented.
 */
import { BOLD_GOALS, INTERESTS } from './boldChoices.ts';
import { FOCUS_OPTIONS, START_LEVELS, minutesOf } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

export function planChips(draft: PreAccountOnboardingDraft): string[] {
  const minutes = minutesOf(draft);
  const chips = [
    BOLD_GOALS.find(g => g.key === draft.reason)?.title,
    ...(draft.interests ?? []).map(key => INTERESTS.find(v => v.key === key)?.title),
    START_LEVELS.find(v => v.key === draft.startLevel)?.title,
    draft.minutes == null ? undefined : minutes === 'none' ? 'Choose each time' : `${minutes} min a day`,
    FOCUS_OPTIONS.find(v => v.key === draft.practiceFocus)?.title,
  ].filter((chip): chip is string => typeof chip === 'string' && chip.length > 0);
  return [...new Set(chips)];
}
