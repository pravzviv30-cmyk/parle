/**
 * A recorder's live level, from the metering expo-audio reports, as the 0 to
 * 1 a `LevelRing` swells by (come alive, core loop 3.6).
 *
 * expo-audio reports metering in decibels below full scale, from about -160
 * (silence) to 0 (the loudest the microphone takes), and only when the
 * recorder was asked to meter. Speech near a phone sits roughly between -50
 * and -10, so that span is the ring's whole range: quieter is a still ring,
 * louder is a full one.
 *
 * Nothing is ever invented. A status with no metering (a platform that does
 * not meter, a recorder not asked to, a status that could not be read) is
 * null, and the ring is left at rest rather than shown a level nobody heard.
 *
 * Pure, so `recorderLevel.test.ts` holds it; `useRecorderLevel.ts` polls the
 * recorder and writes this into the ring's shared value.
 */

/** At or below this many dBFS the ring is still. */
export const LEVEL_FLOOR_DB = -50;
/** At or above this the ring is full. */
export const LEVEL_CEILING_DB = -10;
/** How often a live recorder is asked for its level, in ms: about 20 a second. */
export const LEVEL_POLL_MS = 50;

/** The ring's level for one metering reading, or null when there is no reading. */
export function levelFromMetering(metering: number | null | undefined): number | null {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return null;
  const share = (metering - LEVEL_FLOOR_DB) / (LEVEL_CEILING_DB - LEVEL_FLOOR_DB);
  return Math.min(1, Math.max(0, share));
}

/** The one recorder status field this reads, as expo-audio's `RecorderState` names it. */
export interface MeteredStatus {
  readonly isRecording: boolean;
  readonly metering?: number;
}

/** The level a status reports: null unless it is recording and metered. */
export function levelOfStatus(status: MeteredStatus | null): number | null {
  if (status === null || !status.isRecording) return null;
  return levelFromMetering(status.metering);
}
