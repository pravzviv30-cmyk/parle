/**
 * The sound-effect pipeline, without a native player. Pure, so the tests run it with fakes;
 * sound/sfx.native.ts and sound/sfx.web.ts bind it to expo-audio (section 6.2):
 *
 *   1. approved by the founder, or nothing        (SFX_APPROVED)
 *   2. the gate: switch on, no mic, voice or live hold, app active, not suppressed
 *   3. the throttle: four a second, count ticks 90 ms apart
 *   4. native only: take the session into the sound-effect mode, then ask the gate again,
 *      because a microphone or voice line may have appeared while the mode changed
 *   5. one lazily created player per sound: back to the start, then play
 *
 * Any failure is swallowed. A sound effect is a courtesy and never stops the learning flow.
 */
import type { SfxId } from './sfxIds.ts';
import { liveRoom, micLive, voiceBusy } from './audioFocus.ts';
import { createSfxThrottle, sfxAppActive, sfxRefusal, sfxSuppressed, type SfxConditions } from './sfxGate.ts';

export type SfxPlayerLike = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => unknown;
};

export type SfxCoreDeps = {
  approved: Readonly<Record<SfxId, boolean>>;
  soundOn: () => boolean;
  createPlayer: (id: SfxId) => SfxPlayerLike | null;
  now?: () => number;
  /** Native: switches the session to SFX_MODE and says whether it may play. Web has no modes. */
  enterSfx?: () => Promise<boolean>;
  /** Native: the session's mode once enterSfx resolved; anything but 'sfx' means another owner. */
  currentMode?: () => string;
  /** Web: only inside a gesture-driven task does a browser let a page play. */
  mayStart?: () => boolean;
};

export type SfxCore = {
  /** Plays when every rule allows it. Resolves whether it played. */
  play: (id: SfxId) => Promise<boolean>;
  /** Creates the players ahead of time (native only; the web seam never preloads). */
  warm: (ids: readonly SfxId[]) => void;
  /** Pauses every sound effect that might be playing. */
  pauseAll: () => void;
  conditions: (id: SfxId) => SfxConditions;
};

export function createSfxCore(deps: SfxCoreDeps): SfxCore {
  const players = new Map<SfxId, SfxPlayerLike>();
  const throttle = createSfxThrottle();
  const now = deps.now ?? (() => Date.now());

  const conditions = (id: SfxId): SfxConditions => ({
    approved: deps.approved[id] === true,
    soundOn: deps.soundOn(),
    micLive: micLive(),
    voiceBusy: voiceBusy(),
    liveRoom: liveRoom(),
    appActive: sfxAppActive(),
    suppressed: sfxSuppressed(),
  });
  const allowed = (id: SfxId): boolean => sfxRefusal(conditions(id)) === null;

  const playerFor = (id: SfxId): SfxPlayerLike | null => {
    const existing = players.get(id);
    if (existing) return existing;
    try {
      const created = deps.createPlayer(id);
      if (created) players.set(id, created);
      return created;
    } catch {
      return null;
    }
  };

  const start = (id: SfxId): boolean => {
    const player = playerFor(id);
    if (!player) return false;
    try {
      const seeking = player.seekTo(0);
      if (seeking && typeof (seeking as Promise<unknown>).catch === 'function') (seeking as Promise<unknown>).catch(() => {});
      player.play();
      return true;
    } catch {
      return false;
    }
  };

  const play = async (id: SfxId): Promise<boolean> => {
    if (deps.approved[id] !== true) return false;
    if (!allowed(id)) return false;
    if (deps.mayStart && !deps.mayStart()) return false;
    if (!throttle.admit(id, now())) return false;
    if (deps.enterSfx) {
      let entered = false;
      try {
        entered = await deps.enterSfx();
      } catch {
        return false;
      }
      if (!entered || !allowed(id)) return false;
      if (deps.currentMode && deps.currentMode() !== 'sfx') return false;
    }
    return start(id);
  };

  const warm = (ids: readonly SfxId[]): void => {
    for (const id of ids) if (deps.approved[id] === true) playerFor(id);
  };

  const pauseAll = (): void => {
    for (const player of players.values()) {
      try {
        player.pause();
      } catch {
        /* A released player has nothing left to pause. */
      }
    }
  };

  return { play, warm, pauseAll, conditions };
}
