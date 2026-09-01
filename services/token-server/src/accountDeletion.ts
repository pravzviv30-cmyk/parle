function adminHeaders(serviceRoleKey: string): Record<string, string> {
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
}

/**
 * A refreshed bearer is not reauthentication. Supabase preserves the account's
 * last real sign-in across access-token refreshes, so deletion checks that
 * server-owned timestamp before it accepts a still-valid stolen session.
 */
export async function signedInRecently(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  request: typeof fetch = fetch,
  now: number = Date.now(),
  maximumAgeMs = 5 * 60 * 1_000,
): Promise<boolean> {
  const response = await request(
    `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: adminHeaders(serviceRoleKey), signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) throw new Error(`recent authentication check failed (${response.status})`);
  const body = (await response.json()) as { last_sign_in_at?: unknown };
  if (typeof body.last_sign_in_at !== 'string') return false;
  const signedInAt = Date.parse(body.last_sign_in_at);
  return Number.isFinite(signedInAt) && signedInAt <= now && now - signedInAt <= maximumAgeMs;
}

/** Delete the authenticated Supabase user. Related Luvani rows cascade in SQL. */
export async function deleteSupabaseUser(
  baseUrl: string,
  serviceRoleKey: string,
  userId: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(
    `${baseUrl.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: adminHeaders(serviceRoleKey),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) throw new Error(`account deletion failed (${response.status})`);
}
