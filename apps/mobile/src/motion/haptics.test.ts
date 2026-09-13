/**
 * The haptics seam: documented no-ops with one switch, and the two moments
 * that call them, so the day the module is installed nothing moves but a flag.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HAPTICS_ENABLED, arrived, tapSettled } from './haptics.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('haptics are a seam', () => {
  test('both calls are silent no-ops behind one switch, and the two earned moments call them', () => {
    assert.equal(HAPTICS_ENABLED, false, 'the switch is on with no native module installed');
    assert.equal(tapSettled(), undefined);
    assert.equal(arrived(), undefined);
    // Comments may name the module; the code may not reach for it.
    const code = read('./haptics.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /expo-haptics|require\(|import /, 'the seam imports something; it must load with nothing installed');
    // The closure card is arriving somewhere earned; a finished drill is a tap that settled.
    assert.match(read('../conversationPacks/ConversationPackCard.tsx'), /arrived\(\)/, 'the closure card no longer marks the arrival');
    assert.match(read('../DrillScreen.tsx'), /tapSettled\(\)/, 'a finished drill no longer settles');
  });
});
