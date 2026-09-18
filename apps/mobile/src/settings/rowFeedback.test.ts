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

    for (const [name, source] of [['a settings row', settings], ['a tutor row', tutor]] as const) {
      assert.match(source, /tapSettled\(\);\s*onPress\(\);/, `${name} gives no device-level receipt when its action lands`);
      assert.match(source, /pressed[^\n]*backgroundColor: paper\.groundDeep/, `${name} has no visible pressed surface`);
      assert.doesNotMatch(source, /pressed[^\n]*opacity/, `${name} fades its words to acknowledge a tap`);
    }
  });

  test('in-place choices give tactile receipt and switches explain their consequence', () => {
    const choice = stripComments(read('./ChoiceRow.tsx'));
    const toggle = stripComments(read('./SwitchRow.tsx'));

    assert.match(choice, /onChange=\{\(key\) => \{\s*tapSettled\(\);\s*onChange\(key\);/, 'a segmented choice changes silently');
    assert.match(toggle, /onValueChange=\{\(next\) => \{\s*tapSettled\(\);\s*onChange\(next\);/, 'a switch changes silently');
    assert.match(toggle, /accessibilityHint=\{sub\}/, 'a switch does not explain what changing it does');
  });

  test('every full-screen profile and settings sheet exposes its title as a heading', () => {
    const profile = stripComments(read('../tabs/ProfileTab.tsx'));
    const settings = stripComments(read('./SettingsScreen.tsx'));

    assert.match(profile, /accessibilityRole="header"[^>]*>\{TUTOR_VOICE_TITLE\}<\/Text>/, 'the tutor voice sheet has no heading');
    assert.match(profile, /accessibilityRole="header"[^>]*>Your name<\/Text>/, 'the name sheet has no heading');
    assert.match(settings, /accessibilityRole="header"[^>]*>Delete your account\?<\/Text>/, 'the delete sheet has no heading');
  });
});
