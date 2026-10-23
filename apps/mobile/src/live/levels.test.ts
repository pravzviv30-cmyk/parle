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
  HEARING_ABOVE,
  HEARING_OFF_AFTER_MS,
  HEARING_ON_AFTER_MS,
  HEARING_SILENCE_OFF_MS,
  LEVEL_SAMPLE_MS,
  NO_ROOM_FACTS,
  RELEASE_MS,
  REST_WITHIN_MS,
  ROOM_AT_REST,
  STALE_AFTER_MS,
  atRest,
  createRoomFacts,
  type LevelFrame,
  type RoomFacts,
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
  DEFAULT_MIC_PROFILE,
  QUIET_MIC_PROFILE,
  QUIET_VOICE_FLOOR,
  REST_BELOW,
  release,
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

/**
 * A clock the test moves, and the meter's timers on it. `lateBy` makes every
 * timer fire that much after it was asked for, as on a busy JS thread.
 */
function fakeClock(lateBy = 0) {
  let now = 0;
  let pending: { at: number; run: () => void; id: number }[] = [];
  let ids = 0;
  return {
    now: () => now,
    later: (run: () => void, ms: number): unknown => {
      ids += 1;
      pending.push({ at: now + ms + lateBy, run, id: ids });
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
    // Pinned: Quiet voice adds a profile and never moves the default one.
    assert.deepEqual(DEFAULT_MIC_PROFILE, { floor: 0.01, span: 0.2 });
    assert.equal(REST_BELOW, 0.01);
    assert.equal(normaliseRms(0.11, DEFAULT_MIC_PROFILE), normaliseRms(0.11));
    assert.equal(normaliseDb(-160), 0, 'a silent recorder draws a ring');
    assert.equal(normaliseDb(-50), 0);
    assert.equal(normaliseDb(-10), 1);
    assert.ok(Math.abs(normaliseDb(-30) - 0.5 ** 0.8) < 1e-9);
    assert.equal(rmsOf([]), 0);
    assert.ok(Math.abs(rmsOf([0.5, -0.5, 0.5, -0.5]) - 0.5) < 1e-9);

    // The envelope rises with a voice and falls back gently, and lands on zero.
    assert.ok(envelope(0, 1) > 0.5, 'the attack is too slow to follow a syllable');
    assert.ok(envelope(1, 0) > 0.7, 'the release drops the ring at once');
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
      /<RoomLevels micTrack=\{live\.audioTracks\.mic\} tutorTrack=\{live\.audioTracks\.tutor\} micOpen=\{live\.micOpen\} tutorSpeaking=\{live\.tutorSpeaking\} focused=\{roomFocused\} quietVoice=\{quietVoice\}>/g,
    );
    assert.equal(wrapped?.length, 2, 'the choosing moment and the scene are not both measured from the real tracks');

    // The hook hands the tracks over as they are published, never per frame.
    assert.match(hook, /audioTracks: \{ mic: LocalAudioTrack \| null; tutor: RemoteAudioTrack \| null \}/);
    assert.match(hook, /room\.on\(RoomEvent\.LocalTrackPublished,/, 'the microphone track is never handed to the orb');
    assert.match(hook, /room\.on\(RoomEvent\.LocalTrackUnpublished,/, 'an unpublished microphone track stays with the orb');
    assert.doesNotMatch(hook, /useTrackVolume|createAudioAnalyser|requestAnimationFrame/, 'the session hook measures audio itself and renders per frame');
  });
});

/**
 * The orb branches on a few facts, not on numbers (come alive, core loop 3.3):
 * whether each level is measured, and whether the learner is being heard. They
 * change a few times a conversation, so the orb re-renders a few times a
 * conversation, never per frame.
 */
