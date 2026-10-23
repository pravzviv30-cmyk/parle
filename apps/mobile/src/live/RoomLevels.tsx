/**
 * The room's levels in a browser (come alive, core loop 3.2): a Web Audio
 * analyser on each of the two tracks `useLiveSession` hands over, through the
 * tested meter in `live/levels.ts`, into the orb's shared values
 * (`live/OrbAudio.tsx`). Metro picks `RoomLevels.native.tsx` on a phone.
 *
 * - The microphone: the RMS of the real waveform (`getFloatTimeDomainData`),
 *   the same reading LiveKit's native renderer reports, so one normaliser
 *   serves both platforms.
 * - The tutor: seven log-spaced bands from 150 Hz to 4 kHz out of the real
 *   spectrum (`getByteFrequencyData`).
 *
 * Sampled on animation frames at no more than 25 a second, and written straight
 * into shared values: no React state per frame at all. Each analyser is opened
 * once its track exists, which is after the learner's start tap, so the browser
 * lets its audio context run; one still suspended reads silence, and silence
 * never makes a level live, so the orb keeps its loops. Every analyser is closed
 * when its track goes, the page is hidden, another screen covers the room or the
 * room ends. Nothing is recorded or sent: the analyser reads the level and lets
 * the audio go.
 *
 * Reduce Motion: as on a phone, the tutor is not measured, because the orb's
 * bars hold still; the microphone is, for the listening ring's opacity steps.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAudioAnalyser, type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import { useSharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { LevelsGuard, OrbAudioContext, useAppActive, type OrbAudio, type RoomLevelsProps } from './OrbAudio.tsx';
import {
  LEVEL_SAMPLE_MS,
  NO_ROOM_FACTS,
  bandsFromSpectrum,
  createRoomFacts,
  createRoomMeter,
  rmsOf,
  type MeterClock,
  type RoomFacts,
  type RoomMeter,
} from './levels.ts';

/** A small FFT is plenty for a level and seven bands; the decibel window covers a speaking voice. */
const ANALYSER = { fftSize: 512, smoothingTimeConstant: 0.5, minDecibels: -90, maxDecibels: -20 };

const CLOCK: MeterClock = {
  now: () => Date.now(),
  later: (run, ms) => setTimeout(run, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Open an analyser on `track` and call the reader `prepare` builds at most once
 * per LEVEL_SAMPLE_MS, on animation frames. Returns the cleanup that closes it.
 */
function sample(
  track: LocalAudioTrack | RemoteAudioTrack,
  onFail: () => void,
  prepare: (analyser: AnalyserNode) => () => void,
): () => void {
  let analysis: ReturnType<typeof createAudioAnalyser>;
  try {
    analysis = createAudioAnalyser(track, ANALYSER);
  } catch (error) {
    console.info('[luvani:live] levels-unavailable', { error: String(error) });
    onFail();
    return () => {};
  }
  const context = analysis.analyser.context as AudioContext;
  if (context.state === 'suspended' && typeof context.resume === 'function') void context.resume().catch(() => {});
  const read = prepare(analysis.analyser);
  let frame = 0;
  let last = Number.NEGATIVE_INFINITY;
  let open = true;
  const step = (time: number): void => {
    if (!open) return;
    frame = requestAnimationFrame(step);
    if (time - last < LEVEL_SAMPLE_MS) return;
    last = time;
    read();
  };
  frame = requestAnimationFrame(step);
  return () => {
    open = false;
    cancelAnimationFrame(frame);
    void analysis.cleanup().catch(() => {});
  };
}

function MicMeter({ track, meter, onFail }: { track: LocalAudioTrack; meter: RoomMeter; onFail: () => void }) {
  useEffect(
    () =>
      sample(track, onFail, (analyser) => {
        const wave = new Float32Array(analyser.fftSize);
        return () => {
          analyser.getFloatTimeDomainData(wave);
          meter.mic(rmsOf(wave));
        };
      }),
    [track, meter, onFail],
  );
  return null;
}

function TutorMeter({ track, meter, onFail }: { track: RemoteAudioTrack; meter: RoomMeter; onFail: () => void }) {
  useEffect(
    () =>
      sample(track, onFail, (analyser) => {
        const spectrum = new Uint8Array(analyser.frequencyBinCount);
        const rate = analyser.context.sampleRate;
        return () => {
          analyser.getByteFrequencyData(spectrum);
          meter.tutor(bandsFromSpectrum(spectrum, rate));
        };
      }),
    [track, meter, onFail],
  );
  return null;
}

export function RoomLevels({ micTrack, tutorTrack, micOpen, tutorSpeaking, focused, quietVoice = false, children }: RoomLevelsProps) {
  const input = useSharedValue(0);
  const bands = useSharedValue<number[]>([]);
  const output = useSharedValue(0);
  const inputLive = useSharedValue(false);
  const outputLive = useSharedValue(false);
  const sink = useMemo(
    () => ({ input, bands, output, inputLive, outputLive }),
    [input, bands, output, inputLive, outputLive],
  );
  // The same frames, said as the few facts the orb's layers branch on. They
  // change a few times a conversation, so this state is not per frame.
  const [facts, setFacts] = useState<RoomFacts>(NO_ROOM_FACTS);
  const [watch] = useState(() => createRoomFacts(setFacts, CLOCK));
  const [meter] = useState(() => createRoomMeter(sink, CLOCK, watch.frame));
  const reduced = useReduceMotion();
  const active = useAppActive();
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  // What is measured now: nothing with the page hidden, behind another screen
  // or after an analyser failed, and not the tutor's bands under Reduce Motion.
  const measuring = active && focused && !failed;
  const mic = measuring ? micTrack : null;
  const tutor = measuring && !reduced ? tutorTrack : null;

  // Awake is the room in front of the learner, whether or not a meter runs: the
  // orb's own layers rest with the page hidden and behind another screen.
  const awake = active && focused;
  const audio = useMemo<OrbAudio>(
    () => ({ ...sink, room: { ...facts, awake } }),
    [sink, facts, awake],
  );

  useEffect(() => {
    meter.measuring({ mic, tutor });
  }, [meter, mic, tutor]);
  useEffect(() => {
    meter.quiet(quietVoice);
  }, [meter, quietVoice]);
  useEffect(() => {
    meter.turn({ micOpen, tutorSpeaking });
  }, [meter, micOpen, tutorSpeaking]);
  useEffect(() => () => {
    meter.stop();
    watch.stop();
  }, [meter, watch]);

  return (
    <OrbAudioContext.Provider value={audio}>
      <LevelsGuard onFail={fail}>
        {mic !== null ? <MicMeter track={mic} meter={meter} onFail={fail} /> : null}
        {tutor !== null ? <TutorMeter track={tutor} meter={meter} onFail={fail} /> : null}
      </LevelsGuard>
      {children}
    </OrbAudioContext.Provider>
  );
}
