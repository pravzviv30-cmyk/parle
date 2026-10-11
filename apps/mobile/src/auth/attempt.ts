/**
 * One place where a provider call is allowed to fail.
 *
 * `supabase-js` returns `{ error }` for an `AuthError` and *re-throws* anything
 * else — a dropped socket, a DNS failure, a refused CORS preflight, a bug inside
 * the SDK. Every screen awaited those calls bare, so a throw escaped into a
 * floating promise and the screen's `pending` flag was never cleared: the button
 * sat on "Signing in…", greyed, with no message and no way back short of
 * reloading (F259). The learner reads that as a hung app.
 *
 * The fix belongs here rather than in three screens. `friendly.ts` already knows
 * how to turn any failure into a sentence, and it already takes the *whole*
 * error rather than a string, so a thrown `AuthError` keeps its stable `code`
 * and its weak-password `reasons` on the way through. Wrapping at the adapter
 * means every caller — including ones not written yet — gets a result instead of
 * a rejection, and the screens keep their single `setPending(null)`.
 *
 * There is no logging here, and there must not be. `tokenHygiene.test.ts` holds
 * the rule: this layer handles tokens, codes and email addresses, and a device
 * log outlives the session that wrote it.
 */

import { friendly, type ProviderFailure } from './friendly.ts';
import type { AuthAdapter, AuthResult } from './types.ts';

/**
 * What a thrown value can tell us. `AuthError` carries `code` and, when the
 * password was refused, `reasons`; a plain `Error` carries only `message`; a
 * string throw carries itself. Anything else has nothing to say and becomes the
 * generic sentence rather than `[object Object]`.
 */
export function toFailure(thrown: unknown): ProviderFailure {
  if (typeof thrown === 'string') return { message: thrown };
  if (typeof thrown !== 'object' || thrown === null) return {};
  const error = thrown as { message?: unknown; code?: unknown; reasons?: unknown };
  return {
    message: typeof error.message === 'string' ? error.message : undefined,
    code: typeof error.code === 'string' ? error.code : undefined,
    reasons: Array.isArray(error.reasons) ? error.reasons.filter((r): r is string => typeof r === 'string') : undefined,
  };
}

/** Run a provider call so that it resolves to a result whatever it does. */
export async function attempt(run: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await run();
  } catch (thrown) {
    return { ok: false, message: friendly(toFailure(thrown)) };
  }
}

/**
 * The adapter methods that answer with an `AuthResult`, and therefore the ones a
 * screen renders rather than crashes on.
 *
 * This list is checked against `types.ts` by `attempt.test.ts`: add a method to
 * the interface that returns `Promise<AuthResult>` and forget it here, and that
 * test fails. That is deliberate — F259 was one unguarded call, and the way it
 * comes back is somebody adding the eighth method and guarding seven.
 */
export const GUARDED_METHODS = [
  'signUpWithPassword',
  'resendConfirmation',
  'signInWithPassword',
  'signInWithGoogle',
  'signInWithApple',
  'sendPasswordReset',
  'completePasswordReset',
  'reauthenticateForDeletion',
  'deleteAccount',
] as const;

/**
 * Wrap an adapter so none of its result-returning methods can reject.
 *
 * One wrap at the boundary beats a `try` in every screen: the screens keep their
 * single `setPending(null)`, and an adapter written later is covered without
 * anybody remembering to. Methods that are absent stay absent — `completePasswordReset`
 * is optional, and fabricating it here would make a screen offer a door that
 * leads nowhere.
 */
export function guardAdapter(base: AuthAdapter): AuthAdapter {
  const guarded = { ...base } as Record<string, unknown>;
  for (const name of GUARDED_METHODS) {
    const method = base[name];
    if (typeof method !== 'function') continue;
    guarded[name] = (...args: unknown[]) =>
      attempt(() => (method as (...a: unknown[]) => Promise<AuthResult>).apply(base, args));
  }
  return guarded as unknown as AuthAdapter;
}
