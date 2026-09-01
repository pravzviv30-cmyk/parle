/**
 * The real auth backend. Sessions persist in encrypted SecureStore on native
 * (web uses the SDK's localStorage default), refresh runs only while the app is
 * foregrounded, and every provider error is translated by `friendly.ts` to a
 * plain sentence before a screen can show it.
 *
 * The whole error goes to `friendly` — code, weak-password reasons and message
 * together — because GoTrue's code is stable and its English is not. This file
 * owns no translation of its own and must not grow one: a second mapping here
 * is how the raw provider message got back onto a screen the first time.
 */

import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthAdapter, AuthResult, AuthUser } from './types.ts';
import { startGoogleSignIn } from './oauth.ts';
import { friendly, deletionFailure, GOOGLE_NOT_CONFIGURED } from './friendly.ts';
import { googleAvailable } from './providerStatus.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { createSecureSessionStorage } from './secureSessionStorage.ts';
import { installationId } from './installation.ts';

function toUser(session: Session | null): AuthUser | null {
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    provider: user.app_metadata?.provider === 'google' ? 'google' : 'password',
  };
}

export function createSupabaseAdapter(url: string, anonKey: string): AuthAdapter {
  const nativeSessionStorage = createSecureSessionStorage(
    {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    AsyncStorage,
  );
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: nativeSessionStorage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });

  if (Platform.OS !== 'web') {
    // Refresh only while foregrounded — the Supabase RN guidance. Without
    // this, a session quietly expires mid-week and the learner is bounced.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    void client.auth.startAutoRefresh();
  }

  return {
    kind: 'supabase',

    async getSession() {
      const { data } = await client.auth.getSession();
      return toUser(data.session);
    },

    onAuthStateChange(cb) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') return; // handled by onPasswordRecovery
        cb(toUser(session));
      });
      return () => data.subscription.unsubscribe();
    },

    onPasswordRecovery(cb) {
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') cb();
      });
      return () => data.subscription.unsubscribe();
    },

    async signUpWithPassword(email, password): Promise<AuthResult> {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { ok: false, message: friendly(error) };
      if (!data.session) {
        // The project requires email confirmation; say what happens next.
        return { ok: true, message: 'Almost there. Check your email for a confirmation link, then sign in.' };
      }
      return { ok: true };
    },

    async signInWithPassword(email, password): Promise<AuthResult> {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, message: friendly(error) } : { ok: true };
    },

    async signInWithGoogle(): Promise<AuthResult> {
      // Ask before throwing the tab away. On web `signInWithOAuth` navigates
      // first and lets the provider refuse afterwards, which strands the learner
      // on a raw JSON body outside the app (F260). `null` means the preflight
      // could not tell, and then the redirect goes ahead as it always did.
      if ((await googleAvailable(url, anonKey)) === false) {
        return { ok: false, message: GOOGLE_NOT_CONFIGURED };
      }
      return startGoogleSignIn(client);
    },

    async sendPasswordReset(email): Promise<AuthResult> {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        ...(Platform.OS === 'web' ? { redirectTo: window.location.origin } : {}),
      });
      return error
        ? { ok: false, message: friendly(error) }
        : { ok: true, message: 'Check your email for a reset link.' };
    },

    async completePasswordReset(newPassword): Promise<AuthResult> {
      const { error } = await client.auth.updateUser({ password: newPassword });
      return error ? { ok: false, message: friendly(error) } : { ok: true };
    },

    async reauthenticateForDeletion(secret?: string): Promise<AuthResult> {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return { ok: false, message: 'Sign in again before deleting your account.' };
      if (user.app_metadata?.provider === 'google') {
        const result = await startGoogleSignIn(client);
        if (Platform.OS === 'web' && result.ok) {
          return { ok: false, message: 'Finish signing in with Google, then return here and delete the account again.' };
        }
        return result;
      }
      if (!user.email || !secret) {
        return { ok: false, message: 'Enter your password to confirm it is you.' };
      }
      const { error } = await client.auth.signInWithPassword({ email: user.email, password: secret });
      return error ? { ok: false, message: friendly(error) } : { ok: true };
    },

    async deleteAccount(): Promise<AuthResult> {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      // No bearer is the same conversation as a refused one, so it uses the
      // same words rather than a second copy of them.
      if (!token) return { ok: false, message: deletionFailure(401) };
      try {
        const installation = await installationId();
        const response = await fetch(`${TOKEN_SERVER}/account/delete`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'x-luvani-installation': installation },
        });
        // The response body is never read. It is written for an operator, it
        // can carry a database error, and the same route can be answered by a
        // proxy that knows nothing about this product. The status says enough.
        return response.ok ? { ok: true } : { ok: false, message: deletionFailure(response.status) };
      } catch {
        return { ok: false, message: 'The connection dropped. Nothing was deleted. Try again.' };
      }
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      // A just-deleted account cannot revoke a server session that no longer
      // exists. Clear the local session as the fallback so deletion never
      // leaves a ghost signed-in screen on this device.
      if (error) await client.auth.signOut({ scope: 'local' });
    },

    async getAccessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };
}
