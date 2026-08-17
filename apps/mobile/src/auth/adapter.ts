/**
 * Which auth backend this launch runs on.
 *
 * Supabase when the env names a project, the on-device mock when it does not.
 * The Supabase module is loaded lazily so keyless dev never even imports the
 * SDK — the run-with-no-keys path stays free of its runtime requirements.
 */

import type { AuthAdapter } from './types.ts';
import { createMockAdapter } from './mockAdapter.ts';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function build(): AuthAdapter {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const { createSupabaseAdapter } = require('./supabaseAdapter.ts') as typeof import('./supabaseAdapter.ts');
    return createSupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return createMockAdapter();
}

/** The one adapter for this launch. */
export const auth: AuthAdapter = build();

/**
 * Bearer header for token-server calls, or nothing in mock mode — the server
 * without Supabase configured trusts the asserted userId exactly as before.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}
