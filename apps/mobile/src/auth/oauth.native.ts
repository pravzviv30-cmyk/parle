/**
 * Google sign-in, native half: open the provider page in an auth session
 * browser, catch the deep-link redirect, and trade the code for a session.
 *
 * The redirect URL differs by runtime — `luvani://auth/callback` in a dev or
 * store build, an `exp://…` URL inside Expo Go — and every variant must be
 * allow-listed in the Supabase dashboard. Codes are pulled with a regex, not
 * `new URL`, so nothing here leans on a global Hermes may not have.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { GOOGLE_START_FAILED } from './friendly.ts';

WebBrowser.maybeCompleteAuthSession();

export async function startGoogleSignIn(client: SupabaseClient): Promise<AuthResult> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, message: GOOGLE_START_FAILED };
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { ok: false, message: 'Google sign in was closed before it finished.' };
  }
  const code = /[?&]code=([^&#]+)/.exec(result.url)?.[1];
  if (!code) {
    return { ok: false, message: 'Google sent us back without a sign-in code. Try again.' };
  }
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(decodeURIComponent(code));
  return exchangeError ? { ok: false, message: 'The sign-in code did not check out. Try again.' } : { ok: true };
}
