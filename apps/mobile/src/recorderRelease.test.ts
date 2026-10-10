/**
 * A take that ends after its screen has gone is still deleted, and nothing rejects.
 *
 * expo-audio's useAudioRecorder releases its native recorder from an effect
 * cleanup of its own when the screen unmounts (audioRelease.test.ts, F792).
 * After that, reading recorder.uri or calling record() throws, and stop() and
 * prepareToRecordAsync() reject. The release leaves the file alone: on iOS it
 * stops a live take, and the take stays in the app's cache, where only the app
 * can delete it.
 *
 * GuestRecording and SpokenAttempt read recorder.uri after an await. A take
 * that ended once its screen had gone threw there, which rejected a promise
 * nobody handles and skipped the delete, while the onboarding start sheet tells
 * the learner the recording is discarded from the device after processing. In
 * GuestRecording the same throw skipped lifting the microphone's haptic mute,
 * so if onboarding went away mid-take, every haptic in the app stayed off until
 * a relaunch.
 * That was F793. Both now read the path through recorderUri, falling back to the
 * path captured when the take was prepared, as SoundCheckScreen,
 * DailyPracticeScreen and PrivatePractice already did (F693).
 *
 * These tests run each screen's own code. TypeScript compiles the TSX, and a
 * stand-in for React keeps hook state in cells, runs effects in the order they
 * were declared and cleans them up in that order on unmount, as React does.
 * The recorder stands in for expo-audio's and is released by useAudioRecorder's
 * own effect, ahead of the screen's. Node's test runner fails a test on any
 * rejection nobody handled, and the stand-in disk shows what was left behind.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { finishLocalTake } from './daily/finishLocalTake.ts';
import { recorderUri } from './daily/recorderUri.ts';
import * as ownWordsCopy from './drill/ownWordsCopy.ts';

type Platform = 'ios' | 'android';
type Screen = 'drill';
type Leave = keyof typeof ENDINGS;
type Element = { props: Record<string, unknown> };
type Component = (props: Record<string, unknown>) => Element;

const RELEASED = 'Unable to find the native shared object associated with given JavaScript object';

/** How a take can end once its screen has gone. */
const ENDINGS = {
  sent: 'was sent just as its screen went',
  recording: 'was still recording when its screen went',
  preparing: 'was being prepared when its screen went',
  failing: 'failed to prepare after its screen went',
  blurred: 'lost focus while being prepared, and was still being stopped when its screen went',
} as const;

/** expo-audio 57's recorder, as far as its release changes it. */
class Recorder {
  released = false;
  recording = false;
  stopping = false;
  /** Holds the next prepare open until the test lets it finish, or fail. */
  hold: Promise<void> | null = null;
  /** Holds a stop open, as a native stop still running when the screen goes. */
  stopHold: Promise<void> | null = null;
  private path = '';
  private made = 0;
  private readonly platform: Platform;
  private readonly disk: Set<string>;
  constructor(platform: Platform, disk: Set<string>) {
    this.platform = platform;
    this.disk = disk;
    // iOS names the file when the recorder is made (AudioUtils.createRecordingUrl).
    // Android names a fresh one on every prepare (createRecordingFilePath).
    if (platform === 'ios') this.path = this.name();
  }
  get uri(): string {
    this.alive();
    return this.path;
  }
  async prepareToRecordAsync(): Promise<void> {
    this.alive();
    if (this.platform === 'android') this.path = this.name();
    this.disk.add(this.path);
    await this.hold;
  }
  record(): void {
    this.alive();
    this.recording = true;
  }
  async stop(): Promise<void> {
    this.alive();
    this.recording = false;
    this.stopping = true;
    try {
      await this.stopHold;
    } finally {
      this.stopping = false;
    }
  }
  /** useAudioRecorder's cleanup: a live take stops, and its file stays where it is. */
  release(): void {
    this.released = true;
    this.recording = false;
  }
  private name(): string {
    return `file:///cache/recording-${++this.made}.m4a`;
  }
  private alive(): void {
    if (this.released) throw new Error(RELEASED);
  }
}

const compiled = new Map<string, string>();

