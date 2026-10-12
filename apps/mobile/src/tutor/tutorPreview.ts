import type { TutorVoiceKey } from '@luvani/core';

export type TutorPreviewPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface TutorPreviewState {
  voice: TutorVoiceKey | null;
  phase: TutorPreviewPhase;
  /** Actual media time divided by actual duration. Never a simulated waveform. */
  progress: number;
  currentTime: number;
  duration: number;
  error: string | null;
}

export interface TutorPreviewProgressSource {
  getSnapshot: () => TutorPreviewState;
  subscribe: (listener: () => void) => () => void;
}

/** The subset of Expo SDK 57 status used here; native imports stay in the hook. */
export interface PreviewPlayback {
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  mediaServicesDidReset?: boolean;
}

export interface PreviewPlayer {
  load: () => void;
  play: () => void;
  pause: () => void;
  release: () => void;
  subscribe: (listener: (status: PreviewPlayback) => void) => () => void;
}

interface PreviewDeps {
  createPlayer: (voice: TutorVoiceKey) => PreviewPlayer;
  ready: () => Promise<void>;
  web: boolean;
  /** A bounded media-load watchdog, unrelated to screen animations. */
  later?: (run: () => void, milliseconds: number) => () => void;
}

const EMPTY: TutorPreviewState = {
  voice: null, phase: 'idle', progress: 0, currentTime: 0, duration: 0, error: null,
};
const RETRY = 'This preview could not play. Try again.';
const LOAD_LIMIT_MS = 12_000;
const safe = (run: () => void) => { try { run(); } catch { /* Native disposal may already have happened. */ } };
const seconds = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * One owned player and one requested voice. The selection is deliberately absent.
 *
 * A new voice releases the old player before it is created. Its listener closes
 * over that ownership record, so queued events from an old source cannot finish
 * or update the new one. Tickets cancel audio-session work after rapid taps,
 * backgrounding or navigation. Pausing keeps the source and position; replay
 * and retry create a fresh source at zero, which also preserves the web gesture.
 */
