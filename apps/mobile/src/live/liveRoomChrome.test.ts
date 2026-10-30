/**
 * The live room should feel like a conversation, not a progress dashboard.
 *
 * These are source-contract tests because the mobile suite deliberately has no
 * React Native renderer. They hold the visual chrome at the same seams the
 * safe-area and connection-line tests already inspect.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TIMELINES, beatEffects, stillEffects } from '../celebrate/timelines.ts';
import { RECAP_AUDIO_WAIT_MS, momentMayStart } from '../recap/moment.ts';
import { holdLive, holdMic, liveRoom, micLive, voiceBusy } from '../sound/audioFocus.ts';
import { sfxRefusal } from '../sound/sfxGate.ts';
import { recapMayTakeTheAudio } from './recapAudio.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what runs is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}
const convo = read('../ConvoScreen.tsx');
const lesson = read('../SessionView.tsx');
const liveLesson = read('../LiveSessionScreen.tsx');
const header = read('./LiveRoomHeader.tsx');
const room = read('./C2LiveRoom.tsx');

describe('quiet live-room chrome', () => {
  test('neither live surface draws the old progress rail', () => {
    assert.doesNotMatch(convo, /\bStationLine\b/, 'the free conversation still draws the stray top rail');
    assert.doesNotMatch(lesson, /\bStationLine\b/, 'the guided lesson still draws the stray top rail');
  });

  test('both rooms use the compact end control and retain confirmation', () => {
    assert.equal(
      (convo.match(/<C2LiveRoom\b/g) ?? []).length,
      2,
      'the choosing room and the active scene do not share the same end control',
    );
    assert.match(room, /accessibilityLabel="End session"/, 'the shared end action has no spoken label');
    assert.match(liveLesson, /<C2LiveRoom\b/, 'the lesson has no shared end control');
    assert.match(convo, /onEnd=\{\(\) => setConfirming\(true\)\}/, 'the conversation icon bypasses confirmation');
    assert.match(liveLesson, /onEnd=\{\(\) => setConfirming\(true\)\}/, 'the lesson icon bypasses confirmation');
    assert.match(convo, /<ConfirmSheet\b/, 'the conversation lost its confirmation sheet');
    assert.match(liveLesson, /<ConfirmSheet\b/, 'the lesson lost its confirmation sheet');
  });

  test('the outlined circle has a 44pt target and visible, motion-free press feedback', () => {
    assert.match(header, /<RoundButton kind="close"/, 'the exit is not the shared round button');
    const parts = read('../components.tsx');
    const round = parts.slice(parts.indexOf('export function RoundButton'), parts.indexOf('export function ColourCard'));
    assert.match(round, /next \? HIT \+ space\(5\) : HIT/, 'the close disc is below the shared touch floor');
    assert.match(round, /borderRadius: disc \/ 2/, 'the exit is not round');
    assert.match(round, /<Press haptic="light"/, 'the exit loses the shared press feedback');
    // 2026-10-20, UI-008: shared parts read the theme (useB); b.light equals these paper values (palette.test.ts).
    assert.match(round, /ground === 'white' \? t\.card/, 'the resting disc is not white');
    assert.doesNotMatch(header, /\bAnimated\b|opacity:/, 'the header adds an independent animation');
    assert.match(header, /accessibilityHint="Opens a confirmation before ending the session"/, 'the icon does not explain its safe two-step exit');
  });

  test('conversation controls and status announcements survive the chrome change', () => {
    for (const seam of [
      '<C2LiveRoom',
      'onModeChange',
      'live.sendHelp()',
      'live.sendSlower()',
      'live.sendHear',
      '<SupportBlock',
    ]) {
      assert.ok(convo.includes(seam), `${seam} disappeared while the header changed`);
    }
    assert.match(room, /accessibilityLiveRegion="polite"[\s\S]{0,100}\{caption\}/, 'shared live status is no longer announced');
    // UI-014: the shared live thread is the notebook sheet.
    assert.match(room, /<NotebookSheet\b/, 'the shared live thread disappeared');
    // 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: the Type control switches the mode.
    assert.match(room, /onModeChange\(true\)/, 'the mode toggle does not reach the room owner');
  });
});

/**
 * Come alive, decision D8 and F765: the room's new moments (a goal ticking, the
 * orb rippling, the scene's card) move, and none of them is heard or felt. A
 * live room holds the learner's ears from the moment it takes the audio
 * session; the microphone holds them while it records; and the recap, the one
 * moment in a conversation meant to be heard, waits until the microphone is
 * closed and the tutor has finished speaking.
 */
