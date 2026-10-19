/** The synthetic learner must never be available to real accounts or services. */
export interface MainPreviewEnvironment {
  development: boolean;
  screenPreview?: string;
  localDevelopment?: string;
  nodeEnv?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  tokenServerUrl?: string;
}

export function mainPreviewAllowed(env: MainPreviewEnvironment): boolean {
  if (!env.development || env.nodeEnv === 'production' || env.screenPreview !== '1' || env.localDevelopment !== '1') return false;
  if (env.supabaseUrl || env.supabaseKey) return false;
  try {
    if (!env.tokenServerUrl) return false;
    const endpoint = new URL(env.tokenServerUrl);
    return ['http:', 'https:'].includes(endpoint.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  } catch { return false; }
}

export const MAIN_PREVIEW_USER_ID = 'c2-preview';
