/**
 * The rules of the audio session, without the native call. Pure, so the tests run them against a
 * fake `setMode`; `sound/audioSession.ts` binds them to expo-audio's `setAudioModeAsync`, and that
 * is the only file that may import it (F723).
 *
 * - Every change is a full mode (sound/audioModes.ts), serialised on one promise chain, and a change
 *   to the mode the session is already in is skipped.
 * - Voice and recording first pause any sound effect still playing. A sound effect that ended
 *   during a tutor line used to let iOS deactivate the session under it (review finding 5).
 * - Entering voice playback bridges the gap until the player reports `playing` and its
 *   `useVoiceHold` takes over, the device voice's own line ends, or a play that never starts is
 *   given up (VOICE_BRIDGE_MS): a sound effect asked for in that gap must not switch the session
 *   to `.ambient` under a line that is about to start (sound/audioFocus.ts, the voice bridge).
 * - A sound effect never takes the session from a microphone, a voice line or a live room.
 * - A voice line never stops a recording or takes a live room's session: while the microphone is
 *   held it plays in the recording mode (also audible in silent mode), and while a room is open
 *   the session stays LiveKit's. A mode without the microphone stops every recorder on iOS.
 * - Leaving a recording does the same: while another recorder holds the microphone or a room is
 *   open, the session stays as it is (F738).
 * - After a live room hands the session back, nothing is assumed about it (`markUnknown`).
 */
import { AUDIO_MODES, type AudioModeName, type FullAudioMode } from './audioModes.ts';
import {
  anyHold as defaultAnyHold,
  bridgeVoice,
  liveRoom as defaultLiveRoom,
  micLive as defaultMicLive,
} from './audioFocus.ts';

export type SessionMode = AudioModeName | 'unknown';

/**
 * The longest entering voice playback holds the voice focus waiting for its line to start. The
 * player's own hold, or the end of the device voice's line, ends it sooner; this bounds only a play
 * that never starts (a stale ticket, a failed load), so sound effects come back in time. Long
 * enough for a slow first load: refusing a sound effect costs a courtesy, while a voice line
 * started in the sound-effect mode follows the silent switch.
 */
export const VOICE_BRIDGE_MS = 5000;

export type AudioSessionDeps = {
  setMode: (mode: FullAudioMode) => Promise<void>;
  anyHold?: () => boolean;
  micLive?: () => boolean;
  liveRoom?: () => boolean;
  /** Opens the voice bridge (sound/audioFocus.ts `bridgeVoice`) and returns its releaser. */
  holdVoice?: () => () => void;
  later?: (run: () => void, ms: number) => void;
};

export type AudioSession = {
  enterVoicePlayback: () => Promise<void>;
  enterRecording: () => Promise<void>;
  leaveRecording: () => Promise<void>;
  /** Resolves true only when the session is in the sound-effect mode and nothing holds focus. */
  enterSfx: () => Promise<boolean>;
  markUnknown: () => void;
  currentMode: () => SessionMode;
  /** The sound-effect seam registers how to pause every sound effect it has playing. */
  setSfxPause: (pause: () => void) => void;
};

export function createAudioSession(deps: AudioSessionDeps): AudioSession {
  const anyHold = deps.anyHold ?? defaultAnyHold;
  const micLive = deps.micLive ?? defaultMicLive;
  const liveRoom = deps.liveRoom ?? defaultLiveRoom;
  const openBridge = deps.holdVoice ?? bridgeVoice;
  const later = deps.later ?? ((run: () => void, ms: number) => void setTimeout(run, ms));
  let current: SessionMode = 'unknown';
  // Moved by markUnknown, so a change already in flight cannot record a mode the room replaced.
  let epoch = 0;
  let chain: Promise<unknown> = Promise.resolve();
  let pauseSfx: () => void = () => {};

  const quietSfx = (): void => {
    try {
      pauseSfx();
    } catch {
      /* A sound effect that cannot pause must not stop a voice line or a recording. */
    }
  };

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const work = chain.then(job);
    chain = work.catch(() => {});
    return work;
  }

  async function switchTo(target: AudioModeName): Promise<void> {
    if (current === target) return;
    const mine = epoch;
    current = 'unknown';
    await deps.setMode(AUDIO_MODES[target]);
    if (mine === epoch) current = target;
  }

  const enterVoicePlayback = (): Promise<void> => {
    quietSfx();
    later(openBridge(), VOICE_BRIDGE_MS);
    return enqueue(async () => {
      // A sound effect that started while this waited its turn stops before the line plays.
      quietSfx();
      if (liveRoom()) return;
      await switchTo(micLive() ? 'record' : 'voice');
    });
  };

  const enterRecording = (): Promise<void> => {
    quietSfx();
    return enqueue(async () => {
      quietSfx();
      await switchTo('record');
    });
  };

  /**
   * Back to voice: the microphone is closed, and any voice line stays audible in silent mode.
   * Only once nobody else needs the microphone, asked when its turn comes: another recorder's
   * hold or a live room keeps the session it has, because a mode without the microphone stops
   * every recorder on iOS, LiveKit's included (F738).
   */
  const leaveRecording = (): Promise<void> =>
    enqueue(async () => {
      if (micLive() || liveRoom()) return;
      await switchTo('voice');
    });

  const enterSfx = (): Promise<boolean> => {
    if (anyHold()) return Promise.resolve(false);
    return enqueue(async () => {
      if (anyHold()) return false;
      await switchTo('sfx');
      return current === 'sfx' && !anyHold();
    });
  };

  const markUnknown = (): void => {
    epoch += 1;
    current = 'unknown';
  };

  return {
    enterVoicePlayback,
    enterRecording,
    leaveRecording,
    enterSfx,
    markUnknown,
    currentMode: () => current,
    setSfxPause: (pause) => {
      pauseSfx = pause;
    },
  };
}
