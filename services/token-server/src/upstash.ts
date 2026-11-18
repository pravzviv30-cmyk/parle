import { boundedFetchJson } from '../../shared/boundedFetch.ts';

/** One Upstash REST command, bounded: 3 s, 64 KB, no redirect. Any non-2xx, empty or error answer throws the caller's own failure. */
export async function upstashCommand(
  request: typeof fetch, url: string, token: string,
  command: readonly unknown[], failure: (status: number) => Error,
): Promise<unknown> {
  const { status, value } = await boundedFetchJson(request, url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  }, { timeoutMs: 3000, maxBytes: 64 * 1024 });
  const body = value as { result?: unknown; error?: unknown } | null;
  if (status < 200 || status >= 300 || !body || body.error) throw failure(status);
  return body.result;
}