describe('the room says what it hears in words — F764, the orb half', () => {
  /**
   * A frame from the meter: the learner at `input`, the tutor measured or not.
   * These frames carry no reading time (`inputAt: null`), so only the two waits
   * decide here; the silence a real frame dates is F777's, through the meter.
   */
  const frame = (input: number, live: { inputLive?: boolean; outputLive?: boolean } = {}): LevelFrame => ({
    input,
    inputAt: null,
    bands: [0, 0, 0, 0, 0, 0, 0],
    output: 0,
    inputLive: live.inputLive ?? true,
    outputLive: live.outputLive ?? false,
  });

  test('the hearing word waits a quarter second before it shows and over half a second before it goes, and never chatters between syllables', () => {
    const clock = fakeClock();
    const said: RoomFacts[] = [];
    const watch = createRoomFacts((facts) => said.push(facts), clock);
    const loud = HEARING_ABOVE + 0.3;
    const quiet = HEARING_ABOVE - 0.05;

    // The learner starts speaking: readings every 40 ms, well over the line.
    watch.frame(frame(loud));
    assert.deepEqual(said.at(-1), { inputLive: true, outputLive: false, hearing: false }, 'the first loud frame said "Hearing you" at once');
    for (let at = LEVEL_SAMPLE_MS; at < HEARING_ON_AFTER_MS; at += LEVEL_SAMPLE_MS) {
      clock.advanceTo(at);
      watch.frame(frame(loud));
    }
    assert.equal(said.at(-1)!.hearing, false, 'the word showed before the voice had lasted a quarter second');
    clock.advanceTo(HEARING_ON_AFTER_MS);
    assert.equal(said.at(-1)!.hearing, true, 'a voice that lasted a quarter second was never said to be heard');

    // A gap between syllables, shorter than the off wait: the word holds.
    const gapFrom = HEARING_ON_AFTER_MS + LEVEL_SAMPLE_MS;
    clock.advanceTo(gapFrom);
    watch.frame(frame(quiet));
    clock.advanceTo(gapFrom + HEARING_OFF_AFTER_MS - LEVEL_SAMPLE_MS);
    watch.frame(frame(loud));
    assert.equal(said.at(-1)!.hearing, true, 'a breath between words took the word away');
    const flips = said.filter((facts, i) => i > 0 && facts.hearing !== said[i - 1]!.hearing).length;
    assert.equal(flips, 1, 'the word chattered on and off within one sentence');

    // The learner stops. The meter falls to rest and then goes quiet: no more
    // frames at all, so the watch's own timer has to take the word away.
    const stopAt = clock.now() + LEVEL_SAMPLE_MS;
    clock.advanceTo(stopAt);
    watch.frame(frame(0));
    clock.advanceTo(stopAt + HEARING_OFF_AFTER_MS - 1);
    assert.equal(said.at(-1)!.hearing, true, 'the word went before the learner had been quiet long enough');
    clock.advanceTo(stopAt + HEARING_OFF_AFTER_MS);
    assert.equal(said.at(-1)!.hearing, false, 'the word stayed after the learner fell silent, because no frame came to take it away');
    assert.equal(clock.pendingCount(), 0, 'the watch keeps a timer with nothing left to decide');
  });

  test("the room's facts change only when one flips, and a room that goes is said to measure nothing", () => {
    const clock = fakeClock();
    const said: RoomFacts[] = [];
    const watch = createRoomFacts((facts) => said.push(facts), clock);

    // Nothing measured is the starting point, and saying it again says nothing.
    watch.frame(frame(0, { inputLive: false }));
    assert.equal(said.length, 0, 'the watch announced the facts it started with');

    // The tutor's voice is measured: one change, then quiet while frames keep coming.
    watch.frame(frame(0, { inputLive: false, outputLive: true }));
    for (let i = 0; i < 20; i += 1) watch.frame(frame(0, { inputLive: false, outputLive: true }));
    assert.equal(said.length, 1, 'the orb would re-render on every frame instead of on a flip');
    assert.deepEqual(said[0], { inputLive: false, outputLive: true, hearing: false });

    // The learner is heard; then the microphone stops being measured (another
    // screen, the background): heard goes at once, with no wait.
    watch.frame(frame(0.9));
    clock.advanceTo(HEARING_ON_AFTER_MS);
    assert.equal(said.at(-1)!.hearing, true);
    watch.frame(frame(0, { inputLive: false, outputLive: true }));
    assert.deepEqual(said.at(-1), { inputLive: false, outputLive: true, hearing: false }, 'a level nobody measures was still said to be heard');

    // Leaving: everything is unmeasured and no timer is left.
    watch.frame(frame(0.9));
    watch.stop();
    assert.deepEqual(said.at(-1), NO_ROOM_FACTS);
    assert.equal(clock.pendingCount(), 0, 'the watch left a timer behind when the room went');

    // And the meter hands the watch every frame it writes, as RoomLevels wires it.
    const heard: LevelFrame[] = [];
    const meter = createRoomMeter(sink(), clock, (f) => heard.push(f));
    meter.measuring({ mic: { track: 'mic' }, tutor: null });
    meter.turn(LEARNERS_TURN);
    meter.mic(SPEECH_RMS);
    assert.ok(heard.length >= 2 && heard.at(-1)!.inputLive, 'the meter did not hand its frames on');
    meter.stop();
    assert.equal(heard.at(-1)!.inputLive, false, 'the meter did not say rest when the room went');
    for (const [name, body] of [['native', stripComments(read('./RoomLevels.native.tsx'))], ['web', stripComments(read('./RoomLevels.tsx'))]] as const) {
      assert.match(body, /createRoomMeter\(sink, CLOCK, watch\.frame\)/, `${name} RoomLevels does not hand its frames to the facts watch`);
      assert.match(body, /room: \{ \.\.\.facts, awake \}/, `${name} RoomLevels does not hand the orb its facts`);
      assert.match(body, /const awake = active && focused;/, `${name} RoomLevels keeps the orb awake in the background or behind another screen`);
      assert.match(body, /watch\.stop\(\);/, `${name} RoomLevels leaves the facts watch's timer running when it goes`);
    }
  });
});

