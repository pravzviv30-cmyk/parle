/**
 * Google sign-in, web half. A full-page redirect: Supabase bounces through
 * Google and back to this origin, where detectSessionInUrl picks the session
 * up on load. The `.native.ts` sibling handles iOS and Android.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';

export async function startGoogleSignIn(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  // On success the browser is already navigating away; this return is for the
  // error path only.
  return error
    ? { ok: false, message: 'Google sign in could not start. Check the Supabase Google provider setup.' }
    : { ok: true };
}
