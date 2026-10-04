import type { PreAccountOnboardingDraft, PreAccountPage } from './preAccountDraft.ts';

export const FULL_SETUP: readonly PreAccountPage[] = [
  'hear-it',
  'reason',
  'start-level',
  'time',
  'frequency',
  'plan',
];
export const FIVE_SETUP: readonly PreAccountPage[] = [
  'hear-it',
  'reason',
  'time',
  'frequency',
  'plan',
];
export function earnedChoices(draft: PreAccountOnboardingDraft, five = false): number {
  return [
    draft.drink,
    draft.reason,
    ...(five ? [] : [draft.startLevel]),
    draft.minutes,
    draft.frequency,
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
