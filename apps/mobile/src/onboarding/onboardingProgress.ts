import { FULL_SETUP, FIVE_SETUP } from './flow.ts';
import { PAGES } from './answers.ts';

const SKIPPABLE_STEPS = new Set(['reason', 'start-level', 'confidence', 'focus', 'time', 'remind']);

export interface OnboardingProgressValue {
  /** Completed fraction, 0..1. Only the durable completion handoff is 1. */
  fraction: number;
  step: number;
  total: number;
  complete: boolean;
}

/**
 * One ordered route model for all onboarding chrome. A visible current step
 * earns half its unit; preceding/explicitly completed steps earn a whole unit.
 * This keeps the first page visible above zero and the final page below 100%.
 * Conditional routes are removed from the denominator, never counted as work
 * done. Repeated practice/feedback exchanges share the same two onboarding
 * steps. Re-entering an earlier page never removes durable completed steps.
 */
export function onboardingSteps({ five = false, signedIn = false, skipStreak = false, skipped = [], repair = false, eligibilityOnly = false }: {
  five?: boolean; signedIn?: boolean; skipStreak?: boolean; skipped?: readonly string[]; repair?: boolean; eligibilityOnly?: boolean;
} = {}): readonly string[] {
  if (eligibilityOnly) return ['age'];
  if (repair) return PAGES;
  return [
    ...(five ? FIVE_SETUP : FULL_SETUP), 'choose-tutor', 'practice', 'recap',
    ...(!skipStreak ? ['remind'] : []), 'keep', ...(!signedIn ? ['account', 'account-welcome'] : []),
  ].filter(step => !(SKIPPABLE_STEPS.has(step) && skipped.includes(step)));
}

export function onboardingProgress({ page, completed = [], complete = false, ...conditions }: {
  page: string;
  completed?: readonly string[];
  complete?: boolean;
  five?: boolean;
  signedIn?: boolean;
  skipStreak?: boolean;
  repair?: boolean;
  eligibilityOnly?: boolean;
  skipped?: readonly string[];
}): OnboardingProgressValue {
  const steps = onboardingSteps(conditions);
  const canonical = page === 'signup' || page === 'signin' ? 'account'
    : page === 'home' ? 'keep' : page === 'frequency' ? 'time'
      : page === 'save' || page === 'first-line' ? 'hear-it' : page;
  const index = Math.max(0, steps.indexOf(canonical));
  const done = new Set(completed.filter(step => steps.includes(step)));
  for (const step of steps.slice(0, index)) done.add(step);
  // The displayed step is distinct from completed work, including on back.
  const count = done.size + (done.has(steps[index]!) ? 0 : 0.5);
  return {
    fraction: complete ? 1 : Math.min(count / steps.length, (steps.length - 0.5) / steps.length),
    step: index + 1,
    total: steps.length,
    complete,
  };
}
