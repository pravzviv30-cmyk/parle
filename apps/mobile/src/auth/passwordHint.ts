/**
 * The one password rule, on screen while it is being met.
 *
 * The rule used to live in a placeholder, which disappears on the first
 * keystroke, and in an error the learner could only see by getting it wrong
 * first. So the requirement was visible exactly when it was not needed and
 * invisible while it was being typed.
 *
 * There is one requirement, so this is one line and not a checklist. It is a
 * hint rather than an error: nothing here is red, nothing here is announced as
 * a problem, and the met state is an affirmative rather than a tick the learner
 * has to decode.
 */

import { PASSWORD_MIN, passwordTooShort } from './validate.ts';

export interface PasswordHint {
  /** The line under the field. */
  readonly text: string;
  /** True once the rule is satisfied, which is what turns the line affirmative. */
  readonly met: boolean;
}

/** Steady while the rule is unmet, so the line does not flicker its wording as somebody types. */
const NOT_YET = `At least ${PASSWORD_MIN} characters`;

export function passwordHint(value: string): PasswordHint {
  return passwordTooShort(value) ? { text: NOT_YET, met: false } : { text: 'Long enough', met: true };
}
