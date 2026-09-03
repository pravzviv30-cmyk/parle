/**
 * The component vocabulary, held to the source — F332, F333.
 *
 * components.tsx carries the drawn pieces every screen builds from. There is no
 * renderer in this suite (docs/TESTING.md), so the promises those pieces make
 * are checked by reading the file the same way layout.test.ts and
 * surfaceContract.test.ts read a screen: strip the comments, slice the region
 * from one export to the next, then assert on the markup that is left.
 *
 * Two pieces are worth a tripwire here. The monogram is the one drawn initial,
 * a filled violet disc the design says is the identity mark, and it must stay
 * hidden from assistive tech so a screen reader does not read a loose letter.
 * And the pill and the ghost each take a name for assistive tech that falls back
 * to their label, because the tabs and the drill lean on it to say more than the
 * word printed on the control.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Same treatment as layout.test.ts: comments may say anything. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The components source with comments gone. Read fresh in each test. */
function componentsSource(): string {
  return stripComments(readFileSync(join(SRC, 'components.tsx'), 'utf8'));
}

/** The slice of source from one export marker up to the next. */
function region(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} is missing from components.tsx`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} is missing from components.tsx`);
  return source.slice(start, end);
}

describe('the drawn vocabulary keeps its promises — F332, F333', () => {
  test('the monogram is one filled violet disc with a warm-white initial, and it is hidden from assistive tech', () => {
    // The identity violet fill is the design palette.ts names for "the primary
    // action and the monogram", so the disc is filled, not a hollow ring. The
    // initial is the serif in warm-white on that fill, and the disc is spread
    // decorative so a screen reader walks past it rather than reading a letter.
    const mono = region(componentsSource(), 'export function Monogram(', 'export function ProgressDots(');
    assert.match(mono, /backgroundColor: accent\.primary/, 'the disc is not filled with the identity violet');
    assert.match(mono, /borderRadius: size \/ 2/, 'the disc is not a circle at its own size');
    assert.match(mono, /\{\.\.\.decorative\}/, 'the disc is not hidden from assistive tech');
    assert.match(mono, /fontFamily: font\.serif/, 'the initial is not set in the serif');
    assert.match(mono, /fontSize: size \* 0\.44/, 'the initial is not sized to the disc');
    assert.match(mono, /color: paper\.onInk/, 'the initial is not the warm-white on a filled control');
  });

  test('a pill and a ghost can be given a name for assistive tech, and forward it', () => {
    // Both take an optional accessibilityLabel and forward it to the Pressable,
    // falling back to the printed label when it is absent — which is the name a
    // Pressable already derived from its child Text, so the fallback is a no-op.
    const pill = region(componentsSource(), 'export function PillButton(', 'export function OutlineButton(');
    assert.match(pill, /accessibilityLabel\?: string/, 'PillButton takes no accessibilityLabel');
    assert.match(
      pill,
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'PillButton does not forward its accessibilityLabel, or does not fall back to the label',
    );

    const ghost = region(componentsSource(), 'export function GhostButton(', 'export function OptionCard(');
    assert.match(ghost, /accessibilityLabel\?: string/, 'GhostButton takes no accessibilityLabel');
    assert.match(
      ghost,
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'GhostButton does not forward its accessibilityLabel, or does not fall back to the label',
    );
  });
});

describe('the onboarding-polish primitives speak their state — F354, F358', () => {
  test('an option card tells a screen reader it is selected, the way the tab bar does — F354', () => {
    // The tab bar folds its active state into accessibilityState so VoiceOver
    // says "selected" (components.tsx:426); the option card must do the same, or
    // a learner picking a voice, goal, strictness or reminder hears nothing.
    const option = region(componentsSource(), 'export function OptionCard(', 'export function Field(');
    assert.match(
      option,
      /accessibilityState=\{\{ selected \}\}/,
      'the option card does not tell a screen reader whether it is selected',
    );
  });

  test('the step dots and the station line are one spoken element — F358', () => {
    // Both carry an accessibilityLabel ("Step X of Y" / "Stop X of Y") but iOS
    // never focuses the group and never reads it unless the container is marked
    // `accessible`. The label without the flag is a promise the OS drops.
    const dots = region(componentsSource(), 'export function ProgressDots(', 'export function SpeakCircle(');
    assert.match(dots, /accessible(?![a-zA-Z])/, 'the step dots are not one focusable element, so their label is never read');
    assert.match(dots, /accessibilityLabel/, 'the step dots carry no label to read');

    const station = region(componentsSource(), 'export function StationLine(', 'export function fitDisplay(');
    assert.match(station, /accessible(?![a-zA-Z])/, 'the station line is not one focusable element, so its label is never read');
    assert.match(station, /accessibilityLabel/, 'the station line carries no label to read');
  });
});
