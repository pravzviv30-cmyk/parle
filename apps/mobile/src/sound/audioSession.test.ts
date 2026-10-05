/**
 * Who may change the audio session, and how (docs/come-alive/motion-sound.md section 6.4).
 *
 * F723: a partial `setAudioModeAsync` selected iOS `.ambient`, and four voice players and the
 * device voice set no mode at all, so a voice line could follow the silent switch. One module now
 * owns every mode change, every mode is full, and every voice player enters voice playback first.
 * F724: most recorders and the live room did not silence haptics; every recorder now holds the
 * microphone focus and the live room holds its own.
 *
 * The static rules read the source, because the screens reach expo-audio, which does not load
 * under node (docs/TESTING.md). The rules of the session itself run here against a fake
 * `setMode`, through sound/audioSessionCore.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUDIO_MODES, RECORD_MODE, SFX_MODE, VOICE_MODE, type FullAudioMode } from './audioModes.ts';
import { createAudioSession, VOICE_BRIDGE_MS } from './audioSessionCore.ts';
import { holdLive, holdMic, holdVoice } from './audioFocus.ts';
import { hapticsEnabled, silenceRecordingHaptics } from '../motion/hapticPreference.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const APP = fileURLToPath(new URL('../../App.tsx', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Comments may say anything; only code counts. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const FILES = [...sourceFiles(SRC), APP].map((path) => ({
  path,
  name: relative(SRC, path),
  code: stripComments(readFileSync(path, 'utf8')),
}));
const named = (name: string) => {
  const file = FILES.find((candidate) => candidate.name === name);
  assert.ok(file, `${name} is missing`);
  return file;
};
const importsFromExpoAudio = (code: string) => /from 'expo-audio'/.test(code);

describe('one module owns the audio session', () => {
  test('only the audio session module sets an audio mode', () => {
    const setters = FILES.filter(({ code }) => /\bsetAudioModeAsync\b/.test(code)).map(({ name }) => name);
    assert.deepEqual(setters, ['sound/audioSession.ts'], `these set an audio mode themselves: ${setters.join(', ')}`);
    const session = named('sound/audioSession.ts').code;
    assert.match(session, /^import \{ setAudioModeAsync \} from 'expo-audio';$/m);
    // It passes on the full mode the rules chose, never an object of its own.
    assert.match(session, /createAudioSession\(\{ setMode: \(mode\) => setAudioModeAsync\(mode\) \}\)/);
    assert.doesNotMatch(session, /setAudioModeAsync\(\{/, 'the session module spells a partial mode of its own');
    // Nothing reaches the native module's own setter either.
    for (const { name, code } of FILES) {
      assert.doesNotMatch(code, /AudioModule\.setAudioModeAsync|setIsAudioActiveAsync/, `${name} changes the session behind the module's back`);
    }

    // Every mode is full: a missing field takes expo-audio's default, and on iOS the default
    // playsInSilentMode is false, which is the `.ambient` trap this entry is about.
    const fields = ['allowsRecording', 'interruptionMode', 'playsInSilentMode', 'shouldPlayInBackground', 'shouldRouteThroughEarpiece'];
    for (const [name, mode] of Object.entries(AUDIO_MODES)) {
      assert.deepEqual(Object.keys(mode).sort(), fields, `${name} is a partial mode`);
      assert.equal(mode.interruptionMode, 'mixWithOthers', `${name} interrupts the learner's music`);
      assert.equal(mode.shouldPlayInBackground, false);
      assert.equal(mode.shouldRouteThroughEarpiece, false);
    }
    assert.deepEqual(
      [VOICE_MODE.playsInSilentMode, RECORD_MODE.playsInSilentMode, SFX_MODE.playsInSilentMode],
      [true, true, false],
      'voice and recording must be heard in silent mode; only a sound effect follows the switch',
    );
    assert.deepEqual([VOICE_MODE.allowsRecording, RECORD_MODE.allowsRecording, SFX_MODE.allowsRecording], [false, true, false]);
  });

  test('every voice player enters voice playback before it plays', () => {
    // A voice player is anything outside the sound-effect seam that plays an expo-audio player
    // or speaks through the device voice.
    const players = FILES.filter(({ name, code }) =>
      !name.startsWith('sound/') && ((importsFromExpoAudio(code) && /\.play\(\)/.test(code)) || /\bSpeech\.speak\(/.test(code)));
    const names = players.map(({ name }) => name).sort();
    for (const expected of [
      'daily/DailyCard.tsx',
      'daily/DailyPracticeScreen.tsx',
      'missions/ListeningPreview.tsx',
      'onboarding/OnboardingFlow.tsx',
      'onboarding/PreAccountOnboarding.tsx',
      'practice/recordedPlayer.ts',
      'recap/PrivatePractice.tsx',
      'speech/tutorVoice.ts',
      'tabs/ProfileTab.tsx',
      'tabs/TutorTab.tsx',
    ]) {
      assert.ok(names.includes(expected), `${expected} no longer counts as a voice player, so this rule reads nothing there`);
    }
    for (const { name, code } of players) {
      assert.match(code, /import \{[^}]*\benterVoicePlayback\b[^}]*\} from '\.\.\/sound\/audioSession\.ts'/, `${name} plays a voice without the audio session`);
      // Before every play, in the text: the mode is set, then the line plays.
      const body = code.replace(/^import [^;]*;$/gm, '');
      const first = body.search(/\benterVoicePlayback\b/);
      const play = body.search(/\.play\(\)|\bSpeech\.speak\(/);
      assert.ok(first !== -1 && first < play, `${name} plays before it enters voice playback`);
      // And it holds the voice focus while the line plays, so no sound effect takes the session.
      assert.ok(/\buseVoiceHold\(/.test(code) || /\bholdVoice\(\)/.test(code), `${name} plays a voice line that holds no voice focus`);
    }
    // The device voice holds until the line ends, fails or is stopped, and pauses for the mode first.
    const speech = named('speech/tutorVoice.ts').code.replace(/\s+/g, ' ');
    assert.match(speech, /await enterVoicePlayback\(\)/);
    assert.match(speech, /onDone: \(\) => \{ letGo\(\);/);
    assert.match(speech, /onError: \(\) => \{ letGo\(\);/);
    assert.match(speech, /onStopped: letGo/);
    // The recorded player's playback gate prepares through the session.
    assert.match(named('practice/recordedPlayer.ts').code, /playWhenCurrent\(gate, ticket, enterVoicePlayback,/);
  });

  test('every file that records holds the microphone focus', () => {
    const recorders = FILES.filter(({ code }) => /\.record\(\)/.test(code));
    const names = recorders.map(({ name }) => name).sort();
    assert.deepEqual(names, [
      'DrillScreen.tsx',
      'daily/DailyPracticeScreen.tsx',
      'drill/SpokenAttempt.tsx',
      'onboarding/GuestRecording.tsx',
      'recap/PrivatePractice.tsx',
      'soundcheck/SoundCheckScreen.tsx',
    ], 'a recorder was added or removed: hold it to the same rule');
    for (const { name, code } of recorders) {
      const hold = code.search(/\bholdMic\(\)|\bsilenceRecordingHaptics\(\)/);
      const enter = code.search(/\benterRecording\(\)/);
      const record = code.search(/\.record\(\)/);
      assert.ok(hold !== -1, `${name} records without holding the microphone focus`);
      assert.ok(enter !== -1, `${name} records without entering the recording mode`);
      assert.ok(hold < record && enter < record, `${name} records before it holds the microphone or enters the recording mode`);
      assert.match(code, /\bleaveRecording\(\)/, `${name} never hands the session back to voice playback`);
    }

    // The live room holds its own focus while LiveKit owns the session, and after it hands the
    // session back nothing is assumed about the mode.
    const live = named('live/globals.native.ts').code.replace(/\s+/g, ' ');
    assert.match(live, /export async function ensureAudioSession\(\): Promise<void> \{ if \(audioStarted\) return; const release = holdLive\(\);/);
    assert.match(live, /await AudioSession\.stopAudioSession\(\); \} finally \{ markUnknown\(\); releaseLive\?\.\(\); releaseLive = null; \}/);

    // And the holds are what keeps every control still (hapticPreference.ts).
    assert.equal(hapticsEnabled(), true);
    for (const hold of [holdMic, holdLive, silenceRecordingHaptics]) {
      const release = hold();
      assert.equal(hapticsEnabled(), false, 'a haptic can land while the microphone or a live room is open');
      release();
      release();
      assert.equal(hapticsEnabled(), true, 'a released hold still silences haptics, or a second release took another hold away');
    }
    // A voice line alone does not still the controls: only sound effects wait for it.
    const voice = holdVoice();
    assert.equal(hapticsEnabled(), true);
    voice();
  });
});

describe('the rules of the audio session', () => {
  type Harness = ReturnType<typeof harness>;
  function harness(options: { anyHold?: () => boolean } = {}) {
    const calls: FullAudioMode[] = [];
    const pending: (() => void)[] = [];
    const bridges: (() => void)[] = [];
    let held = false;
    let automatic = true;
    const session = createAudioSession({
      setMode: (mode) => {
        calls.push(mode);
        if (automatic) return Promise.resolve();
        return new Promise<void>((resolve) => pending.push(resolve));
      },
      anyHold: options.anyHold ?? (() => held),
      holdVoice: () => {
        held = true;
        return () => { held = false; };
      },
      later: (run, ms) => {
        assert.equal(ms, VOICE_BRIDGE_MS);
        bridges.push(run);
      },
    });
    return {
      session,
      calls,
      pending,
      bridges,
      hold: (value: boolean) => { held = value; },
      manual: () => { automatic = false; },
      settle: async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); },
    };
  }
  const named = (h: Harness) => h.calls.map((mode) => Object.entries(AUDIO_MODES).find(([, value]) => value === mode)?.[0]);

  test('mode changes are full, serialised, and skipped when the session is already there', async () => {
    const h = harness();
    h.manual();
    const voice = h.session.enterVoicePlayback();
    const record = h.session.enterRecording();
    await h.settle();
    assert.deepEqual(named(h), ['voice'], 'a second change started before the first finished');
    h.pending.shift()!();
    await voice;
    await h.settle();
    assert.deepEqual(named(h), ['voice', 'record']);
    h.pending.shift()!();
    await record;
    assert.equal(h.session.currentMode(), 'record');
    // Already recording: no second native call.
    const again = h.session.enterRecording();
    await again;
    assert.deepEqual(named(h), ['voice', 'record']);
    // Leaving recording is voice playback, which stays audible in silent mode.
    const leave = h.session.leaveRecording();
    await h.settle();
    h.pending.shift()!();
    await leave;
    assert.deepEqual(named(h), ['voice', 'record', 'voice']);
    assert.equal(h.session.currentMode(), 'voice');
  });

  test('a failed change rejects to its caller, leaves the mode unknown, and the next change still runs', async () => {
    let fail = true;
    const calls: FullAudioMode[] = [];
    const session = createAudioSession({
      setMode: async (mode) => {
        calls.push(mode);
        if (fail) throw new Error('refused');
      },
      anyHold: () => false,
      holdVoice: () => () => {},
      later: () => {},
    });
    await assert.rejects(session.enterRecording(), /refused/);
    assert.equal(session.currentMode(), 'unknown');
    fail = false;
    await session.enterRecording();
    assert.deepEqual(calls, [RECORD_MODE, RECORD_MODE], 'a failed change was taken as done and skipped');
  });

  test('voice playback pauses any sound effect before it changes the mode, and bridges until its player holds', async () => {
    const h = harness();
    const order: string[] = [];
    h.session.setSfxPause(() => order.push('pause'));
    const voice = h.session.enterVoicePlayback();
    // Paused at once, before the voice is queued, and again when its turn comes.
    assert.deepEqual(order, ['pause']);
    await voice;
    assert.deepEqual(order, ['pause', 'pause']);
    assert.deepEqual(named(h), ['voice']);
    // The bridge holds the voice focus until the player's own hold takes over.
    assert.equal(h.bridges.length, 1);
    assert.equal(await h.session.enterSfx(), false, 'a sound effect switched the session between enterVoicePlayback and play');
    h.bridges.shift()!();
    assert.equal(await h.session.enterSfx(), true);
    // A pause that throws never stops the voice.
    h.session.setSfxPause(() => { throw new Error('released player'); });
    await h.session.enterRecording();
    assert.equal(h.session.currentMode(), 'record');
  });

  test('a sound effect never takes the session from a microphone, voice line or live room', async () => {
    for (const hold of [holdMic, holdVoice, holdLive]) {
      const calls: FullAudioMode[] = [];
      // The real focus counts decide; this session's own voice bridge stays out of them.
      const session = createAudioSession({ setMode: async (mode) => { calls.push(mode); }, holdVoice: () => () => {}, later: () => {} });
      const release = hold();
      assert.equal(await session.enterSfx(), false);
      assert.deepEqual(calls, [], 'the session was switched to the sound-effect mode under a hold');
      release();
      assert.equal(await session.enterSfx(), true);
      assert.deepEqual(calls, [SFX_MODE]);
      // A hold that appears while the change is queued still wins.
      await session.enterVoicePlayback();
      const late = session.enterSfx();
      const again = hold();
      assert.equal(await late, false);
      again();
    }
  });

  test('a voice line never stops a recording or takes a live room’s session', async () => {
    // A mode without the microphone stops every recorder on iOS (AudioModule.swift), and the
    // drill's Hear it stays tappable while the learner records.
    const calls: FullAudioMode[] = [];
    const session = createAudioSession({ setMode: async (mode) => { calls.push(mode); }, holdVoice: () => () => {}, later: () => {} });
    const mic = holdMic();
    await session.enterRecording();
    await session.enterVoicePlayback();
    assert.deepEqual(calls, [RECORD_MODE], 'a voice line switched the session away from the open microphone');
    assert.equal(session.currentMode(), 'record');
    mic();
    await session.leaveRecording();
    assert.deepEqual(calls, [RECORD_MODE, VOICE_MODE]);
    // While LiveKit owns the session, a voice line leaves it alone.
    const live = holdLive();
    session.markUnknown();
    await session.enterVoicePlayback();
    assert.deepEqual(calls, [RECORD_MODE, VOICE_MODE], 'a voice line changed the live room’s session');
    live();
    await session.enterVoicePlayback();
    assert.deepEqual(calls, [RECORD_MODE, VOICE_MODE, VOICE_MODE]);
  });

  test('after a live room hands the session back, the next change sets a full mode again', async () => {
    const h = harness();
    await h.session.enterVoicePlayback();
    h.bridges.splice(0).forEach((run) => run());
    await h.session.enterVoicePlayback();
    assert.deepEqual(named(h), ['voice'], 'the second voice entry was not skipped');
    h.session.markUnknown();
    assert.equal(h.session.currentMode(), 'unknown');
    await h.session.enterVoicePlayback();
    assert.deepEqual(named(h), ['voice', 'voice']);
    // A change in flight when the room hands back cannot record a mode the room replaced.
    h.manual();
    const flight = h.session.enterRecording();
    await h.settle();
    h.session.markUnknown();
    h.pending.shift()!();
    await flight;
    assert.equal(h.session.currentMode(), 'unknown');
  });
});
