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
  // rather than out loud. Since F308 it scrolls, and it scrolls on ScrollScreen
  // rather than a bare ScrollView, so the loop below counts that as a
  // tap-persisting scroll rather than passing the file over.
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

/**
 * The frame primitive's scrolling root (layout.tsx). It sets
 * `keyboardShouldPersistTaps="handled"` on the ScrollView it owns, so a screen
 * built on it keeps taps by construction and need not declare the prop itself.
 */
const SCROLL_SCREEN_TAG = /<ScrollScreen\b/g;

describe('taps and the keyboard — whether a press has to be made twice', () => {
  test('the choosing screen keeps taps while the keyboard is up', () => {
    const source = readFileSync(join(SRC, 'ConvoScreen.tsx'), 'utf8');
    const scrolls = source.match(SCROLL_VIEW_TAG) ?? [];
    assert.equal(scrolls.length, 2, 'both the choosing content and live support can scroll');
    assert.equal((source.match(/keyboardShouldPersistTaps="handled"/g) ?? []).length, 2, 'both scroll surfaces retain keyboard taps');
    assert.ok(
      source.includes('keyboardShouldPersistTaps="handled"'),
      'a learner who typed their topic and reached for Send must not have that press eaten by the keyboard closing',
    );
  });

  test('every screen the app takes typing on answers the same way', () => {
    const offenders: string[] = [];
    for (const name of TYPING_SCREENS) {
      const source = readFileSync(join(SRC, name), 'utf8');
      const scrollViews = (source.match(SCROLL_VIEW_TAG) ?? []).length;
      // A ScrollScreen is a scroll that keeps taps on its own, so it counts as
      // one scroll AND one that persists — the screen owes no separate prop.
      const scrollScreens = (source.match(SCROLL_SCREEN_TAG) ?? []).length;
      const scrolls = scrollViews + scrollScreens;
      if (scrolls === 0) continue;
      const persists = (source.split('keyboardShouldPersistTaps').length - 1) + scrollScreens;
      if (persists < scrolls) offenders.push(`${name} has ${scrolls} scrolls and ${persists} that keep taps`);
    }
    assert.deepEqual(
      offenders,
      [],
      `One screen behaving differently from the rest is how a working Send comes to look broken:\n${offenders.join('\n')}`,
    );
  });

  test('the review deck scrolls, and its scroll keeps taps with the keyboard up — F308', () => {
    // F308: the review deck was the one typing surface that could not scroll,
    // so a due card answered on a small phone with the keyboard up had its
    // grade buttons under the keys. It is on the frame now: ScrollScreen owns
    // the scroll and the tap-persistence, and avoidKeyboard lifts the card.
    const source = readFileSync(join(SRC, 'ReviewScreen.tsx'), 'utf8');
    assert.match(source, /<ScrollScreen\b/, 'the review deck is not built on the scrolling frame, so it still cannot scroll');
    assert.match(source, /avoidKeyboard/, 'the review deck does not lift its card above the keyboard');
    assert.ok(
      !source.includes('centerFill'),
      'the review deck still centres with its own fixed fill instead of letting the frame scroll',
    );
  });
});
