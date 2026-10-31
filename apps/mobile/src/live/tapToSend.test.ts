/**
 * Tap to send (2026-10-25): the device preference, the room's switch, its Send
 * button and its line, and the owners that wire it. The shape of
 * quietVoice.test.ts; the hook's frames are in useLiveSession.test.ts.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerMessage } from '@luvani/core';

import { TAP_TO_SEND_KEY, loadTapToSendPreference, setTapToSendPreference, tapToSendOn } from './tapToSendPreference.ts';
import { TAP_TO_SEND_COPY, sendButton, tapToSendControl, tapToSendNote } from './liveRoomView.ts';
import { heldTurnAfter, tapToSendFrames, wrappingUpAfter } from './heldTurn.ts';

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

describe('the Tap to send preference', () => {
  test('defaults to off on a device that never chose', async () => {
    installDisk();
    assert.equal(tapToSendOn(), false);
    assert.equal(await loadTapToSendPreference(), false);
  });

  test("only the stored 'on' reads as on", async () => {
    const disk = installDisk();
    for (const [stored, on] of [['on', true], ['off', false], ['true', false], ['ON', false], ['', false], ['1', false]] as const) {
      disk.set(TAP_TO_SEND_KEY, stored);
      assert.equal(await loadTapToSendPreference(), on, `stored ${JSON.stringify(stored)}`);
    }
  });

  test('a set persists under the device key', async () => {
    const disk = installDisk();
    assert.equal(TAP_TO_SEND_KEY, '@luvani/tap-to-send/v1');
    assert.equal(await setTapToSendPreference(true), true);
    assert.equal(disk.get(TAP_TO_SEND_KEY), 'on');
    assert.equal(tapToSendOn(), true);
    assert.equal(await loadTapToSendPreference(), true);
    await setTapToSendPreference(false);
    assert.equal(disk.get(TAP_TO_SEND_KEY), 'off');
  });

  test('a failed write rolls back', async () => {
    installDisk();
    await setTapToSendPreference(false);
    installDisk({ refuse: true });
    assert.equal(await setTapToSendPreference(true), false);
    assert.equal(tapToSendOn(), false);
  });

  test('a load that loses the race to a set does not overwrite it', async () => {
    installDisk();
    await setTapToSendPreference(false);
    let answer!: (value: string | null) => void;
    const disk = installDisk({ get: () => new Promise((resolve) => { answer = resolve; }) });
    const loading = loadTapToSendPreference();
    await setTapToSendPreference(true);
    answer('off');
    assert.equal(await loading, true);
    assert.equal(tapToSendOn(), true);
    assert.equal(disk.get(TAP_TO_SEND_KEY), 'on');
    await setTapToSendPreference(false);
  });
});

describe('what the room knows from the wire', () => {
  const held = (state: 'open' | 'closing' | 'sent'): ServerMessage => ({ t: 'held-turn', state });

  test('a held turn follows the agent, and sent stays until the tutor takes the floor', () => {
    assert.equal(heldTurnAfter(null, held('open')), 'open');
    assert.equal(heldTurnAfter('open', held('closing')), 'closing');
    assert.equal(heldTurnAfter('closing', held('sent')), 'sent');
    assert.equal(heldTurnAfter('sent', { t: 'transcript', text: 'un café', final: true }), 'sent');
    assert.equal(heldTurnAfter('sent', { t: 'speaking', speaking: false }), 'sent');
    assert.equal(heldTurnAfter('sent', { t: 'speaking', speaking: true }), null);
    assert.equal(heldTurnAfter(null, { t: 'wrap-up' }), null);
  });

  test('wrap-up holds for the rest of the session once it arrives', () => {
    assert.equal(wrappingUpAfter(false, { t: 'speaking', speaking: true }), false);
    assert.equal(wrappingUpAfter(false, { t: 'wrap-up' }), true);
    assert.equal(wrappingUpAfter(true, { t: 'speaking', speaking: false }), true);
  });

  test('connect tells only on; a reconnect and the way back to voice tell the state either way', () => {
    assert.deepEqual(tapToSendFrames(true, 'connect'), [{ t: 'tap-to-send', on: true }]);
    assert.deepEqual(tapToSendFrames(false, 'connect'), []);
    for (const moment of ['reconnect', 'voice'] as const) {
      assert.deepEqual(tapToSendFrames(true, moment), [{ t: 'tap-to-send', on: true }]);
      assert.deepEqual(tapToSendFrames(false, moment), [{ t: 'tap-to-send', on: false }], `${moment} leaves an off lost in an outage unsaid`);
    }
  });
});

describe('the room view', () => {
  test('the switch shows only while the learner is speaking', () => {
    assert.equal(tapToSendControl(true, false), null);
    assert.equal(tapToSendControl(true, true), null);
    assert.deepEqual(tapToSendControl(false, true), { label: 'Tap to send', hint: TAP_TO_SEND_COPY.hint, checked: true });
    assert.deepEqual(tapToSendControl(false, false), { label: 'Tap to send', hint: TAP_TO_SEND_COPY.hint, checked: false });
  });

  test('Send is held back while the tutor speaks and once the turn has gone', () => {
    assert.deepEqual(sendButton('open', false), { label: 'Send', accessibilityLabel: 'Send what you said', disabled: false });
    assert.equal(sendButton(null, false).disabled, false);
    assert.equal(sendButton('closing', false).disabled, false);
    assert.equal(sendButton('open', true).disabled, true);
    assert.equal(sendButton(null, true).disabled, true);
    assert.equal(sendButton('sent', false).disabled, true);
  });

  test('the line says how the turn ends, never a count, and never hurries', () => {
    assert.equal(tapToSendNote(null), "Speak, then tap Send when you're done.");
    assert.equal(tapToSendNote('sent'), "Speak, then tap Send when you're done.");
    assert.equal(tapToSendNote('open'), "Tap Send when you're done.");
    assert.equal(tapToSendNote('closing'), "Sending what you've said in a moment.");
    const all = [null, 'open', 'closing', 'sent'].map((state) => tapToSendNote(state as never)).join(' ') + Object.values(TAP_TO_SEND_COPY).join(' ');
    assert.doesNotMatch(all, /\d|\u2014|take your time|hurry|sorry|seconds/i);
  });
});

describe('the wiring', () => {
  test('the room draws the switch and Send from the view, and Send is the session\'s own', () => {
    const room = stripComments(read('./C2LiveRoom.tsx'));
    assert.match(room, /const tap = onTapToSend \? tapToSendControl\(typing, tapToSend\) : null;/);
    assert.match(room, /sendButton\(heldTurn, tutorSpeaking\)/);
    // UI-014: the switch is a room menu row, built by roomMenuRows from tapToSendControl.
    assert.match(room, /tapToSend: onTapToSend \? tapToSend : undefined/);
    assert.match(room, /row\.kind === 'tapToSend' && tap && onTapToSend\) onTapToSend\(!tap\.checked\)/);
    assert.match(stripComments(read('./DockParts.tsx')), /accessibilityRole="switch" accessibilityLabel=\{row\.label\} accessibilityHint=\{row\.hint\}/);
    assert.match(room, /accessibilityLabel=\{sendTurn\.accessibilityLabel\}[^>]*disabled=\{sendTurn\.disabled\} onPress=\{onSendTurn\}/);
  });

  test('every owner with a microphone and a tap-to-send agent wires the preference, the session and the room', () => {
    for (const [path, rooms] of [['../ConvoScreen.tsx', 2], ['../LiveSessionScreen.tsx', 1]] as const) {
      const code = stripComments(read(path));
      assert.match(code, /const \{ tapToSend, onTapToSend \} = useTapToSend\(\);/, `${path} never reads Tap to send`);
      assert.ok(code.indexOf('useTapToSend()') < code.indexOf('useLiveSession('), `${path} reads the preference after the session that tells the agent`);
      assert.match(code, /useLiveSession\([\s\S]*?\n\s+tapToSend,\n\s+\}\);/, `${path} never hands the preference to the session`);
      assert.equal(code.match(/tapToSend=\{tapToSend\} onTapToSend=\{onTapToSend\} heldTurn=\{live\.heldTurn\} onSendTurn=\{live\.sendTurn\} wrappingUp=\{live\.wrappingUp\}/g)?.length, rooms, `${path} leaves a room without Tap to send`);
    }
    // The first practice is a guest's first minutes: it echoes the wrap-up but offers no new mode.
    const first = stripComments(read('../onboarding/FirstLivePractice.tsx'));
    assert.match(first, /wrappingUp=\{live\.wrappingUp\}/);
  });

  test('Settings writes the same store the room does, and reads it on focus', () => {
    const settings = stripComments(read('../settings/SettingsScreen.tsx'));
    assert.match(settings, /void loadTapToSendPreference\(\)\.then\(value => \{ if \(!cancelled\) setTapToSend\(value\); \}\);/);
    assert.match(settings, /<SwitchRow title=\{TAP_TO_SEND_COPY\.label\} sub=\{TAP_TO_SEND_COPY\.settingsSub\}/);
    assert.match(settings, /setTapToSendPreference\(value\)/);
    assert.equal(TAP_TO_SEND_COPY.settingsSub, 'Take all the time you need. Your turn ends when you tap Send, not when you pause.');
  });
});
