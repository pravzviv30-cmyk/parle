import type { PreAccountOnboardingDraft, PreAccountPage } from './preAccountDraft.ts';

/**
 * The setup pages, in order: the promise, where, level, the daily goal and the
 * plan (founder decision D5). The days-a-week page is gone; a draft saved on it
 * resumes on the daily goal (`PreAccountOnboarding.tsx`), and the field stays on
 * the draft because the holdings row names it.
 */
export const FULL_SETUP: readonly PreAccountPage[] = ['hear-it', 'reason', 'start-level', 'time', 'plan'];
/** The `EXPO_PUBLIC_ONBOARDING_VARIANT=five` experiment keeps its name: it leaves out the level. */
export const FIVE_SETUP: readonly PreAccountPage[] = ['hear-it', 'reason', 'time', 'plan'];
/** The answers a learner has given so far: the drink, where, the level (not in the short variant) and the goal. */
export function earnedChoices(draft: PreAccountOnboardingDraft, five = false): number {
  return [
    draft.drink,
    draft.reason,
    ...(five ? [] : [draft.startLevel]),
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
