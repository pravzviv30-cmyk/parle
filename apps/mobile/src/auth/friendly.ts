/**
 * Everything a server says, in the app's own words.
 *
 * Three sources used to reach a learner unedited: any GoTrue message under 120
 * characters, the token server's JSON body on a failed account deletion, and a
 * Google failure that told the learner to check a vendor's provider setup.
 * None of the three is written for the person reading it, and the first two can
 * carry a database error, a column name or an internal identifier.
 *
 * So the fallthrough here is closed. A message this file does not recognise
 * becomes the generic sentence, whatever its length. That trade costs detail,
 * and where the detail was a true instruction the learner could act on, it is
 * bought back as a translation rather than lost: a password that is too short,
 * a password missing a character class, a password the account already has, a
 * password that is easy to guess, and a deletion that needs a fresh sign-in all
 * keep what they were telling somebody to do.
 *
 * The code is read before the prose. GoTrue sends a stable `code` on every
 * error that came back from its API, and matching English sentences instead is
 * how two refusals were mislabelled: "New password should be different from
 * the old password." matched nothing and became the generic apology, and
 * "Password should contain at least one character of each: …" contains both
 * "password" and "at least", so a learner whose project sets
 * password_required_characters was told to type a longer password that would
 * fail again at any length. Prose is kept as the second pass, because errors
 * raised before a response arrives — a dropped connection above all — carry no
 * code at all, and an older project can send a message with a code this SDK
 * does not know.
 *
 * A duration is a promise. Nothing here names a wait unless the window it
 * refers to is written down in this repo and the test reads it there: the
 * fresh-sign-in window is `maximumAgeMs` in `accountDeletion.ts`, and the
 * deletion budget is `RATE_LIMITS.deletionUser` in `rateLimit.ts`, which is
 * three tries per day. A GoTrue rate limit belongs to the project's own
 * settings, which this repo does not hold, so that line names no duration.
 *
 * There is no console call in this file on purpose. The auth layer may not log
 * values at all (`tokenHygiene.test.ts`), because a sign-in path holds tokens,
 * codes and email addresses, and a device log outlives the session that wrote
 * it. The server's own logs are where a refused deletion is diagnosed.
 */

/** What an unrecognised failure becomes. Never a code, never a scold. */
export const GENERIC_FAILURE = 'Something went sideways. Try again in a moment.';

/**
 * Google could not be reached. Both halves of the platform split say this, and
 * it points at the two things the learner can actually do.
 */
export const GOOGLE_START_FAILED = 'Google sign in could not start. Try again, or use your email and password.';

/**
 * What the adapter knows about a provider failure.
 *
 * The Supabase SDK's `AuthError` satisfies this as it stands: `code` is
 * GoTrue's stable identifier, `message` is its English, and `reasons` is the
 * extra detail on `AuthWeakPasswordError` saying which rule the password broke
 * ('length', 'characters' or 'pwned'). Passing the error itself rather than
 * `error.message` is the whole point — the adapter already held all three.
 */
export type ProviderFailure = {
  readonly message?: string | undefined;
  readonly code?: string | undefined;
  readonly reasons?: readonly string[] | undefined;
};

const CREDENTIALS = 'That email and password do not match an account.';
const ALREADY_REGISTERED = 'That email already has an account. Sign in instead.';
const NOT_CONFIRMED = 'That email has not been confirmed yet. Check your inbox for the confirmation link.';
const CONNECTION = 'The connection dropped. Check your internet and try again.';
// No duration: a GoTrue rate limit window is set per project and this repo does
// not hold that setting, so any number here would be a guess dressed as a fact.
const TOO_MANY_TRIES = 'Too many tries in a row. Wait a while, then try again.';
const PASSWORD_SHORT = 'That password is too short. Try a longer one.';
const PASSWORD_MIX = 'That password needs a wider mix. Try adding capital letters, numbers or symbols.';
const PASSWORD_GUESSABLE = 'That password is easy to guess. Try a different one.';
const PASSWORD_SAME = 'That is the password you already have. Choose a different one.';
const PASSWORD_REFUSED = 'That password was refused. Try a different one.';