/** One screen, mounted on stand-ins for React, React Native and expo-audio. */
function mount(path: string, exported: string, platform: Platform) {
  const disk = new Set<string>();
  const cells: any[] = [];
  const due: (() => void)[] = [];
  let cursor = 0;
  let mounted = true;
  let focused = true;
  let mutes = 0;
  let recorder: Recorder | undefined;
  const same = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const useRef = (value: unknown) => (cells[cursor++] ??= { current: value });
  const useEffect = (create: () => void | (() => void), deps: unknown[]) => {
    const index = cursor++;
    const previous = cells[index];
    if (previous && same(previous.deps, deps)) return;
    due.push(() => {
      previous?.cleanup?.();
      cells[index] = { deps, cleanup: create() };
    });
  };
  const element = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    react: {
      useRef,
      useEffect,
      useState: (value: unknown) => {
        const cell = (cells[cursor++] ??= { value });
        return [cell.value, (next: unknown) => { cell.value = next; }];
      },
      useCallback: (fn: unknown, deps: unknown[]) => {
        const index = cursor++;
        if (!same(cells[index]?.deps, deps)) cells[index] = { fn, deps };
        return cells[index].fn;
      },
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Text: 'Text', View: 'View' },
    '@react-navigation/native': { useIsFocused: () => focused },
    'expo-audio': {
      AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) },
      RecordingPresets: { HIGH_QUALITY: {} },
      useAudioRecorderState: () => ({ metering: -160, durationMillis: 0 }),
      setAudioModeAsync: async () => {},
      // As expo's own hook does: one recorder, released by an effect declared here,
      // and so cleaned up before any effect the screen declares after it.
      useAudioRecorder: () => {
        const made = useRef(null);
        made.current ??= recorder = new Recorder(platform, disk);
        const own: Recorder = made.current;
        useEffect(() => () => own.release(), []);
        return own;
      },
    },
    '../components.tsx': { IconAction: 'IconAction', GhostButton: 'GhostButton', MicGlyph: 'MicGlyph', Press: 'Press', SpeakCircle: 'SpeakCircle' },
    '../theme.ts': { colour: {}, paper: {}, type: {}, space: (n: number) => n * 4 },
    // A live microphone silences every haptic in the app until its mute is lifted.
    '../motion/hapticPreference.ts': {
      silenceRecordingHaptics: () => {
        mutes++;
        let lifted = false;
        return () => {
          if (!lifted) mutes--;
          lifted = true;
        };
      },
    },
    '../speech/discardRecording.ts': { discardRecording: (uri: string | null) => { if (uri) disk.delete(uri); } },
    '../storage/scope.ts': { scopeGeneration: () => 0 },
    '../daily/finishLocalTake.ts': { finishLocalTake },
    '../daily/recorderUri.ts': { recorderUri },
    './ownWordsCopy.ts': ownWordsCopy,
    '../sound/audioSession.ts': { enterRecording: async () => {}, leaveRecording: async () => {} },
    '../sound/audioFocus.ts': { holdMic: () => { mutes++; let released = false; return () => { if (!released) mutes--; released = true; }; } },
    '../motion/LevelRing.tsx': { LevelRing: 'LevelRing' },
    '../speech/useRecorderLevel.ts': { useRecorderLevel: () => ({ metered: false, level: 0 }) },
    './firstRun/copy.ts': { FIRST_RUN_COPY: {}, TAKE_CAP_SECONDS: 20 },
    './firstRun/micLevel.ts': { meterLevel: () => 0 },
    './firstRun/MicMeter.tsx': { MicMeter: 'MicMeter' },
  };
  if (!compiled.has(path)) {
    const url = new URL(path, import.meta.url);
    compiled.set(path, ts.transpileModule(readFileSync(url, 'utf8'), {
      fileName: url.pathname,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText);
  }
  const module = { exports: {} as Record<string, unknown> };
  const load = (specifier: string) => {
    assert.ok(specifier in modules, `${path} imports ${specifier}, which this test has no stand-in for`);
    return modules[specifier];
  };
  // The twenty-second limit is a timer that never fires here.
  const timer = { set: () => ({}), clear: () => {} };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', compiled.get(path)!)(load, module, module.exports, timer.set, timer.clear);
  const component = module.exports[exported] as Component;

  return {
    disk,
    get mutes(): number {
      return mutes;
    },
    get recorder(): Recorder {
      assert.ok(recorder, 'the screen made no recorder');
      return recorder;
    },
    /** Renders with these props, then runs the effects that are due, as a commit does. */
    render(props: Record<string, unknown>): Element {
      cursor = 0;
      const tree = component(props);
      due.splice(0).forEach((run) => run());
      return tree;
    },
    /** Another screen covers this one, which stays mounted. Takes effect on the next render. */
    blur(): void {
      focused = false;
    },
    /** React's unmount: every effect cleanup, in the order the effects were declared. */
    unmount(): void {
      if (!mounted) return;
      mounted = false;
      for (const cell of cells) if (cell && 'cleanup' in cell) cell.cleanup?.();
    },
  };
}

function press(tree: unknown, label: string): void {
  const find = (node: unknown): Element | undefined => {
    if (Array.isArray(node)) return node.map(find).find(Boolean);
    if (!node || typeof node !== 'object' || !('props' in node)) return undefined;
    const element = node as Element;
    return element.props.accessibilityLabel === label ? element : find(element.props.children);
  };
  const control = find(tree);
  assert.ok(control && typeof control.props.onPress === 'function', `no control is labelled "${label}"`);
  (control.props.onPress as () => void)();
}

/** Lets every promise the screen started run to the end. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) await new Promise((resolve) => setImmediate(resolve));
}

const SCREENS = {
  drill: { path: './drill/SpokenAttempt.tsx', exported: 'SpokenAttempt', start: 'Record your French', finish: 'Stop recording' },
} as const;

/** Records one take on a screen and ends it the way `leave` says, or on screen when it is null. */
async function take(screen: Screen, platform: Platform, leave: Leave | null) {
  const { path, exported, start, finish } = SCREENS[screen];
  const s = mount(path, exported, platform);
  const sent: (string | null)[] = [];
  const props = {
    busy: false,
    onTyping: () => {},
    onRecordingChange: () => {},
    // As PreAccountOnboarding does, a guest take moves onboarding on to its recap
    // page, which unmounts the recording screen while the take is being finished.
    onTake: async (uri: string | null) => {
      sent.push(uri);
      if (leave === 'sent') s.unmount();
    },
  };
  const tree = s.render(props);
  const held = leave === 'preparing' || leave === 'failing' || leave === 'blurred';
  let finishPrepare = () => {};
  if (held) {
    s.recorder.hold = new Promise<void>((resolve, reject) => {
      finishPrepare = () => (leave === 'failing' ? reject(new Error('The recorder could not be prepared')) : resolve());
    });
  }
  press(tree, start);
  await settle();
  const file = [...s.disk][0];
  if (held) assert.equal(s.recorder.recording, false, `the ${screen} take started recording before its prepare finished`);
  if (leave === 'blurred') {
    // Another screen covers this one mid-prepare, so the take is stopped as
    // abandoned, and the screen goes while that stop is still running.
    s.blur();
    s.render(props);
    let finishStop = () => {};
    s.recorder.stopHold = new Promise<void>((resolve) => { finishStop = resolve; });
    finishPrepare();
    await settle();
    assert.equal(s.recorder.stopping, true, `the ${screen} take was not being stopped when its screen went, on ${platform}`);
    s.unmount();
    finishStop();
  } else if (held) {
    s.unmount();
    finishPrepare();
  } else {
    assert.equal(s.recorder.recording, true, `the ${screen} take never started recording on ${platform}`);
    if (leave === 'recording') s.unmount();
    else press(s.render(props), finish);
  }
  await settle();
  return { file, sent, left: [...s.disk], recorder: s.recorder, mutes: s.mutes };
}

/** Runs one ending, and collects the rejections nobody handled while it ran. */
async function ending(screen: Screen, platform: Platform, leave: Leave) {
  const rejected: unknown[] = [];
  const listen = (reason: unknown) => { rejected.push(reason); };
  process.on('unhandledRejection', listen);
  try {
    return { ...(await take(screen, platform, leave)), rejected: rejected.map(String) };
  } finally {
    process.off('unhandledRejection', listen);
  }
}

test('a guest or drill take that ends after its screen has gone still deletes its recording and rejects nothing', async () => {
  for (const platform of ['ios', 'android'] as const) {
    for (const screen of ['drill'] as const) {
      for (const leave of Object.keys(ENDINGS) as Leave[]) {
        // The retired guest recorder is replaced by live room tracks. The remaining
        // drill recorder still owns its prepare/blur/unmount cleanup.
        if (leave === 'sent') continue;
        const run = `a ${screen} take that ${ENDINGS[leave]}, on ${platform}`;
        const { file, sent, left, rejected, recorder, mutes } = await ending(screen, platform, leave);
        assert.ok(file, `${run}: the take never reached the disk, so this proves nothing`);
        assert.equal(recorder.released, true, `${run}: the recorder was never released`);
        assert.deepEqual(sent, [], `${run}: the wrong take was handed on`);
        assert.deepEqual(rejected, [], `${run}: a promise rejected and nobody handled it`);
        assert.equal(mutes, 0, `${run}: every haptic in the app stayed silenced after the microphone had gone`);
        // Android names a take's file only during prepare, so a screen that goes before
        // prepare is over leaves an empty file only the data reset's sweep can find
        // (storage/attemptAudio.native.ts). Nothing was recorded into it.
        const unnamed = platform === 'android' && (leave === 'preparing' || leave === 'failing');
        if (!unnamed) assert.deepEqual(left, [], `${run}: the recording was left on the device`);
      }
    }
  }
});

test('a guest or drill take finished on its screen is handed on, and only the guest screen deletes it afterwards', async () => {
  for (const platform of ['ios', 'android'] as const) {
    const drill = await take('drill', platform, null);
    assert.deepEqual(drill.sent, [drill.file], `the drill take was not handed on, on ${platform}`);
    assert.deepEqual(drill.left, [drill.file], `the drill screen deleted a take its consumer owns, on ${platform}`);
  }
});
