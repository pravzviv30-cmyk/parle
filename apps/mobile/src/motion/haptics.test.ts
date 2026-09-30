/**
 * Haptics stay optional on the web and become real on a device.
 *
 * Node loads the web-safe half below; Metro swaps in haptics.native.ts on a
 * phone through the platform resolver held by F382.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { arrived, pressed, soft, tapSettled } from './haptics.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('haptics are a seam', () => {
  test('a press is a light impact, a choice is a selection tick, a hint is soft, and the web half stays silent', () => {
    // STYLE section 11: a selection tick on toggles and option taps, a light
    // impact on a press, success on something earned, soft on a hint, none on
    // an error. The web half answers every one with nothing.
    assert.equal(tapSettled(), undefined);
    assert.equal(arrived(), undefined);
    assert.equal(pressed(), undefined);
    assert.equal(soft(), undefined);
    const web = read('./haptics.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(web, /expo-haptics|require\(|import /, 'the web-safe half reaches for a native module');
    const native = read('./haptics.native.ts');
    assert.match(native, /from 'expo-haptics'/, 'the native half never reaches the device haptics engine');
    assert.match(native, /selectionAsync\(\)/, 'a settled tap uses no selection response');
    assert.match(native, /NotificationFeedbackType\.Success/, 'an earned arrival uses no success response');
    assert.match(native, /ImpactFeedbackStyle\.Light/, 'a press is not a light impact');
    assert.match(native, /ImpactFeedbackStyle\.Soft/, 'a hint is not a soft impact');
    assert.equal(
      (native.match(/\.catch\(\(\) => \{\}\)/g) ?? []).length,
      4,
      'a haptic failure can escape into the learning flow: every one of the four answers must swallow its own refusal',
    );
    // The closure card is arriving somewhere earned; a finished drill is a tap that settled.
    assert.match(read('../conversationPacks/ConversationPackCard.tsx'), /arrived\(\)/, 'the closure card no longer marks the arrival');
    assert.match(read('../DrillScreen.tsx'), /tapSettled\(\)/, 'a finished drill no longer settles');
    // Every press goes through `Press`, and `Press` is what answers it: a light
    // impact for a press, a selection tick for a choice.
    const components = read('../components.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const at = components.indexOf('export function Press(');
    assert.notEqual(at, -1, 'components.tsx has no Press, so nothing answers a press');
    const next = components.indexOf('\nexport ', at + 1);
    const press = components.slice(at, next === -1 ? undefined : next);
    assert.match(press, /pressed\(\)/, 'a press gives no light impact');
    assert.match(press, /tapSettled\(\)/, 'a choice gives no selection tick');
  });
});
