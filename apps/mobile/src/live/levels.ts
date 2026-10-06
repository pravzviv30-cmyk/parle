/**
 * How loud the room is, decided: the learner's microphone level and the tutor's
 * voice in seven bands, ready for the orb to draw (come alive, core loop 3.2).
 *
 * Pure, so the rules run in the Node suite. The two `live/RoomLevels` files feed
 * it readings from the real tracks (LiveKit's native processors on a phone, a
 * Web Audio analyser in a browser) and write what it returns into shared values,
 * so nothing here renders and nothing here keeps a clock.
 *
 * The trap this exists for: LiveKit's native volume hook only ever writes a
 * reading that is not zero (`if (event.volume && …)`), so when the audio stops
 * the last loud reading stays where it was and an orb drawn from it would go on
 * swelling at nobody. A level that has heard nothing new for STALE_AFTER_MS is
 * therefore treated as silence and falls to rest, one envelope step at a time,
 * until it is exactly zero.
 *
 * A level is only drawn once it is real. Until a track has produced a reading
 * above zero (a processor that never started, a browser that never opened its
 * audio context, a build without the native module) its `live` flag stays false
 * and the orb keeps the loops it has today. Nothing here invents movement.
 *
 * The constants are the core loop spec's starting values. They are not yet tuned
 * on a device; docs/LIVE_VOICE.md says so and is where tuned values are written.
 */

/** LiveKit's Swift processors report every 40 ms, and the web sampler keeps the same pace. */
export const LEVEL_SAMPLE_MS = 40;
/** A level that has heard nothing new for this long is silence: the native hook never writes a zero. */
export const STALE_AFTER_MS = 120;
/** The tutor's voice in seven bands, one for each bar the orb draws. */
export const BAND_COUNT = 7;
/** The bands cover speech: from a low voice's fundamental to the top of its consonants. */
export const BAND_MIN_HZ = 150;
export const BAND_MAX_HZ = 4000;

/** The envelope, per 40 ms step: it rises quickly with a voice and falls back gently. */
export const ATTACK = 0.6;
export const RELEASE = 0.15;
/** Below this, falling towards silence, a level is at rest and is written as exactly zero. */
export const REST_BELOW = 0.01;
/**
 * The bands are drawn against the voice's recent loudest band, one running peak
 * for all seven so the shape of the voice survives (a per-band peak would draw
 * every bar full). It decays by this per step and never below the floor.
 */
export const PEAK_DECAY = 0.995;
export const PEAK_FLOOR = 0.05;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** A microphone RMS (linear, 0 to 1) as a level. Room noise sits under 0.01 and draws nothing. */
export function normaliseRms(rms: number): number {
  return clamp01((rms - 0.01) / 0.2) ** 0.6;
}

/** A recorder's metering in dBFS (−160 is silence) as a level, for the recorders' rings. */
export function normaliseDb(db: number): number {
  return clamp01((db + 50) / 40) ** 0.8;
}

