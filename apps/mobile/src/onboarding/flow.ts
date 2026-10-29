import type { PreAccountOnboardingDraft, PreAccountPage } from './preAccountDraft.ts';

/**
 * The setup pages, in order: welcome, purpose, level, speaking confidence,
 * practice focus, daily goal and plan. The days-a-week page is gone; a draft saved on it
 * resumes on the daily goal (`PreAccountOnboarding.tsx`), and the field stays on
 * the draft because the holdings row names it.
 */
export const FULL_SETUP: readonly PreAccountPage[] = ['hear-it', 'reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'plan'];
/** The `EXPO_PUBLIC_ONBOARDING_VARIANT=five` experiment keeps its name: it leaves out the level. */
export const FIVE_SETUP: readonly PreAccountPage[] = ['hear-it', 'reason', 'interests', 'confidence', 'focus', 'time', 'plan'];
/** Only answers the current flow asks count; a retired drink answer adds nothing. */
export function earnedChoices(draft: PreAccountOnboardingDraft, five = false): number {
  return [
    draft.reason,
    draft.interests?.length ? draft.interests : null,
    ...(five ? [] : [draft.startLevel]),
    draft.speakingConfidence,
    draft.practiceFocus,
    draft.minutes,
  ].filter((value) => value != null).length;
}
/** Device history only chooses the signed-out door; account state chooses onboarding. */
export function signedOutEntry(used: boolean): 'signin' | 'welcome' {
  return used ? 'signin' : 'welcome';
}
export function accountEntry(
  profileExists: boolean,
  complete: boolean,
): 'new-onboarding' | 'repair' | 'app' {
  return !profileExists ? 'new-onboarding' : complete ? 'app' : 'repair';
}
export function nextSetup(page: PreAccountPage, five = false): PreAccountPage {
  const order = five ? FIVE_SETUP : FULL_SETUP;
  const index = order.indexOf(page);
  return order[Math.min(index + 1, order.length - 1)] ?? 'hear-it';
}
/** Name the actual next page, including the shorter setup variant. */
export function nextSetupLabel(page: PreAccountPage, five = false): string {
  const next = nextSetup(page, five);
  return next === 'plan' ? 'See your plan' : 'Continue';
}
/**
 * The step a visible Back returns to, or null on the first step (F915, LR-13).
 * The tutor page goes back to the plan; a guest page (practice, recap, keep)
 * has no setup step behind it.
 */
export function previousStep(page: PreAccountPage, order: readonly PreAccountPage[]): PreAccountPage | null {
  if (page === 'choose-tutor') return 'plan';
  const index = order.indexOf(page);
  return index > 0 ? order[index - 1]! : null;
}
