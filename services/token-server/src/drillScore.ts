/**
 * POST /drill/score — how close was this attempt to the line it was at?
 *
 * Drill mode's pronunciation check: raw utterance audio in the body, and the
 * two strings that go with it in headers. No multipart, no base64 bloat, and
 * the known reference is exactly what makes the score trustworthy. Returns the
 * phoneme observations plus the ONE focus core selects; the app must never
 * turn this into eleven red bars.
 *
 * Why headers and not the query string (F626). A URL is what proxies, hosting
 * access logs and crash reports record by default, and the reference can be
 * the learner's own corrected sentence, so it is personal. Both values are
 * `encodeURIComponent`-encoded by the app, because a header value must be
 * ASCII and French has accents, and decoded here. A value that does not decode
 * is a 400, never a crash.
 *
 * The old query form is refused rather than tolerated, so it cannot quietly
 * keep working in a client nobody updated. Both mismatched pairs land in the
 * same place: an old app meets a 400 here, a new app meets a 400 from an old
 * server that finds no reference in the URL, and the app reads any refusal as
 * "no verdict". The drill stays unscored and says so; it never invents a score
 * and never strands the learner.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildReport, type PhonemeObservation } from '@luvani/core';

import type { ResolvedUser } from './auth.ts';

/** The learner the app claims to be, used only where a bearer does not decide. */
export const DRILL_USER_HEADER = 'x-luvani-user';
/** The line the attempt was at. Without it there is nothing to score against. */
export const DRILL_REFERENCE_HEADER = 'x-luvani-reference';

/** Raw utterance audio. A drill rep is a few seconds of WAV; 2MB is generous. */
export const SCORE_AUDIO_LIMIT_BYTES = 2 * 1024 * 1024;

export interface DrillScoreDeps {
  /** Identity, resolved exactly as every other authenticated endpoint does. */
  users: { resolve(authorizationHeader: string | undefined, assertedUserId: string | null): Promise<ResolvedUser> };
  /**
   * The scoring rate limits, run by the server that owns the limiter. `userId`
   * is null on the pre-authentication pass and the caller's id after it.
   * Returns false when it has already answered 429.
   */
  limits(req: IncomingMessage, res: ServerResponse, userId: string | null): Promise<boolean>;
  /** The vendor router. Never throws; `[]` means no score, never a low one. */
  score(request: { reference: string; audio: Uint8Array }): Promise<PhonemeObservation[]>;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

export async function readAudio(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > SCORE_AUDIO_LIMIT_BYTES) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * One header, decoded. Absent is `null`, which is what the query form's
 * `searchParams.get` answered, so identity resolution sees the same value it
 * always did. A value that is not valid percent-encoding is `undefined`.
 */
export function decodedHeader(req: IncomingMessage, name: string): string | null | undefined {
  const raw = req.headers[name];
  if (raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

/** One scored attempt. Nothing here is stored and nothing here is logged. */
export async function handleDrillScore(req: IncomingMessage, res: ServerResponse, deps: DrillScoreDeps): Promise<void> {
  if (!(await deps.limits(req, res, null))) return;

  // The old form is a 400 even beside the new headers: the URL has already
  // carried the learner and the line, and a client still sending it must learn
  // that from a refusal rather than from an access log.
  const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
  if (query.has('userId') || query.has('reference')) {
    return json(res, 400, { error: 'userId and reference belong in headers, not the URL' });
  }

  const reference = decodedHeader(req, DRILL_REFERENCE_HEADER);
  const claimed = decodedHeader(req, DRILL_USER_HEADER);
  if (reference === undefined || claimed === undefined) {
    return json(res, 400, { error: 'a scoring header is not valid percent-encoding' });
  }
  if (!reference) return json(res, 400, { error: 'reference is required' });
  const resolved = await deps.users.resolve(req.headers.authorization, claimed);
  if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
  if (!(await deps.limits(req, res, resolved.userId))) return;

  const audio = await readAudio(req);
  if (audio.length === 0) return json(res, 400, { error: 'audio body is required' });

  const observations = await deps.score({ reference, audio });
  // No key, vendor down, timed out, or unscorable audio: an empty result, never an
  // invented penalty. The app treats it as "no verdict". The report is
  // core's — one focus point at most, and only when the evidence earns it.
  const report = buildReport(observations);
  return json(res, 200, { observations, report });
}
