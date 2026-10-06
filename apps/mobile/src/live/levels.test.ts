/**
 * The room's audio levels — come alive, core loop 3.2 (F764, the plumbing half).
 *
 * The orb listens to the learner's real microphone and speaks with the tutor's
 * real voice, and both levels fall to rest when the audio stops. The rules are
 * `levels.ts`, run here. The two `RoomLevels` files cannot be imported by a Node
 * suite (they reach the native LiveKit module and the animation engine), so the
 * last test reads them as text and holds them to feeding these rules from the
 * real tracks.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BAND_COUNT,
  LEVEL_SAMPLE_MS,
  ROOM_AT_REST,
  STALE_AFTER_MS,
  atRest,
  bandsFromSpectrum,
  createRoomMeter,
  envelope,
  frameOf,
  hearMic,
  hearTutor,
  isStale,
  micCounts,
  normaliseDb,
  normaliseRms,
  restDue,
  rmsOf,
  settleRoom,
  type LevelSink,
  type RoomLevelState,
  type Turn,
} from './levels.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; the checks below read code. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const LEARNERS_TURN: Turn = { micOpen: true, tutorSpeaking: false };
const TUTORS_TURN: Turn = { micOpen: true, tutorSpeaking: true };
const MIC_CLOSED: Turn = { micOpen: false, tutorSpeaking: false };
const BOTH = { mic: true, tutor: true };

/** A voice at a speaking level: an RMS the native hook reports for ordinary speech. */
const SPEECH_RMS = 0.15;
const TUTOR_VOICE = [0.2, 0.5, 0.8, 0.6, 0.4, 0.3, 0.1];

/** The orb's shared values, as plain objects: the meter only ever sets `.value`. */
function sink(): LevelSink {
  return { input: { value: 0 }, bands: { value: [] }, output: { value: 0 }, inputLive: { value: false }, outputLive: { value: false } };
}

/** A clock the test moves, and the meter's timers on it. */
function fakeClock() {
  let now = 0;
  let pending: { at: number; run: () => void; id: number }[] = [];
  let ids = 0;
  return {
    now: () => now,
    later: (run: () => void, ms: number): unknown => {
      ids += 1;
      pending.push({ at: now + ms, run, id: ids });
      return ids;
    },
    cancel: (handle: unknown): void => {
      pending = pending.filter((t) => t.id !== handle);
    },
    /** Move time on to `to`, firing every timer that falls due on the way, in order. */
    advanceTo(to: number): void {
      for (;;) {
        pending.sort((a, b) => a.at - b.at);
        const next = pending[0];
        if (next === undefined || next.at > to) break;
        pending.shift();
        now = next.at;
        next.run();
      }
      now = to;
    },
    pendingCount: () => pending.length,
  };
}

/** Step the room on its own clock until it rests, the way RoomLevels does, and say how long it took. */
function settleUntilRest(state: RoomLevelState, from: number, turn: Turn): { state: RoomLevelState; at: number; steps: number } {
  let now = from;
  let steps = 0;
  let current = state;
  while (restDue(current) !== null) {
    now += LEVEL_SAMPLE_MS;
    steps += 1;
    current = settleRoom(current, now, turn);
    assert.ok(steps < 500, 'the room never came to rest');
  }
  return { state: current, at: now, steps };
}

