/**
 * Where a live surface is allowed to start drawing.
 *
 * Three screens in this app are the whole window. The lesson driver, the safety
 * stop and the live failure screen are all pushed under `headerShown: false`, so
 * there is no navigation bar above them and no tab bar below them. Nothing pays
 * the safe-area inset for them, which means that if they do not pay it
 * themselves their first line sits under the Dynamic Island and their last
 * control sits under the home indicator, on every iPhone since the X.
 *
 * All three did exactly that. The frame in `layout.tsx` has paid the inset once
 * for eighteen other screens since F307, and these three were never adopted, so
 * this suite holds them to it.
 *
 * There is no renderer in this suite (docs/TESTING.md), so what a screen is
 * built on is read out of the file, the way `surfaceContract.test.ts` and the
 * rest of the live suites read theirs. That is a blunt tool and it is pointed at
 * one specific thing: a live surface that re-grows a full-bleed root of its own.
 *
 * Two claims here are not about a screen at all. `requireFullScreen` keeps an
 * iPad out of Slide Over, where the window is narrower than the 375pt this app
 * has a design for, and the pinned deployment target keeps an Expo upgrade from
 * quietly dropping the oldest phones the app supports.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything. Only what compiles is a frame. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const lesson = stripComments(read('../LiveSessionScreen.tsx'));
const stopView = stripComments(read('../tutor/SafetyStopView.tsx'));
const errorView = stripComments(read('./LiveErrorView.tsx'));
const outOfMinutesView = stripComments(read('./OutOfMinutesView.tsx'));
const sessionView = stripComments(read('../SessionView.tsx'));
const navigator = stripComments(read('../nav/RootNavigator.tsx'));
const layout = stripComments(read('../layout.tsx'));

/** The surfaces that are the whole window, with nothing above or below them. */
const FULL_BLEED = [
  ['the lesson driver', lesson],
  ['the safety stop', stopView],
  ['the live failure screen', errorView],
  // Stage 3 (2026-09-25): the lesson's out-of-minutes page moved to its own
  // file, and is held to the same frame rules there.
  ['the out-of-minutes page', outOfMinutesView],
] as const;

/**
 * The body of one early return, from its `if (...) {` to the brace that closes
 * it at component level. The same reader `tutor/safetyView.test.ts` uses, for
 * the same reason: this suite is about what one branch returns, and a whole
 * file match would pass while three of four branches were still full bleed.
 */
const branchOf = (source: string, opens: string): string => {
  const from = source.indexOf(opens);
  assert.notEqual(from, -1, `this test is reading for "${opens}" and the lesson no longer contains it`);
  const to = source.indexOf('\n  }\n', from);
  assert.notEqual(to, -1, `the branch at "${opens}" no longer closes at component level`);
  return source.slice(from, to);
};

