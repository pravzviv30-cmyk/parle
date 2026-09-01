import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { PhonemeObservation, SessionPhonemeReport } from '@luvani/core';

import { authHeaders } from '../auth/adapter.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';

const MAX_SCORE_BYTES = 2 * 1024 * 1024;

export interface AttemptScore {
  observations: PhonemeObservation[];
  report: SessionPhonemeReport;
}

/**
 * Upload one ephemeral recording against one known reference.
 * The bytes are not stored by the app after this call and every failure is a
 * null result, never an invented assessment.
 */
export async function scoreRecordedAttempt(
  userId: string,
  uri: string,
  reference: string,
): Promise<AttemptScore | null> {
  try {
    const body = Platform.OS === 'web' ? await (await fetch(uri)).blob() : await new File(uri).bytes();
    const size = body instanceof Uint8Array ? body.byteLength : body.size;
    if (size === 0 || size > MAX_SCORE_BYTES) return null;
    const res = await fetch(
      `${TOKEN_SERVER}/drill/score?userId=${encodeURIComponent(userId)}&reference=${encodeURIComponent(reference)}`,
      { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...(await authHeaders()) }, body },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AttemptScore>;
    if (!Array.isArray(data.observations) || typeof data.report !== 'object' || data.report === null) return null;
    return { observations: data.observations, report: data.report };
  } catch {
    return null;
  }
}
