/**
 * Whether a sound effect may play now. Pure: no imports beyond types, so the tests run every rule
 * (docs/come-alive/motion-sound.md sections 6.2 and 7).
 *
 * A sound plays only when all of these hold:
 * - the founder approved it by ear, in the form it has now (SFX_APPROVED, decision D9);
 * - the learner's "Sound effects" switch is on (sound/soundPreference.ts, decision D8);
 * - no microphone, voice line or live room holds focus (sound/audioFocus.ts);
 * - the app is in the foreground;
 * - nothing has suppressed sound effects (a safety stop gets no celebration, F137);
 * - the throttle admits it: at most four sounds in any second, and the count tick, which a
 *   CountUp plays up to ten times in a row, at least 90 ms apart on its own clock.
 */
import type { SfxId } from './sfxIds.ts';

export type SfxConditions = {
  approved: boolean;
  soundOn: boolean;
  micLive: boolean;
  voiceBusy: boolean;
  liveRoom: boolean;
  appActive: boolean;
  suppressed: boolean;
};

export type SfxRefusal = 'unapproved' | 'sound-off' | 'microphone' | 'voice' | 'live-room' | 'background' | 'suppressed';

/** The first reason a sound may not play, or null when nothing stands in its way. */
export function sfxRefusal(conditions: SfxConditions): SfxRefusal | null {
  if (!conditions.approved) return 'unapproved';
  if (!conditions.soundOn) return 'sound-off';
  if (conditions.micLive) return 'microphone';
  if (conditions.liveRoom) return 'live-room';
  if (conditions.voiceBusy) return 'voice';
  if (!conditions.appActive) return 'background';
  if (conditions.suppressed) return 'suppressed';
  return null;
}

export const SFX_PER_SECOND = 4;
export const COUNT_TICK_GAP_MS = 90;

export type SfxThrottle = {
  /** True when this sound may play at `nowMs`; an admitted sound is counted. */
  admit: (id: SfxId, nowMs: number) => boolean;
  /** True when this sound may play at `nowMs`. Counts nothing: a sound is counted once it plays. */
  allows: (id: SfxId, nowMs: number) => boolean;
};

export function createSfxThrottle(): SfxThrottle {
  let recent: number[] = [];
  let lastTick = Number.NEGATIVE_INFINITY;
  const allows = (id: SfxId, nowMs: number): boolean => {
    if (id === 'count-tick') return nowMs - lastTick >= COUNT_TICK_GAP_MS;
    recent = recent.filter((at) => nowMs - at < 1000);
    return recent.length < SFX_PER_SECOND;
  };
  return {
    allows,
    admit: (id, nowMs) => {
      if (!allows(id, nowMs)) return false;
      if (id === 'count-tick') lastTick = nowMs;
      else recent.push(nowMs);
      return true;
    },
  };
}

let suppressions = 0;

/** Silences every sound effect until the returned releaser runs (safe to call twice). */
export function suppressSfx(): () => void {
  suppressions += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressions = Math.max(0, suppressions - 1);
  };
}
export const sfxSuppressed = (): boolean => suppressions > 0;

let appActive = true;
/** The platform seam reports AppState here; a backgrounded app plays nothing. */
export function setSfxAppActive(active: boolean): void {
  appActive = active;
}
export const sfxAppActive = (): boolean => appActive;
