/**
 * Apple sign-in, web half. The mirror of `oauth.ts`: a full-page redirect
 * through Supabase to Apple and back to this origin, where detectSessionInUrl
 * picks the session up on load. The `.native.ts` sibling handles iOS.
 *
 * Two files because the flows genuinely differ, not by accident. Native has a
 * system sheet, a nonce Apple signs, and an identity token exchanged in
 * process; web has none of those and cannot have them.
 *
 * `appleSignInOffered` answers false here, and that is the whole of v1's web
 * story. Apple's web flow needs a Services ID and a separate return URL
 * configured against the project, and a button that opens a door nobody has
 * built yet is worse than no button: the learner leaves the app to read a
 * refusal written for an operator. The redirect itself still exists, because
 * `reauthenticateForDeletion` has to be able to re-prove an Apple account on
 * web the day that configuration lands.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { APPLE_START_FAILED } from './friendly.ts';

/** Web draws no Apple door in v1. See the note above. */
export async function appleSignInOffered(): Promise<boolean> {
  return false;
}

export async function startAppleSignIn(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin },
  });
  // On success the browser is already navigating away; this return is for the
  // error path only.
  return error ? { ok: false, message: APPLE_START_FAILED } : { ok: true };
}