/**
 * F777: the levels used to fall one step per timer tick, 15 % at a time, so a
 * full ring took over a second to rest after the learner stopped, and longer
 * when the JS thread ran the timer late; "Hearing you" then waited 600 ms more
 * on top. Acceptance check 7 asks for rest within 300 ms of silence.
 */
describe('the room rests on time, by the clock — F777', () => {
  /** An RMS the level reads as full: the worst case, the furthest to fall. */
  const FULL_RMS = 0.25;
  /** Room noise under the 0.01 floor, which the web analyser and a quiet phone keep sending between words. */
  const ROOM_NOISE_RMS = 0.004;
  const SILENT_BANDS = [0, 0, 0, 0, 0, 0, 0];

  test('a level rests within 300 ms of silence', () => {
    assert.equal(REST_WITHIN_MS, 300, 'acceptance check 7 asks for rest within 300 ms of silence');

    // The fall is counted by the clock: the same time falls the same distance
    // however many looks it is cut into, so a late or a frequent timer cannot
    // change when the level rests.
    assert.equal(release(1, RELEASE_MS), 0, 'a full level is still up after the whole release');
    let looked = 1;
    for (let t = 0; t < RELEASE_MS; t += 10) looked = release(looked, 10);
    assert.equal(looked, 0, 'a level looked at often falls slower than one looked at once');
    assert.ok(Math.abs(release(release(0.8, 30), 50) - release(0.8, 80)) < 1e-9, 'two looks fell a different distance from one');
    assert.equal(release(0.6, 1000, 0.3), 0.3, 'a quieter syllable pulled the level below what it said');
    assert.ok(release(1, LEVEL_SAMPLE_MS) > 0.5, 'one reading of silence emptied the ring');

    // Three ways the audio stops. A phone's hook sends nothing at all; a
    // browser (and a quiet phone) keeps sending readings with nothing in them;
    // and a busy thread runs the meter's timer at twice the interval it asked for.
    for (const ending of ['no readings', 'silent readings', 'late timers'] as const) {
      const clock = fakeClock(ending === 'late timers' ? LEVEL_SAMPLE_MS : 0);
      const said: { facts: RoomFacts; at: number }[] = [];
      const watch = createRoomFacts((facts) => said.push({ facts, at: clock.now() }), clock);
      const orb = sink();
      const meter = createRoomMeter(orb, clock, watch.frame);
      meter.measuring({ mic: { track: 'mic' }, tutor: { track: 'tutor' } });
      meter.turn(LEARNERS_TURN);

      // Half a second of a full voice from both of them, a reading every 40 ms.
      let last = 0;
      for (let at = 0; at <= 480; at += LEVEL_SAMPLE_MS) {
        clock.advanceTo(at);
        meter.mic(FULL_RMS);
        meter.tutor(TUTOR_VOICE);
        last = at;
      }
      const loud = orb.input.value;
      assert.ok(loud > 0.99, `${ending}: a full voice drew a ring of ${loud}`);
      assert.equal(said.at(-1)!.facts.hearing, true, `${ending}: half a second of voice never said "Hearing you"`);

      // Silence. Inside the hold nothing moves: that is a gap between syllables.
      for (let at = last + LEVEL_SAMPLE_MS; at <= last + REST_WITHIN_MS; at += LEVEL_SAMPLE_MS) {
        clock.advanceTo(at);
        if (ending === 'silent readings') {
          meter.mic(ROOM_NOISE_RMS);
          meter.tutor(SILENT_BANDS);
        }
        if (at < last + STALE_AFTER_MS) {
          assert.equal(orb.input.value, loud, `${ending}: the ring fell ${at - last} ms into the silence, inside the hold`);
          assert.equal(said.at(-1)!.facts.hearing, true, `${ending}: the word went inside the hold`);
        }
      }
      clock.advanceTo(last + REST_WITHIN_MS);

      // And by 300 ms everything is at rest, exactly, and the word has gone.
      assert.equal(orb.input.value, 0, `${ending}: the ring had not rested ${REST_WITHIN_MS} ms after the learner stopped`);
      assert.deepEqual(orb.bands.value, SILENT_BANDS, `${ending}: the bars had not rested ${REST_WITHIN_MS} ms after the tutor stopped`);
      assert.equal(orb.output.value, 0);
      assert.equal(orb.inputLive.value, true, `${ending}: a measured silence dropped the orb back to its pretend loop`);
      const off = said.findLast((one) => !one.facts.hearing);
      assert.ok(off !== undefined && said.at(-1)!.facts.hearing === false, `${ending}: "Hearing you" stayed up after the learner stopped`);
      assert.ok(off.at - last <= REST_WITHIN_MS, `${ending}: "Hearing you" went ${off.at - last} ms after the learner stopped`);
      if (ending !== 'silent readings') assert.equal(clock.pendingCount(), 0, `${ending}: the meter keeps a timer running at rest`);
    }
  });

  /**
   * The word must not follow the ring into rest. A quiet voice's ring rests
   * within a reading or two of a pause, so a word that went whenever the ring
   * rested would go and come back at every pause, and every flip re-renders the
   * orb. Words of 400 ms with pauses of 80 to 200 ms, through the real meter
   * and the real watch, the way RoomLevels wires them.
   */
  test('the hearing word holds through the pauses between words, through the real meter', () => {
    assert.ok(
      HEARING_SILENCE_OFF_MS + LEVEL_SAMPLE_MS <= REST_WITHIN_MS,
      'a timer one sample late would keep "Hearing you" past the 300 ms promise',
    );
    const WORD_MS = 400;
    const PAUSES = [80, 120, 160, 200];

    for (const ending of ['no readings', 'silent readings', 'late timers'] as const) {
      // A quiet voice (just over the line), an ordinary quiet one, and speech.
      for (const rms of [0.03, 0.05, SPEECH_RMS]) {
        const name = `${ending}, rms ${rms}`;
        const clock = fakeClock(ending === 'late timers' ? LEVEL_SAMPLE_MS : 0);
        const said: { facts: RoomFacts; at: number }[] = [];
        const watch = createRoomFacts((facts) => said.push({ facts, at: clock.now() }), clock);
        const meter = createRoomMeter(sink(), clock, watch.frame);
        meter.measuring({ mic: { track: 'mic' }, tutor: null });
        meter.turn(LEARNERS_TURN);
        const ons = (): number => said.filter((one, i) => one.facts.hearing && !(said[i - 1]?.facts.hearing ?? false)).length;

        /** One word: a voiced reading every 40 ms. Returns when its last reading came. */
        const word = (from: number): number => {
          let last = from;
          for (let at = from; at < from + WORD_MS; at += LEVEL_SAMPLE_MS) {
            clock.advanceTo(at);
            meter.mic(rms);
            last = at;
          }
          return last;
        };
        /** A pause: nothing at all from a phone, room noise from a browser. */
        const pause = (from: number, ms: number): void => {
          for (let at = from; at < from + ms; at += LEVEL_SAMPLE_MS) {
            clock.advanceTo(at);
            if (ending === 'silent readings') meter.mic(ROOM_NOISE_RMS);
          }
        };

        // Five words, four pauses: one sentence.
        let start = 0;
        let lastVoiced = word(start);
        assert.equal(said.at(-1)?.facts.hearing, true, `${name}: a 400 ms word was never said to be heard`);
        for (const ms of PAUSES) {
          pause(start + WORD_MS, ms);
          start += WORD_MS + ms;
          lastVoiced = word(start);
        }
        assert.equal(ons(), 1, `${name}: "Hearing you" went and came back ${ons()} times in one sentence`);
        assert.equal(said.at(-1)!.facts.hearing, true, `${name}: "Hearing you" went in a pause between words`);
        // Measured, then heard: the only two times the orb re-rendered all sentence.
        assert.equal(said.length, 2, `${name}: the orb re-rendered ${said.length} times in one sentence`);

        // The sentence ends: silence. The word goes within the promise.
        pause(start + WORD_MS, REST_WITHIN_MS);
        clock.advanceTo(lastVoiced + REST_WITHIN_MS);
        const off = said.at(-1)!;
        assert.equal(off.facts.hearing, false, `${name}: "Hearing you" stayed up after the sentence ended`);
        assert.ok(off.at - lastVoiced <= REST_WITHIN_MS, `${name}: "Hearing you" went ${off.at - lastVoiced} ms after the learner stopped`);

        // A real pause, longer than the wait, is silence: the next sentence is
        // heard again after its own quarter second, once.
        start = lastVoiced + REST_WITHIN_MS + LEVEL_SAMPLE_MS;
        lastVoiced = word(start);
        assert.equal(ons(), 2, `${name}: the next sentence was not heard, or was heard twice`);
        clock.advanceTo(lastVoiced + REST_WITHIN_MS);
        assert.equal(said.at(-1)!.facts.hearing, false);
      }
    }
  });

  test('a voice that has stopped never brings the hearing word back', () => {
    /** A frame dated by its last voiced reading, as the meter writes it. */
    const dated = (input: number, inputAt: number | null): LevelFrame => ({
      input,
      inputAt,
      bands: SILENT_BANDS,
      output: 0,
      inputLive: true,
      outputLive: false,
    });
    const onsIn = (said: RoomFacts[]): number => said.filter((facts, i) => facts.hearing && !(said[i - 1]?.hearing ?? false)).length;

    // A level that falls slower than today's release, so it is still over the
    // line after the silence wait: the tail of a voice that stopped at 400.
    const clock = fakeClock();
    const said: RoomFacts[] = [];
    const watch = createRoomFacts((facts) => said.push(facts), clock);
    for (let at = 0; at <= 400; at += LEVEL_SAMPLE_MS) {
      clock.advanceTo(at);
      watch.frame(dated(0.5, at));
    }
    assert.equal(said.at(-1)!.hearing, true);
    for (let at = 440; at <= 1400; at += LEVEL_SAMPLE_MS) {
      clock.advanceTo(at);
      watch.frame(dated(0.5, 400));
    }
    assert.equal(said.at(-1)!.hearing, false, 'a level still falling kept "Hearing you" up after the voice stopped');
    assert.equal(onsIn(said), 1, 'the tail of a stopped voice brought "Hearing you" back');

    // The next word, while that tail is still high, waits its own quarter second.
    const next = 1440;
    for (let at = next; at < next + HEARING_ON_AFTER_MS; at += LEVEL_SAMPLE_MS) {
      clock.advanceTo(at);
      watch.frame(dated(0.5, at));
    }
    assert.equal(said.at(-1)!.hearing, false, 'the next word was heard at once, on the last sentence\'s wait');
    clock.advanceTo(next + HEARING_ON_AFTER_MS);
    watch.frame(dated(0.5, next + HEARING_ON_AFTER_MS));
    assert.equal(said.at(-1)!.hearing, true);

    // A timer that fires late, after the voice has gone quiet, says nothing:
    // no frame would come after it to take the word away again.
    const late = fakeClock(LEVEL_SAMPLE_MS);
    const heard: RoomFacts[] = [];
    const lateWatch = createRoomFacts((facts) => heard.push(facts), late);
    lateWatch.frame(dated(0.5, 0));
    late.advanceTo(2000);
    assert.equal(onsIn(heard), 0, 'a late timer said "Hearing you" after the voice had stopped, and nothing would take it back');
    assert.equal(late.pendingCount(), 0, 'the watch keeps a timer with nothing left to decide');
  });
});

