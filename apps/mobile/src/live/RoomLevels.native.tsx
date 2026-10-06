/**
 * The room's levels on a phone (come alive, core loop 3.2): LiveKit's own
 * processors on the two tracks `useLiveSession` hands over, through the tested
 * meter in `live/levels.ts`, into the orb's shared values (`live/OrbAudio.tsx`).
 * Metro picks this file on iOS and Android; `RoomLevels.tsx` is the browser's.
 *
 * - The microphone: `useTrackVolume`, an RMS every 40 ms from the native audio
 *   renderer, which handles a local track as well as a remote one.
 * - The tutor: `useMultibandTrackVolume`, seven bands from 150 Hz to 4 kHz,
 *   every 40 ms.
 *
 * Each hook sets React state on every reading, so each lives in its own leaf
 * that renders nothing: only the leaf re-renders at 25 Hz, and the room around
 * it does not. The leaves mount only while the app is in front of the learner
 * and the room's screen is focused, and unmounting them deletes the native
 * processors.
 *
 * Reduce Motion: the orb's bars and its core hold still (tutor/orbRest.ts), so
 * the tutor's processor is not run for them. The microphone level is: the
 * listening ring keeps three opacity steps under Reduce Motion, so the learner
 * still sees they are heard.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMultibandTrackVolume, useTrackVolume } from '@livekit/react-native';
import type { LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import { useSharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { LevelsGuard, OrbAudioContext, useAppActive, type OrbAudio, type RoomLevelsProps } from './OrbAudio.tsx';
import {
  BAND_COUNT,
  BAND_MAX_HZ,
  BAND_MIN_HZ,
  LEVEL_SAMPLE_MS,
  createRoomMeter,
  type MeterClock,
  type RoomMeter,
} from './levels.ts';

const TUTOR_BANDS = { bands: BAND_COUNT, minFrequency: BAND_MIN_HZ, maxFrequency: BAND_MAX_HZ, updateInterval: LEVEL_SAMPLE_MS };

const CLOCK: MeterClock = {
  now: () => Date.now(),
  later: (run, ms) => setTimeout(run, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The microphone's processor. The hook never reports a zero, so its first value (its own 0) is not a reading. */
function MicMeter({ track, meter }: { track: LocalAudioTrack; meter: RoomMeter }) {
  const volume = useTrackVolume(track);
  useEffect(() => {
    if (volume > 0) meter.mic(volume);
  }, [volume, meter]);
  return null;
}

/** The tutor's processor, in seven bands. */
function TutorMeter({ track, meter }: { track: RemoteAudioTrack; meter: RoomMeter }) {
  const magnitudes = useMultibandTrackVolume(track, TUTOR_BANDS);
  useEffect(() => {
    if (magnitudes.length > 0) meter.tutor(magnitudes);
  }, [magnitudes, meter]);
  return null;
}

export function RoomLevels({ micTrack, tutorTrack, micOpen, tutorSpeaking, focused, children }: RoomLevelsProps) {
  const input = useSharedValue(0);
  const bands = useSharedValue<number[]>([]);
  const output = useSharedValue(0);
  const inputLive = useSharedValue(false);
  const outputLive = useSharedValue(false);
  const audio = useMemo<OrbAudio>(
    () => ({ input, bands, output, inputLive, outputLive }),
    [input, bands, output, inputLive, outputLive],
  );
  const [meter] = useState(() => createRoomMeter(audio, CLOCK));
  const reduced = useReduceMotion();
  const active = useAppActive();
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  // What is measured now: nothing in the background, behind another screen or
  // after a processor failed, and not the tutor's bands under Reduce Motion.
  const measuring = active && focused && !failed;
  const mic = measuring ? micTrack : null;
  const tutor = measuring && !reduced ? tutorTrack : null;

  useEffect(() => {
    meter.measuring({ mic, tutor });
  }, [meter, mic, tutor]);
  useEffect(() => {
    meter.turn({ micOpen, tutorSpeaking });
  }, [meter, micOpen, tutorSpeaking]);
  useEffect(() => () => meter.stop(), [meter]);

  return (
    <OrbAudioContext.Provider value={audio}>
      <LevelsGuard onFail={fail}>
        {mic !== null ? <MicMeter track={mic} meter={meter} /> : null}
        {tutor !== null ? <TutorMeter track={tutor} meter={meter} /> : null}
      </LevelsGuard>
      {children}
    </OrbAudioContext.Provider>
  );
}
