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

  test('a pill, an outline and a ghost can be given a name for assistive tech, and forward it', () => {
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

    // The outline button too: on the web the derived name was not reaching the
    // accessibility tree, so a "Talk about this instead" read as a bare button.
    const outline = region(componentsSource(), 'export function OutlineButton(', 'export function GhostButton(');
    assert.match(outline, /accessibilityLabel\?: string/, 'OutlineButton takes no accessibilityLabel');
    assert.match(
      outline,
      /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
      'OutlineButton does not forward its accessibilityLabel, or does not fall back to the label',
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

/**
 * The revamp A primitives, held to the source — F569, F577, F586.
 *
 * The mockup replaced most of the app's white-card-with-a-button shapes with two
 * pieces: a card that lifts off the ground on one soft shadow, and a tinted row
 * that is a whole button. Both are in this file rather than in five screens, and
 * what follows is the promises they make.
 */
describe('the revamp primitives keep their promises — F569, F577, F586', () => {
  test('a tinted row is a pressable at the touch floor with a white disc, a title, a gloss and a chevron, and it names itself once', () => {
    // One Pressable, not a card with a button in it: the whole row is the
    // target, a nested button is invalid on the web, and a row whose only tap
    // area is its chevron is F545 wearing a tint.
    const row = region(componentsSource(), 'export function TintRow(', 'const s = StyleSheet.create(');
    assert.match(row, /accessibilityRole="button"/, 'the tinted row is not a button, so nothing says it opens anything');
    assert.match(
      row,
      /accessibilityLabel=\{accessibilityLabel \?\? \(gloss \? `\$\{title\}, \$\{gloss\}` : title\)\}/,
      'the row does not name itself from its own title and gloss, so a screen reader reads two loose lines',
    );
    assert.match(row, /accessibilityState=\{\{ disabled \}\}/, 'the row never says it is unavailable');
    // The shape: a white disc at the disc token, the words taking the rest, the
    // chevron last, and the whole row over the touch floor.
    assert.match(row, /<ChevronRight color=\{paper\.inkFaint\} \/>/, 'the row draws no chevron, so nothing marks it as a way in');
    assert.match(row, /\{trailing != null \? trailing : null\}/, 'the row cannot carry a state before its chevron');
    const disc = region(componentsSource(), '  tintDisc: {', '  tintWords:');
    assert.match(disc, /width: DISC,\s*height: DISC,/, 'the glyph disc is not the disc token square');
    assert.match(disc, /borderRadius: DISC \/ 2/, 'the glyph disc is not a circle at its own size');
    assert.match(disc, /backgroundColor: paper\.card/, 'the glyph disc is not white, so the glyph sits straight on the tint');
    const style = region(componentsSource(), '  tintRow: {', '  tintRowPressed:');
    assert.match(style, /minHeight: HIT \+ space\(8\)/, 'the tinted row sits under the touch floor the mockup draws it at');
    assert.match(style, /borderRadius: radius\.row/, 'the tinted row turns the card corner, so a row reads as a small card');
    // The tint is a surface and nothing else, and it is the only colour the row
    // is told: everything else is a token.
    assert.match(row, /backgroundColor: tint\[name\]/, 'the row is not grounded in its own tint');
    assert.match(row, /pressed && !disabled && s\.tintRowPressed/, 'the row has no pressed state, or fades a disabled one instead of saying so');
    assert.doesNotMatch(row, /opacity/, 'the row says unavailable in opacity, which leaves a control with no shape to fall back on');
    // Nothing clipped and nothing capped, so the row grows with the reading size.
    for (const cap of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!row.includes(cap), `the tinted row caps its words with ${cap}; a long title must wrap and the row grow to hold it`);
    }
  });

  test('a card lifts off the ground with the one soft shadow and the wider radius', () => {
    // The whisper is a named token in theme.ts, spread here. A card that wrote
    // its own shadow numbers would be the second shadow in the app, and the
    // hairline stays under it because elevation draws nothing on Android below
    // API 28 and a card there would dissolve into the ground.
    const card = region(componentsSource(), '  card: {', '  cardPadded:');
    assert.match(card, /\.\.\.shadow\.whisper/, 'the card no longer lifts on the one named shadow');
    assert.match(card, /borderRadius: radius\.card/, 'the card no longer turns the card corner from the token');
    assert.match(card, /borderWidth: HAIRLINE/, 'the card lost its hairline, so on Android below API 28 it has no edge at all');
    // The numbers stay in the theme. A shadow spelled out here is how an app
    // ends up with four shadows, each a little deeper than the last.
    const source = componentsSource();
    for (const number of ['shadowOpacity', 'shadowRadius', 'shadowOffset']) {
      const spelled = source.split('\n').filter((line) => line.includes(number));
      assert.deepEqual(
        spelled.filter((line) => !line.includes('signal.good') && !/^\s*shadow(Offset|Opacity|Radius): /.test(line)).length,
        0,
        `${number} is written somewhere new in components.tsx; the whisper is a token and the mic glow is the only other shadow`,
      );
    }
  });

  test('a selected option announces its state on the web as well as on a device', () => {
    // Two spellings, one meaning, and neither is derived from the other.
    // `accessibilityState` is what VoiceOver and TalkBack read; `aria-selected`
    // is what the browser puts in its accessibility tree, and without it a
    // learner picking a plan, a goal or a voice on the web hears three
    // identical buttons (F522, F586).
    const source = componentsSource();
    const bar = region(source, 'export function TabBar<', 'export function Stat(');
    assert.match(bar, /accessibilityState=\{\{ selected: isActive \}\}/, 'a segment no longer says it is selected on a device');
    assert.match(bar, /aria-selected=\{isActive\}/, 'a segment says nothing to the browser, so on the web the choice is silent');
    const option = region(source, 'export function OptionCard(', 'export function Field(');
    assert.match(option, /accessibilityState=\{\{ selected \}\}/, 'the option card no longer says it is selected on a device');
    assert.match(option, /aria-selected=\{selected\}/, 'the option card says nothing to the browser, so on the web the choice is silent');
    // And the chosen segment is the identity violet with warm-white lettering,
    // the way the primary pill and the active tab already are.
    assert.match(bar, /color: isActive \? paper\.onInk : paper\.inkSoft/, 'the chosen segment is not warm-white lettering on a filled pill');
    const track = region(source, '  tabActive: {', '  dotsRow:');
    assert.match(track, /backgroundColor: accent\.primary/, 'the chosen segment is not the identity violet');
  });

  test('the week rail labels every dot and stays hidden from assistive technology', () => {
    // Seven days, each mark under the day it stands for. A day that happened is
    // the identity violet: the founder chose it for the calendar record, and a
    // calendar is a diary of days already spent rather than a state, so the
    // "a state mark is never violet" rule is not what this bends (F577).
    const rail = region(componentsSource(), 'export function WeekRail(', 'export function TintRow(');
    assert.match(rail, /labels\?: readonly string\[\]/, 'the rail cannot be given the seven day names');
    assert.match(rail, /\{labels != null && <Text style=\{\[type\.small, \{ color: paper\.inkSoft \}\]\}>\{labels\[index\]\}<\/Text>\}/, 'the day names are not one small soft-ink line over each mark');
    assert.match(rail, /week\.map\(\(filled, index\)/, 'the rail no longer draws one mark per day');
    assert.match(
      rail,
      /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/,
      'the rail is no longer hidden from assistive technology, so seven letters are read aloud as if they were a week',
    );
    assert.doesNotMatch(rail, /accessibilityLabel/, 'the rail carries a label of its own; the sentence beside it is what says the week');
    const done = region(componentsSource(), '  markDone: {', '  markWaiting:');
    assert.match(done, /backgroundColor: accent\.primary/, 'a day that happened is no longer the identity violet the founder chose');
  });
});
