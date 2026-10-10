/** One registered native callback for development and App Store builds. */
export const NATIVE_AUTH_CALLBACK = 'luvani://auth/callback';

function parameter(url: string, name: string): string | null {
  const encoded = new RegExp(`[?&#]${name}=([^&#]*)`).exec(url)?.[1];
  if (encoded === undefined) return null;
  try { return decodeURIComponent(encoded.replace(/\+/g, ' ')); } catch { return null; }
}

/** Never render provider prose: callback errors can contain private or attacker-supplied text. */
export function readOAuthCallback(url: string, expected: string): { code: string; error: null } | { code: null; error: string } {
  const destination = url.split(/[?#]/, 1)[0];
  if (destination !== expected) return { code: null, error: 'callback_mismatch' };
  const error = parameter(url, 'error_code') ?? parameter(url, 'error');
  if (error) return { code: null, error };
  const code = parameter(url.split('#', 1)[0]!, 'code');
  return code ? { code, error: null } : { code: null, error: 'missing_code' };
}

/** Hermes has no SubtleCrypto. Upgrade the SDK's plain challenge with Expo's native SHA-256. */
export async function securePkceUrl(url: string, sha256Base64: (value: string) => Promise<string>): Promise<string> {
  const method = parameter(url, 'code_challenge_method');
  if (method?.toLowerCase() === 's256') return url;
  const verifier = parameter(url, 'code_challenge');
  if (method !== 'plain' || !verifier) throw new Error('Missing PKCE challenge');
  const challenge = (await sha256Base64(verifier)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return url.replace(/([?&]code_challenge=)[^&#]*/, `$1${encodeURIComponent(challenge)}`).replace(/([?&]code_challenge_method=)[^&#]*/, '$1s256');
}
