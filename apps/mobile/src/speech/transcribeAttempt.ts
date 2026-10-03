import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { auth, authHeaders } from '../auth/adapter.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';

/** Temporary take; its caller removes the recording after the upload settles. */
export async function transcribeRecordedAttempt(userId: string, uri: string, owner = scopeGeneration(),
  cancellation?: { signal: AbortSignal; current: () => boolean }): Promise<string | null> {
  const controller = new AbortController();
  const valid = () => !controller.signal.aborted && !cancellation?.signal.aborted && (cancellation?.current() ?? true) && owner === scopeGeneration();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const ended = new Promise<null>(resolve => {
    cancel = () => { controller.abort(); resolve(null); };
    timer = setTimeout(cancel, 12_000);
  });
  cancellation?.signal.addEventListener('abort', cancel, { once: true });
  const work = async (): Promise<string | null> => {
    if (!valid() || (await auth.getSession())?.id !== userId || !valid()) return null;
    const body = Platform.OS === 'web' ? await (await fetch(uri, { signal: controller.signal })).blob() : await new File(uri).bytes();
    const size = body instanceof Uint8Array ? body.byteLength : body.size;
    if (!valid() || size === 0 || size > 2 * 1024 * 1024) return null;
    const headers = await authHeaders();
    if (!valid() || (await auth.getSession())?.id !== userId || !valid()) return null;
    const response = await fetch(`${TOKEN_SERVER}/drill/transcribe`, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-luvani-user': encodeURIComponent(userId), ...headers },
      body, signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as { transcript?: unknown };
    if (!valid() || (await auth.getSession())?.id !== userId || !valid()) return null;
    return typeof data.transcript === 'string' && data.transcript.trim().length > 0 && data.transcript.length <= 600 ? data.transcript.trim() : null;
  };
  try { return await Promise.race([work(), ended]); }
  catch { return null; }
  finally { clearTimeout(timer); cancellation?.signal.removeEventListener('abort', cancel); }
}