describe('the live surfaces sit inside the one frame, F444', () => {
  test('nothing above these three screens pays the inset for them', () => {
    // The premise, held to the navigator rather than to a comment. Both the
    // stack and the tab navigator turn the system chrome off, so a screen that
    // does not pay the notch has nothing behind it that will.
    assert.match(
      navigator,
      /headerShown: false/,
      'the navigator grew a system header; if it now pays the inset, this whole suite is reading the wrong premise',
    );
    assert.ok(
      !/headerShown: true/.test(navigator),
      'some route turned the system header back on, so the frame and the header would both pay the top inset',
    );
    // And the frame really is the one place the maths lives.
    assert.match(
      layout,
      /paddingTop: insets\.top \+ topGap/,
      'the frame no longer pays the top inset, so adopting it buys these screens nothing',
    );
    assert.match(
      layout,
      /bottom === 'inset' \? insets\.bottom \+ space\(4\)/,
      'the frame no longer pays the bottom inset, so the home indicator is back over the last control',
    );
  });

  test('all three are built on the shared frame rather than a bare View', () => {
    for (const [name, body] of FULL_BLEED) {
      assert.match(
        body,
        /from '[./]*layout\.tsx'/,
        `${name} does not import the frame at all, so whatever it renders is measuring the window for itself`,
      );
      assert.match(
        body,
        /<(Screen|ScrollScreen|RoomWait)\b/,
        `${name} is not built on the shared frame, so its content starts at y=0 and runs under the Dynamic Island`,
      );
    }
  });

  test('none of the three re-grows the safe-area maths of its own', () => {
    // Adding one of these to surfaceContract's SAFE_AREA_ALLOW is the wrong
    // fix: the frame is the one place that reads the window, and a nineteenth
    // screen doing its own arithmetic is how the first eighteen drifted apart.
    for (const [name, body] of FULL_BLEED) {
      assert.ok(
        !body.includes('useSafeAreaInsets'),
        `${name} measures the safe area itself instead of letting the frame pay the notch once`,
      );
      assert.ok(
        !body.includes('react-native-safe-area-context'),
        `${name} reaches for the safe-area package directly; only layout.tsx may`,
      );
      assert.ok(
        !body.includes('<SafeAreaView'),
        `${name} pays the inset with a second mechanism, so a screen now has two answers about where the top is`,
      );
    }
  });

  test('the bottom inset is paid too, not just the notch', () => {
    // `bottom="none"` hands the home indicator back to the body, and none of
    // these three has a body that catches it. The home indicator is the half of
    // this that a phone in a case makes unusable rather than merely ugly.
    for (const [name, body] of FULL_BLEED) {
      assert.doesNotMatch(
        body,
        /bottom=(?:"none"|\{'none'\})/,
        `${name} tells the frame to skip the bottom inset, so its last control sits under the home indicator`,
      );
      assert.doesNotMatch(
        body,
        /bottom=(?:"tab"|\{'tab'\})/,
        `${name} is a pushed route with no tab bar under it, so there is no bar to draw the bottom inset for it`,
      );
    }
  });

  test('every status branch of the lesson returns the frame, not a bare centred View', () => {
    // Four branches can be the whole window here. Three of them draw their own
    // spinner or paywall; the fourth hands over to SessionView, which is on the
    // frame already and is covered below.
    for (const opens of [
      "if (live.status.phase === 'connecting'",
      'if (!live.prompt) {',
    ]) {
      const body = branchOf(lesson, opens);
      assert.match(
        body,
        /return <RoomWait\b/,
        `the lesson branch at "${opens}" returns a full-bleed root of its own instead of the frame`,
      );
    }
    assert.match(read('./RoomWait.tsx'), /<ScrollScreen bottom="inset"/, 'the shared wait has no safe-area frame');
    // Stage 3 Fable review (2026-09-25): out of minutes hands over to its own
    // page, the way a failure hands over to LiveErrorView, because the paywall
    // inside it can be taller than a small phone at a large text size. That
    // page is where the session has ended, not the live scene kept still
    // below, so it opens on the scrolling frame in its own file.
    assert.match(
      branchOf(lesson, "if (live.status.phase === 'out-of-minutes')"),
      /return <OutOfMinutesView label=\{live\.status\.label\} message=\{live\.status\.message\} userId=\{userId\} onExit=\{onExit\} \/>;/,
      'the lesson draws its own out-of-minutes page again instead of the one on the frame',
    );
    assert.match(
      outOfMinutesView,
      /export function OutOfMinutesView\([\s\S]*?return \(\s*<ScrollScreen bottom="inset">/,
      'the out-of-minutes page is not on the scrolling frame, so Back can fall off a small phone',
    );
    // And the two shared surfaces open on the frame in their own files.
    assert.match(
      stopView,
      /export function SafetyStopView\([\s\S]*?return \(\s*<ScrollScreen\b/,
      'the safety stop returns a bare View again, and it is the one screen whose words must be readable at any size',
    );
    assert.match(
      errorView,
      /export function LiveErrorView\([\s\S]*?return \(\s*<Screen\b/,
      'the live failure screen returns a bare View again, so its diagnostics run under the notch',
    );
  });

  test('the lesson gains no scroll container it did not have', () => {
    // The live scene is full bleed on purpose: a circle, a card and a transcript
    // that must not move under the learner mid-turn. Adopting the frame is not
    // a licence to wrap it in a scroll, so the still root is the only variant
    // this file may use.
    assert.ok(!/<ScrollView\b/.test(lesson), 'the lesson opened a ScrollView, and the live scene does not scroll');
    assert.ok(!/<ScrollScreen\b/.test(lesson), 'the lesson reached for the scrolling frame; the live scene wants the still one');
  });

  test('the live scene draws nothing above the frame SessionView owns', () => {
    // This is the half of the bug the frame cannot fix by being imported.
    // SessionView is a ScrollScreen and pays the inset once, so wrapping it in
    // a second Screen would pay the notch twice and push the lesson down by a
    // whole inset. The audio-blocked card and the safety banner used to be its
    // siblings instead, which put them above the frame's padding and straight
    // under the Dynamic Island. They go inside the frame, through the slot.
    const opens = '<View style={st.root}>';
    const from = lesson.indexOf(opens);
    const to = lesson.indexOf('<SessionView');
    assert.notEqual(from, -1, 'the live scene no longer has the root this test reads');
    assert.notEqual(to, -1, 'the live scene no longer renders SessionView');
    assert.ok(from < to, 'SessionView is drawn outside the live scene root');
    assert.ok(
      !lesson.slice(from + opens.length, to).includes('<'),
      'something is drawn between the live scene root and SessionView, which puts it above the frame and under the notch',
    );
    // The slot itself, on both sides of the seam.
    assert.match(
      lesson,
      /<SessionView[\s\S]{0,120}above=\{/,
      'the lesson no longer hands its overlay row to the frame, so whatever it draws there is outside the safe area',
    );
    assert.match(sessionView, /above\?: ReactNode;/, 'the session surface has no slot above its header for the live driver to fill');
    assert.match(
      sessionView,
      /header=\{\s*<>\s*\{props\.above\}/,
      'the slot is drawn somewhere other than inside the frame, which is the only place that is any use',
    );
  });

  test('an iPad cannot resize the app below the width it has a design for', () => {
    const app = JSON.parse(read('../../app.json')) as {
      expo: { ios: { requireFullScreen?: boolean; deploymentTarget?: string; supportsTablet?: boolean } };
    };
    const ios = app.expo.ios;
    // The app is one 460pt column centred in the window (App.tsx). Slide Over
    // is 320pt on most iPads, below the 375pt floor every screen is drawn for,
    // and there is no narrow design to fall back to.
    assert.equal(
      ios.requireFullScreen,
      true,
      'the app can be dragged into Slide Over, where the window is narrower than any layout in this repo',
    );
    assert.equal(
      ios.supportsTablet,
      true,
      'this test only earns its keep while the app ships to iPad at all; if that changed, say so here',
    );
  });

  test('the iOS floor is pinned rather than left to whatever Expo defaults to', () => {
    const app = JSON.parse(read('../../app.json')) as { expo: { ios: { deploymentTarget?: string } } };
    // Unpinned, this is whatever the Expo template writes into the Podfile that
    // week. An SDK upgrade that raises it drops real devices with no diff to
    // read. 16.4 is the iPhone 8 and X generation and up.
    assert.equal(
      app.expo.ios.deploymentTarget,
      '16.4',
      'the iOS floor is unpinned or moved, so an Expo upgrade can drop devices without anyone deciding to',
    );
  });
});
