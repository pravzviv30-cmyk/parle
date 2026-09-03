/**
 * The layout primitives, held to the source — F306.
 *
 * layout.tsx carries the shape every screen sits inside: the two screen roots,
 * the header row, the leave sheet. There is no renderer in this suite
 * (docs/TESTING.md), so the promises those roots make are checked by reading
 * the file the same way surfaceContract.test.ts reads a screen: strip the
 * comments, then assert on the markup that is left.
 *
 * Three promises are worth a tripwire, because each is a rule the transcript
 * already learned the hard way and a new root is the easy place to forget it:
 * a scroll body keeps taps while the keyboard is up, both roots carry the web
 * height fix so a flex child cannot refuse to shrink, and neither root ever
 * switches off or caps the OS reading size.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Same treatment as surfaceContract.test.ts: comments may say anything. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The layout source with comments gone. Read fresh in each test, so an absent
 * layout.tsx fails every one of these red rather than passing a negative check
 * on an empty string.
 */
function layoutSource(): string {
  return stripComments(readFileSync(join(SRC, 'layout.tsx'), 'utf8'));
}

/** The slice of source from one export marker up to the next. */
function region(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} is missing from layout.tsx`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} is missing from layout.tsx`);
  return source.slice(start, end);
}

describe('the layout primitives keep their promises — F306', () => {
  test('the scroll screen keeps taps while the keyboard is up, by construction — F306', () => {
    const scroll = region(
      layoutSource(),
      'export function ScrollScreen(',
      'export function ScreenHeader(',
    );
    assert.match(
      scroll,
      /keyboardShouldPersistTaps="handled"/,
      'a tap on the scroll body while the keyboard is up dismisses the keyboard instead of landing',
    );
  });

  test('both screen primitives carry the web height fix the transcript already has — F306', () => {
    const source = layoutSource();
    const screen = region(source, 'export function Screen(', 'export function ScrollScreen(');
    const scroll = region(source, 'export function ScrollScreen(', 'export function ScreenHeader(');
    // minHeight 0 beside flex 1 is what stops a flex child from refusing to
    // shrink and pushing the controls off the bottom on the web column.
    const heightFix = /flex:\s*1,\s*minHeight:\s*0/;
    assert.match(screen, heightFix, 'Screen omits the minHeight:0 that the transcript proved it needs');
    assert.match(scroll, heightFix, 'ScrollScreen omits the minHeight:0 that the transcript proved it needs');
  });

  test('the screen primitives never disable or cap font scaling — F306', () => {
    const source = layoutSource();
    assert.doesNotMatch(
      source,
      /allowFontScaling\s*[=:]\s*\{?\s*false/,
      'a layout primitive switches off font scaling, so a learner with large text set does not get it',
    );
    assert.doesNotMatch(
      source,
      /maxFontSizeMultiplier/,
      'a layout primitive caps how far its text may grow, which is the same refusal wearing a number',
    );
    // No motion library reaches this file, so no motion rule can be broken in it.
    assert.doesNotMatch(
      source,
      /\bimport\b[^;]*\bAnimated\b/,
      'the layout primitives import Animated; movement belongs to the scenes, not the frame',
    );
    assert.doesNotMatch(source, /\bAnimated\./, 'a layout primitive drives an animation; the frame does not move');
    assert.doesNotMatch(source, /\bAlert\b/, 'a layout primitive reaches for Alert instead of ConfirmSheet');
  });
});

describe('the chrome primitives hold their shape — F331, F334, F335', () => {
  test('the tab header sets its title at display size, left, as a heading, with a purpose line beneath and nothing capped', () => {
    // TabHeader mounts in the scroll body, not the frame's header slot, so a
    // fixed display title over a purpose line can scroll rather than pin. The
    // title is the tab's name at display size, left, rolled as a heading; the
    // purpose is one plain body line under it. Nothing caps or truncates either.
    const header = region(layoutSource(), 'export function TabHeader(', 'type ConfirmSheetProps');
    assert.match(header, /marginBottom: space\(5\)/, 'the header block does not space itself off the body beneath it');
    assert.match(
      header,
      /flexDirection: 'row', alignItems: 'center', gap: space\(3\)/,
      'the title row is not a row with room for a trailing control',
    );
    assert.match(header, /accessibilityRole="header"/, 'the tab title is not rolled as a heading');
    assert.match(
      header,
      /type\.display,\s*\{ color: paper\.ink, flex: 1 \}/,
      'the title is not the display type in ink, taking the row',
    );
    assert.match(
      header,
      /type\.body,\s*\{ color: paper\.inkSoft, marginTop: space\(2\) \}/,
      'the purpose is not a soft-ink body line beneath the title',
    );
    // Nothing capped: no line cap, no growth cap, no scaling switch, no centring
    // that would re-read the left title as centred.
    assert.doesNotMatch(header, /numberOfLines/, 'the tab title is capped to a line count');
    assert.doesNotMatch(header, /maxFontSizeMultiplier/, 'the tab title caps how far it may grow');
    assert.doesNotMatch(header, /allowFontScaling/, 'the tab title opts out of the OS reading size');
    assert.doesNotMatch(header, /textAlign/, 'the tab title is aligned away from the left');
  });

  test('the shared header keeps a slot at the touch floor on both sides, whether or not it holds a control', () => {
    // Three slots always. The left is the chevron at the touch floor or an empty
    // box its width; the right is the leave word at the floor or an empty box its
    // width; the title sits in the flex centre between them, not half a hit target
    // off it because one side was empty. The marginLeft:auto crutch is gone.
    const header = region(layoutSource(), 'export function ScreenHeader(', 'type TabHeaderProps');
    assert.match(header, /width: HIT, height: HIT/, 'the back chevron is not a slot at the touch floor');
    assert.match(header, /<View style=\{\{ width: HIT \}\} \/>/, 'the left slot collapses when there is no back control');
    assert.match(
      header,
      /minWidth: HIT, minHeight: HIT, alignItems: 'flex-end'/,
      'the leave word is not a right slot at the touch floor',
    );
    assert.match(header, /<View style=\{\{ minWidth: HIT \}\} \/>/, 'the right slot collapses when there is no leave control');
    assert.match(header, /flex: 1, alignItems: 'center'/, 'the title is not the centred flex slot between the two');
    assert.doesNotMatch(header, /marginLeft: 'auto'/, 'the header still shoves the leave word with marginLeft:auto');
  });

  test('a scroll screen under the tab bar pads its own bottom, and one that is not does not', () => {
    // The frame owns the air above the tab bar: the scroll content pads its own
    // bottom by space(8) only when it sits under the bar, so the last card clears
    // it without the tab padding its own scroll. A screen that is not under the
    // bar adds nothing here.
    const scroll = region(layoutSource(), 'export function ScrollScreen(', 'export function ScreenHeader(');
    assert.match(
      scroll,
      /bottom === 'tab' \? \{ paddingBottom: space\(8\) \} : null/,
      'the scroll content does not pad its bottom under the tab bar, or pads it unconditionally',
    );
  });

  test('DESIGN.md names the tab header and the monogram', () => {
    const design = readFileSync(join(SRC, '..', '..', '..', 'DESIGN.md'), 'utf8');
    assert.match(design, /TabHeader/, 'DESIGN.md does not name the tab header');
    assert.match(design, /Monogram/, 'DESIGN.md does not name the monogram');
  });
});
