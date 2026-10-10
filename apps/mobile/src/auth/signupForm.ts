import { looksLikeEmail, PASSWORD_MIN, passwordTooShort } from './validate.ts';

/** Advice never changes acceptance: these are the existing local policy checks. */
export function signupProblems(email: string, password: string, confirm: string) {
  return {
    email: looksLikeEmail(email) ? null : 'Enter a valid email address.',
    password: passwordTooShort(password) ? `Use at least ${PASSWORD_MIN} characters.` : null,
    confirm: !confirm ? 'Enter your password again.' : confirm !== password ? 'The passwords do not match. Try entering it again.' : null,
  };
}

export function signupReady(email: string, password: string, confirm: string): boolean {
  const problems = signupProblems(email, password, confirm);
  return problems.email === null && problems.password === null && problems.confirm === null;
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return !passwordTooShort(password) && confirm === password;
}

/** A software keyboard can occlude a full-height iOS scroll view. */
export function visibleFormHeight(top: number, height: number, keyboardTop: number | null): number {
  return keyboardTop === null ? height : Math.max(0, Math.min(height, keyboardTop - top));
}
