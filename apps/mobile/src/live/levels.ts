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
 * therefore treated as silence and falls to rest until it is exactly zero. A
 * reading that is itself silent (room noise under the floor, which is what the
 * web analyser and a quiet phone send between words) is no news either, so both
 * platforms come to rest the same way.
 *
 * The fall is counted by the clock, not by the step (F777). A level falls the
 * whole scale in RELEASE_MS however often it is looked at, so a timer that runs
 * late on a busy thread, or a reading that comes at an odd pace, never slows it
 * down: it is at rest within REST_WITHIN_MS of the last reading that held it up.
 * The "Hearing you" word keeps the same promise on its own clock, counted from
 * that reading rather than from the ring (`createRoomFacts`, below).
 *
 * A level is only drawn once it is real. Until a track has produced a reading
 * above zero (a processor that never started, a browser that never opened its
 * audio context, a build without the native module) its `live` flag stays false
 * and the orb keeps the loops it has today. Nothing here invents movement.
 *
 * The constants are chosen to keep acceptance check 7 (rest within 300 ms of
 * silence). They are not yet tuned by eye on a device; docs/LIVE_VOICE.md says
 * so and is where tuned values are written.
 */

/** LiveKit's Swift processors report every 40 ms, and the web sampler keeps the same pace. */
export const LEVEL_SAMPLE_MS = 40;
/**
 * A level that has heard nothing new for this long is silence: the native hook
 * never writes a zero. One reading may go missing without the ring moving. The
 * silence is believed at the second, but dated from the first reading that did
 * not come, one LEVEL_SAMPLE_MS after the last one that did, so a quiet level
 * (a quarter of the scale or less) is at rest the moment it is believed. That
 * is the ring only: "Hearing you" waits HEARING_SILENCE_OFF_MS, below.
 */
export const STALE_AFTER_MS = 80;
/** The tutor's voice in seven bands, one for each bar the orb draws. */
export const BAND_COUNT = 7;
/** The bands cover speech: from a low voice's fundamental to the top of its consonants. */
export const BAND_MIN_HZ = 150;
export const BAND_MAX_HZ = 4000;

/** The envelope's rise, per reading: a voice is followed within a reading or two. */
export const ATTACK = 0.6;
/** The envelope's fall, by the clock: from a full level to rest in this long, and any lower level sooner. */
export const RELEASE_MS = 160;
/**
 * The promise the two above keep (acceptance check 7): a level is at rest, and
 * "Hearing you" has gone, this soon after the last reading that held it up.
 * The ring's worst case is the dated silence (one sample), the whole release,
 * and one more sample before the meter's timer looks again: 40 + 160 + 40 =
 * 240 ms. The word's is HEARING_SILENCE_OFF_MS and a timer one sample late:
 * 260 + 40 = 300 ms.
 */
export const REST_WITHIN_MS = 300;
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

/**
 * A level falling towards `floor` for `elapsedMs`, by the clock: the whole
 * scale in RELEASE_MS, so the same time falls the same distance however many
 * steps it is cut into. It never falls below the floor, and once it is under
 * REST_BELOW on its way to silence it is exactly zero.
 */
export function release(level: number, elapsedMs: number, floor = 0): number {
  const from = clamp01(level);
  const to = clamp01(floor);
  if (from <= to) return from;
  const fell = Math.max(to, from - Math.max(0, elapsedMs) / RELEASE_MS);
  return fell < REST_BELOW && to < REST_BELOW ? 0 : fell;
}

/**
 * The envelope from `prev` towards `next`: one ATTACK step up for a reading
 * louder than the level, and the clock's release down for a quieter one,
 * `elapsedMs` being the time since the level was last worked out.
 */
export function envelope(prev: number, next: number, elapsedMs: number = LEVEL_SAMPLE_MS): number {
  const target = clamp01(next);
  const from = clamp01(prev);
  if (target > from) return from + (target - from) * ATTACK;
  return release(from, elapsedMs, target);
}

/** True when nothing new has been heard for STALE_AFTER_MS, or nothing ever has. */
export function isStale(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= STALE_AFTER_MS;
}

