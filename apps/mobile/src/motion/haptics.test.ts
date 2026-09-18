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

import { arrived, tapSettled } from './haptics.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('haptics are a seam', () => {
  test('the web half is safe, the native half answers taps and arrivals, and the earned moments call them', () => {
    assert.equal(tapSettled(), undefined);
    assert.equal(arrived(), undefined);
    const web = read('./haptics.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(web, /expo-haptics|require\(|import /, 'the web-safe half reaches for a native module');
    const native = read('./haptics.native.ts');
    assert.match(native, /from 'expo-haptics'/, 'the native half never reaches the device haptics engine');
    assert.match(native, /selectionAsync\(\)/, 'a settled tap uses no selection response');
    assert.match(native, /NotificationFeedbackType\.Success/, 'an earned arrival uses no success response');
    assert.match(native, /\.catch\(\(\) => \{\}\)/, 'a haptic failure can escape into the learning flow');
    // The closure card is arriving somewhere earned; a finished drill is a tap that settled.
    assert.match(read('../conversationPacks/ConversationPackCard.tsx'), /arrived\(\)/, 'the closure card no longer marks the arrival');
    assert.match(read('../DrillScreen.tsx'), /tapSettled\(\)/, 'a finished drill no longer settles');
  });
});
