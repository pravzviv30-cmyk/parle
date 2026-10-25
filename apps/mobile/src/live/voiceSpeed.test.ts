/**
 * Slower voice (2026-10-25): the device preference and the settings row's rule.
 * The session start body is checked in useLiveSession.test.ts.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VOICE_SPEED_KEY, loadVoiceSpeedPreference, setVoiceSpeedPreference, voiceSpeedChoice } from './voiceSpeedPreference.ts';
import { VOICE_SPEED_ROW, VOICE_SPEED_SUB, voiceSpeedDefaultOn, voiceSpeedSwitchFor, voiceSpeedSwitchValue } from '../tutor/voiceSpeed.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

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

describe('the Slower voice preference', () => {
  test('is not chosen on a device that never chose', async () => {
    installDisk();
    assert.equal(voiceSpeedChoice(), null);
    assert.equal(await loadVoiceSpeedPreference(), null);
  });

  test("only the stored 'slower' or 'normal' reads as a choice", async () => {
    const disk = installDisk();
    for (const [stored, read] of [['slower', 'slower'], ['normal', 'normal'], ['slow', null], ['on', null], ['', null], ['SLOWER', null]] as const) {
      disk.set(VOICE_SPEED_KEY, stored);
      assert.equal(await loadVoiceSpeedPreference(), read, `stored ${JSON.stringify(stored)}`);
    }
  });

  test('a set persists under the device key', async () => {
    const disk = installDisk();
    assert.equal(await setVoiceSpeedPreference('slower'), true);
    assert.equal(disk.get(VOICE_SPEED_KEY), 'slower');
    assert.equal(voiceSpeedChoice(), 'slower');
    await setVoiceSpeedPreference('normal');
    assert.equal(disk.get(VOICE_SPEED_KEY), 'normal');
    assert.equal(await loadVoiceSpeedPreference(), 'normal');
  });

  test('a failed write rolls back', async () => {
    installDisk();
    await setVoiceSpeedPreference('normal');
    installDisk({ refuse: true });
    assert.equal(await setVoiceSpeedPreference('slower'), false);
    assert.equal(voiceSpeedChoice(), 'normal');
  });

  test('a load that loses the race to a set does not overwrite it', async () => {
    let release: (value: string | null) => void = () => {};
    installDisk({ get: () => new Promise((resolve) => { release = resolve; }) });
    const loading = loadVoiceSpeedPreference();
    await setVoiceSpeedPreference('slower');
    release('normal');
    assert.equal(await loading, 'slower');
    assert.equal(voiceSpeedChoice(), 'slower');
  });

  test('a load that fails keeps the value in memory', async () => {
    installDisk();
    await setVoiceSpeedPreference('normal');
    installDisk({ get: () => Promise.reject(new Error('disk')) });
    assert.equal(await loadVoiceSpeedPreference(), 'normal');
  });
});

describe('the Slower voice row', () => {
  test('defaults on for a beginner or a learner with no estimate, off otherwise', () => {
    for (const cefr of ['A0', 'A1', undefined, null]) assert.equal(voiceSpeedDefaultOn(cefr), true, String(cefr));
    for (const cefr of ['A2', 'B1', 'B2', 'C1']) assert.equal(voiceSpeedDefaultOn(cefr), false, cefr);
  });

  test('a choice wins over the default', () => {
    assert.equal(voiceSpeedSwitchValue('slower', 'B2'), true);
    assert.equal(voiceSpeedSwitchValue('normal', 'A0'), false);
    assert.equal(voiceSpeedSwitchValue(null, 'A1'), true);
    assert.equal(voiceSpeedSwitchValue(null, 'B1'), false);
    assert.equal(voiceSpeedSwitchFor(null, { brain: { cefr: { estimate: 'B1' } } } as never), false);
    assert.equal(voiceSpeedSwitchFor(null, { brain: { cefr: { estimate: 'A1' } } } as never), true);
    assert.equal(voiceSpeedSwitchFor(null, null), true);
  });

  test('the copy is plain and carries no em dash', () => {
    assert.equal(VOICE_SPEED_ROW, 'Slower voice');
    assert.equal(VOICE_SPEED_SUB, 'The tutor speaks a little more slowly. It starts on while you are a beginner.');
    assert.ok(!/—/.test(VOICE_SPEED_ROW + VOICE_SPEED_SUB));
  });

  test('Learning preferences draws the row and stores the choice', () => {
    const screen = read('../settings/LearningPreferencesScreen.tsx');
    assert.match(screen, /title=\{VOICE_SPEED_ROW\}/);
    assert.match(screen, /accessibilityLabel=\{VOICE_SPEED_ROW\}/);
    assert.match(screen, /voiceSpeedSwitchFor\(voiceSpeed, profile\)/);
    assert.match(screen, /onVoiceSpeed\(next \? 'slower' : 'normal'\)/);
  });
});
