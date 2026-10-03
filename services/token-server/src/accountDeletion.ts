function adminHeaders(serviceRoleKey: string): Record<string, string> {
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };
}

/** A queued erasure request, not a claim about vendor-side completion. */
export async function requestRevenueCatErasure(
  userId: string,
  secretKey: string | undefined,
  request: typeof fetch = fetch,
): Promise<boolean> {
  if (!secretKey?.trim()) return false;
  try {
    const response = await request(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    // RevenueCat documents an asynchronous accepted deletion and an absent
    // customer as retry-safe completion. Never GET: that can create a customer.
    return response.status === 200 || response.status === 404;
  } catch { return false; }
}

/** Processor first, so a refusal leaves the signed-in account able to retry. */
export async function deleteAccountWithProcessor(
  baseUrl: string, serviceRoleKey: string, userId: string,
  processorKey: string | undefined, request: typeof fetch = fetch,
): Promise<boolean> {
  if (!(await requestRevenueCatErasure(userId, processorKey, request))) return false;
  await deleteSupabaseUser(baseUrl, serviceRoleKey, userId, request);
  return true;
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
