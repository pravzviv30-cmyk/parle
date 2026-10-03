import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ResolvedUser } from './auth.ts';
import { decodedHeader, DRILL_USER_HEADER, readAudio } from './drillScore.ts';

export interface DrillTranscribeDeps {
  users: { resolve(authorization: string | undefined, asserted: string | null): Promise<ResolvedUser> };
  limits(req: IncomingMessage, res: ServerResponse, userId: string | null): Promise<boolean>;
  transcribe(audio: Uint8Array): Promise<string | null>;
}
function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}
/** No audio or transcript enters a store, event, URL or log. */
export async function handleDrillTranscribe(req: IncomingMessage, res: ServerResponse, deps: DrillTranscribeDeps): Promise<void> {
  if (!(await deps.limits(req, res, null))) return;
  if (new URL(req.url ?? '/', 'http://localhost').search) return json(res, 400, { error: 'transcription accepts no query parameters' });
  const asserted = decodedHeader(req, DRILL_USER_HEADER);
  if (asserted === undefined) return json(res, 400, { error: 'invalid user header' });
  const user = await deps.users.resolve(req.headers.authorization, asserted);
  if (!user.ok) return json(res, user.status, { error: user.message });
  if (asserted !== null && asserted !== user.userId) return json(res, 403, { error: 'account changed' });
  if (!(await deps.limits(req, res, user.userId))) return;
  let audio: Uint8Array;
  try { audio = await readAudio(req); }
  catch { return json(res, 413, { error: 'audio body could not be read within its limit' }); }
  if (audio.length === 0) return json(res, 400, { error: 'audio is required' });
  let transcript: string | null;
  try { transcript = await deps.transcribe(audio); }
  catch { transcript = null; }
  if (transcript === null) return json(res, 503, { error: 'transcription unavailable' });
  return json(res, 200, { transcript });
}