/** One level and what is known about it. */
export interface Meter {
  /** As drawn, 0 to 1. */
  readonly level: number;
  /** When the last reading that held the level up arrived, or null before the first. The hold counts from here. */
  readonly at: number | null;
  /** When the level was last worked out, by a reading or by the meter's timer. The release counts from here. */
  readonly moved: number | null;
  /** True once the track has given a reading above zero: the level is measured, not assumed. */
  readonly heard: boolean;
}

export const QUIET_METER: Meter = Object.freeze({ level: 0, at: null, moved: null, heard: false });

/** The tutor's voice, band by band. */
export interface Bands {
  readonly levels: readonly number[];
  /** The recent loudest band, which every level is drawn against. */
  readonly peak: number;
  readonly at: number | null;
  readonly moved: number | null;
  readonly heard: boolean;
}

export const QUIET_BANDS: Bands = Object.freeze({
  levels: Object.freeze(Array.from({ length: BAND_COUNT }, () => 0)),
  peak: PEAK_FLOOR,
  at: null,
  moved: null,
  heard: false,
});

/**
 * Since when a level has been falling, or null while it is still held up.
 *
 * Held means a voice may still be there: on the learner's turn, within
 * STALE_AFTER_MS of the last reading that held the level up. Once that has
 * passed, the silence is dated from the first reading that did not come (one
 * LEVEL_SAMPLE_MS after the last that did), so believing it late never makes
 * the level rest late. A level that is not held (the turn has passed) falls
 * from the moment it was last worked out.
 */
function fallingSince(meter: { at: number | null; moved: number | null }, now: number, holds: boolean): number | null {
  if (!holds) return meter.moved ?? now;
  if (!isStale(meter.at, now)) return null;
  const silentFrom = meter.at === null ? now : meter.at + LEVEL_SAMPLE_MS;
  return Math.max(meter.moved ?? silentFrom, silentFrom);
}

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

/** The learner's level with no voice in it: held, or falling by the clock. The same object when nothing moves. */
function settleMic(mic: Meter, now: number, turn: Turn): Meter {
  if (mic.level === 0) return mic;
  const since = fallingSince(mic, now, micCounts(turn));
  if (since === null) return mic;
  return { ...mic, level: release(mic.level, now - since), moved: now };
}

/** The tutor's bands with no voice in them: held, or falling by the clock. The same object when nothing moves. */
function settleTutor(tutor: Bands, now: number): Bands {
  if (tutor.levels.every((l) => l === 0)) return tutor;
  const since = fallingSince(tutor, now, true);
  if (since === null) return tutor;
  return { ...tutor, levels: tutor.levels.map((l) => release(l, now - since)), moved: now };
}

/**
 * A reading from the microphone's processor: an RMS, 0 to 1. A voice on the
 * learner's turn holds the level up; a silent reading, or any reading off
 * their turn, is no news and the level settles as it would with none at all.
 */
export function hearMic(state: RoomLevelState, rms: number, now: number, turn: Turn): RoomLevelState {
  const heard = state.mic.heard || rms > 0;
  const value = micCounts(turn) ? normaliseRms(rms) : 0;
  if (value === 0) {
    const settled = settleMic(state.mic, now, turn);
    return settled === state.mic && heard === state.mic.heard ? state : { ...state, mic: { ...settled, heard } };
  }
  const level = envelope(state.mic.level, value, now - (state.mic.moved ?? now));
  return { ...state, mic: { level, at: now, moved: now, heard } };
}

/**
 * A reading from the tutor's processor: one magnitude per band, 0 to 1. A
 * reading with nothing in any band is silence, no news, as with the microphone.
 */
export function hearTutor(state: RoomLevelState, magnitudes: readonly number[], now: number): RoomLevelState {
  const raw = Array.from({ length: BAND_COUNT }, (_, i) => clamp01(magnitudes[i] ?? 0));
  const loudest = Math.max(...raw);
  if (loudest === 0) {
    const settled = settleTutor(state.tutor, now);
    return settled === state.tutor ? state : { ...state, tutor: settled };
  }
  const peak = Math.max(loudest, state.tutor.peak * PEAK_DECAY, PEAK_FLOOR);
  const elapsed = now - (state.tutor.moved ?? now);
  const levels = raw.map((value, i) => envelope(state.tutor.levels[i] ?? 0, value / peak, elapsed));
  return { ...state, tutor: { levels, peak, at: now, moved: now, heard: true } };
}

