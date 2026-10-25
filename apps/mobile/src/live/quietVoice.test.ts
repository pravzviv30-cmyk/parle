/**
 * Quiet voice (2026-10-23): the device preference, the room's switch and line,
 * and the owners that wire it. The meter's quiet profile is in levels.test.ts.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { QUIET_VOICE_KEY, loadQuietVoicePreference, quietVoiceOn, setQuietVoicePreference } from './quietVoicePreference.ts';
import { QUIET_VOICE_COPY, quietVoiceControl, quietVoiceNote, roomNote, typingNote } from './liveRoomView.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function installDisk(opts: { refuse?: boolean; get?: () => Promise<string | null> } = {}): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = opts.get ?? ((key: string) => Promise.resolve(map.get(key) ?? null));
  shared.setItem = async (key: string, value: string) => {
    if (opts.refuse) throw new Error('QuotaExceededError');
    map.set(key, value);
  };
  return map;
}

describe('the Quiet voice preference', () => {
  test('defaults to off on a device that never chose', async () => {
    installDisk();
    assert.equal(quietVoiceOn(), false);
    assert.equal(await loadQuietVoicePreference(), false);
  });

  test("only the stored 'on' reads as on", async () => {
    const disk = installDisk();
    for (const [stored, on] of [['on', true], ['off', false], ['true', false], ['ON', false], ['', false], ['1', false]] as const) {
      disk.set(QUIET_VOICE_KEY, stored);
      assert.equal(await loadQuietVoicePreference(), on, `stored ${JSON.stringify(stored)}`);
    }
  });

  test('a set persists under the device key', async () => {
    const disk = installDisk();
    assert.equal(await setQuietVoicePreference(true), true);
    assert.equal(disk.get(QUIET_VOICE_KEY), 'on');
    assert.equal(quietVoiceOn(), true);
    assert.equal(await loadQuietVoicePreference(), true);
    await setQuietVoicePreference(false);
    assert.equal(disk.get(QUIET_VOICE_KEY), 'off');
  });

  test('a failed write rolls back', async () => {
    installDisk();
    await setQuietVoicePreference(false);
    installDisk({ refuse: true });
    assert.equal(await setQuietVoicePreference(true), false);
    assert.equal(quietVoiceOn(), false);
  });

  test('a load that loses the race to a set does not overwrite it', async () => {
    installDisk();
    await setQuietVoicePreference(false);
    let answer!: (value: string | null) => void;
    const disk = installDisk({ get: () => new Promise((resolve) => { answer = resolve; }) });
    const loading = loadQuietVoicePreference();
    await setQuietVoicePreference(true);
    answer('off');
    assert.equal(await loading, true);
    assert.equal(quietVoiceOn(), true);
    assert.equal(disk.get(QUIET_VOICE_KEY), 'on');
    await setQuietVoicePreference(false);
  });
});

describe('the room view', () => {
  test('the switch shows only while the learner is speaking, labelled and checked by the value', () => {
    assert.equal(quietVoiceControl(true, false), null);
    assert.equal(quietVoiceControl(true, true), null);
    assert.deepEqual(quietVoiceControl(false, false), { label: 'Quiet voice', hint: QUIET_VOICE_COPY.hint, checked: false });
    assert.deepEqual(quietVoiceControl(false, true), { label: 'Quiet voice', hint: QUIET_VOICE_COPY.hint, checked: true });
    assert.doesNotMatch(QUIET_VOICE_COPY.label, /whisper/i);
  });

  test('the note says what carries, with no em dash, and keeps one line with the typing note winning', () => {
    const note = quietVoiceNote('Émilie');
    assert.equal(note, 'Speak softly, close to your phone. Émilie can hear a soft voice, but not a whisper.');
    assert.doesNotMatch(note + QUIET_VOICE_COPY.hint + QUIET_VOICE_COPY.label, /\u2014/);
    assert.equal(roomNote(false, true, 'Émilie', true), note);
    assert.equal(roomNote(false, true, 'Émilie', false), null);
    assert.equal(roomNote(true, true, 'Émilie', true), typingNote(true, true, 'Émilie'));
    assert.equal(roomNote(true, false, 'Émilie', true), typingNote(true, false, 'Émilie'));
  });
});

describe('the wiring', () => {
  test('the room draws a switch from the view, and turning it on opens the transcript', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /const quiet = onQuietVoice \? quietVoiceControl\(typing, quietVoice\) : null;/);
    assert.match(room, /const note = roomNote\(typing, startedWithSpeech, tutorName, quiet !== null && quiet\.checked, \{ wrappingUp, tapToSend: tap !== null && tap\.checked, heldTurn \}\);/);
    assert.match(room, /accessibilityRole="switch" accessibilityLabel=\{quiet\.label\} accessibilityHint=\{quiet\.hint\}/);
    assert.match(room, /accessibilityState=\{\{ checked: quiet\.checked \}\}/);
    assert.match(room, /onQuietVoice\(next\); if \(next\) onTranscriptVisibility\(true\);/);
    assert.doesNotMatch(room, /typingNote\(/, 'a second note rule beside roomNote');
  });

  test('a new room starts with the stored value and opens the transcript when it is on', () => {
    const hook = stripComments(read('./useQuietVoice.ts'));
    assert.match(hook, /useState\(quietVoiceOn\)/);
    assert.match(hook, /if \(quietVoiceOn\(\)\) show\.current\(true\);/);
    assert.match(hook, /loadQuietVoicePreference\(\)\.then\(\(on\) => \{[\s\S]*setQuietVoice\(on\);[\s\S]*if \(on\) show\.current\(true\);/);
    assert.match(hook, /if \(on\) show\.current\(true\);\n\s*void setQuietVoicePreference\(on\)/);
  });

  test('every owner of the live room passes the preference to the room and to its meter', () => {
    for (const [path, setter, rooms] of [
      ['../LiveSessionScreen.tsx', 'setTranscriptVisible', 1],
      ['../ConvoScreen.tsx', 'setTranscriptVisible', 2],
      ['../onboarding/FirstLivePractice.tsx', 'setTranscript', 1],
    ] as const) {
      const code = stripComments(read(path));
      assert.match(code, new RegExp(`const \\{ quietVoice, onQuietVoice \\} = useQuietVoice\\(${setter}\\);`), `${path} never reads Quiet voice`);
      assert.equal(code.match(/<C2LiveRoom /g)?.length, rooms, `${path} has a room this test does not know`);
      assert.equal(code.match(/quietVoice=\{quietVoice\} onQuietVoice=\{onQuietVoice\}/g)?.length, rooms, `${path} leaves a room without the switch`);
      assert.equal(code.match(/<RoomLevels [^>]*quietVoice=\{quietVoice\}>/g)?.length, rooms, `${path} leaves the meter on the loud floor`);
    }
  });

  test('both meters hand the preference to the tested meter', () => {
    for (const file of ['./RoomLevels.tsx', './RoomLevels.native.tsx']) {
      const code = stripComments(read(file));
      assert.match(code, /quietVoice = false, children \}: RoomLevelsProps/);
      assert.match(code, /meter\.quiet\(quietVoice\);/);
    }
  });
});
