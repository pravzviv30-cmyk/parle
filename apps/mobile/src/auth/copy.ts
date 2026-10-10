/**
 * The sentences the auth screens say for themselves — F374.
 *
 * Sign up has always told a learner what an account is for, one line under its
 * headline. Sign in said "Welcome back" and nothing else, which is the wrong
 * way round: the returning learner is the one being asked to remember a
 * password, and they are the one who was never told what it opens.
 *
 * The line lives here rather than inline for the same reason `busyLabel.ts`
 * does. A sentence a test can import is a sentence the copy rules can be held
 * against, and this one is held to all four of them: no em dash, no digit, no
 * word from the guilt list, and short enough to read in a glance.
 *
 * It promises nothing the product does not already do. The account restores the learner's existing state, and this
 * short invitation describes that return without inventing progress.
 */

/** Under "Welcome back": what is behind the door, in one line. */
export const SIGN_IN_PURPOSE = 'Pick up where you left off';

/** Use a saved name only. An email address is never treated as somebody's name. */
export function welcomeBackGreeting(firstName: string | null | undefined): string {
  const name = firstName?.trim();
  return name ? `Welcome back, ${name}` : 'Welcome back';
}
