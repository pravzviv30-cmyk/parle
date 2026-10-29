/**
 * Settings controls are small, frequent actions. Their acknowledgement must be
 * visible without fading their words and physical on devices that support it.
 * These source checks defend the shared seams because the mobile suite has no
 * component renderer (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_match, keep: string) => keep);
}

describe('profile and settings controls answer a tap', () => {
  test('action rows use a porcelain surface and haptic receipt without opacity-only feedback', () => {
    const settings = stripComments(read('./SettingsRow.tsx'));
    const tutor = stripComments(read('../profile/TutorMemoryCard.tsx'));
    assert.match(settings, /<Press\s+haptic="selection"\s+onPress=\{onPress\}/);
    // P2 (2026-10-19): the floor is the grouped list's, written once in the
    // group primitive for every row kind, and above the 44 touch floor.
    assert.match(stripComments(read('./SettingsGroup.tsx')), /ROW_GROUPED = \{[^}]*minHeight: 52 \}/);
    assert.doesNotMatch(settings, /pressed[^\n]*opacity/);
    assert.match(tutor, /tapSettled\(\);\s*onPress\(\);/);
    assert.match(tutor, /pressed[^\n]*backgroundColor: paper.groundDeep/);
  });

  test('in-place choices give tactile receipt and switches explain their consequence', () => {
    const choice = stripComments(read('./ChoiceRow.tsx'));
    const toggle = stripComments(read('./SwitchRow.tsx'));
    assert.match(choice, /<TabBar/);
    assert.match(choice, /onChange=\{onChange\}/);
    assert.doesNotMatch(choice, /tapSettled\(/, 'shared TabBar owns the single selection tick');
    // F927: the whole row is the switch, so the row's Press ticks once and toggles.
    assert.match(toggle, /<Press haptic="selection" accessibilityRole="switch"/);
    assert.match(toggle, /onPress=\{\(\) => onChange\(!value\)\}/);
    assert.match(toggle, /accessibilityHint=\{sub\}/);
    assert.match(toggle, /trackColor=\{\{ true: accent.brand, false: offTrack \}\}/);
    // UI-005: the off track is the field grey everywhere; the hairline it used
    // in grouped lists was ~1.24:1 on white, under the 3:1 non-text floor.
    assert.match(toggle, /const offTrack = paper\.field;/);
  });

  test('every full-screen profile and settings sheet exposes its title as a heading', () => {
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    const settings = stripComments(read('./SettingsScreen.tsx'));
    const shared = stripComments(read('../components.tsx'));
    assert.match(profile, /<BottomSheet visible=\{sheet === 'tutorVoice'\} title=\{TUTOR_VOICE_TITLE\}/);
    assert.match(profile, /<BottomSheet visible=\{sheet === 'name'\} title="Your name"/);
    assert.match(settings, /accessibilityRole="header"[^>]*>Delete your account\?<\/Text>/);
    assert.match(shared, /accessibilityRole="header"[^>]*>\{snapshot\.current\.title\}<\/Text>/);
  });
});
