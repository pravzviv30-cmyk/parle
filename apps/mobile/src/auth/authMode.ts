export type AuthMode = 'supabase' | 'mock';

export interface AuthModeEnvironment {
  nodeEnv?: string | undefined;
  localDevelopment?: string | undefined;
  supabaseUrl?: string | undefined;
  supabaseAnonKey?: string | undefined;
}

/**
 * Mock identity is a development tool, never a missing-production-config
 * fallback. Partial Supabase configuration is also refused because silently
 * dropping to a different identity system can cross account boundaries.
 */
export function selectAuthMode(env: AuthModeEnvironment): AuthMode {
  const localDevelopment = env.localDevelopment === '1' && env.nodeEnv !== 'production';
  const hasUrl = Boolean(env.supabaseUrl);
  const hasKey = Boolean(env.supabaseAnonKey);
  if (hasUrl !== hasKey) {
    throw new Error('Luvani auth is misconfigured: set both Supabase public variables or neither in development.');
  }
  if (hasUrl && hasKey) {
    if (!localDevelopment) {
      try {
        if (new URL(env.supabaseUrl!).protocol !== 'https:') throw new Error('not HTTPS');
      } catch {
        throw new Error('Luvani refuses a deployed Supabase endpoint that is not HTTPS.');
      }
    }
    return 'supabase';
  }
  if (localDevelopment) return 'mock';
  throw new Error('Luvani refuses to run without Supabase authentication unless local development is explicit.');
}
