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
import { holdLive, holdMic, holdPlayerVoice, holdVoice } from './audioFocus.ts';
import { startVoiceLine } from './voiceLine.ts';
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
      'onboarding/PreAccountOnboarding.tsx',
      'practice/recordedPlayer.ts',
      'recap/PrivatePractice.tsx',
      'speech/tutorVoice.ts',
      'tabs/ProfileTab.tsx',
      'tabs/TutorTab.tsx',
      'tutor/useTutorPreview.ts',
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
    // Both onboarding routes delegate previews to the same owner, which still
    // enters the audio-session seam and holds the voice focus.
    for (const [name, page] of [['onboarding/OnboardingFlow.tsx', 'voice'], ['onboarding/PreAccountOnboarding.tsx', 'choose-tutor']] as const) {
      const code = named(name).code;
      assert.match(code, /import \{ useTutorPreview \} from '\.\.\/tutor\/useTutorPreview\.ts'/);
      assert.ok(code.includes(`page === '${page}'`), `${name} must scope its preview to the actual voice page`);
      assert.match(code, /const preview = useTutorPreview\(\{ active:/);
    }
  });

  test('a voice sample on the web starts inside the tap that asked for it', async () => {
    // Review finding: the four voice samples played a few microtasks after the tap, once entering
    // voice playback resolved, and iOS Safari may refuse a play outside the tap. The web has no
    // audio modes, so there the sample starts at once; a phone still waits for the voice mode.
    const order: string[] = [];
    let open: () => void = () => {};
    const ready = new Promise<void>((resolve) => { open = resolve; });
    startVoiceLine(ready, () => order.push('web plays'), true);
    order.push('tap ends');
    assert.deepEqual(order, ['web plays', 'tap ends'], 'the web sample waited past the tap, where Safari may refuse it');
    startVoiceLine(ready, () => order.push('phone plays'), false);
    order.push('tap ends');
    await Promise.resolve();
    assert.deepEqual(order, ['web plays', 'tap ends', 'tap ends'], 'a phone sample started before the voice mode was set');
    open();
    await ready;
    await Promise.resolve();
    assert.deepEqual(order, ['web plays', 'tap ends', 'tap ends', 'phone plays']);
    assert.doesNotMatch(named('sound/voiceLine.ts').code, /^import /m, 'the start rule reaches for something node cannot load');

    // Each sample enters voice playback first in the text and in time (the native order), and
    // hands its play to the rule with the platform it runs on.
    for (const name of ['tabs/TutorTab.tsx', 'tabs/ProfileTab.tsx', 'onboarding/PreAccountOnboarding.tsx']) {
      const code = named(name).code;
      const flat = code.replace(/\s+/g, ' ');
      assert.match(code, /^import \{ startVoiceLine \} from '\.\.\/sound\/voiceLine\.ts';$/m, `${name} plays its sample without the web rule`);
      assert.match(
        flat,
        /startVoiceLine\(enterVoicePlayback\(\)\.catch\(\(\) => undefined\), \(\) => \{ [^]*?\.play\(\);[^]*?\}, Platform\.OS === 'web'\);/,
        `${name} starts its web sample after the tap`,
      );
      assert.doesNotMatch(flat, /enterVoicePlayback\(\)\.catch\(\(\) => undefined\)\.then\(/, `${name} still waits for the mode on the web`);
    }
  });

  test('shared tutor previews use the web gesture directly and wait for native voice mode', () => {
    const preview = named('tutor/useTutorPreview.ts').code.replace(/\s+/g, ' ');
    const controller = named('tutor/tutorPreview.ts').code.replace(/\s+/g, ' ');
    assert.match(preview, /web: Platform\.OS === 'web', ready: enterVoicePlayback,/, 'preview readiness must use the same voice mode seam');
    assert.match(controller, /const ready = deps\.ready\(\); if \(deps\.web\) \{ void ready\.catch\(\(\) => \{\}\); start\(mine, voice, fresh\); \} else \{ void ready\.then\(\(\) => start\(mine, voice, fresh\), \(\) => fail\(mine\)\); \}/,
      'the shared preview must play synchronously on web and wait for the audio mode on native');
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

  test('leaving one recording never stops another or a live room', async (t) => {
    // F738: on iOS a mode without the microphone stops every recorder, so a slow cleanup on one
    // screen used to cut off the next screen's take, or LiveKit's microphone.
    const calls: FullAudioMode[] = [];
    const waiting: (() => void)[] = [];
    let slow = false;
    const session = createAudioSession({
      setMode: (mode) => {
        calls.push(mode);
        if (!slow) return Promise.resolve();
        return new Promise<void>((resolve) => waiting.push(resolve));
      },
      holdVoice: () => () => {},
      later: () => {},
    });
    const modes = () => calls.map((mode) => Object.entries(AUDIO_MODES).find(([, value]) => value === mode)?.[0]);

    // The holds are shared by the whole file: a failure here must not leave one behind.
    const held: (() => void)[] = [];
    t.after(() => { for (const release of held) release(); });
    const hold = (take: () => () => void) => {
      const release = take();
      held.push(release);
      return release;
    };

    // The first screen's take ends; the next screen starts recording before its cleanup runs.
    const first = hold(holdMic);
    await session.enterRecording();
    first();
    const second = hold(holdMic);
    await session.enterRecording();
    await session.leaveRecording();
    assert.deepEqual(modes(), ['record'], 'a late cleanup took the microphone from the recorder still running');
    assert.equal(session.currentMode(), 'record');
    second();

    // Asked when its turn comes, not when it was queued: a recorder that starts while the leave
    // waits behind a slow change still keeps its microphone.
    slow = true;
    session.markUnknown();
    const again = session.enterRecording();
    const leave = session.leaveRecording();
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    const third = hold(holdMic);
    waiting.shift()!();
    await again;
    // A leave that did ask for a mode is let through, so a regression fails here and never hangs.
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    slow = false;
    for (const resolve of waiting.splice(0)) resolve();
    await leave;
    assert.deepEqual(modes(), ['record', 'record'], 'a leave queued before a recorder started took its microphone');
    third();
    await session.leaveRecording();
    assert.deepEqual(modes(), ['record', 'record', 'voice'], 'the last recorder out never handed the session back');

    // While LiveKit owns the session, leaving a recording leaves it alone.
    const live = hold(holdLive);
    session.markUnknown();
    await session.leaveRecording();
    assert.deepEqual(modes(), ['record', 'record', 'voice'], 'leaving a recording changed the live room’s session');
    live();
    await session.leaveRecording();
    assert.deepEqual(modes(), ['record', 'record', 'voice', 'voice']);
  });

  test('a sound effect asked for before a slow voice line starts is refused until its player holds', async (t) => {
    // Review finding: a 1.5 s bridge could run out before a slow player reported playing, and a
    // sound effect asked for in that gap took the session to the silent-switch mode just before
    // the line. The bridge now lasts until the player's own hold takes over, the device voice's
    // line ends, or a play that never starts is given up after VOICE_BRIDGE_MS.
    const timers: { at: number; run: () => void }[] = [];
    let clock = 0;
    const advance = (ms: number) => {
      clock += ms;
      for (const timer of timers.splice(0)) {
        if (timer.at <= clock) timer.run();
        else timers.push(timer);
      }
    };
    const held: (() => void)[] = [];
    t.after(() => {
      advance(Number.POSITIVE_INFINITY);
      for (const release of held) release();
    });
    const hold = (take: () => () => void) => {
      const release = take();
      held.push(release);
      return release;
    };
    // The real voice focus decides (sound/audioFocus.ts); only the clock is a fake.
    const session = createAudioSession({ setMode: async () => {}, later: (run, ms) => { timers.push({ at: clock + ms, run }); } });

    // A slow player: three seconds between entering voice playback and reporting playing.
    await session.enterVoicePlayback();
    advance(3000);
    assert.equal(await session.enterSfx(), false, 'a sound effect took the session while a voice line was still loading');
    const playing = hold(holdPlayerVoice);
    assert.equal(await session.enterSfx(), false);
    playing();
    assert.equal(await session.enterSfx(), true, 'the bridge outlived the line it was waiting for');

    // A replay on the same player: the old line's hold ends before the new one starts.
    const old = hold(holdPlayerVoice);
    await session.enterVoicePlayback();
    old();
    advance(3000);
    assert.equal(await session.enterSfx(), false, 'the gap between two clips on one player was open to a sound effect');
    hold(holdPlayerVoice)();
    assert.equal(await session.enterSfx(), true);

    // The device voice holds its line before it enters voice playback; the bridge ends with it.
    const line = hold(holdVoice);
    await session.enterVoicePlayback();
    assert.equal(await session.enterSfx(), false);
    line();
    assert.equal(await session.enterSfx(), true, 'the device voice finished and the bridge still kept sound effects waiting');

    // A clip tapped while the device voice speaks opens its own bridge, and the line that ends
    // under it does not close that one: the clip is still loading.
    const speaking = hold(holdVoice);
    await session.enterVoicePlayback();
    await session.enterVoicePlayback();
    speaking();
    assert.equal(await session.enterSfx(), false, 'the end of the device voice closed the bridge of the clip tapped after it');
    hold(holdPlayerVoice)();
    assert.equal(await session.enterSfx(), true);

    // A play that never starts (a stale ticket, a failed load) gives the session back in time.
    await session.enterVoicePlayback();
    advance(VOICE_BRIDGE_MS - 1);
    assert.equal(await session.enterSfx(), false);
    advance(1);
    assert.equal(await session.enterSfx(), true, 'a play that never started kept sound effects quiet');

    // Two taps leave one bridge, which the line that plays takes over.
    await session.enterVoicePlayback();
    await session.enterVoicePlayback();
    hold(holdPlayerVoice)();
    assert.equal(await session.enterSfx(), true, 'a second tap left a bridge behind');

    // And the player's hold is the one that takes over.
    const hook = FILES.find((file) => file.name === 'sound/useVoiceHold.ts');
    assert.match(hook?.code ?? '', /return holdPlayerVoice\(\);/, 'a player that starts playing does not take over from the bridge');
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
