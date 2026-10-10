/**
 * The one line under "Welcome back" — F374.
 *
 * Two halves, and the seam between them is honest. The sentence is a pure
 * module and is checked directly against the four copy rules this repo
 * enforces. Whether the screen actually draws it is a source read, because
 * there is no renderer in this workspace: the read can see the import, the
 * JSX and the order it sits in relative to the headline, and it cannot see a
 * pixel, a font size, or what a screen reader announces.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { SIGN_IN_PURPOSE, welcomeBackGreeting } from './copy.ts';
import { guiltIn } from '../copy/guilt.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');

describe('sign in says what is waiting behind the door — F374', () => {
  test('the sign-in purpose line is plain, short and carries no dash, digit or debt — F374', () => {
    // The copy rules, in the order they are written down in DESIGN.md.
    assert.ok(!/—/.test(SIGN_IN_PURPOSE), `"${SIGN_IN_PURPOSE}" carries an em dash`);
    assert.ok(!/\d/.test(SIGN_IN_PURPOSE), `"${SIGN_IN_PURPOSE}" carries a digit, and a promise with a number in it is a claim`);
    assert.equal(
      guiltIn(SIGN_IN_PURPOSE),
      undefined,
      `"${SIGN_IN_PURPOSE}" says a word Luvani promised never to say to a learner`,
    );
    assert.ok(
      SIGN_IN_PURPOSE.length > 0 && SIGN_IN_PURPOSE.length < 90,
      `the line is ${SIGN_IN_PURPOSE.length} characters; under the headline it has to be read at a glance`,
    );
    // One sentence, not a paragraph, and it ends like one.
    assert.match(SIGN_IN_PURPOSE, /\.$/, 'the line is not a finished sentence');
    assert.equal(SIGN_IN_PURPOSE.split('.').filter((part) => part.trim().length > 0).length, 1, 'the line is more than one sentence');
    // Nothing here is asked for, apologised for or nagged about. A returning
    // learner is told what is theirs, not how long they were away.
    assert.doesNotMatch(SIGN_IN_PURPOSE, /sorry|welcome back again|while you were|since you|away|forgot/i);

    // And the screen draws it. The import is the half that proves the words are
    // the shared ones rather than a second copy typed into the JSX.
    const screen = read('SignInScreen.tsx');
    assert.match(
      screen,
      /import \{ SIGN_IN_PURPOSE, welcomeBackGreeting \} from '\.\/copy\.ts';/,
      'SignInScreen does not import the shared line, so the words on screen are not the words tested here',
    );
    assert.match(screen, /\{SIGN_IN_PURPOSE\}/, 'SignInScreen imports the line and never renders it');
    assert.ok(
      !screen.includes(SIGN_IN_PURPOSE),
      'SignInScreen also carries the sentence inline, so there are now two copies and only one of them is tested',
    );

    // Under the headline, not above it, and in the soft-ink body style the
    // sign-up screen uses for exactly the same job.
    const headline = screen.indexOf('Welcome back');
    const line = screen.indexOf('{SIGN_IN_PURPOSE}');
    assert.ok(headline >= 0, 'the sign-in headline moved; this test is reading the wrong screen');
    assert.ok(line > headline, 'the purpose line is drawn before the headline it belongs under');
    const block = screen.slice(headline, line);
    assert.match(block, /type\.body/, 'the purpose line is not in the body type the sign-up sub line uses');
    assert.match(block, /paper\.inkSoft/, 'the purpose line is not in soft ink, so it competes with the headline');
  });
});

test('a saved first name personalises the greeting and absent data keeps it neutral', () => {
  assert.equal(welcomeBackGreeting(' Camille '), 'Welcome back, Camille');
  assert.equal(welcomeBackGreeting('Mary Jane'), 'Welcome back, Mary Jane');
  for (const name of [undefined, null, '', '  ']) assert.equal(welcomeBackGreeting(name), 'Welcome back');
  const screen = read('SignInScreen.tsx');
  assert.match(screen, /welcomeBackGreeting\(planDraft\?\.firstName\)/);
  assert.doesNotMatch(screen, /welcomeBackGreeting\(email/);
});

test('all sign-in entries suppress onboarding chrome while create account keeps it', () => {
  const screen = read('SignInScreen.tsx');
  assert.match(screen, /useOnboardingFramePresentation\(onboardingProgress\(\{ page: 'account' \}\), \{ hideProgress: true \}, !embedded\)/);
  assert.match(screen, /const Frame = ScrollScreen/);
  assert.doesNotMatch(screen, /<OnboardingLayout/);
  assert.match(read('SignUpScreen.tsx'), /<OnboardingLayout/);
  assert.match(screen, /fontScale > 1\.3 && st\.doorsStacked/);
  assert.match(screen, /<RevealItem active=\{!embedded\}>/);
  assert.match(screen, /const liveFontMultiplier = fontScale \+ 1;/);
  assert.match(screen, /<Text ref=\{headingRef\} maxFontSizeMultiplier=\{liveFontMultiplier\}/);
});
