/** Use only claims whose JWT signature the caller has already verified. */
export function verifiedAuthenticationAt(claims: unknown): number | null {
  if (!claims || typeof claims !== 'object') return null;
  const payload = claims as Record<string, unknown>;
  if (payload.role !== 'authenticated' || payload.is_anonymous === true || typeof payload.session_id !== 'string' || !payload.session_id) return null;
  if (!Array.isArray(payload.amr)) return null;
  const proving = new Set(['password', 'oauth', 'otp', 'totp', 'sso/saml', 'magiclink']);
  let latest: number | null = null;
  for (const row of payload.amr) {
    if (!row || typeof row !== 'object') continue;
    const { method, timestamp } = row as Record<string, unknown>;
    if (typeof method !== 'string' || !proving.has(method) || typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp <= 0) continue;
    const at = timestamp * 1000;
    if (!Number.isSafeInteger(at)) continue;
    latest = Math.max(latest ?? 0, at);
  }
  return latest;
}

export function authenticationIsRecent(at: number | null | undefined, now = Date.now()): boolean {
  return typeof at === 'number' && Number.isFinite(at) && at <= now && now - at <= 5 * 60 * 1000;
}
