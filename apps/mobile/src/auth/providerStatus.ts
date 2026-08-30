/**
 * Whether the project has actually switched a social provider on.
 *
 * `signInWithOAuth` on web does not report a disabled provider. It resolves
 * without an error and navigates the whole tab to `/auth/v1/authorize`, and the
 * refusal happens *there* — so the learner lands on a bare
 * `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider…"}`
 * body, outside the app, with the back button as the only way home, and the
 * message this repo wrote for that failure can never be shown (F260).
 *
 * GoTrue publishes what is enabled at `/auth/v1/settings`, unauthenticated. One
 * cheap read before throwing the tab away turns an ejection into a sentence.
 *
 * The unreachable case answers `null`, not `false`, and the caller proceeds. A
 * preflight that fails must never be the reason somebody cannot sign in — the
 * redirect was going to work or fail on its own merits either way.
 *
 * The anon key is not optional. `/auth/v1/settings` answers 401 without it, and
 * a 401 reads as "could not tell" — so a version of this that forgot the header
 * would sit there answering `null` for ever and never once do its job. That is
 * not hypothetical: it is what the first draft did, against the real project.
 */

/** `true` enabled, `false` switched off, `null` could not tell. */
export function googleEnabled(body: unknown): boolean | null {
  if (typeof body !== 'object' || body === null) return null;
  const external = (body as { external?: unknown }).external;
  if (typeof external !== 'object' || external === null) return null;
  const google = (external as { google?: unknown }).google;
  return typeof google === 'boolean' ? google : null;
}

/**
 * Ask the project what it has enabled. Never throws: every failure — offline,
 * a 500, HTML from a captive portal — is the same "could not tell" answer.
 */
export async function googleAvailable(
  supabaseUrl: string,
  anonKey: string,
  request: typeof fetch = fetch,
  timeoutMs = 3_000,
): Promise<boolean | null> {
  try {
    const response = await request(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return googleEnabled(await response.json());
  } catch {
    return null;
  }
}