/** The RMS of a run of samples from a time-domain buffer: the web's reading of what the native hook reports. */
export function rmsOf(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    sum += Number.isFinite(s) ? s * s : 0;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Seven log-spaced bands from a byte spectrum (Web Audio's `getByteFrequencyData`),
 * each the mean of its bins over 255. A band too narrow to hold a bin reads the
 * bin it falls in, so no band is silently empty.
 */
export function bandsFromSpectrum(
  bins: ArrayLike<number>,
  sampleRate: number,
  count = BAND_COUNT,
  minHz = BAND_MIN_HZ,
  maxHz = BAND_MAX_HZ,
): number[] {
  const out: number[] = [];
  if (bins.length === 0 || !(sampleRate > 0)) return Array.from({ length: count }, () => 0);
  const hzPerBin = sampleRate / 2 / bins.length;
  const ratio = maxHz / minHz;
  for (let band = 0; band < count; band += 1) {
    const lowHz = minHz * ratio ** (band / count);
    const highHz = minHz * ratio ** ((band + 1) / count);
    const first = Math.min(bins.length - 1, Math.floor(lowHz / hzPerBin));
    const last = Math.min(bins.length - 1, Math.max(first, Math.ceil(highHz / hzPerBin) - 1));
    let sum = 0;
    for (let bin = first; bin <= last; bin += 1) sum += bins[bin] ?? 0;
    out.push(clamp01(sum / (last - first + 1) / 255));
  }
  return out;
}

/** One step of the envelope from `prev` towards `next`, landing on exactly zero once it is quiet. */
export function envelope(prev: number, next: number): number {
  const target = clamp01(next);
  const from = clamp01(prev);
  const moved = from + (target - from) * (target > from ? ATTACK : RELEASE);
  return moved < REST_BELOW && target < REST_BELOW ? 0 : moved;
}

/** True when nothing new has been heard for STALE_AFTER_MS, or nothing ever has. */
export function isStale(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= STALE_AFTER_MS;
}

/** One level and what is known about it. */
export interface Meter {
  /** As drawn, 0 to 1. */
  readonly level: number;
  /** When the last reading arrived, or null before the first. */
  readonly at: number | null;
  /** True once the track has given a reading above zero: the level is measured, not assumed. */
  readonly heard: boolean;
}

export const QUIET_METER: Meter = Object.freeze({ level: 0, at: null, heard: false });

/** The tutor's voice, band by band. */
export interface Bands {
  readonly levels: readonly number[];
  /** The recent loudest band, which every level is drawn against. */
  readonly peak: number;
  readonly at: number | null;
  readonly heard: boolean;
}

export const QUIET_BANDS: Bands = Object.freeze({
  levels: Object.freeze(Array.from({ length: BAND_COUNT }, () => 0)),
  peak: PEAK_FLOOR,
  at: null,
  heard: false,
});

/** Whose turn it is, as the room says it. */
export interface Turn {
  micOpen: boolean;
  tutorSpeaking: boolean;
}

/**
 * The learner's level counts only on their turn. A closed microphone is not
 * listening, and while the tutor speaks the microphone mostly hears the tutor
 * coming back out of the speaker.
 */
export function micCounts(turn: Turn): boolean {
  return turn.micOpen && !turn.tutorSpeaking;
}

/** Both levels in the room. */
export interface RoomLevelState {
  readonly mic: Meter;
  readonly tutor: Bands;
}

export const ROOM_AT_REST: RoomLevelState = Object.freeze({ mic: QUIET_METER, tutor: QUIET_BANDS });

/** A reading from the microphone's processor: an RMS, 0 to 1. Off the learner's turn it pulls the level to rest. */
export function hearMic(state: RoomLevelState, rms: number, now: number, turn: Turn): RoomLevelState {
  const value = micCounts(turn) ? normaliseRms(rms) : 0;
  return {
    ...state,
    mic: { level: envelope(state.mic.level, value), at: now, heard: state.mic.heard || rms > 0 },
  };
}

/** A reading from the tutor's processor: one magnitude per band, 0 to 1. */
export function hearTutor(state: RoomLevelState, magnitudes: readonly number[], now: number): RoomLevelState {
  const raw = Array.from({ length: BAND_COUNT }, (_, i) => clamp01(magnitudes[i] ?? 0));
  const loudest = Math.max(...raw);
  const peak = Math.max(loudest, state.tutor.peak * PEAK_DECAY, PEAK_FLOOR);
  const levels = raw.map((value, i) => envelope(state.tutor.levels[i] ?? 0, value / peak));
  return { ...state, tutor: { levels, peak, at: now, heard: state.tutor.heard || loudest > 0 } };
}

/**
 * No new reading this step. A level that has heard nothing for STALE_AFTER_MS
 * falls one envelope step towards zero, and the learner's level falls whenever
 * it is not their turn. Called once per LEVEL_SAMPLE_MS by the room while
 * anything is still above rest (`restDue`).
 */
export function settleRoom(state: RoomLevelState, now: number, turn: Turn): RoomLevelState {
  const micFalls = state.mic.level > 0 && (!micCounts(turn) || isStale(state.mic.at, now));
  const tutorFalls = state.tutor.levels.some((l) => l > 0) && isStale(state.tutor.at, now);
  if (!micFalls && !tutorFalls) return state;
  return {
    mic: micFalls ? { ...state.mic, level: envelope(state.mic.level, 0) } : state.mic,
    tutor: tutorFalls ? { ...state.tutor, levels: state.tutor.levels.map((l) => envelope(l, 0)) } : state.tutor,
  };
}

/** True when both levels are at exactly zero and nothing is left to fall. */
export function atRest(state: RoomLevelState): boolean {
  return state.mic.level === 0 && state.tutor.levels.every((l) => l === 0);
}

/** How long until the room should settle again, or null when it is at rest and needs no timer at all. */
export function restDue(state: RoomLevelState): number | null {
  return atRest(state) ? null : LEVEL_SAMPLE_MS;
}

/** What the orb is handed, every step. */
export interface LevelFrame {
  /** The learner's level, 0 to 1, already gated to their turn. */
  input: number;
  /** The tutor's voice in BAND_COUNT bands, 0 to 1 each, low to high. */
  bands: number[];
  /** The tutor's overall level, 0 to 1: the mean of the bands. */
  output: number;
  /** False means the microphone level is not measured: draw today's loops. */
  inputLive: boolean;
  /** False means the tutor's voice is not measured: draw today's loops. */
  outputLive: boolean;
}

/** The frame for the room as it stands, given which tracks it is measuring. */
export function frameOf(state: RoomLevelState, measuring: { mic: boolean; tutor: boolean }): LevelFrame {
  const bands = [...state.tutor.levels];
  const output = bands.length === 0 ? 0 : bands.reduce((sum, l) => sum + l, 0) / bands.length;
  return {
    input: state.mic.level,
    bands,
    output,
    inputLive: measuring.mic && state.mic.heard,
    outputLive: measuring.tutor && state.tutor.heard,
  };
}

/** Where a frame lands: the orb's shared values on a device (`live/OrbAudio.tsx`), plain objects in a test. */
export interface LevelSink {
  input: { value: number };
  bands: { value: number[] };
  output: { value: number };
  inputLive: { value: boolean };
  outputLive: { value: boolean };
}

/** The meter's clock and timer, handed in so the suite can run them. */
export interface MeterClock {
  now: () => number;
  later: (run: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
}

/** The two tracks being measured, by identity: a different track is a different measurement. */
export interface Measuring {
  mic: unknown;
  tutor: unknown;
}

/** The room's meter, as the `RoomLevels` files drive it. */
export interface RoomMeter {
  /** A reading from the microphone's processor: an RMS, 0 to 1. */
  mic(rms: number): void;
  /** A reading from the tutor's processor: one magnitude per band, 0 to 1. */
  tutor(magnitudes: readonly number[]): void;
  /** Whose turn it is now. A turn that closes the learner's gate lets their level fall. */
  turn(turn: Turn): void;
  /** Which tracks are measured now. A track that goes or changes is forgotten, and must prove itself again. */
  measuring(tracks: Measuring): void;
  /** Cancel the timer and write rest: the room has gone, or the app has. */
  stop(): void;
}

/**
 * The meter: every reading through the rules above, every result written to
 * the sink, and one timer that runs only while something is above rest. It is
 * that timer, not a new reading, that brings a level down after the audio
 * stops, because after the audio stops there are no readings.
 */
export function createRoomMeter(sink: LevelSink, clock: MeterClock): RoomMeter {
  let state: RoomLevelState = ROOM_AT_REST;
  let gate: Turn = { micOpen: false, tutorSpeaking: false };
  let tracks: Measuring = { mic: null, tutor: null };
  let timer: unknown = null;

  const write = (): void => {
    const frame = frameOf(state, { mic: tracks.mic != null, tutor: tracks.tutor != null });
    sink.input.value = frame.input;
    sink.bands.value = frame.bands;
    sink.output.value = frame.output;
    sink.inputLive.value = frame.inputLive;
    sink.outputLive.value = frame.outputLive;
  };

  const schedule = (): void => {
    if (timer !== null) return;
    const due = restDue(state);
    if (due === null) return;
    timer = clock.later(() => {
      timer = null;
      const settled = settleRoom(state, clock.now(), gate);
      // While readings keep coming nothing falls, and the orb is not written
      // the same frame twice.
      if (settled !== state) {
        state = settled;
        write();
      }
      schedule();
    }, due);
  };

  return {
    mic(rms) {
      if (tracks.mic == null) return;
      state = hearMic(state, rms, clock.now(), gate);
      write();
      schedule();
    },
    tutor(magnitudes) {
      if (tracks.tutor == null) return;
      state = hearTutor(state, magnitudes, clock.now());
      write();
      schedule();
    },
    turn(next) {
      gate = { micOpen: next.micOpen, tutorSpeaking: next.tutorSpeaking };
      schedule();
    },
    measuring(next) {
      if (next.mic === tracks.mic && next.tutor === tracks.tutor) return;
      state = {
        mic: next.mic === tracks.mic ? state.mic : QUIET_METER,
        tutor: next.tutor === tracks.tutor ? state.tutor : QUIET_BANDS,
      };
      tracks = { mic: next.mic, tutor: next.tutor };
      write();
      schedule();
    },
    stop() {
      if (timer !== null) clock.cancel(timer);
      timer = null;
      state = ROOM_AT_REST;
      write();
    },
  };
}