/**
 * The password refusals, by GoTrue's own English.
 *
 * Each pattern is tight enough to tell the three apart: the character-class
 * refusal is checked before the length one because it also says "at least",
 * and the length one now needs a number in front of "characters" so it cannot
 * swallow it.
 */
function passwordProse(m: string): string | null {
  if (m.includes('contain at least one character')) return PASSWORD_MIX;
  if (/at least \d+ characters/.test(m)) return PASSWORD_SHORT;
  if (m.includes('different from the old password')) return PASSWORD_SAME;
  if (m.includes('known to be weak') || m.includes('easy to guess')) return PASSWORD_GUESSABLE;
  return null;
}

/**
 * A weak-password refusal, by the reason GoTrue gave. A project can require a
 * length, a character mix, or both, and only the reason says which one this
 * learner just tripped. Without a reason the English is tried, and a password
 * refused for a rule we cannot name still gets an instruction that works:
 * choose a different one.
 */
function weakPassword(reasons: readonly string[] | undefined, m: string): string {
  if (reasons?.includes('characters')) return PASSWORD_MIX;
  if (reasons?.includes('length')) return PASSWORD_SHORT;
  if (reasons?.includes('pwned')) return PASSWORD_GUESSABLE;
  return passwordProse(m) ?? PASSWORD_REFUSED;
}

/** Provider errors, translated. Anything unrecognised becomes the generic. */
export function friendly(failure: string | ProviderFailure | null | undefined): string {
  const input: ProviderFailure = typeof failure === 'string' ? { message: failure } : (failure ?? {});
  const m = (input.message ?? '').toLowerCase();

  // First pass: GoTrue's stable code, which does not change when its English
  // does and does not need a substring to be guessed at.
  switch (input.code) {
    case 'invalid_credentials':
      return CREDENTIALS;
    case 'user_already_exists':
    case 'email_exists':
      return ALREADY_REGISTERED;
    case 'email_not_confirmed':
      return NOT_CONFIRMED;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return TOO_MANY_TRIES;
    case 'same_password':
      return PASSWORD_SAME;
    case 'weak_password':
      return weakPassword(input.reasons, m);
    default:
      break;
  }

  // Second pass: the English, for the failures that arrive without a code —
  // a dropped connection, and anything an older project answers with.
  if (m.includes('invalid login credentials')) return CREDENTIALS;
  if (m.includes('already registered')) return ALREADY_REGISTERED;
  if (m.includes('email not confirmed')) return NOT_CONFIRMED;
  if (m.includes('rate limit')) return TOO_MANY_TRIES;
  if (m.includes('network') || m.includes('failed to fetch')) return CONNECTION;
  // The project's own password policy can be stricter than this app's eight
  // characters, and it is the only provider refusal the learner can fix on the
  // spot. Saying "something went sideways" to somebody typing a short password
  // would hide the one thing they needed to know.
  return passwordProse(m) ?? GENERIC_FAILURE;
}

/**
 * A refused account deletion, by status.
 *
 * The token server sends useful sentences here and they are still not rendered:
 * the body is attacker-shaped input from the app's point of view, and the same
 * route can be answered by a proxy that knows nothing about this product. The
 * status is enough to say the true thing, so each one is mapped rather than
 * flattened, and every line leaves the learner somewhere to go.
 */
export function deletionFailure(status: number): string {
  if (status === 401) return 'Sign in again before deleting your account.';
  // The server requires a sign-in within the last five minutes. A learner told
  // only that it did not work would keep tapping a button that cannot succeed.
  if (status === 403) return 'For safety this needs a fresh sign in. Sign in again, then delete the account within five minutes.';
  // Three deletion attempts per account per day, twenty per address per day.
  // "Give it a minute" sent a learner back to a button that stays shut for up
  // to a day, so the line says the window the server actually keeps.
  if (status === 429) return 'Account deletion has been tried too many times today. Nothing was changed. Try again in a day.';
  if (status === 503) return 'Account deletion is not available right now. Nothing was changed. Try again later.';
  return 'Your account could not be deleted right now. Nothing was changed. Try again in a moment.';
}
