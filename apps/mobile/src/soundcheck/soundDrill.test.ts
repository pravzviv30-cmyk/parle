/**
 * Sounds of French opens the real minimal-pair drill (F919, founder decision
 * 20), picked for the sound the learner most needs.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DRILLS } from '@luvani/core';

import { LOCKED_ROUTES } from '../purchases/featureLocks.ts';
import type { SoundCheckEvidence } from './model.ts';
import { soundDrillFor } from './soundDrill.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8').replace(/\s+/g, ' ');
const check = (phoneme: string | null, at: number): SoundCheckEvidence =>
  ({ missionId: 'cafe', reference: 'Bonjour', at, kind: phoneme === null ? 'self-guided' : 'assessed-focus', focus: null, phoneme });

describe('Sounds of French — F919', () => {
  test('Sounds of French opens a sound drill rather than a live scene', () => {
    // The drill for the learner's newest measured sound, else the first minimal pair.
    const ʁ = soundDrillFor([check('y', 1), check('ʁ', 5), check(null, 9)]);
    assert.equal(ʁ.target, 'ʁ');
    const none = soundDrillFor([]);
    assert.equal(none.kind, 'minimal-pair');
    assert.equal(none.id, DRILLS.find((d) => d.kind === 'minimal-pair')!.id);
    assert.equal(soundDrillFor([check('not-a-sound', 1)]).id, none.id, 'an unknown symbol stranded the learner');

    // A route of its own, with an address, under the sounds lock.
    assert.equal(LOCKED_ROUTES.SoundDrill, 'sounds');
    assert.match(read('../nav/types.ts'), /SoundDrill: undefined;/);
    assert.match(read('../nav/linking.ts'), /SoundDrill: 'sound-drill',/);
    const navigator = read('../nav/RootNavigator.tsx');
    assert.match(navigator, /<Stack\.Screen name="SoundDrill" component=\{SoundDrillRoute\} \/>/);
    const route = navigator.slice(navigator.indexOf('function SoundDrillRoute('), navigator.indexOf('function SoundCheckRoute('));
    assert.match(route, /<FocusDrillPlayer drill=\{drill\}/, 'the route plays no drill');
    assert.doesNotMatch(route, /Missions|LiveSession/, 'the sound drill opens a live scene');

    // Practice's and Explore's Sounds of French reach it, not the sound check.
    const practice = read('../tabs/PracticeTab.tsx');
    assert.match(practice, /<ReadyRow title=\{sounds\.title\}[^>]*onPress=\{openSoundDrill\} \/>/);
    assert.match(practice, /const openSoundDrill = \(\) => \{ if \(!ownsReadNow\(\)\) return; recorded\.stop\(\); nav\.navigate\('SoundDrill'\); \};/);
    const explore = read('../tabs/ExploreTab.tsx');
    assert.match(explore, /\{ key: 'sound', title: 'Sound practice', \.\.\.PRACTICE_CARDS\.sound!, onPress: \(\) => nav\.navigate\('SoundDrill'\) \}/);
  });
});
