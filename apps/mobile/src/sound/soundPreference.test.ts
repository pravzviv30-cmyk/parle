/**
 * The "Sound effects" switch: on by default (decision D8), kept on this device, and a failed save
 * puts the switch back rather than pretending.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadSoundPreference, setSoundPreference, soundEnabled } from './soundPreference.ts';

const disk = new Map<string, string>();
AsyncStorage.getItem = async (key) => disk.get(key) ?? null;
AsyncStorage.setItem = async (key, value) => { disk.set(key, value); };

test('sound effects are on until the learner turns them off, and a failed save is undone', async () => {
  assert.equal(soundEnabled(), true);
  assert.equal(await loadSoundPreference(), true, 'a first launch starts with sound effects off');
  assert.equal(await setSoundPreference(false), true);
  assert.equal(disk.get('@luvani/interaction-sound/v1'), 'off');
  assert.equal(soundEnabled(), false);
  assert.equal(await loadSoundPreference(), false);

  AsyncStorage.setItem = async () => { throw new Error('full'); };
  assert.equal(await setSoundPreference(true), false);
  assert.equal(soundEnabled(), false, 'a save that failed still turned sound effects on');
  AsyncStorage.setItem = async (key, value) => { disk.set(key, value); };
  assert.equal(await setSoundPreference(true), true);
  assert.equal(soundEnabled(), true);

  // Settings offers it under Haptic feedback, and the app reads it at launch.
  const settings = readFileSync(new URL('../settings/SettingsScreen.tsx', import.meta.url), 'utf8');
  const haptic = settings.indexOf('title="Haptic feedback"');
  const sound = settings.indexOf('title="Sound effects"');
  assert.ok(haptic !== -1 && sound > haptic, 'the sound switch is missing or above the haptic one');
  assert.ok(settings.includes('sub="Short sounds when you finish something. They follow your phone’s silent switch and stay quiet while you speak or listen."'));
  assert.ok(settings.includes('accessibilityLabel="Sound effects"'));
  assert.match(settings, /void setSoundPreference\(value\)\.then\(saved => \{ setSoundSaving\(false\); setSoundTrouble\(saved \? '' : 'That preference could not be saved\. Try again\.'\); if \(!saved\) setSoundEffects\(previous\); \}\);/);
  assert.match(settings, /void loadSoundPreference\(\)\.then\(value => \{ if \(!cancelled\) setSoundEffects\(value\); \}\);/);
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /useEffect\(\(\) => \{ void loadSoundPreference\(\); \}, \[\]\);/);
});
