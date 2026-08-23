/**
 * Which auth backend this launch runs on.
 *
 * Supabase when the env names a project, or the on-device mock only when local
 * development is explicit. The Supabase module is loaded lazily so the local
 * mock path stays free of its runtime requirements.
 */

import type { AuthAdapter } from './types.ts';
import { createMockAdapter } from './mockAdapter.ts';
import { selectAuthMode } from './authMode.ts';
import { installationId } from './installation.ts';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function build(): AuthAdapter {
  const mode = selectAuthMode({
    nodeEnv: process.env.NODE_ENV,
    localDevelopment: process.env.EXPO_PUBLIC_PARLE_LOCAL_DEVELOPMENT,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
  if (mode === 'supabase') {
    const { createSupabaseAdapter } = require('./supabaseAdapter.ts') as typeof import('./supabaseAdapter.ts');
    return createSupabaseAdapter(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return createMockAdapter();
}

/** The one adapter for this launch. */
export const auth: AuthAdapter = build();

/**
 * Bearer and pseudonymous installation headers for token-server calls. Mock
 * mode has no bearer and is accepted only by the explicit local server mode.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const [token, installation] = await Promise.all([auth.getAccessToken(), installationId()]);
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'x-parle-installation': installation,
  };
}