describe('Quiet voice: the meter for a soft voice', () => {
  test('a soft voice moves the orb clearly more, and nothing under the plugin\'s cut moves it', () => {
    assert.equal(QUIET_VOICE_FLOOR, 0.005);
    assert.deepEqual(QUIET_MIC_PROFILE, { floor: 0.005, span: 0.06 });
    const soft = 0.016; // about -36 dBFS
    assert.ok(normaliseRms(soft, QUIET_MIC_PROFILE) > normaliseRms(soft) + 0.2, 'a soft voice barely moves the quiet orb');
    assert.equal(normaliseRms(0.0045, QUIET_MIC_PROFILE), 0, 'a whisper the tutor cannot receive moves the orb');
    assert.equal(normaliseRms(0.0045), 0);
  });

  test('hearMic takes the profile, and defaults to today\'s', () => {
    const quiet = hearMic(ROOM_AT_REST, 0.016, 0, LEARNERS_TURN, QUIET_MIC_PROFILE);
    const loud = hearMic(ROOM_AT_REST, 0.016, 0, LEARNERS_TURN);
    assert.ok(quiet.mic.level > loud.mic.level);
    assert.deepEqual(hearMic(ROOM_AT_REST, 0.016, 0, LEARNERS_TURN, DEFAULT_MIC_PROFILE), loud);
  });

  test('the room meter switches profile on quiet(), and back', () => {
    const levels: number[] = [];
    const run = (on: boolean | null) => {
      const s = { input: { value: 0 }, bands: { value: [] as number[] }, output: { value: 0 }, inputLive: { value: false }, outputLive: { value: false } };
      const meter = createRoomMeter(s as never, { now: () => 0, later: () => 1, cancel: () => {} });
      if (on !== null) meter.quiet(on);
      meter.measuring({ mic: {}, tutor: null });
      meter.turn(LEARNERS_TURN);
      meter.mic(0.016);
      levels.push(s.input.value);
      meter.stop();
    };
    run(null); run(true); run(false);
    assert.ok(levels[1]! > levels[0]!);
    assert.equal(levels[2], levels[0]);
  });
});
