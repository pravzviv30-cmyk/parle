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

  test('the step dots speak as one element, and the station line speaks not at all — F358, F458', () => {
    // Both carry an accessibilityLabel ("Step X of Y" / "Stop X of Y") but iOS
    // never focuses the group and never reads it unless the container is marked
    // `accessible`. The label without the flag is a promise the OS drops.
    const dots = region(componentsSource(), 'export function ProgressDots(', 'export function SpeakCircle(');
    assert.match(dots, /accessible(?![a-zA-Z])/, 'the step dots are not one focusable element, so their label is never read');
    assert.match(dots, /accessibilityLabel/, 'the step dots carry no label to read');

    // The station line is the exception, and it changed direction on purpose.
    // It used to be one focusable element reading "Stop three of seven", which
    // meant the invariant this app is strictest about, that no score is shown
    // mid-session, held for everybody except the learner using a screen reader.
    // It is decorative now, like the week rail on Home. Nothing is lost: what a
    // learner needs mid-session is what to say next, and that is the card above
    // it, in words.
    const station = region(componentsSource(), 'export function StationLine(', 'export function fitDisplay(');
    assert.match(station, /\{\.\.\.decorative\}/, 'the station line is not hidden from assistive tech, so it may be counting out loud again');
    assert.ok(!station.includes('accessibilityLabel'), 'the station line carries a label again, and the only thing it can say is a count');
  });
});

describe('the mockup-review primitives keep their promises — F362, F366, F368, F373', () => {
  test('a secure field can be shown, and says so to a screen reader — F373', () => {
    // A password typed blind is a password typed twice. The control is drawn
    // only for a secure field, sits at the touch floor, and the input's secrecy
    // follows the toggle rather than the prop alone. The F109 bindings around
    // it (id, aria-labelledby, role="alert") are not this test's business and
    // are held by surfaceContract.test.ts.
    const field = region(componentsSource(), 'export function Field(', 'export function TabBar<');
    assert.match(field, /secureTextEntry=\{secure && !revealed\}/, 'secrecy does not follow the Show/Hide toggle');
    assert.match(field, /\{secure && \(/, 'the control is drawn for fields that are not secure');
    assert.match(field, /accessibilityLabel=\{revealed \? 'Hide password' : 'Show password'\}/, 'the control does not say what it does');
    assert.match(field, /\{revealed \? 'Hide' : 'Show'\}/, 'the control does not read Show or Hide');
    assert.match(field, /minHeight: HIT/, 'the control is under the touch floor');
    assert.match(field, /minWidth: HIT/, 'the control is under the touch floor');
  });

  test('a stat can sit three to a row — F366', () => {
    // Two facts to a row is Home's shape; My French has three facts and one
    // line, so the basis narrows to thirty percent when asked, and nothing else
    // about the stat changes.
    const stat = region(componentsSource(), 'export function Stat(', 'export function Monogram(');
    assert.match(stat, /columns\?: 2 \| 3/, 'Stat takes no column count');
    assert.match(stat, /columns === 3 \? '30%' : '46%'/, 'three to a row is not thirty percent each');
  });

  test('the tab bar can name itself and stand with nothing chosen — F368', () => {
    // Inline on Profile, the segmented control is a setting: a learner who has
    // not chosen a daily goal must see three quiet segments, not a lie, and a
    // screen reader must hear what the three words are a choice of.
    const bar = region(componentsSource(), 'export function TabBar<', 'export function Stat(');
    assert.match(bar, /active: K \| null/, 'the tab bar cannot stand with nothing chosen');
    assert.match(bar, /accessibilityLabel\?: string/, 'the tab bar cannot name its group');
    assert.match(bar, /accessibilityRole="tablist" accessibilityLabel=\{accessibilityLabel\}/, 'the name is not on the group');
    assert.match(bar, /accessibilityState=\{\{ selected: isActive \}\}/, 'a segment no longer says it is selected');
  });

  test('the tint disc is a circle of one tint, hidden from assistive tech — F362', () => {
    // The one place a tint is drawn. Decorative, because the drawing inside it
    // is decorative and the place is named beside it.
    const disc = region(componentsSource(), 'export function TintDisc(', 'export function ProgressDots(');
    assert.match(disc, /\{\.\.\.decorative\}/, 'the disc is not hidden from assistive tech');
    assert.match(disc, /borderRadius: size \/ 2/, 'the disc is not a circle at its own size');
    assert.match(disc, /backgroundColor: tint\[name\]/, 'the disc is not filled with the named tint');
    assert.doesNotMatch(disc, /<Text/, 'the disc letters something');
  });
});
