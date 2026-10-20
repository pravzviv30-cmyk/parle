import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mainApp, paper } from '../palette.ts';
import { DISPLAY_OPTIONS, displayPreferenceLabel } from './displayModel.ts';
import { DARK_MODE_ENABLED, mainMode } from '../main/appearanceModel.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * r! + .7152 * g! + .0722 * b!;
}
function contrast(a: string, b: string): number {
  const first = luminance(a); const second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

test('Settings and the avatar share one appearance editor and show the stored choice', () => {
  assert.deepEqual(DISPLAY_OPTIONS.map(option => option.value), ['system', 'light', 'dark']);
  assert.equal(displayPreferenceLabel('system'), 'Follow device');
  assert.equal(displayPreferenceLabel('light'), 'Light');
  assert.equal(displayPreferenceLabel('dark'), 'Dark');
  const editor = read('./DisplayPreferences.tsx');
  assert.match(editor, /useMainAppearance\(\)/);
  assert.match(editor, /onPress=\{\(\) => setPreference\(option\.value\)\}/);
  assert.match(editor, /accessibilityRole="radio"[\s\S]*checked: preference === option\.value/);
  assert.match(editor, /accessibilityRole="alert"/);
  assert.doesNotMatch(editor, /AsyncStorage|setItem|useState/);
  assert.match(read('./SettingsScreen.tsx'), /value=\{displayPreferenceLabel\(preference\)\}/);
  assert.match(read('./SettingsScreen.tsx'), /<DisplayPreferences \/>/);
});

// 2026-10-20, UI-008: dark mode is on. Screens not yet rebuilt stay light
// through PinLight and DARK_READY (nav/darkReady.ts), so the Appearance row and
// its sheet draw, still behind the one seam.
test('dark mode is on: Settings draws the Appearance row and display sheet only through the DARK_MODE_ENABLED seam', () => {
  assert.equal(DARK_MODE_ENABLED, true, 'dark mode was switched off again; UI-008 turned it on');
  const settings = read('./SettingsScreen.tsx');
  assert.match(settings, /\{DARK_MODE_ENABLED && <SettingsRow first label=\{DISPLAY_ROW\}/, 'the Appearance row must only draw when dark mode is on');
  assert.match(settings, /\{DARK_MODE_ENABLED && <BottomSheet visible=\{sheet === 'display'\}/, 'the display sheet must only draw when dark mode is on');
  assert.equal((settings.match(/label=\{DISPLAY_ROW\}/g) ?? []).length, 1, 'a second, unguarded Appearance row');
  assert.equal((settings.match(/<DisplayPreferences \/>/g) ?? []).length, 1, 'a second, unguarded display editor');
  assert.match(read('../main/MainAppearance.tsx'), /const mode = mainMode\(preference, system\);/, 'the provider must resolve through the pinned seam');
  assert.equal(mainMode('dark', 'dark'), 'dark');
  assert.equal(mainMode('light', 'dark'), 'light');
});

test('the profile theme scope protects unrelated paper controls and keeps text readable in both modes', () => {
  const appearance = read('./SettingsAppearance.tsx');
  assert.match(appearance, /text: paper\.ink as string/);
  assert.match(appearance, /createContext\(paperColors\)/);
  assert.match(appearance, /trouble: mode === 'dark' \? colors\.text : signal\.correspondance/);
  for (const [mode, colors] of Object.entries(mainApp)) {
    for (const background of [colors.background, colors.surface, colors.inset]) {
      for (const ink of [colors.text, colors.muted]) assert.ok(contrast(background, ink) >= 4.5, `${mode} text ${ink} on ${background} must remain readable`);
    }
  }
  assert.ok(contrast(paper.card, paper.ink) >= 4.5);
  for (const path of ['../tabs/ProfileTab.tsx', './SettingsScreen.tsx', '../profile/TutorMemoryScreen.tsx']) assert.match(read(path), /<SettingsAppearance>/);
  for (const path of ['./SettingsRow.tsx', './ChoiceRow.tsx', './SwitchRow.tsx', './TroubleLine.tsx']) assert.match(read(path), /useSettingsColors\(\)/);
  assert.match(read('../tabs/ProfileTab.tsx'), /<BottomSheet visible=\{sheet === 'name'\}[^>]*surface=\{colors\.surface\} ink=\{colors\.text\}/);
  assert.match(read('../tabs/ProfileTab.tsx'), /<BottomSheet visible=\{sheet === 'tutorVoice'\}[^>]*surface=\{colors\.surface\} ink=\{colors\.text\}/);
});