describe('a live room is silent and still to the touch — F765', () => {
  /** Everything else allows a sound: approved, switched on, in the foreground, not suppressed. */
  const conditions = () => ({
    approved: true,
    soundOn: true,
    micLive: micLive(),
    voiceBusy: voiceBusy(),
    liveRoom: liveRoom(),
    appActive: true,
    suppressed: false,
  });

  test('the room plays no sound while the mic is live or the tutor speaks', () => {
    // 1. The seam refuses. A room holds the audio focus from the moment it
    //    takes the session; a recorder holds it while the microphone is open.
    assert.equal(sfxRefusal(conditions()), null, 'the test starts with something already holding the audio');
    const releaseRoom = holdLive();
    const releaseMic = holdMic();
    try {
      assert.equal(sfxRefusal(conditions()), 'microphone', 'a sound effect plays into the open microphone');
      releaseMic();
      assert.equal(sfxRefusal(conditions()), 'live-room', 'a sound effect plays in the live room while the tutor may be speaking');
      // Every beat of the recap's moment and of the stamp is silent and unfelt
      // while the room or the microphone holds the learner's ears.
      for (const id of ['recap-result', 'postcard-first', 'postcard-again'] as const) {
        for (const focus of [{ micLive: true, liveRoom: false }, { micLive: false, liveRoom: true }]) {
          for (const beat of TIMELINES[id].beats) {
            assert.deepEqual(beatEffects(beat, focus), { sound: null, haptic: null }, `${id} ${beat.element} plays into the room`);
          }
          assert.deepEqual(stillEffects(TIMELINES[id], focus), { sound: null, haptic: null }, `${id} shown still plays into the room`);
        }
      }
    } finally {
      releaseMic();
      releaseRoom();
    }
    assert.equal(sfxRefusal(conditions()), null, 'a hold outlived its release');

    // 2. The room gives the learner's ears back only after the session ends,
    //    the microphone is confirmed closed and the tutor has stopped speaking,
    //    and never after a stop (F763). The recap's moment waits for that.
    const ended = { recapArrived: true, micClosed: true, tutorSpeaking: false, stopped: false };
    assert.equal(recapMayTakeTheAudio(ended), true);
    assert.equal(recapMayTakeTheAudio({ ...ended, micClosed: false }), false, 'the recap took the audio with the microphone still open');
    assert.equal(recapMayTakeTheAudio({ ...ended, tutorSpeaking: true }), false, 'the recap took the audio while the tutor was speaking');
    assert.equal(recapMayTakeTheAudio({ ...ended, stopped: true }), false, 'a stopped session got its moment');
    assert.equal(momentMayStart({ answered: true, audioFree: false, waitedOut: false }), false, 'the recap\'s moment started with the room still holding the audio');
    assert.equal(momentMayStart({ answered: true, audioFree: true, waitedOut: false }), true);
    assert.equal(momentMayStart({ answered: true, audioFree: false, waitedOut: true }), true, 'the recap waits for ever on a room that never lets go');
    assert.ok(RECAP_AUDIO_WAIT_MS > 0 && RECAP_AUDIO_WAIT_MS <= 2600, 'the recap waits longer than a celebration may last');
    const moment = stripComments(read('../recap/useRecapMoment.ts'));
    assert.match(moment, /useSyncExternalStore\(subscribe, anyHold, anyHold\)/, 'the recap\'s moment does not watch who holds the audio');
    assert.match(moment, /onCue: first \? fireBeat : noop/, 'the recap\'s beats reach the device around the effects module, which asks the focus again');

    // 3. Nothing the room draws reaches a sound or a haptic of its own: the
    //    goal ticks, the scene's card, the orb and its layers, and the screen.
    const ROOM = ['../ConvoScreen.tsx', '../tutor/MissionWin.tsx', '../tutor/useTaskTicks.ts', '../tutor/VoiceOrb.tsx', '../tutor/Transcript.tsx',
      // UI-014, direction D: the room's new parts and their motion.
      './C2LiveRoom.tsx', './StageParts.tsx', './NotebookParts.tsx', './DockParts.tsx', '../motion/MascotMotion.tsx'];
    const layers = readdirSync(fileURLToPath(new URL('../tutor/', import.meta.url)))
      .filter((name) => /^(?:Orb|LiveBars)[^/]*\.tsx?$/.test(name))
      .map((name) => `../tutor/${name}`);
    assert.ok(layers.length >= 5, `only ${layers.length} orb layers were found, so this reads almost nothing`);
    for (const file of [...ROOM, ...layers]) {
      const body = stripComments(read(file));
      assert.doesNotMatch(body, /from '[./]*(?:sound\/sfx|motion\/haptics|celebrate\/effects)[^']*'/, `${file} reaches a sound or a haptic from inside the room`);
      assert.doesNotMatch(body, /\b(?:tapSettled|arrived|celebrate|fireBeat|fireStill)\(/, `${file} plays a sound or a haptic in the room`);
    }
  });
});
