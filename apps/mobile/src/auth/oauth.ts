/**
 * Google sign-in, web half. A full-page redirect: Supabase bounces through
 * Google and back to this origin, where detectSessionInUrl picks the session
 * up on load. The `.native.ts` sibling handles iOS and Android.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { GOOGLE_START_FAILED } from './friendly.ts';

export async function startGoogleSignIn(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  // On success the browser is already navigating away; this return is for the
  // error path only.
  return error
    ? { ok: false, message: GOOGLE_START_FAILED }
    : { ok: true };
}
