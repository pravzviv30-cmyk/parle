/**
 * Google sign-in, native half: open the provider page in an auth session
 * browser, catch the deep-link redirect, and trade the code for a session.
 *
 * Development and store builds share the registered `luvani://auth/callback`
 * scheme. That exact return must be allow-listed in Supabase. Parsing and the
 * Hermes SHA-256 bridge live in testable helpers and never log callback data.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './types.ts';
import { APPLE_START_FAILED, GOOGLE_START_FAILED, friendly } from './friendly.ts';
import { NATIVE_AUTH_CALLBACK, readOAuthCallback, securePkceUrl } from './oauthCallback.ts';

WebBrowser.maybeCompleteAuthSession();

export async function startGoogleSignIn(client: SupabaseClient): Promise<AuthResult> {
  return startBrowserSignIn(client, 'google');
}

/** Supabase owns the PKCE verifier; only its returned code is exchanged. */
export async function startBrowserSignIn(
  client: SupabaseClient,
  provider: 'google' | 'apple',
): Promise<AuthResult> {
  const name = provider === 'apple' ? 'Apple' : 'Google';
  // Explicit scheme avoids Expo/dev-client host URLs becoming the OAuth return.
  const redirectTo = NATIVE_AUTH_CALLBACK;
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return {
        ok: false,
        message: provider === 'apple' ? APPLE_START_FAILED : GOOGLE_START_FAILED,
      };
    }
    const authorizationUrl = await securePkceUrl(data.url, (value) => Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.BASE64 },
    ));
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectTo);
    if (result.type !== 'success') {
      return { ok: false, message: `${name} sign in was closed before it finished.` };
    }
    const callback = readOAuthCallback(result.url, redirectTo);
    if (callback.code === null) {
      return {
        ok: false,
        message: callback.error === 'access_denied'
          ? `${name} sign in was cancelled. You can try again or use email.`
          : `${name} sign in could not finish. Try again, or use email.`,
      };
    }
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(
      callback.code,
      data.flowId ? { flowId: data.flowId } : undefined,
    );
    return exchangeError
      ? { ok: false, message: 'The sign-in code did not check out. Try again.' }
      : { ok: true };
  } catch (error) {
    return { ok: false, message: friendly(error as { message?: string }) };
  }
}