/**
 * No new reading. A level held up within STALE_AFTER_MS of its last reading
 * stays where it is; past that, or whenever it is not the learner's turn, it
 * falls by the time since it last moved, so it rests on time even when this is
 * called late. Called every LEVEL_SAMPLE_MS by the room while anything is
 * still above rest (`restDue`). The same object back when nothing moved.
 */
export function settleRoom(state: RoomLevelState, now: number, turn: Turn): RoomLevelState {
  const mic = settleMic(state.mic, now, turn);
  const tutor = settleTutor(state.tutor, now);
  if (mic === state.mic && tutor === state.tutor) return state;
  return { mic, tutor };
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
  /**
   * When the learner's last voiced reading came (above room noise, on their
   * turn), or null before the first. "Hearing you" counts its silence from
   * here, never from the level, which may already be at rest.
   */
  inputAt: number | null;
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
    inputAt: state.mic.at,
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
 *
 * `onFrame`, when given, hears every frame the sink is written, on the same
 * thread: `createRoomFacts` below turns those into the few words the orb
 * branches on, so nothing has to read the shared values back.
 */
export function createRoomMeter(sink: LevelSink, clock: MeterClock, onFrame?: (frame: LevelFrame) => void): RoomMeter {
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
    onFrame?.(frame);
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

/*
 * What the orb branches on, in words rather than numbers (come alive, core
 * loop 3.3). The levels themselves stay on the UI thread in shared values; the
 * orb only needs a handful of facts to decide which layers to draw, and each of
 * them changes a few times a conversation, never per frame:
 *
 * - whether the learner's level is measured (draw the listening ring), and
 *   whether the tutor's voice is (draw the live bars);
 * - whether the learner is being heard: a visual "Hearing you" under the orb,
 *   once their level has stayed above HEARING_ABOVE for HEARING_ON_AFTER_MS,
 *   and back to the state's own word once it has stayed below for
 *   HEARING_OFF_AFTER_MS, or once no voiced reading has come for
 *   HEARING_SILENCE_OFF_MS, whichever is sooner. The wait in each direction is
 *   what keeps the word from flickering between syllables and between words.
 *   The silence is counted from the learner's last voiced reading, never from
 *   the ring (F777): a quiet voice's ring rests within a reading or two of a
 *   pause, and a word that followed the ring would go and come back several
 *   times a sentence. Counted from the reading, a pause shorter than the wait
 *   keeps the word, and a real silence takes it within REST_WITHIN_MS. The long
 *   wait is for a level that sinks under the line while readings keep coming:
 *   a murmur, a noisy room. The orb's accessible name never changes with it, so
 *   a screen reader is not told twice a sentence.
 */

/** Above this level the learner is heard: a quiet voice, well over room noise. */
export const HEARING_ABOVE = 0.12;
/** The level stays above HEARING_ABOVE this long before "Hearing you" shows. */
export const HEARING_ON_AFTER_MS = 250;
/** And below it, with readings still coming (a murmur, a noisy room), this long before the word goes back. */
export const HEARING_OFF_AFTER_MS = 600;
/**
 * And with no voiced reading at all for this long, the word goes back whatever
 * the level still reads (F777). A pause between words shorter than this keeps
 * it. It is REST_WITHIN_MS less one sample, so a timer that runs one sample
 * late still takes the word away within the promise.
 */
export const HEARING_SILENCE_OFF_MS = 260;

/** The room's levels, said as facts. */
export interface RoomFacts {
  /** The learner's microphone level is measured. */
  readonly inputLive: boolean;
  /** The tutor's voice is measured. */
  readonly outputLive: boolean;
  /** The learner has been heard long enough to say so. */
  readonly hearing: boolean;
}

export const NO_ROOM_FACTS: RoomFacts = Object.freeze({ inputLive: false, outputLive: false, hearing: false });

export interface RoomFactsWatch {
  /** Every frame the meter writes. */
  frame(frame: LevelFrame): void;
  /** The room has gone: cancel the timer and say nothing is measured. */
  stop(): void;
}

const sameFacts = (a: RoomFacts, b: RoomFacts): boolean =>
  a.inputLive === b.inputLive && a.outputLive === b.outputLive && a.hearing === b.hearing;

/**
 * Turn the meter's frames into facts, and call `onChange` only when one of them
 * changes. One timer at most, for the hearing word's wait, so a level that
 * stops arriving (the meter is quiet at rest) still lets the word go back.
 */
export function createRoomFacts(onChange: (facts: RoomFacts) => void, clock: MeterClock): RoomFactsWatch {
  let facts: RoomFacts = NO_ROOM_FACTS;
  let aboveSince: number | null = null;
  let belowSince: number | null = null;
  /** The learner's last voiced reading, as the latest frame dates it. */
  let voicedAt: number | null = null;
  let timer: unknown = null;
  let timerAt: number | null = null;

  const say = (next: RoomFacts): void => {
    if (sameFacts(facts, next)) return;
    facts = next;
    onChange(next);
  };

  const quiet = (): void => {
    if (timer !== null) clock.cancel(timer);
    timer = null;
    timerAt = null;
  };

  /** When the learner will have been silent long enough to lose the word, or null with no voiced reading dated. */
  const silentAt = (): number | null => (voicedAt === null ? null : voicedAt + HEARING_SILENCE_OFF_MS);

  /** When the word should flip, or null when nothing is waiting to flip it. */
  const flipAt = (now: number): number | null => {
    const silent = silentAt();
    if (facts.hearing) {
      const sank = belowSince === null ? null : belowSince + HEARING_OFF_AFTER_MS;
      if (sank === null) return silent;
      return silent === null ? sank : Math.min(sank, silent);
    }
    if (aboveSince === null) return null;
    const on = aboveSince + HEARING_ON_AFTER_MS;
    // A voice that goes quiet before it has lasted is not heard, however high
    // its level still reads on the way down.
    if (silent !== null && Math.max(on, now) >= silent) return null;
    return on;
  };

  // The one decision: has the learner stayed on one side of the line, or been
  // silent, long enough? A frame arrives every 40 ms while the level moves, and
  // each voiced one moves the silence on, so a timer already set for the same
  // moment or sooner is left alone; when it fires it decides again.
  const decide = (now: number): void => {
    const at = flipAt(now);
    if (at === null) {
      quiet();
      return;
    }
    if (at <= now) {
      quiet();
      say({ ...facts, hearing: !facts.hearing });
      return;
    }
    if (timer !== null && timerAt !== null && timerAt <= at) return;
    quiet();
    timerAt = at;
    timer = clock.later(() => {
      timer = null;
      timerAt = null;
      decide(clock.now());
    }, at - now);
  };

  return {
    frame(frame) {
      const now = clock.now();
      if (!frame.inputLive) {
        // Nothing measured is nothing heard, at once: a track that went, a room
        // behind another screen, an app in the background.
        aboveSince = null;
        belowSince = null;
        voicedAt = null;
        quiet();
        say({ inputLive: false, outputLive: frame.outputLive, hearing: false });
        return;
      }
      voicedAt = frame.inputAt;
      // A level still above the line once the silence wait has passed is the
      // tail of a voice that stopped, so it counts as below: the next word
      // waits its own quarter second.
      const silent = silentAt();
      if (frame.input > HEARING_ABOVE && (silent === null || now < silent)) {
        belowSince = null;
        if (aboveSince === null) aboveSince = now;
      } else {
        aboveSince = null;
        if (belowSince === null) belowSince = now;
      }
      say({ inputLive: true, outputLive: frame.outputLive, hearing: facts.hearing });
      decide(now);
    },
    stop() {
      aboveSince = null;
      belowSince = null;
      voicedAt = null;
      quiet();
      say(NO_ROOM_FACTS);
    },
  };
}
