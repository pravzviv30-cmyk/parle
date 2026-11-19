import { boundedFetchJson } from '../../shared/boundedFetch.ts';

/**
 * One Upstash REST command, bounded: 3 s, 64 KB unless the caller sets a larger cap, no redirect.
 * A JSON answer that is non-2xx, empty or carries an error throws the caller's own failure. The body is
 * parsed before the status is read, so a non-JSON error page throws a SyntaxError, and one over the cap
 * throws network-response-limit, instead of that failure. Either way the command is refused.
 */
export async function upstashCommand(
  request: typeof fetch, url: string, token: string,
  command: readonly unknown[], failure: (status: number) => Error, maxBytes = 64 * 1024,
): Promise<unknown> {
  const { status, value } = await boundedFetchJson(request, url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  }, { timeoutMs: 3000, maxBytes });
  const body = value as { result?: unknown; error?: unknown } | null;
  if (status < 200 || status >= 300 || !body || body.error) throw failure(status);
  return body.result;
}
