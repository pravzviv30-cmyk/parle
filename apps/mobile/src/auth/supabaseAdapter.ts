/**
 * The real auth backend. Sessions persist in encrypted SecureStore on native
 * (web uses the SDK's localStorage default), refresh runs only while the app is
 * foregrounded, and every provider error is translated to a plain sentence
 * before a screen can show it.
 */

import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthAdapter, AuthResult, AuthUser } from './types.ts';
import { startGoogleSignIn } from './oauth.ts';
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

/** Provider errors, translated. Never a code, never a scold. */
function friendly(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match an account.';
  if (m.includes('already registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('rate limit')) return 'Too many tries in a row. Give it a minute, then try again.';
  if (m.includes('network')) return 'The connection dropped. Check your internet and try again.';
  if (m.includes('email not confirmed')) return 'That email has not been confirmed yet. Check your inbox for the confirmation link.';
  return message && message.length < 120 ? message : 'Something went sideways. Try again in a moment.';
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
      if (error) return { ok: false, message: friendly(error.message) };
      if (!data.session) {
        // The project requires email confirmation; say what happens next.
        return { ok: true, message: 'Almost there. Check your email for a confirmation link, then sign in.' };
      }
      return { ok: true };
    },

    async signInWithPassword(email, password): Promise<AuthResult> {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, message: friendly(error.message) } : { ok: true };
    },

    signInWithGoogle(): Promise<AuthResult> {
      return startGoogleSignIn(client);
    },

    async sendPasswordReset(email): Promise<AuthResult> {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        ...(Platform.OS === 'web' ? { redirectTo: window.location.origin } : {}),
      });
      return error
        ? { ok: false, message: friendly(error.message) }
        : { ok: true, message: 'Check your email for a reset link.' };
    },

    async completePasswordReset(newPassword): Promise<AuthResult> {
      const { error } = await client.auth.updateUser({ password: newPassword });
      return error ? { ok: false, message: friendly(error.message) } : { ok: true };
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
      return error ? { ok: false, message: friendly(error.message) } : { ok: true };
    },

    async deleteAccount(): Promise<AuthResult> {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { ok: false, message: 'Sign in again before deleting your account.' };
      try {
        const installation = await installationId();
        const response = await fetch(`${TOKEN_SERVER}/account/delete`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'x-parle-installation': installation },
        });
        const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
        return response.ok
          ? { ok: true }
          : {
              ok: false,
              message: typeof body?.message === 'string'
                ? body.message
                : 'Your account could not be deleted right now. Nothing was changed.',
            };
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