export function createTutorPreview(deps: PreviewDeps) {
  let state = EMPTY;
  let controlState = EMPTY;
  const listeners = new Set<() => void>();
  const controlListeners = new Set<() => void>();
  let ticket = 0;
  let wanted = false;
  let cancelWait: (() => void) | null = null;
  let owned: { player: PreviewPlayer; unsubscribe: (() => void) | null; confirmedPlaying: boolean } | null = null;
  const later = deps.later ?? ((run, milliseconds) => {
    const timer = setTimeout(run, milliseconds);
    return () => clearTimeout(timer);
  });

  const clearWait = () => { cancelWait?.(); cancelWait = null; };
  const publish = (next: TutorPreviewState) => {
    state = next;
    for (const listener of [...listeners]) listener();
    // Media ticks go straight to the small progress view. The onboarding owner
    // only needs control changes, not six card re-renders every 100 milliseconds.
    if (next.voice !== controlState.voice || next.phase !== controlState.phase || next.error !== controlState.error) {
      controlState = next;
      for (const listener of [...controlListeners]) listener();
    }
  };
  const close = () => {
    const old = owned;
    owned = null;
    if (!old) return;
    if (old.unsubscribe) safe(old.unsubscribe);
    safe(old.player.pause);
    safe(old.player.release);
  };
  const fail = (mine: number) => {
    if (mine !== ticket) return;
    ticket += 1;
    wanted = false;
    clearWait();
    close();
    publish({ ...state, phase: 'error', error: RETRY });
  };
  const watch = (mine: number) => {
    clearWait();
    cancelWait = later(() => fail(mine), LOAD_LIMIT_MS);
  };

  const pause = () => {
    ticket += 1;
    wanted = false;
    clearWait();
    if (owned) safe(owned.player.pause);
    publish({ ...state, phase: 'paused' });
  };

  const prepare = (mine: number, voice: TutorVoiceKey) => {
    if (mine !== ticket || !wanted) return;
    try {
      if (!owned) {
        const record = { player: deps.createPlayer(voice), unsubscribe: null as (() => void) | null, confirmedPlaying: false };
        owned = record;
        record.unsubscribe = record.player.subscribe((status) => {
          if (owned !== record) return;
          if (status.error) { fail(ticket); return; }
          const currentTime = seconds(status.currentTime);
          const duration = seconds(status.duration);
          const time = {
            currentTime, duration,
            progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
          };
          // SDK 57 automatically stops on headphone/Bluetooth disconnection.
          // Paused status is authoritative; never auto-resume after interruption.
          if (status.mediaServicesDidReset) {
            wanted = false;
            clearWait();
            safe(record.player.pause);
            publish({ ...state, ...time, phase: 'paused' });
          } else if (!wanted) {
            if (status.playing) safe(record.player.pause);
            if (state.phase === 'paused') publish({ ...state, ...time });
          } else if (status.didJustFinish) {
            wanted = false;
            clearWait();
            publish({ ...state, ...time, phase: 'ended' });
          } else if (status.playing && !status.isBuffering) {
            // Expo web's onplay fires before media time advances; its following
            // loadeddata event reports playing:false at zero. Treat this start
            // edge as loading until actual media time confirms playback.
            if (deps.web && currentTime === 0) {
              publish({ ...state, ...time, phase: 'loading' });
            } else {
              record.confirmedPlaying = true;
              clearWait();
              publish({ ...state, ...time, phase: 'playing', error: null });
            }
          } else if (status.isBuffering || !status.isLoaded) {
            if (state.phase !== 'loading') watch(ticket);
            publish({ ...state, ...time, phase: 'loading' });
          } else if (record.confirmedPlaying) {
            wanted = false;
            clearWait();
            publish({ ...state, ...time, phase: 'paused' });
          } else {
            publish({ ...state, ...time });
          }
        });
        record.player.load();
      }
    } catch {
      fail(mine);
    }
  };

  const start = (mine: number, voice: TutorVoiceKey, _fresh: boolean) => {
    if (mine !== ticket || !wanted) return;
    prepare(mine, voice);
    try {
      // play() queues playback while loading on native. On web this stays
      // synchronous with the tap, avoiding Safari's user-activation restriction.
      if (owned && wanted && mine === ticket) owned.player.play();
    } catch {
      fail(mine);
    }
  };

  const toggle = (voice: TutorVoiceKey) => {
    if (state.voice === voice && (state.phase === 'playing' || state.phase === 'loading')) {
      pause();
      return;
    }
    const fresh = state.voice !== voice || state.phase !== 'paused' || !owned;
    if (fresh) close();
    // A resume needs its own confirmed-playing edge. The queued status from
    // the preceding pause is not evidence that this new request was interrupted.
    if (owned) owned.confirmedPlaying = false;
    const mine = ++ticket;
    wanted = true;
    publish({ ...(fresh ? EMPTY : state), voice, phase: 'loading', error: null });
    watch(mine);
    try {
      // Local asset loading can run beside native audio-mode setup. Only play
      // waits for the mode; making these two preparations serial was avoidable
      // silence on the first tap. Web still loads and plays inside its gesture.
      if (!deps.web) prepare(mine, voice);
      const ready = deps.ready();
      if (deps.web) {
        // Modes have no effect on web; still enter the seam to pause sound effects.
        void ready.catch(() => {});
        start(mine, voice, fresh);
      } else {
        void ready.then(() => start(mine, voice, fresh), () => fail(mine));
      }
    } catch {
      fail(mine);
    }
  };

  const stop = () => {
    ticket += 1;
    wanted = false;
    clearWait();
    close();
    if (state !== EMPTY) publish(EMPTY);
  };

  return {
    toggle, stop,
    getSnapshot: () => state,
    getControlSnapshot: () => controlState,
    subscribeControls: (listener: () => void) => {
      controlListeners.add(listener);
      return () => { controlListeners.delete(listener); };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
