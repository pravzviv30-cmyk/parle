/** Apple OAuth redirects through Supabase and returns to this origin. */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { APPLE_START_FAILED } from './friendly.ts';

/** Provider configuration is checked by the adapter before starting. */
export async function appleSignInOffered(): Promise<boolean> {
  return true;
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
