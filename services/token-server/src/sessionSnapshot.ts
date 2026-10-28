/**
 * The learner snapshot is opaque to the token server: it is signed into the
 * join credential and read by the agent. Newer apps fit it under the brain's
 * byte budget before sending (LEARN-014); this fits it again so an older app
 * build that sends a heavy profile still starts a session. Fitting tolerates
 * any shape and never throws, so a malformed snapshot that used to pass
 * through still does. Only a snapshot that cannot be fitted (junk in fields
 * fitting never drops) is refused.
 */
import { SNAPSHOT_MAX_BYTES, fitSnapshot, snapshotBytes } from '@luvani/brain/profile/snapshotBudget';

export const SESSION_START_BODY_LIMIT = 160 * 1024;

export type SessionSnapshot = { ok: true; snapshot: object | undefined } | { ok: false };

export function sessionSnapshot(raw: unknown): SessionSnapshot {
  if (typeof raw !== 'object' || raw === null) return { ok: true, snapshot: undefined };
  const snapshot = fitSnapshot(raw);
  return snapshotBytes(snapshot) <= SNAPSHOT_MAX_BYTES ? { ok: true, snapshot } : { ok: false };
}
