/**
 * A tap that lands the first time, with the keyboard up.
 *
 * A ScrollView on React Native swallows the first tap while a keyboard is
 * showing: the tap dismisses the keyboard and goes nowhere. Every screen the
 * app takes typing on sets `keyboardShouldPersistTaps` for exactly that reason,
 * and the choosing screen was the one that did not. That is the whole reason
 * the in-scene reply Send worked (a plain View) while the topic Send did
 * nothing (inside a ScrollView), which is the sort of difference nobody can see
 * by reading one screen.
 *
 * Source-walking rather than rendered, in the style of copy.test.ts: there is
 * no renderer here, and a missing prop is a thing a file can be asked about.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/**
 * Every screen where the learner can be holding a keyboard open. Named rather
 * than discovered, so adding a typing screen means adding it here and thinking
 * about the question once.
 */
const TYPING_SCREENS = [
  'ConvoScreen.tsx',
  'DrillScreen.tsx',
  // The review deck takes typing now: a due card can be answered in the box
  // rather than out loud. It has no scroll of its own, so the second test
  // below passes it over; it is on the list so that the day it grows one,
  // somebody has to answer this question about it.
  'ReviewScreen.tsx',
  'auth/SignInScreen.tsx',
  'auth/SignUpScreen.tsx',
  'friends/AddFriendsScreen.tsx',
  'onboarding/OnboardingFlow.tsx',
  // The thread sits directly above the reply box on both live surfaces.
  'tutor/Transcript.tsx',
];

/**
 * JSX opening tags only, and every one of them in this app carries props. The
 * whitespace is what keeps `useRef<ScrollView>(null)` out: that is a type
 * argument, not an element, and counting it made a correct file look wrong.
 */
const SCROLL_VIEW_TAG = /<ScrollView\s/g;

describe('taps and the keyboard — whether a press has to be made twice', () => {
  test('the choosing screen keeps taps while the keyboard is up', () => {
    const source = readFileSync(join(SRC, 'ConvoScreen.tsx'), 'utf8');
    const scrolls = source.match(SCROLL_VIEW_TAG) ?? [];
    assert.equal(scrolls.length, 1, 'the choosing screen has exactly one scroll, and this test is about that one');
    assert.ok(
      source.includes('keyboardShouldPersistTaps="handled"'),
      'a learner who typed their topic and reached for Send must not have that press eaten by the keyboard closing',
    );
  });

  test('every screen the app takes typing on answers the same way', () => {
    const offenders: string[] = [];
    for (const name of TYPING_SCREENS) {
      const source = readFileSync(join(SRC, name), 'utf8');
      const scrolls = (source.match(SCROLL_VIEW_TAG) ?? []).length;
      if (scrolls === 0) continue;
      const persists = source.split('keyboardShouldPersistTaps').length - 1;
      if (persists < scrolls) offenders.push(`${name} has ${scrolls} scrolls and ${persists} that keep taps`);
    }
    assert.deepEqual(
      offenders,
      [],
      `One screen behaving differently from the rest is how a working Send comes to look broken:\n${offenders.join('\n')}`,
    );
  });
});
