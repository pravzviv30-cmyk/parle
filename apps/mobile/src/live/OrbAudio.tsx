/**
 * The room's audio levels, as the orb reads them (come alive, core loop 3.2).
 *
 * `live/RoomLevels` (a native and a web file, picked by Metro) measures the two
 * tracks `useLiveSession` hands over and writes the results into these shared
 * values, which the orb's layers read on the UI thread. Nothing per audio frame
 * passes through React state outside the two small leaves that hold LiveKit's
 * hooks, so the conversation screen does not re-render while somebody speaks.
 *
 * The context is null outside a room. TutorIntro, the waiting screens and the
 * choosing pages keep the loops they have today, and so does a room whose
 * levels are not measured (`inputLive` and `outputLive` false): a processor
 * that never started, a browser that never opened its audio context, or a
 * build without the native module. The orb never invents a level.
 *
 * Only a type crosses from the animation engine here, so this file loads
 * anywhere; creating the values is RoomLevels' job.
 */

import { Component, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';

import type { RoomFacts } from './levels.ts';

/**
 * What the orb's layers branch on, as plain values (`live/levels.ts`
 * `createRoomFacts`), so a layer is drawn or not without reading a shared value
 * back. Each changes a few times a conversation, never per frame.
 */
export interface OrbRoom extends RoomFacts {
  /** The room is the screen in front of the learner and the app is active. False: every layer rests. */
  readonly awake: boolean;
}

export interface OrbAudio {
  /** The learner's microphone level, 0 to 1, gated to their turn. */
  input: SharedValue<number>;
  /** The tutor's voice in seven bands, 0 to 1 each, low to high. Empty before the first reading. */
  bands: SharedValue<number[]>;
  /** The tutor's overall level, 0 to 1. */
  output: SharedValue<number>;
  /** True once the microphone level is measured. False: draw today's loops. */
  inputLive: SharedValue<boolean>;
  /** True once the tutor's voice is measured. False: draw today's loops. */
  outputLive: SharedValue<boolean>;
  /** The same facts in words, for deciding which layers to draw. */
  room: OrbRoom;
}

export const OrbAudioContext = createContext<OrbAudio | null>(null);

/** The room's levels, or null outside a room. */
export function useOrbAudio(): OrbAudio | null {
  return useContext(OrbAudioContext);
}

/** What both RoomLevels files take, so the two platforms cannot drift apart. */
export interface RoomLevelsProps {
  /** The learner's published microphone, from `useLiveSession().audioTracks`. */
  micTrack: LocalAudioTrack | null;
  /** The tutor's voice, from `useLiveSession().audioTracks`. */
  tutorTrack: RemoteAudioTrack | null;
  /** Whose turn it is: the learner's level counts only while their microphone is open and the tutor is quiet. */
  micOpen: boolean;
  tutorSpeaking: boolean;
  /**
   * True while the room's screen is the one in front of the learner. The screen
   * reads it from navigation and passes it in, so RoomLevels never reaches for
   * the navigator itself.
   */
  focused: boolean;
  /** The room. The levels are handed to it through `OrbAudioContext`. */
  children: ReactNode;
}

/**
 * True while the app is in front of the learner. The processors run only then,
 * and only while the room's screen is focused: unmounting their leaves deletes
 * them, so nothing measures a room nobody sees.
 */
export function useAppActive(): boolean {
  const awake = (state: AppStateStatus | null | undefined): boolean => state !== 'background' && state !== 'inactive';
  const [active, setActive] = useState(() => awake(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(awake(state)));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * A meter that fails stays out of the room. LiveKit's processors are native
 * calls made inside effects, and a build without them, or a browser that
 * refuses an analyser, must cost the orb its levels and never the learner
 * their conversation: the guard draws nothing and says so once, and the orb
 * keeps its loops.
 */
export class LevelsGuard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.info('[luvani:live] levels-unavailable', { error: String(error) });
    this.props.onFail();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