describe('the room hears real audio — F764, the plumbing half', () => {
  test("the orb's levels come from real audio and decay to rest when the audio stops", () => {
    // Before any reading, nothing is measured: the orb keeps today's loops.
    const before = frameOf(ROOM_AT_REST, BOTH);
    assert.equal(before.inputLive, false, 'a level was claimed before the microphone gave a single reading');
    assert.equal(before.outputLive, false, 'a voice was claimed before the tutor said anything');
    assert.equal(before.input, 0);
    assert.equal(restDue(ROOM_AT_REST), null, 'a silent room keeps a timer running');

    // The learner speaks: three readings, 40 ms apart, as the native processor sends them.
    let room = ROOM_AT_REST;
    for (const at of [0, 40, 80]) room = hearMic(room, SPEECH_RMS, at, LEARNERS_TURN);
    // And the tutor's processor reports its seven bands.
    for (const at of [0, 40, 80]) room = hearTutor(room, TUTOR_VOICE, at);
    const speaking = frameOf(room, BOTH);
    assert.equal(speaking.inputLive, true, 'a real microphone reading did not make the level live');
    assert.equal(speaking.outputLive, true, 'a real voice did not make the bands live');
    assert.ok(speaking.input > 0.5, `ordinary speech drew a level of only ${speaking.input}`);
    assert.equal(speaking.bands.length, BAND_COUNT);
    assert.ok(speaking.bands.every((b) => b > 0), 'a band the tutor filled is drawn empty');
    assert.ok(speaking.bands[2]! > speaking.bands[6]!, 'the loud band and the quiet band are drawn alike');
    assert.ok(speaking.output > 0, 'the tutor is speaking and the overall level is zero');

    // The audio stops. The native hook never writes a zero, so nothing more
    // arrives: the last loud reading is all there is. Inside the stale window
    // the level holds, because 40 ms of quiet is a gap between syllables.
    const lastHeard = 80;
    const held = settleRoom(room, lastHeard + STALE_AFTER_MS - 1, LEARNERS_TURN);
    assert.equal(held, room, 'the level fell inside the stale window, so every syllable would flicker the ring');

    // Past it, the silence is believed and both levels fall.
    const falling = settleRoom(room, lastHeard + STALE_AFTER_MS, LEARNERS_TURN);
    assert.ok(falling.mic.level < room.mic.level, 'the microphone level sticks at its last reading after the audio stopped');
    assert.ok(
      falling.tutor.levels.every((l, i) => l < room.tutor.levels[i]!),
      'the bars stick at the tutor\'s last word after the voice stopped',
    );

    // And they reach rest: exactly zero, with no timer left running.
    const rested = settleUntilRest(falling, lastHeard + STALE_AFTER_MS, LEARNERS_TURN);
    assert.equal(rested.state.mic.level, 0, 'the microphone level never reached rest');
    assert.ok(rested.state.tutor.levels.every((l) => l === 0), 'the bars never reached rest');
    assert.equal(atRest(rested.state), true);
    assert.ok(rested.at - lastHeard < 2000, `rest took ${rested.at - lastHeard} ms after the audio stopped`);
    const after = frameOf(rested.state, BOTH);
    assert.equal(after.input, 0);
    assert.equal(after.output, 0);
    // Measured silence is still measured: the orb draws a still ring, not today's loop.
    assert.equal(after.inputLive, true, 'silence after speech dropped the orb back to its pretend loop');

    // The same, end to end, through the meter the RoomLevels files drive: the
    // readings land in the orb's values, and when they stop, the meter's own
    // timer (not a reading, because none come) brings the values to rest.
    const clock = fakeClock();
    const orb = sink();
    const meter = createRoomMeter(orb, clock);
    const MIC = { track: 'mic' };
    const TUTOR = { track: 'tutor' };
    meter.measuring({ mic: MIC, tutor: TUTOR });
    meter.turn(LEARNERS_TURN);
    assert.equal(orb.inputLive.value, false, 'the orb was told the microphone is measured before any reading');
    assert.equal(clock.pendingCount(), 0, 'a silent room keeps a timer running');
    for (const at of [0, 40, 80]) {
      clock.advanceTo(at);
      meter.mic(SPEECH_RMS);
      meter.tutor(TUTOR_VOICE);
    }
    assert.ok(orb.input.value > 0.5, 'the orb never received the learner\'s level');
    assert.equal(orb.inputLive.value, true);
    assert.equal(orb.outputLive.value, true);
    assert.equal(orb.bands.value.length, BAND_COUNT);
    assert.ok(orb.output.value > 0);
    const loud = orb.input.value;
    clock.advanceTo(80 + STALE_AFTER_MS - 1);
    assert.equal(orb.input.value, loud, 'the orb fell between syllables');
    clock.advanceTo(80 + 2000);
    assert.equal(orb.input.value, 0, 'the orb\'s ring is stuck at the last word: the hook never writes a zero');
    assert.deepEqual(orb.bands.value, [0, 0, 0, 0, 0, 0, 0], 'the orb\'s bars are stuck at the tutor\'s last word');
    assert.equal(orb.output.value, 0);
    assert.equal(clock.pendingCount(), 0, 'the meter keeps ticking at rest');
  });

  test('a track that goes, or is replaced, is forgotten, and leaving stops the meter', () => {
    const clock = fakeClock();
    const orb = sink();
    const meter = createRoomMeter(orb, clock);
    const first = { track: 'mic-1' };
    meter.measuring({ mic: first, tutor: null });
    meter.turn(LEARNERS_TURN);
    meter.mic(SPEECH_RMS);
    meter.tutor(TUTOR_VOICE);
    assert.equal(orb.inputLive.value, true);
    assert.equal(orb.outputLive.value, false, 'a tutor reading was drawn with no tutor track');
    assert.equal(orb.output.value, 0);

    // A new microphone track must prove itself again: it may be a processor that never starts.
    meter.measuring({ mic: { track: 'mic-2' }, tutor: null });
    assert.equal(orb.inputLive.value, false, 'a new track inherited the last one\'s proof');
    assert.equal(orb.input.value, 0);

    // No track: nothing is measured and readings are ignored.
    meter.measuring({ mic: null, tutor: null });
    meter.mic(SPEECH_RMS);
    assert.equal(orb.input.value, 0, 'a reading with no track reached the orb');

    // Leaving mid-word stops the timer and writes rest.
    meter.measuring({ mic: first, tutor: null });
    meter.mic(SPEECH_RMS);
    assert.ok(clock.pendingCount() > 0);
    meter.stop();
    assert.equal(clock.pendingCount(), 0, 'the meter kept a timer after the room went');
    assert.equal(orb.input.value, 0);
    assert.equal(orb.inputLive.value, false);

    // Closing the learner's turn lets their level fall even while readings stop.
    meter.measuring({ mic: { track: 'mic-3' }, tutor: null });
    meter.mic(SPEECH_RMS);
    const up = orb.input.value;
    meter.turn(MIC_CLOSED);
    clock.advanceTo(clock.now() + LEVEL_SAMPLE_MS);
    assert.ok(orb.input.value < up, 'the ring stayed swollen after the microphone closed');
  });

  test("the learner's level counts only on their turn", () => {
    assert.equal(micCounts(LEARNERS_TURN), true);
    assert.equal(micCounts(TUTORS_TURN), false, 'the tutor coming back through the speaker would swell the learner\'s ring');
    assert.equal(micCounts(MIC_CLOSED), false, 'a closed microphone is drawn as listening');

    // A real reading off the learner's turn proves the track is measured, and draws nothing.
    const echo = hearMic(ROOM_AT_REST, SPEECH_RMS, 0, TUTORS_TURN);
    assert.equal(echo.mic.level, 0);
    assert.equal(echo.mic.heard, true);

    // A level already up falls when the turn passes, whether or not readings keep coming.
    let room = ROOM_AT_REST;
    for (const at of [0, 40, 80]) room = hearMic(room, SPEECH_RMS, at, LEARNERS_TURN);
    const closed = settleRoom(room, 100, MIC_CLOSED);
    assert.ok(closed.mic.level < room.mic.level, 'closing the microphone left the ring swollen');
    assert.equal(settleUntilRest(closed, 100, MIC_CLOSED).state.mic.level, 0);
  });

  test('a track that never gives a reading keeps the orb on its loops', () => {
    // The zero trap from the other side: a processor that never starts (an old
    // build, a browser whose audio context never opened) reads as all zeros.
    let room = ROOM_AT_REST;
    for (const at of [0, 40, 80, 120]) {
      room = hearMic(room, 0, at, LEARNERS_TURN);
      room = hearTutor(room, [0, 0, 0, 0, 0, 0, 0], at);
    }
    const frame = frameOf(room, BOTH);
    assert.equal(frame.inputLive, false, 'all-zero readings were taken for a live microphone');
    assert.equal(frame.outputLive, false, 'all-zero readings were taken for a live voice');
    // And no track at all is never live, whatever the state says.
    const heard = hearMic(ROOM_AT_REST, SPEECH_RMS, 0, LEARNERS_TURN);
    assert.equal(frameOf(heard, { mic: false, tutor: false }).inputLive, false, 'a level was drawn with no track to measure');
  });

  test('the readings are normalised the way the spec gives them', () => {
    assert.equal(normaliseRms(0), 0);
    assert.equal(normaliseRms(0.01), 0, 'room noise draws a ring');
    assert.equal(normaliseRms(0.25), 1);
    assert.equal(normaliseRms(5), 1);
    assert.equal(normaliseRms(Number.NaN), 0);
    assert.ok(Math.abs(normaliseRms(0.11) - 0.5 ** 0.6) < 1e-9);
    assert.equal(normaliseDb(-160), 0, 'a silent recorder draws a ring');
    assert.equal(normaliseDb(-50), 0);
    assert.equal(normaliseDb(-10), 1);
    assert.ok(Math.abs(normaliseDb(-30) - 0.5 ** 0.8) < 1e-9);
    assert.equal(rmsOf([]), 0);
    assert.ok(Math.abs(rmsOf([0.5, -0.5, 0.5, -0.5]) - 0.5) < 1e-9);

    // The envelope rises with a voice and falls back gently, and lands on zero.
    assert.ok(envelope(0, 1) > 0.5, 'the attack is too slow to follow a syllable');
    assert.ok(envelope(1, 0) > 0.8, 'the release drops the ring at once');
    assert.equal(envelope(0.009, 0), 0, 'a level a hair above zero never rests');
    assert.equal(isStale(null, 0), true);
    assert.equal(isStale(0, STALE_AFTER_MS - 1), false);
    assert.equal(isStale(0, STALE_AFTER_MS), true);
  });

  test('the web spectrum splits into seven speech bands', () => {
    // 256 bins over 24 kHz: 93.75 Hz a bin. Energy only around 1 kHz lights the middle band.
    const bins = new Uint8Array(256);
    for (let i = 9; i <= 12; i += 1) bins[i] = 255;
    const bands = bandsFromSpectrum(bins, 48000);
    assert.equal(bands.length, BAND_COUNT);
    assert.ok(bands.every((b) => b >= 0 && b <= 1));
    const loudest = bands.indexOf(Math.max(...bands));
    assert.ok(loudest >= 2 && loudest <= 4, `1 kHz landed in band ${loudest}`);
    assert.equal(bands[0], 0, 'the lowest band heard energy that is not there');
    assert.deepEqual(bandsFromSpectrum(new Uint8Array(0), 48000), [0, 0, 0, 0, 0, 0, 0]);
  });

  test('the room measures the real tracks into shared values, and never per frame through React state on the screen', () => {
    const native = stripComments(read('./RoomLevels.native.tsx'));
    const web = stripComments(read('./RoomLevels.tsx'));
    const hook = stripComments(read('./useLiveSession.ts'));

    // The phone: LiveKit's own processors, on the tracks the hook exposes.
    assert.match(native, /useTrackVolume\(track\)/, 'the microphone level is not read from the microphone track');
    assert.match(native, /useMultibandTrackVolume\(track, TUTOR_BANDS\)/, 'the tutor is not measured in bands');
    assert.match(
      native,
      /const TUTOR_BANDS = \{ bands: BAND_COUNT, minFrequency: BAND_MIN_HZ, maxFrequency: BAND_MAX_HZ, updateInterval: LEVEL_SAMPLE_MS \}/,
      'the tutor is not measured in seven speech bands every 40 ms',
    );
    // The browser: an analyser on the same tracks, opened after the start tap.
    assert.match(web, /createAudioAnalyser\(track, ANALYSER\)/, 'the web does not analyse the real track');
    assert.match(web, /getFloatTimeDomainData/, 'the web microphone level is not an RMS of the real waveform');
    assert.match(web, /bandsFromSpectrum\(/, 'the web bands are not taken from the real spectrum');
    assert.match(web, /\.cleanup\(\)/, 'the web analyser is never closed');

    for (const [name, body] of [['native', native], ['web', web]] as const) {
      // Every reading goes through the meter above, into shared values.
      assert.match(body, /createRoomMeter\(/, `${name} RoomLevels does not drive the tested meter`);
      assert.match(body, /meter\.mic\(/, `${name} RoomLevels never hands the meter a microphone reading`);
      assert.match(body, /meter\.tutor\(/, `${name} RoomLevels never hands the meter the tutor's bands`);
      assert.match(body, /meter\.measuring\(\{ mic, tutor \}\)/, `${name} RoomLevels does not say which tracks it measures`);
      assert.match(body, /meter\.turn\(\{ micOpen, tutorSpeaking \}\)/, `${name} RoomLevels does not gate the learner's level to their turn`);
      assert.match(body, /meter\.stop\(\)/, `${name} RoomLevels leaves its timer running when it goes`);
      assert.match(body, /useSharedValue/, `${name} RoomLevels does not write shared values`);
      assert.match(
        body,
        /const active = useAppActive\(\);[\s\S]*const measuring = active && focused && !failed;\s*const mic = measuring \? micTrack : null;\s*const tutor = measuring && !reduced \? tutorTrack : null;/,
        `${name} RoomLevels keeps measuring with the app in the background or the room behind another screen`,
      );
      assert.match(body, /<LevelsGuard\b/, `${name} RoomLevels lets a failing processor take the room down`);
      assert.match(body, /<OrbAudioContext\.Provider value=\{audio\}>/, `${name} RoomLevels does not hand the orb its levels`);
    }

    assert.match(stripComments(read('./OrbAudio.tsx')), /AppState\.addEventListener\('change'/, 'the room never hears that the app left the foreground');

    // The conversation room is wrapped in it, in both of its rooms, with the
    // session's tracks and turn and the screen's own focus.
    const convo = stripComments(read('../ConvoScreen.tsx'));
    assert.match(convo, /const roomFocused = useIsFocused\(\);/, 'the room measures audio while another screen covers it');
    const wrapped = convo.match(
      /<RoomLevels micTrack=\{live\.audioTracks\.mic\} tutorTrack=\{live\.audioTracks\.tutor\} micOpen=\{live\.micOpen\} tutorSpeaking=\{live\.tutorSpeaking\} focused=\{roomFocused\}>/g,
    );
    assert.equal(wrapped?.length, 2, 'the choosing moment and the scene are not both measured from the real tracks');

    // The hook hands the tracks over as they are published, never per frame.
    assert.match(hook, /audioTracks: \{ mic: LocalAudioTrack \| null; tutor: RemoteAudioTrack \| null \}/);
    assert.match(hook, /room\.on\(RoomEvent\.LocalTrackPublished,/, 'the microphone track is never handed to the orb');
    assert.match(hook, /room\.on\(RoomEvent\.LocalTrackUnpublished,/, 'an unpublished microphone track stays with the orb');
    assert.doesNotMatch(hook, /useTrackVolume|createAudioAnalyser|requestAnimationFrame/, 'the session hook measures audio itself and renders per frame');
  });
});
