/**
 * What each auth button says while it is waiting.
 *
 * A greyed-out button with its original label on it is indistinguishable from a
 * broken one: the tap did nothing the learner can see, so the next thing they
 * try is tapping it again. The label is the whole feedback, which is the same
 * trade ProfileTab already makes with "Verifying…".
 *
 * The words live here rather than in the three screens for one reason worth the
 * file: a screen holds one flag, and one flag greying every button is correct,
 * but one flag *speaking* for every button is a lie. The screens pass the wait
 * that belongs to each button, and `busyLabel.test.ts` holds them to it.
 *
 * Google gets a relabel too, and it is the one that earns it most. OAuth is the
 * longest wait in the app and the least bounded: a browser sheet has to open
 * over the app, a page has to load, and a person has to choose an account. When
 * the sheet is slow to appear there is nothing else on screen to say why, and
 * "Waiting for Google…" names the thing being waited on, so a learner who never
 * sees a browser knows which step did not happen.
 */

export type AuthAction = 'signIn' | 'createAccount' | 'saveNewPassword' | 'google' | 'apple' | 'sendReset';

const LABELS: Record<AuthAction, { readonly ready: string; readonly busy: string }> = {
  signIn: { ready: 'Sign in', busy: 'Signing in…' },
  createAccount: { ready: 'Create account', busy: 'Creating account…' },
  saveNewPassword: { ready: 'Save new password', busy: 'Saving…' },
  google: { ready: 'Continue with Google', busy: 'Waiting for Google…' },
  // Apple's wait is shorter than Google's — the sheet is the system's own and
  // there is no browser to load — but it is still a wait somebody can start
  // and then see nothing, and the sheet can take a moment to animate up.
  apple: { ready: 'Continue with Apple', busy: 'Waiting for Apple…' },
  sendReset: { ready: 'Send reset link', busy: 'Sending…' },
};

export function authButtonLabel(action: AuthAction, busy: boolean): string {
  return busy ? LABELS[action].busy : LABELS[action].ready;
}
